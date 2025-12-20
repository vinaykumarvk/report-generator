module.exports = {
  promptsService: {
    async generateAssumptions(run) {
      return [`Assumptions for ${run.title}`];
    },
    async generateGlossary(run) {
      return ['Term: Definition'];
    },
    async generateScope(run) {
      return ['Scope item'];
    },
    async generatePrompts(run) {
      return { planning: 'plan prompt', writing: 'write prompt' };
    },
    async plan(section, run) {
      return `Plan for ${section.name}`;
    },
  },
  retrievalService: {
    async retrieve(section, run) {
      return [`Evidence for ${section.name}`];
    },
  },
  writerService: {
    async write(section, run, evidenceBundle) {
      return `Content for ${section.name}`;
    },
  },
  verifierService: {
    async verify(section, run, content, evidenceBundle) {
      return `Verified ${section.name}`;
    },
  },
  repairService: {
    async repair(section, run, evidenceBundle) {
      return { summary: `Repaired ${section.name}` };
    },
  },
  cohesionService: {
    async normalize(sections) {
      return sections.map((s) => ({ ...s, normalized: true }));
    },
  },
  assemblyService: {
    async assemble(run, sections) {
      return `Report for ${run.title} with ${sections.length} sections`;
    },
  },
};
