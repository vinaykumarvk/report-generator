import crypto from "crypto";
import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const EXPORT_DIR = path.join(process.cwd(), "data", "exports");

function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

function markdownToText(markdown: string): string {
  let text = markdown;
  text = text.replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ""));
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/^>\s?/gm, "");
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  text = text.replace(/`([^`]+)`/g, "$1");
  return text.trim();
}

function normalizePdfText(text: string): string {
  return text
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
}

function wrapText(
  text: string,
  font: ReturnType<typeof PDFDocument.prototype.embedFont>,
  fontSize: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  const pushLine = () => {
    if (current.trim()) lines.push(current.trim());
    current = "";
  };

  words.forEach((word) => {
    const test = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width <= maxWidth) {
      current = test;
      return;
    }
    if (current) pushLine();
    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      current = word;
      return;
    }
    let buffer = "";
    for (const ch of word) {
      const next = buffer + ch;
      if (font.widthOfTextAtSize(next, fontSize) > maxWidth) {
        lines.push(buffer);
        buffer = ch;
      } else {
        buffer = next;
      }
    }
    if (buffer) lines.push(buffer);
  });
  pushLine();

  return lines;
}

async function renderPdfFromMarkdown(markdown: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  const lineHeight = 14;
  const margin = 48;

  const text = normalizePdfText(markdownToText(markdown));
  const paragraphs = text.split(/\n{2,}/);
  let page = pdfDoc.addPage();
  let { width, height } = page.getSize();
  let y = height - margin;

  const drawLine = (line: string) => {
    if (y < margin + lineHeight) {
      page = pdfDoc.addPage();
      ({ width, height } = page.getSize());
      y = height - margin;
    }
    page.drawText(line, {
      x: margin,
      y,
      size: fontSize,
      font,
      color: rgb(0.1, 0.12, 0.18),
    });
    y -= lineHeight;
  };

  paragraphs.forEach((paragraph, index) => {
    const trimmed = paragraph.trim();
    if (!trimmed) return;
    const lines = wrapText(trimmed, font, fontSize, width - margin * 2);
    lines.forEach(drawLine);
    if (index < paragraphs.length - 1) {
      y -= lineHeight;
    }
  });

  return pdfDoc.save();
}

export async function writePdfExport(
  run: {
    id: string;
    templateSnapshot?: { name?: string; version?: number };
    finalReport?: string | null;
  },
  options?: { sourcesAppendix?: string[] }
) {
  ensureExportDir();
  const exportId = crypto.randomUUID();
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

  const filePath = path.join(EXPORT_DIR, `run-${run.id}-${exportId}.pdf`);
  const pdfBytes = await renderPdfFromMarkdown(document);
  fs.writeFileSync(filePath, pdfBytes);

  return {
    id: exportId,
    runId: run.id,
    format: "PDF",
    filePath,
    createdAt,
  };
}
