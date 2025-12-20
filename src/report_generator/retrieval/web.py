from __future__ import annotations

from typing import Any, Iterable, List, Protocol

from ..types import EvidenceItem, RetrievalFilters


class WebSearchProvider(Protocol):
    name: str

    def search(
        self, query: str, *, filters: RetrievalFilters | None = None, limit: int = 5
    ) -> Iterable[dict[str, Any]]:
        ...


class WebRetriever:
    """Wrapper around a configurable web search provider."""

    def __init__(self, provider: WebSearchProvider) -> None:
        self.provider = provider

    def retrieve(
        self, query: str, *, filters: RetrievalFilters | None = None, limit: int = 5
    ) -> List[EvidenceItem]:
        results = self.provider.search(query, filters=filters, limit=limit)
        evidence: List[EvidenceItem] = []
        for idx, item in enumerate(results):
            evidence.append(
                EvidenceItem(
                    id=str(item.get("id", f"{self.provider.name}-{idx}")),
                    content=item.get("content", item.get("snippet", "")),
                    metadata=item.get("metadata", {}) or {},
                    score=float(item.get("score", 0.0)),
                    source=item.get("source", self.provider.name),
                    kind="web",
                )
            )
        return evidence
