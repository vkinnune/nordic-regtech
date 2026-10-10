import sqlite3
from contextlib import closing
from datetime import date

import pytest

from regtech.models import (
    SNIPPET_MATCH_END,
    SNIPPET_MATCH_START,
    Change,
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
NOW = "2026-10-10T10:00:00Z"
VERSION_3_CHANGES = """
DROP TABLE changes;
CREATE TABLE section_changes (document_id TEXT NOT NULL, chapter TEXT, section TEXT,
                              upcoming INTEGER NOT NULL, ordinal INTEGER NOT NULL,
                              status TEXT NOT NULL, old_text TEXT, new_text TEXT,
                              amending_act TEXT, amended_date TEXT, fetched_at TEXT NOT NULL);
PRAGMA user_version = 3;
"""


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
        document_type="foreskrift",
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


def change(status="MODIFIED", doc_id=ACT.id, fetched_at=NOW):
    return Change(
        document_id=doc_id,
        chapter="1",
        section="2",
        upcoming=True,
        ordinal=0,
        status=status,
        old_text="Gammal.",
        new_text="Ny.",
        amending_act="SFS 2026:784",
        amended_date="2026-12-05",
        fetched_at=fetched_at,
    )


def test_save_and_read_changes_in_order(storage):
    storage.save_changes([change("ADDED")])
    storage.save_changes([change("MODIFIED")])

    assert storage.changes(ACT.id) == [change("ADDED"), change("MODIFIED")]
    assert storage.changes(ORDINANCE.id) == []


def test_document_changes_are_not_section_changes(storage):
    added = Change(document_id=ACT.id, level="document", status="ADDED", fetched_at=NOW)
    storage.save_changes([added, change()])

    assert storage.changes(ACT.id) == [change()]


def test_feed_is_oldest_first_after_an_event(storage):
    storage.save_changes([change("ADDED"), change("MODIFIED", ORDINANCE.id), change("REPEALED")])

    first, second, third = storage.feed(after=0, since=None, limit=10)

    assert (first.event_id, first.status, first.identifier) == (1, "ADDED", ACT.identifier)
    assert (second.source, second.title) == ("riksdagen", ORDINANCE.title)
    assert [e.event_id for e in storage.feed(after=1, since=None, limit=1)] == [2]
    assert storage.feed(after=3, since=None, limit=10) == []


def test_feed_since_a_day(storage):
    storage.save_changes(
        [change(fetched_at="2026-10-09T23:59:00Z"), change(fetched_at="2026-10-10T00:01:00Z")]
    )

    assert [e.event_id for e in storage.feed(after=0, since=date(2026, 10, 10), limit=10)] == [2]


def test_recent_changes_newest_first_with_filters(storage):
    fffs = document("fffs-2017-11", "FFFS 2017:11", "Föreskrifter", source="fi_fffs")
    storage.save_documents([fffs])
    storage.save_changes([change("ADDED"), change("MODIFIED", fffs.id), change("MODIFIED")])

    def ids(**filters):
        query = {"before": None, "source": None, "status": None, **filters}
        return [e.event_id for e in storage.recent_changes(**query, limit=10)]

    assert ids() == [3, 2, 1]
    assert ids(before=3) == [2, 1]
    assert ids(source="fi_fffs") == [2]
    assert ids(status="MODIFIED", source="riksdagen") == [3]


def test_version_3_database_keeps_its_changes_as_numbered_events(tmp_path):
    db_path = tmp_path / "regtech.db"
    SqliteStorage(db_path).save_documents([ACT])
    with closing(sqlite3.connect(db_path)) as db:
        db.executescript(VERSION_3_CHANGES)
        db.execute(
            "INSERT INTO section_changes VALUES"
            " (?, '1', '2', 1, 0, 'MODIFIED', 'Gammal.', 'Ny.', 'SFS 2026:784', '2026-12-05', ?)",
            (ACT.id, NOW),
        )
        db.commit()

    storage = SqliteStorage(db_path)
    storage.save_changes([change("ADDED")])

    assert storage.changes(ACT.id) == [change("MODIFIED"), change("ADDED")]
    assert [e.event_id for e in storage.feed(after=0, since=None, limit=10)] == [1, 2]
    assert SqliteStorage(db_path).changes(ACT.id) == [change("MODIFIED"), change("ADDED")]


def test_older_database_is_refused(tmp_path):
    db_path = tmp_path / "regtech.db"
    with closing(sqlite3.connect(db_path)) as db:
        db.execute("CREATE TABLE documents (id TEXT PRIMARY KEY, json TEXT NOT NULL)")

    with pytest.raises(RuntimeError, match="older version"):
        SqliteStorage(db_path)
