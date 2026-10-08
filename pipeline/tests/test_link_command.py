import shutil
from pathlib import Path

from regtech.cli import main

FIXTURES = Path(__file__).parent / "fixtures" / "riksdagen"


def test_link_prints_count_and_missing_statutes(tmp_path, capsysbinary):
    shutil.copytree(FIXTURES, tmp_path / "raw" / "riksdagen")
    main(
        ["fetch-sfs", "--offline", "--number", "2007:528", "--number", "2007:572",
         "--data-dir", str(tmp_path)]
    )  # fmt: skip
    capsysbinary.readouterr()

    exit_code = main(["link", "--data-dir", str(tmp_path)])

    lines = capsysbinary.readouterr().out.decode().splitlines()
    assert exit_code == 0
    assert lines[0].endswith(" links stored.") and int(lines[0].split()[0]) > 0
    assert lines[1] == "Cited but not stored (document: citations):"
    assert any(line.startswith("  SFS 2005:551: ") for line in lines[2:])
    assert not any("SFS 2007:528" in line for line in lines)
