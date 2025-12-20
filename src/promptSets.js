const { randomUUID } = require('crypto');
const { loadData, saveData } = require('./dataStore');
const { injectGuardrails } = require('./guardrailInjector');

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function listPromptSets() {
  const data = loadData();
  return data.promptSets;
}

function findPromptSet(id) {
  const data = loadData();
  return data.promptSets.find((set) => set.id === id);
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
      publishedVersion: set.publishedVersion || null,
    }),
  };
}

function createPromptSet({ name, sections }) {
  const data = loadData();
  const baseSections = Array.isArray(sections) && sections.length
    ? sections
    : [
        {
          id: randomUUID(),
          name: 'New Section',
          basePrompt: 'Describe the section goals and tone.',
          overrides: {},
          evidencePolicy: 'vector-only',
          guardrails: [],
        },
      ];

  const promptSet = {
    id: randomUUID(),
    name: name || 'Untitled Prompt Set',
    state: 'draft',
    version: 1,
    publishedVersion: null,
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
  if (Array.isArray(payload.sections)) existing.sections = payload.sections;
  existing.version += 1;
  existing.state = payload.state || existing.state;

  existing.history.push(snapshotEntry(existing, 'updated', note || 'Updated draft'));
  saveData(data);
  return existing;
}

function publishPromptSet(id, note) {
  const data = loadData();
  const set = data.promptSets.find((item) => item.id === id);
  if (!set) return null;

  set.state = 'published';
  set.publishedVersion = set.version;
  set.history.push(snapshotEntry(set, 'published', note || 'Published for use'));
  saveData(data);
  return set;
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
  set.state = 'draft';
  set.version += 1;
  set.history.push(snapshotEntry(set, 'rollback', note || `Rolled back to version ${targetVersion}`));
  saveData(data);
  return set;
}

function renderedSectionPrompt(setId, sectionId) {
  const set = findPromptSet(setId);
  if (!set) return null;
  const section = set.sections.find((item) => item.id === sectionId);
  if (!section) return null;
  const base = section.basePrompt || '';
  const override = section.overrides && section.overrides.write ? section.overrides.write : '';
  const combined = [base, override].filter(Boolean).join('\n\n');
  const injected = injectGuardrails(combined, section);
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
};
