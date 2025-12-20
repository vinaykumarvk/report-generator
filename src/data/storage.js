const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_PATH = path.join(__dirname, "state.json");

const defaultState = () => ({
  workspaces: [
    {
      id: "ws-default",
      name: "Demo Workspace",
      defaultProfileId: "profile-fast",
      defaultModelConfigId: "model-gpt-4o-mini",
    },
  ],
  templates: [
    {
      id: "tmpl-brd",
      workspaceId: "ws-default",
      name: "BRD Starter",
      description: "Baseline BRD template used for demo runs",
      defaultProfileId: "profile-defensible",
      defaultModelConfigId: "model-gpt-4o",
      profileStages: {},
    },
  ],
  modelProviders: [
    {
      id: "prov-openai",
      name: "OpenAI",
      region: "us-east",
      models: [
        { name: "gpt-4o", contextWindow: 128000, maxOutputTokens: 4096 },
        { name: "gpt-4o-mini", contextWindow: 64000, maxOutputTokens: 2048 },
      ],
    },
  ],
  modelConfigs: [
    {
      id: "model-gpt-4o",
      providerId: "prov-openai",
      model: "gpt-4o",
      temperature: 0.3,
      maxOutputTokens: 2048,
      topP: 0.9,
      strictness: "high",
      verification: { citationRequired: true, reviewerSimulation: true },
      stageHints: { write: true, verify: true, repair: true },
    },
    {
      id: "model-gpt-4o-mini",
      providerId: "prov-openai",
      model: "gpt-4o-mini",
      temperature: 0.7,
      maxOutputTokens: 1024,
      topP: 0.95,
      strictness: "medium",
      verification: { citationRequired: false, reviewerSimulation: false },
      stageHints: { write: true, verify: false, repair: false },
    },
  ],
  generationProfiles: [
    {
      id: "profile-fast",
      name: "Fast Draft",
      description: "Lean pipeline with minimal verification for quick drafts.",
      toggles: {
        enableVerification: false,
        enableRepair: false,
        enableReviewer: false,
        enforceCitations: false,
        allowWeb: true,
        allowVector: true,
      },
      stageConfig: {
        plan: { enabled: true, modelConfigId: "model-gpt-4o-mini", strictness: "low" },
        retrieve: { enabled: true },
        write: { enabled: true, modelConfigId: "model-gpt-4o-mini", strictness: "medium" },
        verify: { enabled: false },
        repair: { enabled: false, maxAttempts: 0 },
      },
    },
    {
      id: "profile-defensible",
      name: "Defensible",
      description: "Strict pipeline with verification, citations, and repair loops.",
      toggles: {
        enableVerification: true,
        enableRepair: true,
        enableReviewer: true,
        enforceCitations: true,
        allowWeb: true,
        allowVector: true,
      },
      stageConfig: {
        plan: { enabled: true, modelConfigId: "model-gpt-4o", strictness: "high" },
        retrieve: { enabled: true },
        write: { enabled: true, modelConfigId: "model-gpt-4o", strictness: "high" },
        verify: { enabled: true, modelConfigId: "model-gpt-4o", strictness: "high" },
        repair: { enabled: true, modelConfigId: "model-gpt-4o", maxAttempts: 2 },
      },
    },
  ],
});

function ensureStateFile() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(defaultState(), null, 2));
  }
}

function readState() {
  ensureStateFile();
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  return JSON.parse(raw);
}

function writeState(state) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(state, null, 2));
}

function upsert(array, item, key = "id") {
  const existing = array.findIndex((entry) => entry[key] === item[key]);
  if (existing >= 0) {
    array[existing] = { ...array[existing], ...item };
  } else {
    array.push(item);
  }
}

function generateId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

module.exports = {
  DATA_PATH,
  readState,
  writeState,
  defaultState,
  upsert,
  generateId,
};
