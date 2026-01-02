from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, List, Dict


@dataclass(frozen=True)
class Citation:
    key: str
    source: str
    title: str | None = None
    url: str | None = None
    metadata: dict | None = None


@dataclass
class RenderedSection:
    title: str
    body: str
    citations: List[Citation]
    order: int


@dataclass
class ExportResult:
    document: str
    citations: List[Citation] = field(default_factory=list)


class CitationFormatter:
    def __init__(self) -> None:
        self._index: Dict[str, int] = {}
        self._citations: List[Citation] = []

    def register(self, citations: Iterable[Citation]) -> None:
        for citation in citations:
            if citation.key not in self._index:
                self._index[citation.key] = len(self._citations) + 1
                self._citations.append(citation)

    def annotate_body(self, body: str, citations: Iterable[Citation]) -> str:
        markers = []
        for citation in citations:
            idx = self._index.get(citation.key)
            if idx is None:
                self.register([citation])
                idx = self._index[citation.key]
            markers.append(f"[^${idx}]".replace("$", ""))
        if not markers:
            return body
        return f"{body} {' '.join(markers)}"

    def render_sources_appendix(self) -> str:
        if not self._citations:
            return "_No sources provided._"
        lines = []
        for citation in self._citations:
            idx = self._index[citation.key]
            title = citation.title or "Untitled source"
            source = citation.source
            line = f"[^${idx}]: {title} — {source}".replace("$", "")
            if citation.url:
                line += f" ({citation.url})"
            lines.append(line)
        return "\n".join(lines)
