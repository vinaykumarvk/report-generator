export async function fetchWithTimeout(
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
    return response;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJson<T>(
  url: string,
  options: RequestInit,
  timeoutMs = 30000
): Promise<T> {
  const response = await fetchWithTimeout(url, options, timeoutMs);
  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`Request failed (${response.status}): ${errorText}`);
    (error as { status?: number }).status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}
