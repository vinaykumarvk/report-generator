const { createServer } = require('./server');

async function start() {
  const services = require('./services');
  const app = createServer(services);
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Server listening on ${port}`));
}

start();
const { LLMClient, isRetryableError, normalizeUsage } = require("./llmClient");
const { SlidingWindowRateLimiter } = require("./rateLimiter");
const { TelemetryHub } = require("./telemetry");
const { MockLLMProvider } = require("./mockProvider");

module.exports = {
  LLMClient,
  SlidingWindowRateLimiter,
  TelemetryHub,
  MockLLMProvider,
  isRetryableError,
  normalizeUsage,
};
