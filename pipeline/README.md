# regtech

regtech downloads financial regulation from Sweden and Finland and makes it searchable and linked:

- Acts and Ordinances (SFS) from Riksdagen's open API, `data.riksdagen.se`.
- FFFS regulations from Finansinspektionen's register on `fi.se`, read from their PDFs.
- Finnish FIN-FSA regulations and guidelines from Finanssivalvonta's official catalogue, read from their PDFs.
- EU regulations by CELEX number from the Publications Office CELLAR API, parsed from the official English XHTML text.

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
| `regtech fetch sfs --number 2007:528` | Download and parse one Act or Ordinance from Riksdagen. Repeat `--number` for more. Prints all parsed documents as one JSON array. |
| `regtech fetch sfs --all` | Every Ministry of Finance Act and Ordinance in force (about 1,200), plus stored ones that were repealed since. Takes about half an hour. |
| `regtech fetch sfs --since 2026-10-01` | Only the Ministry of Finance laws Riksdagen changed on or after that day, for a daily update. Same choice of laws as `--all`. |
| `regtech fetch fffs` | Download and parse every active FFFS regulation: register page, item pages, regulation PDFs, decision memos. `--number 2017:11` picks only that one from the register. Prints all parsed documents as one JSON array. Without `--limit` and `--number`, also marks stored regulations that are no longer in the register ([Plan.md](Plan.md#storage)). |
| `regtech fetch fiva` | Download and parse the Finnish `Määräykset ja ohjeet` corpus from the official catalogue. `--number 2/2024` picks one item. |
| `regtech fetch eu --number 32022R2554` | Download and parse an EU regulation by CELEX number from the official CELLAR API. Repeat `--number` for more. |
| `regtech link` | Match every stored citation to the section it points at. Deletes all stored links and builds them again. |
| `regtech serve` | Start the viewer at http://localhost:8000/. It listens on `0.0.0.0`, so other computers on the same network can open it too; `--host 127.0.0.1` limits it to this computer. `--port 8080` picks another port. Ctrl+C stops it. |

| Flag | For | Does |
|---|---|---|
| `--number YYYY:N` | `fetch sfs`, `fetch fffs` | Only this document. Repeat for more. A number that is not found stops the command before any document is downloaded. |
| `--number N/YYYY` | `fetch fiva` | Only this catalogue item, for example `2/2024`. Repeat for more. |
| `--number CELEX` | `fetch eu` | Only this EU regulation, for example `32022R2554` (DORA). Repeat for more. |
| `--all` | `fetch sfs`, `fetch fffs` | `sfs`: every Ministry of Finance law in force; `fetch sfs` needs one of `--number`, `--all`, `--since`. `fffs`: the whole register, the same as no flag. |
| `--since YYYY-MM-DD` | `fetch sfs` | Ministry of Finance laws changed on or after that day. |
| `--offline` | `fetch sfs`, `fetch fffs`, `fetch fiva`, `fetch eu` | Parse the files already in `data/raw/` again; download nothing. An item whose files are missing fails. |
| `--limit N` | `fetch sfs`, `fetch fffs` | Only the first N items, for a quick trial run. N must be a whole number above 0. |
| `--data-dir DIR` | all commands | Where downloads, JSON files and the database go. Default `data`. |

While running:

- Items are done one at a time. Each finished document prints `saved <id>` on the error output (stderr), and its JSON file and database row are written at once. Each FFFS regulation newly missing from the register prints `no longer listed <id>`.
- A failed item (download or parse) is skipped and the others continue. At the end the failures are listed on the error output and the command exits with code 1.
- A damaged saved file gives a one-line message starting `regtech: ` and exit code 1.
- `fetch sfs` stops before any document is downloaded when Riksdagen's search does not find exactly one document for a number. `fetch fffs --number` stops the same way when the number is not in the register (repealed regulations are not listed).
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
regtech fetch sfs --number 2007:528 --number 2007:572 --number 2017:630 \
  --number 2004:297 --number 2004:329 --number 2013:561 --number 2004:46 \
  --number 2010:751 --number 2010:2043 > sfs.json

# 2. All active FFFS regulations
regtech fetch fffs

# 3. Finnish FIN-FSA regulations and guidelines (all catalogue PDFs)
regtech fetch fiva

# 4. EU regulations by CELEX number (example: DORA)
regtech fetch eu --number 32022R2554

# 5. Link citations across everything stored
regtech link

# 6. Export the library for Nordic RegTech Studio
npm run pipeline:export

# 7. Browse
regtech serve
```

Run `link` again after every `fetch sfs` or `fetch fffs`: saving a document again removes the links from that document until `link` runs. What the viewer shows: [Plan.md](Plan.md#viewer-m4).

## What lands in `data/`

```
data/                                  git-ignored
  raw/                                 every download, kept for --offline
    riksdagen/search/2007-528.json     search result for one SFS number
    riksdagen/documents/sfs-2007-528.json
    riksdagen/documents/sfs-2007-528.html  the law's page, opened by the viewer's "Official page" link
    fi_fffs/search.html                the FFFS register page
    fi_fffs/fffs-2017-11/              item.html, regulation.pdf, memo.pdf,
                                       consolidated.pdf (only when the item page links one)
    fiva/fiva-2024-2/                  item.html, regulation.pdf
    eu/eu-2022-2554/                   notice.xml, regulation.xhtml
  json/                                one parsed document per file
    riksdagen/sfs-2007-528.json
    fi_fffs/fffs-2017-11.json
    fiva/fiva-2024-2.json
    eu/eu-2022-2554.json
  regtech.db                            SQLite database: documents, links, search index, version changes
```

The viewer serves everything under `data/raw/` at `/files/`, so its PDF, memo and SFS page links open these saved copies; the online address stays next to each one. A document saved before 2026-10-10 has no saved-copy links until it is parsed again with `--offline`.

The document format is defined in `src/regtech/models.py`; why each field looks the way it does: [Plan.md](Plan.md#data-model).

## Change feed API

For other platforms that import Swedish law changes. It runs as part of `regtech serve`, with no login: anyone who can reach the server can read it.

| Request | Returns |
|---|---|
| `GET /api/v1/feed?after=0&limit=50` | Events oldest first, after event `after`. `limit` 1 to 500, default 50. `since=YYYY-MM-DD` skips events fetched before that day. |
| `GET /api/v1/documents/sfs-2007-528` | The whole stored document as JSON; 404 when not stored. |

Read the feed in a loop: send the `next_after` of each answer as the next `after`, until `events` comes back empty. Store `next_after` between runs.

```sh
curl "http://localhost:8000/api/v1/feed?after=0&limit=1"
```

```json
{
  "events": [
    {
      "event_id": 1, "fetched_at": "2026-10-10T08:12:40Z",
      "level": "section", "status": "MODIFIED", "upcoming": true,
      "source": "riksdagen", "document_id": "sfs-2007-528", "identifier": "SFS 2007:528",
      "title": "Lag (2007:528) om värdepappersmarknaden", "chapter": "7", "section": "6",
      "amending_act": "SFS 2026:784", "amended_date": "2026-12-05",
      "old_text": "… Lag (2010:2075).", "new_text": "… Lag (2026:784).",
      "urls": {
        "viewer": "http://localhost:8000/doc/sfs-2007-528#riksdagen_sfs-2007-528_k7_p6_i20261205",
        "document_api": "http://localhost:8000/api/v1/documents/sfs-2007-528",
        "file": null
      }
    }
  ],
  "next_after": 1
}
```

| Field | Meaning |
|---|---|
| `level` | `section`: one section changed. `document`: a whole document was added (first fetched) or repealed; `chapter`, `section` and the texts are empty. |
| `status` | `MODIFIED`, `ADDED` or `REPEALED`. |
| `upcoming` | `true`: the change is on a wording that has not taken effect yet. When it takes effect, a later event records the same change on the text in force. |
| `amending_act`, `amended_date` | The act that made the change and the day it takes effect; for a document, its in-force or repeal date. Either can be empty. |
| `fetched_at` | When `regtech fetch` recorded the change. The feed only grows when a fetch runs. |
| `urls.file` | The saved PDF or SFS page, when it exists. |

The same events are shown, newest first, on the viewer's Changes page (`/changes`).

## Rebuild the database from saved downloads

`--offline` runs the same commands on the files in `data/raw/`, without network. Use it after changing the parser, or when a command stops with "data/regtech.db was made by an older version of regtech" (the database layout changed):

```sh
rm data/regtech.db
regtech fetch sfs --offline --number 2007:528 --number 2007:572   # the same numbers as before
regtech fetch fffs --offline
regtech link
```

Deleting `data/regtech.db` also deletes the recorded version changes (Modified, Added, Repealed in the viewer). They cannot be rebuilt: `data/raw/` keeps only the latest download of each document. The rebuild records every document as added and the upcoming wordings again, nothing else. Change feed event ids start again at 1, so every platform reading the feed must start over from `after=0`. With `--offline`, fetches are never compared, so a parser change does not show up as a change in the law.

## Tests and lint

```sh
uv run pytest --cov=regtech      # tests with coverage; the spec asks for over 80%
uv run ruff check src tests     # lint: finds likely mistakes
uv run ruff format src tests    # format: fixes layout
```

The tests use saved real files in `tests/fixtures/` and need no network.

## Known limits

- **fi.se only partly checked live.** The FFFS reader was built and tested on Internet Archive copies of the register, item pages and PDFs. Only the 37 regulations from before 2006 have been fetched from the live site; a full `fetch fffs` has not run. How their older layouts differ: [Plan.md](Plan.md#older-fffs-pdfs-before-2006).
- **PDF reading checked on few files.** The PDF rules were checked on the test PDFs and the 40 regulations fetched on 2026-10-10, not the whole register. Known cases that are read wrongly: [Plan.md](Plan.md#fffs-m2).
- **References to a whole chapter.** Incoming references to a whole chapter, or to a section that is not stored, show at the top of the document page, not on a section.
- **"i fråga om".** Only the first "i fråga om <law>" or "bestämmelser i <law> …:" phrase in a section decides which law the later section numbers in the same paragraph belong to.
- **Repealed laws stay, marked.** Nothing is deleted, so recorded version changes are kept. SFS laws carry Riksdagen's repeal date and act; FFFS regulations that leave the register carry the day a full `fetch fffs` first missed them.
- **`--all` and `--since` see only Ministry of Finance laws.** A law of another ministry fetched with `--number` is updated only with `--number`. On a day when Riksdagen touches its whole list (2025-10-17), `--since` fetches almost every law.
- **Version changes start now.** Changes are recorded from the first fetch after 2026-10-10; older versions are not rebuilt. A section changed between fetches by an act that takes effect in stages can show the wrong stage's date ([Plan.md](Plan.md#version-changes-m22)).
- **Viewer styling needs internet.** The viewer loads its style sheet (Tailwind) from Tailwind's servers and its font (Inter) from Google Fonts.
- **Open questions** (details in [Plan.md](Plan.md)):
  - C7: the spec's AML Ordinance, SFS 2017:673, does not exist on Riksdagen. `regtech fetch sfs --number 2017:673` stops with "found 0 documents, not 1". Which number is meant is an open question for the client.
  - Q41: possible additions (tests against the live sites, automatic test runs, parallel downloads) are not decided.
