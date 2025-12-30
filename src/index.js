const { LLMClient, isRetryableError, normalizeUsage } = require("./llmClient");
const { SlidingWindowRateLimiter } = require("./rateLimiter");
const { TelemetryHub } = require("./telemetry");
const { MockLLMProvider } = require("./mockProvider");

if (require.main === module) {
  console.log(
    "This package no longer runs a standalone HTTP server. Use Next.js (`npm run dev`)."
  );
}

module.exports = {
  LLMClient,
  SlidingWindowRateLimiter,
  TelemetryHub,
  MockLLMProvider,
  isRetryableError,
  normalizeUsage,
};
