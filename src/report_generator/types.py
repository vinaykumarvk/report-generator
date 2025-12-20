from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .policy import EvidencePolicy


@dataclass
class RetrievalFilters:
    """Filters applied during retrieval."""

    metadata: Optional[Dict[str, Any]] = None
    source_ids: Optional[List[str]] = None
    tags: Optional[List[str]] = None


@dataclass
class EvidenceItem:
    id: str
    content: str
    score: float
    source: str
    kind: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EvidenceBundle:
    policy: EvidencePolicy
    vector: List[EvidenceItem]
    web: List[EvidenceItem]

    def combined(self) -> List[EvidenceItem]:
        return [*self.vector, *self.web]
