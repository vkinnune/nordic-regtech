from datetime import date

from regtech.models import LegalDocument, LegalSection, Paragraph
from regtech.versions import document_changes, text_diff, upcoming_changes, version_changes

IN_FORCE_TEXT = "Aktier på en reglerad marknad utanför EES. Lag (2010:2075)."
UPCOMING_TEXT = "Aktier på en reglerad marknad utanför EES eller en MTF-plattform. Lag (2026:784)."


def section(number, text, upcoming=False, in_force_from=None, chapter="7"):
    suffix = "_i" if upcoming else ""
    return LegalSection(
        chunk_id=f"riksdagen_sfs-2007-528_k{chapter}_p{number}{suffix}",
        chapter=chapter,
        section=number,
        upcoming=upcoming,
        in_force_from=in_force_from,
        paragraphs=[Paragraph(text=text)],
        full_text=text,
    )


def document(*sections, amendment_dates=None):
    return LegalDocument(
        id="sfs-2007-528",
        source="riksdagen",
        document_type="lag",
        identifier="SFS 2007:528",
        title="Lag (2007:528) om värdepappersmarknaden",
        source_url="https://data.riksdagen.se/dokument/sfs-2007-528.html",
        amendment_dates=amendment_dates or {},
        sections=list(sections),
    )


def pending():
    return document(
        section("6", IN_FORCE_TEXT),
        section("6", UPCOMING_TEXT, upcoming=True, in_force_from=date(2026, 12, 5)),
    )


def test_upcoming_wording_is_modified_against_the_text_in_force_on_the_first_fetch():
    [change] = upcoming_changes(None, pending())

    assert (change.chapter, change.section, change.upcoming) == ("7", "6", True)
    assert change.status == "MODIFIED"
    assert (change.old_text, change.new_text) == (IN_FORCE_TEXT, UPCOMING_TEXT)
    assert change.amending_act == "SFS 2026:784"
    assert change.amended_date == date(2026, 12, 5)


def test_upcoming_marker_date_wins_over_the_transitional_date():
    # SFS 2026:634: "träder i kraft den 10 juli 2026 i fråga om 17 kap. 5 § och i övrigt
    # den 10 januari 2030", so an act's first transitional date is not every section's date.
    doc = pending()
    doc.amendment_dates = {"SFS 2026:784": date(2026, 7, 10)}

    [change] = upcoming_changes(None, doc)

    assert change.amended_date == date(2026, 12, 5)


def test_second_upcoming_wording_is_compared_with_the_first():
    doc = document(
        section("16", "Ny. Lag (2026:784).", upcoming=True, in_force_from=date(2026, 12, 5)),
        section("16", "Ny igen. Lag (2026:634).", upcoming=True, in_force_from=date(2030, 1, 10)),
    )

    first, second = upcoming_changes(None, doc)

    assert (first.status, first.old_text) == ("ADDED", None)
    assert (second.status, second.old_text, second.ordinal) == (
        "MODIFIED",
        "Ny. Lag (2026:784).",
        1,
    )


def test_upcoming_wording_seen_before_records_nothing():
    assert upcoming_changes(pending(), pending()) == []


def test_first_fetch_has_no_version_changes():
    assert version_changes(None, pending()) == []


def test_upcoming_wording_taking_effect_modifies_the_text_in_force_and_is_not_repealed():
    after = document(section("6", UPCOMING_TEXT))

    [change] = version_changes(pending(), after)

    assert (change.section, change.upcoming, change.status) == ("6", False, "MODIFIED")
    assert (change.old_text, change.new_text) == (IN_FORCE_TEXT, UPCOMING_TEXT)
    assert upcoming_changes(pending(), after) == []


def test_added_repealed_and_removed_sections():
    before = document(section("1", "Ett. Lag (2010:1)."), section("2", "Två. Lag (2010:2)."))
    after = document(
        section("1", "Har upphävts genom lag (2019:132)."),
        section("3", "Tre. Lag (2024:5)."),
        amendment_dates={"SFS 2024:5": date(2024, 7, 1)},
    )

    changes = {change.section: change for change in version_changes(before, after)}

    assert changes["1"].status == "REPEALED"
    assert changes["1"].amending_act == "SFS 2019:132"
    assert changes["2"].status == "REPEALED"
    assert changes["2"].new_text is None
    assert changes["3"].status == "ADDED"
    assert changes["3"].amended_date == date(2024, 7, 1)


def test_line_breaks_alone_are_not_a_change():
    before = document(section("1", "Ett två\ntre."))
    after = document(section("1", "Ett\ntvå tre."))

    assert version_changes(before, after) == []


def test_fffs_act_is_the_newest_amendment_note():
    before = document(section("2", "Första. (FFFS 2018:1)"))
    after = document(section("2", "Första ändrad. (FFFS 2023:4) Andra. (FFFS 2018:1)"))

    [change] = version_changes(before, after)

    assert change.amending_act == "FFFS 2023:4"


def test_text_diff_marks_removed_and_added_words():
    assert text_diff("utanför EES. Lag", "utanför EES eller en MTF. Lag") == [
        ("equal", "utanför "),
        ("delete", "EES. "),
        ("insert", "EES eller en MTF. "),
        ("equal", "Lag"),
    ]


def test_first_fetch_of_a_document_records_it_as_added():
    doc = pending()
    doc.effective_date = date(2007, 11, 1)

    [change] = document_changes(None, doc)

    assert (change.level, change.status, change.amended_date) == (
        "document",
        "ADDED",
        doc.effective_date,
    )
    assert (change.chapter, change.section) == (None, None)


def test_document_repeal_is_recorded_once():
    old = pending()
    repealed = old.model_copy(
        update={"repealed_by": "SFS 2026:900", "repealed_on": date(2027, 1, 1)}
    )

    [change] = document_changes(old, repealed)

    assert (change.level, change.status) == ("document", "REPEALED")
    assert (change.amending_act, change.amended_date) == ("SFS 2026:900", date(2027, 1, 1))
    assert document_changes(repealed, repealed) == []
    assert document_changes(old, old) == []
