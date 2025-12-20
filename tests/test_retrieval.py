import json
from typing import Any, Dict, Iterable, Mapping, Sequence

import pytest

from report_generator.cache import RetrievalCache
from report_generator.metrics import RetrievalMetrics
from report_generator.policy import EvidencePolicy
from report_generator.retrieval.router import RetrievalRouter
from report_generator.retrieval.vector import PgVectorRetriever
from report_generator.retrieval.web import WebRetriever
from report_generator.types import EvidenceBundle, EvidenceItem, RetrievalFilters


class StubVectorRetriever(PgVectorRetriever):
    def __init__(self, rows: Iterable[Mapping[str, Any]]):
        self.calls = 0
        super().__init__(executor=self._executor)
        self._rows = list(rows)

    def _executor(self, sql: str, params: Sequence[Any]):
        self.calls += 1
        self.last_sql = sql
        self.last_params = params
        return self._rows


class StubWebProvider:
    name = "stub-web"

    def __init__(self, results: Iterable[Dict[str, Any]]):
        self.results = list(results)
        self.calls = 0

    def search(
        self, query: str, *, filters: RetrievalFilters | None = None, limit: int = 5
    ):
        self.calls += 1
        self.last_query = query
        self.last_filters = filters
        self.last_limit = limit
        return self.results


def test_pgvector_retriever_builds_query_with_filters():
    rows = [
        {
            "id": "doc-1",
            "content": "hello world",
            "metadata": {"tenant": "acme"},
            "score": 0.8,
            "source": "pg",
        }
    ]
    retriever = StubVectorRetriever(rows)
    filters = RetrievalFilters(metadata={"tenant": "acme"}, source_ids=["pg"])

    results = retriever.retrieve([0.1, 0.2, 0.3], filters=filters, limit=3)

    assert isinstance(results[0], EvidenceItem)
    assert "metadata @> %s::jsonb" in retriever.last_sql
    assert "source = ANY(%s)" in retriever.last_sql
    assert retriever.last_params[0] == json.dumps(filters.metadata)
    assert retriever.last_params[-1] == 3


def test_router_uses_cache_and_metrics():
    vector_rows = [{"id": "v1", "content": "c", "metadata": {}, "score": 0.9, "source": "pg"}]
    vector = StubVectorRetriever(vector_rows)
    cache = RetrievalCache()
    metrics = RetrievalMetrics()
    router = RetrievalRouter(vector=vector, cache=cache, metrics=metrics)

    filters = RetrievalFilters(metadata={"tenant": "acme"})
    first = router.retrieve(
        EvidencePolicy.VECTOR_ONLY, "query", query_embedding=[0.1], filters=filters, limit=5
    )
    second = router.retrieve(
        EvidencePolicy.VECTOR_ONLY, "query", query_embedding=[0.1], filters=filters, limit=5
    )

    assert isinstance(first, EvidenceBundle)
    assert isinstance(second, EvidenceBundle)
    assert vector.calls == 1  # cached second call
    assert cache.hits == 1
    assert cache.misses == 1
    assert metrics.cache_hits == 1
    assert metrics.cache_misses == 1
    assert metrics.vector_requests == 1


def test_policy_routing_respects_policy_modes():
    vector_rows = [
        {"id": "v1", "content": "vector", "metadata": {}, "score": 0.9, "source": "pg"}
    ]
    web_results = [
        {"id": "w1", "content": "web", "metadata": {}, "score": 0.4, "source": "search"}
    ]
    vector = StubVectorRetriever(vector_rows)
    web = WebRetriever(StubWebProvider(web_results))
    router = RetrievalRouter(vector=vector, web=web)

    bundle = router.retrieve(
        EvidencePolicy.VECTOR_AND_WEB,
        "query",
        query_embedding=[0.5],
        filters=None,
        limit=2,
    )
    assert len(bundle.vector) == 1
    assert len(bundle.web) == 1

    bundle_vector_only = router.retrieve(
        EvidencePolicy.VECTOR_ONLY, "query", query_embedding=[0.5]
    )
    assert bundle_vector_only.web == []
    assert len(bundle_vector_only.vector) == 1

    # Fallback to web when vector is empty
    empty_vector = StubVectorRetriever([])
    router_fallback = RetrievalRouter(vector=empty_vector, web=web)
    fallback_bundle = router_fallback.retrieve(
        EvidencePolicy.VECTOR_THEN_WEB, "query", query_embedding=[0.1]
    )
    assert fallback_bundle.vector == []
    assert fallback_bundle.web


def test_evidence_bundle_combined_returns_all_items():
    bundle = EvidenceBundle(
        policy=EvidencePolicy.WEB_ONLY,
        vector=[EvidenceItem(id="1", content="a", score=0.1, source="pg", kind="vector")],
        web=[EvidenceItem(id="2", content="b", score=0.2, source="web", kind="web")],
    )

    combined = bundle.combined()
    assert len(combined) == 2
    assert {item.id for item in combined} == {"1", "2"}
