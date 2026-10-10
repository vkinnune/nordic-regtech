import re
from datetime import date
from pathlib import Path
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag

from regtech.citations.base import CitationExtractor
from regtech.document_numbers import FFFS_NUMBER_RE, number_order
from regtech.download.base import Downloader
from regtech.models import Citation, LegalDocument
from regtech.pdf.base import PdfLine, PdfReader
from regtech.sections import make_sections
from regtech.sources.fffs_pdf import parse_regulation

SITE_URL = "https://www.fi.se"
SEARCH_URL = f"{SITE_URL}/sv/vara-register/fffs/sok-fffs/"
SEARCH_FILE = "search.html"
ITEM_FILE = "item.html"
REGULATION_FILE = "regulation.pdf"
CONSOLIDATED_FILE = "consolidated.pdf"
MEMO_FILE = "memo.pdf"

CONSOLIDATED_LABEL_SUFFIX = " (konsoliderad version)"
MEMO_MARK = "beslutsp"
REPEAL_TITLE_START = "upphävande"
ITEM_ID_RE = re.compile(r"fffs-\d{4}-\d+")
ISO_DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
EFFECTIVE_DATE_RE = re.compile(r"Gäller från (\d{4}-\d{2}-\d{2})")
AUTHORIZATION_RE = re.compile(
    r"med stöd av (.+?)(?:, och (?:lämnar|beslutar)| att | i fråga om |\.(?=\s+[A-ZÅÄÖ]|$))"
)
EXTERNAL_TYPES = {"external_act", "external_ordinance", "external_fffs"}


class FffsSource:
    name = "fi_fffs"

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
        self._item_urls: dict[str, str] = {}

    def list_ids(self) -> list[str]:
        search_path = self._downloader.download(SEARCH_URL, self._raw_dir / SEARCH_FILE)

        for row in _soup(search_path).select("ul.fffs.searchresults > li > dl"):
            labels = [dt.get_text(strip=True) for dt in row.find_all("dt")]
            fields = dict(zip(labels, row.find_all("dd"), strict=True))
            item_id = _item_id(fields["Nummer"].get_text(strip=True))
            self._item_urls[item_id] = urljoin(SITE_URL, fields["Rubrik"].a["href"])

        if self._numbers is None:
            return list(self._item_urls)
        return [self._search(number) for number in self._numbers]

    def fetch(self, item_id: str) -> None:
        if not ITEM_ID_RE.fullmatch(item_id):
            raise ValueError(f"not an FFFS id like fffs-2017-11: {item_id!r}")

        item_dir = self._raw_dir / item_id
        item_path = self._downloader.download(self._item_urls[item_id], item_dir / ITEM_FILE)

        for file_name, url in _pdf_links(_soup(item_path)).items():
            self._downloader.download(url, item_dir / file_name)

    def parse(self, item_id: str) -> LegalDocument:
        item_dir = self._raw_dir / item_id
        soup = _soup(item_dir / ITEM_FILE)
        identifier = _text(soup.h1)
        title = _text(soup.h2)
        document_type = _document_type(title)
        links = _pdf_links(soup)
        all_guidance = document_type == "allmanna_rad"

        preamble, drafts = parse_regulation(self._read(item_dir / REGULATION_FILE), all_guidance)
        text_file = REGULATION_FILE
        if CONSOLIDATED_FILE in links:
            text_file = CONSOLIDATED_FILE
            _, drafts = parse_regulation(self._read(item_dir / CONSOLIDATED_FILE), all_guidance)

        memo_text = None
        if MEMO_FILE in links:
            memo_text = "\n".join(line.text for line in self._read(item_dir / MEMO_FILE))

        amended = soup.select_one("div.date-and-category span a")
        return LegalDocument(
            id=item_id,
            source=self.name,
            document_type=document_type,
            identifier=identifier,
            title=title,
            effective_date=_effective_date(soup),
            latest_amendment=_latest_amendment(soup),
            amends=_text(amended) if amended else None,
            source_url=_https_url(soup.find("link", rel="canonical")["href"]),
            pdf_url=links[text_file],
            memo_url=links.get(MEMO_FILE),
            local_pdf_path=self._local_path(item_dir / text_file),
            local_memo_path=self._local_path(item_dir / MEMO_FILE) if MEMO_FILE in links else None,
            memo_text=memo_text,
            preamble=preamble or None,
            authorizations=self._authorizations(preamble, identifier),
            amendment_dates=_amendment_dates(soup),
            sections=make_sections(drafts, f"{self.name}_{item_id}", identifier, self._extractor),
        )

    def _search(self, number: str) -> str:
        item_id = _item_id(number)
        if item_id not in self._item_urls:
            raise LookupError(f"FFFS {number}: not in the register of active regulations")
        return item_id

    def _local_path(self, path: Path) -> str:
        return path.relative_to(self._raw_dir.parent).as_posix()

    def _read(self, pdf_path: Path) -> list[PdfLine]:
        return self._pdf_reader.read_lines(pdf_path)

    def _authorizations(self, preamble: str, identifier: str) -> list[Citation]:
        clause = AUTHORIZATION_RE.search(preamble)
        if clause is None:
            return []

        citations = self._extractor.extract(clause[1], identifier, None)
        return [citation for citation in citations if citation.citation_type in EXTERNAL_TYPES]


def _item_id(number: str) -> str:
    return "fffs-" + number.replace(":", "-")


def _soup(html_path: Path) -> BeautifulSoup:
    return BeautifulSoup(html_path.read_bytes(), "html.parser")


def _text(tag: Tag) -> str:
    return " ".join(tag.get_text().split())


def _pdf_links(soup: BeautifulSoup) -> dict[str, str]:
    identifier = _text(soup.h1)
    links: dict[str, str] = {}
    for link in soup.select("div.link-list a[href]"):
        url = _https_url(link["href"])
        if url is None or link.find_parent("div", class_="changes"):
            continue

        label = _text(link)
        if label == identifier:
            links.setdefault(REGULATION_FILE, url)
        elif label == identifier + CONSOLIDATED_LABEL_SUFFIX:
            links.setdefault(CONSOLIDATED_FILE, url)
        elif MEMO_MARK in f"{label} {link['href']}".lower():
            links.setdefault(MEMO_FILE, url)
    return links


def _https_url(href: str) -> str | None:
    url = urljoin(SITE_URL, href)
    return url if url.startswith("https://") else None


def _document_type(title: str) -> str:
    kind = title.partition(" om ")[0].lower()
    if "föreskrifter" in kind or kind.startswith(REPEAL_TITLE_START):
        return "foreskrift"
    if "allmänna råd" in kind:
        return "allmanna_rad"
    raise ValueError(f"neither föreskrifter nor allmänna råd: {title}")


def _effective_date(soup: BeautifulSoup) -> date | None:
    match = EFFECTIVE_DATE_RE.search(soup.select_one("div.date-and-category").get_text())
    return date.fromisoformat(match[1]) if match else None


def _amendment_dates(soup: BeautifulSoup) -> dict[str, date]:
    dates = {}
    for row in soup.select("div.changes li > dl"):
        fields = {_text(dt): _text(dt.find_next_sibling("dd")) for dt in row.find_all("dt")}
        if ISO_DATE_RE.fullmatch(fields.get("Datum", "")):
            dates[fields["Nummer"]] = date.fromisoformat(fields["Datum"])
    return dates


def _latest_amendment(soup: BeautifulSoup) -> str | None:
    changes = soup.select_one("div.changes")
    numbers = FFFS_NUMBER_RE.findall(changes.get_text()) if changes else []
    if not numbers:
        return None

    return "FFFS " + max(numbers, key=number_order)
