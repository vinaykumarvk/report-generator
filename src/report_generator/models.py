from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional


@dataclass
class EvidenceItem:
    id: str
    section_id: str
    source_type: str
    uri: Optional[str]
    added_at: datetime
    content: str
    tokens: Optional[int] = None
    metadata: Dict[str, str] = field(default_factory=dict)


@dataclass
class EvidenceBundle:
    items: List[EvidenceItem] = field(default_factory=list)


@dataclass
class SectionScores:
    coverage: float
    diversity: float
    recency: float
    redundancy: float
    explanations: Dict[str, str] = field(default_factory=dict)


@dataclass
class SectionRun:
    id: str
    name: str
    evidence_bundle: EvidenceBundle
    requirements: List[str] = field(default_factory=list)
    target_evidence: int = 0
    scores: Optional[SectionScores] = None


@dataclass
class ReportRun:
    id: str
    title: str
    sections: List[SectionRun]
    aggregated_scores: Optional[SectionScores] = None
