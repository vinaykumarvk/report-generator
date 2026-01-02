import crypto from "crypto";
import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";

const EXPORT_DIR = path.join(process.cwd(), "data", "exports");

function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
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

interface MarkdownBlock {
  type: "heading" | "paragraph" | "list" | "table" | "code";
  level?: number;
  content: string;
  items?: string[];
  rows?: string[][];
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        content: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // Lists
    if (line.match(/^\s*[-*+]\s+/) || line.match(/^\s*\d+\.\s+/)) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].match(/^\s*[-*+]\s+/) || lines[i].match(/^\s*\d+\.\s+/))) {
        const itemMatch = lines[i].match(/^\s*(?:[-*+]|\d+\.)\s+(.+)$/);
        if (itemMatch) {
          items.push(itemMatch[1].trim());
        }
        i++;
      }
      blocks.push({ type: "list", content: "", items });
      continue;
    }

    // Tables
    if (line.includes("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        const row = lines[i]
          .split("|")
          .map((cell) => cell.trim())
          .filter((cell) => cell);
        if (row.length > 0 && !lines[i].match(/^[\s|:-]+$/)) {
          rows.push(row);
        }
        i++;
      }
      if (rows.length > 0) {
        blocks.push({ type: "table", content: "", rows });
      }
      continue;
    }

    // Code blocks
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++; // Skip opening ```
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      blocks.push({ type: "code", content: codeLines.join("\n") });
      continue;
    }

    // Regular paragraph
    const paragraphLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].match(/^#{1,6}\s+/) &&
      !lines[i].match(/^\s*[-*+]\s+/) &&
      !lines[i].match(/^\s*\d+\.\s+/) &&
      !lines[i].includes("|") &&
      !lines[i].startsWith("```")
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", content: paragraphLines.join(" ").trim() });
  }

  return blocks;
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const test = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);

  return lines;
}

async function renderPdfFromMarkdown(markdown: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const margin = 50;
  const lineHeight = 16;
  const normalFontSize = 11;
  const headingFontSizes = [24, 20, 16, 14, 12, 11];

  let page = pdfDoc.addPage();
  let { width, height } = page.getSize();
  let y = height - margin;

  const addNewPage = () => {
    page = pdfDoc.addPage();
    ({ width, height } = page.getSize());
    y = height - margin;
  };

  const checkSpace = (needed: number) => {
    if (y - needed < margin) {
      addNewPage();
    }
  };

  const drawText = (text: string, fontSize: number, font: PDFFont, color = rgb(0.1, 0.12, 0.18)) => {
    checkSpace(lineHeight);
    page.drawText(text, {
      x: margin,
      y,
      size: fontSize,
      font,
      color,
    });
    y -= lineHeight;
  };

  const blocks = parseMarkdown(normalizePdfText(markdown));

  for (const block of blocks) {
    if (block.type === "heading") {
      const fontSize = headingFontSizes[block.level! - 1] || normalFontSize;
      checkSpace(fontSize + 10);
      y -= 10; // Extra space before heading
      const lines = wrapText(block.content, boldFont, fontSize, width - margin * 2);
      for (const line of lines) {
        drawText(line, fontSize, boldFont);
      }
      y -= 5; // Extra space after heading
    } else if (block.type === "paragraph") {
      const lines = wrapText(block.content, font, normalFontSize, width - margin * 2);
      for (const line of lines) {
        drawText(line, normalFontSize, font);
      }
      y -= 5; // Space after paragraph
    } else if (block.type === "list" && block.items) {
      for (const item of block.items) {
        checkSpace(lineHeight);
        const bulletText = `• ${item}`;
        const lines = wrapText(bulletText, font, normalFontSize, width - margin * 2 - 20);
        for (let i = 0; i < lines.length; i++) {
          drawText(i === 0 ? lines[i] : `  ${lines[i]}`, normalFontSize, font);
        }
      }
      y -= 5;
    } else if (block.type === "table" && block.rows) {
      const colWidths = block.rows[0]?.map(() => (width - margin * 2) / (block.rows?.[0]?.length || 1)) || [];
      
      for (let rowIndex = 0; rowIndex < block.rows.length; rowIndex++) {
        const row = block.rows[rowIndex];
        const isHeader = rowIndex === 0;
        const rowFont = isHeader ? boldFont : font;
        
        checkSpace(lineHeight + 10);
        
        let x = margin;
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          const cell = row[colIndex];
          const cellWidth = colWidths[colIndex] - 10;
          const lines = wrapText(cell, rowFont, normalFontSize, cellWidth);
          
          page.drawText(lines[0] || "", {
            x,
            y,
            size: normalFontSize,
            font: rowFont,
            color: rgb(0.1, 0.12, 0.18),
          });
          
          x += colWidths[colIndex];
        }
        
        // Draw line under header
        if (isHeader) {
          page.drawLine({
            start: { x: margin, y: y - 5 },
            end: { x: width - margin, y: y - 5 },
            thickness: 1,
            color: rgb(0.7, 0.7, 0.7),
          });
        }
        
        y -= lineHeight + 5;
      }
      y -= 10;
    } else if (block.type === "code") {
      checkSpace(lineHeight * 2);
      const codeLines = block.content.split("\n");
      for (const line of codeLines) {
        drawText(line || " ", 9, font, rgb(0.2, 0.2, 0.2));
      }
      y -= 5;
    }
  }

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
    "\n\n---\n\n## Appendix",
    `**Template:** ${templateName} (v${templateVersion})`,
    `**Run ID:** ${run.id}`,
    `**Exported At:** ${createdAt}`,
  ];
  if (options?.sourcesAppendix && options.sourcesAppendix.length > 0) {
    appendixLines.push("\n### Web Sources");
    appendixLines.push(...options.sourcesAppendix.map((line) => `- ${line}`));
  }
  const appendix = appendixLines.join("\n");
  const document = `${body}${appendix}\n`;

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
