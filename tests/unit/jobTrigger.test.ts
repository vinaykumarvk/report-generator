/** @jest-environment node */
import { notifyJobQueued } from "../../src/lib/jobTrigger";

describe("notifyJobQueued", () => {
  const job = { id: "job-1", type: "EXPORT", runId: "run-1" };

  afterEach(() => {
    delete process.env.JOB_TRIGGER_MODE;
    delete process.env.WORKER_TRIGGER_URL;
    delete process.env.WORKER_TRIGGER_SECRET;
    if (global.fetch && "mockRestore" in global.fetch) {
      (global.fetch as jest.Mock).mockRestore();
    }
  });

  it("returns ok for db mode", async () => {
    process.env.JOB_TRIGGER_MODE = "db";
    const result = await notifyJobQueued(job);
    expect(result.ok).toBe(true);
  });

  it("returns missing url for http mode when URL not set", async () => {
    process.env.JOB_TRIGGER_MODE = "http";
    const result = await notifyJobQueued(job);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("missing_url");
  });

  it("calls fetch for http mode", async () => {
    process.env.JOB_TRIGGER_MODE = "http";
    process.env.WORKER_TRIGGER_URL = "https://example.com/process-job";
    process.env.WORKER_TRIGGER_SECRET = "secret";

    global.fetch = jest.fn(async () => ({ ok: true, status: 200 })) as any;

    const result = await notifyJobQueued(job);
    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalled();
  });
});
