from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from regtech.diff import align_sections, render_diff_html
from regtech.models import LegalDocument, LegalSection, Paragraph
from regtech.storage.sqlite_storage import SqliteStorage
from regtech.viewer.app import create_app


def test_word_level_insertions_and_deletions():
    # Insertion
    base_text = "Ett företag ska ha god intern kontroll."
    new_text = "Ett företag ska ha effektiv och god intern kontroll."
    diff = render_diff_html(base_text, new_text)

    assert '<ins class="diff-ins bg-green-100 text-green-800 font-semibold no-underline px-0.5 rounded">effektiv och</ins>' in diff
    assert "<del" not in diff
    assert "god intern kontroll." in diff

    # Deletion
    base_del = "Styrelsen ska alltid sammanträda varje månad."
    new_del = "Styrelsen ska sammanträda varje månad."
    diff_del = render_diff_html(base_del, new_del)

    assert '<del class="diff-del bg-red-100 text-red-800 line-through px-0.5 rounded">alltid</del>' in diff_del
    assert "<ins" not in diff_del
    assert "sammanträda varje månad." in diff_del


def test_paragraph_replacement():
    old_p = (
        "Första stycket i bestämmelsen.\n\n"
        "Andra stycket med gamla regler som ska bytas ut."
    )
    new_p = (
        "Första stycket i bestämmelsen.\n\n"
        "Andra stycket med nya moderniserade regler."
    )
    diff = render_diff_html(old_p, new_p)

    assert "Första stycket i bestämmelsen." in diff
    assert "<del" in diff
    assert "<ins" in diff
    assert "gamla regler som ska bytas ut" in diff
    assert "nya moderniserade regler" in diff


def test_zero_change_comparison():
    text = "Kreditinstitutet ska uppfylla de särskilda kapitalkraven i enlighet med 2 kap. 1 §."
    diff = render_diff_html(text, text)

    assert diff == text
    assert "<ins" not in diff
    assert "<del" not in diff


def test_section_alignment_with_added_and_repealed():
    base_doc = LegalDocument(
        id="base-1",
        source="fi_fffs",
        document_type="foreskrift",
        identifier="FFFS 2020:1",
        title="Grundföreskrifter",
        source_url="https://www.fi.se/fffs20201",
        sections=[
            LegalSection(
                chunk_id="c1",
                chapter="1",
                section="1",
                full_text="1 § Grundtext ett.",
                paragraphs=[Paragraph(text="1 § Grundtext ett.")],
            ),
            LegalSection(
                chunk_id="c2",
                chapter="1",
                section="2",
                full_text="2 § Grundtext två.",
                paragraphs=[Paragraph(text="2 § Grundtext två.")],
            ),
            LegalSection(
                chunk_id="c3",
                chapter="1",
                section="3",
                full_text="3 § Grundtext tre.",
                paragraphs=[Paragraph(text="3 § Grundtext tre.")],
            ),
        ],
    )

    amendment_doc = LegalDocument(
        id="amend-1",
        source="fi_fffs",
        document_type="foreskrift",
        identifier="FFFS 2024:5",
        title="Ändringsföreskrifter",
        source_url="https://www.fi.se/fffs20245",
        amends="FFFS 2020:1",
        sections=[
            # 1 kap. 1 §: Modified
            LegalSection(
                chunk_id="a1",
                chapter="1",
                section="1",
                full_text="1 § Ändrad grundtext ett med tillägg.",
                paragraphs=[Paragraph(text="1 § Ändrad grundtext ett med tillägg.")],
            ),
            # 1 kap. 3 §: Repealed
            LegalSection(
                chunk_id="a3",
                chapter="1",
                section="3",
                full_text="Har upphävts genom FFFS 2024:5.",
                paragraphs=[Paragraph(text="Har upphävts genom FFFS 2024:5.")],
            ),
            # 1 kap. 4 §: Brand new added section
            LegalSection(
                chunk_id="a4",
                chapter="1",
                section="4",
                full_text="4 § Helt ny bestämmelse.",
                paragraphs=[Paragraph(text="4 § Helt ny bestämmelse.")],
            ),
        ],
    )

    diffs, summary = align_sections(base_doc, amendment_doc)

    assert summary.total == 3
    assert summary.modified == 1
    assert summary.repealed == 1
    assert summary.added == 1
    assert summary.unchanged == 0

    assert diffs[0].section == "1"
    assert diffs[0].status == "MODIFIED"
    assert "<ins" in diffs[0].diff_html

    assert diffs[1].section == "3"
    assert diffs[1].status == "REPEALED"
    assert "<del" in diffs[1].diff_html

    assert diffs[2].section == "4"
    assert diffs[2].status == "ADDED"
    assert "<ins" in diffs[2].diff_html


@pytest.fixture
def diff_client(tmp_path):
    storage = SqliteStorage(tmp_path / "regtech.db")
    files_dir = tmp_path / "files"
    files_dir.mkdir(parents=True)

    base = LegalDocument(
        id="fffs-2020-1",
        source="fi_fffs",
        document_type="foreskrift",
        identifier="FFFS 2020:1",
        title="Grundföreskrifter om riskhantering",
        source_url="https://www.fi.se/fffs20201",
        sections=[
            LegalSection(
                chunk_id="s1",
                chapter="1",
                section="1",
                full_text="Ett institut ska ha en funktion för riskkontroll.",
                paragraphs=[Paragraph(text="Ett institut ska ha en funktion för riskkontroll.")],
            )
        ],
    )
    amend = LegalDocument(
        id="fffs-2024-10",
        source="fi_fffs",
        document_type="foreskrift",
        identifier="FFFS 2024:10",
        title="Föreskrifter om ändring i FFFS 2020:1",
        source_url="https://www.fi.se/fffs202410",
        amends="FFFS 2020:1",
        sections=[
            LegalSection(
                chunk_id="a1",
                chapter="1",
                section="1",
                full_text="Ett institut ska ha en oberoende funktion för riskkontroll.",
                paragraphs=[Paragraph(text="Ett institut ska ha en oberoende funktion för riskkontroll.")],
            )
        ],
    )

    storage.save_documents([base, amend])

    app = create_app(storage, storage, storage, files_dir)
    return TestClient(app)


def test_endpoint_routing_diff_and_pdf(diff_client):
    # Test valid diff endpoint
    res = diff_client.get("/doc/fffs-2020-1/diff/fffs-2024-10")
    assert res.status_code == 200
    assert "text/html" in res.headers["content-type"]
    assert "FFFS 2024:10" in res.text
    assert "FFFS 2020:1" in res.text
    assert "oberoende" in res.text
    assert "diff-ins" in res.text
    assert "Unified Diff" in res.text
    assert "Split View" in res.text

    # Test 404 on missing base doc
    res_no_base = diff_client.get("/doc/nonexistent-base/diff/fffs-2024-10")
    assert res_no_base.status_code == 404

    # Test 404 on missing amendment doc
    res_no_amend = diff_client.get("/doc/fffs-2020-1/diff/nonexistent-amend")
    assert res_no_amend.status_code == 404

    # Test PDF endpoint 404 when no file on disk
    res_pdf = diff_client.get("/doc/fffs-2020-1/pdf")
    assert res_pdf.status_code == 404
