const OPENAI_BASE_URL = "https://api.openai.com/v1";

export type WriterEvidenceItem = {
  id: string;
  source: string;
  kind?: string;
  content: string;
  metadata?: Record<string, unknown>;
};

type WriterSection = {
  title: string;
  purpose?: string;
  outputFormat?: string;
  evidencePolicy?: string;
  prompt?: string | null;
};

type PromptBundle = {
  system?: string;
  developer?: string;
  plan?: string;
  write?: string;
  verify?: string;
  repair?: string;
  synthesis?: string;
};

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

export function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function policyGuidance(policy?: string) {
  if (!policy) return "Use evidence when available and avoid unsupported claims.";
  if (policy === "SYNTHESIS_ONLY") {
    return "Do NOT add new facts; summarize only the provided blueprint context.";
  }
  if (policy.includes("WEB")) {
    return "Prefer web evidence for factual claims and cite sources.";
  }
  if (policy.includes("VECTOR")) {
    return "Prefer vector evidence for factual claims and cite sources.";
  }
  return "Use evidence when available and avoid unsupported claims.";
}

function formatEvidence(items: WriterEvidenceItem[]) {
  if (!items.length) {
    return "None.";
  }
  return items
    .map((item, index) => {
      const url = item.metadata && item.metadata.url ? ` url=${item.metadata.url}` : "";
      const kind = item.kind ? ` kind=${item.kind}` : "";
      const source = item.source ? ` source=${item.source}` : "";
      return `${index + 1}. [${item.id}]${kind}${source}${url}\n${item.content}`;
    })
    .join("\n\n");
}

function extractOutputText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;
  const output = data?.output;
  if (!Array.isArray(output)) return "";
  const parts: string[] = [];
  for (const item of output) {
    if (typeof item?.output_text === "string") {
      parts.push(item.output_text);
    }
    if (typeof item?.text === "string") {
      parts.push(item.text);
    }
    if (Array.isArray(item?.content)) {
      for (const content of item.content) {
        if (typeof content?.text === "string") {
          parts.push(content.text);
        } else if (typeof content?.content === "string") {
          parts.push(content.content);
        }
      }
    }
  }
  return parts.join("");
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 30000
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

export async function runWriterPrompt(params: {
  section: WriterSection;
  evidence: WriterEvidenceItem[];
  promptBundle?: PromptBundle;
  fileSearch?: { vectorStoreIds: string[]; fileIds?: string[] };
  webSearch?: { enabled: boolean };
  context?: Record<string, unknown>;
}): Promise<string> {
  const { section, evidence, promptBundle, fileSearch, webSearch, context } = params;
  const contextText =
    context && Object.keys(context).length > 0
      ? JSON.stringify(context, null, 2)
      : "";
  const toolGuidance =
    fileSearch && fileSearch.vectorStoreIds.length > 0
      ? [
          "Vector evidence is available via the file_search tool.",
          `Vector stores: ${fileSearch.vectorStoreIds.join(", ")}`,
          fileSearch.fileIds && fileSearch.fileIds.length > 0
            ? `Restrict to file IDs: ${fileSearch.fileIds.join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "";
  const webGuidance = webSearch?.enabled
    ? "Web evidence is available via the web_search tool. Use it for external facts and cite URLs."
    : "";
  const prompt = [
    "You are drafting a report section for a regulated audience.",
    "Follow the instructions exactly and return only the section content.",
    "",
    `Section Title: ${section.title}`,
    section.purpose ? `Purpose: ${section.purpose}` : "",
    `Output Format: ${section.outputFormat || "NARRATIVE"}`,
    `Evidence Policy: ${section.evidencePolicy || "LLM_ONLY"}`,
    section.prompt ? `Section Prompt: ${section.prompt}` : "",
    "",
    "System Guidance:",
    promptBundle?.system || "",
    "",
    "Developer Guidance:",
    promptBundle?.developer || "",
    contextText ? "" : "",
    contextText ? "Run Context:" : "",
    contextText,
    toolGuidance || webGuidance ? "" : "",
    toolGuidance || webGuidance ? "Tool Guidance:" : "",
    toolGuidance,
    webGuidance,
    "",
    "Write Stage Guidance:",
    promptBundle?.write || "",
    "",
    "Evidence:",
    formatEvidence(evidence),
    "",
    "Instructions:",
    `- ${policyGuidance(section.evidencePolicy)}`,
    "- Use citations in the form [citation:ID] for any claim supported by evidence.",
    "- If evidence is required but unavailable, call out the evidence gap explicitly.",
    "- Do not invent sources or facts.",
  ]
    .filter(Boolean)
    .join("\n");

  const tools =
    fileSearch || webSearch?.enabled
      ? [
          ...(fileSearch && fileSearch.vectorStoreIds.length > 0
            ? [
                {
                  type: "file_search",
                  vector_store_ids: fileSearch.vectorStoreIds,
                  ...(fileSearch.fileIds && fileSearch.fileIds.length > 0
                    ? { filters: { file_ids: fileSearch.fileIds } }
                    : {}),
                },
              ]
            : []),
          ...(webSearch?.enabled ? [{ type: "web_search" }] : []),
        ]
      : undefined;

  const res = await fetchWithTimeout(
    `${OPENAI_BASE_URL}/responses`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getModel(),
        input: prompt,
        ...(tools ? { tools } : {}),
      }),
    },
    45000
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI writer request failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return extractOutputText(data);
}
