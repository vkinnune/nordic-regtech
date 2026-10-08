from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from regtech.citations.regex_extractor import RegexExtractor
from regtech.download.offline_downloader import OfflineDownloader
from regtech.linker import link
from regtech.models import Citation, CitationTarget, LegalDocument, LegalSection, Paragraph
from regtech.sources.riksdagen import RiksdagenSource
from regtech.storage.sqlite_storage import SqliteStorage
from regtech.viewer.app import create_app

FIXTURES = Path(__file__).parent / "fixtures" / "riksdagen"
FFFS = LegalDocument(
    id="fffs-2099-1",
    source="fi_fffs",
    document_type="foreskrift",
    identifier="FFFS 2099:1",
    title="Finansinspektionens föreskrifter om värdepappersmarknaden",
    source_url="https://www.fi.se/sv/vara-register/fffs/",
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
    storage.save_documents([source.parse("sfs-2007-528"), source.parse("sfs-2007-572"), FFFS])
    link(storage, storage)
    return TestClient(create_app(storage, storage))


def page(client, path, **params):
    response = client.get(path, params=params)
    assert response.status_code == 200
    return response.text


def test_index_lists_documents(client):
    html = page(client, "/")

    for doc_id in ["sfs-2007-528", "sfs-2007-572", "fffs-2099-1"]:
        assert f'href="/doc/{doc_id}"' in html


def test_citation_pills(client):
    html = page(client, "/doc/sfs-2007-572")

    assert 'href="/doc/sfs-2007-528#riksdagen_sfs-2007-528_k25_p4"' in html
    assert 'title="Not stored"' in html


def test_incoming_references(client):
    html = page(client, "/doc/sfs-2007-528")

    assert 'href="/doc/sfs-2007-572#riksdagen_sfs-2007-572_k5_p1"' in html
    assert 'href="/doc/fffs-2099-1"' in html
    assert "via SFS 2007:572 6 kap. 1 §" in html


def test_search_marks_matches(client):
    assert "<mark>" in page(client, "/search", q="värdepappersmarknaden")


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
