const DEFAULT_POLICY_CLAUSES = {
  'vector-only': [
    'Do not introduce claims that are not present in the approved vector store context.',
    'Cite only the provided vector documents.',
  ],
  'web-search': [
    'When using web search, cite every external claim with the source URL.',
    'Avoid referencing internal-only documents when responding to public content.',
  ],
  hybrid: [
    'Clearly distinguish between vector-sourced and web-sourced evidence.',
    'Prefer vector evidence if a conflict arises; flag any inconsistencies explicitly.',
  ],
};

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

function injectGuardrails(basePrompt, section) {
  const policy = section.evidencePolicy || 'vector-only';
  const policyClauses = DEFAULT_POLICY_CLAUSES[policy] || [];
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
};
