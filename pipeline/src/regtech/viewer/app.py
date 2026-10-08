from collections import defaultdict
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from markupsafe import Markup, escape

from regtech.models import SNIPPET_MATCH_END, SNIPPET_MATCH_START, LegalDocument, Link
from regtech.sources.fffs import FffsSource
from regtech.sources.riksdagen import RiksdagenSource
from regtech.storage.base import DocumentStore, LinkStore

TEMPLATES_DIR = Path(__file__).parent / "templates"
SEARCH_LIMIT = 50


def create_app(doc_store: DocumentStore, link_store: LinkStore) -> FastAPI:
    app = FastAPI(title="regtech")
    templates = Jinja2Templates(directory=TEMPLATES_DIR)
    templates.env.filters["snippet"] = _snippet_html

    @app.get("/", response_class=HTMLResponse)
    def index(request: Request):
        summaries = doc_store.list_documents()
        return templates.TemplateResponse(
            request,
            "index.html",
            {
                "sfs": [summary for summary in summaries if summary.source == RiksdagenSource.name],
                "fffs": [summary for summary in summaries if summary.source == FffsSource.name],
            },
        )

    @app.get("/doc/{doc_id}", response_class=HTMLResponse)
    def document(request: Request, doc_id: str):
        doc = doc_store.get_document(doc_id)
        if doc is None:
            raise HTTPException(status_code=404, detail=f"{doc_id} is not stored")
        outgoing, incoming = link_store.links(doc_id)
        summaries = doc_store.list_documents()
        doc_ids = {summary.identifier: summary.id for summary in summaries}

        return templates.TemplateResponse(
            request,
            "document.html",
            {
                "doc": doc,
                "is_fffs": doc.source == FffsSource.name,
                "chapters": _chapters(doc),
                "citation_hrefs": _citation_hrefs(outgoing),
                "incoming": _incoming(incoming),
                "amends_id": doc_ids.get(doc.amends) if doc.amends else None,
                "amendments": [
                    summary for summary in summaries if summary.amends == doc.identifier
                ],
            },
        )

    @app.get("/search", response_class=HTMLResponse)
    def search(request: Request, q: str = ""):
        hits = doc_store.search(q, SEARCH_LIMIT)
        return templates.TemplateResponse(request, "search.html", {"query": q, "hits": hits})

    return app


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


def _chapter_anchor(chapter: str | None) -> str:
    return f"chapter-{chapter.replace(' ', '')}" if chapter else "sections"


def _snippet_html(snippet: str) -> Markup:
    html = str(escape(snippet))
    return Markup(html.replace(SNIPPET_MATCH_START, "<mark>").replace(SNIPPET_MATCH_END, "</mark>"))
