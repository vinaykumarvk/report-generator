from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
import tempfile
from typing import Iterable, Mapping

from bs4 import BeautifulSoup
from docx import Document
from docxtpl import DocxTemplate, RichText
import markdown


def _html_to_paragraphs(html: str) -> list[str]:
    """Extract readable paragraphs from HTML."""
    soup = BeautifulSoup(html, "html.parser")
    paragraphs: list[str] = []

    for tag in soup.find_all(["h1", "h2", "h3", "p", "li"]):
        text = tag.get_text(separator=" ", strip=True)
        if text:
            paragraphs.append(text)

    if not paragraphs:
        text = soup.get_text(separator="\n", strip=True)
        if text:
            paragraphs = [line for line in text.splitlines() if line.strip()]

    return paragraphs


@dataclass
class DocxExporter:
    """Render Markdown or HTML into a DOCX document using docxtpl."""

    template_path: str | None = None

    def render(
        self,
        content: str,
        *,
        from_markdown: bool = True,
        metadata: Mapping[str, str] | None = None,
    ) -> bytes:
        """
        Convert content into a DOCX document.

        Args:
            content: Markdown or HTML string to render.
            from_markdown: If True, treat the content as Markdown and convert to HTML first.
            metadata: Optional mapping to populate core document properties.

        Returns:
            A bytes object containing the DOCX file.
        """
        html = markdown.markdown(content, extensions=["extra"]) if from_markdown else content
        paragraphs = _html_to_paragraphs(html)

        template, generated_path = self._load_template()
        try:
            self._apply_metadata(template, metadata)
            template.render({"content": self._build_rich_text(paragraphs)})
            buffer = BytesIO()
            template.save(buffer)
            buffer.seek(0)
            return buffer.read()
        finally:
            if generated_path and generated_path.exists():
                generated_path.unlink()

    def _load_template(self) -> tuple[DocxTemplate, Path | None]:
        """Load a template or create a minimal one on the fly."""
        if self.template_path:
            return DocxTemplate(self.template_path), None

        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp:
            document = Document()
            document.add_paragraph("{{ content }}")
            document.save(tmp.name)
            generated_path = Path(tmp.name)

        return DocxTemplate(generated_path), generated_path

    @staticmethod
    def _apply_metadata(template: DocxTemplate, metadata: Mapping[str, str] | None) -> None:
        if not metadata:
            return

        props = template.doc.core_properties
        for key, value in metadata.items():
            if hasattr(props, key):
                setattr(props, key, str(value))

    @staticmethod
    def _build_rich_text(paragraphs: Iterable[str]) -> RichText:
        blocks = list(paragraphs)
        rich = RichText()
        for index, paragraph in enumerate(blocks):
            rich.add(paragraph)
            if index != len(blocks) - 1:
                rich.add("\n")
        return rich
