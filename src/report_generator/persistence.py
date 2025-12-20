from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict

from .models import ReportRun, SectionRun, SectionScores
from .scoring import compute_section_scores


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _serialize_scores(scores: SectionScores) -> Dict[str, Any]:
    data = asdict(scores)
    return data


def persist_section_run(section_run: SectionRun, root: Path) -> Path:
    _ensure_dir(root)
    file_path = root / f"{section_run.id}.json"
    payload = {
        "id": section_run.id,
        "name": section_run.name,
        "requirements": section_run.requirements,
        "scores": _serialize_scores(section_run.scores or compute_section_scores(section_run)),
    }
    file_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return file_path


def persist_report_dashboard(report_run: ReportRun, root: Path) -> Path:
    _ensure_dir(root)
    file_path = root / f"{report_run.id}.json"
    sections = []
    for section in report_run.sections:
        if section.scores is None:
            section.scores = compute_section_scores(section)
        sections.append(
            {
                "id": section.id,
                "name": section.name,
                "scores": _serialize_scores(section.scores),
            }
        )

    payload: Dict[str, Any] = {
        "id": report_run.id,
        "title": report_run.title,
        "aggregated_scores": _serialize_scores(report_run.aggregated_scores)
        if report_run.aggregated_scores
        else None,
        "sections": sections,
    }
    file_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return file_path
