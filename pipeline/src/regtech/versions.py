import re
from collections import Counter
from datetime import date
from difflib import SequenceMatcher
from typing import Literal

from regtech.document_numbers import AMENDMENT_NOTE_RE, FFFS_NUMBER_RE, number_order
from regtech.models import Change, ChangeStatus, LegalDocument, LegalSection

SectionKey = tuple[str | None, str | None, bool, int]
DiffPart = tuple[Literal["equal", "delete", "insert"], str]

SFS_NOTE_RE = re.compile(r"\b(?:[Ll]ag|[Ff]örordning) \((\d{4}:\d+)\)\.?\s*$")
REPEALED_RE = re.compile(r"^Har upphävts genom\b")
WORD_RE = re.compile(r"\S+\s*")


def section_keys(sections: list[LegalSection]) -> list[SectionKey]:
    seen: Counter[tuple[str | None, str | None, bool]] = Counter()
    keys = []
    for section in sections:
        number = (section.chapter, section.section, section.upcoming)
        keys.append((*number, seen[number]))
        seen[number] += 1
    return keys


def chunk_ids(doc: LegalDocument) -> dict[SectionKey, str]:
    return {
        key: section.chunk_id
        for key, section in zip(section_keys(doc.sections), doc.sections, strict=True)
    }


def document_changes(old: LegalDocument | None, new: LegalDocument) -> list[Change]:
    if old is None:
        return [_document_change(new, "ADDED", None, new.effective_date)]
    if _is_repealed(new) and not _is_repealed(old):
        return [_document_change(new, "REPEALED", new.repealed_by, new.repealed_on)]
    return []


def upcoming_changes(old: LegalDocument | None, new: LegalDocument) -> list[Change]:
    old_sections = _by_key(old)
    new_sections = _by_key(new)
    earlier_wordings: dict[tuple[str | None, str | None], LegalSection] = {}
    changes = []

    for key, section in new_sections.items():
        earlier = earlier_wordings.get(key[:2])
        earlier_wordings[key[:2]] = section
        if not section.upcoming:
            continue
        if key in old_sections and _same_text(old_sections[key], section):
            continue

        if earlier is None or not _same_text(earlier, section):
            changes.append(_change(new, key, earlier, section))
    return changes


def version_changes(old: LegalDocument | None, new: LegalDocument) -> list[Change]:
    if old is None:
        return []

    old_sections = _by_key(old)
    new_sections = _by_key(new)
    changes = []

    for key, section in new_sections.items():
        old_section = old_sections.get(key)
        if section.upcoming or (old_section is not None and _same_text(old_section, section)):
            continue
        changes.append(_change(new, key, old_section, section))

    # An upcoming wording that is gone has taken effect (or been withdrawn), not been repealed.
    for key, old_section in old_sections.items():
        if key not in new_sections and not old_section.upcoming:
            changes.append(_change(new, key, old_section, None))
    return changes


def text_diff(old_text: str, new_text: str) -> list[DiffPart]:
    old_words = WORD_RE.findall(old_text)
    new_words = WORD_RE.findall(new_text)
    matcher = SequenceMatcher(
        None, [word.strip() for word in old_words], [word.strip() for word in new_words], False
    )

    parts: list[DiffPart] = []
    for op, old_start, old_end, new_start, new_end in matcher.get_opcodes():
        if op == "equal":
            parts.append(("equal", "".join(new_words[new_start:new_end])))
        if op in ("delete", "replace"):
            parts.append(("delete", "".join(old_words[old_start:old_end])))
        if op in ("insert", "replace"):
            parts.append(("insert", "".join(new_words[new_start:new_end])))
    return parts


def _by_key(doc: LegalDocument | None) -> dict[SectionKey, LegalSection]:
    if doc is None:
        return {}
    return dict(zip(section_keys(doc.sections), doc.sections, strict=True))


def _same_text(first: LegalSection, second: LegalSection) -> bool:
    return first.full_text.split() == second.full_text.split()


def _change(
    doc: LegalDocument,
    key: SectionKey,
    old_section: LegalSection | None,
    new_section: LegalSection | None,
) -> Change:
    act = _amending_act(new_section.full_text) if new_section else None
    in_force_from = new_section.in_force_from if new_section else None

    return Change(
        document_id=doc.id,
        chapter=key[0],
        section=key[1],
        upcoming=key[2],
        ordinal=key[3],
        status=_status(old_section, new_section),
        old_text=old_section.full_text if old_section else None,
        new_text=new_section.full_text if new_section else None,
        amending_act=act,
        amended_date=in_force_from or doc.amendment_dates.get(act or ""),
        fetched_at=doc.updated_at,
    )


def _document_change(
    doc: LegalDocument, status: ChangeStatus, act: str | None, day: date | None
) -> Change:
    return Change(
        document_id=doc.id,
        level="document",
        status=status,
        amending_act=act,
        amended_date=day,
        fetched_at=doc.updated_at,
    )


def _is_repealed(doc: LegalDocument) -> bool:
    return doc.repealed_on is not None or doc.repealed_by is not None


def _status(old_section: LegalSection | None, new_section: LegalSection | None) -> ChangeStatus:
    if new_section is None or REPEALED_RE.match(new_section.full_text):
        return "REPEALED"
    if old_section is None:
        return "ADDED"
    return "MODIFIED"


def _amending_act(text: str) -> str | None:
    sfs_note = SFS_NOTE_RE.search(text)
    if sfs_note:
        return f"SFS {sfs_note[1]}"

    numbers = [
        number for note in AMENDMENT_NOTE_RE.finditer(text)
        for number in FFFS_NUMBER_RE.findall(note[0])
    ]  # fmt: skip
    return f"FFFS {max(numbers, key=number_order)}" if numbers else None
