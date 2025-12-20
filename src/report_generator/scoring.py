from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable, Tuple
from urllib.parse import urlparse

from .models import EvidenceBundle, SectionRun, SectionScores


def clamp_score(value: float) -> float:
    return max(0.0, min(1.0, round(value, 3)))


def _normalize_text(text: str) -> str:
    return " ".join(text.lower().split())


def _extract_host(uri: str | None) -> str:
    if not uri:
        return "unknown"
    parsed = urlparse(uri)
    return parsed.hostname or parsed.scheme or "unknown"


def _requirement_hits(requirements: Iterable[str], contents: Iterable[str]) -> int:
    normalized_items = [_normalize_text(item) for item in contents]
    hits = 0
    for req in requirements:
        normalized_req = _normalize_text(req)
        if any(normalized_req in content for content in normalized_items):
            hits += 1
    return hits


def compute_coverage(
    bundle: EvidenceBundle, requirements: Iterable[str], target_evidence: int = 0
) -> Tuple[float, str]:
    if not bundle.items:
        return 0.0, "No evidence captured for this section."

    requirement_list = list(requirements)
    contents = [item.content for item in bundle.items]

    if requirement_list:
        hits = _requirement_hits(requirement_list, contents)
        score = hits / len(requirement_list)
        explanation = (
            f"Matched {hits}/{len(requirement_list)} requirements within evidence content."
        )
    else:
        baseline = target_evidence if target_evidence > 0 else 3
        score = min(1.0, len(bundle.items) / baseline)
        explanation = (
            f"Using heuristic coverage: {len(bundle.items)} evidence items "
            f"against baseline of {baseline}."
        )

    return clamp_score(score), explanation


def compute_diversity(bundle: EvidenceBundle) -> Tuple[float, str]:
    if not bundle.items:
        return 0.0, "No evidence available to evaluate diversity."

    unique_sources = {
        (item.source_type, _extract_host(item.uri)) for item in bundle.items
    }
    score = len(unique_sources) / len(bundle.items)
    explanation = (
        f"{len(unique_sources)} unique source buckets across {len(bundle.items)} items."
    )
    return clamp_score(score), explanation


def compute_recency(
    bundle: EvidenceBundle, recency_window_days: int = 180
) -> Tuple[float, str]:
    if not bundle.items:
        return 0.0, "No evidence available to evaluate recency."

    now = datetime.now(timezone.utc)
    ages_in_days = []
    for item in bundle.items:
        added_at = item.added_at
        if added_at.tzinfo is None:
            added_at = added_at.replace(tzinfo=timezone.utc)
        age_days = (now - added_at).total_seconds() / 86400
        ages_in_days.append(age_days)

    average_age = sum(ages_in_days) / len(ages_in_days)
    score = 1 - (average_age / recency_window_days)
    explanation = (
        f"Average evidence age is {average_age:.1f} days "
        f"(window {recency_window_days} days)."
    )
    return clamp_score(score), explanation


def compute_redundancy(bundle: EvidenceBundle) -> Tuple[float, str]:
    if not bundle.items:
        return 0.0, "No evidence available to evaluate redundancy."

    normalized = [_normalize_text(item.content) for item in bundle.items]
    unique_items = set(normalized)
    unique_ratio = len(unique_items) / len(normalized)
    score = unique_ratio
    explanation = (
        f"{len(unique_items)} unique evidence items out of {len(bundle.items)} "
        "implies low redundancy when closer to 1.0."
    )
    return clamp_score(score), explanation


def compute_section_scores(
    section_run: SectionRun, recency_window_days: int = 180
) -> SectionScores:
    coverage, coverage_explanation = compute_coverage(
        section_run.evidence_bundle,
        section_run.requirements,
        target_evidence=section_run.target_evidence,
    )
    diversity, diversity_explanation = compute_diversity(section_run.evidence_bundle)
    recency, recency_explanation = compute_recency(
        section_run.evidence_bundle, recency_window_days=recency_window_days
    )
    redundancy, redundancy_explanation = compute_redundancy(
        section_run.evidence_bundle
    )

    return SectionScores(
        coverage=coverage,
        diversity=diversity,
        recency=recency,
        redundancy=redundancy,
        explanations={
            "coverage": coverage_explanation,
            "diversity": diversity_explanation,
            "recency": recency_explanation,
            "redundancy": redundancy_explanation,
        },
    )
