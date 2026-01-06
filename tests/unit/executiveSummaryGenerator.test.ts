/** @jest-environment node */
import { generateHierarchicalExecutiveSummary } from "../../src/lib/executiveSummaryGenerator";

const originalFetch = global.fetch;

function mockResponse(payload: any) {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
}

describe("generateHierarchicalExecutiveSummary", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_WRITE_MODEL = "gpt-5.2";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_WRITE_MODEL;
  });

  it("returns final summary using Responses API output_text", async () => {
    const responses = [
      { output_text: "Mini summary 1" },
      { output_text: "Mini summary 2" },
      { output_text: "[\"Theme A\", \"Theme B\"]" },
      { output_text: "Cluster summary" },
      { output: [{ output_text: "Final executive summary" }] },
    ];

    const fetchMock = jest.fn().mockImplementation(() => {
      const payload = responses.shift();
      return Promise.resolve(mockResponse(payload));
    });

    global.fetch = fetchMock as typeof fetch;

    const summary = await generateHierarchicalExecutiveSummary([
      { id: "s1", title: "Section 1", content: "Content 1" },
      { id: "s2", title: "Section 2", content: "Content 2" },
    ]);

    expect(summary).toBe("Final executive summary");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
