Swedish regulatory data pipeline
Task specification and developer guide
Tech stack
Python 3.11+, Pydantic v2, BeautifulSoup4, PyMuPDF, SQLite, Pytest, FastAPI
Target data
Public Swedish legal and financial regulations (Riksdagen + Finansinspektionen)
Core focus
Statutory cross-reference engine & compliance hierarchy (Lagar + Förordningar + FFFS)


1. Overview
The goal is to build a standalone Python pipeline to download, parse, and structure legal text, statutory citations, and supervisory rules from Swedish financial law.
This task uses only public government sources. No API keys, VPNs, or internal databases are required. The whole tool can be built and tested on your own machine.
2. The regulatory architecture (What we are ingesting)
Swedish financial compliance operates across three interconnected legal layers:
1. Parliamentary Acts (Lagar, SFS): Enacted by Riksdagen (e.g. Lag 2007:528 om värdepappersmarknaden). Set core statutory obligations and legal authorizations (bemyndiganden).
2. Government Ordinances (Förordningar, SFS): Issued by the Government (e.g. Förordning 2007:572). Specify how Acts are applied and delegate powers to Finansinspektionen.
3. Supervisory Regulations (FFFS): Issued by Finansinspektionen (FI). Contains binding regulations (Föreskrifter) and non-binding guidance (Allmänna råd) operating on the 'comply or explain' principle.
The key differentiator: Citation & cross-reference mapping
A flat text dump of laws is not sufficient. The real value for financial compliance is mapping references and citations between sections (reference model: https://www.lagar.se/lag/sfs-2007-572/). When viewing a section, users need to see outgoing citations, delegating clauses (bemyndiganden), and incoming supervisory rules.
3. Technical specifications
3.1 Riksdagen REST API (Acts & Ordinances / SFS)
The Swedish parliament provides an open REST API at https://data.riksdagen.se/. It does not need an API key. Use a standard User-Agent header (for example: LegalPipeline-Parser/1.0). Use IPv4 if your connection resets over IPv6.
# Search statutes
GET https://data.riksdagen.se/dokumentlista/?doktyp=sfs&utformat=json&sz=100&p={page}
# Parameters:
# doktyp=sfs               -> filters for acts & ordinances in SFS
# sfsnr=YYYY:NNN           -> search by statute number (e.g., 2007:528 or 2007:572)
# f_sys_d1=YYYY-MM-DD      -> filter by update date for incremental sync
# sort=systemdatum&sortorder=desc -> newest changes first

# Fetch full consolidated text
GET https://data.riksdagen.se/dokument/{id}.json
# Field 'dokumentstatus.dokument.html' contains full text with amendments consolidated.


Priority statutes to start with (Acts and Companion Ordinances):
Statute
Type
Name and subject
SFS 2007:528
Lag
Lag om värdepappersmarknaden (Securities Markets Act / MiFID II)
SFS 2007:572
Förordning
Förordning om värdepappersmarknaden (Companion Ordinance)
SFS 2017:630
Lag
Lag om åtgärder mot penningtvätt (AML Act)
SFS 2017:673
Förordning
Förordning om åtgärder mot penningtvätt (AML Ordinance)
SFS 2004:297
Lag
Lag om bank- och finansieringsrörelse (Banking Business Act)
SFS 2004:329
Förordning
Förordning om bank- och finansieringsrörelse (Banking Ordinance)
SFS 2013:561
Lag
Lag om förvaltare av alternativa investeringsfonder (AIFM Act)
SFS 2004:46
Lag
Lag om värdepappersfonder (Mutual Funds Act / UCITS)
SFS 2010:751
Lag
Lag om betaltjänster (Payment Services Act / PSD2)
SFS 2010:2043
Lag
Lag om försäkringsrörelse (Insurance Business Act)


3.2 Finansinspektionen regulations (FFFS)
Finansinspektionen issues rules and guidelines under the FFFS series at https://www.fi.se/sv/vara-register/fffs/sok-fffs/ (query ?grundforfattning=true&active=true).
1. Index: Scrape registry index to get active regulations (~700 items) with code, title, and date.
2. PDFs: Download consolidated PDF (ends in k-[date].pdf) and decision memo (Beslutspromemoria).
3. Parse: Extract clean text with PyMuPDF. Separate binding rules (Föreskrifter) from general guidelines (Allmänna råd - comply or explain).
4. Citations: Extract statutory authorization clauses citing SFS Acts or Ordinances.
3.3 Visual viewer (FastAPI + lightweight browser UI)
To demonstrate the pipeline to non-technical bank stakeholders and product owners, include a lightweight browser-based UI (FastAPI backend serving clean HTML/Tailwind or lightweight React):
 Browse by statute or regulation (SFS / FFFS).
 Collapsible chapter and section tree.
 Visual badge distinguishing Binding rules from Allmänna råd (comply or explain).
 Clickable citation pills linking directly to cited sections.
4. Target data models (Pydantic v2)
from datetime import date, datetime
from typing import List, Literal, Optional
from pydantic import BaseModel

class Citation(BaseModel):
    raw_text: str  # e.g., "6 kap. 1 § lagen (2007:528)"
    target_statute: Optional[str] = None  # e.g., "SFS 2007:528"
    target_chapter: Optional[str] = None  # e.g., "6"
    target_section: Optional[str] = None  # e.g., "1"
    citation_type: Literal["internal", "external_act", "external_ordinance", "eu_directive"]

class LegalSection(BaseModel):
    chunk_id: str  # Format: {source}_{id}_k{chapter}_p{section}
    chapter: Optional[str] = None
    chapter_title: Optional[str] = None
    section: str  # Example: "1 §" or "2 a §"
    rule_type: Literal["binding_rule", "guidance"] = "binding_rule"  # "guidance" for Allmänna råd
    is_bemyndigande: bool = False  # True if delegates power to issue regulations
    paragraphs: List[str]
    points: List[str] = []
    citations: List[Citation] = []
    full_text: str

class LegalDocument(BaseModel):
    id: str  # Example: "sfs-2007-528" or "sfs-2007-572"
    source: Literal["riksdagen", "fi_fffs"]
    document_type: Literal["lag", "forordning", "foreskrift", "allmanna_rad"]
    identifier: str  # Example: "SFS 2007:528" or "FFFS 2017:2"
    title: str
    effective_date: Optional[date] = None
    latest_amendment: Optional[str] = None
    source_url: str
    pdf_url: Optional[str] = None
    sections: List[LegalSection] = []
    updated_at: datetime = datetime.utcnow()


5. Milestones
Milestone
Scope
Acceptance criteria
Milestone 1
Riksdagen SFS client & parser
CLI command fetch-sfs --number 2007:528 outputs clean JSON matching the LegalDocument model with chapters, sections, and extracted citations. Covers Acts and Ordinances.
Milestone 2
FI.se regulations & PDF scraper
CLI command crawl-fffs fetches active regulations, downloads PDFs, and extracts text, distinguishing binding rules from Allmänna råd (comply or explain).
Milestone 3
Citation & cross-reference engine
Cross-document linker resolves citations between FFFS regulations and SFS Acts/Ordinances. Generates incoming and outgoing references for each section (similar to lagar.se).
Milestone 4


SQLite storage & visual viewer UI
Pipeline stores results in SQLite with full-text search. Includes a lightweight browser UI (FastAPI) allowing non-technical stakeholders to inspect chapters, sections, and clickable citations. Pytest coverage >80%.
Phase 2 (Opt.)
FI Sanctions scraper
Scrapes enforcement cases and penalties from fi.se/sanktioner with parsed SEK amounts.
