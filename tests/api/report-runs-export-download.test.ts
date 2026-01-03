/** @jest-environment node */
import { GET } from "../../app/api/report-runs/[runId]/exports/[exportId]/route";

const mockSingle = jest.fn();

jest.mock("@/lib/supabaseAdmin", () => {
  const mockFrom = () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }),
  });

  return {
    supabaseAdmin: () => ({ from: mockFrom }),
  };
});

describe("GET /api/report-runs/:runId/exports/:exportId", () => {
  beforeEach(() => {
    mockSingle.mockReset();
  });

  it("returns 409 when export is not ready", async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: "export-1",
        status: "RUNNING",
        format: "PDF",
      },
      error: null,
    });

    const res = await GET(new Request("http://localhost"), {
      params: { runId: "run-1", exportId: "export-1" },
    });

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.status).toBe("RUNNING");
  });

  it("redirects to storage url when available", async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: "export-2",
        status: "READY",
        format: "PDF",
        storage_url: "https://storage.example.com/exports/export-2.pdf",
      },
      error: null,
    });

    const res = await GET(new Request("http://localhost"), {
      params: { runId: "run-1", exportId: "export-2" },
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://storage.example.com/exports/export-2.pdf"
    );
  });
});
