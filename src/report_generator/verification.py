from __future__ import annotations

import re
from typing import Dict, List, Sequence

from .models import (
    Blueprint,
    Claim,
    EvidenceBundle,
    EvidencePolicy,
    VerificationIssue,
)


CitationPattern = re.compile(r"\[citation:([^\]]+)\]")


POLICIES_REQUIRING_CITATIONS = {
    EvidencePolicy.VECTOR_ONLY,
    EvidencePolicy.WEB_ONLY,
    EvidencePolicy.VECTOR_LLM,
    EvidencePolicy.WEB_LLM,
    EvidencePolicy.VECTOR_WEB,
    EvidencePolicy.ALL,
}


def check_evidence_policy_compliance(
    claims: Sequence[Claim],
    policy: EvidencePolicy,
    evidence_bundle: EvidenceBundle,
) -> List[VerificationIssue]:
    issues: List[VerificationIssue] = []
    requires_citations = policy in POLICIES_REQUIRING_CITATIONS

    for claim in claims:
        if requires_citations and not claim.evidence_ids:
            issues.append(
                VerificationIssue(
                    code="EVIDENCE_MISSING",
                    message=f"Claim '{claim.text}' lacks evidence under {policy} policy.",
                )
            )
        if requires_citations:
            for evidence_id in claim.evidence_ids:
                if not evidence_bundle.has(evidence_id):
                    issues.append(
                        VerificationIssue(
                            code="EVIDENCE_UNKNOWN",
                            message=f"Claim '{claim.text}' references unknown evidence '{evidence_id}'.",
                        )
                    )
        if not requires_citations and claim.evidence_ids:
            issues.append(
                VerificationIssue(
                    code="UNEXPECTED_EVIDENCE",
                    message=f"Claim '{claim.text}' should not include evidence under {policy} policy.",
                )
            )

    return issues


def check_citation_presence_and_format(
    markdown: str, claims: Sequence[Claim], policy: EvidencePolicy
) -> List[VerificationIssue]:
    issues: List[VerificationIssue] = []
    requires_citations = policy in POLICIES_REQUIRING_CITATIONS
    found_citations = CitationPattern.findall(markdown)

    if requires_citations and not found_citations:
        issues.append(
            VerificationIssue(
                code="CITATIONS_MISSING",
                message="No citations found in markdown despite policy requirement.",
            )
        )

    if found_citations:
        for citation in found_citations:
            if not re.fullmatch(r"[A-Za-z0-9_\-]+", citation):
                issues.append(
                    VerificationIssue(
                        code="CITATION_FORMAT",
                        message=f"Citation id '{citation}' is not in the expected format.",
                    )
                )

    for claim in claims:
        for evidence_id in claim.evidence_ids:
            if requires_citations and evidence_id not in found_citations:
                issues.append(
                    VerificationIssue(
                        code="CITATION_MISMATCH",
                        message=f"Claim '{claim.text}' references '{evidence_id}' but no matching citation is present.",
                    )
                )

    return issues


def check_contradictions_and_redundancy(
    markdown: str, blueprint: Blueprint, prior_sections: Sequence[str]
) -> List[VerificationIssue]:
    issues: List[VerificationIssue] = []
    lowered = markdown.lower()
    for phrase in blueprint.contradictory_phrases():
        if phrase in lowered:
            issues.append(
                VerificationIssue(
                    code="CONTRADICTION",
                    message=f"Detected contradiction with blueprint guidance: '{phrase}'.",
                )
            )

    sentences = [s.strip() for s in markdown.split(".") if s.strip()]
    seen: Dict[str, int] = {}
    for sentence in sentences:
        seen[sentence.lower()] = seen.get(sentence.lower(), 0) + 1
        if seen[sentence.lower()] > 1:
            issues.append(
                VerificationIssue(
                    code="REDUNDANCY_INTERNAL",
                    message=f"Sentence repeated: '{sentence}'.",
                    severity="WARNING",
                )
            )

    for prior in prior_sections:
        prior_sentences = {s.strip().lower() for s in prior.split(".") if s.strip()}
        duplicates = prior_sentences.intersection({s.lower() for s in sentences})
        for duplicate in duplicates:
            issues.append(
                VerificationIssue(
                    code="REDUNDANCY_PRIOR",
                    message=f"Sentence duplicates prior section: '{duplicate}'.",
                    severity="WARNING",
                )
            )

    return issues


def check_formatting_gates(
    markdown: str, required_headings: Sequence[str] | None = None, min_words: int = 0
) -> List[VerificationIssue]:
    issues: List[VerificationIssue] = []
    word_count = len(markdown.split())
    if word_count < min_words:
        issues.append(
            VerificationIssue(
                code="TOO_SHORT",
                message=f"Section has {word_count} words; expected at least {min_words}.",
            )
        )

    if required_headings:
        for heading in required_headings:
            if f"# {heading}" not in markdown:
                issues.append(
                    VerificationIssue(
                        code="MISSING_HEADING",
                        message=f"Missing required heading '{heading}'.",
                )
                )

    return issues


def verify_section(
    markdown: str,
    claims: Sequence[Claim],
    policy: EvidencePolicy,
    evidence_bundle: EvidenceBundle,
    blueprint: Blueprint,
    prior_sections: Sequence[str],
    formatting_requirements: Dict,
) -> List[VerificationIssue]:
    issues: List[VerificationIssue] = []
    issues.extend(check_evidence_policy_compliance(claims, policy, evidence_bundle))
    issues.extend(check_citation_presence_and_format(markdown, claims, policy))
    issues.extend(check_contradictions_and_redundancy(markdown, blueprint, prior_sections))
    issues.extend(
        check_formatting_gates(
            markdown,
            required_headings=formatting_requirements.get("required_headings", []),
            min_words=formatting_requirements.get("min_words", 0),
        )
    )
    return issues
