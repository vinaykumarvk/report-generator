from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Dict

from .citations import CitationFormatter, RenderedSection, ExportResult


@dataclass
class MarkdownExporter:
    document_title: str = "Evidence Report"

    def export(
        self,
        sections: Iterable[RenderedSection],
        report_metadata: Dict[str, str] | None = None,
    ) -> ExportResult:
        formatter = CitationFormatter()
        sections_list = sorted(list(sections), key=lambda s: s.order)
        for section in sections_list:
            formatter.register(section.citations)

        lines: List[str] = [f"# {self.document_title}", "", "## Table of Contents"]
        for idx, section in enumerate(sections_list, start=1):
            anchor = section.title.strip().lower().replace(" ", "-")
            lines.append(f"- [{idx}. {section.title}](#{anchor})")

        for idx, section in enumerate(sections_list, start=1):
            lines.append("")
            lines.append(f"## {idx}. {section.title}")
            body = formatter.annotate_body(section.body, section.citations)
            lines.append(body)

        lines.append("")
        lines.append("## Appendix")
        lines.append("### Sources")
        lines.append(formatter.render_sources_appendix())

        lines.append("")
        lines.append("### Metadata")
        if report_metadata:
            for key, value in report_metadata.items():
                lines.append(f"**{key}**: {value}")
        else:
            lines.append("_No metadata provided._")

        document = "\n".join(lines).strip() + "\n"
        return ExportResult(document=document, citations=list(formatter._citations))
