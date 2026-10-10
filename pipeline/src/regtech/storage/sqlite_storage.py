import re
import sqlite3
from contextlib import closing
from datetime import date
from pathlib import Path

from regtech.models import (
    SNIPPET_MATCH_END,
    SNIPPET_MATCH_START,
    Change,
    DocumentSummary,
    FeedEvent,
    LegalDocument,
    Link,
    SearchHit,
)

SCHEMA_VERSION = 4
SNIPPET_WORDS = 16
SEARCH_WORD_RE = re.compile(r"\w+\*?")

CHANGES_TABLE = """
CREATE TABLE changes (
    id INTEGER PRIMARY KEY,
    document_id TEXT NOT NULL,
    level TEXT NOT NULL,
    chapter TEXT,
    section TEXT,
    upcoming INTEGER NOT NULL,
    ordinal INTEGER NOT NULL,
    status TEXT NOT NULL,
    old_text TEXT,
    new_text TEXT,
    amending_act TEXT,
    amended_date TEXT,
    fetched_at TEXT NOT NULL
);
CREATE INDEX changes_by_document ON changes (document_id);
"""

# Version 3 rows keep their row numbers as ids, so the feed's event ids never change.
MIGRATION_FROM_3 = f"""
{CHANGES_TABLE}
INSERT INTO changes (id, document_id, level, chapter, section, upcoming, ordinal, status,
                     old_text, new_text, amending_act, amended_date, fetched_at)
SELECT rowid, document_id, 'section', chapter, section, upcoming, ordinal, status,
       old_text, new_text, amending_act, amended_date, fetched_at
FROM section_changes;
DROP TABLE section_changes;
"""

SCHEMA = f"""
CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    identifier TEXT NOT NULL,
    title TEXT NOT NULL,
    amends TEXT,
    json TEXT NOT NULL
);
CREATE TABLE citations (
    document_id TEXT NOT NULL,
    chunk_id TEXT,
    citing_label TEXT NOT NULL,
    citing_is_bemyndigande INTEGER NOT NULL,
    citation_index INTEGER NOT NULL,
    raw_text TEXT NOT NULL,
    target_document_id TEXT NOT NULL,
    target_chapter TEXT,
    target_chunk_id TEXT
);
CREATE INDEX citations_by_document ON citations (document_id);
CREATE INDEX citations_by_target_document ON citations (target_document_id);
CREATE INDEX citations_by_target_chunk ON citations (target_chunk_id);
{CHANGES_TABLE}
CREATE VIRTUAL TABLE search_index USING fts5(
    document_id UNINDEXED, chunk_id UNINDEXED, label UNINDEXED, title, heading, text
);
"""

CHAINED_LINKS_SQL = """
SELECT outer_link.document_id, outer_link.chunk_id, outer_link.citing_label,
       outer_link.citing_is_bemyndigande, outer_link.citation_index, outer_link.raw_text,
       inner_link.target_document_id, inner_link.target_chapter, inner_link.target_chunk_id,
       inner_link.citing_label AS via_label
FROM citations AS inner_link
JOIN citations AS outer_link ON outer_link.target_chunk_id = inner_link.chunk_id
WHERE inner_link.target_document_id = ? AND inner_link.citing_is_bemyndigande = 1
"""

FEED_SQL = """
SELECT changes.*, changes.id AS event_id, documents.source, documents.identifier, documents.title
FROM changes JOIN documents ON documents.id = changes.document_id
"""


class SqliteStorage:
    def __init__(self, db_path: Path):
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._db_path = db_path
        with self._connect() as db:
            version = db.execute("PRAGMA user_version").fetchone()[0]
            has_tables = db.execute("SELECT count(*) FROM sqlite_master").fetchone()[0]
            if not has_tables:
                db.executescript(SCHEMA + f"PRAGMA user_version = {SCHEMA_VERSION};")
            elif version == 2:
                db.executescript(
                    f"BEGIN; {CHANGES_TABLE} PRAGMA user_version = {SCHEMA_VERSION}; COMMIT;"
                )
            elif version == 3:
                db.executescript(
                    f"BEGIN; {MIGRATION_FROM_3} PRAGMA user_version = {SCHEMA_VERSION}; COMMIT;"
                )
            elif version != SCHEMA_VERSION:
                raise RuntimeError(
                    f"{db_path} was made by an older version of regtech. Delete it and run "
                    "regtech fetch sfs / fffs again with --offline to rebuild it from data/raw."
                )

    def save_documents(self, docs: list[LegalDocument]) -> None:
        with self._connect() as db, db:
            for doc in docs:
                db.execute(
                    "INSERT OR REPLACE INTO documents (id, source, identifier, title, amends, json)"
                    " VALUES (?, ?, ?, ?, ?, ?)",
                    (doc.id, doc.source, doc.identifier, doc.title, doc.amends,
                     doc.model_dump_json()),
                )  # fmt: skip
                db.execute("DELETE FROM citations WHERE document_id = ?", (doc.id,))
                db.execute("DELETE FROM search_index WHERE document_id = ?", (doc.id,))
                db.execute(
                    "INSERT INTO search_index (document_id, label, title) VALUES (?, ?, ?)",
                    (doc.id, doc.identifier, doc.title),
                )
                db.executemany(
                    "INSERT INTO search_index (document_id, chunk_id, label, heading, text)"
                    " VALUES (?, ?, ?, ?, ?)",
                    [
                        (
                            doc.id,
                            section.chunk_id,
                            section.label(doc.identifier),
                            section.heading,
                            section.full_text,
                        )
                        for section in doc.sections
                    ],
                )

    def get_document(self, doc_id: str) -> LegalDocument | None:
        with self._connect() as db:
            row = db.execute("SELECT json FROM documents WHERE id = ?", (doc_id,)).fetchone()
        return LegalDocument.model_validate_json(row["json"]) if row else None

    def list_documents(self) -> list[DocumentSummary]:
        with self._connect() as db:
            # Year, then number length, so FFFS 2014:2 comes before FFFS 2014:10.
            rows = db.execute(
                "SELECT id, source, identifier, title, amends,"
                " json_extract(json, '$.document_type') AS document_type,"
                " json_extract(json, '$.effective_date') AS effective_date,"
                " json_extract(json, '$.latest_amendment') AS latest_amendment,"
                " json_extract(json, '$.repealed_on') AS repealed_on,"
                " json_extract(json, '$.repealed_by') AS repealed_by FROM documents"
                " ORDER BY source DESC, substr(identifier, 1, instr(identifier, ':')),"
                " length(identifier), identifier"
            ).fetchall()
        return [DocumentSummary(**row) for row in rows]

    def save_links(self, links: list[Link]) -> None:
        with self._connect() as db, db:
            db.execute("DELETE FROM citations")
            db.executemany(
                "INSERT INTO citations (document_id, chunk_id, citing_label,"
                " citing_is_bemyndigande, citation_index, raw_text, target_document_id,"
                " target_chapter, target_chunk_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    (link.document_id, link.chunk_id, link.citing_label,
                     link.citing_is_bemyndigande, link.citation_index, link.raw_text,
                     link.target_document_id, link.target_chapter, link.target_chunk_id)
                    for link in links
                ],
            )  # fmt: skip

    def links(self, doc_id: str) -> tuple[list[Link], list[Link]]:
        with self._connect() as db:
            outgoing = db.execute("SELECT * FROM citations WHERE document_id = ?", (doc_id,))
            outgoing_links = [Link(**row) for row in outgoing]
            incoming = db.execute("SELECT * FROM citations WHERE target_document_id = ?", (doc_id,))
            incoming_links = [Link(**row) for row in incoming]
            chained = db.execute(CHAINED_LINKS_SQL, (doc_id,))
            incoming_links += [Link(**row) for row in chained]
        return outgoing_links, incoming_links

    def save_changes(self, changes: list[Change]) -> None:
        with self._connect() as db, db:
            db.executemany(
                "INSERT INTO changes (document_id, level, chapter, section, upcoming, ordinal,"
                " status, old_text, new_text, amending_act, amended_date, fetched_at) VALUES"
                " (:document_id, :level, :chapter, :section, :upcoming, :ordinal, :status,"
                " :old_text, :new_text, :amending_act, :amended_date, :fetched_at)",
                [change.model_dump(mode="json") for change in changes],
            )

    def changes(self, doc_id: str) -> list[Change]:
        with self._connect() as db:
            rows = db.execute(
                "SELECT * FROM changes WHERE document_id = ? AND level = 'section' ORDER BY id",
                (doc_id,),
            ).fetchall()
        return [Change(**row) for row in rows]

    def feed(self, after: int, since: date | None, limit: int) -> list[FeedEvent]:
        with self._connect() as db:
            rows = db.execute(
                f"{FEED_SQL} WHERE changes.id > ? AND changes.fetched_at >= ?"
                " ORDER BY changes.id LIMIT ?",
                (after, since.isoformat() if since else "", limit),
            ).fetchall()
        return [FeedEvent(**row) for row in rows]

    def recent_changes(
        self, before: int | None, source: str | None, status: str | None, limit: int
    ) -> list[FeedEvent]:
        with self._connect() as db:
            rows = db.execute(
                f"{FEED_SQL} WHERE (:before IS NULL OR changes.id < :before)"
                " AND (:source IS NULL OR documents.source = :source)"
                " AND (:status IS NULL OR changes.status = :status)"
                " ORDER BY changes.id DESC LIMIT :limit",
                {"before": before, "source": source, "status": status, "limit": limit},
            ).fetchall()
        return [FeedEvent(**row) for row in rows]

    def search(self, query: str, limit: int) -> list[SearchHit]:
        words = SEARCH_WORD_RE.findall(query)
        if not words:
            return []
        fts_query = " ".join(
            f'"{word[:-1]}"*' if word.endswith("*") else f'"{word}"' for word in words
        )

        with self._connect() as db:
            rows = db.execute(
                "SELECT document_id, chunk_id, label,"
                f" snippet(search_index, -1, ?, ?, '…', {SNIPPET_WORDS}) AS snippet"
                " FROM search_index WHERE search_index MATCH ? ORDER BY rank LIMIT ?",
                (SNIPPET_MATCH_START, SNIPPET_MATCH_END, fts_query, limit),
            ).fetchall()
        return [SearchHit(**row) for row in rows]

    def _connect(self) -> closing[sqlite3.Connection]:
        db = sqlite3.connect(self._db_path)
        db.row_factory = sqlite3.Row
        return closing(db)
