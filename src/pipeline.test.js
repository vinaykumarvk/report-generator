const { resolveProfileStages } = require("./pipeline");

const mockState = {
  templates: [
    {
      id: "tmpl-1",
      profileStages: {
        "profile-1": {
          write: { modelConfigId: "model-override", strictness: "medium" },
        },
      },
    },
  ],
  generationProfiles: [
    {
      id: "profile-1",
      toggles: { enableVerification: true },
      stageConfig: {
        write: { enabled: true, modelConfigId: "model-base", strictness: "high" },
        verify: { enabled: true, modelConfigId: "model-base", strictness: "high" },
      },
    },
  ],
};

describe("resolveProfileStages", () => {
  test("merges overrides onto profile defaults", () => {
    const resolved = resolveProfileStages(mockState, "tmpl-1", "profile-1");
    expect(resolved).toBeTruthy();
    expect(resolved.stages.write.modelConfigId).toBe("model-override");
    expect(resolved.stages.verify.modelConfigId).toBe("model-base");
  });
});
