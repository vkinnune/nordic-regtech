import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import date

from regtech.citations.base import CitationExtractor
from regtech.models import LegalSection, Paragraph, Point, RuleType

# Lettered items keep their letter, so that branch only looks ahead.
LIST_LINE_RE = re.compile(r"^(?:(?P<number>\d+(?: ?[a-z])?)\.\s+|[-–]\s+|(?=[a-z]\)\s))")
HYPHENATED_WORD_RE = re.compile(r"(\w+)-\w")
LINE_END_FRAGMENT_RE = re.compile(r"(\w+)-$")
LETTER_BETWEEN_HYPHENS_RE = re.compile(r"-\w-$")
WORDS_AFTER_KEPT_HYPHEN = {"och", "eller", "samt", "respektive", "till"}


@dataclass
class SectionDraft:
    chapter: str | None
    chapter_title: str | None
    heading: str | None
    section: str | None
    in_force_from: date | None = None
    in_force_until: date | None = None
    upcoming: bool = False
    lines_per_paragraph: list[list[str]] = field(default_factory=lambda: [[""]])
    rule_types: list[RuleType] = field(default_factory=lambda: ["binding_rule"])

    def add_text(self, text: str) -> None:
        self.lines_per_paragraph[-1][-1] += text

    def new_line(self) -> None:
        self.lines_per_paragraph[-1].append("")

    def new_paragraph(self, rule_type: RuleType = "binding_rule") -> None:
        self.lines_per_paragraph.append([""])
        self.rule_types.append(rule_type)


def hyphenated_prefixes(text: str) -> set[str]:
    return {prefix.lower() for prefix in HYPHENATED_WORD_RE.findall(text)}


def join_wrapped_line(line: str, next_line: str, hyphenated_prefixes: set[str]) -> str:
    line = line.rstrip()
    fragment = LINE_END_FRAGMENT_RE.search(line)
    first_word = next_line.split()[0]
    hyphen_ends_word = (
        fragment is not None
        and first_word[:1].islower()
        and first_word.rstrip(",.") not in WORDS_AFTER_KEPT_HYPHEN
    )

    if not hyphen_ends_word:
        return f"{line} {next_line}"
    if (
        fragment[1].isupper()
        or fragment[1].lower() in hyphenated_prefixes
        or LETTER_BETWEEN_HYPHENS_RE.search(line)
    ):
        return line + next_line
    return line[:-1] + next_line


def make_sections(
    drafts: list[SectionDraft], id_prefix: str, own_document: str, extractor: CitationExtractor
) -> list[LegalSection]:
    sections = []
    block_count = 0
    for draft in drafts:
        if draft.section is None:
            block_count += 1
        sections.append(_make_section(draft, id_prefix, own_document, extractor, block_count))

    seen: Counter[str] = Counter()
    for section in sections:
        seen[section.chunk_id] += 1
        if seen[section.chunk_id] > 1:
            section.chunk_id += f"_{seen[section.chunk_id]}"
    return sections


def _make_section(
    draft: SectionDraft,
    id_prefix: str,
    own_document: str,
    extractor: CitationExtractor,
    block_number: int,
) -> LegalSection:
    paragraphs = [
        ([" ".join(line.split()) for line in lines if line.strip()], rule_type)
        for lines, rule_type in zip(draft.lines_per_paragraph, draft.rule_types, strict=True)
    ]
    paragraphs = [(lines, rule_type) for lines, rule_type in paragraphs if lines]
    full_text = "\n\n".join("\n".join(lines) for lines, _ in paragraphs)

    return LegalSection(
        chunk_id=_chunk_id(draft, id_prefix, block_number),
        chapter=draft.chapter,
        chapter_title=draft.chapter_title,
        heading=draft.heading,
        section=draft.section,
        in_force_from=draft.in_force_from,
        in_force_until=draft.in_force_until,
        upcoming=draft.upcoming,
        is_bemyndigande=extractor.is_bemyndigande(full_text),
        paragraphs=_paragraphs(paragraphs),
        citations=extractor.extract(full_text, own_document, draft.chapter),
        full_text=full_text,
    )


def _chunk_id(draft: SectionDraft, id_prefix: str, block_number: int) -> str:
    chapter_part = f"_k{draft.chapter.replace(' ', '')}" if draft.chapter else ""
    if draft.section is None:
        return f"{id_prefix}{chapter_part}_b{block_number}"

    upcoming_part = ""
    if draft.upcoming:
        upcoming_part = f"_i{draft.in_force_from:%Y%m%d}" if draft.in_force_from else "_i"
    return f"{id_prefix}{chapter_part}_p{draft.section.replace(' ', '')}{upcoming_part}"


def _paragraphs(paragraph_lines: list[tuple[list[str], RuleType]]) -> list[Paragraph]:
    paragraphs = []
    for lines, rule_type in paragraph_lines:
        paragraphs.append(Paragraph(text="", rule_type=rule_type))
        for line in lines:
            paragraph = paragraphs[-1]
            list_line = LIST_LINE_RE.match(line)
            if list_line and list_line["number"]:
                text = line[list_line.end() :]
                paragraph.points.append(Point(number=list_line["number"], text=text))
            elif list_line:
                item = line[list_line.end() :]
                if paragraph.points and paragraph.points[-1].number:
                    paragraph.points[-1].items.append(item)
                else:
                    paragraph.points.append(Point(text=item))
            elif paragraph.points:
                paragraphs.append(Paragraph(text=line, rule_type=rule_type))
            else:
                paragraph.text = f"{paragraph.text}\n{line}" if paragraph.text else line
    return paragraphs
