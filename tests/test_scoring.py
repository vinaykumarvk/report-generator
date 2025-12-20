from datetime import datetime, timedelta, timezone

from report_generator.models import EvidenceBundle, EvidenceItem, SectionRun
from report_generator.scoring import compute_section_scores


def build_item(section_id: str, content: str, days_old: int, source_type: str = "web"):
    added_at = datetime.now(timezone.utc) - timedelta(days=days_old)
    return EvidenceItem(
        id=f"{section_id}-{days_old}",
        section_id=section_id,
        source_type=source_type,
        uri=f"https://example.com/{section_id}",
        added_at=added_at,
        content=content,
    )


def test_scores_with_requirements():
    bundle = EvidenceBundle(
        items=[
            build_item("s1", "Coverage includes growth and region signals", 5, "web"),
            build_item("s1", "Diversity comes from multiple domains", 15, "vector"),
        ]
    )
    section = SectionRun(
        id="s1",
        name="Test Section",
        evidence_bundle=bundle,
        requirements=["growth", "region", "profit"],
        target_evidence=3,
    )

    scores = compute_section_scores(section)

    assert scores.coverage == 0.667
    assert scores.diversity >= 0.5
    assert scores.recency <= 1
    assert scores.redundancy >= 0.5
    assert "Matched" in scores.explanations["coverage"]


def test_scores_without_requirements_defaults_to_baseline():
    bundle = EvidenceBundle(
        items=[
            build_item("s2", "First point", 30, "web"),
            build_item("s2", "Second point", 45, "vector"),
            build_item("s2", "Second point", 45, "vector"),
        ]
    )
    section = SectionRun(
        id="s2",
        name="No Requirements",
        evidence_bundle=bundle,
        requirements=[],
        target_evidence=4,
    )

    scores = compute_section_scores(section)

    assert scores.coverage == 0.75
    assert scores.redundancy < 1
    assert scores.explanations["coverage"].startswith("Using heuristic coverage")
