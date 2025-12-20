"""Evidence-aware scoring and dashboard helpers for report generation."""

__all__ = [
    "models",
    "scoring",
    "persistence",
    "dashboard",
    "cli",
"""Core package for the report generator retrieval components."""

from .policy import EvidencePolicy
from .types import EvidenceBundle, EvidenceItem, RetrievalFilters
from .retrieval.router import RetrievalRouter

__all__ = [
    "EvidenceBundle",
    "EvidenceItem",
    "EvidencePolicy",
    "RetrievalFilters",
    "RetrievalRouter",
]
