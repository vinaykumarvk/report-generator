export type LintIssue = {
  code: string;
  message: string;
  sectionId?: string;
};

export type LintResult = {
  pass: boolean;
  errors: LintIssue[];
  warnings: LintIssue[];
};

type Template = {
  id: string;
  name: string;
  defaultVectorStoreIds?: string[] | null;
};

type Section = {
  id: string;
  title: string;
  evidencePolicy?: string | null;
  targetLengthMin?: number | null;
  targetLengthMax?: number | null;
  vectorPolicyJson?: { connectorIds?: string[] } | null;
  webPolicyJson?: Record<string, unknown> | null;
  qualityGatesJson?: { noNewFacts?: boolean } | null;
};

type LintOptions = {
  webProviderConfigured?: boolean;
  vectorConnectorIds?: string[];
};

const VECTOR_POLICIES = new Set([
  "VECTOR_ONLY",
  "VECTOR_LLM",
  "VECTOR_WEB",
  "ALL",
]);

const WEB_POLICIES = new Set([
  "WEB_ONLY",
  "WEB_LLM",
  "VECTOR_WEB",
  "ALL",
]);

const TOKEN_WARN_MAX = 1200;
const TOKEN_WARN_MIN = 600;

function hasWebPolicy(section: Section) {
  return Boolean(section.webPolicyJson && Object.keys(section.webPolicyJson).length > 0);
}

function hasRetrievalConfig(section: Section) {
  const vectorIds = section.vectorPolicyJson?.connectorIds || [];
  const webConfig = section.webPolicyJson || null;
  return vectorIds.length > 0 || (webConfig && Object.keys(webConfig).length > 0);
}

export function lintTemplate(
  template: Template,
  sections: Section[],
  options: LintOptions = {}
): LintResult {
  const errors: LintIssue[] = [];
  const warnings: LintIssue[] = [];
  const webProviderConfigured = options.webProviderConfigured ?? false;
  const availableVectorIds = new Set(options.vectorConnectorIds || []);
  const templateVectorIds = template.defaultVectorStoreIds || [];
  const missingTemplateVectorIds = templateVectorIds.filter(
    (id) => !availableVectorIds.has(id)
  );
  if (missingTemplateVectorIds.length > 0) {
    errors.push({
      code: "TEMPLATE_VECTOR_CONNECTOR_UNKNOWN",
      message: `Template default vector store IDs are unknown: ${missingTemplateVectorIds.join(
        ", "
      )}.`,
    });
  }

  sections.forEach((section) => {
    if (!section.evidencePolicy) {
      errors.push({
        code: "MISSING_EVIDENCE_POLICY",
        message: `Section "${section.title}" is missing an evidence policy.`,
        sectionId: section.id,
      });
    }

    if (
      section.evidencePolicy === "SYNTHESIS_ONLY" &&
      hasRetrievalConfig(section)
    ) {
      errors.push({
        code: "SYNTHESIS_ONLY_RETRIEVAL",
        message: `Section "${section.title}" is synthesis-only but has retrieval configured.`,
        sectionId: section.id,
      });
    }

    if (
      section.evidencePolicy &&
      VECTOR_POLICIES.has(section.evidencePolicy)
    ) {
      const connectorIds = section.vectorPolicyJson?.connectorIds || [];
      if (connectorIds.length === 0) {
        errors.push({
          code: "VECTOR_CONNECTOR_REQUIRED",
          message: `Section "${section.title}" requires vector connectors.`,
          sectionId: section.id,
        });
      } else {
        const missing = connectorIds.filter((id) => !availableVectorIds.has(id));
        if (missing.length > 0) {
          errors.push({
            code: "VECTOR_CONNECTOR_UNKNOWN",
            message: `Section "${section.title}" references unknown vector connectors: ${missing.join(
              ", "
            )}.`,
            sectionId: section.id,
          });
        }
      }
    }

    if (section.evidencePolicy && WEB_POLICIES.has(section.evidencePolicy)) {
      if (!webProviderConfigured) {
        errors.push({
          code: "WEB_PROVIDER_REQUIRED",
          message:
            "Web provider is not configured but a web evidence policy is set.",
          sectionId: section.id,
        });
      }
      if (!hasWebPolicy(section)) {
        warnings.push({
          code: "WEB_POLICY_MISSING",
          message: `Section "${section.title}" uses web evidence but has no web policy settings.`,
          sectionId: section.id,
        });
      } else {
        const minSources = (section.webPolicyJson as any).minSources;
        const citationStyle = (section.webPolicyJson as any).citationStyle;
        if (!minSources) {
          warnings.push({
            code: "WEB_MIN_SOURCES",
            message: `Section "${section.title}" has no minimum web sources configured.`,
            sectionId: section.id,
          });
        }
        if (!citationStyle) {
          warnings.push({
            code: "WEB_CITATION_STYLE",
            message: `Section "${section.title}" has no citation style configured.`,
            sectionId: section.id,
          });
        }
      }
    }

    const min = section.targetLengthMin || 0;
    const max = section.targetLengthMax || 0;
    if (min > 0 && max > 0 && min > max) {
      errors.push({
        code: "LENGTH_RANGE_INVALID",
        message: `Section "${section.title}" has target length min greater than max.`,
        sectionId: section.id,
      });
    }

    if (max >= TOKEN_WARN_MAX || min >= TOKEN_WARN_MIN) {
      warnings.push({
        code: "TOKEN_BUDGET_HIGH",
        message: `Section "${section.title}" has a large target length; token budget may be high.`,
        sectionId: section.id,
      });
    }
  });

  const execSummary = sections.find((section) =>
    /executive summary/i.test(section.title || "")
  );
  if (!execSummary) {
    warnings.push({
      code: "EXEC_SUMMARY_MISSING",
      message: `Template "${template.name}" has no Executive Summary section.`,
    });
  } else {
    if (execSummary.evidencePolicy !== "SYNTHESIS_ONLY") {
      errors.push({
        code: "EXEC_SUMMARY_POLICY",
        message:
          'Executive Summary must be marked "SYNTHESIS_ONLY" to prevent new facts.',
        sectionId: execSummary.id,
      });
    }
    if (!execSummary.qualityGatesJson?.noNewFacts) {
      errors.push({
        code: "EXEC_SUMMARY_NO_NEW_FACTS",
        message:
          "Executive Summary must include a no-new-facts quality gate.",
        sectionId: execSummary.id,
      });
    }
  }

  return {
    pass: errors.length === 0,
    errors,
    warnings,
  };
}

export function detectDependencyCycles(
  sections: Array<{ id: string; dependencies?: string[] }>
) {
  const graph = new Map();
  sections.forEach((section) => {
    graph.set(section.id, new Set(section.dependencies || []));
  });

  const visiting = new Set();
  const visited = new Set();
  const cycles: string[][] = [];

  function visit(node: string, stack: string[]) {
    if (visiting.has(node)) {
      const cycleStart = stack.indexOf(node);
      if (cycleStart >= 0) {
        cycles.push(stack.slice(cycleStart).concat(node));
      }
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    const deps = graph.get(node) || new Set();
    deps.forEach((dep: string) => visit(dep, stack.concat(dep)));
    visiting.delete(node);
    visited.add(node);
  }

  sections.forEach((section) => visit(section.id, [section.id]));
  return cycles;
}
