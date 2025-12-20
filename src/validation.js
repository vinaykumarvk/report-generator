const P0_RULES = {
  EVIDENCE_POLICY_REQUIRED: "EVIDENCE_POLICY_REQUIRED",
  SYNTHESIS_ONLY_NO_RETRIEVAL: "SYNTHESIS_ONLY_NO_RETRIEVAL",
  RETRIEVAL_REQUIRED_FOR_EVIDENCE: "RETRIEVAL_REQUIRED_FOR_EVIDENCE",
};

const ALLOWED_EVIDENCE_POLICIES = [
  "EVIDENCE_REQUIRED",
  "EVIDENCE_OPTIONAL",
  "SYNTHESIS_ONLY",
];

const ALLOWED_RETRIEVAL_METHODS = [
  "SYNTHESIS_ONLY",
  "VECTOR_ONLY",
  "WEB_ONLY",
  "VECTOR_AND_WEB",
];

function validateTemplate(template, sections) {
  const issues = [];

  sections.forEach((section) => {
    if (!section.evidencePolicy) {
      issues.push({
        code: P0_RULES.EVIDENCE_POLICY_REQUIRED,
        severity: "P0",
        message: `Section "${section.title}" is missing an evidence policy.`,
        sectionId: section.id,
      });
    }

    if (
      section.evidencePolicy === "SYNTHESIS_ONLY" &&
      section.retrievalMethod &&
      section.retrievalMethod !== "SYNTHESIS_ONLY"
    ) {
      issues.push({
        code: P0_RULES.SYNTHESIS_ONLY_NO_RETRIEVAL,
        severity: "P0",
        message: `Section "${section.title}" is synthesis-only but has retrieval configured (${section.retrievalMethod}).`,
        sectionId: section.id,
      });
    }

    if (
      section.evidencePolicy === "EVIDENCE_REQUIRED" &&
      (!section.retrievalMethod ||
        section.retrievalMethod === "SYNTHESIS_ONLY")
    ) {
      issues.push({
        code: P0_RULES.RETRIEVAL_REQUIRED_FOR_EVIDENCE,
        severity: "P0",
        message: `Section "${section.title}" requires evidence but retrieval is disabled.`,
        sectionId: section.id,
      });
    }

    if (
      section.evidencePolicy &&
      !ALLOWED_EVIDENCE_POLICIES.includes(section.evidencePolicy)
    ) {
      issues.push({
        code: P0_RULES.EVIDENCE_POLICY_REQUIRED,
        severity: "P0",
        message: `Section "${section.title}" has an unknown evidence policy value.`,
        sectionId: section.id,
      });
    }

    if (
      section.retrievalMethod &&
      !ALLOWED_RETRIEVAL_METHODS.includes(section.retrievalMethod)
    ) {
      issues.push({
        code: P0_RULES.SYNTHESIS_ONLY_NO_RETRIEVAL,
        severity: "P0",
        message: `Section "${section.title}" has an unknown retrieval method value.`,
        sectionId: section.id,
      });
    }
  });

  const valid = issues.filter((issue) => issue.severity === "P0").length === 0;

  return {
    valid,
    issues,
    templateId: template.id,
  };
}

module.exports = {
  validateTemplate,
  P0_RULES,
  ALLOWED_EVIDENCE_POLICIES,
  ALLOWED_RETRIEVAL_METHODS,
};
