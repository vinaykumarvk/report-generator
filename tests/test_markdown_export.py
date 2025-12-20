from app.export.citations import Citation, CitationFormatter, RenderedSection
from app.export.markdown import MarkdownExporter


def test_deduplicates_duplicate_citations_across_sections():
    shared_citation = Citation(
        key="source-1",
        source="Dataset A",
        title="Primary Dataset",
        url="https://example.com/data",
        metadata={"owner": "Data Team"},
    )
    section_a = RenderedSection(
        title="Findings",
        body="Analysis results",
        citations=[shared_citation],
        order=1,
    )
    section_b = RenderedSection(
        title="Conclusion",
        body="We confirm the hypothesis",
        citations=[shared_citation],
        order=2,
    )

    exporter = MarkdownExporter()
    result = exporter.export([section_b, section_a])

    assert "[^1]" in result.document
    assert result.document.count("[^1]") == 3  # two inline + one footnote
    assert "[^2]" not in result.document
    assert "[^1]: Primary Dataset — Dataset A (https://example.com/data)" in result.document


def test_missing_citation_metadata_uses_fallbacks():
    citation = Citation(key="missing-meta", source="Web Search")
    formatter = CitationFormatter()
    formatter.register([citation])

    annotated = formatter.annotate_body("Statement", [citation])
    appendix = formatter.render_sources_appendix()

    assert annotated.endswith("[^1]")
    assert "Untitled source — Web Search" in appendix
    assert "Metadata" not in appendix


def test_toc_and_appendix_composition():
    section = RenderedSection(
        title="Overview",
        body="Summary body",
        citations=[],
        order=5,
    )
    exporter = MarkdownExporter(document_title="Evidence Report")
    result = exporter.export([section], report_metadata={"run_id": "abc123"})

    assert result.document.startswith("# Evidence Report")
    assert "- [1. Overview](#overview)" in result.document
    assert "## Appendix" in result.document
    assert "### Sources" in result.document
    assert "_No sources provided._" in result.document
    assert "### Metadata" in result.document
    assert "**run_id**: abc123" in result.document
