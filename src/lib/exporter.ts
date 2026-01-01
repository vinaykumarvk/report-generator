import crypto from "crypto";
import fs from "fs";
import path from "path";

const EXPORT_DIR = path.join(process.cwd(), "data", "exports");

function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

function extractMarkdownFromFinalReport(finalReport: any): string {
  if (!finalReport) return "# Report\n\nNo content available.";
  
  // If it's already a string, return it
  if (typeof finalReport === "string") return finalReport;
  
  // If it's an object, try to extract markdown
  if (typeof finalReport === "object") {
    // Check common markdown field names
    if (finalReport.markdown) return String(finalReport.markdown);
    if (finalReport.content) return String(finalReport.content);
    if (finalReport.text) return String(finalReport.text);
    if (finalReport.finalMarkdown) return String(finalReport.finalMarkdown);
    
    // If none of the above, stringify it
    return JSON.stringify(finalReport, null, 2);
  }
  
  return "# Report\n\nNo content available.";
}

export function buildMarkdownDocument(
  run: {
    id: string;
    templateSnapshot?: { name?: string; version?: number };
    finalReport?: string | null;
  },
  createdAt: string,
  options?: { sourcesAppendix?: string[] }
): string {
  const templateName = run.templateSnapshot?.name || "Template";
  const templateVersion = run.templateSnapshot?.version || "n/a";

  const body = extractMarkdownFromFinalReport(run.finalReport);
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

  return `${body}\n\n${appendix}\n`;
}

export function writeMarkdownExport(run: {
  id: string;
  templateSnapshot?: { name?: string; version?: number };
  finalReport?: string | null;
}, options?: { sourcesAppendix?: string[] }) {
  ensureExportDir();
  const exportId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const document = buildMarkdownDocument(run, createdAt, options);
  const filePath = path.join(EXPORT_DIR, `run-${run.id}-${exportId}.md`);
  fs.writeFileSync(filePath, document, "utf8");

  return {
    id: exportId,
    runId: run.id,
    format: "MARKDOWN",
    filePath,
    createdAt,
  };
}
