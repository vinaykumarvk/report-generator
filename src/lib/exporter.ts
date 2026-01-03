import crypto from "crypto";
import fs from "fs";
import path from "path";

const EXPORT_DIR = path.join(process.cwd(), "data", "exports");

function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

/**
 * Generate export filename in format: {topic}_{template-abbrev}_{short-id}_{date}.{ext}
 * Example: CRR-PRR-Validation_BRD_03c98021_2026-01-03.md
 */
export function generateExportFilename(
  run: {
    id: string;
    templateSnapshot?: { name?: string; version?: number };
    inputJson?: Record<string, unknown>;
  },
  extension: string
): string {
  const topic = (run.inputJson?.topic as string) || 'Report';
  const templateName = run.templateSnapshot?.name || 'Template';
  const shortId = run.id.substring(0, 8);
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Sanitize topic and template for filename (remove special chars, replace spaces with hyphens)
  const sanitizeName = (str: string) => 
    str.replace(/[^a-zA-Z0-9\s-]/g, '')
       .replace(/\s+/g, '-')
       .substring(0, 50); // Limit length
  
  const sanitizedTopic = sanitizeName(topic);
  const sanitizedTemplate = sanitizeName(templateName);
  
  return `${sanitizedTopic}_${sanitizedTemplate}_${shortId}_${date}.${extension}`;
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
  inputJson?: Record<string, unknown>;
}, options?: { sourcesAppendix?: string[]; exportId?: string }) {
  ensureExportDir();
  const exportId = options?.exportId || crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const document = buildMarkdownDocument(run, createdAt, {
    sourcesAppendix: options?.sourcesAppendix,
  });
  
  const fileName = generateExportFilename(run, 'md');
  const filePath = path.join(EXPORT_DIR, fileName);
  
  fs.writeFileSync(filePath, document, "utf8");

  return {
    id: exportId,
    runId: run.id,
    format: "MARKDOWN",
    filePath,
    createdAt,
  };
}
