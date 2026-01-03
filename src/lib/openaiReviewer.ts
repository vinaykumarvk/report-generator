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

Can you check if the three queued sections are still working or are they stuck?async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 30000): Promise<Response> {
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
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

export async function runReviewerPrompt(prompt: string): Promise<string> {
  const res = await fetchWithTimeout(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getModel(),
      input: prompt,
    }),
  }, 300000); // 5 minutes

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI reviewer request failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const output = data.output_text || "";
  return output;
}
