const { randomUUID } = require('crypto');
const { loadData, saveData } = require('./dataStore');
const { injectGuardrails } = require('./guardrailInjector');

const DEFAULT_STAGES = ['plan', 'write', 'verify', 'repair', 'synthesis'];

function normalizeStages(stages) {
  const normalized = {};
  DEFAULT_STAGES.forEach((stage) => {
    normalized[stage] = typeof stages?.[stage] === 'string' ? stages[stage] : '';
  });
  return normalized;
}

function normalizeSection(section) {
  return {
    id: section.id,
    name: section.name || section.title || 'Section',
    purpose: section.purpose || '',
    evidencePolicy: section.evidencePolicy || 'LLM_ONLY',
    stages: normalizeStages(section.stages || section.overrides || {}),
    guardrails: Array.isArray(section.guardrails) ? section.guardrails : [],
  };
}

function normalizePromptSet(set) {
  return {
    ...set,
    templateId: set.templateId || null,
    globalPrompts: {
      system: set.globalPrompts?.system || '',
      developer: set.globalPrompts?.developer || '',
    },
    sections: Array.isArray(set.sections) ? set.sections.map(normalizeSection) : [],
  };
}

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function listPromptSets() {
  const data = loadData();
  return data.promptSets.map(normalizePromptSet);
}

function findPromptSet(id) {
  const data = loadData();
  const found = data.promptSets.find((set) => set.id === id);
  return found ? normalizePromptSet(found) : null;
}

function snapshotEntry(set, action, note) {
  return {
    version: set.version,
    timestamp: nowIso(),
    action,
    note: note || '',
    state: clone({
      name: set.name,
      state: set.state,
      sections: set.sections,
      globalPrompts: set.globalPrompts,
      templateId: set.templateId || null,
      publishedVersion: set.publishedVersion || null,
    }),
  };
}

function createPromptSet({ name, templateId, sections }) {
  const data = loadData();
  const baseSections = Array.isArray(sections) && sections.length
    ? sections.map(normalizeSection)
    : [
        {
          id: randomUUID(),
          name: 'New Section',
          purpose: '',
          evidencePolicy: 'LLM_ONLY',
          stages: normalizeStages({
            plan: 'Outline the section plan.',
            write: 'Draft the section content.',
            verify: 'Verify compliance with evidence policy.',
            repair: 'Repair the section based on issues.',
            synthesis: 'Summarize section outputs only.',
          }),
          guardrails: [],
        },
      ];

  const promptSet = {
    id: randomUUID(),
    templateId: templateId || null,
    name: name || 'Untitled Prompt Set',
    state: 'draft',
    version: 1,
    publishedVersion: null,
    globalPrompts: {
      system: '',
      developer: '',
    },
    sections: baseSections,
    history: [],
  };

  promptSet.history.push(snapshotEntry(promptSet, 'created', 'Initial draft created'));
  data.promptSets.push(promptSet);
  saveData(data);
  return promptSet;
}

function updatePromptSet(id, payload, note) {
  const data = loadData();
  const existing = data.promptSets.find((set) => set.id === id);
  if (!existing) return null;

  if (payload.name) existing.name = payload.name;
  if (payload.templateId !== undefined) existing.templateId = payload.templateId;
  if (payload.globalPrompts) {
    existing.globalPrompts = {
      system: payload.globalPrompts.system || '',
      developer: payload.globalPrompts.developer || '',
    };
  }
  if (Array.isArray(payload.sections)) {
    existing.sections = payload.sections.map(normalizeSection);
  }
  existing.version += 1;
  existing.state = payload.state || existing.state;

  existing.history.push(snapshotEntry(existing, 'updated', note || 'Updated draft'));
  saveData(data);
  return normalizePromptSet(existing);
}

function publishPromptSet(id, note) {
  const data = loadData();
  const set = data.promptSets.find((item) => item.id === id);
  if (!set) return null;

  set.state = 'published';
  set.publishedVersion = set.version;
  set.history.push(snapshotEntry(set, 'published', note || 'Published for use'));
  saveData(data);
  return normalizePromptSet(set);
}

function rollbackPromptSet(id, targetVersion, note) {
  const data = loadData();
  const set = data.promptSets.find((item) => item.id === id);
  if (!set) return null;

  const targetSnapshot = set.history
    .slice()
    .reverse()
    .find((entry) => entry.version === targetVersion);

  if (!targetSnapshot) return null;

  const snapshotState = targetSnapshot.state;
  set.name = snapshotState.name;
  set.sections = snapshotState.sections;
  set.globalPrompts = snapshotState.globalPrompts || { system: '', developer: '' };
  set.templateId = snapshotState.templateId || null;
  set.state = 'draft';
  set.version += 1;
  set.history.push(snapshotEntry(set, 'rollback', note || `Rolled back to version ${targetVersion}`));
  saveData(data);
  return normalizePromptSet(set);
}

function renderedSectionPrompt(setId, sectionId, stage) {
  const set = findPromptSet(setId);
  if (!set) return null;
  const section = set.sections.find((item) => item.id === sectionId);
  if (!section) return null;
  const base = section.stages?.[stage] || '';
  const combined = [set.globalPrompts?.system, set.globalPrompts?.developer, base]
    .filter(Boolean)
    .join('\n\n');
  const injected = injectGuardrails(combined, section, stage);
  return {
    promptSetId: setId,
    sectionId,
    name: section.name,
    prompt: injected,
    evidencePolicy: section.evidencePolicy,
  };
}

module.exports = {
  listPromptSets,
  findPromptSet,
  createPromptSet,
  updatePromptSet,
  publishPromptSet,
  rollbackPromptSet,
  renderedSectionPrompt,
  normalizePromptSet,
};
