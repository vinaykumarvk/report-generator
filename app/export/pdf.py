from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

import markdown
from xhtml2pdf import pisa


BASE_STYLES = """
@page {
    size: A4;
    margin: 20mm 15mm;
}
body {
    font-family: Arial, sans-serif;
    font-size: 12pt;
    color: #222;
}
h1, h2, h3 {
    color: #0a3a60;
}
"""


@dataclass
class PdfExporter:
    """Render Markdown or HTML into a PDF document using a headless HTML renderer."""

    from_markdown: bool = True

    def render(self, content: str, *, extra_styles: str | None = None) -> bytes:
        """
        Convert content into a PDF document.

        Args:
            content: Markdown or HTML content.
            extra_styles: Optional CSS to inline into the document for rendering.

        Returns:
            Bytes of the generated PDF.
        """
        html = markdown.markdown(content, extensions=["extra"]) if self.from_markdown else content
        combined_styles = BASE_STYLES + (extra_styles or "")
        document = f"<html><head><style>{combined_styles}</style></head><body>{html}</body></html>"

        buffer = BytesIO()
        result = pisa.CreatePDF(document, dest=buffer, encoding="utf-8")
        if result.err:
            raise ValueError("Failed to render PDF content.")

        buffer.seek(0)
        return buffer.read()

