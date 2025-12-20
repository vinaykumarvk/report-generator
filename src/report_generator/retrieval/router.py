from __future__ import annotations

import copy
from typing import List

from ..cache import RetrievalCache
from ..metrics import RetrievalMetrics
from ..policy import EvidencePolicy
from ..types import EvidenceBundle, EvidenceItem, RetrievalFilters
from .vector import PgVectorRetriever
from .web import WebRetriever


class RetrievalRouter:
    """Route retrieval requests to vector and/or web providers based on policy."""

    def __init__(
        self,
        *,
        vector: PgVectorRetriever | None = None,
        web: WebRetriever | None = None,
        cache: RetrievalCache | None = None,
        metrics: RetrievalMetrics | None = None,
    ) -> None:
        self.vector = vector
        self.web = web
        self.cache = cache or RetrievalCache()
        self.metrics = metrics or RetrievalMetrics()

    def retrieve(
        self,
        policy: EvidencePolicy,
        query: str,
        *,
        query_embedding: list[float] | None = None,
        filters: RetrievalFilters | None = None,
        limit: int = 5,
    ) -> EvidenceBundle:
        """Retrieve evidence according to the requested policy."""
        self.metrics.record_policy(policy)

        def loader() -> EvidenceBundle:
            return self._execute(policy, query, query_embedding, filters, limit)

        bundle, hit = self.cache.get_or_set(
            policy=policy, query=query, filters=filters, limit=limit, loader=loader
        )
        self.metrics.record_cache_hit(hit)
        return bundle

    def _execute(
        self,
        policy: EvidencePolicy,
        query: str,
        query_embedding: list[float] | None,
        filters: RetrievalFilters | None,
        limit: int,
    ) -> EvidenceBundle:
        vector_items: List[EvidenceItem] = []
        web_items: List[EvidenceItem] = []

        if policy == EvidencePolicy.VECTOR_ONLY:
            vector_items = self._retrieve_vector(query_embedding, filters, limit)
        elif policy == EvidencePolicy.WEB_ONLY:
            web_items = self._retrieve_web(query, filters, limit)
        elif policy == EvidencePolicy.VECTOR_AND_WEB:
            vector_items = self._retrieve_vector(query_embedding, filters, limit)
            web_items = self._retrieve_web(query, filters, limit)
        elif policy == EvidencePolicy.VECTOR_THEN_WEB:
            vector_items = self._retrieve_vector(query_embedding, filters, limit)
            if not vector_items:
                web_items = self._retrieve_web(query, filters, limit)
        elif policy == EvidencePolicy.WEB_THEN_VECTOR:
            web_items = self._retrieve_web(query, filters, limit)
            if not web_items:
                vector_items = self._retrieve_vector(query_embedding, filters, limit)
        else:
            raise ValueError(f"Unknown policy: {policy}")

        return EvidenceBundle(
            policy=policy,
            vector=copy.deepcopy(vector_items),
            web=copy.deepcopy(web_items),
        )

    def _retrieve_vector(
        self,
        query_embedding: list[float] | None,
        filters: RetrievalFilters | None,
        limit: int,
    ) -> List[EvidenceItem]:
        if not self.vector:
            raise ValueError("Vector retriever not configured")
        self.metrics.record_vector_request()
        return self.vector.retrieve(query_embedding, filters=filters, limit=limit)

    def _retrieve_web(
        self, query: str, filters: RetrievalFilters | None, limit: int
    ) -> List[EvidenceItem]:
        if not self.web:
            raise ValueError("Web retriever not configured")
        self.metrics.record_web_request()
        return self.web.retrieve(query, filters=filters, limit=limit)
