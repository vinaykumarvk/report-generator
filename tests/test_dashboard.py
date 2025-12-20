from datetime import datetime, timedelta, timezone
from pathlib import Path

from report_generator.dashboard import build_dashboard
from report_generator.models import EvidenceBundle, EvidenceItem, ReportRun, SectionRun
from report_generator.scoring import compute_section_scores


def make_section(section_id: str, age: int) -> SectionRun:
    item = EvidenceItem(
        id=f"{section_id}-1",
        section_id=section_id,
        source_type="web",
        uri="https://example.com",
        added_at=datetime.now(timezone.utc) - timedelta(days=age),
        content=f"Sample content for {section_id}",
    )
    section = SectionRun(
        id=section_id,
        name=f"Section {section_id}",
        evidence_bundle=EvidenceBundle(items=[item]),
        requirements=["sample"],
        target_evidence=1,
    )
    section.scores = compute_section_scores(section)
    return section


def test_dashboard_contains_sections_and_aggregates(tmp_path: Path):
    report = ReportRun(
        id="r1",
        title="Report 1",
        sections=[make_section("a", 10), make_section("b", 20)],
    )

    dashboard = build_dashboard(report)

    assert dashboard["report"]["title"] == "Report 1"
    assert len(dashboard["sections"]) == 2
    agg = dashboard["aggregated_scores"]
    assert agg["coverage"] > 0
    assert "Section a" in agg["explanations"]["coverage"]
