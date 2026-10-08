from pathlib import Path

import pymupdf

from regtech.pdf.base import PdfLine

SUPERSCRIPT_FLAG = 1
ITALIC_FLAG = 2
BOLD_FLAG = 16
MIN_SPAN_SIZE_PT = 4.0


class PyMuPdfReader:
    def read_lines(self, pdf_path: Path) -> list[PdfLine]:
        lines = []
        with pymupdf.open(pdf_path) as doc:
            for page_number, page in enumerate(doc, start=1):
                page_lines = [
                    line
                    for block in page.get_text("dict")["blocks"]
                    for raw_line in block.get("lines", [])
                    if (line := _line(page_number, raw_line))
                ]
                lines += sorted(page_lines, key=lambda line: (round(line.top), line.left))
        return lines


def _line(page_number: int, raw_line: dict) -> PdfLine | None:
    spans = [
        span
        for span in raw_line["spans"]
        if not span["flags"] & SUPERSCRIPT_FLAG and span["size"] >= MIN_SPAN_SIZE_PT
    ]
    text_spans = [span for span in spans if span["text"].strip()]
    if not text_spans:
        return None

    return PdfLine(
        page=page_number,
        top=raw_line["bbox"][1],
        left=text_spans[0]["bbox"][0],
        size=text_spans[0]["size"],
        text="".join(span["text"] for span in spans).strip(),
        bold=all(span["flags"] & BOLD_FLAG for span in text_spans),
        italic=all(span["flags"] & ITALIC_FLAG for span in text_spans),
        starts_bold=bool(text_spans[0]["flags"] & BOLD_FLAG),
    )
