import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const EXPORT_DIR = path.join(process.cwd(), "data", "exports");

function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

function runPython(payload: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    const pythonBin = process.env.PYTHON_BIN || "python3";
    const proc = spawn(pythonBin, ["scripts/export_adapter.py"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Export adapter failed: ${stderr.trim()}`));
        return;
      }
      resolve();
    });

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

export async function writeDocxExport(
  run: {
    id: string;
    templateSnapshot?: { name?: string; version?: number };
    finalReport?: string | null;
    inputJson?: Record<string, unknown>;
  },
  options?: { sourcesAppendix?: string[]; exportId?: string }
) {
  ensureExportDir();
  const exportId = options?.exportId || crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const templateName = run.templateSnapshot?.name || "Template";
  const templateVersion = run.templateSnapshot?.version || "n/a";

  const body = run.finalReport || "# Report\n\nNo content available.";
  const appendixLines = [
    "## Appendix",
    `- Template: ${templateName} (v${templateVersion})`,
    `- Run ID: ${run.id}`,
    `- Exported At: ${createdAt}`,
  ];
  if (options?.sourcesAppendix && options.sourcesAppendix.length > 0) {
    appendixLines.push("### Web Sources");
    appendixLines.push(...options.sourcesAppendix.map((line) => `- ${line}`));
  }
  const appendix = appendixLines.join("\n");
  const document = `${body}\n\n${appendix}\n`;

  // Generate filename using shared function
  const { generateExportFilename } = require('./exporter');
  const fileName = generateExportFilename(run, 'docx');
  const filePath = path.join(EXPORT_DIR, fileName);
  
  await runPython({ mode: "docx", content: document, output_path: filePath });

  return {
    id: exportId,
    runId: run.id,
    format: "DOCX",
    filePath,
    createdAt,
  };
}
