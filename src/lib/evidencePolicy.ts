import { EvidenceItem } from "@/lib/retrieval";

type Claim = {
  text: string;
  evidenceIds: string[];
};

const EVIDENCE_REQUIRED_POLICIES = new Set([
  "VECTOR_ONLY",
  "WEB_ONLY",
  "VECTOR_LLM",
  "WEB_LLM",
  "VECTOR_WEB",
  "ALL",
]);

const POLICY_REQUIRES_WEB = new Set(["WEB_ONLY", "WEB_LLM", "VECTOR_WEB", "ALL"]);

const CITATION_PATTERN = /\[citation:([^\]]+)\]/g;

export function buildClaims(markdown: string, evidence: EvidenceItem[]) {
  const evidenceIds = evidence.map((item) => item.id);
  const sentences = markdown.split(".").map((s) => s.trim()).filter(Boolean);
  return sentences.map((sentence) => ({
    text: sentence,
    evidenceIds: evidenceIds.length > 0 ? [evidenceIds[0]] : [],
  }));
}

export function enforceEvidencePolicy(params: {
  policy: string | undefined;
  markdown: string;
  evidence: EvidenceItem[];
  claims: Claim[];
  noNewFacts: boolean;
  enforceCitations: boolean;
  toolEvidence?: { vector?: boolean; web?: boolean };
}) {
  const issues: string[] = [];
  const policy = params.policy || "LLM_ONLY";
  const requiresEvidence = EVIDENCE_REQUIRED_POLICIES.has(policy);
  const hasToolEvidence = Boolean(
    params.toolEvidence?.vector || params.toolEvidence?.web
  );
  const hasEvidence = params.evidence.length > 0 || hasToolEvidence;
  const citations = Array.from(params.markdown.matchAll(CITATION_PATTERN)).map(
    (match) => match[1]
  );

  if (requiresEvidence && !hasEvidence) {
    issues.push("Evidence required but none provided.");
  }

  if (policy === "SYNTHESIS_ONLY" && hasEvidence) {
    issues.push("SYNTHESIS_ONLY section should not include evidence.");
  }

  if (policy === "SYNTHESIS_ONLY" && params.noNewFacts && params.markdown.length === 0) {
    issues.push("SYNTHESIS_ONLY section has no content.");
  }

  if (params.enforceCitations && requiresEvidence && params.evidence.length > 0) {
    params.claims.forEach((claim) => {
      if (claim.evidenceIds.length === 0) {
        issues.push(`Claim missing evidence: "${claim.text}".`);
      }
      claim.evidenceIds.forEach((evidenceId) => {
        if (!citations.includes(evidenceId)) {
          issues.push(`Missing citation for evidence id: ${evidenceId}.`);
        }
      });
    });
  }

  if (POLICY_REQUIRES_WEB.has(policy)) {
    const hasWeb = params.evidence.some((item) => item.kind === "web");
    if (!hasWeb) {
      issues.push("Web evidence required but none found.");
    }
  }

  return {
    pass: issues.length === 0,
    issues,
  };
}
