import re
from collections import Counter
from dataclasses import replace

from regtech.models import RuleType
from regtech.pdf.base import PdfLine
from regtech.sections import LIST_LINE_RE, SectionDraft, hyphenated_prefixes, join_wrapped_line

TITLE_MIN_SIZE_PT = 13.5
CHAPTER_MIN_SIZE_PT = 11.5
BODY_SIZE_MARGIN_PT = 0.5
SAME_LINE_MAX_GAP_PT = 2
HEADER_MAX_TOP_PT = 50
FOOTER_MIN_TOP_PT = 780
COVER_COLUMN_MIN_LEFT_PT = 400
GUIDANCE_MIN_INDENT_PT = 15
PARAGRAPH_MIN_GAP_PT = 18

CHAPTER_RE = re.compile(r"^(\d+(?: ?[a-z])?) (kap\.|KAP)\s*(.*)$")
OLD_CHAPTER_WORD = "KAP"
SECTION_RE = re.compile(r"^(\d+(?: ?[a-z])?) §\s*(.*)$")
END_OF_TEXT_RE = re.compile(r"^(?:_{5,}|-{5,})$")
SIGNATURE_RE = re.compile(r"^[A-ZÅÄÖÉÜ][A-ZÅÄÖÉÜ.\-]*(?: [A-ZÅÄÖÉÜ][A-ZÅÄÖÉÜ.\-]*)+(?<!\.)$")
SENTENCE_END_RE = re.compile(r"[.:;]$")
DECISION_DATE_RE = re.compile(r"^(?:beslut(?:ad|ade|at)|utfärdade) den \d{1,2} \w+ \d{4}\.?$")
NUMBER_LINE_RE = re.compile(r"^FFFS \d{4}:\d+$")
ITALIC_HEADING_RE = re.compile(r"^(?!FFFS)[A-ZÅÄÖ]")
SPACE_BEFORE_CLOSING_PAREN_RE = re.compile(r"\s+\)")
MISREAD_BULLET_RE = re.compile(r"^í\s")
GUIDANCE_HEADING = "Allmänna råd"


def parse_regulation(lines: list[PdfLine], all_guidance: bool) -> tuple[str, list[SectionDraft]]:
    body = _join_same_height(_body(lines))
    plain_sections = not any(_is_bold_section(line) for line in body)
    start = next(
        (i for i, line in enumerate(body) if _starts_structure(line, plain_sections)), len(body)
    )
    preamble = " ".join(" ".join(line.text for line in body[:start]).split())
    return preamble, _Drafter(body[start:], all_guidance, plain_sections).drafts()


def _body(lines: list[PdfLine]) -> list[PdfLine]:
    cover_bottom = max(
        (line.top for line in lines if line.page == 1 and _ends_cover(line)), default=0
    )
    last_page = max((line.page for line in lines), default=0)

    text_lines = [
        line
        for line in lines
        if not (
            line.page == 1 and (line.top <= cover_bottom or line.left >= COVER_COLUMN_MIN_LEFT_PT)
        )
        and HEADER_MAX_TOP_PT <= line.top <= FOOTER_MIN_TOP_PT
        and NUMBER_LINE_RE.match(line.text) is None
    ]
    min_size = _body_size(text_lines) - BODY_SIZE_MARGIN_PT

    body = []
    for line in text_lines:
        if line.size < min_size:
            continue
        signature = line.page == last_page and SIGNATURE_RE.match(line.text) is not None
        if END_OF_TEXT_RE.match(line.text) or signature:
            break
        body.append(replace(line, text=_clean(line.text)))
    return body


def _ends_cover(line: PdfLine) -> bool:
    return (
        (line.size >= TITLE_MIN_SIZE_PT and line.left < COVER_COLUMN_MIN_LEFT_PT)
        or DECISION_DATE_RE.match(line.text) is not None
        or NUMBER_LINE_RE.match(line.text) is not None
    )


def _body_size(lines: list[PdfLine]) -> float:
    chars_per_size: Counter[float] = Counter()
    for line in lines:
        chars_per_size[line.size] += len(line.text)
    return max(chars_per_size, key=chars_per_size.__getitem__, default=0)


def _join_same_height(lines: list[PdfLine]) -> list[PdfLine]:
    joined: list[PdfLine] = []
    for line in lines:
        previous = joined[-1] if joined else None
        if (
            previous is None
            or previous.page != line.page
            or abs(line.top - previous.top) > SAME_LINE_MAX_GAP_PT
        ):
            joined.append(line)
            continue

        joined[-1] = replace(
            previous,
            text=f"{previous.text} {line.text}",
            bold=previous.bold and line.bold,
            italic=previous.italic and line.italic,
        )
    return joined


def _clean(text: str) -> str:
    text = SPACE_BEFORE_CLOSING_PAREN_RE.sub(")", text)
    # Some PDFs map the dash bullet to "í".
    return MISREAD_BULLET_RE.sub("– ", text)


def _is_bold_section(line: PdfLine) -> bool:
    return line.starts_bold and SECTION_RE.match(line.text) is not None


def _starts_structure(line: PdfLine, plain_sections: bool) -> bool:
    return (
        line.bold
        or _is_bold_section(line)
        or (plain_sections and SECTION_RE.match(line.text) is not None)
        or (line.italic and line.text == GUIDANCE_HEADING)
    )


class _Drafter:
    def __init__(self, lines: list[PdfLine], all_guidance: bool, plain_sections: bool):
        self._lines = lines
        self._all_guidance = all_guidance
        self._plain_sections = plain_sections
        self._margins: dict[int, float] = {}
        for line in lines:
            self._margins[line.page] = min(self._margins.get(line.page, line.left), line.left)
        self._hyphenated_prefixes = hyphenated_prefixes("\n".join(line.text for line in lines))

        self._drafts: list[SectionDraft] = []
        self._current: SectionDraft | None = None
        self._chapter: str | None = None
        self._chapter_title: str | None = None
        self._heading: str | None = None
        self._in_guidance = False
        self._previous: PdfLine | None = None
        self._previous_was_heading = False
        self._previous_was_chapter = False

    def drafts(self) -> list[SectionDraft]:
        for line in self._lines:
            chapter = CHAPTER_RE.match(line.text)
            section = SECTION_RE.match(line.text)
            chapter_size = line.bold and line.size >= CHAPTER_MIN_SIZE_PT
            old_chapter = line.bold and chapter is not None and chapter[2] == OLD_CHAPTER_WORD
            is_chapter = old_chapter or (
                chapter_size and (chapter is not None or self._previous_was_chapter)
            )
            is_section = section is not None and (
                line.starts_bold or (self._plain_sections and self._starts_paragraph(line))
            )
            is_guidance = line.italic and line.text == GUIDANCE_HEADING
            is_heading = not is_guidance and (
                line.bold or (line.italic and ITALIC_HEADING_RE.match(line.text) is not None)
            )

            if is_chapter and chapter:
                self._start_chapter(chapter[1], chapter[3])
            elif is_chapter:
                self._chapter_title = f"{self._chapter_title or ''} {line.text}".strip()
            elif is_section and line.bold and section[2]:
                self._heading = section[2]
                self._start_section(section[1], "")
            elif is_section:
                self._start_section(section[1], section[2])
            elif is_guidance:
                self._start_guidance()
            elif is_heading:
                self._add_heading(line)
            else:
                self._add_text(line)

            self._previous_was_chapter = is_chapter
            self._previous_was_heading = is_heading and not is_chapter and not is_section
            self._previous = line
        return self._drafts

    def _start_chapter(self, number: str, title: str) -> None:
        self._chapter, self._chapter_title = _section_number(number), title or None
        self._heading = self._current = None
        self._in_guidance = False

    def _start_section(self, number: str, text: str) -> None:
        self._in_guidance = False
        self._new_draft(_section_number(number))
        self._current.add_text(text)

    def _start_guidance(self) -> None:
        self._in_guidance = True
        if self._current is None:
            self._new_draft(None)
        self._current.new_paragraph("guidance")

    def _add_heading(self, line: PdfLine) -> None:
        if self._previous_was_heading:
            self._heading = f"{self._heading} {line.text}"
        else:
            self._heading = line.text
            self._current = None
            self._in_guidance = False

    def _add_text(self, line: PdfLine) -> None:
        indented = line.left > self._margins[line.page] + GUIDANCE_MIN_INDENT_PT
        if self._in_guidance and not indented:
            self._in_guidance = False
        rule_type = self._rule_type()

        if self._current is None:
            self._new_draft(None)
            self._current.add_text(line.text)
            return

        new_paragraph = self._starts_paragraph(line)
        is_item = LIST_LINE_RE.match(line.text) is not None

        if rule_type != self._current.rule_types[-1] or (new_paragraph and not is_item):
            self._current.new_paragraph(rule_type)
            self._current.add_text(line.text)
        elif new_paragraph or is_item:
            self._current.new_line()
            self._current.add_text(line.text)
        else:
            self._continue_line(line.text)

    def _starts_paragraph(self, line: PdfLine) -> bool:
        previous = self._previous
        return previous is None or (
            line.top - previous.top > PARAGRAPH_MIN_GAP_PT
            if previous.page == line.page
            else SENTENCE_END_RE.search(previous.text) is not None
        )

    def _continue_line(self, text: str) -> None:
        lines = self._current.lines_per_paragraph[-1]
        lines[-1] = join_wrapped_line(lines[-1], text, self._hyphenated_prefixes)

    def _new_draft(self, section: str | None) -> None:
        self._current = SectionDraft(self._chapter, self._chapter_title, self._heading, section)
        self._current.rule_types[0] = self._rule_type()
        self._drafts.append(self._current)

    def _rule_type(self) -> RuleType:
        return "guidance" if self._all_guidance or self._in_guidance else "binding_rule"


def _section_number(number: str) -> str:
    return re.sub(r"(\d)([a-z])", r"\1 \2", number)
