from collections import defaultdict
from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from markupsafe import Markup, escape

from regtech.models import (
    SNIPPET_MATCH_END,
    SNIPPET_MATCH_START,
    Change,
    ChangeStatus,
    DocumentSummary,
    FeedEvent,
    LegalDocument,
    Link,
    SearchHit,
    SourceName,
)
from regtech.sources.fffs import FffsSource
from regtech.sources.riksdagen import RiksdagenSource
from regtech.storage.base import ChangeStore, DocumentStore, LinkStore
from regtech.versions import chunk_ids, text_diff

TEMPLATES_DIR = Path(__file__).parent / "templates"
FILES_ROUTE = "/files"
API_ROUTE = "/api/v1"
FEED_LIMIT = 50
FEED_MAX_LIMIT = 500
CHANGES_PAGE_LIMIT = 50
SEARCH_LIMIT = 50
PALETTE_SEARCH_LIMIT = 8
DOCUMENT_TYPE_LABELS = {
    "lag": "Act",
    "forordning": "Ordinance",
    "foreskrift": "Regulation",
    "allmanna_rad": "General guidelines",
}
CHANGE_BADGES = {"MODIFIED": "badge-amber", "ADDED": "badge-emerald", "REPEALED": "badge-red"}
DIFF_TAGS = {"delete": "del", "insert": "ins"}


def create_app(
    doc_store: DocumentStore,
    link_store: LinkStore,
    change_store: ChangeStore,
    files_dir: Path,
) -> FastAPI:
    app = FastAPI(title="regtech")
    app.mount(FILES_ROUTE, StaticFiles(directory=files_dir, check_dir=False), name="files")
    templates = Jinja2Templates(directory=TEMPLATES_DIR)
    templates.env.filters["snippet"] = _snippet_html
    templates.env.filters["hit_href"] = _hit_href
    templates.env.filters["diff"] = _diff_html
    templates.env.globals["type_labels"] = DOCUMENT_TYPE_LABELS
    templates.env.globals["change_badges"] = CHANGE_BADGES
    templates.env.globals["sfs_source"] = RiksdagenSource.name
    templates.env.globals["fffs_source"] = FffsSource.name

    def page(request: Request, name: str, summaries: list[DocumentSummary], **context):
        return templates.TemplateResponse(request, name, {"library": summaries, **context})

    @app.get("/", response_class=HTMLResponse)
    def index(request: Request):
        return page(request, "index.html", doc_store.list_documents())

    @app.get("/doc/{doc_id}", response_class=HTMLResponse)
    def document(request: Request, doc_id: str):
        doc = doc_store.get_document(doc_id)
        if doc is None:
            raise HTTPException(status_code=404, detail=f"{doc_id} is not stored")
        outgoing, incoming = link_store.links(doc_id)
        section_changes, removed = _changes(doc, change_store.changes(doc_id))
        summaries = doc_store.list_documents()
        doc_ids = {summary.identifier: summary.id for summary in summaries}

        return page(
            request,
            "document.html",
            summaries,
            doc=doc,
            is_fffs=doc.source == FffsSource.name,
            sources=_sources(doc, files_dir),
            chapters=_chapters(doc),
            citation_hrefs=_citation_hrefs(outgoing),
            incoming=_incoming(incoming),
            section_changes=section_changes,
            removed=removed,
            amends_id=doc_ids.get(doc.amends) if doc.amends else None,
            repealed_by_id=doc_ids.get(doc.repealed_by) if doc.repealed_by else None,
            amendments=[summary for summary in summaries if summary.amends == doc.identifier],
        )

    @app.api_route("/doc/{doc_id}/pdf", methods=["GET", "HEAD"])
    def document_pdf(doc_id: str):
        doc = doc_store.get_document(doc_id)
        if doc is None:
            raise HTTPException(status_code=404, detail=f"{doc_id} is not stored")
        pdf_path = doc.local_pdf_path
        if not pdf_path:
            for cand in [
                f"fi_fffs/{doc_id}/consolidated.pdf",
                f"fi_fffs/{doc_id}/regulation.pdf",
            ]:
                if (files_dir / cand).is_file():
                    pdf_path = cand
                    break
        if not pdf_path:
            raise HTTPException(status_code=404, detail=f"No local PDF recorded for {doc_id}")
        pdf_file = files_dir / pdf_path
        if not pdf_file.is_file():
            raise HTTPException(status_code=404, detail=f"PDF file not found on disk for {doc_id}")
        return FileResponse(
            pdf_file,
            media_type="application/pdf",
            filename=pdf_file.name,
            content_disposition_type="inline",
        )

    @app.api_route("/doc/{doc_id}/memo", methods=["GET", "HEAD"])
    def document_memo(doc_id: str):
        doc = doc_store.get_document(doc_id)
        if doc is None:
            raise HTTPException(status_code=404, detail=f"{doc_id} is not stored")
        memo_path = doc.local_memo_path
        if not memo_path:
            cand = f"fi_fffs/{doc_id}/memo.pdf"
            if (files_dir / cand).is_file():
                memo_path = cand
        if not memo_path:
            raise HTTPException(status_code=404, detail=f"No local decision memo recorded for {doc_id}")
        memo_file = files_dir / memo_path
        if not memo_file.is_file():
            raise HTTPException(status_code=404, detail=f"Decision memo file not found on disk for {doc_id}")
        return FileResponse(
            memo_file,
            media_type="application/pdf",
            filename=memo_file.name,
            content_disposition_type="inline",
        )

    @app.api_route("/doc/{doc_id}/raw", methods=["GET", "HEAD"])
    def document_raw(doc_id: str):
        doc = doc_store.get_document(doc_id)
        if doc is None:
            raise HTTPException(status_code=404, detail=f"{doc_id} is not stored")
        if doc.local_source_path:
            source_file = files_dir / doc.local_source_path
            if source_file.is_file():
                media_type = "text/html" if source_file.suffix == ".html" else "application/json"
                return FileResponse(source_file, media_type=media_type)
        sfs_raw = files_dir / "riksdagen" / "documents" / f"{doc_id}.json"
        if sfs_raw.is_file():
            return FileResponse(sfs_raw, media_type="application/json")
        fffs_raw = files_dir / "fi_fffs" / doc_id / "item.html"
        if fffs_raw.is_file():
            return FileResponse(fffs_raw, media_type="text/html")
        return doc

    @app.get("/search", response_class=HTMLResponse)
    def search(request: Request, q: str = ""):
        hits = doc_store.search(q, SEARCH_LIMIT)
        hits_by_document: dict[str, list[SearchHit]] = defaultdict(list)
        for hit in hits:
            hits_by_document[hit.document_id].append(hit)
        summaries = doc_store.list_documents()

        return page(
            request,
            "search.html",
            summaries,
            documents={summary.id: summary for summary in summaries},
            query=q,
            hit_count=len(hits),
            limit=SEARCH_LIMIT,
            hits_by_document=hits_by_document,
        )

    @app.get("/changes", response_class=HTMLResponse)
    def changes(
        request: Request,
        before: int | None = None,
        source: SourceName | None = None,
        status: ChangeStatus | None = None,
    ):
        events = change_store.recent_changes(before, source, status, CHANGES_PAGE_LIMIT)
        events_by_day: dict[date, list[FeedEvent]] = defaultdict(list)
        for event in events:
            events_by_day[event.fetched_at.date()].append(event)

        return page(
            request,
            "changes.html",
            doc_store.list_documents(),
            events_by_day=events_by_day,
            hrefs=_event_hrefs(events, doc_store, files_dir),
            source=source,
            status=status,
            before=before,
            older=events[-1].event_id if len(events) == CHANGES_PAGE_LIMIT else None,
        )

    @app.get("/api/search")
    def search_api(q: str = "") -> list[dict]:
        return [
            {"href": _hit_href(hit), "label": hit.label, "snippet": _snippet_html(hit.snippet)}
            for hit in doc_store.search(q, PALETTE_SEARCH_LIMIT)
        ]

    @app.get(f"{API_ROUTE}/feed")
    def feed(
        request: Request,
        after: int = Query(0, ge=0),
        since: date | None = None,
        limit: int = Query(FEED_LIMIT, ge=1, le=FEED_MAX_LIMIT),
    ) -> dict:
        events = change_store.feed(after, since, limit)
        hrefs = _event_hrefs(events, doc_store, files_dir)
        base_url = str(request.base_url).rstrip("/")

        return {
            "events": [_feed_json(event, hrefs[event.event_id], base_url) for event in events],
            "next_after": events[-1].event_id if events else after,
        }

    @app.get(API_ROUTE + "/documents/{doc_id}")
    def document_api(doc_id: str) -> LegalDocument:
        doc = doc_store.get_document(doc_id)
        if doc is None:
            raise HTTPException(status_code=404, detail=f"{doc_id} is not stored")
        return doc

    return app


def _sources(doc: LegalDocument, files_dir: Path) -> list[dict]:
    sources = []
    for label, url, local_path in [
        ("Official page", doc.source_url, doc.local_source_path),
        ("PDF", doc.pdf_url, doc.local_pdf_path),
        ("Decision memo", doc.memo_url, doc.local_memo_path),
    ]:
        local_href = _saved_href(local_path, files_dir)
        if url or local_href:
            sources.append({"label": label, "url": url, "local_href": local_href})
    return sources


def _saved_href(local_path: str | None, files_dir: Path) -> str | None:
    is_saved = local_path is not None and (files_dir / local_path).is_file()
    return f"{FILES_ROUTE}/{local_path}" if is_saved else None


def _event_hrefs(
    events: list[FeedEvent], doc_store: DocumentStore, files_dir: Path
) -> dict[int, dict[str, str | None]]:
    docs = {doc_id: doc_store.get_document(doc_id) for doc_id in {e.document_id for e in events}}
    chunks = {doc_id: chunk_ids(doc) for doc_id, doc in docs.items()}

    hrefs = {}
    for event in events:
        doc = docs[event.document_id]
        chunk_id = chunks[doc.id].get(event.key) if event.level == "section" else None
        hrefs[event.event_id] = {
            "viewer": f"/doc/{doc.id}#{chunk_id}" if chunk_id else f"/doc/{doc.id}",
            "document_api": f"{API_ROUTE}/documents/{doc.id}",
            "file": _saved_href(doc.local_pdf_path or doc.local_source_path, files_dir),
        }
    return hrefs


def _feed_json(event: FeedEvent, hrefs: dict[str, str | None], base_url: str) -> dict:
    urls = {name: f"{base_url}{href}" if href else None for name, href in hrefs.items()}
    return {**event.model_dump(mode="json", exclude={"ordinal"}), "urls": urls}


def _chapters(doc: LegalDocument) -> list[dict]:
    chapters: list[dict] = []
    for section in doc.sections:
        if not chapters or chapters[-1]["number"] != section.chapter:
            chapters.append(
                {
                    "number": section.chapter,
                    "title": section.chapter_title,
                    "anchor": _chapter_anchor(section.chapter),
                    "sections": [],
                }
            )
        chapters[-1]["sections"].append(section)
    return chapters


def _changes(doc: LegalDocument, changes: list[Change]) -> tuple[dict[str, Change], list[Change]]:
    latest = {change.key: change for change in changes}
    by_chunk = {
        chunk_id: latest.pop(key) for key, chunk_id in chunk_ids(doc).items() if key in latest
    }
    removed = [change for change in latest.values() if change.new_text is None]
    return by_chunk, removed


def _citation_hrefs(outgoing: list[Link]) -> dict[tuple[str | None, int], str]:
    hrefs: dict[tuple[str | None, int], str] = {}
    for link in sorted(outgoing, key=lambda link: link.target_chunk_id is None):
        hrefs.setdefault((link.chunk_id, link.citation_index), _target_href(link))
    return hrefs


def _incoming(incoming: list[Link]) -> dict[str | None, list[dict]]:
    by_target: dict[str | None, list[dict]] = defaultdict(list)
    seen = set()
    for link in incoming:
        key = (link.target_chunk_id, link.document_id, link.chunk_id, link.via_label)
        if key in seen:
            continue
        seen.add(key)
        anchor = f"#{link.chunk_id}" if link.chunk_id else ""
        by_target[link.target_chunk_id].append(
            {
                "label": link.citing_label,
                "href": f"/doc/{link.document_id}{anchor}",
                "via": link.via_label,
            }
        )
    return by_target


def _target_href(link: Link) -> str:
    if link.target_chunk_id:
        return f"/doc/{link.target_document_id}#{link.target_chunk_id}"
    if link.target_chapter:
        return f"/doc/{link.target_document_id}#{_chapter_anchor(link.target_chapter)}"
    return f"/doc/{link.target_document_id}"


def _hit_href(hit: SearchHit) -> str:
    return f"/doc/{hit.document_id}#{hit.chunk_id}" if hit.chunk_id else f"/doc/{hit.document_id}"


def _chapter_anchor(chapter: str | None) -> str:
    return f"chapter-{chapter.replace(' ', '')}" if chapter else "sections"


def _snippet_html(snippet: str) -> Markup:
    html = str(escape(snippet))
    return Markup(html.replace(SNIPPET_MATCH_START, "<mark>").replace(SNIPPET_MATCH_END, "</mark>"))


def _diff_html(change: Change) -> Markup:
    html = []
    for op, text in text_diff(change.old_text or "", change.new_text or ""):
        words = text.rstrip()
        space = text[len(words) :]
        tag = DIFF_TAGS.get(op)
        html.append(f"<{tag}>{escape(words)}</{tag}>{space}" if tag else str(escape(text)))
    return Markup("".join(html))
