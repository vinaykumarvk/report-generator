/** @jest-environment node */
import { POST } from "../../app/api/report-runs/route";

describe("POST /api/report-runs", () => {
  it("returns 400 when templateId is missing", async () => {
    const req = new Request("http://localhost/api/report-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("templateId is required");
  });
});
