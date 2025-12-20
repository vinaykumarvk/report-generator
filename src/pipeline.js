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
  resolveProfileStages,
};
