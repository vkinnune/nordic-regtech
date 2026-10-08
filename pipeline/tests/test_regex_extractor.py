import time

from regtech.citations.regex_extractor import RegexExtractor

OWN = "SFS 2007:528"
extractor = RegexExtractor()


def targets(citation):
    return [(target.chapter, target.section) for target in citation.targets]


def test_several_sections_in_one_mention():
    [citation] = extractor.extract("gäller 8 kap. 23-26 och 34 §§.", OWN, "1")

    assert citation.raw_text == "8 kap. 23-26 och 34 §§"
    assert citation.citation_type == "internal"
    assert citation.target_document == OWN
    assert targets(citation) == [("8", "23"), ("8", "24"), ("8", "25"), ("8", "26"), ("8", "34")]


def test_chapter_carries_over_paragraph_and_point_qualifiers():
    text = (
        "23 kap. 1 § första och andra styckena, 2 §, 4 § första stycket samt 7 och 14 §§ om tillsyn"
    )
    [citation] = extractor.extract(text, OWN, "1")

    assert targets(citation) == [("23", "1"), ("23", "2"), ("23", "4"), ("23", "7"), ("23", "14")]


def test_section_without_chapter_uses_own_chapter():
    [citation] = extractor.extract("enligt 20 a § och 5 § första stycket 4", OWN, "8")

    assert targets(citation) == [("8", "20 a"), ("8", "5")]


def test_whole_chapter():
    [citation] = extractor.extract("gäller endast 15 a kap.", OWN, "1")

    assert targets(citation) == [("15 a", None)]


def test_external_act_and_ordinance():
    text = (
        "enligt 25 kap. 4 § lagen (2007:528) och 5 kap. 1 § förordningen (2007:572) "
        "samt aktiebolagslagen (2005:551)"
    )
    act, ordinance, standalone = extractor.extract(text, "SFS 2007:572", "6")

    assert (act.citation_type, act.target_document, targets(act)) == (
        "external_act",
        "SFS 2007:528",
        [("25", "4")],
    )
    assert ordinance.citation_type == "internal"
    assert targets(ordinance) == [("5", "1")]
    assert (standalone.citation_type, standalone.target_document, standalone.targets) == (
        "external_act",
        "SFS 2005:551",
        [],
    )


def test_name_without_number_and_samma_lag_reuse_earlier_statute():
    text = (
        "trots 19 kap. 7 § aktiebolagslagen (2005:551). Inte heller 19 kap. 9 § aktiebolagslagen "
        "eller 2 kap. 1 § samma lag."
    )
    first, by_name, same = extractor.extract(text, OWN, "7")

    assert by_name.target_document == "SFS 2005:551"
    assert (same.target_document, targets(same)) == ("SFS 2005:551", [("2", "1")])


def test_unknown_statute_is_external_without_target():
    [citation] = extractor.extract("enligt 3 kap. 2 § lagen om värdepappersrörelse", OWN, "1")

    assert citation.citation_type == "external_act"
    assert citation.target_document is None


def test_eu_regulations_and_directives():
    text = (
        "förordningarna (EU) nr 1095/2010 och (EU) 2015/2365 samt direktiven 2002/47/EG "
        "och (EU) 2017/1132"
    )
    citations = extractor.extract(text, OWN, "1")

    assert [(c.raw_text, c.citation_type) for c in citations] == [
        ("(EU) nr 1095/2010", "eu_regulation"),
        ("(EU) 2015/2365", "eu_regulation"),
        ("2002/47/EG", "eu_directive"),
        ("(EU) 2017/1132", "eu_directive"),
    ]


def test_amendment_note_is_not_a_citation():
    assert extractor.extract("Har upphävts genom lag (2014:985). Lag (2017:679).", OWN, "1") == []


def test_fffs_amendment_note_is_not_a_citation():
    text = (
        "inte förekommer. (FFFS 2021:37)\n\n"
        "anges i 1 §. (FFFS 2019:28,\nFFFS 2024:4)\n"
        "de utlagda uppgifterna. (FFFS 2024:4)."
    )

    assert [c.raw_text for c in extractor.extract(text, "FFFS 2017:11", "6")] == ["1 §"]


def test_fffs_citations_are_kept_next_to_amendment_notes():
    text = (
        "enligt FFFS 2014:1. Finansinspektionens föreskrifter (FFFS 2014:2) gäller. "
        "Finansinspektionens föreskrifter och allmänna råd (FFFS 2014:3) om styrning. "
        "Se 6 kap. 2 § Finansinspektionens föreskrifter (FFFS 2014:4). (FFFS 2021:37)"
    )
    citations = extractor.extract(text, "FFFS 2017:11", None)

    assert [(c.raw_text, c.citation_type, c.target_document) for c in citations] == [
        ("FFFS 2014:1", "external_fffs", "FFFS 2014:1"),
        ("FFFS 2014:2", "external_fffs", "FFFS 2014:2"),
        ("FFFS 2014:3", "external_fffs", "FFFS 2014:3"),
        (
            "6 kap. 2 § Finansinspektionens föreskrifter (FFFS 2014:4)",
            "external_fffs",
            "FFFS 2014:4",
        ),
    ]


def test_bemyndigande():
    assert extractor.is_bemyndigande("Regeringen får meddela föreskrifter om avgifter.")
    assert extractor.is_bemyndigande(
        "Finansinspektionen får i fråga om lagen (2007:528) meddela föreskrifter om"
    )
    assert extractor.is_bemyndigande("får meddela ytterligare föreskrifter om")
    assert not extractor.is_bemyndigande("Regeringen får meddela föreskrifter om verkställighet")
    assert not extractor.is_bemyndigande("Regeringen meddelar föreskrifter om avgifter.")


def test_fffs_citation_with_section():
    text = "enligt 4 kap. 2 § Finansinspektionens föreskrifter (FFFS 2017:2) om tillstånd"
    [citation] = extractor.extract(text, "FFFS 2017:11", None)

    assert citation.raw_text == "4 kap. 2 § Finansinspektionens föreskrifter (FFFS 2017:2)"
    assert (citation.citation_type, citation.target_document) == ("external_fffs", "FFFS 2017:2")
    assert targets(citation) == [("4", "2")]


def test_standalone_fffs_number():
    text = "enligt Finansinspektionens föreskrifter och allmänna råd (FFFS 2014:1)"
    [citation] = extractor.extract(text, "FFFS 2017:11", None)

    assert (citation.raw_text, citation.citation_type, citation.target_document) == (
        "FFFS 2014:1",
        "external_fffs",
        "FFFS 2014:1",
    )
    assert citation.targets == []


def test_dessa_foreskrifter_is_internal():
    [citation] = extractor.extract("enligt 3 § dessa föreskrifter", "FFFS 2017:11", "2")

    assert (citation.citation_type, citation.target_document, targets(citation)) == (
        "internal",
        "FFFS 2017:11",
        [("2", "3")],
    )


def test_i_fraga_om_law_applies_to_later_mentions_without_a_law():
    text = (
        "Utöver 2 § får Finansinspektionen i fråga om lagen (2007:528) om värdepappersmarknaden "
        "meddela föreskrifter om\n1. avtal enligt 1 kap. 4 b §,\n"
        "2. det som avses i 3 § denna förordning."
    )
    before, law, scoped, own = extractor.extract(text, "SFS 2007:572", "6")

    assert (before.citation_type, targets(before)) == ("internal", [("6", "2")])
    assert (law.target_document, law.targets) == ("SFS 2007:528", [])
    assert (scoped.citation_type, scoped.target_document, targets(scoped)) == (
        "external_act",
        "SFS 2007:528",
        [("1", "4 b")],
    )
    assert (own.citation_type, targets(own)) == ("internal", [("6", "3")])


def test_law_named_last_in_a_list_applies_to_the_whole_list():
    listed = extractor.extract(
        "9 kap. 45 § samt 10 kap. 17 och 24 §§ aktiebolagslagen (2005:551)", OWN, "1"
    )
    not_listed = extractor.extract(
        "9 kap. 45 § och enligt 10 kap. 17 § aktiebolagslagen (2005:551)", OWN, "1"
    )

    assert [(c.target_document, targets(c)) for c in listed] == [
        ("SFS 2005:551", [("9", "45")]),
        ("SFS 2005:551", [("10", "17"), ("10", "24")]),
    ]
    assert [c.target_document for c in not_listed] == [OWN, "SFS 2005:551"]


def test_point_list_stops_before_next_chapter():
    text = "3 kap. 1 § första stycket 5 och 6 samt 24 kap. 3 § andra stycket 1"
    first, second = extractor.extract(text, OWN, "1")

    assert first.raw_text == "3 kap. 1 § första stycket 5 och 6"
    assert targets(second) == [("24", "3")]


def test_point_list_stops_at_line_break():
    first, second = extractor.extract("enligt 8 kap. 35 § 3-11,\n4. någon av 9 kap. 1 §", OWN, "1")

    assert first.raw_text == "8 kap. 35 § 3-11"
    assert targets(second) == [("9", "1")]


def test_law_after_lettered_point_range_or_sentence():
    [points] = extractor.extract("1 kap. 2 § första stycket 7 c-g lagen (2014:968)", OWN, "1")
    [sentence] = extractor.extract("enligt 2 § andra meningen lagen (2004:46)", OWN, "1")

    assert (points.target_document, targets(points)) == ("SFS 2014:968", [("1", "2")])
    assert (sentence.target_document, targets(sentence)) == ("SFS 2004:46", [(None, "2")])


def test_law_named_before_a_list_applies_to_the_list():
    text = "följande bestämmelser i förvaltningslagen (2017:900):\n- 16-18 §§ om jäv,\n- 24 § om"
    law, jav, oral = extractor.extract(text, OWN, "16")

    assert (law.target_document, law.targets) == ("SFS 2017:900", [])
    assert (jav.target_document, targets(jav)) == (
        "SFS 2017:900",
        [(None, "16"), (None, "17"), (None, "18")],
    )
    assert oral.target_document == "SFS 2017:900"


def test_long_number_list_takes_linear_time():
    started = time.perf_counter()
    extractor.extract("1, " * 8000, OWN, "1")

    assert time.perf_counter() - started < 1


def test_point_list_before_a_section_number_is_not_sections():
    cases = {
        "18 kap. 4 § 2 eller 5 §": [("18", "4"), ("18", "5")],
        "12 kap. 14 § andra stycket 1-6, 6 §": [("12", "14"), ("12", "6")],
        "15 kap. 5 § första stycket 1, 3 och 4 samt 6 §": [("15", "5"), ("15", "6")],
        "4 kap. 4 § första stycket 2, 10 § 8 och 24 samt 16 §": [
            ("4", "4"),
            ("4", "10"),
            ("4", "16"),
        ],
        "3 kap. 2 § första stycket 4 och 5, 4 a och 4 b §§": [
            ("3", "2"),
            ("3", "4 a"),
            ("3", "4 b"),
        ],
        "5 kap. 6 § första stycket och andra stycket 3 samt 11 och 14 §§": [
            ("5", "6"),
            ("5", "11"),
            ("5", "14"),
        ],
    }

    for text, expected in cases.items():
        [citation] = extractor.extract(text, OWN, "1")
        assert targets(citation) == expected, text


def test_law_named_before_a_list_applies_only_within_its_paragraph():
    text = (
        "följande bestämmelser i förvaltningslagen (2017:900):\n- 24 § om muntlighet.\n\n"
        "Av 25 § framgår vad som gäller."
    )
    _, listed, own = extractor.extract(text, OWN, "16")

    assert listed.target_document == "SFS 2017:900"
    assert (own.citation_type, own.target_document, targets(own)) == (
        "internal",
        OWN,
        [("16", "25")],
    )
