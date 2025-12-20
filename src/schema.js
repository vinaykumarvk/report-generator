const VALID_STRICTNESS = ["low", "medium", "high"];

function coerceStrictness(value, fallback = "medium") {
  return VALID_STRICTNESS.includes(value) ? value : fallback;
}

function normalizeModelProvider(input) {
  if (!input?.name) throw new Error("name is required");
  return {
    id: input.id,
    name: String(input.name),
    region: input.region ? String(input.region) : "unknown",
    models: Array.isArray(input.models)
      ? input.models.map((m) => ({
          name: String(m.name),
          contextWindow: Number(m.contextWindow) || 0,
          maxOutputTokens: Number(m.maxOutputTokens) || 0,
        }))
      : [],
  };
}

function normalizeModelConfig(input) {
  if (!input?.providerId) throw new Error("providerId is required");
  if (!input?.model) throw new Error("model is required");
  return {
    id: input.id,
    providerId: String(input.providerId),
    model: String(input.model),
    temperature: Number.isFinite(input.temperature) ? Number(input.temperature) : 0.5,
    maxOutputTokens: Number.isFinite(input.maxOutputTokens) ? Number(input.maxOutputTokens) : 1024,
    topP: Number.isFinite(input.topP) ? Number(input.topP) : 0.9,
    strictness: coerceStrictness(input.strictness),
    verification: {
      citationRequired: !!input.verification?.citationRequired,
      reviewerSimulation: !!input.verification?.reviewerSimulation,
    },
    stageHints: {
      write: input.stageHints?.write !== false,
      verify: !!input.stageHints?.verify,
      repair: !!input.stageHints?.repair,
    },
  };
}

function normalizeGenerationProfile(input) {
  if (!input?.name) throw new Error("name is required");
  const stageConfig = input.stageConfig || {};
  const normalizedStages = {};
  ["plan", "retrieve", "write", "verify", "repair"].forEach((stage) => {
    if (!stageConfig[stage]) return;
    const stageValue = stageConfig[stage];
    normalizedStages[stage] = {
      enabled: stageValue.enabled !== false,
      modelConfigId: stageValue.modelConfigId,
      strictness: coerceStrictness(stageValue.strictness, "medium"),
      maxAttempts: Number.isFinite(stageValue.maxAttempts) ? Number(stageValue.maxAttempts) : undefined,
    };
  });

  return {
    id: input.id,
    name: String(input.name),
    description: input.description ? String(input.description) : "",
    toggles: {
      enableVerification: !!input.toggles?.enableVerification,
      enableRepair: !!input.toggles?.enableRepair,
      enableReviewer: !!input.toggles?.enableReviewer,
      enforceCitations: !!input.toggles?.enforceCitations,
      allowWeb: input.toggles?.allowWeb !== false,
      allowVector: input.toggles?.allowVector !== false,
    },
    stageConfig: normalizedStages,
  };
}

function normalizeStageOverride(input) {
  const overrides = {};
  Object.entries(input || {}).forEach(([stage, config]) => {
    overrides[stage] = {
      enabled: config.enabled !== false,
      modelConfigId: config.modelConfigId,
      strictness: coerceStrictness(config.strictness, "medium"),
      maxAttempts: Number.isFinite(config.maxAttempts) ? Number(config.maxAttempts) : undefined,
    };
  });
  return overrides;
}

module.exports = {
  coerceStrictness,
  normalizeModelProvider,
  normalizeModelConfig,
  normalizeGenerationProfile,
  normalizeStageOverride,
};
