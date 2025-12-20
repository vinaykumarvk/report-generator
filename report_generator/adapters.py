from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List


@dataclass
class ReviewerFeedback:
    checklist: List[str] = field(default_factory=list)
    risk_flags: List[str] = field(default_factory=list)
    confidence: float | None = None


CHECKLIST_HEADER = re.compile(r"^checklist\b", re.IGNORECASE)
RISK_HEADER = re.compile(r"^risk", re.IGNORECASE)
CONFIDENCE_PATTERN = re.compile(r"confidence[:\s]*([0-9]*\.?[0-9]+)", re.IGNORECASE)
LIST_PREFIX = re.compile(r"^[-*\d.)\s]+")


def parse_reviewer_response(output: str) -> ReviewerFeedback:
    """
    Transform reviewer text into structured data.

    The parser is resilient to formatting variance but optimized for the
    heading + bullet structure requested in :func:`build_reviewer_prompt`.
    """
    feedback = ReviewerFeedback()
    current_section: str | None = None
    lines = output.splitlines()

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue

        if CHECKLIST_HEADER.match(line):
            current_section = "checklist"
            continue
        if RISK_HEADER.match(line):
            current_section = "risk_flags"
            continue

        confidence_match = CONFIDENCE_PATTERN.search(line)
        if confidence_match:
            try:
                feedback.confidence = float(confidence_match.group(1))
            except ValueError:
                feedback.confidence = None
            continue

        if current_section == "checklist":
            feedback.checklist.append(LIST_PREFIX.sub("", line).strip())
        elif current_section == "risk_flags":
            feedback.risk_flags.append(LIST_PREFIX.sub("", line).strip())

    # Fallbacks if headers were missing.
    if not feedback.checklist and output.strip():
        feedback.checklist.append(output.strip())

    if feedback.confidence is not None:
        feedback.confidence = max(0.0, min(1.0, feedback.confidence))

    return feedback
