import html
import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Literal

from regtech.models import LegalDocument, LegalSection

WORD_RE = re.compile(r"\S+\s*")
REPEALED_RE = re.compile(r"^(?:Har upphävts genom\b|[Uu]pphävd\b|.*\bska upphöra att gälla\b)")

Status = Literal["MODIFIED", "ADDED", "REPEALED", "UNCHANGED"]


@dataclass
class SectionDiff:
    chapter: str | None
    section: str | None
    heading: str | None
    status: Status
    old_text: str | None
    new_text: str | None
    diff_html: str
    base_section: LegalSection | None = None
    amendment_section: LegalSection | None = None


@dataclass
class DiffSummary:
    total: int
    modified: int
    added: int
    repealed: int
    unchanged: int


def render_diff_html(old_text: str | None, new_text: str | None) -> str:
    """Render semantic token/word-level diff with <del> and <ins> tags."""
    if not old_text and not new_text:
        return ""
    if not old_text:
        return (
            '<ins class="diff-ins bg-green-100 text-green-800 font-semibold no-underline px-0.5'
            f' rounded">{html.escape(new_text)}</ins>'
        )
    if not new_text:
        return (
            '<del class="diff-del bg-red-100 text-red-800 line-through px-0.5'
            f' rounded">{html.escape(old_text)}</del>'
        )

    old_words = WORD_RE.findall(old_text)
    new_words = WORD_RE.findall(new_text)

    # If regex split produced no words (e.g. whitespace-only), fallback to whole string comparison
    if not old_words or not new_words:
        if old_text.strip() == new_text.strip():
            return html.escape(new_text)
        return (
            '<del class="diff-del bg-red-100 text-red-800 line-through px-0.5'
            f' rounded">{html.escape(old_text)}</del>'
            '<ins class="diff-ins bg-green-100 text-green-800 font-semibold no-underline px-0.5'
            f' rounded">{html.escape(new_text)}</ins>'
        )

    matcher = SequenceMatcher(
        None,
        [w.strip() for w in old_words],
        [w.strip() for w in new_words],
        autojunk=False,
    )

    out: list[str] = []
    for op, old_start, old_end, new_start, new_end in matcher.get_opcodes():
        if op == "equal":
            segment = "".join(new_words[new_start:new_end])
            out.append(html.escape(segment))
        elif op == "delete":
            segment = "".join(old_words[old_start:old_end])
            trimmed = segment.rstrip()
            trailing = segment[len(trimmed) :]
            out.append(
                '<del class="diff-del bg-red-100 text-red-800 line-through px-0.5'
                f' rounded">{html.escape(trimmed)}</del>{trailing}'
            )
        elif op == "insert":
            segment = "".join(new_words[new_start:new_end])
            trimmed = segment.rstrip()
            trailing = segment[len(trimmed) :]
            out.append(
                '<ins class="diff-ins bg-green-100 text-green-800 font-semibold no-underline px-0.5'
                f' rounded">{html.escape(trimmed)}</ins>{trailing}'
            )
        elif op == "replace":
            del_segment = "".join(old_words[old_start:old_end])
            del_trimmed = del_segment.rstrip()
            del_trailing = del_segment[len(del_trimmed) :]
            ins_segment = "".join(new_words[new_start:new_end])
            ins_trimmed = ins_segment.rstrip()
            ins_trailing = ins_segment[len(ins_trimmed) :]

            out.append(
                '<del class="diff-del bg-red-100 text-red-800 line-through px-0.5'
                f' rounded">{html.escape(del_trimmed)}</del>{del_trailing}'
            )
            out.append(
                '<ins class="diff-ins bg-green-100 text-green-800 font-semibold no-underline px-0.5'
                f' rounded">{html.escape(ins_trimmed)}</ins>{ins_trailing}'
            )

    return "".join(out)


def align_sections(
    base_doc: LegalDocument,
    amendment_doc: LegalDocument,
) -> tuple[list[SectionDiff], DiffSummary]:
    """Compare matching sections between base regulation and amendment act."""
    base_map: dict[tuple[str | None, str | None], LegalSection] = {}
    for s in base_doc.sections:
        c = s.chapter.strip() if s.chapter else None
        sec = s.section.strip() if s.section else None
        base_map[(c, sec)] = s

    diffs: list[SectionDiff] = []

    if amendment_doc.sections:
        for a_sec in amendment_doc.sections:
            chap = a_sec.chapter.strip() if a_sec.chapter else None
            sec = a_sec.section.strip() if a_sec.section else None
            key = (chap, sec)
            base_sec = base_map.get(key)

            # Resilient fallback: if chapter wasn't specified in amendment section,
            # match by unambiguous section number in base
            if base_sec is None and chap is None and sec is not None:
                candidates = [
                    s
                    for s in base_doc.sections
                    if (s.section.strip() if s.section else None) == sec
                ]
                if len(candidates) == 1:
                    base_sec = candidates[0]
                    chap = base_sec.chapter.strip() if base_sec.chapter else None

            if a_sec.full_text and REPEALED_RE.search(a_sec.full_text):
                status: Status = "REPEALED"
                old_t = base_sec.full_text if base_sec else None
                new_t = None
                diff_h = (
                    '<del class="diff-del bg-red-100 text-red-800 line-through px-0.5'
                    f' rounded">{html.escape(old_t or a_sec.full_text)}</del>'
                )
            elif base_sec is None:
                status = "ADDED"
                old_t = None
                new_t = a_sec.full_text
                diff_h = (
                    '<ins class="diff-ins bg-green-100 text-green-800 font-semibold no-underline'
                    f' px-0.5 rounded">{html.escape(new_t)}</ins>'
                )
            else:
                old_t = base_sec.full_text
                new_t = a_sec.full_text
                if old_t.split() == new_t.split():
                    status = "UNCHANGED"
                    diff_h = html.escape(new_t)
                else:
                    status = "MODIFIED"
                    diff_h = render_diff_html(old_t, new_t)

            heading = a_sec.heading or (base_sec.heading if base_sec else None)
            diffs.append(
                SectionDiff(
                    chapter=chap,
                    section=sec,
                    heading=heading,
                    status=status,
                    old_text=old_t,
                    new_text=new_t,
                    diff_html=diff_h,
                    base_section=base_sec,
                    amendment_section=a_sec,
                )
            )
    else:
        # Fallback when amendment document has no segmented sections (preamble or whole-document act)
        diff_h = render_diff_html(
            "\n\n".join(s.full_text for s in base_doc.sections),
            amendment_doc.title,
        )
        diffs.append(
            SectionDiff(
                chapter=None,
                section=None,
                heading=amendment_doc.title,
                status="MODIFIED",
                old_text=None,
                new_text=None,
                diff_html=diff_h,
            )
        )

    summary = DiffSummary(
        total=len(diffs),
        modified=sum(1 for d in diffs if d.status == "MODIFIED"),
        added=sum(1 for d in diffs if d.status == "ADDED"),
        repealed=sum(1 for d in diffs if d.status == "REPEALED"),
        unchanged=sum(1 for d in diffs if d.status == "UNCHANGED"),
    )

    return diffs, summary
