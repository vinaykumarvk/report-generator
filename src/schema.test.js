const { test } = require("node:test");
const assert = require("assert");
const {
  coerceStrictness,
  normalizeGenerationProfile,
  normalizeModelConfig,
  normalizeModelProvider,
  normalizeStageOverride,
} = require("./schema");

test("coerceStrictness defaults to medium when invalid", () => {
  assert.strictEqual(coerceStrictness("unknown"), "medium");
  assert.strictEqual(coerceStrictness("high"), "high");
});

test("normalizeModelProvider enforces required name", () => {
  const provider = normalizeModelProvider({
    name: "Acme",
    region: "us-west",
    models: [{ name: "model-a", contextWindow: 4000, maxOutputTokens: 512 }],
  });
  assert.strictEqual(provider.name, "Acme");
  assert.strictEqual(provider.models[0].name, "model-a");
});

test("normalizeModelConfig enforces required fields and defaults", () => {
  const config = normalizeModelConfig({ providerId: "prov-x", model: "demo" });
  assert.strictEqual(config.providerId, "prov-x");
  assert.strictEqual(config.temperature, 0.5);
  assert.strictEqual(config.verification.citationRequired, false);
});

test("normalizeGenerationProfile sets toggles and stages", () => {
  const profile = normalizeGenerationProfile({
    name: "Test",
    toggles: { enableVerification: true, enforceCitations: true },
    stageConfig: { verify: { enabled: true, strictness: "high" } },
  });
  assert.ok(profile.toggles.enableVerification);
  assert.ok(profile.toggles.enforceCitations);
  assert.strictEqual(profile.stageConfig.verify.strictness, "high");
});

test("normalizeStageOverride keeps valid stages", () => {
  const overrides = normalizeStageOverride({ write: { modelConfigId: "model-1", strictness: "low" } });
  assert.strictEqual(overrides.write.modelConfigId, "model-1");
  assert.strictEqual(overrides.write.strictness, "low");
});
