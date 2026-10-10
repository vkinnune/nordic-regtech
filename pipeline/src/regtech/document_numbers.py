import re

NUMBER_RE = re.compile(r"^\d{4}:\d+$")
FFFS_NUMBER = r"FFFS\s+(\d{4}:\d+)"
FFFS_NUMBER_RE = re.compile(FFFS_NUMBER)
# Consolidated FFFS sections end with "(FFFS 2019:28, FFFS 2024:4)" naming the amending
# regulations; a real reference never opens with a bracket right after a full stop.
AMENDMENT_NOTE_RE = re.compile(rf"(?<=\.)\s*\({FFFS_NUMBER}(?:,\s*{FFFS_NUMBER})*\)")


def number_order(number: str) -> list[int]:
    return [int(part) for part in number.split(":")]
