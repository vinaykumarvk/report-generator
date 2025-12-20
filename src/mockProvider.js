const { normalizeUsage } = require("./llmClient");

/**
 * Deterministic mock adapter for tests and offline orchestration. Allows
 * sequencing responses and errors to validate retry/backoff behavior.
 */
class MockLLMProvider {
  constructor(options = {}) {
    this.name = options.name || "mock";
    this.latencyMs = options.latencyMs || 0;
    this.queue = [];
    this.calls = [];
  }

  /**
   * Schedule a successful response.
   * @param {Partial<MockResponse>} response
   */
  enqueueResponse(response) {
    this.queue.push({ type: "result", response });
  }

  /**
   * Schedule an error to be thrown on invoke.
   * @param {Error} error
   */
  enqueueError(error) {
    this.queue.push({ type: "error", error });
  }

  /**
   * @param {import("./llmClient").LLMRequest} request
   * @returns {Promise<import("./llmClient").LLMProviderResponse>}
   */
  async invoke(request) {
    this.calls.push(request);
    const next = this.queue.length > 0 ? this.queue.shift() : null;
    if (this.latencyMs) {
      await sleep(this.latencyMs);
    }

    if (next?.type === "error") {
      throw next.error;
    }

    const payload = next?.response || {};
    const usage = normalizeUsage(payload.usage || {});
    return {
      output: payload.output || `mocked: ${request.prompt}`,
      usage,
      raw: payload.raw,
    };
  }

  /**
   * Retry if the error is flagged as retryable.
   * @param {unknown} error
   */
  isRetryableError(error) {
    return !!error?.retryable;
  }
}

function sleep(ms) {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @typedef {Object} MockResponse
 * @property {string} [output]
 * @property {import("./llmClient").LLMUsage} [usage]
 * @property {unknown} [raw]
 */

module.exports = { MockLLMProvider };
