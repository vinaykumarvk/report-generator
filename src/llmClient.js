const { SlidingWindowRateLimiter } = require("./rateLimiter");
const { TelemetryHub } = require("./telemetry");

/**
 * Provider-agnostic LLM client with retries, rate limiting, cost tracking, and
 * telemetry hooks.
 */
class LLMClient {
  /**
   * @param {LLMClientOptions} options
   */
  constructor(options) {
    if (!options || !options.providers) {
      throw new Error("LLMClient requires at least one provider");
    }

    this.providers = options.providers;
    this.retry = Object.assign(
      { maxAttempts: 3, baseDelayMs: 200, backoffFactor: 2 },
      options.retry || {}
    );
    this.pricing = options.pricing || {};
    this.telemetry = new TelemetryHub(options.telemetryListeners || []);
    this.rateLimiters = new Map();
    this.metrics = new Map();

    if (options.rateLimits) {
      Object.entries(options.rateLimits).forEach(([providerName, cfg]) => {
        this.rateLimiters.set(providerName, new SlidingWindowRateLimiter(cfg));
      });
    }
  }

  /**
   * Execute a model call through the selected provider.
   * @param {LLMRequest} request
   * @returns {Promise<LLMResult>}
   */
  async generate(request) {
    const provider = this.providers[request.provider];
    if (!provider) {
      throw new Error(`Provider ${request.provider} is not registered`);
    }

    const limiter = this.rateLimiters.get(request.provider);
    if (limiter) {
      await limiter.acquire({ signal: request.signal });
    }

    return this.#executeWithRetries(provider, request);
  }

  /**
   * @param {string} providerName
   * @returns {LLMMetricsSnapshot}
   */
  getMetrics(providerName) {
    if (providerName) {
      return this.metrics.get(providerName) || {
        calls: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        totalDurationMs: 0,
      };
    }
    const snapshot = {};
    this.metrics.forEach((value, key) => {
      snapshot[key] = { ...value };
    });
    return snapshot;
  }

  /**
   * @param {LLMProvider} provider
   * @param {LLMRequest} request
   * @returns {Promise<LLMResult>}
   */
  async #executeWithRetries(provider, request) {
    const callId = createId();
    let attempt = 0;
    const maxAttempts = Math.max(1, this.retry.maxAttempts || 1);

    while (attempt < maxAttempts) {
      attempt += 1;
      const start = Date.now();
      this.telemetry.emitStart({
        provider: request.provider,
        model: request.model,
        callId,
        attempt,
        metadata: request.metadata,
      });

      try {
        const response = await provider.invoke(request);
        const durationMs = Date.now() - start;
        const usage = normalizeUsage(response.usage);
        const costUsd = this.#computeCost(request.model, usage);

        this.#recordMetrics(request.provider, usage, durationMs, costUsd);

        this.telemetry.emitSuccess({
          provider: request.provider,
          model: request.model,
          callId,
          attempt,
          durationMs,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          costUsd,
          metadata: request.metadata,
        });

        return {
          output: response.output,
          usage,
          costUsd,
          durationMs,
          provider: request.provider,
          model: request.model,
          attempt,
          raw: response.raw,
        };
      } catch (error) {
        this.telemetry.emitError({
          provider: request.provider,
          model: request.model,
          callId,
          attempt,
          error,
          metadata: request.metadata,
        });

        const shouldRetry =
          attempt < maxAttempts &&
          (typeof provider.isRetryableError === "function"
            ? provider.isRetryableError(error)
            : isRetryableError(error));

        if (!shouldRetry) {
          throw error;
        }

        const delayMs = computeBackoff(this.retry.baseDelayMs, this.retry.backoffFactor, attempt);
        await sleep(delayMs, request.signal);
      }
    }

    throw new Error("Exhausted retries");
  }

  /**
   * @param {string} model
   * @param {LLMUsage} usage
   * @returns {number}
   */
  #computeCost(model, usage) {
    const pricingRule = this.pricing[model];
    if (!pricingRule) {
      return usage.costUsd || 0;
    }

    const promptCost = ((usage.promptTokens || 0) / 1000) * (pricingRule.promptTokenUsdPerThousand || 0);
    const completionCost =
      ((usage.completionTokens || 0) / 1000) * (pricingRule.completionTokenUsdPerThousand || 0);
    return roundToCents(promptCost + completionCost + (pricingRule.baseFeeUsd || 0));
  }

  /**
   * @param {string} providerName
   * @param {LLMUsage} usage
   * @param {number} durationMs
   * @param {number} costUsd
   */
  #recordMetrics(providerName, usage, durationMs, costUsd) {
    const current = this.metrics.get(providerName) || {
      calls: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      totalDurationMs: 0,
    };

    const updated = {
      calls: current.calls + 1,
      totalTokens: current.totalTokens + (usage.totalTokens || 0),
      totalCostUsd: Number((current.totalCostUsd + costUsd).toFixed(6)),
      totalDurationMs: current.totalDurationMs + durationMs,
    };

    this.metrics.set(providerName, updated);
  }
}

/**
 * @param {LLMUsage} usage
 * @returns {LLMUsage}
 */
function normalizeUsage(usage = {}) {
  const promptTokens = usage.promptTokens || 0;
  const completionTokens = usage.completionTokens || 0;
  const totalTokens = usage.totalTokens || promptTokens + completionTokens;
  return {
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd: usage.costUsd || 0,
  };
}

/**
 * Basic retryable error detection that respects a `retryable` flag and common HTTP codes.
 * @param {unknown} error
 * @returns {boolean}
 */
function isRetryableError(error) {
  if (!error) return false;
  if (error.retryable === true) return true;
  const status = error.status || error.statusCode;
  if (typeof status === "number" && (status === 429 || status >= 500)) {
    return true;
  }
  return false;
}

/**
 * @param {number} baseDelayMs
 * @param {number} backoffFactor
 * @param {number} attempt
 * @returns {number}
 */
function computeBackoff(baseDelayMs, backoffFactor, attempt) {
  const jitter = Math.random() * 50;
  return baseDelayMs * Math.pow(backoffFactor, attempt - 1) + jitter;
}

/**
 * @param {number} ms
 * @param {AbortSignal} [signal]
 */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Sleep aborted"));
    };

    if (signal) {
      signal.addEventListener("abort", onAbort);
    }
  });
}

function createId() {
  return `call_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function roundToCents(value) {
  return Math.round(value * 100) / 100;
}

/**
 * @typedef {Object} LLMProvider
 * @property {string} name
 * @property {(request: LLMRequest) => Promise<LLMProviderResponse>} invoke
 * @property {(error: unknown) => boolean} [isRetryableError]
 */

/**
 * @typedef {Object} LLMRequest
 * @property {string} provider
 * @property {string} model
 * @property {string} prompt
 * @property {number} [maxTokens]
 * @property {AbortSignal} [signal]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {Object} LLMProviderResponse
 * @property {string} output
 * @property {LLMUsage} usage
 * @property {unknown} [raw]
 */

/**
 * @typedef {Object} LLMUsage
 * @property {number} [promptTokens]
 * @property {number} [completionTokens]
 * @property {number} [totalTokens]
 * @property {number} [costUsd]
 */

/**
 * @typedef {Object} LLMResult
 * @property {string} output
 * @property {LLMUsage} usage
 * @property {number} costUsd
 * @property {number} durationMs
 * @property {string} provider
 * @property {string} model
 * @property {number} attempt
 * @property {unknown} [raw]
 */

/**
 * @typedef {Object} LLMMetricsSnapshot
 * @property {number} calls
 * @property {number} totalTokens
 * @property {number} totalCostUsd
 * @property {number} totalDurationMs
 */

/**
 * @typedef {Object} PricingRule
 * @property {number} [promptTokenUsdPerThousand]
 * @property {number} [completionTokenUsdPerThousand]
 * @property {number} [baseFeeUsd]
 */

/**
 * @typedef {Object} LLMClientOptions
 * @property {Record<string, LLMProvider>} providers
 * @property {{ maxAttempts?: number, baseDelayMs?: number, backoffFactor?: number }} [retry]
 * @property {Record<string, { limit: number, intervalMs: number }>} [rateLimits]
 * @property {Record<string, PricingRule>} [pricing]
 * @property {Array<Partial<import("./telemetry").LLMTelemetryListener>>} [telemetryListeners]
 */

module.exports = { LLMClient, isRetryableError, normalizeUsage };
