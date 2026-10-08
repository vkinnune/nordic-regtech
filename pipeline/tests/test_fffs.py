import shutil
from dataclasses import replace
from datetime import date
from pathlib import Path

import pytest

from regtech.citations.regex_extractor import RegexExtractor
from regtech.download.offline_downloader import OfflineDownloader
from regtech.pdf.base import PdfLine
from regtech.pdf.pymupdf_reader import PyMuPdfReader
from regtech.sources.fffs import FffsSource
from regtech.sources.fffs_pdf import parse_regulation

FIXTURES = Path(__file__).parent / "fixtures" / "fi_fffs"
ITEM_IDS = ["fffs-2026-1", "fffs-2024-22", "fffs-2023-4", "fffs-2017-11", "fffs-2014-4"]
REGISTER_URL = "https://www.fi.se/sv/vara-register/fffs/sok-fffs/"


class RecordingDownloader(OfflineDownloader):
    def __init__(self):
        self.urls: list[str] = []

    def download(self, url: str, dest: Path) -> Path:
        self.urls.append(url)
        return super().download(url, dest)


def source_for(downloader=None, raw_dir=FIXTURES):
    return FffsSource(downloader or OfflineDownloader(), PyMuPdfReader(), raw_dir, RegexExtractor())


@pytest.fixture(scope="module")
def docs():
    source = source_for()
    return {item_id: source.parse(item_id) for item_id in ITEM_IDS}


def section(doc, chunk_id):
    return next(s for s in doc.sections if s.chunk_id == chunk_id)


def test_list_ids_reads_every_register_row():
    assert source_for().list_ids() == ITEM_IDS


def test_fetch_downloads_item_page_and_its_own_pdfs():
    downloader = RecordingDownloader()
    source = source_for(downloader)
    source.list_ids()

    source.fetch("fffs-2017-11")

    assert downloader.urls[1:] == [
        f"{REGISTER_URL}2017/201711/",
        "https://www.fi.se/contentassets/423320243f35401f97aa85d5562df59c/fs1711.pdf",
        "https://www.fi.se/contentassets/423320243f35401f97aa85d5562df59c/fs1711k.pdf",
        "https://www.fi.se/globalassets/media/dokument/fffs-bilagor/2017/beslutspm_penningtv_fffs2017_11-16.pdf",
    ]


def test_base_regulation_with_consolidated_text(docs):
    doc = docs["fffs-2017-11"]

    assert doc.document_type == "foreskrift"
    assert doc.identifier == "FFFS 2017:11"
    assert doc.title.startswith("Finansinspektionens föreskrifter om åtgärder mot penningtvätt")
    assert doc.effective_date == date(2017, 8, 1)
    assert doc.latest_amendment == "FFFS 2024:4"
    assert doc.amends is None
    assert doc.source_url == f"{REGISTER_URL}2017/201711/"
    assert doc.pdf_url.endswith("/fs1711k.pdf")
    assert doc.memo_url.endswith("/beslutspm_penningtv_fffs2017_11-16.pdf")
    assert "B E S L U T S P R O M E M O R I A" in doc.memo_text
    assert doc.preamble.startswith("Finansinspektionen föreskriver följande med stöd av 18 och")


def test_sections_come_from_the_consolidated_text(docs):
    doc = docs["fffs-2017-11"]

    assert len(doc.sections) == 48
    assert section(doc, "fi_fffs_fffs-2017-11_k6_p1a").chapter == "6"
    assert section(doc, "fi_fffs_fffs-2017-11_k1_p2").full_text.endswith("(FFFS 2021:37)")
    assert {p.rule_type for s in doc.sections for p in s.paragraphs} == {"binding_rule"}


def test_amendment_notes_stay_in_the_text_but_are_not_citations(docs):
    doc = docs["fffs-2017-11"]
    fffs_targets = {
        c.target_document
        for d in docs.values()
        for s in d.sections
        for c in s.citations
        if c.citation_type == "external_fffs"
    }

    assert section(doc, "fi_fffs_fffs-2017-11_k6_p1").full_text.endswith(
        "(FFFS 2019:28, FFFS 2024:4)"
    )
    assert fffs_targets == {"FFFS 2014:1", "FFFS 2014:5", "FFFS 2017:2"}


def test_authorizations_come_from_the_preamble(docs):
    authorizations = docs["fffs-2014-4"].authorizations

    assert [
        (a.target_document, a.targets[0].chapter, a.targets[0].section) for a in authorizations
    ] == [
        ("SFS 2004:329", "5", "2"),
        ("SFS 2007:572", "6", "1"),
    ]
    assert {a.citation_type for a in authorizations} == {"external_ordinance"}


def test_guidance_paragraphs(docs):
    s = section(docs["fffs-2014-4"], "fi_fffs_fffs-2014-4_k3_p4")

    assert [p.rule_type for p in s.paragraphs] == ["binding_rule"] * 3 + ["guidance"]
    assert s.paragraphs[-1].text == "Exempel på indikatorer som företaget bör beakta är"
    assert len(s.paragraphs[-1].points) == 6


def test_group_heading_after_chapter_heading(docs):
    s = section(docs["fffs-2014-4"], "fi_fffs_fffs-2014-4_k5_p1")

    assert s.chapter_title == "Hantering av operativa risker i verksamheten"
    assert s.heading == "Processer"


def test_italic_group_heading(docs):
    doc = docs["fffs-2014-4"]

    assert section(doc, "fi_fffs_fffs-2014-4_k5_p17").heading == (
        "Analys av konsekvenser och planering för återställning"
    )
    assert "Analys av konsekvenser" not in section(doc, "fi_fffs_fffs-2014-4_k5_p16").full_text


def test_line_break_hyphens(docs):
    doc = docs["fffs-2014-4"]

    assert "de it-system som används" in section(doc, "fi_fffs_fffs-2014-4_k6_p11").full_text
    assert "företagets verksamhet och organisation" in (
        section(doc, "fi_fffs_fffs-2014-4_k5_p11").full_text
    )
    assert "it-verksamhet" in section(doc, "fi_fffs_fffs-2014-4_k5_p8").full_text


def test_amendment(docs):
    doc = docs["fffs-2023-4"]

    assert doc.amends == "FFFS 2014:4"
    assert doc.latest_amendment is None
    assert doc.effective_date == date(2023, 3, 8)
    assert doc.pdf_url.endswith("/fs2304.pdf")
    assert [s.chunk_id for s in doc.sections] == ["fi_fffs_fffs-2023-4_k1_p2"]
    assert [a.target_document for a in doc.authorizations] == ["SFS 2004:329"]


def test_guidance_only_document(docs):
    doc = docs["fffs-2024-22"]

    assert doc.document_type == "allmanna_rad"
    assert doc.preamble == "Finansinspektionen lämnar följande allmänna råd."
    assert doc.authorizations == []
    assert [(s.chunk_id, s.heading) for s in doc.sections] == [
        ("fi_fffs_fffs-2024-22_b1", "Tillämpningsområde"),
        ("fi_fffs_fffs-2024-22_b2", "Rapportering till Finansinspektionen"),
        ("fi_fffs_fffs-2024-22_b3", "Riktlinjer för hantering och rapportering"),
        ("fi_fffs_fffs-2024-22_b4", "Anmälan till Polismyndigheten eller åklagare"),
    ]
    assert {p.rule_type for s in doc.sections for p in s.paragraphs} == {"guidance"}
    assert not any("Ange företagets namn" in s.full_text for s in doc.sections)


def test_repeal_has_preamble_and_no_sections(docs):
    doc = docs["fffs-2026-1"]

    assert doc.sections == []
    assert doc.preamble.endswith("ska upphöra att gälla den 31 mars 2026.")
    assert [a.target_document for a in doc.authorizations] == ["SFS 2004:329", "SFS 2016:1033"]


def test_every_document_has_its_memo_text(docs):
    assert all(doc.memo_text for doc in docs.values())


def test_law_named_after_a_lettered_point_range(docs):
    for item_id in ["fffs-2014-4", "fffs-2023-4"]:
        citations = section(docs[item_id], f"fi_fffs_{item_id}_k1_p2").citations

        assert ("SFS 2014:968", "1", "2") in {
            (c.target_document, t.chapter, t.section) for c in citations for t in c.targets
        }


def test_register_row_with_an_unexpected_number_fails_that_item(tmp_path):
    shutil.copytree(FIXTURES, tmp_path, dirs_exist_ok=True)
    search_path = tmp_path / "search.html"
    search_path.write_text(
        search_path.read_text(encoding="utf-8").replace(
            "<dd>2026:1</dd>", "<dd>2026:1/../../x</dd>"
        ),
        encoding="utf-8",
    )
    source = source_for(raw_dir=tmp_path)
    bad_id, *other_ids = source.list_ids()

    with pytest.raises(ValueError, match="not an FFFS id"):
        source.fetch(bad_id)
    source.fetch(other_ids[0])


def test_links_that_are_not_https_are_dropped(tmp_path):
    shutil.copytree(FIXTURES / "fffs-2023-4", tmp_path / "fffs-2023-4")
    item_path = tmp_path / "fffs-2023-4" / "item.html"
    item_path.write_text(
        item_path.read_text(encoding="utf-8").replace(
            "/globalassets/media/dokument/fffs-bilagor/2023/beslutspm-2023-1-8.pdf",
            "javascript:alert(1)//beslutspm.pdf",
        ),
        encoding="utf-8",
    )

    doc = source_for(raw_dir=tmp_path).parse("fffs-2023-4")

    assert (doc.memo_url, doc.memo_text) == (None, None)
    assert doc.pdf_url.startswith("https://www.fi.se/")


def body_line(top, text):
    return PdfLine(
        page=2, top=top, left=70, size=11, text=text, bold=False, italic=False, starts_bold=False
    )


def test_text_stops_at_a_signature_but_not_at_an_abbreviation():
    lines = [
        PdfLine(
            page=2, top=100, left=70, size=11, text="1 § Text.", bold=False, italic=False,
            starts_bold=True,
        ),
        body_line(115, "EBA."),
        body_line(130, "Mer text."),
        body_line(200, "ERIK THEDÉEN"),
        body_line(220, "Bilaga"),
    ]  # fmt: skip

    _, [draft] = parse_regulation(lines, all_guidance=False)

    assert draft.lines_per_paragraph == [["Text. EBA. Mer text."]]


def test_signature_like_line_ends_the_text_only_on_the_last_page():
    lines = [
        PdfLine(
            page=2, top=100, left=70, size=11, text="1 § Text om", bold=False, italic=False,
            starts_bold=True,
        ),
        body_line(115, "MIFID II"),
        replace(body_line(100, "och mer text."), page=3),
        replace(body_line(200, "ERIK THEDÉEN"), page=3),
    ]  # fmt: skip

    _, [draft] = parse_regulation(lines, all_guidance=False)

    assert draft.lines_per_paragraph == [["Text om MIFID II och mer text."]]
