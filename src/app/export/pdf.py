from __future__ import annotations

from io import BytesIO
from html import unescape
from html.parser import HTMLParser

import markdown as md

try:  # Optional, avoids heavy native deps in test env.
    from xhtml2pdf import pisa
except Exception:  # pragma: no cover - fallback path handles missing dep.
    pisa = None

try:  # Pure-Python fallback for tests/local envs.
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
except Exception:  # pragma: no cover - fallback path handles missing dep.
    canvas = None
    letter = None


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "br", "li"}:
            self._chunks.append("\n")

    def handle_data(self, data: str) -> None:
        if data:
            self._chunks.append(data)

    def text(self) -> str:
        raw = unescape("".join(self._chunks))
        lines = [line.strip() for line in raw.splitlines()]
        return "\n".join(line for line in lines if line)


class PdfExporter:
    def __init__(self, from_markdown: bool = True) -> None:
        self.from_markdown = from_markdown

    def render(self, content: str) -> bytes:
        html = content
        if self.from_markdown:
            html = md.markdown(content)
        if pisa is not None:
            output = BytesIO()
            result = pisa.CreatePDF(html, dest=output)
            if result.err:
                raise RuntimeError("Failed to render PDF")
            return output.getvalue()

        if canvas is None or letter is None:
            raise RuntimeError("PDF export dependencies missing")

        extractor = _TextExtractor()
        extractor.feed(html)
        text = extractor.text() or " "

        output = BytesIO()
        pdf_canvas = canvas.Canvas(output, pagesize=letter)
        text_obj = pdf_canvas.beginText(40, 750)
        for line in text.splitlines():
            text_obj.textLine(line)
        pdf_canvas.drawText(text_obj)
        pdf_canvas.showPage()
        pdf_canvas.save()
        return output.getvalue()
