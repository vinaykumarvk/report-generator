from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, List, Mapping, Sequence

from app.export.citations import CitationFormatter, RenderedSection


@dataclass
class MarkdownExportResult:
    """Structured result for the generated Markdown document."""

    document: str
    sections: Sequence[RenderedSection]
    toc: List[str]


class MarkdownExporter:
    """Assemble rendered sections plus metadata into a Markdown document."""

    def __init__(self, include_toc: bool = True, document_title: str = "Report") -> None:
        self.include_toc = include_toc
        self.document_title = document_title

    def export(
        self,
        sections: Iterable[RenderedSection],
        report_metadata: Mapping[str, str] | None = None,
    ) -> MarkdownExportResult:
        ordered_sections = self._order_sections(list(sections))
        citation_formatter = CitationFormatter()
        for section in ordered_sections:
            citation_formatter.register(section.citations)

        toc_block: List[str] = []
        parts: List[str] = [f"# {self.document_title}"]
        if self.include_toc:
            toc_block = self._render_toc(ordered_sections)
            parts.append("\n".join(toc_block))

        parts.append(self._render_sections(ordered_sections, citation_formatter))
        parts.append(self._render_appendix(citation_formatter, report_metadata))

        document = "\n\n".join(part for part in parts if part)
        return MarkdownExportResult(document=document, sections=ordered_sections, toc=toc_block)

    @staticmethod
    def _order_sections(sections: List[RenderedSection]) -> List[RenderedSection]:
        def sort_key(section: RenderedSection) -> tuple[int, str]:
            return (section.order if section.order is not None else 0, section.title)

        return sorted(sections, key=sort_key)

    def _render_toc(self, sections: Sequence[RenderedSection]) -> List[str]:
        lines = ["## Table of Contents"]
        for index, section in enumerate(sections, start=1):
            anchor = self._slug(section.title)
            lines.append(f"- [{index}. {section.title}](#{anchor})")
        return lines

    def _render_sections(
        self, sections: Sequence[RenderedSection], formatter: CitationFormatter
    ) -> str:
        lines: List[str] = []
        for index, section in enumerate(sections, start=1):
            lines.append(f"## {index}. {section.title}")
            annotated_body = formatter.annotate_body(section.body.strip(), section.citations)
            lines.append(annotated_body)
        return "\n\n".join(lines)

    def _render_appendix(
        self, formatter: CitationFormatter, report_metadata: Mapping[str, str] | None
    ) -> str:
        metadata_block = self._render_metadata(report_metadata)
        sources_block = formatter.render_sources_appendix()

        lines = ["## Appendix", sources_block]
        if metadata_block:
            lines.append(metadata_block)
        return "\n\n".join(lines)

    @staticmethod
    def _render_metadata(report_metadata: Mapping[str, str] | None) -> str:
        if not report_metadata:
            return ""
        lines = ["### Metadata"]
        for key, value in report_metadata.items():
            lines.append(f"- **{key}**: {value}")
        return "\n".join(lines)

    @staticmethod
    def _slug(title: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
        return slug or "section"

