from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


@dataclass(frozen=True)
class PdfLine:
    page: int
    top: float
    left: float
    size: float
    text: str
    bold: bool
    italic: bool
    starts_bold: bool


class PdfReader(Protocol):
    def read_lines(self, pdf_path: Path) -> list[PdfLine]: ...
