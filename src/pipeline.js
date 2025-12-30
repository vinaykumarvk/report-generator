const { createSectionArtifact, STATUSES, createBlueprint, createEvidenceBundle } = require('./models');

async function generateBlueprint(run, { promptsService }) {
  const assumptions = await promptsService.generateAssumptions(run);
  const glossary = await promptsService.generateGlossary(run);
  const scope = await promptsService.generateScope(run);
  const prompts = await promptsService.generatePrompts(run);
  return createBlueprint({ assumptions, glossary, scope, prompts });
}

async function runSectionPipeline(section, run, services) {
  const { promptsService, retrievalService, writerService, verifierService, repairService } = services;
  section.status = STATUSES.PLANNING;
  const plan = await promptsService.plan(section, run);
  section.artifacts.push(createSectionArtifact({ stage: 'plan', content: plan }));

  section.status = STATUSES.RETRIEVING;
  let evidenceBundle = null;
  if (section.evidenceMode !== 'llm_only') {
    const evidenceItems = await retrievalService.retrieve(section, run);
    evidenceBundle = createEvidenceBundle(evidenceItems);
  }

  section.status = STATUSES.WRITING;
  const content = await writerService.write(section, run, evidenceBundle);
  section.artifacts.push(createSectionArtifact({ stage: 'write', content, evidenceBundle }));

  if (run.profile.verify) {
    section.status = STATUSES.VERIFYING;
    const verification = await verifierService.verify(section, run, content, evidenceBundle);
    section.artifacts.push(createSectionArtifact({ stage: 'verify', content: verification, evidenceBundle }));
  }

  if (run.profile.repair) {
    section.status = STATUSES.REPAIRING;
    const repaired = await repairService.repair(section, run, evidenceBundle);
    section.artifacts.push(createSectionArtifact({ stage: 'repair', content: repaired, evidenceBundle }));
    section.summary = repaired.summary || repaired;
  } else {
    section.summary = content;
  }

  section.status = STATUSES.COMPLETED;
  section.updatedAt = new Date().toISOString();
  return section;
}

async function normalizeSections(sections, { cohesionService }) {
  const normalized = await cohesionService.normalize(sections);
  return normalized;
}

async function assembleReport(run, sections, { assemblyService }) {
  const assembly = await assemblyService.assemble(run, sections);
  return assembly;
}

function resolveProfileStages(state, templateId, profileId) {
  const template = state.templates.find((t) => t.id === templateId);
  const profile = state.generationProfiles.find((p) => p.id === profileId);
  if (!template || !profile) return null;
  const overrides = (template.profileStages && template.profileStages[profileId]) || {};
  const merged = { ...profile.stageConfig };
  Object.entries(overrides).forEach(([stage, config]) => {
    merged[stage] = { ...merged[stage], ...config };
  });

  return {
    templateId,
    profileId,
    toggles: profile.toggles,
    stages: merged,
  };
}

module.exports = {
  generateBlueprint,
  runSectionPipeline,
  normalizeSections,
  assembleReport,
  resolveProfileStages,
};
