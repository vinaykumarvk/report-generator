const OPENAI_BASE_URL = "https://api.openai.com/v1";

type VerificationResult = {
  pass: boolean;
  issues: string[];
};

function getApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return key;
}

function getModel() {
  return process.env.OPENAI_VERIFY_MODEL || "gpt-4o-mini";
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
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

export async function runVerificationPrompt(params: {
  sectionTitle: string;
  evidencePolicy?: string;
  evidence: Array<{ id: string; kind?: string; content: string }>;
  draft: string;
}): Promise<VerificationResult> {
  const evidenceSummary = params.evidence.length
    ? params.evidence
        .map((item) => `- [${item.id}] ${item.kind || "unknown"}: ${item.content}`)
        .join("\n")
    : "None.";

  const prompt = [
    "You are a compliance reviewer. Evaluate the draft for evidence policy adherence and missing citations.",
    "Return only valid JSON with keys: pass (boolean), issues (string array).",
    "",
    `Section: ${params.sectionTitle}`,
    `Evidence Policy: ${params.evidencePolicy || "LLM_ONLY"}`,
    "",
    "Evidence:",
    evidenceSummary,
    "",
    "Draft:",
    params.draft,
  ].join("\n");

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
      }),
    },
    30000
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI verifier request failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const output = extractOutputText(data);
  const parsed = extractJson(output);
  if (!parsed) {
    return { pass: true, issues: [] };
  }
  return {
    pass: Boolean(parsed.pass),
    issues: Array.isArray(parsed.issues) ? parsed.issues : [],
  };
}
