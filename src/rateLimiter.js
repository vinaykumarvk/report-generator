/**
 * Simple sliding window rate limiter. Enforces a maximum number of acquisitions
 * within a fixed interval. Designed to be dependency-free for portability in
 * worker environments.
 */
class SlidingWindowRateLimiter {
  /**
   * @param {{ limit: number, intervalMs: number }} options
   */
  constructor(options) {
    const { limit, intervalMs } = options || {};
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error("SlidingWindowRateLimiter requires a positive integer limit");
    }
    if (!Number.isInteger(intervalMs) || intervalMs <= 0) {
      throw new Error("SlidingWindowRateLimiter requires a positive intervalMs");
    }
    this.limit = limit;
    this.intervalMs = intervalMs;
    this._timestamps = [];
  }

  /**
   * Acquire a slot, waiting if necessary until the window has capacity.
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {Promise<void>}
   */
  async acquire(options = {}) {
    const { signal } = options;
    if (signal?.aborted) {
      throw new Error("Rate limiter acquisition aborted");
    }

    const now = Date.now();
    this._timestamps = this._timestamps.filter((ts) => now - ts < this.intervalMs);

    if (this._timestamps.length < this.limit) {
      this._timestamps.push(now);
      return;
    }

    const earliest = this._timestamps[0];
    const waitMs = this.intervalMs - (now - earliest);
    await sleep(waitMs, signal);
    return this.acquire({ signal });
  }
}

/**
 * @param {number} ms
 * @param {AbortSignal} [signal]
 * @returns {Promise<void>}
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

module.exports = { SlidingWindowRateLimiter };
