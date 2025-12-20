const test = require("node:test");
const assert = require("assert/strict");

const { LLMClient, MockLLMProvider } = require("../src");

test("retries retryable errors and succeeds on subsequent attempt", async () => {
  const provider = new MockLLMProvider();
  const retryable = new Error("temporary outage");
  retryable.retryable = true;
  provider.enqueueError(retryable);
  provider.enqueueResponse({
    output: "second attempt content",
    usage: { promptTokens: 10, completionTokens: 5 },
  });

  const client = new LLMClient({
    providers: { mock: provider },
    retry: { maxAttempts: 2, baseDelayMs: 5, backoffFactor: 1 },
  });

  const result = await client.generate({
    provider: "mock",
    model: "mock-model",
    prompt: "hello",
  });

  assert.equal(result.output, "second attempt content");
  assert.equal(provider.calls.length, 2);
  assert.equal(result.attempt, 2);
});

test("enforces rate limits before invoking provider", async () => {
  const provider = new MockLLMProvider();
  provider.enqueueResponse({ output: "first", usage: { promptTokens: 5, completionTokens: 5 } });
  provider.enqueueResponse({ output: "second", usage: { promptTokens: 5, completionTokens: 5 } });

  const starts = [];
  const client = new LLMClient({
    providers: { mock: provider },
    rateLimits: { mock: { limit: 1, intervalMs: 60 } },
    retry: { maxAttempts: 1 },
    telemetryListeners: [
      {
        onCallStart: () => starts.push(Date.now()),
      },
    ],
  });

  await Promise.all([
    client.generate({ provider: "mock", model: "m1", prompt: "one" }),
    client.generate({ provider: "mock", model: "m1", prompt: "two" }),
  ]);

  assert.equal(starts.length, 2);
  const gap = starts[1] - starts[0];
  assert.ok(gap >= 55, `expected rate limit gap, received ${gap}ms`);
});

test("records telemetry and cost using pricing rules", async () => {
  const provider = new MockLLMProvider();
  provider.enqueueResponse({
    output: "priced",
    usage: { promptTokens: 4000, completionTokens: 2000 },
  });

  let successEvent;
  const client = new LLMClient({
    providers: { mock: provider },
    pricing: {
      "mock-model": {
        promptTokenUsdPerThousand: 0.002,
        completionTokenUsdPerThousand: 0.004,
      },
    },
    telemetryListeners: [
      {
        onCallSuccess: (event) => {
          successEvent = event;
        },
      },
    ],
  });

  const result = await client.generate({
    provider: "mock",
    model: "mock-model",
    prompt: "price me",
  });

  assert.equal(result.output, "priced");
  // 4k * 0.002 + 2k * 0.004 = 0.008 + 0.008 = 0.016 -> rounds to $0.02
  assert.equal(result.costUsd, 0.02);
  assert.ok(successEvent, "telemetry success event expected");
  assert.equal(successEvent.promptTokens, 4000);
  assert.equal(successEvent.completionTokens, 2000);

  const metrics = client.getMetrics("mock");
  assert.equal(metrics.calls, 1);
  assert.equal(metrics.totalTokens, 6000);
  assert.equal(metrics.totalCostUsd, 0.02);
});

test("mock adapter captures calls and default output", async () => {
  const provider = new MockLLMProvider({ latencyMs: 1 });
  const client = new LLMClient({
    providers: { mock: provider },
  });

  const result = await client.generate({
    provider: "mock",
    model: "mock-model",
    prompt: "inspect",
  });

  assert.ok(result.output.includes("inspect"));
  assert.equal(provider.calls.length, 1);
  assert.equal(provider.calls[0].prompt, "inspect");
});
