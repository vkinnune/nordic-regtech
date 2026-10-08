from pathlib import Path

import pytest

from regtech.citations.regex_extractor import RegexExtractor
from regtech.download.offline_downloader import OfflineDownloader
from regtech.linker import link
from regtech.models import Citation, CitationTarget, LegalDocument
from regtech.sources.riksdagen import RiksdagenSource
from regtech.storage.sqlite_storage import SqliteStorage

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
)


@pytest.fixture(scope="module")
def linked(tmp_path_factory):
    source = RiksdagenSource(
        ["2007:528", "2007:572"], OfflineDownloader(), FIXTURES, RegexExtractor()
    )
    storage = SqliteStorage(tmp_path_factory.mktemp("db") / "regtech.db")
    storage.save_documents([source.parse("sfs-2007-528"), source.parse("sfs-2007-572"), FFFS])

    link_count, missing = link(storage, storage)
    return storage, link_count, missing


def targets_of(links, chunk_id):
    return {link.target_chunk_id for link in links if link.chunk_id == chunk_id}


def test_citation_to_other_law(linked):
    storage, _, _ = linked
    outgoing, _ = storage.links("sfs-2007-572")

    assert targets_of(outgoing, "riksdagen_sfs-2007-572_k5_p1") == {"riksdagen_sfs-2007-528_k25_p4"}


def test_internal_citation(linked):
    storage, _, _ = linked
    outgoing, _ = storage.links("sfs-2007-572")

    assert {"riksdagen_sfs-2007-572_k4_p2", "riksdagen_sfs-2007-572_k4_p3"} <= targets_of(
        outgoing, "riksdagen_sfs-2007-572_k4_p1"
    )


def test_upcoming_wording_is_a_target_only_without_a_current_wording(linked):
    storage, _, _ = linked
    outgoing, _ = storage.links("sfs-2007-528")
    all_targets = {link.target_chunk_id for link in outgoing}

    assert "riksdagen_sfs-2007-528_k7_p6" in targets_of(outgoing, "riksdagen_sfs-2007-528_k7_p1")
    assert "riksdagen_sfs-2007-528_k7_p6_i20261205" not in all_targets
    assert targets_of(outgoing, "riksdagen_sfs-2007-528_k11_p2b_i20261205") == {
        "riksdagen_sfs-2007-528_k13_p2b_i20261205",
        "riksdagen_sfs-2007-528_k13_p4",
    }


def test_missing_statutes_are_counted(linked):
    _, _, missing = linked

    assert missing["SFS 2005:551"] > 0
    assert "SFS 2007:528" not in missing


def test_preamble_and_chain_through_bemyndigande(linked):
    storage, _, _ = linked
    fffs_outgoing, _ = storage.links(FFFS.id)
    _, act_incoming = storage.links("sfs-2007-528")

    assert [(link.chunk_id, link.citing_label, link.target_chunk_id) for link in fffs_outgoing] == [
        (None, "FFFS 2099:1 preamble", "riksdagen_sfs-2007-572_k6_p1")
    ]
    chained = [link for link in act_incoming if link.document_id == FFFS.id]
    assert {link.via_label for link in chained} == {"SFS 2007:572 6 kap. 1 §"}
    assert "riksdagen_sfs-2007-528_k1_p4b" in {link.target_chunk_id for link in chained}


def test_linking_again_replaces_links(linked):
    storage, link_count, _ = linked

    assert link(storage, storage)[0] == link_count
    stored = sum(len(storage.links(s.id)[0]) for s in storage.list_documents())
    assert stored == link_count
