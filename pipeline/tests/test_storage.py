import sqlite3
from contextlib import closing

import pytest

from regtech.models import (
    SNIPPET_MATCH_END,
    SNIPPET_MATCH_START,
    DocumentSummary,
    LegalDocument,
    LegalSection,
    Link,
    Paragraph,
)
from regtech.storage.sqlite_storage import SqliteStorage


def section(chunk_id, number, text, heading=None):
    return LegalSection(
        chunk_id=chunk_id,
        chapter="1",
        heading=heading,
        section=number,
        paragraphs=[Paragraph(text=text)],
        full_text=text,
    )


def document(doc_id, identifier, title, sections=(), source="riksdagen", amends=None):
    return LegalDocument(
        id=doc_id,
        source=source,
        document_type="lag" if source == "riksdagen" else "foreskrift",
        identifier=identifier,
        title=title,
        amends=amends,
        source_url=f"https://example.org/{doc_id}",
        sections=list(sections),
    )


ACT = document(
    "sfs-2017-630",
    "SFS 2017:630",
    "Lag (2017:630) om åtgärder mot penningtvätt",
    [
        section("riksdagen_sfs-2017-630_k1_p1", "1", "Penningtvätt ska förhindras."),
        section("riksdagen_sfs-2017-630_k1_p2", "2", "Pengar som tvättas.", "Definitioner"),
    ],
)
ORDINANCE = document("sfs-2017-1039", "SFS 2017:1039", "Förordning (2017:1039)")


@pytest.fixture
def storage(tmp_path):
    storage = SqliteStorage(tmp_path / "regtech.db")
    storage.save_documents([ACT, ORDINANCE])
    return storage


def found(hits):
    return [(hit.document_id, hit.chunk_id, hit.label) for hit in hits]


def test_save_and_get(storage):
    assert storage.get_document(ACT.id) == ACT
    assert storage.get_document("sfs-1999-1") is None


def test_list_documents_sfs_first_then_by_number(storage):
    storage.save_documents(
        [
            document(
                "fffs-2014-10", "FFFS 2014:10", "Ändring", source="fi_fffs", amends="FFFS 2014:1"
            ),
            document("fffs-2014-2", "FFFS 2014:2", "Föreskrifter", source="fi_fffs"),
        ]
    )

    summaries = storage.list_documents()

    assert [s.identifier for s in summaries] == [
        "SFS 2017:630",
        "SFS 2017:1039",
        "FFFS 2014:2",
        "FFFS 2014:10",
    ]
    assert summaries[-1] == DocumentSummary(
        id="fffs-2014-10",
        source="fi_fffs",
        identifier="FFFS 2014:10",
        title="Ändring",
        amends="FFFS 2014:1",
    )


def test_search_section_text(storage):
    [hit] = storage.search("förhindras", 10)

    assert found([hit]) == [(ACT.id, "riksdagen_sfs-2017-630_k1_p1", "SFS 2017:630 1 kap. 1 §")]
    assert f"{SNIPPET_MATCH_START}förhindras{SNIPPET_MATCH_END}" in hit.snippet


def test_search_title_and_heading(storage):
    assert found(storage.search("åtgärder", 10)) == [(ACT.id, None, "SFS 2017:630")]
    assert found(storage.search("definitioner", 10)) == [
        (ACT.id, "riksdagen_sfs-2017-630_k1_p2", "SFS 2017:630 1 kap. 2 §")
    ]


def test_search_whole_words_unless_star(storage):
    assert storage.search("tvätt", 10) == []
    assert [hit.chunk_id for hit in storage.search("tvätt*", 10)] == [
        "riksdagen_sfs-2017-630_k1_p2"
    ]
    assert len(storage.search("penningtvatt", 10)) == 2


@pytest.mark.parametrize("query", ['")(', "", "*", "AND", 'NEAR("x"', "title:x"])
def test_search_odd_input(storage, query):
    assert storage.search(query, 10) == []


def test_saving_again_drops_old_citations_and_search_rows(storage):
    link = Link(
        document_id=ACT.id,
        chunk_id="riksdagen_sfs-2017-630_k1_p1",
        citing_label="SFS 2017:630 1 kap. 1 §",
        citing_is_bemyndigande=False,
        citation_index=0,
        raw_text="förordningen (2017:1039)",
        target_document_id=ORDINANCE.id,
    )
    storage.save_links([link])
    assert storage.links(ACT.id) == ([link], [])
    assert storage.links(ORDINANCE.id) == ([], [link])

    storage.save_documents([ACT])

    assert storage.links(ORDINANCE.id) == ([], [])
    assert len(storage.search("åtgärder", 10)) == 1


def test_delete_document_drops_its_rows_and_links(storage):
    link = Link(
        document_id=ORDINANCE.id,
        chunk_id=None,
        citing_label="SFS 2017:1039",
        citing_is_bemyndigande=False,
        citation_index=0,
        raw_text="lagen (2017:630)",
        target_document_id=ACT.id,
    )
    storage.save_links([link])

    storage.delete_document(ACT.id)

    assert storage.get_document(ACT.id) is None
    assert [summary.id for summary in storage.list_documents()] == [ORDINANCE.id]
    assert storage.search("förhindras", 10) == []
    assert storage.links(ORDINANCE.id) == ([], [])


def test_older_database_is_refused(tmp_path):
    db_path = tmp_path / "regtech.db"
    with closing(sqlite3.connect(db_path)) as db:
        db.execute("CREATE TABLE documents (id TEXT PRIMARY KEY, json TEXT NOT NULL)")

    with pytest.raises(RuntimeError, match="older version"):
        SqliteStorage(db_path)
