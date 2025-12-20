from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from .dashboard import build_dashboard, write_dashboard_exports
from .models import EvidenceBundle, EvidenceItem, ReportRun, SectionRun
from .persistence import persist_report_dashboard, persist_section_run
from .scoring import compute_section_scores


def _parse_evidence(items: List[Dict[str, Any]]) -> EvidenceBundle:
    evidence_items: List[EvidenceItem] = []
    for item in items:
        evidence_items.append(
            EvidenceItem(
                id=item["id"],
                section_id=item["section_id"],
                source_type=item.get("source_type", "unknown"),
                uri=item.get("uri"),
                added_at=datetime.fromisoformat(item["added_at"]),
                content=item["content"],
                tokens=item.get("tokens"),
                metadata=item.get("metadata", {}),
            )
        )
    return EvidenceBundle(items=evidence_items)


def load_run(path: Path) -> ReportRun:
    payload = json.loads(path.read_text(encoding="utf-8"))
    sections: List[SectionRun] = []
    for section in payload["sections"]:
        bundle = _parse_evidence(section.get("evidence", []))
        sections.append(
            SectionRun(
                id=section["id"],
                name=section["name"],
                evidence_bundle=bundle,
                requirements=section.get("requirements", []),
                target_evidence=section.get("target_evidence", 0),
            )
        )
    return ReportRun(id=payload["id"], title=payload["title"], sections=sections)


def run_scoring(report_path: Path, output_dir: Path) -> Dict[str, Path]:
    report_run = load_run(report_path)
    for section in report_run.sections:
        section.scores = compute_section_scores(section)
        persist_section_run(section, root=output_dir / "sections")
    dashboard = build_dashboard(report_run)
    persist_report_dashboard(report_run, root=output_dir / "reports")
    return write_dashboard_exports(dashboard, output_dir=output_dir)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Compute coverage/diversity/recency/redundancy scores for a report run."
    )
    parser.add_argument(
        "--input",
        type=Path,
        required=True,
        help="Path to the report JSON payload.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("output"),
        help="Directory to store dashboards and persisted scores.",
    )
    return parser


def main(argv: List[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    outputs = run_scoring(args.input, args.output)
    print("Generated dashboard:")
    for name, path in outputs.items():
        print(f"- {name}: {path}")


if __name__ == "__main__":
    main()
