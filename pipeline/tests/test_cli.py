import json
import shutil
from datetime import date
from pathlib import Path
from unittest.mock import ANY

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
        ["fetch", "sfs", "--offline", "--number", "2007:572", "--data-dir", str(data_dir)]
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
        "fetch",
        "sfs",
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
        ["fetch", "sfs", "--offline", "--number", "2007:528", "--number", "2007:572",
         "--data-dir", str(data_dir)]
    )  # fmt: skip

    output = capsysbinary.readouterr()
    assert exit_code == 1
    assert [doc["id"] for doc in json.loads(output.out)] == ["sfs-2007-572"]
    assert b"sfs-2007-528: download failed" in output.err


def test_unknown_number_stops_before_downloading(data_dir, capsysbinary):
    exit_code = main(
        ["fetch", "sfs", "--offline", "--number", "2017:673", "--data-dir", str(data_dir)]
    )

    assert exit_code == 1
    assert b"not downloaded yet" in capsysbinary.readouterr().err


def test_rejects_malformed_number():
    with pytest.raises(SystemExit):
        main(["fetch", "sfs", "--number", "2007-528"])


def test_fetch_fffs_offline_prints_saves_and_stores(tmp_path, capsysbinary):
    shutil.copytree(FFFS_FIXTURES, tmp_path / "raw" / "fi_fffs")

    exit_code = main(["fetch", "fffs", "--offline", "--data-dir", str(tmp_path)])

    output = capsysbinary.readouterr()
    assert exit_code == 0
    assert len(json.loads(output.out)) == 5
    assert output.err.count(b"saved fffs-") == 5
    saved = json.loads((tmp_path / "json" / "fi_fffs" / "fffs-2023-4.json").read_bytes())
    assert saved["amends"] == "FFFS 2014:4"
    assert SqliteStorage(tmp_path / "regtech.db").get_document("fffs-2014-4").identifier == (
        "FFFS 2014:4"
    )


@pytest.mark.parametrize("limit", ["0", "-1", "x"])
def test_rejects_limit_that_is_not_a_positive_whole_number(limit, capsys):
    with pytest.raises(SystemExit):
        main(["fetch", "sfs", "--number", "2007:528", "--limit", limit])

    assert "not a positive whole number" in capsys.readouterr().err


def test_damaged_download_gives_a_short_error(data_dir, capsysbinary):
    (data_dir / "raw" / "riksdagen" / "search" / "2007-572.json").write_text("<html>")

    exit_code = main(
        ["fetch", "sfs", "--offline", "--number", "2007:572", "--data-dir", str(data_dir)]
    )

    assert exit_code == 1
    assert capsysbinary.readouterr().err.startswith(b"regtech: ")


def test_unexpected_search_id_fails_that_item(data_dir, capsysbinary):
    search_path = data_dir / "raw" / "riksdagen" / "search" / "2007-572.json"
    search = json.loads(search_path.read_bytes())
    search["dokumentlista"]["dokument"][0]["id"] = "../escaped"
    search_path.write_text(json.dumps(search), encoding="utf-8")

    exit_code = main(
        ["fetch", "sfs", "--offline", "--number", "2007:572", "--number", "2007:528",
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

    main(["fetch", "sfs", "--offline", "--number", "2007:572", "--data-dir", str(data_dir)])

    assert (data_dir / "json" / "riksdagen" / "sfs-2007-572.json").exists()
    assert not (data_dir.parent / "escaped.json").exists()


def drop_register_row(raw_dir, number):
    search_path = raw_dir / "search.html"
    soup = BeautifulSoup(search_path.read_bytes(), "html.parser")
    next(dd for dd in soup.select("dd") if dd.get_text() == number).find_parent("li").decompose()
    search_path.write_text(str(soup), encoding="utf-8")


def test_full_fffs_fetch_marks_regulations_that_left_the_register(data_dir, capsysbinary):
    raw_dir = data_dir / "raw" / "fi_fffs"
    shutil.copytree(FFFS_FIXTURES, raw_dir)
    main(["fetch", "sfs", "--offline", "--number", "2007:572", "--data-dir", str(data_dir)])
    main(["fetch", "fffs", "--offline", "--data-dir", str(data_dir)])
    drop_register_row(raw_dir, "2024:22")
    (raw_dir / "fffs-2014-4" / "regulation.pdf").unlink()
    capsysbinary.readouterr()

    main(["fetch", "fffs", "--offline", "--limit", "1", "--data-dir", str(data_dir)])
    limited_err = capsysbinary.readouterr().err
    main(["fetch", "fffs", "--offline", "--number", "2017:11", "--data-dir", str(data_dir)])
    numbered_err = capsysbinary.readouterr().err
    exit_code = main(["fetch", "fffs", "--offline", "--data-dir", str(data_dir)])

    err = capsysbinary.readouterr().err
    main(["fetch", "fffs", "--offline", "--data-dir", str(data_dir)])
    second_err = capsysbinary.readouterr().err
    storage = SqliteStorage(data_dir / "regtech.db")
    saved = json.loads((data_dir / "json" / "fi_fffs" / "fffs-2024-22.json").read_bytes())
    assert b"no longer listed" not in limited_err
    assert b"no longer listed" not in numbered_err
    assert exit_code == 1
    assert err.count(b"no longer listed ") == 1 and b"no longer listed fffs-2024-22\n" in err
    assert b"no longer listed" not in second_err
    assert storage.get_document("fffs-2024-22").repealed_on == date.today()
    assert saved["repealed_on"] == date.today().isoformat()
    assert storage.get_document("fffs-2014-4").repealed_on is None
    assert storage.get_document("sfs-2007-572").repealed_on is None
    document_events = [
        (e.document_id, e.status)
        for e in storage.feed(after=0, since=None, limit=500)
        if e.level == "document"
    ]
    assert ("fffs-2024-22", "ADDED") in document_events
    assert document_events.count(("fffs-2024-22", "REPEALED")) == 1


def test_empty_register_listing_removes_nothing(data_dir, capsysbinary):
    raw_dir = data_dir / "raw" / "fi_fffs"
    shutil.copytree(FFFS_FIXTURES, raw_dir)
    main(["fetch", "fffs", "--offline", "--data-dir", str(data_dir)])
    for number in ["2026:1", "2024:22", "2023:4", "2017:11", "2014:4"]:
        drop_register_row(raw_dir, number)
    capsysbinary.readouterr()

    main(["fetch", "fffs", "--offline", "--data-dir", str(data_dir)])

    assert b"no longer listed" not in capsysbinary.readouterr().err
    assert all(
        s.repealed_on is None for s in SqliteStorage(data_dir / "regtech.db").list_documents()
    )


def test_fetch_fffs_with_number_prints_only_that_regulation(tmp_path, capsysbinary):
    shutil.copytree(FFFS_FIXTURES, tmp_path / "raw" / "fi_fffs")

    exit_code = main(
        ["fetch", "fffs", "--offline", "--number", "2017:11", "--data-dir", str(tmp_path)]
    )

    assert exit_code == 0
    assert [doc["id"] for doc in json.loads(capsysbinary.readouterr().out)] == ["fffs-2017-11"]


def test_fetch_sfs_without_number_fails(tmp_path, capsysbinary):
    exit_code = main(["fetch", "sfs", "--offline", "--data-dir", str(tmp_path)])

    assert exit_code == 1
    assert b"fetch sfs needs --number, --all or --since" in capsysbinary.readouterr().err


def test_fetch_sfs_all_offline_gets_the_ministry_laws_in_force(data_dir, capsysbinary):
    exit_code = main(["fetch", "sfs", "--offline", "--all", "--data-dir", str(data_dir)])

    printed = json.loads(capsysbinary.readouterr().out)
    assert exit_code == 0
    assert [doc["id"] for doc in printed] == ["sfs-2007-528", "sfs-2007-572"]


def test_fetch_fffs_all_gets_the_whole_register(tmp_path, capsysbinary):
    shutil.copytree(FFFS_FIXTURES, tmp_path / "raw" / "fi_fffs")

    main(["fetch", "fffs", "--offline", "--data-dir", str(tmp_path)])
    whole_register = json.loads(capsysbinary.readouterr().out)
    main(["fetch", "fffs", "--offline", "--all", "--data-dir", str(tmp_path)])

    assert json.loads(capsysbinary.readouterr().out) == [
        {**doc, "updated_at": ANY} for doc in whole_register
    ]


def test_since_is_for_sfs_only(tmp_path, capsysbinary):
    exit_code = main(
        ["fetch", "fffs", "--offline", "--since", "2026-10-01", "--data-dir", str(tmp_path)]
    )

    assert exit_code == 1
    assert b"--since is for fetch sfs only" in capsysbinary.readouterr().err


def test_rejects_malformed_since(capsys):
    with pytest.raises(SystemExit):
        main(["fetch", "sfs", "--since", "2026-13-01"])

    assert "not a day like 2026-10-01" in capsys.readouterr().err
