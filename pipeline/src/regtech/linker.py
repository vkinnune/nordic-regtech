from collections import Counter

from regtech.models import Citation, LegalDocument, Link
from regtech.storage.base import DocumentStore, LinkStore


def link(doc_store: DocumentStore, link_store: LinkStore) -> tuple[int, Counter[str]]:
    docs = [doc_store.get_document(summary.id) for summary in doc_store.list_documents()]
    resolver = _Resolver(docs)

    links: list[Link] = []
    for doc in docs:
        for section in doc.sections:
            links += resolver.resolve(
                doc.id, section.chunk_id, section.label(doc.identifier),
                section.is_bemyndigande, section.citations,
            )  # fmt: skip
        links += resolver.resolve(
            doc.id, None, f"{doc.identifier} preamble", False, doc.authorizations
        )

    link_store.save_links(links)
    return len(links), resolver.missing


class _Resolver:
    def __init__(self, docs: list[LegalDocument]):
        self.missing: Counter[str] = Counter()
        self._doc_ids = {doc.identifier: doc.id for doc in docs}
        self._chunk_ids: dict[tuple[str, str | None, str], str] = {}
        for doc in docs:
            # Current wordings first, so an upcoming wording is kept only where no current one is.
            for section in sorted(doc.sections, key=lambda section: section.upcoming):
                key = (doc.identifier, section.chapter, section.section)
                self._chunk_ids.setdefault(key, section.chunk_id)

    def resolve(
        self,
        doc_id: str,
        chunk_id: str | None,
        label: str,
        is_bemyndigande: bool,
        citations: list[Citation],
    ) -> list[Link]:
        links = []
        for index, citation in enumerate(citations):
            if citation.target_document is None:
                continue
            target_doc_id = self._doc_ids.get(citation.target_document)
            if target_doc_id is None:
                self.missing[citation.target_document] += 1
                continue

            for target in citation.targets or [None]:
                target_chunk_id = None
                if target and target.section:
                    key = (citation.target_document, target.chapter, target.section)
                    target_chunk_id = self._chunk_ids.get(key)
                links.append(
                    Link(
                        document_id=doc_id,
                        chunk_id=chunk_id,
                        citing_label=label,
                        citing_is_bemyndigande=is_bemyndigande,
                        citation_index=index,
                        raw_text=citation.raw_text,
                        target_document_id=target_doc_id,
                        target_chapter=target.chapter if target else None,
                        target_chunk_id=target_chunk_id,
                    )
                )
        return links
