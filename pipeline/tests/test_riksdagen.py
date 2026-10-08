import json
from datetime import date
from pathlib import Path

import pytest

from regtech.citations.regex_extractor import RegexExtractor
from regtech.download.offline_downloader import OfflineDownloader
from regtech.sources.riksdagen import RiksdagenSource

FIXTURES = Path(__file__).parent / "fixtures" / "riksdagen"


def source_for(numbers: list[str], raw_dir: Path = FIXTURES):
    return RiksdagenSource(numbers, OfflineDownloader(), raw_dir, RegexExtractor())


@pytest.fixture(scope="module")
def act():
    return source_for(["2007:528"]).parse("sfs-2007-528")


@pytest.fixture(scope="module")
def ordinance():
    return source_for(["2007:572"]).parse("sfs-2007-572")


def section(doc, chunk_id):
    return next(s for s in doc.sections if s.chunk_id == chunk_id)


def test_search_finds_document_id():
    assert source_for(["2007:528", "2007:572"]).list_ids() == ["sfs-2007-528", "sfs-2007-572"]


def test_act_header(act):
    assert act.document_type == "lag"
    assert act.identifier == "SFS 2007:528"
    assert act.issue_date == date(2007, 6, 14)
    assert act.effective_date == date(2007, 11, 1)
    assert act.latest_amendment == "SFS 2026:1066"
    assert act.source_url == "https://data.riksdagen.se/dokument/sfs-2007-528.html"


def test_act_sections(act):
    assert len(act.sections) == 567
    assert len({s.chunk_id for s in act.sections}) == 567

    recovery_plans = section(act, "riksdagen_sfs-2007-528_k8a_p2")
    assert (recovery_plans.chapter, recovery_plans.chapter_title) == ("8 a", "Återhämtningsplaner")

    repealed = section(act, "riksdagen_sfs-2007-528_k7_p7")
    assert repealed.full_text == "Har upphävts genom lag (2014:985)."


def test_nested_points_and_heading(act):
    s = section(act, "riksdagen_sfs-2007-528_k1_p2b")
    first, note = s.paragraphs

    assert s.heading == "Hållbarhetsrelaterade upplysningar"
    assert [p.number for p in first.points] == ["1", "2"]
    assert first.points[0].text == "värdepappersbolag som"
    assert first.points[0].items == [
        "tillhandahåller investeringsrådgivning, och",
        "har färre än tre anställda, och",
    ]
    assert note.text == "Lag (2021:106)."


def test_dash_list_without_numbers(act):
    s = section(act, "riksdagen_sfs-2007-528_k1_p1a")

    assert (
        s.paragraphs[0].text == "För centrala motparter gäller följande bestämmelser i denna lag:"
    )
    assert [p.number for p in s.paragraphs[0].points] == [None] * 4


def test_both_wordings_kept(act):
    current = section(act, "riksdagen_sfs-2007-528_k7_p6")
    upcoming = section(act, "riksdagen_sfs-2007-528_k7_p6_i20261205")

    assert (current.in_force_until, current.upcoming) == (date(2026, 12, 5), False)
    assert (upcoming.in_force_from, upcoming.upcoming) == (date(2026, 12, 5), True)
    assert "/" not in current.full_text[:20] and "/" not in upcoming.full_text[:20]


def test_ordinance(ordinance):
    assert ordinance.document_type == "forordning"
    assert ordinance.effective_date is None

    [citation] = section(ordinance, "riksdagen_sfs-2007-572_k5_p1").citations
    assert citation.target_document == "SFS 2007:528"
    assert [(t.chapter, t.section) for t in citation.targets] == [("25", "4")]

    assert section(ordinance, "riksdagen_sfs-2007-572_k6_p1").is_bemyndigande


SYNTHETIC_HTML = """
<div class="sfstoc"><h3>Innehåll:</h3></div>
<div>
<a class="paragraf" name="P1"><b>1 §</b></a> Denna förordning gäller avgifter.
<p><a name="P1S2"></a></p> Avgiften tas ut enligt 3 §.
<p><a name="P1S3"></a></p>

3 § om avgiftens storlek.
<a class="paragraf" name="P2"><b>2 §</b></a> /Upphör att gälla U:2027-01-11 genom
<i>lag (2026:1)</i>./
Gammal lydelse.
<a class="paragraf" name="P2"><b>2 §</b></a> <i>/Träder i kraft I:den dag regeringen bestämmer/</i>
Ny lydelse.
<a class="paragraf" name="P3"><b>3 §</b></a> Första.
<a class="paragraf" name="P3"><b>3 §</b></a> Andra.
<h4 name="Avgifter">Avgifter</h4>
<pre></pre>
4 § Text utan ankare.
<h3 name="overgang">Övergångsbestämmelser</h3>
2020:5<br /> 1. Denna förordning träder i kraft den 1 mars 2020.
</div>
"""


def parse_synthetic(tmp_path, html):
    raw = {
        "dokumentstatus": {
            "dokument": {
                "dok_id": "sfs-2020-5",
                "beteckning": "2020:5",
                "titel": "Avgiftsförordning (2020:5)",
                "subtitel": "",
                "html": html,
            },
            "dokuppgift": {"uppgift": [{"kod": "utfardad", "text": "2020-01-30"}]},
        }
    }
    (tmp_path / "documents").mkdir()
    (tmp_path / "documents" / "sfs-2020-5.json").write_text(json.dumps(raw), encoding="utf-8")
    return source_for([], tmp_path).parse("sfs-2020-5")


def test_markup_variants(tmp_path):
    doc = parse_synthetic(tmp_path, SYNTHETIC_HTML)

    assert doc.document_type == "forordning"
    assert doc.effective_date == date(2020, 3, 1)
    assert doc.latest_amendment is None
    assert [s.chunk_id for s in doc.sections] == [
        "riksdagen_sfs-2020-5_p1",
        "riksdagen_sfs-2020-5_p2",
        "riksdagen_sfs-2020-5_p2_i",
        "riksdagen_sfs-2020-5_p3",
        "riksdagen_sfs-2020-5_p3_2",
        "riksdagen_sfs-2020-5_p4",
    ]
    first, old, new, _, _, unanchored = doc.sections
    assert [p.text for p in first.paragraphs] == [
        "Denna förordning gäller avgifter.",
        "Avgiften tas ut enligt 3 §.",
        "3 § om avgiftens storlek.",
    ]
    assert first.citations[0].targets[0].chapter is None
    assert (old.in_force_until, old.full_text) == (date(2027, 1, 11), "Gammal lydelse.")
    assert (new.upcoming, new.in_force_from, new.full_text) == (True, None, "Ny lydelse.")
    assert (unanchored.heading, unanchored.full_text) == ("Avgifter", "Text utan ankare.")


CHAPTER_TWICE_HTML = """
<div>
<i>/Kapitlet upphör att gälla U:2027-01-01/</i>
<h3 name="K2"><a name="K2">2 kap. Gamla avgifter</a></h3>
<a class="paragraf" name="K2P1"><b>1 §</b></a> Gammal lydelse.
<i>/Kapitlet träder i kraft I:2027-01-01/</i>
<h3 name="K2"><a name="K2">2 kap. Nya avgifter</a></h3>
<a class="paragraf" name="K2P1"><b>1 §</b></a> Ny lydelse.
</div>
"""


def test_chapter_shown_twice_keeps_each_chapter_marker(tmp_path):
    old, new = parse_synthetic(tmp_path, CHAPTER_TWICE_HTML).sections

    assert (old.chunk_id, old.upcoming, old.in_force_until) == (
        "riksdagen_sfs-2020-5_k2_p1",
        False,
        date(2027, 1, 1),
    )
    assert (new.chunk_id, new.upcoming, new.in_force_from) == (
        "riksdagen_sfs-2020-5_k2_p1_i20270101",
        True,
        date(2027, 1, 1),
    )


def test_hyphen_between_word_parts_kept_at_a_line_end(tmp_path):
    html = '<div><a class="paragraf" name="P1"><b>1 §</b></a> En fond-i-\r\nfond.</div>'
    [only] = parse_synthetic(tmp_path, html).sections

    assert only.full_text == "En fond-i-fond."


def cited(doc, chunk_id):
    return [
        (c.target_document, [(t.chapter, t.section) for t in c.targets])
        for c in section(doc, chunk_id).citations
    ]


def test_law_named_after_points_and_sentences(act):
    to_2014_968 = ("SFS 2014:968", [("1", "2")])
    sections_46 = ["9", "10", "11", "12", "13", "14", "20", "21", "22"]

    assert to_2014_968 in cited(act, "riksdagen_sfs-2007-528_k1_p5")
    assert to_2014_968 in cited(act, "riksdagen_sfs-2007-528_k8_p1c")
    assert ("SFS 2004:46", [("4", "12")]) in cited(act, "riksdagen_sfs-2007-528_k9_p19")
    assert ("SFS 2011:1244", [("46", n) for n in sections_46]) in cited(
        act, "riksdagen_sfs-2007-528_k25_p28b"
    )


def test_law_named_before_a_list_of_provisions(act):
    documents = [document for document, _ in cited(act, "riksdagen_sfs-2007-528_k16_p13")]

    assert documents == ["SFS 2007:528"] + ["SFS 2017:900"] * 11


def test_section_number_in_plain_text_after_a_blank_line(act):
    renamed = section(act, "riksdagen_sfs-2007-528_k11_p2b")

    assert "OTF" not in section(act, "riksdagen_sfs-2007-528_k11_p2a").full_text
    assert renamed.in_force_until == date(2026, 12, 5)
    assert renamed.full_text.startswith(
        "Ett värdepappersinstitut som driver en OTF-plattform ska ha"
    )
    assert section(act, "riksdagen_sfs-2007-528_k11_p2c").in_force_until == date(2026, 12, 5)


def test_chapter_and_heading_markers(act):
    new_chapter = [s for s in act.sections if s.chapter == "11 a"]

    assert {(s.upcoming, s.in_force_from) for s in new_chapter} == {(True, date(2026, 12, 5))}
    assert new_chapter[0].chunk_id == "riksdagen_sfs-2007-528_k11a_p1_i20261205"
    assert not any("/Rubriken" in s.full_text or "/Kapitlet" in s.full_text for s in act.sections)


def test_words_split_at_a_line_end_are_joined(act):
    def text(chunk_id):
        return section(act, chunk_id).full_text

    assert "verkställande" in text("riksdagen_sfs-2007-528_k8_p1c")
    assert "upphävande" in text("riksdagen_sfs-2007-528_k1_p4a")
    assert "Europaparlamentets" in text("riksdagen_sfs-2007-528_k1_p4a")
    assert "icke-sammanlänkat" in text("riksdagen_sfs-2007-528_k1_p4b")
    assert "MTF-plattform" in text("riksdagen_sfs-2007-528_k1_p4b")
    assert "bank- och" in text("riksdagen_sfs-2007-528_k1_p4b")
    assert [document for document, _ in cited(act, "riksdagen_sfs-2007-528_k23_p9")] == [
        "SFS 2007:528",
        "SFS 2005:551",
        "SFS 2018:672",
    ]
