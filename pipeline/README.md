# regtech

regtech downloads Swedish financial law and makes it searchable and linked:

- Acts and Ordinances (SFS) from Riksdagen's open API, `data.riksdagen.se`.
- FFFS regulations from Finansinspektionen's register on `fi.se`, read from their PDFs.

It splits each document into chapters and sections, finds the citations in the text (for example "25 kap. 4 § lagen (2007:528)"), links each citation to the section it points at, stores everything in one SQLite database file with full-text search, and shows it in a browser viewer.

The client's requirements are in [Spec.md](Spec.md). Design decisions, facts about the sites and open questions are in [Plan.md](Plan.md).

## Install

Needs [uv](https://docs.astral.sh/uv/), a tool that installs Python and Python packages.

```sh
uv sync
```

This installs Python 3.13 (pinned in `.python-version`) and the exact package versions from `uv.lock` into `.venv/`. Then either prefix each command with `uv run`, or activate the environment once per terminal:

```sh
uv run regtech --help

source .venv/bin/activate
regtech --help             # or: python3 -m regtech --help
```

## Commands

| Command | Does |
|---|---|
| `regtech fetch-sfs --number 2007:528` | Download and parse one Act or Ordinance from Riksdagen. Repeat `--number` for more. Prints all parsed documents as one JSON array. |
| `regtech crawl-fffs` | Download and parse every active FFFS regulation: register page, item pages, regulation PDFs, decision memos. Prints no JSON (too large); the parsed documents are in `data/json/fi_fffs/`. Without `--limit`, also removes stored regulations that are no longer in the register ([Plan.md](Plan.md#storage)). |
| `regtech link` | Match every stored citation to the section it points at. Deletes all stored links and builds them again. |
| `regtech serve` | Start the viewer at http://127.0.0.1:8000/. `--port 8080` picks another port. Ctrl+C stops it. |

| Flag | For | Does |
|---|---|---|
| `--offline` | `fetch-sfs`, `crawl-fffs` | Parse the files already in `data/raw/` again; download nothing. An item whose files are missing fails. |
| `--limit N` | `fetch-sfs`, `crawl-fffs` | Only the first N items, for a quick trial run. N must be a whole number above 0. |
| `--data-dir DIR` | all four | Where downloads, JSON files and the database go. Default `data`. |

While running:

- Items are done one at a time. Each finished document prints `saved <id>` on the error output (stderr), and its JSON file and database row are written at once.
- A failed item (download or parse) is skipped and the others continue. At the end the failures are listed on the error output and the command exits with code 1.
- A damaged saved file gives a one-line message starting `regtech: ` and exit code 1.
- `fetch-sfs` stops before any document is downloaded when Riksdagen's search does not find exactly one document for a number.
- `link` prints the number of links, then the cited documents that are not stored, most cited first. For example, with the 9 SFS laws stored:

  ```
  6468 links stored.
  Cited but not stored (document: citations):
    SFS 2005:551: 210
    SFS 2018:672: 156
    ...
  ```

## Usual order

```sh
# 1. The priority laws from the spec (SFS 2017:673 is missing, see Known limits)
regtech fetch-sfs --number 2007:528 --number 2007:572 --number 2017:630 \
  --number 2004:297 --number 2004:329 --number 2013:561 --number 2004:46 \
  --number 2010:751 --number 2010:2043 > sfs.json

# 2. All active FFFS regulations
regtech crawl-fffs

# 3. Link citations across everything stored
regtech link

# 4. Browse
regtech serve
```

Run `link` again after every `fetch-sfs` or `crawl-fffs`: saving a document again removes the links from that document until `link` runs. What the viewer shows: [Plan.md](Plan.md#viewer-m4).

## What lands in `data/`

```
data/                                  git-ignored
  raw/                                 every download, kept for --offline
    riksdagen/search/2007-528.json     search result for one SFS number
    riksdagen/documents/sfs-2007-528.json
    fi_fffs/search.html                the FFFS register page
    fi_fffs/fffs-2017-11/              item.html, regulation.pdf, memo.pdf,
                                       consolidated.pdf (only when the item page links one)
  json/                                one parsed document per file
    riksdagen/sfs-2007-528.json
    fi_fffs/fffs-2017-11.json
  regtech.db                            SQLite database: documents, links, search index
```

The document format is defined in `src/regtech/models.py`; why each field looks the way it does: [Plan.md](Plan.md#data-model).

## Rebuild the database from saved downloads

`--offline` runs the same commands on the files in `data/raw/`, without network. Use it after changing the parser, or when a command stops with "data/regtech.db was made by an older version of regtech" (the database layout changed):

```sh
rm data/regtech.db
regtech fetch-sfs --offline --number 2007:528 --number 2007:572   # the same numbers as before
regtech crawl-fffs --offline
regtech link
```

## Tests and lint

```sh
uv run pytest --cov=regtech      # tests with coverage; the spec asks for over 80%
uv run ruff check src tests     # lint: finds likely mistakes
uv run ruff format src tests    # format: fixes layout
```

The tests use saved real files in `tests/fixtures/` and need no network.

## Known limits

- **fi.se not checked live.** fi.se did not answer from the development computer (connections time out), so `crawl-fffs` has never run against the real site. The FFFS reader was built and tested on Internet Archive copies of the register, item pages and PDFs. The first real crawl may need fixes; start with `regtech crawl-fffs --limit 5`.
- **PDF reading checked on few files.** The PDF rules were checked on the saved PDFs of 5 regulations, not the whole register. Known cases that are read wrongly: [Plan.md](Plan.md#fffs-m2).
- **References to a whole chapter.** Incoming references to a whole chapter, or to a section that is not stored, show at the top of the document page, not on a section.
- **"i fråga om".** Only the first "i fråga om <law>" or "bestämmelser i <law> …:" phrase in a section decides which law the later section numbers in the same paragraph belong to.
- **Repealed laws stay.** `fetch-sfs` never removes anything: the saved Riksdagen data has no field that marks a law repealed. A repealed law stays in the database until `data/regtech.db` is deleted and rebuilt. (Regulations that leave the FFFS register are removed by a full `crawl-fffs`.)
- **Viewer styling needs internet.** The viewer loads its style sheet (Tailwind) from Tailwind's servers.
- **Open questions** (details in [Plan.md](Plan.md)):
  - C7: the spec's AML Ordinance, SFS 2017:673, does not exist on Riksdagen. `regtech fetch-sfs --number 2017:673` stops with "found 0 documents, not 1". Which number is meant is an open question for the client.
  - Q41: possible additions (updates since the last run, tests against the live sites, automatic test runs, parallel downloads) are not decided.
