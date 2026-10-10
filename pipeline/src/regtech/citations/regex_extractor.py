import re

from regtech.document_numbers import AMENDMENT_NOTE_RE, FFFS_NUMBER, FFFS_NUMBER_RE
from regtech.models import Citation, CitationTarget, CitationType

# ponytail: a list of more than 50 numbers loses its first ones. Uncapped, a long list not
# followed by "§" is scanned again from each of its numbers, so time grows with length squared.
MAX_LIST_REPEATS = 50
# Atomic: without it a point list backtracks and takes the "2" of "24 kap." or "8" of "8 a kap.".
NUM = r"(?>\d+(?: [a-z]\b)?)"
RANGE = rf"{NUM}(?:\s*[-–]\s*{NUM})?"
POINT_RANGE = rf"{NUM}(?:\s*[-–]\s*(?:{NUM}|[a-z]\b))?"
LIST_SEP = r"(?:,? +(?:och|eller|samt) +|, *)"
NUM_LIST = rf"{RANGE}(?:{LIST_SEP}{RANGE}){{0,{MAX_LIST_REPEATS}}}"
POINT_LIST = rf"{POINT_RANGE}(?:{LIST_SEP}{POINT_RANGE}){{0,{MAX_LIST_REPEATS}}}"
ORDINAL = r"(?:första|andra|tredje|fjärde|femte|sjätte|sjunde|åttonde|nionde|tionde|sista)"
ORDINALS = rf"{ORDINAL}(?:{LIST_SEP}{ORDINAL})*"
STYCKE_REF = rf"{ORDINALS}\s+stycke\w*"
SENTENCE_REF = rf"{ORDINALS}\s+mening\w*"
POINT_REF = rf"\s+{POINT_LIST}(?!\s*(?:§|kap\.))"
PART_REF = rf"(?:\s+{SENTENCE_REF})?(?:{POINT_REF})?"
SECTIONS = rf"{NUM_LIST}\s*§§?(?:\s+{STYCKE_REF})?{PART_REF}(?:{LIST_SEP}{STYCKE_REF}{PART_REF})*"
SECTION_SEQ = rf"{SECTIONS}(?:{LIST_SEP}{SECTIONS})*"
CHAPTERS = rf"{RANGE}\s+kap\."
MENTION = rf"(?<![\w/:])(?:{CHAPTERS}(?:\s+{SECTION_SEQ})?|{SECTION_SEQ})"
STATUTE = (
    r"(?:(?:denna|samma)\s+(?:lag|förordning)\b"
    r"|(?:dessa|samma)\s+föreskrifter\b"
    rf"|Finansinspektionens\s+(?:föreskrifter|allmänna\s+råd)(?:\s+och\s+allmänna\s+råd)?\s+\({FFFS_NUMBER}\)"
    r"|\w*(?:lagen|förordningen|balken)\b(?:\s+\(\d{4}:\d+\))?)"
)
STANDALONE = rf"(?<!\w)\w*(?:lagen|förordningen|balken)\s+\(\d{{4}}:\d+\)|\b{FFFS_NUMBER}"
EU_ACT = (
    r"\((?:EU|EG|EEG|Euratom)\)\s+(?:nr\s+)?\d+/\d+"
    r"|(?<![\w/])\d{2,4}/\d+/(?:EU|EG|EEG|Euratom)\b"
)

CITATION_RE = re.compile(
    rf"(?P<mention>{MENTION})(?:(?:\s+i)?\s+(?P<statute>{STATUTE}))?"
    rf"|(?P<standalone>{STANDALONE})"
    rf"|(?P<eu>{EU_ACT})"
)
CHAPTER_PART_RE = re.compile(rf"({RANGE})\s+kap\.")
SECTION_PART_RE = re.compile(rf"({NUM_LIST})\s*(§§?)")
# In "4 § 2 eller 5 §" a point list runs into the next section number. Only the tail is sections:
# the last number before "§", the part after the last "," or "samt" before "§§".
AFTER_SECTION_PART_RE = re.compile(r"(?:stycke\w*|mening\w*|§)\s+$")
SECTIONS_LIST_SEP_RE = re.compile(r", *| +samt +")
BRACKETED_SFS_NUMBER_RE = re.compile(r"\((\d{4}:\d+)\)")
# "bestämmelser i <law> …:" leads in to a list of that law's provisions.
SCOPE_RE = re.compile(
    rf"i fråga om (?P<asked>{STANDALONE})|bestämmelser i (?P<listed>{STANDALONE})[^.:]*:"
)
PARAGRAPH_END_RE = re.compile(r"\n\n|\Z")
LIST_SEP_RE = re.compile(LIST_SEP)
MAX_WORDS_BETWEEN_FAR_AND_MEDDELA = 12
BEMYNDIGANDE_RE = re.compile(
    rf"\bfår(?:\s+\S+){{0,{MAX_WORDS_BETWEEN_FAR_AND_MEDDELA}}}?"
    r"\s+meddela\s+(?:ytterligare\s+)?föreskrifter(?!\s+om\s+verkställighet)"
)

GENERIC_STATUTE_NAMES = {"lagen", "förordningen"}


class RegexExtractor:
    def extract(self, text: str, own_document: str, own_chapter: str | None) -> list[Citation]:
        text = AMENDMENT_NOTE_RE.sub("", text)
        matches = list(CITATION_RE.finditer(text))
        citations = []
        numbers_by_name: dict[str, str] = {}
        last_statute: tuple[str | None, CitationType] | None = None

        for match, statute in zip(matches, _statutes(text, matches), strict=True):
            if match["eu"]:
                citations.append(
                    Citation(raw_text=match["eu"], citation_type=_eu_type(text, match.start()))
                )
                continue

            if statute is None or statute.startswith(("denna", "dessa")):
                document, citation_type = own_document, "internal"
            elif statute.startswith("samma"):
                document, citation_type = last_statute or (None, _statute_type(statute))
            elif fffs_match := FFFS_NUMBER_RE.search(statute):
                document, citation_type = f"FFFS {fffs_match[1]}", "external_fffs"
                last_statute = (document, citation_type)
            else:
                name = statute.split()[0]
                number_match = BRACKETED_SFS_NUMBER_RE.search(statute)
                if number_match and name not in GENERIC_STATUTE_NAMES:
                    numbers_by_name[name] = number_match[1]
                number = number_match[1] if number_match else numbers_by_name.get(name)
                document = f"SFS {number}" if number else None
                citation_type = _statute_type(name)
                last_statute = (document, citation_type)

            if document == own_document:
                citation_type = "internal"
            default_chapter = own_chapter if citation_type == "internal" else None
            targets = _targets(match["mention"], default_chapter) if match["mention"] else []
            citations.append(
                Citation(
                    raw_text=match[0],
                    citation_type=citation_type,
                    target_document=document,
                    targets=targets,
                )
            )

        return citations

    def is_bemyndigande(self, text: str) -> bool:
        return BEMYNDIGANDE_RE.search(text) is not None


def _statutes(text: str, matches: list[re.Match[str]]) -> list[str | None]:
    statutes = [match["standalone"] or match["statute"] for match in matches]

    for i in range(len(matches) - 2, -1, -1):
        current, following = matches[i], matches[i + 1]
        listed_together = LIST_SEP_RE.fullmatch(text[current.end() : following.start()])
        if statutes[i] is None and current["mention"] and following["mention"] and listed_together:
            statutes[i] = statutes[i + 1]

    scope = SCOPE_RE.search(text)
    if scope:
        scope_end = PARAGRAPH_END_RE.search(text, scope.end()).start()
        statutes = [
            scope["asked"] or scope["listed"]
            if statute is None and match["mention"] and scope.end() < match.start() < scope_end
            else statute
            for match, statute in zip(matches, statutes, strict=True)
        ]
    return statutes


def _statute_type(name: str) -> CitationType:
    if "föreskrifter" in name:
        return "external_fffs"
    return "external_ordinance" if "förordning" in name else "external_act"


def _eu_type(text: str, start: int) -> CitationType:
    if text[start].isdigit():
        return "eu_directive"
    directive_at = text.rfind("direktiv", 0, start)
    regulation_at = text.rfind("förordning", 0, start)
    return "eu_directive" if directive_at > regulation_at else "eu_regulation"


def _targets(mention: str, default_chapter: str | None) -> list[CitationTarget]:
    chapter_match = CHAPTER_PART_RE.match(mention)
    chapters = _expand_range(chapter_match[1]) if chapter_match else [default_chapter]
    rest = mention[chapter_match.end() :] if chapter_match else mention
    sections = [
        number
        for section_match in SECTION_PART_RE.finditer(rest)
        for number in _expand_list(_section_numbers(rest, section_match))
    ]

    if not sections:
        return [CitationTarget(chapter=chapter) for chapter in chapters]
    return [
        CitationTarget(chapter=chapters[-1], section=section) for section in dict.fromkeys(sections)
    ]


def _section_numbers(rest: str, section_match: re.Match[str]) -> str:
    numbers = section_match[1]
    if not AFTER_SECTION_PART_RE.search(rest, 0, section_match.start()):
        return numbers
    if section_match[2] == "§§":
        return SECTIONS_LIST_SEP_RE.split(numbers)[-1]
    return LIST_SEP_RE.split(numbers)[-1]


def _expand_list(list_text: str) -> list[str]:
    return [number for part in re.split(LIST_SEP, list_text) for number in _expand_range(part)]


def _expand_range(range_text: str) -> list[str]:
    # ponytail: only plain numbers expand; "23-31" skips lettered sections such as 23 a.
    # The linker can add them from the stored sections if that matters.
    ends = re.split(r"\s*[-–]\s*", range_text)
    if len(ends) == 2 and all(end.isdigit() for end in ends) and int(ends[0]) < int(ends[1]):
        return [str(n) for n in range(int(ends[0]), int(ends[1]) + 1)]
    return ends
