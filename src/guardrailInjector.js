const DEFAULT_POLICY_CLAUSES = {
  VECTOR_ONLY: [
    'You MUST only use facts from the provided vector evidence bundle.',
    'Do NOT use outside knowledge or web facts.',
  ],
  WEB_ONLY: [
    'You MUST cite web sources for every external claim.',
    'If sources are insufficient, list missing items explicitly.',
  ],
  VECTOR_LLM: [
    'Prefer vector evidence; only use model knowledge for connective tissue.',
  ],
  WEB_LLM: [
    'Prefer web evidence; cite all web-derived claims.',
  ],
  VECTOR_WEB: [
    'Clearly distinguish vector-sourced and web-sourced evidence.',
  ],
  ALL: [
    'Use evidence bundles first; do not add unsupported claims.',
  ],
  SYNTHESIS_ONLY: [
    'You MUST NOT add new facts; summarize provided sections only.',
    'Do NOT call retrieval tools.',
  ],
  LLM_ONLY: [
    'Do not fabricate facts; be explicit about assumptions.',
  ],
};

function getPolicyClauses(evidencePolicy, stage) {
  const base = DEFAULT_POLICY_CLAUSES[evidencePolicy] || [];
  if (stage === 'synthesis' && evidencePolicy !== 'SYNTHESIS_ONLY') {
    return base.concat(['Do NOT add new facts in synthesis.']);
  }
  return base;
}

function uniqueClauses(list) {
  const seen = new Set();
  const results = [];
  list.forEach((item) => {
    const trimmed = item.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      results.push(trimmed);
    }
  });
  return results;
}

function injectGuardrails(basePrompt, section, stage) {
  const policy = section.evidencePolicy || 'LLM_ONLY';
  const policyClauses = getPolicyClauses(policy, stage);
  const sectionClauses = Array.isArray(section.guardrails) ? section.guardrails : [];
  const clauses = uniqueClauses([...policyClauses, ...sectionClauses]);

  if (!clauses.length) {
    return basePrompt;
  }

  const header = '\n\n[NON-REMOVABLE GUARDRAILS]\n';
  const body = clauses.map((clause, idx) => `${idx + 1}. ${clause}`).join('\n');
  return `${basePrompt}${header}${body}`;
}

module.exports = {
  injectGuardrails,
  DEFAULT_POLICY_CLAUSES,
  getPolicyClauses,
};
