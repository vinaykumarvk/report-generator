from __future__ import annotations

from enum import Enum


class EvidencePolicy(str, Enum):
    VECTOR_ONLY = "VECTOR_ONLY"
    WEB_ONLY = "WEB_ONLY"
    VECTOR_AND_WEB = "VECTOR_AND_WEB"
    VECTOR_THEN_WEB = "VECTOR_THEN_WEB"
    WEB_THEN_VECTOR = "WEB_THEN_VECTOR"
