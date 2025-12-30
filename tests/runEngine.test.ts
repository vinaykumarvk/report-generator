import { runPipeline } from "@/lib/runEngine";

describe("runPipeline", () => {
  it("produces evidence and claims when policy requires evidence", async () => {
    const template = {
      id: "t1",
      name: "Template",
      defaultVectorStoreIds: ["v1"],
      sections: [
        { id: "s1", title: "Findings", evidencePolicy: "VECTOR_ONLY" },
      ],
    };
    const sectionRuns = [
      {
        id: "sr1",
        runId: "r1",
        templateSectionId: "s1",
        title: "Findings",
        status: "QUEUED",
        attemptCount: 0,
        artifacts: [],
      },
    ];
    const connectors = [{ id: "v1", type: "VECTOR", name: "Vector A" }];
    const profile = {
      id: "p1",
      name: "Fast",
      toggles: { enableReviewer: false, enableVerification: true, enableRepair: true },
      stageConfig: { verify: { enabled: true }, repair: { enabled: true } },
    };

    const result = await runPipeline(
      template as any,
      sectionRuns as any,
      connectors as any,
      profile as any,
      {}
    );
    const artifacts = result.sectionRuns[0].artifacts;
    expect(artifacts.some((item: any) => item.type === "EVIDENCE")).toBe(true);
    expect(artifacts.some((item: any) => item.type === "CLAIMS")).toBe(true);
    expect(result.dependencySnapshot.sectionOutputs["s1"]).toBeTruthy();
  });
});

describe("synthesizeExecutiveSummary", () => {
  it("builds summary from prior sections", () => {
    const { synthesizeExecutiveSummary } = require("@/lib/runEngine");
    const template = {
      id: "t1",
      name: "Template",
      sections: [
        { id: "s0", title: "Executive Summary" },
        { id: "s1", title: "Section A" },
      ],
    };
    const sectionRuns = [
      {
        id: "r0",
        templateSectionId: "s0",
        artifacts: [{ type: "FINAL", content: "" }],
      },
      {
        id: "r1",
        templateSectionId: "s1",
        artifacts: [{ type: "FINAL", content: "First sentence. Second." }],
      },
    ];
    const summary = synthesizeExecutiveSummary(template, sectionRuns);
    expect(summary).toBeTruthy();
    const final = summary.artifacts.find((item: any) => item.type === "FINAL");
    expect(final.content).toContain("First sentence.");
  });
});

describe("web citations", () => {
  it("adds sources section when web evidence exists", async () => {
    const { runSection } = require("@/lib/runEngine");
    const template = {
      id: "t2",
      name: "Template",
      defaultVectorStoreIds: [],
      sections: [
        {
          id: "s1",
          title: "Market",
          evidencePolicy: "WEB_ONLY",
          webPolicyJson: { citationStyle: "endnotes" },
        },
      ],
    };
    const sectionRun = {
      id: "sr1",
      runId: "r1",
      templateSectionId: "s1",
      title: "Market",
      status: "QUEUED",
      attemptCount: 0,
      artifacts: [],
    };
    const connectors = [
      {
        id: "w1",
        type: "WEB_SEARCH",
        name: "Mock Web",
        configJson: { provider: "mock" },
      },
    ];
    const result = await runSection({
      sectionRun,
      section: template.sections[0],
      template,
      connectors,
      profile: null,
      runInput: {},
    });
    const final = result.artifacts.find((item: any) => item.type === "FINAL");
    expect(final.content).toContain("References:");
    expect(final.content).toContain("[citation:");
  });
});
