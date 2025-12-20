from __future__ import annotations

import json
from typing import Any, Callable, Iterable, List, Mapping, Sequence

from ..types import EvidenceItem, RetrievalFilters


class PgVectorRetriever:
    """Retriever that queries a pgvector-backed table."""

    def __init__(
        self,
        *,
        executor: Callable[[str, Sequence[Any]], Iterable[Mapping[str, Any]]],
        table: str = "documents",
        embedding_column: str = "embedding",
        metadata_column: str = "metadata",
        id_column: str = "id",
        content_column: str = "content",
        source_column: str = "source",
    ) -> None:
        self.executor = executor
        self.table = table
        self.embedding_column = embedding_column
        self.metadata_column = metadata_column
        self.id_column = id_column
        self.content_column = content_column
        self.source_column = source_column

    def _build_where_clause(
        self, filters: RetrievalFilters | None
    ) -> tuple[str, List[Any]]:
        clauses: List[str] = []
        params: List[Any] = []

        if filters and filters.metadata:
            clauses.append(f"{self.metadata_column} @> %s::jsonb")
            params.append(json.dumps(filters.metadata))

        if filters and filters.source_ids:
            clauses.append(f"{self.source_column} = ANY(%s)")
            params.append(filters.source_ids)

        if filters and filters.tags:
            clauses.append(f"({self.metadata_column} -> 'tags') ?| %s::text[]")
            params.append(filters.tags)

        if not clauses:
            return "", params

        return "WHERE " + " AND ".join(clauses), params

    def retrieve(
        self,
        query_embedding: Sequence[float] | None,
        *,
        filters: RetrievalFilters | None = None,
        limit: int = 5,
    ) -> List[EvidenceItem]:
        if query_embedding is None:
            raise ValueError("query_embedding is required for vector retrieval")

        where_clause, params = self._build_where_clause(filters)
        sql = f"""
        SELECT
            {self.id_column} AS id,
            {self.content_column} AS content,
            {self.metadata_column} AS metadata,
            1 - ({self.embedding_column} <=> %s::vector) AS score,
            {self.source_column} AS source
        FROM {self.table}
        {where_clause}
        ORDER BY {self.embedding_column} <-> %s::vector
        LIMIT %s
        """
        params = params + [query_embedding, query_embedding, limit]

        rows = self.executor(sql, params)
        evidence_items: List[EvidenceItem] = []
        for row in rows:
            evidence_items.append(
                EvidenceItem(
                    id=str(row.get("id")),
                    content=row.get("content", ""),
                    metadata=row.get("metadata", {}) or {},
                    score=float(row.get("score", 0.0)),
                    source=str(row.get("source", "vector")),
                    kind="vector",
                )
            )

        return evidence_items
