from datetime import UTC, date, datetime
from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field

ChangeLevel = Literal["document", "section"]
ChangeStatus = Literal["MODIFIED", "ADDED", "REPEALED"]
CitationType = Literal[
    "internal",
    "external_act",
    "external_ordinance",
    "external_fffs",
    "eu_directive",
    "eu_regulation",
]
DocumentType = Literal["lag", "forordning", "foreskrift", "allmanna_rad"]
RuleType = Literal["binding_rule", "guidance"]
SNIPPET_MATCH_START = "\x02"
SNIPPET_MATCH_END = "\x03"
SourceName = Literal["riksdagen", "fi_fffs"]


class CitationTarget(BaseModel):
    chapter: str | None = None
    section: str | None = None


class Citation(BaseModel):
    raw_text: str
    citation_type: CitationType
    target_document: str | None = None
    targets: list[CitationTarget] = []


class Point(BaseModel):
    number: str | None = None
    text: str
    items: list[str] = []


class Paragraph(BaseModel):
    text: str
    rule_type: RuleType = "binding_rule"
    points: list[Point] = []


class LegalSection(BaseModel):
    chunk_id: str
    chapter: str | None = None
    chapter_title: str | None = None
    heading: str | None = None
    section: str | None
    in_force_from: date | None = None
    in_force_until: date | None = None
    upcoming: bool = False
    is_bemyndigande: bool = False
    paragraphs: list[Paragraph]
    citations: list[Citation] = []
    full_text: str

    def label(self, identifier: str) -> str:
        chapter_part = f" {self.chapter} kap." if self.chapter else ""
        section_part = f" {self.section} §" if self.section else f" {self.heading or 'text'}"
        upcoming_part = " (upcoming wording)" if self.upcoming else ""
        return f"{identifier}{chapter_part}{section_part}{upcoming_part}"


class LegalDocument(BaseModel):
    id: str
    source: SourceName
    document_type: DocumentType
    identifier: str
    title: str
    issue_date: date | None = None
    effective_date: date | None = None
    latest_amendment: str | None = None
    repealed_on: date | None = None
    repealed_by: str | None = None
    amends: str | None = None
    source_url: str
    pdf_url: str | None = None
    memo_url: str | None = None
    local_source_path: str | None = None
    local_pdf_path: str | None = None
    local_memo_path: str | None = None
    memo_text: str | None = None
    preamble: str | None = None
    authorizations: list[Citation] = []
    amendment_dates: dict[str, date] = {}
    sections: list[LegalSection] = []
    updated_at: AwareDatetime = Field(default_factory=lambda: datetime.now(UTC))


class Change(BaseModel):
    document_id: str
    level: ChangeLevel = "section"
    chapter: str | None = None
    section: str | None = None
    upcoming: bool = False
    ordinal: int = 0
    status: ChangeStatus
    old_text: str | None = None
    new_text: str | None = None
    amending_act: str | None = None
    amended_date: date | None = None
    fetched_at: AwareDatetime

    @property
    def key(self) -> tuple[str | None, str | None, bool, int]:
        return (self.chapter, self.section, self.upcoming, self.ordinal)


class FeedEvent(Change):
    event_id: int
    source: SourceName
    identifier: str
    title: str


class DocumentSummary(BaseModel):
    id: str
    source: SourceName
    document_type: DocumentType
    identifier: str
    title: str
    effective_date: date | None = None
    latest_amendment: str | None = None
    repealed_on: date | None = None
    repealed_by: str | None = None
    amends: str | None = None


class Link(BaseModel):
    document_id: str
    chunk_id: str | None
    citing_label: str
    citing_is_bemyndigande: bool
    citation_index: int
    raw_text: str
    target_document_id: str
    target_chapter: str | None = None
    target_chunk_id: str | None = None
    via_label: str | None = None


class SearchHit(BaseModel):
    document_id: str
    chunk_id: str | None
    label: str
    snippet: str
