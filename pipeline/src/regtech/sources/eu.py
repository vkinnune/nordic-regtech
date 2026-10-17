"""Fetch EU regulations from the Publications Office CELLAR API."""

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

from bs4 import BeautifulSoup

from regtech.citations.base import CitationExtractor
from regtech.download.base import Downloader
from regtech.models import LegalDocument
from regtech.sections import SectionDraft, make_sections

CELLAR_CELEX_URL = "https://publications.europa.eu/resource/celex/{celex}?language=en"
CELEX_RE = re.compile(r"^3\d{4}R\d{4,}$")
NOTICE_FILE = "notice.xml"
TEXT_FILE = "regulation.xhtml"


@dataclass(frozen=True)
class _Item:
    celex: str
    title: str
    expression_id: str
    xhtml_url: str


class EuSource:
    """Fetch one or more EU regulations by CELEX number, preserving their articles."""

    name = "eu"

    def __init__(
        self,
        celex_numbers: list[str] | None,
        downloader: Downloader,
        raw_dir: Path,
        extractor: CitationExtractor,
    ):
        self._numbers = celex_numbers
        self._downloader = downloader
        self._raw_dir = raw_dir
        self._extractor = extractor
        self._items: dict[str, _Item] = {}

    def list_ids(self) -> list[str]:
        if not self._numbers:
            raise ValueError("fetch eu needs --number CELEX (for example 32022R2554)")
        ids = []
        for celex in self._numbers:
            if not CELEX_RE.fullmatch(celex):
                raise ValueError(f"not an EU regulation CELEX number like 32022R2554: {celex!r}")
            item_id = self._item_id(celex)
            notice_path = self._raw_dir / item_id / NOTICE_FILE
            self._downloader.download(
                CELLAR_CELEX_URL.format(celex=celex),
                notice_path,
                headers={"Accept": "application/xml;notice=tree"},
            )
            item = self._metadata(celex, notice_path)
            self._items[item_id] = item
            ids.append(item_id)
        return ids

    def fetch(self, item_id: str) -> None:
        item = self._items[item_id]
        item_dir = self._raw_dir / item_id
        self._downloader.download(
            item.xhtml_url,
            item_dir / TEXT_FILE,
            headers={"Accept": "application/xhtml+xml"},
        )

    def parse(self, item_id: str) -> LegalDocument:
        item = self._items[item_id]
        item_dir = self._raw_dir / item_id
        soup = BeautifulSoup((item_dir / TEXT_FILE).read_bytes(), "html.parser")
        drafts = _article_drafts(soup)
        notice = ET.parse(item_dir / NOTICE_FILE).getroot()
        issue_date = _issue_date(notice, item.title)
        effective_date = _effective_date(notice)
        year, number = _regulation_number(item.celex)
        return LegalDocument(
            id=item_id,
            source=self.name,
            document_type="eu_regulation",
            identifier=f"Regulation (EU) {year}/{number}",
            title=item.title,
            issue_date=issue_date,
            effective_date=effective_date,
            source_url=f"https://eur-lex.europa.eu/eli/reg/{year}/{number}/oj/eng",
            pdf_url=f"https://eur-lex.europa.eu/eli/reg/{year}/{number}/oj/eng/pdf",
            local_source_path=f"eu/{item_id}/{TEXT_FILE}",
            sections=make_sections(drafts, f"eu_{item_id}", f"Regulation (EU) {year}/{number}", self._extractor),
        )

    def _metadata(self, celex: str, notice_path: Path) -> _Item:
        root = ET.parse(notice_path).getroot()
        expressions = [node for node in root if _tag(node) == "EXPRESSION"]
        english = next(
            (node for node in expressions if any(
                _text(lang.find("OP-CODE")) == "ENG"
                for lang in node if _tag(lang) == "EXPRESSION_USES_LANGUAGE"
            )),
            None,
        )
        if english is None:
            raise LookupError(f"CELLAR has no English text for {celex}")
        expression_id = _text(english.find("URI/IDENTIFIER"))
        title = next((_text(child.find("VALUE")) for child in english if _tag(child) == "TITLE"), "")
        if not expression_id or not title:
            raise LookupError(f"CELLAR metadata is incomplete for {celex}")

        manifestation = next((node for node in root if
            _tag(node) == "MANIFESTATION"
            and node.get("manifestation-type") == "xhtml"
            and _text(node.find("MANIFESTATION_MANIFESTS_EXPRESSION/URI/IDENTIFIER")) == expression_id
        ), None)
        xhtml_url = _text(manifestation.find("MANIFESTATION_HAS_ITEM/URI/VALUE")) if manifestation is not None else ""
        if not xhtml_url:
            raise LookupError(f"CELLAR has no English XHTML text for {celex}")
        return _Item(celex, title, expression_id, xhtml_url)

    @staticmethod
    def _item_id(celex: str) -> str:
        year, number = _regulation_number(celex)
        return f"eu-{year}-{number}"


def _tag(element: ET.Element) -> str:
    return element.tag.rsplit("}", 1)[-1]


def _text(element: ET.Element | None) -> str:
    return " ".join("".join(element.itertext()).split()) if element is not None else ""


def _regulation_number(celex: str) -> tuple[int, int]:
    match = re.fullmatch(r"3(\d{4})R(\d+)", celex)
    if not match:
        raise ValueError(f"unsupported EU regulation CELEX number: {celex}")
    return int(match[1]), int(match[2])


def _issue_date(root: ET.Element, title: str) -> date | None:
    # English EUR-Lex titles use the stable "of 14 December 2022" form.
    match = re.search(
        r"\bof\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b",
        title,
        re.IGNORECASE,
    )
    if match:
        try:
            return datetime.strptime(" ".join(match.groups()), "%d %B %Y").date()
        except ValueError:
            pass
    return None


def _effective_date(root: ET.Element) -> date | None:
    work = next((node for node in root if _tag(node) == "WORK"), None)
    if work is None:
        return None
    for node in work:
        if _tag(node) == "RESOURCE_LEGAL_DATE_ENTRY-INTO-FORCE":
            try:
                return date.fromisoformat(_text(node.find("VALUE"))[:10])
            except ValueError:
                return None
    return None


def _article_drafts(soup: BeautifulSoup) -> list[SectionDraft]:
    drafts = []
    current_chapter = None
    current_chapter_title = None
    articles = soup.select("div.eli-subdivision[id^='art_']")
    for node in soup.find_all(["p", "div"]):
        if node.name == "p" and "oj-ti-section-1" in node.get("class", []):
            label = node.get_text(" ", strip=True)
            current_chapter = label.removeprefix("CHAPTER ").strip() or label
            title = node.find_next("p", class_="oj-ti-section-2")
            current_chapter_title = title.get_text(" ", strip=True) if title else None
            continue
        if node.name != "div" or not node.get("id", "").startswith("art_"):
            continue
        article = node
        article_label = article.select_one("p.oj-ti-art")
        if not article_label:
            continue
        article_number = article_label.get_text(" ", strip=True).removeprefix("Article ").strip()
        title = article.select_one("p.oj-sti-art")
        draft = SectionDraft(
            chapter=current_chapter,
            chapter_title=current_chapter_title,
            heading=title.get_text(" ", strip=True) if title else None,
            section=article_number,
        )
        body_paragraphs = article.select("p.oj-normal")
        has_text = False
        for paragraph in body_paragraphs:
            text = " ".join(paragraph.get_text(" ", strip=True).split())
            if not text:
                continue
            if has_text:
                draft.new_paragraph()
            draft.add_text(text)
            has_text = True
        if has_text:
            drafts.append(draft)
    return drafts
