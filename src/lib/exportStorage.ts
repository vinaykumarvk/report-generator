import crypto from "crypto";
import fs from "fs/promises";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";

const DEFAULT_EXPORTS_BUCKET = process.env.SUPABASE_EXPORTS_BUCKET || "exports";

type ExportFormat = "MARKDOWN" | "PDF" | "DOCX";

const formatExtensions: Record<ExportFormat, string> = {
  MARKDOWN: "md",
  PDF: "pdf",
  DOCX: "docx",
};

const formatContentTypes: Record<ExportFormat, string> = {
  MARKDOWN: "text/markdown",
  PDF: "application/pdf",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function buildExportObjectKey(params: {
  runId: string;
  exportId: string;
  format: ExportFormat;
}) {
  const extension = formatExtensions[params.format] || "bin";
  return `report-runs/${params.runId}/${params.exportId}.${extension}`;
}

export async function uploadExportFile(params: {
  runId: string;
  exportId: string;
  format: ExportFormat;
  filePath: string;
  bucket?: string;
}) {
  const bucket = params.bucket || DEFAULT_EXPORTS_BUCKET;
  const buffer = await fs.readFile(params.filePath);
  const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
  const fileSize = buffer.byteLength;
  const objectKey = buildExportObjectKey(params);
  const contentType = formatContentTypes[params.format] || "application/octet-stream";

  const supabase = supabaseAdmin();
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(objectKey, buffer, {
      contentType,
      upsert: true,
      cacheControl: "3600",
    });
  assertNoSupabaseError(uploadError, "Failed to upload export to Supabase Storage");

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectKey);

  return {
    storageUrl: data.publicUrl,
    fileSize,
    checksum,
    objectKey,
    bucket,
  };
}
