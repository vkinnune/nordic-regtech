from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from regtech.citations.regex_extractor import RegexExtractor
from regtech.download.offline_downloader import OfflineDownloader
from regtech.linker import link
from regtech.models import Citation, CitationTarget, LegalDocument, LegalSection, Paragraph
from regtech.sources.riksdagen import RiksdagenSource
from regtech.storage.sqlite_storage import SqliteStorage
from regtech.versions import document_changes, upcoming_changes
from regtech.viewer.app import create_app

FIXTURES = Path(__file__).parent / "fixtures" / "riksdagen"
FFFS_PDF_PATH = "fi_fffs/fffs-2099-1/regulation.pdf"
FFFS = LegalDocument(
    id="fffs-2099-1",
    source="fi_fffs",
    document_type="foreskrift",
    identifier="FFFS 2099:1",
    title="Finansinspektionens föreskrifter om värdepappersmarknaden",
    source_url="https://www.fi.se/sv/vara-register/fffs/",
    pdf_url="https://www.fi.se/fs20991.pdf",
    memo_url="https://www.fi.se/beslutspm-20991.pdf",
    local_pdf_path=FFFS_PDF_PATH,
    local_memo_path="fi_fffs/fffs-2099-1/memo.pdf",
    authorizations=[
        Citation(
            raw_text="6 kap. 1 § förordningen (2007:572)",
            citation_type="external_ordinance",
            target_document="SFS 2007:572",
            targets=[CitationTarget(chapter="6", section="1")],
        )
    ],
    sections=[
        LegalSection(
            chunk_id="fi_fffs_fffs-2099-1_p1",
            section="1",
            paragraphs=[Paragraph(text="Ett företag ska ha rutiner.")],
            full_text="Ett företag ska ha rutiner.",
        ),
        LegalSection(
            chunk_id="fi_fffs_fffs-2099-1_b1",
            section=None,
            paragraphs=[Paragraph(text="Rutinerna bör ses över.", rule_type="guidance")],
            full_text="Rutinerna bör ses över.",
        ),
    ],
)


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    source = RiksdagenSource(
        ["2007:528", "2007:572"], OfflineDownloader(), FIXTURES, RegexExtractor()
    )
    storage = SqliteStorage(tmp_path_factory.mktemp("db") / "regtech.db")
    act = source.parse("sfs-2007-528")
    left_register = FFFS.model_copy(
        update={"id": "fffs-2099-2", "identifier": "FFFS 2099:2", "repealed_on": date(2026, 10, 10)}
    )
    storage.save_documents(
        [act, source.parse("sfs-2007-572"), source.parse("sfs-2018-1486"), FFFS, left_register]
    )
    storage.save_changes(document_changes(None, FFFS) + upcoming_changes(None, act))
    link(storage, storage)
    files_dir = tmp_path_factory.mktemp("raw")
    (files_dir / FFFS_PDF_PATH).parent.mkdir(parents=True)
    (files_dir / FFFS_PDF_PATH).write_bytes(b"%PDF-1.4 regulation")
    return TestClient(create_app(storage, storage, storage, files_dir))


def page(client, path, **params):
    response = client.get(path, params=params)
    assert response.status_code == 200
    return response.text


def test_index_lists_documents(client):
    html = page(client, "/")

    for doc_id in ["sfs-2007-528", "sfs-2007-572", "fffs-2099-1"]:
        assert f'href="/doc/{doc_id}"' in html


def test_repealed_documents_are_marked(client):
    index = page(client, "/")
    repealed = page(client, "/doc/sfs-2018-1486")
    left_register = page(client, "/doc/fffs-2099-2")

    assert "Repealed from 2027-01-01" in index
    assert "Not in the register since 2026-10-10" in index
    assert "from 2027-01-01</span> by SFS 2026:1769" in repealed
    assert "since 2026-10-10" in left_register
    assert "Repealed" not in page(client, "/doc/sfs-2007-528")


def test_citation_pills(client):
    html = page(client, "/doc/sfs-2007-572")

    assert 'href="/doc/sfs-2007-528#riksdagen_sfs-2007-528_k25_p4"' in html
    assert 'title="Not stored"' in html


def test_incoming_references(client):
    html = page(client, "/doc/sfs-2007-528")

    assert 'href="/doc/sfs-2007-572#riksdagen_sfs-2007-572_k5_p1"' in html
    assert "FFFS 2099:1 preamble" in html
    assert "via SFS 2007:572 6 kap. 1 §" in html


def test_search_marks_matches(client):
    assert "<mark>" in page(client, "/search", q="värdepappersmarknaden")


def test_search_api_returns_marked_snippets(client):
    response = client.get("/api/search", params={"q": "värdepappersmarknaden"})

    [hit, *_] = response.json()
    assert hit["href"].startswith("/doc/")
    assert "<mark>" in hit["snippet"]


def test_search_query_is_escaped(client):
    html = page(client, "/search", q="<script>alert(1)</script>")

    assert "<script>alert" not in html
    assert "&lt;script&gt;" in html


def test_unknown_document(client):
    assert client.get("/doc/sfs-1999-1").status_code == 404


def test_rule_badges_only_on_fffs(client):
    fffs_html = page(client, "/doc/fffs-2099-1")
    sfs_html = page(client, "/doc/sfs-2007-572")

    assert "Binding rule" in fffs_html
    assert "Allmänna råd · comply or explain" in fffs_html
    assert "None §" not in fffs_html
    assert "Binding rule" not in sfs_html
    assert "comply or explain" not in sfs_html


def test_saved_copy_opens_first_and_online_link_stays(client):
    html = page(client, "/doc/fffs-2099-1")

    assert html.index(f'href="/files/{FFFS_PDF_PATH}"') < html.index(
        'href="https://www.fi.se/fs20991.pdf"'
    )


def test_online_link_only_when_no_saved_copy(client):
    html = page(client, "/doc/fffs-2099-1")

    assert 'href="https://www.fi.se/beslutspm-20991.pdf"' in html
    assert 'href="/files/fi_fffs/fffs-2099-1/memo.pdf"' not in html


def test_saved_copy_is_served(client):
    response = client.get(f"/files/{FFFS_PDF_PATH}")

    assert response.status_code == 200
    assert response.content == b"%PDF-1.4 regulation"


def test_upcoming_wording_shows_its_change_and_diff(client):
    html = page(client, "/doc/sfs-2007-528")
    upcoming = html[html.index('id="riksdagen_sfs-2007-528_k7_p6_i20261205"') :]
    upcoming = upcoming[: upcoming.index("</section>")]

    assert "Modified by SFS 2026:784, in force 2026-12-05" in upcoming
    assert "<del>(2010:2075).</del>" in upcoming
    assert "<ins>(2026:784).</ins>" in upcoming


def feed(client, **params):
    response = client.get("/api/v1/feed", params=params)
    assert response.status_code == 200
    return response.json()


def test_feed_event_for_an_upcoming_wording(client):
    event = feed(client)["events"][1]

    assert (event["event_id"], event["level"], event["status"]) == (2, "section", "MODIFIED")
    assert (event["identifier"], event["chapter"], event["section"]) == ("SFS 2007:528", "7", "6")
    assert (event["upcoming"], event["amending_act"]) == (True, "SFS 2026:784")
    assert event["amended_date"] == "2026-12-05"
    assert event["new_text"].endswith("Lag (2026:784).")
    assert "ordinal" not in event
    assert event["urls"] == {
        "viewer": "http://testserver/doc/sfs-2007-528#riksdagen_sfs-2007-528_k7_p6_i20261205",
        "document_api": "http://testserver/api/v1/documents/sfs-2007-528",
        "file": None,
    }


def test_feed_event_for_a_new_document(client):
    event = feed(client)["events"][0]

    assert (event["level"], event["status"], event["document_id"]) == ("document", "ADDED", FFFS.id)
    assert event["urls"]["viewer"] == f"http://testserver/doc/{FFFS.id}"
    assert event["urls"]["file"] == f"http://testserver/files/{FFFS_PDF_PATH}"


def test_feed_pages_after_the_last_event(client):
    first = feed(client, limit=1)
    second = feed(client, limit=1, after=first["next_after"])
    everything = feed(client, limit=500)
    end = feed(client, after=everything["next_after"])

    assert [e["event_id"] for e in first["events"]] == [1]
    assert [e["event_id"] for e in second["events"]] == [2]
    assert end == {"events": [], "next_after": everything["next_after"]}


def test_feed_limit_is_capped(client):
    assert client.get("/api/v1/feed?limit=501").status_code == 422


def test_document_api_returns_the_stored_document(client):
    response = client.get(f"/api/v1/documents/{FFFS.id}")

    assert response.status_code == 200
    assert response.json() == FFFS.model_dump(mode="json")
    assert client.get("/api/v1/documents/sfs-1999-1").status_code == 404


def test_changes_page_lists_events_newest_first(client):
    html = page(client, "/changes")

    assert html.index("SFS 2007:528") < html.index("FFFS 2099:1")
    assert "Whole document" in html
    assert "7 kap. 6 § (upcoming wording)" in html
    assert "Modified by SFS 2026:784, in force 2026-12-05" in html
    assert f'href="/files/{FFFS_PDF_PATH}"' in html


def test_changes_page_filters(client):
    fffs_only = page(client, "/changes", source="fi_fffs")
    sfs_added = page(client, "/changes", source="riksdagen", status="ADDED")
    before_second = page(client, "/changes", before=2)

    assert "FFFS 2099:1" in fffs_only and "7 kap. 6 §" not in fffs_only
    assert "Whole document" not in sfs_added
    assert "Whole document" in before_second and "7 kap. 6 §" not in before_second
