const {
  coerceStrictness,
  normalizeGenerationProfile,
  normalizeModelConfig,
  normalizeModelProvider,
  normalizeStageOverride,
} = require("./schema");

describe("schema normalization", () => {
  test("coerceStrictness defaults to medium when invalid", () => {
    expect(coerceStrictness("unknown")).toBe("medium");
    expect(coerceStrictness("high")).toBe("high");
  });

  test("normalizeModelProvider enforces required name", () => {
    const provider = normalizeModelProvider({
      name: "Acme",
      region: "us-west",
      models: [{ name: "model-a", contextWindow: 4000, maxOutputTokens: 512 }],
    });
    expect(provider.name).toBe("Acme");
    expect(provider.models[0].name).toBe("model-a");
  });

  test("normalizeModelConfig enforces required fields and defaults", () => {
    const config = normalizeModelConfig({ providerId: "prov-x", model: "demo" });
    expect(config.providerId).toBe("prov-x");
    expect(config.temperature).toBe(0.5);
    expect(config.verification.citationRequired).toBe(false);
  });

  test("normalizeGenerationProfile sets toggles and stages", () => {
    const profile = normalizeGenerationProfile({
      name: "Test",
      toggles: { enableVerification: true, enforceCitations: true },
      stageConfig: { verify: { enabled: true, strictness: "high" } },
    });
    expect(profile.toggles.enableVerification).toBe(true);
    expect(profile.toggles.enforceCitations).toBe(true);
    expect(profile.stageConfig.verify.strictness).toBe("high");
  });

  test("normalizeStageOverride keeps valid stages", () => {
    const overrides = normalizeStageOverride({
      write: { modelConfigId: "model-1", strictness: "low" },
    });
    expect(overrides.write.modelConfigId).toBe("model-1");
    expect(overrides.write.strictness).toBe("low");
  });
});
