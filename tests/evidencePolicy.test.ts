import { enforceEvidencePolicy } from "@/lib/evidencePolicy";

describe("enforceEvidencePolicy", () => {
  it("requires citations when enforced", () => {
    const result = enforceEvidencePolicy({
      policy: "VECTOR_ONLY",
      markdown: "Claim without citations.",
      evidence: [{ id: "e1", source: "v", kind: "vector", content: "e", metadata: {} }],
      claims: [{ text: "Claim", evidenceIds: ["e1"] }],
      noNewFacts: false,
      enforceCitations: true,
    });
    expect(result.pass).toBe(false);
    expect(result.issues.some((issue) => issue.includes("Missing citation"))).toBe(true);
  });
});
