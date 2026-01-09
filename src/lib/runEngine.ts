import crypto from "crypto";
import type { EvidenceItem } from "@/lib/retrieval";
import { buildClaims, enforceEvidencePolicy } from "@/lib/evidencePolicy";
import { runReviewerSimulation } from "@/lib/reviewer";
import { hasOpenAIKey, runWriterPrompt } from "@/lib/openaiWriter";
import { runVerificationPrompt } from "@/lib/openaiVerifier";

type Blueprint = {
  glossary: string[];
  assumptions: string[];
  scope: string[];
  nonGoals: string[];
  boundaries: string[];
  createdAt: string;
};

type SectionSnapshot = {
  id: string;
  title: string;
  purpose?: string;
  outputFormat?: string;
  evidencePolicy?: string;
  prompt?: string;
  vectorPolicyJson?: { connectorIds?: string[] } | null;
  webPolicyJson?: { allowlist?: string[]; blocklist?: string[]; minSources?: number; citationStyle?: string } | null;
  qualityGatesJson?: { noNewFacts?: boolean } | null;
};

type TemplateSnapshot = {
  id: string;
  name: string;
  defaultVectorStoreIds?: string[] | null;
  sourcesJson?: Array<{
    type?: string;
    metadata?: { vectorStoreId?: string; fileIds?: string[] };
    vectorStoreId?: string;
  }> | null;
  sections: SectionSnapshot[];
};

type SectionRun = {
  id: string;
  runId: string;
  templateSectionId: string;
  title: string;
  status: string;
  attemptCount: number;
  artifacts: Array<{
    id: string;
    type: string;
    content: unknown;
    createdAt: string;
  }>;
  outputFingerprint?: string;
};

type Connector = {
  id: string;
  type: string;
  name: string;
  configJson?: Record<string, unknown>;
};

type GenerationProfile = {
  id: string;
  name: string;
  toggles?: {
    enableVerification?: boolean;
    enableRepair?: boolean;
    enableReviewer?: boolean;
    enforceCitations?: boolean;
  };
  stageConfig?: Record<string, { enabled?: boolean }>;
};

type PromptSet = {
  id: string;
  globalPrompts?: { system?: string; developer?: string };
  sections?: Array<{
    id: string;
    name?: string;
    purpose?: string;
    stages?: Record<string, string>;
  }>;
};

type SectionScore = {
  coverage: number;
  diversity: number;
  recency: number;
  redundancy: number;
};

type SourceOverride = {
  vectorStoreIds?: string[];
  fileIds?: string[];
  webSearchEnabled?: boolean;
};

function computeScores(evidence: Array<{ id: string; kind?: string }>): SectionScore {
  if (evidence.length === 0) {
    return { coverage: 0, diversity: 0, recency: 0, redundancy: 0 };
  }
  const uniqueKinds = new Set(
    evidence.map((item) => (item.kind ? String(item.kind) : "unknown"))
  );
  const diversity = uniqueKinds.size / evidence.length;
  return {
    coverage: Math.min(1, evidence.length / 3),
    diversity,
    recency: 0.5,
    redundancy: Math.max(0, 1 - diversity),
  };
}

const EVIDENCE_REQUIRED_POLICIES = new Set([
  "VECTOR_ONLY",
  "WEB_ONLY",
  "VECTOR_LLM",
  "WEB_LLM",
  "VECTOR_WEB",
  "ALL",
]);

function nowIso() {
  return new Date().toISOString();
}

function createArtifact(type: string, content: unknown) {
  return {
    id: crypto.randomUUID(),
    type,
    content,
    createdAt: nowIso(),
  };
}

export function buildBlueprint(template: TemplateSnapshot): Blueprint {
  return {
    glossary: [],
    assumptions: [`Template: ${template.name}`],
    scope: ["Generate sections per template definition."],
    nonGoals: [],
    boundaries: [],
    createdAt: nowIso(),
  };
}

function planSection(section: SectionSnapshot) {
  return {
    outline: [`Cover purpose: ${section.purpose || section.title}`],
    retrievalQueries: [section.title],
    keyConstraints: [section.outputFormat || "NARRATIVE"],
    riskNotes: [],
  };
}

function resolveVectorIds(
  section: SectionSnapshot,
  template: TemplateSnapshot,
  runInput: Record<string, unknown>
) {
  const overrides = (runInput.vectorStoreOverrides as Record<string, string[]>) || {};
  const bySection = overrides[section.id];
  if (Array.isArray(bySection) && bySection.length > 0) {
    return bySection;
  }
  const sectionIds = section.vectorPolicyJson?.connectorIds || [];
  if (sectionIds.length > 0) {
    return sectionIds;
  }
  const templateDefaults = template.defaultVectorStoreIds || [];
  if (templateDefaults.length > 0) {
    return templateDefaults;
  }
  const sourceIds = (template.sourcesJson || [])
    .filter((source) => source?.type === "VECTOR")
    .map((source) => source?.metadata?.vectorStoreId || source?.vectorStoreId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  return sourceIds;
}

function resolveVectorToolConfig(
  section: SectionSnapshot,
  template: TemplateSnapshot,
  connectors: Connector[],
  runInput: Record<string, unknown>
) {
  const overrides = (runInput.sourceOverrides as Record<string, SourceOverride>) || {};
  const override = overrides[section.id];
  const overrideStores = Array.isArray(override?.vectorStoreIds)
    ? override?.vectorStoreIds
    : null;
  const overrideFileIds = Array.isArray(override?.fileIds)
    ? override?.fileIds
    : null;
  const selectedIds = overrideStores ?? resolveVectorIds(section, template, runInput);
  if (!selectedIds.length) {
    return { vectorStoreIds: [] as string[], fileIds: undefined as string[] | undefined };
  }
  const selected = connectors.filter((connector) =>
    selectedIds.includes(connector.id)
  );
  const vectorStoreIds = new Set<string>();
  const fileIds = new Set<string>();
  selectedIds.forEach((id) => {
    if (!selected.find((connector) => connector.id === id)) {
      vectorStoreIds.add(id);
    }
  });
  selected.forEach((connector) => {
    const stores = Array.isArray(connector.configJson?.vectorStores)
      ? connector.configJson?.vectorStores
      : null;
    if (stores && stores.length > 0) {
      stores.forEach((store: any) => {
        if (store?.id) {
          vectorStoreIds.add(store.id);
        }
        if (!overrideFileIds && Array.isArray(store?.fileIds)) {
          store.fileIds.forEach((id: string) => fileIds.add(id));
        }
      });
      return;
    }
    const vectorStoreId =
      (connector.configJson?.vectorStoreId as string) || connector.id;
    if (vectorStoreId) {
      vectorStoreIds.add(vectorStoreId);
    }
  });
  if (overrideFileIds) {
    overrideFileIds.forEach((id) => fileIds.add(id));
  }
  const fileIdList = Array.from(fileIds);
  return {
    vectorStoreIds: Array.from(vectorStoreIds),
    fileIds: fileIdList.length > 0 ? fileIdList : undefined,
  };
}

function writeSection(section: SectionSnapshot, evidence: EvidenceItem[]) {
  const lines = [
    `### ${section.title}`,
    section.purpose ? section.purpose : "",
    `Evidence policy: ${section.evidencePolicy || "LLM_ONLY"}.`,
  ].filter(Boolean);
  if (evidence.length === 0 && EVIDENCE_REQUIRED_POLICIES.has(section.evidencePolicy || "")) {
    lines.push("Open questions: evidence required but not available.");
  }
  if (evidence.length > 0) {
    lines.push(`Key point supported by evidence [citation:${evidence[0].id}].`);
  }
  const webSources = (evidence as any[]).filter((item) => item.kind === "web");
  if (webSources.length > 0) {
    const citationStyle = section.webPolicyJson?.citationStyle || "sources";
    const header =
      citationStyle === "endnotes"
        ? "References"
        : citationStyle === "footnotes"
        ? "Footnotes"
        : "Sources";
    const sourceLines = webSources.map((item) => {
      const url = item.metadata?.url || "";
      return `- [citation:${item.id}] ${url}`;
    });
    lines.push(`${header}:\n${sourceLines.join("\n")}`);
  }
  return lines.join("\n\n");
}

async function writeSectionWithModel(params: {
  section: SectionSnapshot;
  evidence: EvidenceItem[];
  vectorToolConfig?: { vectorStoreIds: string[]; fileIds?: string[] };
  webToolConfig?: { enabled: boolean };
  runInput?: Record<string, unknown>;
  promptBundle: {
    system?: string;
    developer?: string;
    plan?: string;
    write?: string;
    verify?: string;
    repair?: string;
    synthesis?: string;
  };
  blueprintGuidance?: string;
}) {
  if (!hasOpenAIKey()) {
    return writeSection(params.section, params.evidence);
  }
  
  // Prepend blueprint guidance to the developer prompt if available
  const enhancedPromptBundle = { ...params.promptBundle };
  if (params.blueprintGuidance) {
    const blueprintSection = `\n\n--- REPORT COHESION BLUEPRINT ---\n${params.blueprintGuidance}\n--- END BLUEPRINT ---\n\n`;
    enhancedPromptBundle.developer = (enhancedPromptBundle.developer || "") + blueprintSection;
  }
  
  return await runWriterPrompt({
    section: {
      title: params.section.title,
      purpose: params.section.purpose,
      outputFormat: params.section.outputFormat,
      evidencePolicy: params.section.evidencePolicy,
      prompt: params.section.prompt,
    },
    evidence: params.evidence.map((item) => ({
      id: item.id,
      source: (item as any).source || "",
      kind: item.kind,
      content: item.content,
      metadata: item.metadata || {},
    })),
    fileSearch: params.vectorToolConfig,
    webSearch: params.webToolConfig,
    context: params.runInput,
    promptBundle: enhancedPromptBundle,
  });
}

function repairSection(draft: string, verification: { pass: boolean; issues: string[] }) {
  if (verification.pass) return draft;
  return `${draft}\n\nRepairs applied:\n- ${verification.issues.join("\n- ")}`;
}

function stageEnabled(profile: GenerationProfile | null, stage: string, fallback: boolean) {
  if (!profile) return fallback;
  if (profile.stageConfig && profile.stageConfig[stage]) {
    return profile.stageConfig[stage].enabled !== false;
  }
  return fallback;
}

function fingerprint(value: string) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

export async function runSection(
  params: {
    sectionRun: SectionRun;
    section: SectionSnapshot;
    template: TemplateSnapshot;
    connectors: Connector[];
    profile: GenerationProfile | null;
    runInput: Record<string, unknown>;
    promptSet?: PromptSet | null;
    blueprintGuidance?: string;
  }
) {
  const { sectionRun, section, template, connectors, profile, runInput, blueprintGuidance } = params;
  const promptSection = params.promptSet?.sections?.find(
    (item) => item.id === section.id
  );
  const promptSystem = params.promptSet?.globalPrompts?.system || "";
  const promptDeveloper = params.promptSet?.globalPrompts?.developer || "";
  const stagePrompts = promptSection?.stages || {};
  const promptBundle = {
    system: promptSystem,
    developer: promptDeveloper,
    plan: stagePrompts.plan || "",
    write: stagePrompts.write || "",
    verify: stagePrompts.verify || "",
    repair: stagePrompts.repair || "",
    synthesis: stagePrompts.synthesis || "",
  };
  const plan = stageEnabled(profile, "plan", true) ? planSection(section) : null;
  const retrieveEnabled = stageEnabled(profile, "retrieve", true);
  const webPolicy = Boolean(section.evidencePolicy?.includes("WEB"));
  const sourceOverrides = (runInput.sourceOverrides as Record<string, SourceOverride>) || {};
  const sourceOverride = sourceOverrides[section.id];
  const vectorToolConfig = retrieveEnabled
    ? resolveVectorToolConfig(section, template, connectors, runInput)
    : { vectorStoreIds: [] as string[] };
  const evidence: EvidenceItem[] = [];
  const webToolConfig = {
    enabled:
      sourceOverride?.webSearchEnabled ??
      Boolean(retrieveEnabled && webPolicy),
  };
  const logger = require("@/lib/logger").logger;
  logger.info(
    {
      sectionId: section.id,
      sectionTitle: section.title,
      vectorStoreIds: vectorToolConfig.vectorStoreIds,
      fileIds: ('fileIds' in vectorToolConfig && vectorToolConfig.fileIds) || [],
      retrieveEnabled,
      webSearchEnabled: Boolean(webToolConfig.enabled),
    },
    "[RunEngine] resolved tool config"
  );
  const draft = stageEnabled(profile, "write", true)
    ? await writeSectionWithModel({
        section,
        evidence,
        vectorToolConfig:
          vectorToolConfig.vectorStoreIds.length > 0 ? vectorToolConfig : undefined,
        webToolConfig,
        runInput,
        promptBundle,
        blueprintGuidance,
      })
    : "";
  const claims = buildClaims(draft, evidence);
  const policyCheck = enforceEvidencePolicy({
    policy: section.evidencePolicy,
    markdown: draft,
    evidence,
    claims,
    noNewFacts: Boolean(section.qualityGatesJson?.noNewFacts),
    enforceCitations: Boolean(profile?.toggles?.enforceCitations),
    toolEvidence: {
      vector: Boolean(vectorToolConfig.vectorStoreIds.length),
      web: Boolean(webToolConfig.enabled),
    },
  });
  let verification = stageEnabled(profile, "verify", false)
    ? { pass: policyCheck.pass, issues: policyCheck.issues }
    : { pass: true, issues: [] };
  if (stageEnabled(profile, "verify", false) && hasOpenAIKey()) {
    try {
      const modelVerification = await runVerificationPrompt({
        sectionTitle: section.title,
        evidencePolicy: section.evidencePolicy,
        evidence: evidence.map((item: any) => ({
          id: item.id,
          kind: item.kind,
          content: item.content,
        })),
        draft,
      });
      const combinedIssues = [
        ...(policyCheck.issues || []),
        ...(modelVerification.issues || []),
      ];
      verification = {
        pass: combinedIssues.length === 0,
        issues: combinedIssues,
      };
    } catch {
      verification = { pass: policyCheck.pass, issues: policyCheck.issues };
    }
  }
  const repaired = stageEnabled(profile, "repair", false)
    ? repairSection(draft, verification)
    : draft;
  const reviewEnabled = Boolean(profile?.toggles?.enableReviewer);
  const review = reviewEnabled
    ? await runReviewerSimulation({
        section_name: section.title,
        verification_summary: policyCheck.issues.join("; "),
      })
    : null;
  const scores = computeScores(evidence);
  const provenance = claims.map((claim) => ({
    claim: claim.text,
    evidenceIds: claim.evidenceIds || [],
  }));
  const outputFingerprint = fingerprint(repaired);

  return {
    ...sectionRun,
    status: "COMPLETED",
    attemptCount: sectionRun.attemptCount + 1,
      artifacts: [
        ...(plan ? [createArtifact("PLAN", plan)] : []),
        createArtifact("EVIDENCE", evidence),
        createArtifact("DRAFT", draft),
        ...(verification ? [createArtifact("VERIFICATION", verification)] : []),
        ...(review ? [createArtifact("REVIEW", review.parsed)] : []),
        createArtifact("FINAL", repaired),
        createArtifact("CLAIMS", claims),
        createArtifact("PROVENANCE", provenance),
        createArtifact("SCORES", scores),
        createArtifact("PROMPTS_USED", promptBundle),
      ],
    outputFingerprint,
  };
}

export function assembleFinalReport(
  template: TemplateSnapshot,
  sectionRuns: SectionRun[]
) {
  const orderedSections = template.sections.map((section) => {
    const sectionRun = sectionRuns.find(
      (run) => run.templateSectionId === section.id
    );
    const finalArtifact = sectionRun?.artifacts.find(
      (artifact) => artifact.type === "FINAL"
    );
    return {
      title: section.title,
      content: typeof finalArtifact?.content === "string" ? finalArtifact.content : "",
    };
  });

  const reportBody = orderedSections
    .map((section) => {
      // Check if content already starts with the section title as a header
      const headerRegex = new RegExp(`^##\\s+${section.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      const alreadyHasHeader = headerRegex.test(section.content.trim());
      
      if (alreadyHasHeader) {
        // Content already has the header, don't add it again
        return section.content;
      } else {
        // Add the header
        return `## ${section.title}\n\n${section.content}`;
      }
    })
    .join("\n\n");
  const toc = orderedSections.map((section, index) => `- ${index + 1}. ${section.title}`);
  return `# Report\n\n## Table of Contents\n${toc.join("\n")}\n\n${reportBody}`;
}

export function synthesizeExecutiveSummary(
  template: TemplateSnapshot,
  sectionRuns: SectionRun[]
) {
  const execSection = template.sections.find((section) =>
    /executive summary/i.test(section.title || "")
  );
  if (!execSection) return null;

  const execRun = sectionRuns.find(
    (run) => run.templateSectionId === execSection.id
  );
  if (!execRun) return null;

  const otherSections = sectionRuns.filter(
    (run) => run.templateSectionId !== execSection.id
  );
  const snippets = otherSections
    .map((run) => {
      const finalArtifact = run.artifacts.find(
        (artifact) => artifact.type === "FINAL"
      );
      const content =
        typeof finalArtifact?.content === "string" ? finalArtifact.content : "";
      const firstSentence = content.split(".")[0].trim();
      return firstSentence ? `- ${firstSentence}.` : null;
    })
    .filter(Boolean);

  const synthesized = [
    `## ${execSection.title}`,
    "Summary of prior sections:",
    ...(snippets.length ? snippets : ["- No prior section content available."]),
  ].join("\n");

  const updatedArtifacts = execRun.artifacts.filter(
    (artifact) => artifact.type !== "FINAL"
  );
  updatedArtifacts.push(createArtifact("SYNTHESIS", synthesized));
  updatedArtifacts.push(createArtifact("FINAL", synthesized));

  return {
    ...execRun,
    artifacts: updatedArtifacts,
  };
}

export async function runPipeline(
  template: TemplateSnapshot,
  sectionRuns: SectionRun[],
  connectors: Connector[],
  profile: GenerationProfile | null,
  runInput: Record<string, unknown>
) {
  const blueprint = buildBlueprint(template);
  const updatedSections = await Promise.all(
    sectionRuns.map(async (sectionRun) => {
      const section = template.sections.find(
        (item) => item.id === sectionRun.templateSectionId
      );
      if (!section) {
        return {
          ...sectionRun,
          status: "FAILED",
          artifacts: [
            ...sectionRun.artifacts,
            createArtifact("ERROR", "Missing template section."),
          ],
        };
      }
      return await runSection({
        sectionRun,
        section,
        template,
        connectors,
        profile,
        runInput,
      });
    })
  );

  const finalReport = assembleFinalReport(template, updatedSections);

  return {
    blueprint,
    sectionRuns: updatedSections,
    finalReport,
    dependencySnapshot: {
      templateId: template.id,
      blueprintAssumptions: blueprint.assumptions,
      retrievalQueriesBySection: Object.fromEntries(
        template.sections.map((section) => [section.id, [section.title]])
      ),
      sectionOutputs: Object.fromEntries(
        updatedSections.map((sectionRun) => [
          sectionRun.templateSectionId,
          sectionRun.outputFingerprint || "",
        ])
      ),
    },
  };
}
