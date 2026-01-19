type RetryOptions = {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  retryableStatuses?: number[];
};

function getStatusCode(error: unknown): number {
  if (!error) return 0;
  const anyError = error as { status?: number; message?: string };
  if (typeof anyError.status === "number") return anyError.status;
  const message = anyError.message || "";
  if (/timed out/i.test(message)) return 408;
  const match = message.match(/\((\d+)\)/);
  return match ? Number(match[1]) : 0;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    retryableStatuses = [408, 429, 500, 502, 503, 504],
  } = options;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      const status = getStatusCode(err);
      if (attempt === maxRetries || !retryableStatuses.includes(status)) {
        throw err;
      }
      const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  if (lastError) throw lastError;
  throw new Error("Request failed after retries");
}
