/** @jest-environment node */
import { buildMarkdownDocument } from "../../src/lib/exporter";

describe("buildMarkdownDocument", () => {
  it("includes appendix metadata and body", () => {
    const createdAt = "2025-01-01T12:00:00.000Z";
    const doc = buildMarkdownDocument(
      {
        id: "run-123",
        templateSnapshot: { name: "Template A", version: 3 },
        finalReport: "# Title\n\nHello world",
      },
      createdAt,
      { sourcesAppendix: ["https://example.com"] }
    );

    expect(doc).toContain("Hello world");
    expect(doc).toContain("## Appendix");
    expect(doc).toContain("Template: Template A (v3)");
    expect(doc).toContain("Run ID: run-123");
    expect(doc).toContain(`Exported At: ${createdAt}`);
    expect(doc).toContain("### Web Sources");
    expect(doc).toContain("- https://example.com");
  });

  it("handles missing report content", () => {
    const createdAt = "2025-01-01T12:00:00.000Z";
    const doc = buildMarkdownDocument(
      { id: "run-456", finalReport: null },
      createdAt
    );

    expect(doc).toContain("# Report");
    expect(doc).toContain("No content available");
  });
});
