Swedish regulatory data pipeline – Phase 2
Task specification and developer guide
Tech stack	Python 3.11+, Pydantic v2, PyMuPDF, SQLite, Pytest, FastAPI
Target data	Swedish legal & supervisory updates (Riksdagen SFS + Finansinspektionen FFFS)
Core focus	Local document serving, statutory version diffing & automated incremental sync

1. Overview & Phase 1 Retrospective
Phase 1 established a working baseline ingestion engine for Swedish financial law: Riksdagen SFS parsing (Acts and Ordinances), Finansinspektionen FFFS scraping with PyMuPDF text classification (binding rules vs. Allmänna råd), full SQLite persistence (414 active regulations), cross-document citation resolution (>16,000 links), and a lightweight browser viewer.
Phase 2 productionizes this standalone pipeline for integration with compliance applications. The focus is solving local document serving (bypassing external geoblocking), building section-level statutory change diffing, automating bulk incremental synchronization, and adding OCR fallback for legacy regulations.
Note on Scope: The client already operates an existing production ingestion pipeline for Finnish statutes (Finlex) and EU directives. Finnish regulation parsing is explicitly out of scope for this pipeline so we do not duplicate existing infrastructure.
2. Architectural Priorities (What we are building)
2.1 Local Document Serving (PDF & HTML)
In Phase 1, the visual viewer linked out to external URLs on fi.se. These official endpoints frequently block foreign IPs and enterprise firewalls.
•	Local mount: Mount the downloaded storage directory in FastAPI as a static file route (e.g. /files/{filename}).
•	Offline viewing: Update the document and section views so clicking 'View Source' or 'Original PDF' immediately opens the locally downloaded PDF or HTML file.
•	Decision memos: Serve associated decision memos (Beslutspromemoria) locally alongside primary regulations.
2.2 Statutory Amendment Diff Engine (Section-Level Version Control)
Financial compliance officers must track statutory amendments when new amending acts (ändringsförfattningar) are enacted. A compliance officer needs to see exactly what changed at the section level:
•	Section-level comparison: Compare consecutive versions of a statute at the section (§) level.
•	Diff status classification: Flag each section as UNCHANGED, MODIFIED, ADDED, or REPEALED.
•	Text diff generation: For MODIFIED sections, generate structured text diffs highlighting added and deleted phrases.
•	Amending act attribution: Tag modified sections with the specific amending act identifier (e.g. 'SFS 2024:1086') and effective date.
2.3 Automated Bulk Riksdagen Ingestion & Incremental Daily Sync
Transition from curated presets to automated bulk sync and daily polling:
•	Full registry sync: Page through all active SFS statutes on data.riksdagen.se (filtering for in-force statutes / gällande författningar).
•	Incremental sync: Support daily incremental sync using f_sys_d1=YYYY-MM-DD so daily updates process in under 30 seconds.
•	CLI interface: Provide command: regtech sync-sfs [--since YYYY-MM-DD] [--all].
2.4 Legacy Scanned PDF Ingestion (OCR Fallback)
Older FFFS regulations (principally pre-2005) on fi.se are scanned paper documents without a native text layer:
•	Detection threshold: When PyMuPDF extracts fewer than 50 characters from a page of an active regulation, trigger OCR extraction.
•	OCR engine: Use PyMuPDF's built-in Tesseract OCR integration (page.get_textpage_ocr(language='swe')).
•	Zero blank docs: Ensure older regulations produce structured sections rather than empty records.
3. Target Data Models (Pydantic v2)
from datetime import date, datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

class SectionDiff(BaseModel):
    status: Literal["UNCHANGED", "MODIFIED", "ADDED", "REPEALED"] = "UNCHANGED"
    amending_act: Optional[str] = None       # e.g., "SFS 2024:1086"
    amended_date: Optional[date] = None
    previous_text: Optional[str] = None
    diff_html: Optional[str] = None          # Inline diff highlighting changes

class LegalSection(BaseModel):
    chunk_id: str                            # {source}_{id}_k{chapter}_p{section}
    chapter: Optional[str] = None
    chapter_title: Optional[str] = None
    section: str                             # e.g. "1 §" or "2 a §"
    rule_type: Literal["binding_rule", "guidance"] = "binding_rule"
    is_bemyndigande: bool = False            # True if delegates rulemaking power
    paragraphs: List[str] = Field(default_factory=list)
    points: List[str] = Field(default_factory=list)
    citations: List["Citation"] = Field(default_factory=list)
    diff: SectionDiff = Field(default_factory=SectionDiff)
    full_text: str

class LegalDocument(BaseModel):
    id: str                                  # "sfs-2007-528" or "fffs-2017-2"
    source: Literal["riksdagen", "fi_fffs"]
    document_type: Literal["lag", "forordning", "foreskrift", "allmanna_rad"]
    identifier: str                          # "SFS 2007:528" or "FFFS 2017:2"
    title: str
    effective_date: Optional[date] = None
    latest_amendment: Optional[str] = None
    source_url: str
    local_pdf_path: Optional[str] = None     # Local relative path on disk
    local_html_path: Optional[str] = None
    served_file_url: Optional[str] = None    # Local FastAPI static route
    sections: List[LegalSection] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

4. Milestones & Acceptance Criteria
Milestone	Scope	Acceptance criteria
Milestone 2.1	Local File Serving & PR #1 Merge	Mount downloaded PDFs/HTMLs in FastAPI static route (/files/...). Rewrite UI and API links so clicking documents opens local copies directly. Review and merge PR #1 (fix/fffs-blank-docs).
Milestone 2.2	Statutory Amendment Diff Engine	Implement section-level diffing between versions of a law. Display UNCHANGED, MODIFIED, ADDED, REPEALED status badges and inline visual text diffs in viewer.
Milestone 2.3	Bulk SFS Sync & Incremental Polling	CLI command regtech sync-sfs pages through all in-force Riksdagen SFS statutes. Incremental sync using f_sys_d1 completes in under 30 seconds.
Milestone 2.4	Legacy Scanned PDF OCR Fallback	Integrate PyMuPDF OCR fallback for pre-2005 scanned FFFS regulations when extracted text length < 50 chars.