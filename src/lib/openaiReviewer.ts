import { withRetry } from "@/lib/apiRetry";
import { fetchJson } from "@/lib/httpClient";

const OPENAI_BASE_URL = "https://api.openai.com/v1";

function getApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return key;
}

function getModel() {
  return process.env.OPENAI_REVIEW_MODEL || "gpt-4o-mini";
}

export async function runReviewerPrompt(prompt: string): Promise<string> {
  const data = await withRetry(
    () =>
      fetchJson<{ output_text?: string }>(
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
        300000
      ),
    { maxRetries: 2 }
  );

  return data.output_text || "";
}
