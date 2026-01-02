from __future__ import annotations

from io import BytesIO
from typing import Iterable

from docx import Document


class DocxExporter:
    def render(self, markdown: str, from_markdown: bool = True) -> bytes:
        document = Document()
        text = markdown
        if from_markdown:
            text = markdown.replace("# ", "").replace("## ", "").strip()
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        if not paragraphs:
            paragraphs = ["No content available."]
        for para in paragraphs:
            document.add_paragraph(para)

        buffer = BytesIO()
        document.save(buffer)
        return buffer.getvalue()
