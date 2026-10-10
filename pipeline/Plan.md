# Plan: Swedish regulatory data pipeline

Implementation plan for [Spec.md](Spec.md) (Phase 1) and [Specv2.md](Specv2.md) (Phase 2). Facts about Riksdagen and lagar.se were checked on the live sites on 2026-10-07; facts about fi.se come from Internet Archive copies, except [older FFFS PDFs](#older-fffs-pdfs-before-2006), fetched live on 2026-10-10.

Open now: C7 (client), Q41, P11. All under [Open questions](#open-questions). Answered questions are folded into [Decisions](#decisions).

## Goal

A Python tool that downloads Swedish financial law (Acts and Ordinances from Riksdagen, FFFS regulations from Finansinspektionen), splits it into chapters and sections, extracts the citations in the text, links them into incoming and outgoing references, stores everything in SQLite with full-text search, and shows it in a browser viewer.

| Milestone | Scope | Command | Status |
|---|---|---|---|
| M1 | Riksdagen client and parser: chapters, sections, citations | `regtech fetch sfs --number 2007:528` | built 2026-10-07 |
| M2 | FFFS crawler and PDF parser: binding rules vs Allmänna råd, authorization clauses | `regtech fetch fffs` | built 2026-10-07; full live crawl not run |
| M3 | Incoming and outgoing references for each section | `regtech link` | built 2026-10-07 |
| M4 | SQLite with full-text search, browser viewer, test coverage over 80% | `regtech serve` | built 2026-10-07 |
| M2.1 | Local copies of PDFs, memos and SFS pages served by the viewer; PR #1 | `regtech serve` | built 2026-10-10 |
| M2.2 | Section-level changes between versions of a statute | `regtech fetch`, `regtech serve` | built 2026-10-10; two-wordings rule on trial |
| M2.3 | All Finance Ministry SFS statutes in force, then daily updates in under 30 s | `regtech fetch sfs --all`, `regtech fetch sfs --since YYYY-MM-DD` | built 2026-10-10 |
| M2.4 | Change feed: an API other platforms read new, changed and repealed law from, and a Changes page. Replaces Specv2.md's OCR milestone (no active FFFS PDF is a scan) | `regtech serve` | built 2026-10-10 |

## Decisions

The data models and design are ours; Spec.md's and Specv2.md's models are suggestions. Questions about scope and content go to the client through you.

### Scope

| Topic | Decision |
|---|---|
| Sanctions | Not built (optional in Spec.md, gone from Specv2.md). |
| FFFS set | All active rows of the register, base regulations and amendments, each its own document (client). |
| Regulation PDF | Base regulation: the consolidated PDF, else the base PDF. Amendment: its own PDF. Correction sheets and other attachments skipped (client). |
| Memos | Every memo, the base regulation's and each amendment's, each on the document whose page links it (client). |
| SFS set (M2.3) | Statutes from the Ministry of Finance only: `organ` starts with "Finansdepartementet", which includes its units (`Finansdepartementet FMA V`). 2,558 on 2026-10-10, 1,223 of them in force (you). |
| SFS in force | Not marked repealed in the list entry, or marked with a repeal date still in the future (24 laws on 2026-10-10). The mark: [Riksdagen](#riksdagen) (you). |
| Sections shown twice | Keep both the wording in force today and the upcoming wording, as two entries (client). |
| Citations | All of them: internal, SFS to SFS, FFFS to SFS, FFFS to FFFS, in every section and in the FFFS preamble. EU directives and regulations get a pill with no link. |
| Bemyndigande | Real delegations only: "får … meddela (ytterligare) föreskrifter", not "om verkställighet". |
| Reference chain | Direct references, plus the chain through bemyndigande sections, so an Act's section shows the FFFS rules that reach it through an Ordinance. Spec.md asks for "incoming supervisory rules" on Act sections. |
| Statutes not stored | Pill without a link; `regtech link` lists them, most cited first, so you can decide what to fetch next. |
| Text kept | Amendment notes and repealed sections stay in the text. Transitional provisions and appendices are not stored (SFS and FFFS). |
| Repealed documents | Kept and marked, never deleted, so their recorded version changes and the links to them stay (you). SFS: repeal date and repealing act from Riksdagen; a stored law that gets repealed is still fetched by `--all` and `--since`. FFFS: a full `fetch fffs` marks a regulation missing from the register with the day it first finds it missing (fi.se gives no repeal date). A regulation that comes back is unmarked by its next fetch. |
| Local copies | Each document keeps both its online links and its local copies; the viewer opens the local copy when its file exists. |
| SFS local copy | `fetch sfs` saves the document's `html` field as `sfs-2007-528.html` next to its JSON, so SFS pages are served like the PDFs. |
| Daily SFS sync | Part of `fetch sfs` (`--all`, `--since`), not a separate `sync-sfs` command; the client is told the name differs from Specv2.md. Uses Riksdagen's list sorted by last change, because `f_sys_d1` is ignored. |
| OCR | Not built: no active FFFS PDF is a scan. Specv2.md's M2.4 is replaced by the change feed (2026-10-10). |

### Version changes (M2.2)

| Topic | Decision |
|---|---|
| Since when | Recorded from the first fetch after M2.2 is built. Rebuilding older versions from amending acts is later work. |
| Documents | SFS and FFFS (you). An FFFS base regulation is compared when its consolidated PDF changes; amendment documents never change, so they get no statuses. |
| Old versions | Only the changed sections, in a new table. At each save, every section is compared with the stored version just before it. One row per changed section: full old text, full new text, status, amending act, date, fetch time. The highlighted diff is worked out from the two texts with `difflib` when shown. The `documents` table keeps only the latest full version. |
| Two wordings | While an amending act waits to take effect, the upcoming wording is compared with the wording before it (the text in force, or the previous upcoming wording when a section has two, as SFS 2007:528 11 kap. 16 §), from the first fetch that sees it, also a law's first fetch. The text in force gets no badge. Once the wording takes effect, the next fetch records the change on the text in force as usual, with the same diff, so the badge stays; the upcoming wording that disappears is not REPEALED. Built to be tried first (you): kept if it reads well in the viewer. |
| First fetch | No status from comparing fetches. "Unchanged" would claim a comparison that was never made. |
| `--offline` | Compares upcoming wordings only, not fetches: the saved downloads are the same files, so any difference from the stored version comes from a parser change, not the law. |
| Matching sections | By chapter, section number and wording (current or upcoming), not by `chunk_id`, whose `_i` and `_2` suffixes shift when a section is added before them. Two upcoming wordings of one section (SFS 2013:561 5 kap. 11 §) are matched in document order. A renumbered section (`/Ny beteckning 2 c §/`) shows as the old number gone and the new number added. |
| Amending act | The note at the end of the changed section ("Lag (2024:1086)."). Its date is the upcoming wording's `/Träder i kraft I:DATE/` date, else the first date in that act's transitional entry ("träder i kraft den …"), else empty; no date is guessed. The marker comes first because one act can take effect in stages: SFS 2026:634 "träder i kraft den 10 juli 2026 i fråga om 17 kap. 5 § och i övrigt den 10 januari 2030". A change found between fetches has no marker, so a staged act can give it the wrong stage's date. Only some acts have a transitional entry (SFS 2007:528: 22 of the 61 acts named in notes), and amending acts are not on Riksdagen as their own documents. FFFS: the newest regulation in the section's notes ("(FFFS 2019:28, FFFS 2024:4)"; a section can carry one note per paragraph), its date from the "Datum" next to that amendment on the base regulation's item page, which equals the amendment's "Gäller från". |
| REPEALED | When the new text is only "Har upphävts genom …" (Riksdagen keeps repealed sections that way; 33 in SFS 2007:528), or the section is gone from the new version. The act comes from that note. No repealed section seen yet in a consolidated FFFS PDF. |
| Viewer | The latest change per section: a status badge (MODIFIED, ADDED, REPEALED), the inline diff, the amending act and date. Sections gone from the latest version are listed at the top. Every change stays stored, so a history can be added later. |

### Change feed (M2.4)

| Topic | Decision |
|---|---|
| Events | One per row of `changes`: every section change above, plus a whole document ADDED (its first save) or REPEALED (`repealed_on` or `repealed_by` first set, or an FFFS regulation first missing from the register). ADDED carries the document's in-force date, REPEALED the repeal date and act. A document already repealed when first saved gets ADDED only. |
| Order and position | Oldest first by `event_id`; a platform passes the last `event_id` it got as `after`. Not newest first: with a limit, newest first loses the older events of a busy period. `since=YYYY-MM-DD` only picks the first day to read from. |
| Which date filters | The fetch time, not the in-force date: that one is empty for some changes and often in the future, so filtering on it would skip events. |
| Event id | `changes.id`, an `INTEGER PRIMARY KEY` that SQLite never renumbers. Rows from layout version 3 keep their row numbers. |
| Access | No login for now (you, 2026-10-10), like the rest of the viewer. Outside platforms will reach it over the internet, so an API key read from an environment variable is the planned next step. |
| Path | `/api/v1/`, so the format can change while the two-wordings rule is on trial without breaking current readers. |
| Links | Full addresses built from the address of the request: the section in the viewer (the document when the section is gone or the event is for the whole document), the document API, and the saved PDF or SFS page when its file exists. |
| Changes page | Newest first, grouped by fetch day, 50 per page with an "Older" link; tabs for source (SFS, FFFS) and status. Same rows as the API. |

### Output and running

| Topic | Decision |
|---|---|
| Output | One JSON array on screen (also for one document), plus one JSON file per document. |
| Flags | `--offline` (parse saved downloads again), `--limit N`, `--data-dir`. |
| Failures | A failed item is reported and skipped; exit code 1 at the end. A number that is not found stops the command before any download. |
| Linking | A separate command, `regtech link`, run after fetching. |
| Network | Always IPv4; 1 second between requests; up to 3 retries when the connection fails. A full FFFS crawl is about 1,200 requests, 20 to 30 minutes. Add retries on 429 and 5xx only if a crawl hits them. |
| Command names | `regtech fetch sfs`, `regtech fetch fffs`, `regtech link`, `regtech serve`. Spec.md names `fetch-sfs` and `crawl-fffs`; the client must be told. |

### Storage, search and viewer

| Topic | Decision |
|---|---|
| Storage | SQLite from M1, because the linker needs all documents in one place. Incoming references live only in the database, not in the JSON files, which would go stale. |
| Search | SQLite FTS5 with default word splitting: whole words, å/ä/ö also match a/a/o, `tvätt*` matches word starts. Trigram splitting (part-word matches, index three times bigger) was not chosen. Covers section text, group headings and titles; not memo text, which would flood results. |
| Viewer | Pages built on the server with Jinja2, Tailwind from its CDN (needs internet; Tailwind calls this mode fit for trying things out, not public sites). Extras: search window, incoming references, links to the official page, PDF and memo. |
| Where it runs | On your machine, listening on `0.0.0.0` so the local network can open it (PR #1); `--host 127.0.0.1` limits it to your machine. |
| Coverage | Over 80% of the whole package, not only the parsers. |

### Stack

| Need | Choice | Why, when not obvious |
|---|---|---|
| Models | Pydantic v2, `list[str]` and `str \| None` style | |
| HTML | BeautifulSoup4 with `html.parser` | Speed does not matter for a few hundred pages |
| PDF | PyMuPDF behind `PdfReader` | Text quality and speed (0.1 s per document; pdfplumber 8.6 s), italic flag per piece of text. AGPL asks nothing for in-house use; if the tool leaves the company, the client's legal team decides, fallback pypdfium2 (Apache/BSD). |
| HTTP | httpx behind `Downloader` | IPv4 is one argument |
| Storage | SQLite with FTS5 behind `DocumentStore` and `LinkStore` | |
| Viewer | FastAPI, Jinja2, Tailwind from its CDN | |
| CLI | argparse | A few commands with a few flags |
| Tests | pytest, pytest-cov | |
| Python and packages | Python 3.11 or newer, uv with a lock file, `src/` layout | |
| Lint and format | ruff | |
| Timestamps | UTC with `Z` (`2026-10-07T10:00:00Z`) | |

## What the sources look like

### Riksdagen

| Call | Result |
|---|---|
| `dokumentlista/?doktyp=sfs&utformat=json&sz=100&p=1` | All 11,567 SFS documents (Acts and Ordinances on every subject), 100 per page, 116 pages, newest first. Each entry has `id` (`sfs-2026-1781`), `beteckning`, `titel`, `datum`, `systemdatum` (last change). The next page's address is in `@nasta_sida`. |
| `...&rm=2007&nr=528` | Exactly one hit: `sfs-2007-528`. How a law is found. |
| `...&sfsnr=2007:528` (spec) | Ignored: returns all 11,567. |
| `...&f_sys_d1=2026-10-01` (spec) | Ignored: returns all 11,567. |
| `...&p=101` | HTTP 400: only the first 100 pages (10,000 hits) can be read, so the whole list cannot be paged in one pass. |
| `...&org=Finansdepartementet*` | 2,558 hits: every law whose `organ` starts with "Finansdepartementet". Without the `*` only the exact text matches (726 hits), and units such as `Finansdepartementet S3` are missed. |
| `...&sort=systemdatum&sortorder=desc` | Works: most recently changed first. |
| `...&rm=2017&nr=673` (the spec's AML Ordinance) | No hit, and `dokument/sfs-2017-673.json` returns 404 (C7). |
| `dokument/sfs-2007-528.json` | The document. `subtitel` = `t.o.m. SFS 2026:1066` (latest amendment). Only the issue date is given (`utfardad` 2007-06-14); the in-force date is in the closing text. |

- Document type: the word before "(2007:528)" in `titel` ends in "lag" (`Lag (2007:528) …`, `Försäkringsrörelselag (2010:2043)`) or is `Förordning`.
- `dokument.html` is not nested by section. Chapters and sections are marked by anchors inside one long run of text:

| Markup | Meaning |
|---|---|
| `<h3 name="K8a">8 a kap. Återhämtningsplaner</h3>` | chapter |
| `<a class="paragraf" name="K1P1a"><b>1 a §</b></a>` | section start |
| `<a name="K1P1aS2">` | second paragraph of that section |
| `<br />` then `1.` or `-` | list point |
| `<i>Lag (2017:679)</i>` | amendment note at the end of a section |
| `<h2>`, `<h4>` | part and group headings, not section text |
| `<h3 name="overgang">` | transitional provisions start. Their anchors continue the last section's numbering (`K26P5S28`), so parsing must stop here |

- Sections of SFS 2007:528 appear twice while a change waits to take effect: current wording marked `/Upphör att gälla U:2026-12-05/`, upcoming wording marked `/Träder i kraft I:2026-12-05/`.
- Marker variants found in the 10 priority statutes:

| Variant | Example |
|---|---|
| No date | `/Träder i kraft I:den dag regeringen bestämmer/` (SFS 2013:561 4 kap. 2 §; 5 kap. 11 § has two such upcoming wordings) |
| Partly outside `<i>` | `/Upphör att gälla U:2027-01-11 genom <i>lag (2026:1065)</i>./` (SFS 2004:297 4 kap. 4 §) |
| Two markers on one wording | `/Träder i kraft I:2026-12-05/` then `/Upphör att gälla U:2030-01-10/` (SFS 2007:528 11 kap. 16 §) |
| Section shown twice, no marker | SFS 2004:46 10 kap. 11 § |
| New number | `/Ny beteckning 2 c § U:2026-12-05/`: the section gets a new number on that date (SFS 2007:528 11 kap. 2 b §) |
| Whole chapter | `/Kapitlet träder i kraft I:2026-12-05/` on its own line before the chapter heading (SFS 2007:528 11 a kap.) |

- Some sections have no anchor, only plain text after a blank line: SFS 2010:2043 17 kap. 1 § ("1 § Bolagsverket …", after an empty `<pre>`), SFS 2013:561 1 kap. 9 § and 8 kap. 9 §, SFS 2007:528 11 kap. 2 b § and 2 c § ("2 b § /Ny beteckning 2 c § U:2026-12-05/"). Lines like "1 § om fusionsplan," in a list look similar but are references, not sections.
- Transitional provisions are entries, each starting with a line holding an SFS number (`2007:528`, then one per amendment). SFS 2007:572 has no entry for its own number; SFS 2004:297's own entry says the in-force date is set in another law.
- Group headings can carry the same markers (`/Rubriken träder i kraft I:2026-12-05/`), on their own line: SFS 2007:528 11 kap., SFS 2004:297, SFS 2013:561. They are dropped; the heading itself is not marked.
- Repealed laws stay in the list. The list entry marks them in `sokdata.statusrad`: `<dt>Författningen är upphävd</dt>`, sometimes followed by the repeal date (128 laws, dates 1988 to 2030). 5,899 of 11,567 are marked; `status` and `slutdatum` stay empty. The document marks them in `dokuppgift`: `upphavd` (repeal date) and `upphnr` (repealing act, `SFS 2007:528` for SFS 1991:981). The two agreed in all 18 laws checked on 2026-10-10.
- `systemdatum` of 9,593 laws is 2025-10-17: Riksdagen touched almost the whole list that day. Normal days: 0 to 52 changes over all ministries, 0 to 5 for the Ministry of Finance (late September to 9 October 2026).

### FFFS register

- fi.se did not answer from this computer on 2026-10-07 (connections time out); it did on 2026-10-10. The live register then listed 406 active rows (384 in the June 2026 archive copy). The other facts here and the Phase 1 files in `tests/fixtures/fi_fffs/` come from Internet Archive copies: `https://web.archive.org/web/2026id_/https://www.fi.se/<path>`.
- The search page returns every hit on one page, base regulations (Grundförfattning) and amendments (Ändringsförfattning) together. The spec's query `?grundforfattning=true&active=true` does not separate them, and its "~700" does not match.
- Each row is `ul.fffs.searchresults > li > dl` with the fields Nummer, Rubrik (a link to the item page) and Typ. An amendment's Typ names the regulation it changes: "Ändringsförfattning | Ändring av Grundförfattning 2014:4".
- Amendment text also appears inside the base regulation's consolidated PDF, so search can find the same rule twice.
- Item page (for example `/sv/vara-register/fffs/sok-fffs/2017/201711/`): `h1` holds the identifier ("FFFS 2017:11"), `h2` the title. `div.date-and-category` holds "Gäller från 2017-08-01"; on an amendment page it also holds ", ändring av FFFS 2014:4" with a link to the amended regulation.
- PDF links in `div.link-list`, labelled `FFFS 2017:11`, `FFFS 2017:11 (konsoliderad version)` (only when amended), `Beslutspromemoria FFFS 2017:11`, correction sheets (rättelseblad) and other attachments. On a base regulation, `div.changes` lists each amendment with its item page, PDF and memo.
- Consolidated file names are `fs20172k-2630.pdf` (the suffix is the latest amendment included) or `fs1711k.pdf`, not "k-[date].pdf" as the spec says. The parser picks the link by its label.

### FFFS PDFs

- Page 1 of a base or amendment PDF opens with the series name and the title (14 pt bold), the FFFS number and print date in a right-hand column, and a "beslutade den …" line under the title. The preamble and the text follow on the same page.
- Each page has the FFFS number as a header (less than 50 pt from the top) and the page number as a footer (more than 780 pt from the top). Footnote marks are superscript; footnote text is 10 pt, body text 11 pt.
- The regulation text ends at a line of underscores. After it come the transitional provisions, the signatures (the first in capitals, "ERIK THEDÉEN") and the appendices.
- Allmänna råd: an italic "Allmänna råd" heading, then text indented about 28 pt from the page's left margin.
- Group headings are bold, or italic and starting with a capital letter.
- Consolidated PDFs have no preamble: page 1 holds a notice, the title and dates. Their sections end with notes naming the amending regulations, like "(FFFS 2021:37)".
- Some PDFs turn the dash bullet into the letter "í", and put a space before ")".

### Older FFFS PDFs (before 2006)

Checked on 2026-10-10 on all 37 active regulations from before 2006, fetched live. Most are repeal regulations of one page. None has a memo. None is a scan: every page has a text layer (at least 206 characters).

| Years | Example | Layout |
|---|---|---|
| 1991 to 1992:12 | FFFS 1991:1, 1991:12, 1992:3 | Series name 13.5 pt; title, body and everything else 10 pt. Date line "beslutade", "beslutat" or "utfärdade"; FFFS 1991:16 has none. No § sections. |
| 1992:33 to 1998 | FFFS 1992:33, 1993:17, 1998:22 | A large "FINANSINSPEKTIONEN" letterhead (40 and 22 pt) at the top, series name in capitals 12 pt, title and body 11 pt, address footer in Arial 8 pt, page header "FFFS 1993:17" at 55 pt, text ending at a line of dashes. Chapters as "1 KAP INLEDNING" (11 pt bold, capitals, no period). Sections as "1 §" not bold, or "1 §" bold with its heading on the same line as a separate piece. FFFS 1996:27 misprints its header as "FFFS 1966:27". |
| 1999 to 2005 | FFFS 2000:17, 2001:8, 2005:1 | Same as today's: series name 21 pt, title 14 pt, body 11 pt, footnotes 10 pt. |

- Some repeal titles name neither "föreskrifter" nor "allmänna råd" (FFFS 1991:15 "Upphävande av vissa cirkulärskrivelser …"), or name the Allmänna råd they repeal (FFFS 1995:62, 1996:17, 1998:12).
- In repeal regulations the legal basis is sometimes only in a footnote (FFFS 2000:17: "Föreskrifterna upphävs med stöd av 49 § försäkringsrörelseförordningen (1982:790)"); see P11.

### lagar.se (the spec's reference model)

- Each section shows its citations as links, and below it the sections that cite it ("1 paragraf refererar hit"). Direct references only; no FFFS.
- Its pair SFS 2007:572 5 kap. 1 § → SFS 2007:528 25 kap. 4 § is used in the M3 tests. Its second pair is outdated (SFS 2007:572 now has chapters 1 to 6), so the tests use 4 kap. 1 § → 4 kap. 2 and 3 §§ instead.

## Service flow

Two commands download and parse. Linking and the viewer then work on what is stored.

| Step | `fetch sfs` | `fetch fffs` |
|---|---|---|
| 1. List | `--number`: searches `rm` + `nr` for each number. `--all`, `--since`: pages through the Ministry of Finance list (`org=Finansdepartementet*`), newest change first, keeping laws in force and stored laws; `--since` stops at the first law last changed before that day | every row of the register page, or only the rows for the given numbers |
| 2. Fetch | `dokument/<id>.json` into `data/raw/riksdagen/documents/`, plus its page as `<id>.html`; search results go to `data/raw/riksdagen/search/`, list pages to `data/raw/riksdagen/list/` | item page, regulation PDF, memo PDF into `data/raw/fi_fffs/<id>/` |
| 3. Parse | header fields, sections (both wordings), citations, `is_bemyndigande`, `document_type` | `authorizations` from the preamble, sections, binding vs guidance per paragraph, citations in all sections, `document_type`, `amends`, memo text |
| 4. Save | compare with the stored version ([Version changes](#version-changes-m22)), then print one JSON array, one JSON file per document in `data/json/riksdagen/`, SQLite `data/regtech.db` | same, in `data/json/fi_fffs/` |

5. **Link**, `regtech link`: delete all stored links, match each citation of every stored document to the section it points at, and store the matches; incoming references are read from them.
6. **View**, `regtech serve`: the viewer reads storage and serves the saved downloads.

- Step 1 lists all items; then steps 2 to 4 run for one item at a time, so each item's JSON file and database row appear as soon as it is done, and `saved <id>` is printed on the error output. Every download stays in `data/raw/`. `--offline` swaps in `OfflineDownloader`, which returns the saved file instead of downloading.
- Requests use the User-Agent `LegalPipeline-Parser/1.0` (the spec's example).

## Code structure

Each flow step above is one method or module below.

```
src/regtech/
  cli.py                       commands; picks the implementation for each seam
  pipeline.py                  list, then fetch, parse and save each item
  document_numbers.py          SFS and FFFS number patterns used in several files
  models.py                    our data models (see Data model); Link, DocumentSummary, SearchHit for storage and viewer
  sections.py                  SectionDraft, make_sections(): paragraphs, points, full_text, unique chunk_id
  citations/
    base.py                    CitationExtractor protocol
    regex_extractor.py         citations and is_bemyndigande
  linker.py                    resolve citations into links (M3)
  versions.py                  section changes between versions, and the word diff (M2.2)
  sources/
    base.py                    Source protocol
    riksdagen.py
    fffs.py                    register and item pages, which PDFs, document fields (M2)
    fffs_pdf.py                PDF lines → preamble and section drafts (M2)
  pdf/
    base.py                    PdfReader protocol, PdfLine
    pymupdf_reader.py
  download/
    base.py                    Downloader protocol
    httpx_downloader.py
    offline_downloader.py      --offline: returns saved files, downloads nothing
  storage/
    base.py                    DocumentStore and LinkStore protocols
    sqlite_storage.py          SqliteStorage: implements both
  viewer/
    app.py                     FastAPI pages, the /files route and the /api/v1 change feed
    templates/                 Jinja2 page templates
tests/
  fixtures/<source>/           saved real pages and PDFs, same layout as data/raw/<source>/
data/                          git-ignored: raw/, json/, regtech.db
```

### Seams

```python
class Source(Protocol):
    name: str
    def list_ids(self) -> list[str]: ...
    def fetch(self, item_id: str) -> None: ...
    def parse(self, item_id: str) -> LegalDocument: ...

class PdfReader(Protocol):
    def read_lines(self, pdf_path: Path) -> list[PdfLine]: ...

class Downloader(Protocol):
    def download(self, url: str, dest: Path) -> Path: ...

class CitationExtractor(Protocol):
    def extract(self, text: str, own_document: str, own_chapter: str | None) -> list[Citation]: ...
    def is_bemyndigande(self, text: str) -> bool: ...
```

- `Source` implementations: `RiksdagenSource(numbers, downloader, raw_dir, extractor, since, stored_ids)` (`numbers` is `None` for the Ministry of Finance list), `FffsSource(numbers, downloader, pdf_reader, raw_dir, extractor)` (`numbers` is `None` for the whole register). Same method names, same step order.
- `PdfLine`: page, top and left position, font size, text, bold (the whole line), italic (the whole line), starts_bold (the first word). `PyMuPdfReader` reads `page.get_text("dict")`: italic is span flag bit 1, bold is bit 4. Superscript pieces (footnote marks, bit 0) and pieces under 4 pt are dropped; lines are sorted top to bottom, then left to right.
- `Downloader` implementations: `HttpxDownloader` (User-Agent, IPv4, timeout and pace in the constructor) and `OfflineDownloader` (returns the saved file, fails when it is missing). Every request goes through `download`, so `--offline` covers search results too.
- `DocumentStore` methods: `save_documents`, `get_document`, `list_documents`, `search`. `LinkStore` methods: `save_links`, `links` (one document's outgoing and incoming links). `ChangeStore` methods: `save_changes`, `changes` (one document's section changes, oldest first), `feed` (all events after an id, oldest first), `recent_changes` (newest first, filtered, for the Changes page). `SqliteStorage` implements all three; `linker.link` takes the first two, `pipeline.run` the first and third, the viewer's `create_app` all three.
- Citation extraction is a seam because a language model is a plausible second implementation.

## Data model

Where ours differs from Spec.md's suggestion, and why:

| Field | Ours |
|---|---|
| `updated_at` | `Field(default_factory=...)`, UTC with `Z`. Spec.md's `datetime.utcnow()` default runs once at import and gives every record the same time. |
| Dates | `issue_date` (SFS: utfärdad) and `effective_date` (SFS: in-force date from the transitional provisions, empty when not stated, e.g. "den dag regeringen bestämmer"; FFFS: "Gäller från"). |
| Decision memo | `memo_url` and `memo_text` on the memo's own document. |
| Local copies | `local_source_path` (SFS page), `local_pdf_path`, `local_memo_path`, each paired with its online address and relative to `data/raw/`. No `served_file_url`: the viewer builds it, and only when the file exists. |
| Amendment link | `amends: "FFFS 2017:2"`, so the viewer can list a regulation's amendments. |
| Citation targets | `targets`: a list of `{chapter, section}`, so "8 kap. 23-31 och 34 §§" is one citation with ten targets and every listed section gets its incoming reference; a whole chapter has no section. `target_statute` becomes `target_document`, also set for internal citations. |
| Citation types | adds `eu_regulation` (EU regulations apply directly; not directives) and `external_fffs`. |
| Chapter and section numbers | `chapter: "8 a"`, `section: "2 a"`, without "kap." and "§", the same form as citation targets. `section` is empty for FFFS text with no section number (an unnumbered block). |
| Binding vs guidance | `rule_type` on each paragraph, because one FFFS section often holds both. Mixed documents ("föreskrifter och allmänna råd") are `document_type` `foreskrift`. |
| Paragraphs and points | paragraphs `{text, rule_type, points}`; points `{number, text, items}`: dash and lettered items nested under the numbered point above them, numbers kept because other sections cite "6 kap. 9 § 1". Plain text after a list starts a new paragraph object, so the count can exceed the law's stycken (nothing counts stycken today). |
| Group heading | `heading`. `full_text` holds the section text only: lines joined by a line break, paragraphs by a blank line. |
| FFFS authorization clauses | `authorizations` on the document, and the preamble text in `preamble`. A repeal regulation has no sections, only its `preamble`. |
| Repeal | `repealed_on` and `repealed_by` (`SFS 2007:528`). SFS: from Riksdagen; a law can have the act without a date (SFS 2023:592, "utgår genom SFS 2023:783"), and a date still in the future. FFFS: `repealed_on` is the day the register first lacked it; `repealed_by` stays empty. |
| Incoming references | storage and viewer only. |
| Version changes | `Change` rows in storage only (`level` `section`, or `document` for a whole document added or repealed), not in the JSON files (as incoming references). `amendment_dates` on the document: act → in-force date, from the SFS transitional entries or the FFFS item page's list of amendments. Spec's `SectionDiff` on each section and `diff_html` are not stored: the diff is drawn from the two texts when shown. |
| `chunk_id` | `{source}_{id}_k8a_p2a`; no `_k` part without chapters (as Riksdagen's anchors); unnumbered blocks end `_b1`, `_b2`, … counted through the document. FFFS ids are `fffs-2017-11`. |
| Section shown twice | each wording its own entry. Upcoming wordings have `upcoming: true`, `in_force_from` when dated, and an id suffix `_i20261205` (`_i` alone when undated); the current wording has `in_force_until`. A wording can have both dates. Any id still repeated gets `_2`, `_3` in document order. |

## Parse rules

### Riksdagen (M1)

- `document_type`: `lag` or `forordning` from the title (see the sources section). A title of another type (for example "Tillkännagivande") makes that item fail with a message.
- `id` = the `id` from the search result (`sfs-2007-528`), not the document's own `dok_id`. It must look like `sfs-2007-528`, otherwise that item fails with "download failed: not a Riksdagen document id like sfs-2007-528: '…'". So a downloaded id can never put a file outside `data/`.
- `identifier` = "SFS " + `beteckning`. `latest_amendment` = `subtitel` without "t.o.m. ".
- `repealed_on` = the day in `upphavd`, `repealed_by` = the SFS number in `upphnr`, both from `dokuppgift`.
- `issue_date` = `utfardad` from `dokuppgift`. `effective_date` = the date in "träder i kraft den 1 november 2007" in the transitional entry headed by the law's own number (other entries belong to amendments); empty when that entry is missing or gives no date.
- `source_url` = `data.riksdagen.se/dokument/<id>.html`, built from the id.
- Walk the elements in order, from the end of `div.sfstoc` (table of contents) to `h3[name=overgang]`, using the markup table. `h4` text is the `heading` of the sections under it until the next heading or chapter. A section number in plain text with no anchor ("N §") also starts a section when a capital letter or "/" follows it and it comes before any section of the chapter or after a blank line, even inside an open section. "N § om …" lines in a list are not sections.
- Section shown twice: every marker at the start of a section is read, in any variant listed under the sources, and removed from the text; dates are kept when given. `/Ny beteckning … U:DATE/` sets `in_force_until`.
- A `/Kapitlet …/` line applies only to the chapter heading right after it. `/Kapitlet träder i kraft I:DATE/` makes every section of that chapter upcoming: `in_force_from` = DATE, chunk ids end `_iYYYYMMDD`. `/Kapitlet upphör att gälla U:DATE/` sets `in_force_until` on every section of that chapter. A chapter number shown twice keeps each wording's own marker; not seen in the 9 saved laws, covered by a test. `/Kapitlet …/` and `/Rubriken …/` lines are dropped from section text.
- Words split by a hyphen at a line end are joined by the same rule as FFFS ([FFFS (M2)](#fffs-m2)).
- A line starting with "1." or "2 a." is a numbered point; "-" and "a)" lines are items of the numbered point above them, or points without a number when there is none. Lettered items keep their letter.

### Citations (M1, reused in M2)

| Text | `citation_type` | Target |
|---|---|---|
| "5 §", "2 kap. 3 §" with no statute named | `internal` | Own document. Chapter = the citing section's chapter when not given. |
| "3 § denna lag", "denna förordning", "dessa föreskrifter" | `internal` | Own document |
| "lagen (2007:528) om värdepappersmarknaden", "aktiebolagslagen (2005:551)" | `external_act` | `SFS 2007:528` |
| "förordningen (2007:572)" | `external_ordinance` | `SFS 2007:572` |
| "samma lag", "samma förordning", "samma föreskrifter" | as the statute named last in the same section | |
| "direktiv 2014/65/EU" | `eu_directive` | none (`raw_text` only) |
| "förordning (EU) nr 600/2014", "förordningarna (EU) nr 1095/2010, (EU) 2015/2365" | `eu_regulation` | none; one citation per act |
| "(EU) 2017/1132" | `eu_directive` or `eu_regulation`, from the nearest "direktiv" or "förordning" before it | none |
| "4 kap. 2 § Finansinspektionens föreskrifter (FFFS 2017:2)", also with "allmänna råd" or "föreskrifter och allmänna råd" | `external_fffs` | `FFFS 2017:2`, 4 kap. 2 § |
| "FFFS 2014:1" anywhere else | `external_fffs` | `FFFS 2014:1`, no targets |
| "8 kap. 23–31 och 34 §§" | as named | one citation, ten targets |
| "23 kap. 1 § första stycket, 2 § samt 7 och 14 §§" | as named | the chapter applies to every section listed after it |
| "2 § första stycket 7 c-g", "3 § andra och tredje meningarna", "4 § första stycket och andra stycket 2" | as named | points (a range may end in a letter), sentences ("första meningen") and repeated "och andra stycket …" parts stay in one reference, so a law named after them applies to the whole reference |
| "aktiebolagslagen (2005:551)" with no chapter or section | `external_act` | `SFS 2005:551`, no targets |
| "19 kap. 9 § aktiebolagslagen" (name, no number) | `external_act` | the number given with that name earlier in the same section |
| "3 kap. 2 § lagen om värdepappersrörelse" (no number) | `external_act` | unknown (`target_document` empty) |
| "Lag (2017:679)." (amendment note), "Har upphävts genom lag (2014:985)." | not a citation | |
| "(FFFS 2021:37)", "(FFFS 2019:28, FFFS 2024:4)" right after a full stop (FFFS amendment note) | not a citation; stays in the text | |

- Point numbers written right after "stycket", "meningen" or "§" can run straight into the next section number. Then only the end of that list is read as section numbers: before "§" the last number, before "§§" the part after the last "," or "samt". "12 kap. 14 § andra stycket 1-6, 6 §" gives 14 § and 6 §; "3 kap. 2 § första stycket 4 och 5, 4 a och 4 b §§" gives 2 §, 4 a § and 4 b §.
- Ranges expand plain numbers only: "23–31" gives 23 to 31, but not 23 a.
- "i fråga om lagen (2007:528) …" or "bestämmelser i lagen (2007:528) …:" (a law or FFFS with its number; the colon may come later in the same sentence): later mentions that name no law of their own go to that law, up to the end of that paragraph. Only the first of either phrase in a section is used.
- A list of more than 50 numbers loses its first numbers. The cap (`MAX_LIST_REPEATS` in `src/regtech/citations/regex_extractor.py`) keeps matching fast: without it, time grows with the square of the list length.
- A law named at the end of a list applies to every mention in the list when the mentions are joined only by ",", "och", "eller" or "samt": in "9 kap. 45 § samt 10 kap. 17 och 24 §§ aktiebolagslagen (2005:551)" both go to SFS 2005:551; in "9 kap. 45 § och enligt 10 kap. 17 § aktiebolagslagen (2005:551)" the first stays internal.
- `is_bemyndigande`: the section contains "får … meddela föreskrifter" or "får … meddela ytterligare föreskrifter", not followed by "om verkställighet". Up to 12 words may stand between "får" and "meddela", as in SFS 2007:572 6 kap. 1 §: "Finansinspektionen får i fråga om lagen (2007:528) om värdepappersmarknaden meddela föreskrifter".

### FFFS (M2)

Register and item pages (`sources/fffs.py`; page layout under [FFFS register](#fffs-register)):

- `id` = `fffs-2017-11` from Nummer. An id of another shape fails that item with "download failed: not an FFFS id like fffs-2017-11: '…'".
- `identifier` from `h1`, `title` from `h2`. `effective_date` from "Gäller från". `amends` = the linked regulation in `div.date-and-category`. `latest_amendment` = the newest FFFS number in `div.changes`; empty for amendments. `source_url` = the page's canonical address; one that is not `https://` fails the item.
- PDFs are found by exact link label, outside `div.changes` (those links belong to the amendments): base PDF = label equal to the identifier, consolidated PDF = identifier + " (konsoliderad version)", memo = the first link whose label or address contains "beslutsp" (any case). Links that are not `https://` are ignored. Nothing else is downloaded.
- Sections come from the consolidated PDF when the item page links one, else from the base PDF; `pdf_url` and `local_pdf_path` point at the file used. The preamble always comes from the base PDF, because consolidated PDFs have none.
- `document_type`: the part of the title before " om ", in lower case. Contains "föreskrifter" or starts with "upphävande" → `foreskrift` (a repeal, also of Allmänna råd, is a binding decision); contains "allmänna råd" → `allmanna_rad`; anything else fails the item.
- `authorizations`: the citations in the preamble's "med stöd av …" clause, up to ", och lämnar/beslutar", " att ", " i fråga om " or the end of the sentence. Act, ordinance and FFFS citations are kept.
- `memo_text`: all text of the memo PDF.

PDF text (`sources/fffs_pdf.py`; layout under [FFFS PDFs](#fffs-pdfs) and [Older FFFS PDFs](#older-fffs-pdfs-before-2006)):

- Dropped: on page 1, everything down to the lowest of the title (text of 13.5 pt or larger), the date line ("beslutade", "beslutad", "beslutat" or "utfärdade den …") and the FFFS number line, and the right-hand column; header and footer lines; any line holding only an FFFS number (page headers in 1993 to 1998 PDFs sit at 55 pt, below the header zone); text more than 0.5 pt smaller than the PDF's body size (footnotes). Body size = the font size carrying the most characters in the remaining text: 11 pt today, 10 pt in 1991 to 1992 PDFs.
- Lines at the same height (within 2 pt) on a page are joined into one, so a "1 §" and its heading, or a dash and its list text, read as one line.
- Text stops at a line of 5 or more underscores or dashes (on any page), or at a signature line on the PDF's last page: two or more words in capitals, with no full stop at the end ("ERIK THEDÉEN"). Transitional provisions and appendices are therefore not stored.
- Preamble = the text before the first bold line, line starting with a section number, or "Allmänna råd" heading.
- Chapter: a bold "3 kap. …" line of chapter size (11.5 pt or more), or a bold "1 KAP INLEDNING" line of any size (1993 to 1998). A bold line right after it is added to the chapter title only when it is also chapter size; otherwise it is a group heading.
- Section: a line starting with a bold "4 §". In a PDF with no bold section numbers (1993 to 1998), a plain "4 §" that starts a paragraph. A line that is all bold, "1 § Inledning", is section 1 with the group heading "Inledning".
- Group heading (`heading`): a bold line, or an italic line starting with a capital letter. Italic amendment notes like "(FFFS 2019:28)" are not headings. Heading lines in a row join into one heading.
- Allmänna råd: an italic "Allmänna råd" line starts guidance. The paragraphs after it get `rule_type` `guidance` while their lines are indented (more than 15 pt beyond the page's left margin); an unindented line, a new section, chapter or heading ends it. Documents of type `allmanna_rad` mark every paragraph guidance.
- Text with no section number (in guidance-only documents, or after a heading) becomes an unnumbered block.
- A vertical gap over 18 pt starts a new paragraph; across a page break, a previous line ending in ".", ":" or ";" does. List lines ("1.", "–", "a)") start a new line, then the Riksdagen point rules apply.
- Hyphen at a line end (Riksdagen text too): kept when the word before it is all capitals ("EU-", "IT-"), appears with a hyphen elsewhere in the document ("it-system"), or is a single letter between two hyphens ("fond-i-" + "fond" → "fond-i-fond"); kept with a space when the next word is "och", "eller", "samt", "respektive" or "till", or starts with a capital ("kredit- och"); otherwise the two parts are joined.
- "í" at the start of a line is read as a dash bullet. Spaces before ")" are removed.
- Amendment notes like "(FFFS 2021:37)" stay in the text but are not citations.
- Not handled, no test case yet: an italic sub-heading inside an Allmänna råd block ends the block; a word hyphenated only once in the document, and only at a line end, is joined wrongly; a longer part between two hyphens ("fram-och-" + "tillbaka") loses its last hyphen. A legal basis stated only in a footnote is lost (P11). The rules were checked on the PDFs in `tests/fixtures/fi_fffs/` and the 40 regulations fetched on 2026-10-10, not the whole register.

### Linker (M3)

- `regtech link` deletes all stored links and builds them again from the stored documents: the citations of every section, and FFFS `authorizations` (labelled "FFFS 2017:11 preamble").
- A citation resolves when the target statute is stored and has the cited chapter and section: statute + chapter + section → `chunk_id`. Each target of a citation resolves on its own. A section with two wordings: the citation goes to the wording in force today; a section that exists only as an upcoming wording is linked to that wording. A whole chapter, a whole document, or a section that is not found gives a link with no target section; its pill opens the chapter or the document.
- The missing statutes are listed after linking, most cited first. With the 9 SFS laws stored, the top one is SFS 2005:551 (aktiebolagslagen).
- Chain through bemyndigande sections: when a bemyndigande section of A cites B, every citation that points at that section of A (for example an FFFS preamble citing SFS 2007:572 6 kap. 1 §) also shows on B's cited section, marked "via" A's section. Worked out when a document's links are read, not stored.

### Viewer (M4)

- Spec features: browse by statute or regulation; collapsible chapter and section tree; badge for binding rules vs Allmänna råd (on paragraphs); citation pills that link to the cited section.
- Port 8000 unless `--port` is given; host `0.0.0.0` unless `--host` is given.

| Page | Shows |
|---|---|
| Every page | A sidebar with the Library and Changes links and every stored document, SFS then FFFS (a menu button opens it on narrow screens). A search window opens with Ctrl K (⌘K on a Mac), `/`, or the sidebar's search button: typed words match document numbers and titles at once, and the first 8 section hits follow as you type; "See all results" opens `/search`. A Light / Dark / System switch at the bottom of the sidebar sets the colors; System, the default, follows the computer's setting. The choice is kept in the browser. |
| `/` | A table of the stored documents, SFS then FFFS, each by year and number: number, title, type (Act, Ordinance, Regulation, General guidelines), in force from, latest amendment; amendments say what they amend; a red "Repealed from DATE" or "Not in the register since DATE" badge under the title. Tabs show all, Acts, Ordinances or FFFS; a filter box hides the documents whose number and title do not contain every typed word. |
| `/doc/{id}` | Title, then type, number, dates, "Repealed" (date, and the repealing act as a link when stored) or "Not in the register" (FFFS), "Amends" and "Amended by" links, source links, authorization pills, the preamble. Chapters as collapsible blocks; each section with its heading, upcoming-wording marks, paragraphs and points, and citation pills (a link when the target is stored). FFFS paragraphs get a "Binding rule" or "Allmänna råd · comply or explain" badge. Under each section, "N references here" lists the incoming references, chained ones with "via". References that point at no section are listed under "Referenced by" at the top. An "On this page" chapter list (beside the text on wide screens, marking the chapter being read; folded above the text on narrow ones) with "Expand" / "Collapse" for all chapters. Each section number links to that section, a button copies that link, and the section a link opens is highlighted. A changed section gets a Modified, Added or Repealed badge with its amending act and in-force date, and "Show changes" opens the word diff (removed words struck through in red, added words in green); "Removed sections" at the top lists sections gone from the latest version. |
| `/search?q=` | Up to 50 hits with the matching words highlighted, grouped by document in the order of each document's best hit, with the number of hits. The page shows the whole-word rule as a hint. |
| `/api/search?q=` | The first 8 hits as JSON (link, label, highlighted snippet), for the search window. |
| `/changes` | Recorded changes, newest first, grouped by fetch day: document number and title, the section ("7 kap. 6 § (upcoming wording)", or "Whole document"), the status badge with act and date, a link to the saved copy, "Show changes" with the word diff. Tabs filter by source and status; "Older" and "Newest" page through 50 at a time. |
| `/api/v1/feed?after=&since=&limit=` | Events oldest first after event `after` (default 0), fetched on or after `since`, at most `limit` (default 50, at most 500): `{"events": [...], "next_after": id}`. Fields: [README.md](README.md#change-feed-api). |
| `/api/v1/documents/{id}` | The stored document as JSON (our `LegalDocument`); 404 when not stored. |
| `/files/{path}` | The saved downloads under `data/raw/`: FFFS PDFs and memos, SFS pages. On `/doc/{id}`, "Official page", "PDF" and "Decision memo" open the saved copy when its file exists, with a small "online" link next to it; otherwise they open the online address. |

## Storage

- One SQLite file, `data/regtech.db`. Layout version 4, kept in SQLite's `PRAGMA user_version`. A version 3 database is upgraded in place (its `section_changes` rows move to `changes`); any other version stops every command with a message to delete it and rebuild it with `--offline` (README).
- `documents`: id, source, identifier, title, amends, and the whole document as JSON.
- `citations`: one row per target of each citation whose document is stored: citing document and `chunk_id` (empty for a preamble), its label, whether the citing section is a bemyndigande, the citation's position, its text, and the target document, chapter and `chunk_id` (empty when no section matches). Written only by `regtech link`.
- `changes`: one row per changed section and fetch, and per document added or repealed: `id` (the feed's `event_id`), document, level (`section` or `document`), chapter, section, wording (current or upcoming) and its count among same-numbered wordings, status, old and new text, amending act and date, fetch time. Written by `fetch`; documents are never deleted, so the rows stay. It is the only copy of past texts: `data/raw/` keeps only the latest download, so deleting `data/regtech.db` loses the change history for good. A future layout change must carry this table over, not ask for a rebuild.
- `search_index`: FTS5, one row per section (text and group heading) plus one title row per document.
- Saving a document again replaces its row, its search rows and the links from it, because sections can disappear between versions. Links stay missing until `regtech link` runs again.
- `fetch fffs` without `--limit` and `--number`, online or `--offline`, sets `repealed_on` to today on every stored FFFS document missing from the register listing and not marked yet, in the database and in `data/json/fi_fffs/<id>.json`. Each one prints `no longer listed <id>` on the error output. Nothing is marked when the listing comes back empty (a changed page layout, not a cleared register). Listed items that fail to download or parse stay as they were.

## Milestones

Tests ship with each milestone, on saved real pages and PDFs.

- **M1** (2026-10-07): 9 of the 10 priority statutes parse without errors; SFS 2017:673 does not exist on Riksdagen (C7). Section counts match Riksdagen's anchors plus the plain-text sections: SFS 2007:528 has 567, SFS 2013:561 has 291. With the 9 stored, 87 references to a section of a stored law find no section.
- **M2** (2026-10-07): built and tested on Internet Archive copies of FFFS 2017:11 and 2014:4 (base with consolidated text), 2023:4 (amendment), 2024:22 (Allmänna råd only), 2026:1 (repeal). On 2026-10-10 the 37 regulations from before 2006 were fetched live and their layouts handled. A full `fetch fffs` against the live site, and "every one parses", are still unchecked.
- **M3** (2026-10-07): tested on SFS 2007:572 5 kap. 1 § → SFS 2007:528 25 kap. 4 §, the internal pair 4 kap. 1 § → 4 kap. 2 and 3 §§, and an FFFS preamble reaching SFS 2007:528 through the bemyndigande chain.
- **M4** (2026-10-07): 96% coverage over the whole package.

## Phase 2 (Specv2.md)

### Facts that differ from Specv2.md

- **fi.se was not used in Phase 1.** Specv2.md says the Phase 1 viewer "linked out to fi.se". Phase 1 was built and tested only on Internet Archive copies, because fi.se did not answer from this computer. The first live fetch was on 2026-10-10 (37 older regulations); a full `fetch fffs` has still not run against it.
- The Phase 1 counts in Specv2.md (414 regulations, over 16,000 links) are not from our runs; we only downloaded a few documents.
- `f_sys_d1` is ignored by Riksdagen; M2.3's daily update reads the list sorted by last change instead.
- Specv2.md calls the FFFS PDFs from before 2005 scans without a text layer. No active one is ([Older FFFS PDFs](#older-fffs-pdfs-before-2006)).

### M2.1: Local files (built 2026-10-10)

- `fetch sfs` saves each law's page next to its JSON file. The viewer serves `data/raw/` at `/files/` and opens saved copies first.
- PR #1 (`fix/fffs-blank-docs`, from the client) was merged on GitHub on 2026-10-08. Kept: its `serve --host` default of `0.0.0.0`, and its preamble display on every document. Its fixed 9.5 pt text limit let 10 pt footnotes into the section text; replaced on 2026-10-10 by the body-size rule under [FFFS (M2)](#fffs-m2), together with fixes for the 1991 to 1998 layouts.

### Version changes (M2.2)

Specv2.md asks for each section of a statute to be marked UNCHANGED, MODIFIED, ADDED or REPEALED against the previous version, with an inline text diff and the amending act and its date. The diff text comes from Python's `difflib`. Decided: [Version changes](#version-changes-m22).

- Built 2026-10-10. Rebuilt from the saved downloads, the 9 SFS laws give 60 changes, all upcoming wordings (50 MODIFIED, 10 ADDED); the 10 with no date are SFS 2013:561 wordings "den dag regeringen bestämmer". Changes between two fetches are tested on made-up documents only: no second live fetch has run yet.

### M2.3: All Ministry of Finance laws in force (built 2026-10-10)

- `fetch sfs --all` and `--since YYYY-MM-DD`. Which laws: [Decisions](#scope). How the list is read: [Service flow](#service-flow).
- Live on 2026-10-10: `--since 2026-10-02` fetched 7 laws in 17.6 s. A normal day has 0 to 5 changed laws, so a daily run stays under 30 s. On a day when Riksdagen touches the whole list (2025-10-17), `--since` fetches almost every Ministry of Finance law.
- Live `--all` on 2026-10-10: 1,153 of 1,223 laws saved, 70 failed. 56 have a title that is neither "lag" nor "förordning": 38 Kungörelse (older ordinances), 14 Tillkännagivande (notices), plus "Kungl. Maj:ts Börsordning", "Förordning  (2020:332)" (two spaces) and "Förordning … (2024:958)" (number at the end). 11 have ids that are not `sfs-YYYY-N` (`sfs-n2025-21`, `sfs-1885-56 s.1`). 3 have no text block (SFS 2020:44, 1973:1016, 1976:929). 266 saved laws have no sections, among them short repeal ordinances and yearly amount ordinances without "§".
- `--since` and `--all` only see Ministry of Finance laws: a law of another ministry fetched with `--number` is updated only by `--number`.

### M2.4: Change feed (built 2026-10-10)

- Replaces Specv2.md's OCR milestone. Decided: [Change feed](#change-feed-m24).
- On the stored data the version 3 database was upgraded in place: its 60 changes became events 1 to 60. Document events start with the next fetch.
- Deleting `data/regtech.db` restarts event ids at 1, so every platform must start over from `after=0`; a rebuild with `--offline` also records every document as ADDED again.

### Later

- Rebuild past versions of a statute from its amending acts, so M2.2 can show changes made before the first fetch.

## Open questions

Each gives the problem, the options with what they produce, my recommendation, and the current choice. When one is answered, its decision moves to [Decisions](#decisions) and the question is removed.

### C7. The AML Ordinance's number (ask the client)

Blocks M1's last priority statute. Current choice: **Open**.

The spec lists SFS 2017:673 as the AML Ordinance (Förordning om åtgärder mot penningtvätt). Riksdagen has no document with that number: the search finds nothing and `dokument/sfs-2017-673.json` returns 404. Which number is meant?

Until answered: the other 9 are fetched; `regtech fetch sfs --number 2017:673` stops with "found 0 documents".

### Q41. Scope additions

Blocks nothing. Current choice: **Open**. Pick any.

1. **Tests against the live sites.** Find out when Riksdagen or fi.se change their pages.
2. **CI.** Run the tests automatically on every push to the repository.
3. **Parallel downloads.** Faster crawls; heavier load on fi.se.

No recommendation. (The former option "updates since the last run" is now M2.3.)

### P11. Legal basis stated only in a footnote

Blocks nothing. Current choice: **Open**, later work.

Footnotes are dropped from the text, so a legal basis stated only in a footnote is lost. Example: FFFS 2000:17, "Föreskrifterna upphävs med stöd av 49 § försäkringsrörelseförordningen (1982:790)".

Planned fix: read footnotes on their own and take "med stöd av" citations from them into `authorizations`.
