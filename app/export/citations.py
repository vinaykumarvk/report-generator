from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Mapping, MutableMapping, Sequence


@dataclass(frozen=True)
class Citation:
    """A single citation reference."""

    key: str
    source: str
    title: str | None = None
    url: str | None = None
    metadata: Mapping[str, str] | None = None

    def canonical_key(self) -> str:
        """Return a normalized key used for deduplication."""

        return self.key.strip().lower()


@dataclass
class RenderedSection:
    """Rendered content with associated citations."""

    title: str
    body: str
    citations: List[Citation] = field(default_factory=list)
    order: int | None = None


class CitationFormatter:
    """Builds inline citation markers and source footnotes."""

    def __init__(self) -> None:
        self._index_by_key: MutableMapping[str, int] = {}
        self._ordered_citations: List[Citation] = []

    def register(self, citations: Iterable[Citation]) -> None:
        """Store citations and assign stable footnote numbers."""

        for citation in citations:
            key = citation.canonical_key()
            if key not in self._index_by_key:
                self._index_by_key[key] = len(self._ordered_citations) + 1
                self._ordered_citations.append(citation)

    def inline_marker(self, citation: Citation) -> str:
        """Return the inline footnote marker for a citation."""

        key = citation.canonical_key()
        if key not in self._index_by_key:
            self.register([citation])
        number = self._index_by_key[key]
        return f"[^{number}]"

    def annotate_body(self, body: str, citations: Sequence[Citation]) -> str:
        """Append inline markers to a section body."""

        if not citations:
            return body
        markers = [self.inline_marker(citation) for citation in citations]
        separator = " " if body and not body.endswith((" ", "\n")) else ""
        return f"{body}{separator}{' '.join(markers)}"

    def render_sources_appendix(self) -> str:
        """Render a footnote appendix with source details."""

        lines: List[str] = ["### Sources"]
        if not self._ordered_citations:
            lines.append("_No sources provided._")
            return "\n".join(lines)

        for index, citation in enumerate(self._ordered_citations, start=1):
            descriptor = self._format_citation_descriptor(citation)
            lines.append(f"[^{index}]: {descriptor}")
            lines.extend(self._render_metadata_lines(citation.metadata))
        return "\n".join(lines)

    @staticmethod
    def _format_citation_descriptor(citation: Citation) -> str:
        """Compose a human-readable descriptor for the citation."""

        title = citation.title or "Untitled source"
        parts = [title, f"{citation.source}"]
        if citation.url:
            parts[-1] = f"{parts[-1]} ({citation.url})"
        return " — ".join(parts)

    @staticmethod
    def _render_metadata_lines(metadata: Mapping[str, str] | None) -> List[str]:
        if not metadata:
            return []
        lines = ["  - Metadata:"]
        for key, value in metadata.items():
            safe_key = CitationFormatter._normalize_metadata_key(key)
            lines.append(f"    - {safe_key}: {value}")
        return lines

    @staticmethod
    def _normalize_metadata_key(key: str) -> str:
        sanitized = re.sub(r"[_\s]+", " ", key).strip()
        return sanitized or "unknown"

