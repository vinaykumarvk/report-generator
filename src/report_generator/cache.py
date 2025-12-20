from __future__ import annotations

import copy
import time
from dataclasses import asdict, dataclass, is_dataclass
from typing import Any, Callable, Dict, Hashable, Tuple


def _freeze(value: Any) -> Hashable:
    """Convert nested structures to a hashable representation."""
    if is_dataclass(value):
        return _freeze(asdict(value))
    if isinstance(value, dict):
        return tuple(sorted((k, _freeze(v)) for k, v in value.items()))
    if isinstance(value, (list, tuple, set)):
        return tuple(_freeze(v) for v in value)
    return value


@dataclass
class CacheEntry:
    value: Any
    created_at: float


class RetrievalCache:
    """Simple in-memory cache keyed by policy, query, filters, and limit."""

    def __init__(self) -> None:
        self._store: Dict[Hashable, CacheEntry] = {}
        self.hits: int = 0
        self.misses: int = 0

    def _make_key(self, policy: Any, query: str, filters: Any, limit: int) -> Hashable:
        return (
            policy,
            query,
            _freeze(filters),
            limit,
        )

    def get_or_set(
        self,
        *,
        policy: Any,
        query: str,
        filters: Any,
        limit: int,
        loader: Callable[[], Any],
    ) -> Tuple[Any, bool]:
        """Return cached value or compute and store the result.

        Returns a tuple of (value, was_hit).
        """
        key = self._make_key(policy, query, filters, limit)
        if key in self._store:
            self.hits += 1
            return copy.deepcopy(self._store[key].value), True

        self.misses += 1
        value = loader()
        self._store[key] = CacheEntry(copy.deepcopy(value), time.time())
        return copy.deepcopy(value), False

    def clear(self) -> None:
        self._store.clear()
        self.hits = 0
        self.misses = 0
