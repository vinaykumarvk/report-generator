from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Dict, List

from .models import ReportRun, SectionRun, SectionScores
from .scoring import compute_section_scores, clamp_score


def aggregate_report_scores(sections: List[SectionRun]) -> SectionScores:
    if not sections:
        return SectionScores(
            coverage=0.0,
            diversity=0.0,
            recency=0.0,
            redundancy=0.0,
            explanations={"coverage": "No sections available to aggregate."},
        )

    totals = {"coverage": 0.0, "diversity": 0.0, "recency": 0.0, "redundancy": 0.0}
    explanations: Dict[str, List[str]] = {
        "coverage": [],
        "diversity": [],
        "recency": [],
        "redundancy": [],
    }

    for section in sections:
        if section.scores is None:
            section.scores = compute_section_scores(section)
        totals["coverage"] += section.scores.coverage
        totals["diversity"] += section.scores.diversity
        totals["recency"] += section.scores.recency
        totals["redundancy"] += section.scores.redundancy
        for key, value in section.scores.explanations.items():
            explanations[key].append(f"{section.name}: {value}")

    count = len(sections)
    aggregated = SectionScores(
        coverage=clamp_score(totals["coverage"] / count),
        diversity=clamp_score(totals["diversity"] / count),
        recency=clamp_score(totals["recency"] / count),
        redundancy=clamp_score(totals["redundancy"] / count),
        explanations={
            key: " | ".join(values) for key, values in explanations.items() if values
        },
    )
    return aggregated


def build_dashboard(report_run: ReportRun) -> Dict[str, object]:
    report_run.aggregated_scores = aggregate_report_scores(report_run.sections)
    section_rows = []
    for section in report_run.sections:
        if section.scores is None:
            section.scores = compute_section_scores(section)
        section_rows.append(
            {
                "id": section.id,
                "name": section.name,
                "scores": asdict(section.scores),
            }
        )

    return {
        "report": {"id": report_run.id, "title": report_run.title},
        "sections": section_rows,
        "aggregated_scores": asdict(report_run.aggregated_scores),
    }


def render_markdown(dashboard: Dict[str, object]) -> str:
    lines = []
    report = dashboard["report"]
    lines.append(f"# Report Dashboard — {report['title']}")
    agg = dashboard["aggregated_scores"]
    lines.append("")
    lines.append("## Aggregated Scores")
    lines.append("| Metric | Score | Explanation |")
    lines.append("| --- | --- | --- |")
    for metric in ["coverage", "diversity", "recency", "redundancy"]:
        explanation = agg.get("explanations", {}).get(metric, "")
        lines.append(f"| {metric.title()} | {agg[metric]:.3f} | {explanation} |")

    lines.append("")
    lines.append("## Section Details")
    lines.append("| Section | Coverage | Diversity | Recency | Redundancy |")
    lines.append("| --- | --- | --- | --- | --- |")
    for section in dashboard["sections"]:
        scores = section["scores"]
        lines.append(
            "| {name} | {coverage:.3f} | {diversity:.3f} | {recency:.3f} | {redundancy:.3f} |".format(
                name=section["name"],
                coverage=scores["coverage"],
                diversity=scores["diversity"],
                recency=scores["recency"],
                redundancy=scores["redundancy"],
            )
        )

    return "\n".join(lines)


def render_html(dashboard: Dict[str, object]) -> str:
    report = dashboard["report"]
    agg = dashboard["aggregated_scores"]
    rows = []
    for section in dashboard["sections"]:
        scores = section["scores"]
        rows.append(
            "<tr>"
            f"<td>{section['name']}</td>"
            f"<td>{scores['coverage']:.3f}</td>"
            f"<td>{scores['diversity']:.3f}</td>"
            f"<td>{scores['recency']:.3f}</td>"
            f"<td>{scores['redundancy']:.3f}</td>"
            "</tr>"
        )

    agg_rows = []
    for metric in ["coverage", "diversity", "recency", "redundancy"]:
        agg_rows.append(
            "<tr>"
            f"<td>{metric.title()}</td>"
            f"<td>{agg[metric]:.3f}</td>"
            f"<td>{agg.get('explanations', {}).get(metric, '')}</td>"
            "</tr>"
        )

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Report Dashboard — {report['title']}</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 2rem; }}
    table {{ border-collapse: collapse; width: 100%; margin-bottom: 1.5rem; }}
    th, td {{ border: 1px solid #ddd; padding: 8px; }}
    th {{ background-color: #f2f2f2; }}
    caption {{ text-align: left; font-weight: bold; margin-bottom: 0.5rem; }}
  </style>
</head>
<body>
  <h1>Report Dashboard — {report['title']}</h1>
  <table>
    <caption>Aggregated Scores</caption>
    <thead><tr><th>Metric</th><th>Score</th><th>Explanation</th></tr></thead>
    <tbody>
      {''.join(agg_rows)}
    </tbody>
  </table>
  <table>
    <caption>Section Scores</caption>
    <thead><tr><th>Section</th><th>Coverage</th><th>Diversity</th><th>Recency</th><th>Redundancy</th></tr></thead>
    <tbody>
      {''.join(rows)}
    </tbody>
  </table>
</body>
</html>
"""


def write_dashboard_exports(dashboard: Dict[str, object], output_dir: Path) -> Dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    markdown_path = output_dir / "dashboard.md"
    html_path = output_dir / "dashboard.html"

    markdown_path.write_text(render_markdown(dashboard), encoding="utf-8")
    html_path.write_text(render_html(dashboard), encoding="utf-8")
    json_path = output_dir / "dashboard.json"
    json_path.write_text(json.dumps(dashboard, indent=2), encoding="utf-8")

    return {"markdown": markdown_path, "html": html_path, "json": json_path}
