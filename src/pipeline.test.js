const { test } = require("node:test");
const assert = require("assert");
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

test("resolveProfileStages merges overrides onto profile defaults", () => {
  const resolved = resolveProfileStages(mockState, "tmpl-1", "profile-1");
  assert.ok(resolved);
  assert.strictEqual(resolved.stages.write.modelConfigId, "model-override");
  assert.strictEqual(resolved.stages.verify.modelConfigId, "model-base");
});
