/** @jest-environment node */
import { POST } from "../../app/api/report-runs/[runId]/export/route";

jest.mock("@/lib/supabaseAdmin", () => {
  const mockSelect = () => ({
    eq: () => ({
      single: async () => ({ data: { id: "run-1", workspace_id: null }, error: null }),
    }),
  });

  const mockFrom = () => ({
    select: mockSelect,
  });

  return {
    supabaseAdmin: () => ({ from: mockFrom }),
  };
});

describe("POST /api/report-runs/:runId/export", () => {
  it("returns 400 for invalid format", async () => {
    const req = new Request("http://localhost/api/report-runs/run-1/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "INVALID" }),
    });

    const res = await POST(req, { params: { runId: "run-1" } });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("format must be");
  });
});
