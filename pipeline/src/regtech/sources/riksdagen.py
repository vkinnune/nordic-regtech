import json
import re
from datetime import date
from html import escape
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag

from regtech.citations.base import CitationExtractor
from regtech.document_numbers import NUMBER_RE
from regtech.download.base import Downloader
from regtech.models import LegalDocument
from regtech.sections import SectionDraft, hyphenated_prefixes, join_wrapped_line, make_sections

SEARCH_URL = "https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&rm={year}&nr={nr}"
# The `*` also matches the ministry's units ("Finansdepartementet FMA V"); Riksdagen ignores
# f_sys_d1, so --since reads the newest changes first and stops at the given day.
LIST_URL = (
    "https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&org={ministry}*"
    "&sort=systemdatum&sortorder=desc&sz={page_size}&p={page}"
)
MINISTRY = "Finansdepartementet"
LIST_PAGE_SIZE = 100
DOCUMENT_URL = "https://data.riksdagen.se/dokument/{id}.json"
SOURCE_URL = "https://data.riksdagen.se/dokument/{id}.html"
LOCAL_PAGE = '<!doctype html>\n<meta charset="utf-8">\n<title>{title}</title>\n{html}\n'

ITEM_ID_RE = re.compile(r"sfs-\d{4}-\d+")
TAG_RE = re.compile(r"<[^>]+>")
REPEAL_MARK_RE = re.compile(r"upphävd\s*(\d{4}-\d{2}-\d{2})?")
SFS_NUMBER_RE = re.compile(r"SFS \d{4}:\d+")
TYPE_WORD_RE = re.compile(r"(\w+) \(\d{4}:\d+\)")
CHAPTER_RE = re.compile(r"^(\d+(?: [a-z])?) kap\.\s*(.*)$", re.S)
SECTION_RE = re.compile(r"^(\d+(?: [a-z])?) §$")
# A capital or a marker must follow: "1 § om fusionsplan," lines in a list are references.
UNANCHORED_SECTION_RE = re.compile(r"^\s*(\d+(?: [a-z])?) §\s+(?=[A-ZÅÄÖ/])")
BLANK_LINE_START_RE = re.compile(r"^[ \t\xa0]*\r?\n[ \t\xa0]*\r?\n")
PARAGRAPH_ANCHOR_RE = re.compile(r"P\d+[a-z]?S\d+$")
IN_FORCE_MARKER_RE = re.compile(
    r"\s*/(?:Upphör att gälla|Träder i kraft|Ny beteckning [^/]*?) ([UI]):([^/]*)/\s*"
)
CHAPTER_OR_HEADING_MARKER_RE = re.compile(r"^\s*/(Kapitlet|Rubriken) [^/]*?([UI]):([^/]*)/\s*$")
IN_FORCE_MARKER_DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
WRAPPED_HYPHEN_RE = re.compile(r"(-?\w+-)[ \t]*\r?\n[ \t\xa0]*(\w+)")
IN_FORCE_DATE_RE = re.compile(r"träder i kraft den (\d{1,2}) (\w+) (\d{4})")
MONTHS = [
    "januari", "februari", "mars", "april", "maj", "juni",
    "juli", "augusti", "september", "oktober", "november", "december",
]  # fmt: skip
TRANSITIONAL_ANCHOR = "overgang"


class RiksdagenSource:
    name = "riksdagen"

    def __init__(
        self,
        numbers: list[str] | None,
        downloader: Downloader,
        raw_dir: Path,
        extractor: CitationExtractor,
        since: date | None = None,
        stored_ids: set[str] = frozenset(),
    ):
        self._numbers = numbers
        self._downloader = downloader
        self._raw_dir = raw_dir
        self._extractor = extractor
        self._since = since
        self._stored_ids = stored_ids

    def list_ids(self) -> list[str]:
        if self._numbers is None:
            return self._ministry_ids()
        return [self._search(number) for number in self._numbers]

    def fetch(self, item_id: str) -> None:
        if not ITEM_ID_RE.fullmatch(item_id):
            raise ValueError(f"not a Riksdagen document id like sfs-2007-528: {item_id!r}")

        self._downloader.download(DOCUMENT_URL.format(id=item_id), self._raw_path(item_id))
        fields = self._status(item_id)["dokument"]
        page = LOCAL_PAGE.format(title=escape(fields["titel"]), html=fields["html"])
        self._page_path(item_id).write_text(page, encoding="utf-8")

    def parse(self, item_id: str) -> LegalDocument:
        status = self._status(item_id)
        fields = status["dokument"]
        facts = {fact["kod"]: fact["text"] for fact in status["dokuppgift"]["uppgift"]}
        identifier = f"SFS {fields['beteckning']}"
        soup = BeautifulSoup(_join_wrapped_words(fields["html"]), "html.parser")
        id_prefix = f"{self.name}_{item_id}"
        drafts = _section_drafts(_content(soup))
        in_force_dates = _in_force_dates(soup)
        repealed_by = SFS_NUMBER_RE.search(facts.get("upphnr", ""))

        return LegalDocument(
            id=item_id,
            source=self.name,
            document_type=_document_type(fields["titel"]),
            identifier=identifier,
            title=fields["titel"],
            issue_date=facts.get("utfardad"),
            effective_date=in_force_dates.get(identifier),
            latest_amendment=fields["subtitel"].removeprefix("t.o.m. ") or None,
            repealed_on=facts["upphavd"][:10] if "upphavd" in facts else None,
            repealed_by=repealed_by[0] if repealed_by else None,
            source_url=SOURCE_URL.format(id=item_id),
            local_source_path=self._page_path(item_id).relative_to(self._raw_dir.parent).as_posix(),
            amendment_dates=in_force_dates,
            sections=make_sections(drafts, id_prefix, identifier, self._extractor),
        )

    def _search(self, number: str) -> str:
        year, nr = number.split(":")
        url = SEARCH_URL.format(year=year, nr=nr)
        result_path = self._downloader.download(url, self._raw_dir / "search" / f"{year}-{nr}.json")

        hits = json.loads(result_path.read_bytes())["dokumentlista"].get("dokument") or []
        if len(hits) != 1:
            raise LookupError(f"SFS {number}: Riksdagen search found {len(hits)} documents, not 1")
        return hits[0]["id"]

    def _ministry_ids(self) -> list[str]:
        ids: list[str] = []
        page = 1
        while True:
            url = LIST_URL.format(ministry=MINISTRY, page_size=LIST_PAGE_SIZE, page=page)
            list_path = self._downloader.download(url, self._raw_dir / "list" / f"p{page}.json")
            listing = json.loads(list_path.read_bytes())["dokumentlista"]

            entries = listing.get("dokument") or []
            changed = [entry for entry in entries if self._changed_since(entry)]
            ids += [
                entry["id"]
                for entry in changed
                if _in_force(entry, date.today()) or entry["id"] in self._stored_ids
            ]

            if page >= int(listing["@sidor"]) or len(changed) < len(entries):
                return ids
            page += 1

    def _changed_since(self, entry: dict) -> bool:
        return self._since is None or date.fromisoformat(entry["systemdatum"][:10]) >= self._since

    def _status(self, item_id: str) -> dict:
        return json.loads(self._raw_path(item_id).read_bytes())["dokumentstatus"]

    def _raw_path(self, item_id: str) -> Path:
        return self._raw_dir / "documents" / f"{item_id}.json"

    def _page_path(self, item_id: str) -> Path:
        return self._raw_dir / "documents" / f"{item_id}.html"


def _in_force(entry: dict, today: date) -> bool:
    status = TAG_RE.sub(" ", entry["sokdata"]["statusrad"] or "")
    repeal = REPEAL_MARK_RE.search(status)
    return repeal is None or (repeal[1] is not None and date.fromisoformat(repeal[1]) > today)


def _join_wrapped_words(text: str) -> str:
    prefixes = hyphenated_prefixes(text)
    return WRAPPED_HYPHEN_RE.sub(lambda match: join_wrapped_line(*match.groups(), prefixes), text)


def _document_type(title: str) -> str:
    match = TYPE_WORD_RE.search(title)
    word = match[1].lower() if match else ""
    if word.endswith("lag"):
        return "lag"
    if word.endswith("förordning"):
        return "forordning"
    raise ValueError(f"neither a lag nor a förordning: {title}")


def _content(soup: BeautifulSoup) -> Tag:
    for div in soup.find_all("div"):
        if "sfstoc" not in (div.get("class") or []):
            return div
    raise ValueError("no text block found in the document html")


def _section_drafts(content: Tag) -> list[SectionDraft]:
    drafts: list[SectionDraft] = []
    current: SectionDraft | None = None
    chapter = chapter_title = heading = None
    next_chapter_marker = chapter_marker = None

    for node in content.children:
        if isinstance(node, NavigableString):
            may_start_section = current is None or BLANK_LINE_START_RE.match(node)
            unanchored = UNANCHORED_SECTION_RE.match(node) if may_start_section else None
            if unanchored:
                current = _new_draft(chapter, chapter_title, heading, unanchored[1], chapter_marker)
                drafts.append(current)
                current.add_text(node[unanchored.end() :])
            elif current:
                current.add_text(node)
            continue
        if not isinstance(node, Tag):
            continue

        if node.name == "h3" and node.get("name") == TRANSITIONAL_ANCHOR:
            break
        if marker := CHAPTER_OR_HEADING_MARKER_RE.match(node.get_text()):
            if marker[1] == "Kapitlet":
                next_chapter_marker = marker
        elif node.name in ("h2", "h3", "h4"):
            current = None
            text = " ".join(node.get_text().split())
            heading = text if node.name == "h4" else None
            if node.name == "h3":
                chapter_match = CHAPTER_RE.match(text)
                chapter, chapter_title = chapter_match.groups() if chapter_match else (None, text)
                chapter_marker, next_chapter_marker = next_chapter_marker, None
        elif node.name == "a" and "paragraf" in (node.get("class") or []):
            section_match = SECTION_RE.match(" ".join(node.get_text().split()))
            if section_match is None:
                raise ValueError(f"unreadable section number: {node}")
            current = _new_draft(chapter, chapter_title, heading, section_match[1], chapter_marker)
            drafts.append(current)
        elif current is None:
            continue
        elif node.name == "p":
            anchor = node.find("a", attrs={"name": PARAGRAPH_ANCHOR_RE})
            if anchor:
                current.new_paragraph()
        elif node.name == "br":
            current.new_line()
        else:
            current.add_text(node.get_text())

    for draft in drafts:
        _take_in_force_markers(draft)
    return drafts


def _new_draft(
    chapter: str | None,
    chapter_title: str | None,
    heading: str | None,
    section: str,
    chapter_marker: re.Match[str] | None,
) -> SectionDraft:
    draft = SectionDraft(chapter, chapter_title, heading, section)
    if chapter_marker:
        _apply_in_force_marker(draft, chapter_marker[2], chapter_marker[3])
    return draft


def _take_in_force_markers(draft: SectionDraft) -> None:
    for lines in draft.lines_per_paragraph:
        for i, line in enumerate(lines):
            while marker := IN_FORCE_MARKER_RE.match(line):
                line = line[marker.end() :]
                _apply_in_force_marker(draft, marker[1], marker[2])
            lines[i] = line

            if line.strip():
                return


def _apply_in_force_marker(draft: SectionDraft, kind: str, when: str) -> None:
    day = IN_FORCE_MARKER_DATE_RE.search(when)
    marker_date = date.fromisoformat(day[0]) if day else None
    if kind == "U":
        draft.in_force_until = marker_date
    else:
        draft.upcoming = True
        draft.in_force_from = marker_date


def _in_force_dates(soup: BeautifulSoup) -> dict[str, date]:
    transitional = soup.find("h3", attrs={"name": TRANSITIONAL_ANCHOR})
    if transitional is None:
        return {}

    entries: dict[str, list[str]] = {}
    lines: list[str] = []
    for text in transitional.find_all_next(string=True):
        if NUMBER_RE.match(text.strip()):
            lines = entries.setdefault(text.strip(), [])
        else:
            lines.append(text)

    dates = {}
    for number, entry_lines in entries.items():
        match = IN_FORCE_DATE_RE.search(" ".join(" ".join(entry_lines).split()))
        if match and match[2] in MONTHS:
            dates[f"SFS {number}"] = date(int(match[3]), MONTHS.index(match[2]) + 1, int(match[1]))
    return dates
