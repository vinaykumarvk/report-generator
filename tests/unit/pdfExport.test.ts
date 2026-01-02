/** @jest-environment node */
import fs from "fs";
import os from "os";
import path from "path";

describe("writePdfExport", () => {
  it("writes a PDF file and returns metadata", async () => {
    const originalCwd = process.cwd();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rg-pdf-"));
    process.chdir(tmpDir);

    const { writePdfExport } = await import("../../src/lib/pdfExport");

    const result = await writePdfExport({
      id: "run-pdf",
      templateSnapshot: { name: "Template", version: 1 },
      finalReport: "Hello\u2011world", // includes non-breaking hyphen
    });

    expect(result.format).toBe("PDF");
    expect(fs.existsSync(result.filePath)).toBe(true);
    const stat = fs.statSync(result.filePath);
    expect(stat.size).toBeGreaterThan(0);

    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
