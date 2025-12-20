from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional


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
    source: str
    text: str
    link: Optional[str] = None


@dataclass
class EvidenceBundle:
    items: Dict[str, EvidenceItem] = field(default_factory=dict)

    def has(self, evidence_id: str) -> bool:
        return evidence_id in self.items


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
