from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, Iterable, List, Optional, Union


class EvidencePolicy(str, Enum):
    LLM_ONLY = "LLM_ONLY"
    VECTOR_ONLY = "VECTOR_ONLY"
    WEB_ONLY = "WEB_ONLY"
    VECTOR_LLM = "VECTOR_LLM"
    WEB_LLM = "WEB_LLM"
    VECTOR_WEB = "VECTOR_WEB"
    ALL = "ALL"
    SYNTHESIS_ONLY = "SYNTHESIS_ONLY"


class ArtifactType(str, Enum):
    PLAN = "PLAN"
    DRAFT = "DRAFT"
    VERIFIED_DRAFT = "VERIFIED_DRAFT"
    REVIEW_NOTES = "REVIEW_NOTES"
    FINAL = "FINAL"


@dataclass
class EvidenceItem:
    id: str
    source: Optional[str] = None
    text: Optional[str] = None
    link: Optional[str] = None
    section_id: Optional[str] = None
    source_type: Optional[str] = None
    uri: Optional[str] = None
    added_at: Optional[datetime] = None
    content: Optional[str] = None
    tokens: Optional[int] = None
    metadata: Dict[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.content is None and self.text is not None:
            self.content = self.text
        if self.source_type is None and self.source is not None:
            self.source_type = self.source
        if self.uri is None and self.link is not None:
            self.uri = self.link


@dataclass
class EvidenceBundle:
    items: Union[List[EvidenceItem], Dict[str, EvidenceItem]] = field(
        default_factory=list
    )

    def __post_init__(self) -> None:
        if isinstance(self.items, dict):
            self._items_by_id = dict(self.items)
            self.items = list(self.items.values())
        else:
            self._items_by_id = {item.id: item for item in self.items}

    def has(self, evidence_id: str) -> bool:
        return evidence_id in self._items_by_id


@dataclass
class SectionPlan:
    outline: List[str]
    retrieval_queries: List[str] = field(default_factory=list)
    constraints: List[str] = field(default_factory=list)
    priority: str = "P2"


@dataclass
class Claim:
    text: str
    evidence_ids: List[str] = field(default_factory=list)


@dataclass
class SectionWriteResult:
    markdown: str
    claims: List[Claim]
    open_questions: List[str] = field(default_factory=list)


@dataclass
class VerificationIssue:
    code: str
    message: str
    severity: str = "ERROR"


@dataclass
class SectionArtifact:
    type: ArtifactType
    content: str
    metadata: Dict = field(default_factory=dict)


@dataclass
class Blueprint:
    assumptions: List[str] = field(default_factory=list)
    forbidden: List[str] = field(default_factory=list)

    def contradictory_phrases(self) -> List[str]:
        phrases = []
        for assumption in self.assumptions:
            phrases.append(f"not {assumption.lower()}")
        for ban in self.forbidden:
            phrases.append(ban.lower())
        return phrases


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
