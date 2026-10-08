import json
import shutil
from pathlib import Path

import pytest
from bs4 import BeautifulSoup

from regtech.cli import main
from regtech.storage.sqlite_storage import SqliteStorage

FIXTURES = Path(__file__).parent / "fixtures" / "riksdagen"
FFFS_FIXTURES = Path(__file__).parent / "fixtures" / "fi_fffs"


@pytest.fixture
def data_dir(tmp_path):
    shutil.copytree(FIXTURES, tmp_path / "raw" / "riksdagen")
    return tmp_path


def test_fetch_sfs_offline_prints_saves_and_stores(data_dir, capsysbinary):
    exit_code = main(
        ["fetch-sfs", "--offline", "--number", "2007:572", "--data-dir", str(data_dir)]
    )

    printed = json.loads(capsysbinary.readouterr().out)
    assert exit_code == 0
    assert [doc["id"] for doc in printed] == ["sfs-2007-572"]
    assert printed[0]["updated_at"].endswith("Z")
    saved = json.loads((data_dir / "json" / "riksdagen" / "sfs-2007-572.json").read_bytes())
    assert saved["identifier"] == "SFS 2007:572"
    assert (
        SqliteStorage(data_dir / "regtech.db").get_document("sfs-2007-572").title == saved["title"]
    )


def test_limit(data_dir, capsysbinary):
    args = [
        "fetch-sfs",
        "--offline",
        "--number",
        "2007:572",
        "--number",
        "2007:528",
        "--limit",
        "1",
    ]
    main([*args, "--data-dir", str(data_dir)])

    assert [doc["id"] for doc in json.loads(capsysbinary.readouterr().out)] == ["sfs-2007-572"]


def test_failed_item_is_reported_and_others_continue(data_dir, capsysbinary):
    (data_dir / "raw" / "riksdagen" / "documents" / "sfs-2007-528.json").unlink()

    exit_code = main(
        ["fetch-sfs", "--offline", "--number", "2007:528", "--number", "2007:572",
         "--data-dir", str(data_dir)]
    )  # fmt: skip

    output = capsysbinary.readouterr()
    assert exit_code == 1
    assert [doc["id"] for doc in json.loads(output.out)] == ["sfs-2007-572"]
    assert b"sfs-2007-528: download failed" in output.err


def test_unknown_number_stops_before_downloading(data_dir, capsysbinary):
    exit_code = main(
        ["fetch-sfs", "--offline", "--number", "2017:673", "--data-dir", str(data_dir)]
    )

    assert exit_code == 1
    assert b"not downloaded yet" in capsysbinary.readouterr().err


def test_rejects_malformed_number():
    with pytest.raises(SystemExit):
        main(["fetch-sfs", "--number", "2007-528"])


def test_crawl_fffs_offline_saves_and_stores_without_printing_json(tmp_path, capsysbinary):
    shutil.copytree(FFFS_FIXTURES, tmp_path / "raw" / "fi_fffs")

    exit_code = main(["crawl-fffs", "--offline", "--data-dir", str(tmp_path)])

    output = capsysbinary.readouterr()
    assert exit_code == 0
    assert output.out == b""
    assert output.err.count(b"saved fffs-") == 5
    saved = json.loads((tmp_path / "json" / "fi_fffs" / "fffs-2023-4.json").read_bytes())
    assert saved["amends"] == "FFFS 2014:4"
    assert SqliteStorage(tmp_path / "regtech.db").get_document("fffs-2014-4").identifier == (
        "FFFS 2014:4"
    )


@pytest.mark.parametrize("limit", ["0", "-1", "x"])
def test_rejects_limit_that_is_not_a_positive_whole_number(limit, capsys):
    with pytest.raises(SystemExit):
        main(["fetch-sfs", "--number", "2007:528", "--limit", limit])

    assert "not a positive whole number" in capsys.readouterr().err


def test_damaged_download_gives_a_short_error(data_dir, capsysbinary):
    (data_dir / "raw" / "riksdagen" / "search" / "2007-572.json").write_text("<html>")

    exit_code = main(
        ["fetch-sfs", "--offline", "--number", "2007:572", "--data-dir", str(data_dir)]
    )

    assert exit_code == 1
    assert capsysbinary.readouterr().err.startswith(b"regtech: ")


def test_unexpected_search_id_fails_that_item(data_dir, capsysbinary):
    search_path = data_dir / "raw" / "riksdagen" / "search" / "2007-572.json"
    search = json.loads(search_path.read_bytes())
    search["dokumentlista"]["dokument"][0]["id"] = "../escaped"
    search_path.write_text(json.dumps(search), encoding="utf-8")

    exit_code = main(
        ["fetch-sfs", "--offline", "--number", "2007:572", "--number", "2007:528",
         "--data-dir", str(data_dir)]
    )  # fmt: skip

    output = capsysbinary.readouterr()
    assert exit_code == 1
    assert b"not a Riksdagen document id like sfs-2007-528: '../escaped'" in output.err
    assert [doc["id"] for doc in json.loads(output.out)] == ["sfs-2007-528"]


def test_document_id_inside_the_download_is_not_used_for_paths(data_dir, capsysbinary):
    document_path = data_dir / "raw" / "riksdagen" / "documents" / "sfs-2007-572.json"
    raw = json.loads(document_path.read_bytes())
    raw["dokumentstatus"]["dokument"]["dok_id"] = "../../../escaped"
    document_path.write_text(json.dumps(raw), encoding="utf-8")

    main(["fetch-sfs", "--offline", "--number", "2007:572", "--data-dir", str(data_dir)])

    assert (data_dir / "json" / "riksdagen" / "sfs-2007-572.json").exists()
    assert not (data_dir.parent / "escaped.json").exists()


def drop_register_row(raw_dir, number):
    search_path = raw_dir / "search.html"
    soup = BeautifulSoup(search_path.read_bytes(), "html.parser")
    next(dd for dd in soup.select("dd") if dd.get_text() == number).find_parent("li").decompose()
    search_path.write_text(str(soup), encoding="utf-8")


def test_full_fffs_crawl_removes_regulations_that_left_the_register(data_dir, capsysbinary):
    raw_dir = data_dir / "raw" / "fi_fffs"
    shutil.copytree(FFFS_FIXTURES, raw_dir)
    main(["fetch-sfs", "--offline", "--number", "2007:572", "--data-dir", str(data_dir)])
    main(["crawl-fffs", "--offline", "--data-dir", str(data_dir)])
    drop_register_row(raw_dir, "2024:22")
    (raw_dir / "fffs-2014-4" / "regulation.pdf").unlink()
    capsysbinary.readouterr()

    main(["crawl-fffs", "--offline", "--limit", "1", "--data-dir", str(data_dir)])
    limited_err = capsysbinary.readouterr().err
    exit_code = main(["crawl-fffs", "--offline", "--data-dir", str(data_dir)])

    err = capsysbinary.readouterr().err
    storage = SqliteStorage(data_dir / "regtech.db")
    assert b"removed" not in limited_err
    assert exit_code == 1
    assert err.count(b"removed ") == 1 and b"removed fffs-2024-22\n" in err
    assert storage.get_document("fffs-2024-22") is None
    assert not (data_dir / "json" / "fi_fffs" / "fffs-2024-22.json").exists()
    assert (raw_dir / "fffs-2024-22" / "item.html").exists()
    assert storage.get_document("fffs-2014-4") is not None
    assert storage.get_document("sfs-2007-572") is not None


def test_empty_register_listing_removes_nothing(data_dir, capsysbinary):
    raw_dir = data_dir / "raw" / "fi_fffs"
    shutil.copytree(FFFS_FIXTURES, raw_dir)
    main(["crawl-fffs", "--offline", "--data-dir", str(data_dir)])
    for number in ["2026:1", "2024:22", "2023:4", "2017:11", "2014:4"]:
        drop_register_row(raw_dir, number)
    capsysbinary.readouterr()

    main(["crawl-fffs", "--offline", "--data-dir", str(data_dir)])

    assert b"removed" not in capsysbinary.readouterr().err
    assert len(SqliteStorage(data_dir / "regtech.db").list_documents()) == 5


def test_fetch_sfs_without_number_or_preset_fails(data_dir, capsys):
    exit_code = main(["fetch-sfs", "--data-dir", str(data_dir)])
    assert exit_code == 2
    assert "either --number or --preset must be provided" in capsys.readouterr().err


def test_fetch_sfs_preset_resolves_numbers(data_dir, capsysbinary, monkeypatch):
    from regtech import cli

    monkeypatch.setitem(cli.FINANCIAL_PRESETS, "sample", ["2007:528", "2007:572"])
    exit_code = main(
        ["fetch-sfs", "--offline", "--preset", "sample", "--limit", "1", "--data-dir", str(data_dir)]
    )
    assert exit_code == 0
    printed = json.loads(capsysbinary.readouterr().out)
    assert len(printed) == 1
    assert printed[0]["id"] == "sfs-2007-528"

