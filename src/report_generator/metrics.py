from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, DefaultDict, Dict


@dataclass
class RetrievalMetrics:
    """Metrics for retrieval operations."""

    vector_requests: int = 0
    web_requests: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    policy_counts: DefaultDict[Any, int] = field(
        default_factory=lambda: defaultdict(int)
    )

    def record_policy(self, policy: Any) -> None:
        self.policy_counts[policy] += 1

    def record_cache_hit(self, was_hit: bool) -> None:
        if was_hit:
            self.cache_hits += 1
        else:
            self.cache_misses += 1

    def record_vector_request(self) -> None:
        self.vector_requests += 1

    def record_web_request(self) -> None:
        self.web_requests += 1

    def as_dict(self) -> Dict[str, Any]:
        return {
            "vector_requests": self.vector_requests,
            "web_requests": self.web_requests,
            "cache_hits": self.cache_hits,
            "cache_misses": self.cache_misses,
            "policy_counts": dict(self.policy_counts),
        }
