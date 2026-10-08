import sys
from pathlib import Path

from regtech.models import LegalDocument
from regtech.sources.base import Source
from regtech.storage.base import DocumentStore


def run(
    source: Source,
    doc_store: DocumentStore,
    json_dir: Path,
    limit: int | None = None,
    remove_unlisted: bool = False,
) -> tuple[list[LegalDocument], list[str]]:
    item_ids = source.list_ids()
    docs: list[LegalDocument] = []
    failures: list[str] = []

    for item_id in item_ids[:limit]:
        if not _fetch(source, item_id, failures):
            continue

        doc = _parse(source, item_id, failures)
        if doc is None:
            continue

        _save(doc, doc_store, json_dir)
        docs.append(doc)

    # An empty listing means the page layout changed, not that every document is gone.
    if remove_unlisted and item_ids:
        _remove_unlisted(source, item_ids, doc_store, json_dir)
    return docs, failures


def _fetch(source: Source, item_id: str, failures: list[str]) -> bool:
    try:
        source.fetch(item_id)
    except Exception as error:
        failures.append(f"{item_id}: download failed: {error}")
        return False
    return True


def _parse(source: Source, item_id: str, failures: list[str]) -> LegalDocument | None:
    try:
        return source.parse(item_id)
    except Exception as error:
        failures.append(f"{item_id}: parse failed: {error}")
        return None


def _save(doc: LegalDocument, doc_store: DocumentStore, json_dir: Path) -> None:
    json_dir.mkdir(parents=True, exist_ok=True)
    (json_dir / f"{doc.id}.json").write_text(doc.model_dump_json(indent=2), encoding="utf-8")
    doc_store.save_documents([doc])
    print(f"saved {doc.id}", file=sys.stderr)


def _remove_unlisted(
    source: Source, item_ids: list[str], doc_store: DocumentStore, json_dir: Path
) -> None:
    listed = set(item_ids)
    for summary in doc_store.list_documents():
        if summary.source == source.name and summary.id not in listed:
            doc_store.delete_document(summary.id)
            (json_dir / f"{summary.id}.json").unlink(missing_ok=True)
            print(f"removed {summary.id}", file=sys.stderr)
