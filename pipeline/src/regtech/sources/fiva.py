"""Fetch Finnish FIN-FSA regulations and guidelines from its official catalogue."""

import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from regtech.citations.base import CitationExtractor
from regtech.download.base import Downloader
from regtech.models import LegalDocument
from regtech.pdf.base import PdfReader
from regtech.sections import SectionDraft, make_sections

SITE_URL = "https://www.finanssivalvonta.fi"
CATALOGUE_URL = f"{SITE_URL}/saantely/maarays-ja-ohjekokoelma/"
CATALOGUE_FILE = "catalogue.html"
ITEM_FILE = "item.html"
REGULATION_FILE = "regulation.pdf"
FIVA_NUMBER_RE = re.compile(r"^(\d{1,2})/(\d{4})$")
PDF_NUMBER_RE = re.compile(r"Määräykset ja ohjeet\s+(\d{1,2})/(\d{4})", re.IGNORECASE)
HEADING_RE = re.compile(r"^(\d+(?:\.\d+){0,3})\s+(?!§)(.{2,})$")
HEADING_NUMBER_RE = re.compile(r"^\d+(?:\.\d+){0,3}$")
FI_DATE_RE = re.compile(r"^(\d{1,2})\.(\d{1,2})\.(\d{4})$")


@dataclass(frozen=True)
class _Item:
    item_id: str
    number: str
    title: str
    page_url: str
    pdf_url: str


class FivaSource:
    """Crawls the FIN-FSA catalogue's official PDF attachments (Finnish corpus)."""

    name = "fiva"

    def __init__(
        self,
        numbers: list[str] | None,
        downloader: Downloader,
        pdf_reader: PdfReader,
        raw_dir: Path,
        extractor: CitationExtractor,
    ):
        self._numbers = numbers
        self._downloader = downloader
        self._pdf_reader = pdf_reader
        self._raw_dir = raw_dir
        self._extractor = extractor
        self._items: dict[str, _Item] = {}

    def list_ids(self) -> list[str]:
        catalogue = self._downloader.download(CATALOGUE_URL, self._raw_dir / CATALOGUE_FILE)
        soup = BeautifulSoup(catalogue.read_bytes(), "html.parser")
        for attachment in soup.select("a.regulation-attachment[href]"):
            pdf_url = urljoin(SITE_URL, attachment["href"])
            if "/globalassets/fi/saantely/maarayskokoelma/" not in pdf_url:
                continue
            match = PDF_NUMBER_RE.search(attachment.get_text(" ", strip=True))
            if not match:
                continue
            number = f"{int(match[1])}/{match[2]}"
            item = attachment.find_parent(class_="regulation-item")
            if item is None:
                continue
            page = item.find("a", href=True)
            if page is None:
                continue
            item_id = f"fiva-{match[2]}-{int(match[1])}"
            self._items.setdefault(
                item_id,
                _Item(
                    item_id,
                    number,
                    " ".join(page.get_text(" ", strip=True).split()),
                    urljoin(SITE_URL, page["href"]),
                    pdf_url,
                ),
            )

        if self._numbers is None:
            return list(self._items)
        wanted = []
        for number in self._numbers:
            if not FIVA_NUMBER_RE.fullmatch(number):
                raise ValueError(f"not a FIVA number like 2/2024: {number!r}")
            item_id = f"fiva-{number.split('/')[1]}-{int(number.split('/')[0])}"
            if item_id not in self._items:
                raise LookupError(f"FIVA Määräykset ja ohjeet {number}: not in the catalogue")
            wanted.append(item_id)
        return wanted

    def fetch(self, item_id: str) -> None:
        item = self._items[item_id]
        item_dir = self._raw_dir / item_id
        self._downloader.download(item.page_url, item_dir / ITEM_FILE)
        self._downloader.download(item.pdf_url, item_dir / REGULATION_FILE)

    def parse(self, item_id: str) -> LegalDocument:
        item = self._items[item_id]
        item_dir = self._raw_dir / item_id
        page_path = item_dir / ITEM_FILE
        page_soup = BeautifulSoup(page_path.read_bytes(), "html.parser")
        lines = self._pdf_reader.read_lines(item_dir / REGULATION_FILE)
        all_text = "\n".join(line.text for line in lines)
        preamble, drafts = _parse_structure(lines)
        issue_date = _date_after(all_text, "Antopäivä")
        effective_date = _date_after(all_text, "Voimaantulopäivä") or _date_after(
            all_text, "Voimassa"
        )
        canonical = page_soup.find("link", rel="canonical")
        source_url = urljoin(SITE_URL, canonical["href"]) if canonical else item.page_url
        return LegalDocument(
            id=item.item_id,
            source=self.name,
            document_type="fiva_regulation",
            identifier=f"Määräykset ja ohjeet {item.number}",
            title=item.title,
            issue_date=issue_date,
            effective_date=effective_date,
            source_url=source_url,
            pdf_url=item.pdf_url,
            local_source_path=f"fiva/{item.item_id}/{ITEM_FILE}",
            local_pdf_path=f"fiva/{item.item_id}/{REGULATION_FILE}",
            preamble=preamble or None,
            sections=make_sections(
                drafts, f"fiva_{item.item_id}", f"MOK {item.number}", self._extractor
            ),
        )


def _parse_structure(lines) -> tuple[str, list[SectionDraft]]:
    """Extract numbered Finnish headings and their text from a MOK PDF."""
    by_page: dict[int, list[str]] = {}
    for line in lines:
        by_page.setdefault(line.page, []).append(" ".join(line.text.split()))

    # The catalogue/contents pages repeat numbered headings; the body starts on
    # the page after the page labelled Sisällysluettelo.
    body_pages = []
    in_body = False
    for page, page_lines in by_page.items():
        if in_body:
            body_pages.extend((page, value) for value in page_lines)
        elif any("Sisällysluettelo" in value for value in page_lines):
            in_body = True
    if not in_body:
        body_pages = [(page, value) for page, values in by_page.items() for value in values]

    drafts: list[SectionDraft] = []
    current: SectionDraft | None = None
    preamble_lines: list[str] = []
    pending_heading: tuple[int, str] | None = None
    chapter_titles: dict[str, str] = {}
    for page, line in body_pages:
        if (
            not line
            or "Määräykset ja ohjeet" in line
            or FI_DATE_RE.fullmatch(line)
            or re.match(r"^\d{1,2}\.\d{1,2}\.\d{4}(?:\s|$)", line)
            or re.fullmatch(r"\d+\s*\(\s*\d+\s*\)", line)
            or re.fullmatch(r"(?:antopäivä|voimassa|voimaantulopäivä)\s*:?", line, re.IGNORECASE)
        ):
            continue
        match = HEADING_RE.match(line)
        if match:
            number, title = match.groups()
            if "." not in number:
                chapter_titles[number] = title
            current = _start_draft(drafts, number, title, chapter_titles)
            pending_heading = None
            continue
        if HEADING_NUMBER_RE.fullmatch(line):
            pending_heading = (page, line)
            continue
        if (
            pending_heading
            and pending_heading[0] == page
            and len(line) < 120
            and any(c.isalpha() for c in line)
        ):
            number = pending_heading[1]
            if "." not in number:
                chapter_titles[number] = line
            current = _start_draft(drafts, number, line, chapter_titles)
            pending_heading = None
            continue
        pending_heading = None
        if current is None:
            preamble_lines.append(line)
        else:
            if current.lines_per_paragraph == [[""]]:
                current.lines_per_paragraph = [[line]]
            else:
                current.add_text(" " + line)

    preamble = " ".join(" ".join(preamble_lines).split())
    drafts = [
        draft
        for draft in drafts
        if any(line.strip() for para in draft.lines_per_paragraph for line in para)
    ]
    return preamble, drafts


def _start_draft(
    drafts: list[SectionDraft], number: str, title: str, chapter_titles: dict[str, str]
) -> SectionDraft:
    parts = number.split(".")
    chapter = parts[0]
    draft = SectionDraft(chapter, chapter_titles.get(chapter), title, number)
    drafts.append(draft)
    return draft


def _date_after(text: str, label: str) -> date | None:
    match = re.search(
        rf"{re.escape(label)}\s*:?\s*\n\s*(\d{{1,2}}\.\d{{1,2}}\.\d{{4}})",
        text,
        re.IGNORECASE,
    )
    if not match:
        return None
    day = FI_DATE_RE.fullmatch(match[1])
    return date(int(day[3]), int(day[2]), int(day[1])) if day else None
