/** @jest-environment node */
import crypto from "crypto";
import { POST } from "../../app/api/report-runs/[runId]/export/route";

const mockRunSingle = jest.fn();
const mockJobSingle = jest.fn();
const mockExportInsert = jest.fn();
const mockRunEventInsert = jest.fn();

jest.mock("@/lib/jobTrigger", () => ({
  notifyJobQueued: jest.fn(),
}));

jest.mock("@/lib/supabaseAdmin", () => {
  const mockFrom = (table: string) => {
    if (table === "report_runs") {
      return {
        select: () => ({
          eq: () => ({
            single: mockRunSingle,
          }),
        }),
      };
    }
    if (table === "exports") {
      return {
        insert: mockExportInsert,
      };
    }
    if (table === "jobs") {
      return {
        insert: () => ({
          select: () => ({
            single: mockJobSingle,
          }),
        }),
      };
    }
    if (table === "run_events") {
      return {
        insert: mockRunEventInsert,
      };
    }
    return {};
  };

  return {
    supabaseAdmin: () => ({ from: mockFrom }),
    assertNoSupabaseError: (error: unknown) => {
      if (error) {
        throw error;
      }
    },
  };
});

describe("POST /api/report-runs/:runId/export", () => {
  beforeEach(() => {
    mockRunSingle.mockReset();
    mockJobSingle.mockReset();
    mockExportInsert.mockReset();
    mockRunEventInsert.mockReset();
  });

  it("returns 400 for invalid format", async () => {
    const runId = "550e8400-e29b-41d4-a716-446655440000";
    const req = new Request(`http://localhost/api/report-runs/${runId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "INVALID" }),
    });

    const res = await POST(req, { params: { runId } });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error?.code).toBe("VALIDATION_ERROR");
    expect(data.error?.details?.some((detail: { path: string }) => detail.path === "format")).toBe(true);
  });

  it("returns jobId and exportId for valid request", async () => {
    const runId = "550e8400-e29b-41d4-a716-446655440000";
    // Mock UUID generation to return a valid UUID
    const randomSpy = jest
      .spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("a77c4a94-8e31-43ad-9c1f-5f42d2f3fd15" as `${string}-${string}-${string}-${string}-${string}`);
    mockRunSingle.mockResolvedValueOnce({
      data: { id: runId, workspace_id: "workspace-1" },
      error: null,
    });
    mockExportInsert.mockResolvedValueOnce({ error: null });
    mockJobSingle.mockResolvedValueOnce({
      data: {
        id: "job-123",
        type: "EXPORT",
        run_id: runId,
        section_run_id: null,
        workspace_id: "workspace-1",
      },
      error: null,
    });
    mockRunEventInsert.mockResolvedValueOnce({ error: null });

    const req = new Request(`http://localhost/api/report-runs/${runId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "MARKDOWN" }),
    });

    const res = await POST(req, { params: { runId } });
    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data.jobId).toBe("job-123");
    expect(data.exportId).toBe("a77c4a94-8e31-43ad-9c1f-5f42d2f3fd15");
    randomSpy.mockRestore();
  });
});
