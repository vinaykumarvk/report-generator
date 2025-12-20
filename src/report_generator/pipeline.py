from __future__ import annotations

from dataclasses import asdict
from typing import Dict, List, Sequence, Tuple

from .models import (
    ArtifactType,
    Blueprint,
    Claim,
    EvidenceBundle,
    EvidencePolicy,
    SectionArtifact,
    SectionPlan,
    SectionWriteResult,
)
from .repair import generate_repair_instructions, repair_section
from .verification import verify_section, POLICIES_REQUIRING_CITATIONS


DEFAULT_FORMATTING = {"required_headings": ["Summary"], "min_words": 30}


def write_section(plan: SectionPlan, evidence_bundle: EvidenceBundle, policy: EvidencePolicy) -> SectionWriteResult:
    markdown_lines: List[str] = ["# Summary"]
    claims: List[Claim] = []
    for idx, item in enumerate(plan.outline, start=1):
        evidence_ids: List[str] = []
        if policy in POLICIES_REQUIRING_CITATIONS and evidence_bundle.items:
            evidence_ids = [next(iter(evidence_bundle.items.keys()))]
        claim_text = f"{item} insight {idx}"
        claims.append(Claim(text=claim_text, evidence_ids=evidence_ids))
        citation_block = " ".join([f"[citation:{eid}]" for eid in evidence_ids])
        markdown_lines.append(f"- {claim_text} {citation_block}".strip())

    markdown = "\n".join(markdown_lines)
    return SectionWriteResult(markdown=markdown, claims=claims)


def build_claim_to_evidence_map(claims: Sequence[Claim]) -> Dict[str, List[str]]:
    mapping: Dict[str, List[str]] = {}
    for claim in claims:
        mapping[claim.text] = list(claim.evidence_ids)
    return mapping


def run_section_pipeline(
    plan: SectionPlan,
    evidence_bundle: EvidenceBundle,
    policy: EvidencePolicy,
    blueprint: Blueprint,
    prior_sections: Sequence[str],
    formatting_requirements: Dict | None = None,
) -> Tuple[List[SectionArtifact], List[str]]:
    formatting = formatting_requirements or DEFAULT_FORMATTING
    artifacts: List[SectionArtifact] = []
    plan_artifact = SectionArtifact(
        type=ArtifactType.PLAN,
        content="\n".join(plan.outline),
        metadata={"constraints": plan.constraints, "priority": plan.priority},
    )
    artifacts.append(plan_artifact)

    draft = write_section(plan, evidence_bundle, policy)
    artifacts.append(
        SectionArtifact(
            type=ArtifactType.DRAFT,
            content=draft.markdown,
            metadata={"claims": [asdict(claim) for claim in draft.claims]},
        )
    )

    issues = verify_section(
        markdown=draft.markdown,
        claims=draft.claims,
        policy=policy,
        evidence_bundle=evidence_bundle,
        blueprint=blueprint,
        prior_sections=prior_sections,
        formatting_requirements=formatting,
    )
    artifacts.append(
        SectionArtifact(
            type=ArtifactType.VERIFIED_DRAFT,
            content=draft.markdown,
            metadata={"issues": [asdict(issue) for issue in issues]},
        )
    )

    notes: List[str] = []
    final_result = draft
    if issues:
        instruction_text = generate_repair_instructions(issues)
        artifacts.append(
            SectionArtifact(
                type=ArtifactType.REVIEW_NOTES,
                content=instruction_text,
                metadata={"issue_codes": [issue.code for issue in issues]},
            )
        )
        final_result = repair_section(draft, issues, evidence_bundle, policy)
        notes = [issue.message for issue in issues]

    claim_map = build_claim_to_evidence_map(final_result.claims) if plan.priority == "P1" else {}

    artifacts.append(
        SectionArtifact(
            type=ArtifactType.FINAL,
            content=final_result.markdown,
            metadata={
                "claims": [asdict(claim) for claim in final_result.claims],
                "claim_to_evidence": claim_map,
                "open_questions": final_result.open_questions,
                "notes": notes,
            },
        )
    )

    return artifacts, notes
