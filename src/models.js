const crypto = require('crypto');

const STATUSES = {
  PENDING: 'pending',
  PLANNING: 'planning',
  RETRIEVING: 'retrieving',
  WRITING: 'writing',
  VERIFYING: 'verifying',
  REPAIRING: 'repairing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

function createReportRun({ templateId, title, profile, sections }) {
  return {
    id: crypto.randomUUID(),
    templateId,
    title: title || 'Untitled Report',
    status: STATUSES.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    profile: profile || { mode: 'fast', verify: false, repair: false },
    blueprint: null,
    sections: sections.map((section) => ({
      id: crypto.randomUUID(),
      name: section.name,
      dependencies: section.dependencies || [],
      evidenceMode: section.evidenceMode || 'llm_only',
      status: STATUSES.PENDING,
      artifacts: [],
      summary: null,
      error: null,
    })),
    artifacts: [],
    auditLog: [],
  };
}

function createSectionArtifact({ stage, content, evidenceBundle }) {
  return {
    id: crypto.randomUUID(),
    stage,
    content,
    createdAt: new Date().toISOString(),
    evidenceBundle: evidenceBundle || createEvidenceBundle([]),
  };
}

function createEvidenceBundle(items) {
  return {
    id: crypto.randomUUID(),
    items,
    createdAt: new Date().toISOString(),
  };
}

function createBlueprint({ assumptions, glossary, scope, prompts }) {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    assumptions,
    glossary,
    scope,
    prompts,
  };
}

module.exports = {
  STATUSES,
  createReportRun,
  createSectionArtifact,
  createEvidenceBundle,
  createBlueprint,
};
