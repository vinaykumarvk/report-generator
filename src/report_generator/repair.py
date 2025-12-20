from __future__ import annotations

from typing import List

from .models import Claim, EvidenceBundle, EvidencePolicy, SectionWriteResult, VerificationIssue
from .verification import POLICIES_REQUIRING_CITATIONS


def generate_repair_instructions(issues: List[VerificationIssue]) -> str:
    grouped = {}
    for issue in issues:
        grouped.setdefault(issue.code, []).append(issue.message)

    lines = ["Repair Checklist:"]
    for code, messages in grouped.items():
        lines.append(f"- {code}:")
        for message in messages:
            lines.append(f"  - {message}")
    lines.append("- Re-run verification after applying fixes.")
    return "\n".join(lines)


def _ensure_citations(markdown: str, claims: List[Claim], evidence_bundle: EvidenceBundle) -> str:
    fixed_lines = []
    for claim in claims:
        if claim.evidence_ids:
            citation_block = " ".join([f"[citation:{e}]" for e in claim.evidence_ids if evidence_bundle.has(e)])
        else:
            citation_block = ""
        fixed_lines.append(f"- {claim.text} {citation_block}".strip())
    return "\n".join(fixed_lines)


def repair_section(
    draft: SectionWriteResult,
    issues: List[VerificationIssue],
    evidence_bundle: EvidenceBundle,
    policy: EvidencePolicy,
) -> SectionWriteResult:
    needs_citations = any(issue.code in {"CITATIONS_MISSING", "CITATION_MISMATCH", "EVIDENCE_MISSING"} for issue in issues)
    markdown = draft.markdown

    if needs_citations and policy in POLICIES_REQUIRING_CITATIONS:
        markdown = _ensure_citations(markdown, draft.claims, evidence_bundle)

    filtered_claims = []
    for claim in draft.claims:
        if policy not in POLICIES_REQUIRING_CITATIONS:
            filtered_claims.append(Claim(text=claim.text, evidence_ids=[]))
        else:
            filtered_ids = [e for e in claim.evidence_ids if evidence_bundle.has(e)]
            filtered_claims.append(Claim(text=claim.text, evidence_ids=filtered_ids))

    return SectionWriteResult(markdown=markdown, claims=filtered_claims, open_questions=draft.open_questions)
