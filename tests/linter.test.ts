import { lintTemplate } from "@/lib/linter";

describe("lintTemplate", () => {
  it("flags missing evidence policy", () => {
    const result = lintTemplate(
      { id: "t1", name: "Template" },
      [{ id: "s1", title: "Section" }],
      { webProviderConfigured: true, vectorConnectorIds: [] }
    );
    expect(result.pass).toBe(false);
    expect(result.errors.some((issue) => issue.code === "MISSING_EVIDENCE_POLICY")).toBe(true);
  });

  it("flags synthesis-only with retrieval config", () => {
    const result = lintTemplate(
      { id: "t1", name: "Template" },
      [
        {
          id: "s1",
          title: "Executive Summary",
          evidencePolicy: "SYNTHESIS_ONLY",
          vectorPolicyJson: { connectorIds: ["v1"] },
        },
      ],
      { webProviderConfigured: true, vectorConnectorIds: ["v1"] }
    );
    expect(result.pass).toBe(false);
    expect(result.errors.some((issue) => issue.code === "SYNTHESIS_ONLY_RETRIEVAL")).toBe(true);
  });
});
