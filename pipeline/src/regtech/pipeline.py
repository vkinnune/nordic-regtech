import sys
from datetime import UTC, date, datetime
from pathlib import Path

from regtech import versions
from regtech.models import LegalDocument
from regtech.sources.base import Source
from regtech.storage.base import ChangeStore, DocumentStore


def run(
    source: Source,
    doc_store: DocumentStore,
    change_store: ChangeStore,
    json_dir: Path,
    limit: int | None = None,
    mark_unlisted: bool = False,
    compare_versions: bool = True,
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

        _save(doc, doc_store, change_store, json_dir, compare_versions)
        docs.append(doc)

    # An empty listing means the page layout changed, not that every document is gone.
    if mark_unlisted and item_ids:
        _mark_unlisted(source, item_ids, doc_store, change_store, json_dir)
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


def _save(
    doc: LegalDocument,
    doc_store: DocumentStore,
    change_store: ChangeStore,
    json_dir: Path,
    compare_versions: bool,
) -> None:
    old = doc_store.get_document(doc.id)
    changes = versions.document_changes(old, doc) + versions.upcoming_changes(old, doc)
    if compare_versions:
        changes += versions.version_changes(old, doc)

    _store(doc, doc_store, json_dir)
    change_store.save_changes(changes)
    print(f"saved {doc.id}", file=sys.stderr)


def _mark_unlisted(
    source: Source,
    item_ids: list[str],
    doc_store: DocumentStore,
    change_store: ChangeStore,
    json_dir: Path,
) -> None:
    listed = set(item_ids)
    for summary in doc_store.list_documents():
        if summary.source != source.name or summary.id in listed or summary.repealed_on:
            continue

        doc = doc_store.get_document(summary.id)
        unlisted = doc.model_copy(
            update={"repealed_on": date.today(), "updated_at": datetime.now(UTC)}
        )
        _store(unlisted, doc_store, json_dir)
        change_store.save_changes(versions.document_changes(doc, unlisted))
        print(f"no longer listed {summary.id}", file=sys.stderr)


def _store(doc: LegalDocument, doc_store: DocumentStore, json_dir: Path) -> None:
    json_dir.mkdir(parents=True, exist_ok=True)
    (json_dir / f"{doc.id}.json").write_text(doc.model_dump_json(indent=2), encoding="utf-8")
    doc_store.save_documents([doc])
