/**
 * Blueprint Generator
 * 
 * Generates a comprehensive report blueprint that ensures consistency
 * across all sections before they are generated.
 */

const OPENAI_BASE_URL = "https://api.openai.com/v1";

function getApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return key;
}

function getModel() {
  return process.env.OPENAI_WRITE_MODEL || "gpt-4o-mini";
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 60000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (error: unknown) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

export type ReportBlueprint = {
  narrativeArc: string;
  keyTerminology: string[];
  tone: {
    formality: number; // 1-5
    perspective: string; // "first-person" | "third-person" | "passive"
    sentenceStructure: string; // "concise" | "detailed" | "mixed"
  };
  keyClaims: Record<string, string[]>; // sectionId -> key claims
  crossReferences: Record<string, string[]>; // sectionId -> sections to reference
  factualAnchors: Array<{
    id: string;
    value: string;
    usedIn: string[];
  }>;
  prohibitions: string[];
  sectionDependencies: Record<string, {
    mustAlignWith?: string[];
    mustNotContradict?: string[];
    shouldReference?: string[];
  }>;
};

export async function generateReportBlueprint(params: {
  templateName: string;
  templateDescription?: string;
  sections: Array<{
    id: string;
    title: string;
    purpose?: string;
  }>;
  userInput: Record<string, unknown>;
  context?: Record<string, unknown>;
}): Promise<ReportBlueprint> {
  const { templateName, templateDescription, sections, userInput, context } = params;

  const blueprintPrompt = `You are planning a comprehensive "${templateName}" report.

${templateDescription ? `REPORT PURPOSE:\n${templateDescription}\n\n` : ""}USER INPUT:
${JSON.stringify(userInput, null, 2)}

${context && Object.keys(context).length > 0 ? `ADDITIONAL CONTEXT:\n${JSON.stringify(context, null, 2)}\n\n` : ""}SECTIONS TO GENERATE:
${sections.map((s, i) => `${i + 1}. ${s.title}${s.purpose ? `: ${s.purpose}` : ""}`).join("\n")}

CREATE A REPORT BLUEPRINT to ensure all sections are cohesive and consistent.

PROVIDE A JSON OBJECT WITH:

1. narrativeArc (string, 3-5 sentences)
   - What story does this report tell from start to finish?
   - How do sections build on each other?
   - What is the logical progression?

2. keyTerminology (array of 10-15 strings)
   - Core concepts that must be used consistently across all sections
   - Preferred terms (e.g., "client" vs "customer", "revenue" vs "income")
   - Domain-specific terminology

3. tone (object)
   - formality: number 1-5 (1=casual, 5=very formal)
   - perspective: "first-person" | "third-person" | "passive"
   - sentenceStructure: "concise" | "detailed" | "mixed"

4. keyClaims (object: sectionId -> array of 2-3 main points)
   - What are the key points each section must make?
   - What insights should each section deliver?

5. crossReferences (object: sectionId -> array of section IDs)
   - Which sections should reference each other?
   - What connections must be explicit?

6. factualAnchors (array of objects)
   - Facts, numbers, or data points that multiple sections will reference
   - Each with: id, value, usedIn (array of section IDs)

7. prohibitions (array of strings)
   - What must NOT be included in the report?
   - Any compliance or regulatory constraints?
   - Common mistakes to avoid?

8. sectionDependencies (object: sectionId -> dependency rules)
   - mustAlignWith: sections that must have consistent facts/conclusions
   - mustNotContradict: sections that must not have conflicting information
   - shouldReference: sections that should be mentioned/cited

OUTPUT ONLY VALID JSON. No markdown, no explanations, just the JSON object.`;

  const res = await fetchWithTimeout(
    `${OPENAI_BASE_URL}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getModel(),
        messages: [
          {
            role: "system",
            content: "You are an expert report planner. You create detailed blueprints that ensure report cohesion and consistency. Always output valid JSON."
          },
          {
            role: "user",
            content: blueprintPrompt
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      }),
    },
    60000
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Blueprint generation failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error("No content in blueprint response");
  }

  try {
    const blueprint = JSON.parse(content);
    
    // Validate blueprint structure
    if (!blueprint.narrativeArc || !blueprint.keyTerminology || !blueprint.tone) {
      throw new Error("Invalid blueprint structure: missing required fields");
    }

    return blueprint as ReportBlueprint;
  } catch (err) {
    throw new Error(`Failed to parse blueprint JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function formatBlueprintForSection(
  blueprint: ReportBlueprint,
  sectionId: string
): string {
  const keyClaims = blueprint.keyClaims[sectionId] || [];
  const crossRefs = blueprint.crossReferences[sectionId] || [];
  const deps = blueprint.sectionDependencies[sectionId];
  const relevantAnchors = blueprint.factualAnchors.filter(a => a.usedIn.includes(sectionId));

  return `
REPORT BLUEPRINT (follow strictly):

NARRATIVE ARC:
${blueprint.narrativeArc}

KEY TERMINOLOGY (use consistently):
${blueprint.keyTerminology.join(", ")}

TONE & STYLE:
- Formality: ${blueprint.tone.formality}/5
- Perspective: ${blueprint.tone.perspective}
- Sentence structure: ${blueprint.tone.sentenceStructure}

KEY CLAIMS FOR THIS SECTION:
${keyClaims.map((claim, i) => `${i + 1}. ${claim}`).join("\n")}

${crossRefs.length > 0 ? `REFERENCE THESE SECTIONS:\n${crossRefs.join(", ")}\n` : ""}
${deps?.mustAlignWith ? `MUST ALIGN WITH: ${deps.mustAlignWith.join(", ")}\n` : ""}
${deps?.mustNotContradict ? `MUST NOT CONTRADICT: ${deps.mustNotContradict.join(", ")}\n` : ""}
${relevantAnchors.length > 0 ? `FACTUAL ANCHORS (use these exact values):\n${relevantAnchors.map(a => `- ${a.id}: ${a.value}`).join("\n")}\n` : ""}
PROHIBITIONS:
${blueprint.prohibitions.map(p => `- ${p}`).join("\n")}
`.trim();
}

