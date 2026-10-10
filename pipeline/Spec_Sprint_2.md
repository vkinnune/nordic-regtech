# regtech — Sprint 2 Spec: Local File Serving & Regulatory Version-Control Diff

## Context & Objectives
In Sprint 1, `regtech` successfully implemented:
- Riksdagen SFS client (`fetch-sfs`)
- Finansinspektionen FFFS crawler & PyMuPDF extractor (`crawl-fffs`) covering all 422 active principal regulations
- SQLite FTS5 search and cross-document citation linking (`link`)
- Browser viewer with sidebar search (`serve`)

Sprint 2 adds two critical enterprise compliance capabilities:
1. **Local Document Serving**: Eliminate dependence on external government URLs (which get blocked or fail behind corporate bank firewalls) by serving cached PDFs (`regulation.pdf`, `memo.pdf`) and raw official HTML directly from disk.
2. **Regulatory Version Control (Diff Engine)**: In Swedish statutory drafting, base statutes (*grundförfattningar*, e.g., `FFFS 2014:12` or `SFS 2007:528`) are modified over time by amendment acts (*ändringsförfattningar*, e.g., `FFFS 2023:12` or `SFS 2026:1066`). Legal compliance officers need an inline, Git-style visual comparison (red strikethrough for deleted text, green highlight for added text) comparing the base text and the amendment.

---

## 1. Feature 1: Local PDF & Raw File Serving

### Requirements:
1. **FastAPI Endpoints (`regtech/viewer/app.py`)**:
   - `GET /doc/{doc_id}/pdf`: Serves the locally cached regulation PDF (`data/raw/fi_fffs/{doc_id}/regulation.pdf` or Riksdagen PDF if cached) using `fastapi.responses.FileResponse(..., media_type="application/pdf")`. Returns HTTP 404 if not found on disk.
   - `GET /doc/{doc_id}/memo`: Serves the consultation memo PDF (`data/raw/fi_fffs/{doc_id}/memo.pdf`) if present. Returns HTTP 404 if not present.
   - `GET /doc/{doc_id}/raw`: Serves the raw original HTML or JSON payload stored on disk for debugging and inspection.
2. **Viewer UI Integration (`templates/document.html`)**:
   - In the document header bar / action tray, add direct action badges/buttons:
     - `[ 📄 Original PDF ]` (`href="/doc/{{ doc.id }}/pdf"` with `target="_blank"`). Only display if local PDF exists.
     - `[ 📝 FI Memo ]` (`href="/doc/{{ doc.id }}/memo"` with `target="_blank"`). Only display if `memo.pdf` exists.
     - `[ 🌐 Local Raw ]` (`href="/doc/{{ doc.id }}/raw"` with `target="_blank"`).
3. **HTML Caching during Fetch (`regtech/sources/riksdagen.py`)**:
   - When fetching SFS documents, ensure the raw HTML is saved under `data/raw/riksdagen/{id}.html` so `/doc/{id}/raw` can serve it without hitting Riksdagen's live API.

---

## 2. Feature 2: Regulatory Version-Control Diff Engine

### Background:
Every Swedish statutory amendment modifies specific chapters and sections of an existing base law. In the existing data model, `LegalDocument` already tracks `amends` (e.g., `FFFS 2014:12`), and `app.py` already resolves `amendments = [s for s in summaries if s.amends == doc.identifier]`.

### Requirements:
1. **Diff Engine (`regtech/diff.py`)**:
   - Implement semantic token/word-level diffing between two text strings using standard library `difflib.ndiff` or `diff-match-patch`.
   - Wrap deleted segments in:
     ```html
     <del class="diff-del bg-red-100 text-red-800 line-through px-0.5 rounded">deleted text</del>
     ```
   - Wrap added segments in:
     ```html
     <ins class="diff-ins bg-green-100 text-green-800 font-semibold no-underline px-0.5 rounded">added text</ins>
     ```
   - Unchanged text remains plain.
2. **Section-Level Alignment**:
   - Compare matching sections between base regulation and amendment (e.g. Chapter 2 § 4 in base vs Chapter 2 § 4 in amendment).
   - If an amendment introduces brand new sections, mark the entire section as added.
   - If an amendment repeals sections (*upphävs*), mark the entire section as removed.
3. **Diff Viewer Endpoint (`GET /doc/{doc_id}/diff/{amendment_id}`)**:
   - Add route in `app.py` rendering `templates/diff.html`.
   - Displays:
     - Header bar with breadcrumbs: `"Base: [Doc ID] ⟵ Amendment: [Amendment ID]"`.
     - Side-by-side or unified inline diff view showing each modified chapter/section.
     - Fast toggle between Unified Inline Diff and Split View.
4. **Viewer Linking (`templates/document.html`)**:
   - In the document view of a base regulation, under the "Amendments" listing, add a direct `[ Compare Diff ]` button next to each amendment entry leading to `/doc/{doc_id}/diff/{amendment_id}`.

---

## 3. Verification & Testing

1. **Automated Unit Tests (`tests/test_diff.py`)**:
   - Test word-level insertions and deletions.
   - Test paragraph replacement.
   - Test zero-change comparison (identical text).
   - Test endpoint routing `/doc/{id}/pdf` and `/doc/{id}/diff/{amendment_id}`.
2. **Manual Acceptance**:
   - Run `uv run regtech serve`.
   - Open a base regulation that has amendments (e.g. `FFFS 2014:12`).
   - Click `[ 📄 Original PDF ]` $\rightarrow$ opens local PDF in browser tab without external network calls.
   - Click `[ Compare Diff ]` $\rightarrow$ opens diff view showing highlighted changes against the selected amendment act.
