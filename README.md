# Report Generator Evidence Scoring

This repository provides utilities to score **coverage**, **diversity**, **recency**, and **redundancy** for evidence bundles, persist section-level results, and render an aggregated report dashboard.

## Usage

1. Install dependencies (standard library only) and ensure `python3.10+` is available.
2. Prepare a report payload similar to `sample_report.json`.
3. Run the CLI (set `PYTHONPATH=src` or install in editable mode first):

```bash
PYTHONPATH=src python -m report_generator.cli --input sample_report.json --output output
```

Outputs include:

* Section-level JSON score files in `output/sections/`
* A report-level JSON dashboard in `output/reports/`
* Markdown/HTML/JSON dashboard exports in `output/`

## Development

Run tests with:

```bash
pytest
```
