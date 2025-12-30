import { NextResponse } from "next/server";
import fs from "fs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { runId: string; exportId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: exportRecord, error } = await supabase
    .from("exports")
    .select("*")
    .eq("id", params.exportId)
    .eq("report_run_id", params.runId)
    .single();
  if (error || !exportRecord) {
    return NextResponse.json({ error: "Export not found" }, { status: 404 });
  }
  if (!fs.existsSync(exportRecord.file_path)) {
    return NextResponse.json({ error: "Export file missing" }, { status: 404 });
  }
  const fileBuffer = fs.readFileSync(exportRecord.file_path);
  const contentType =
    exportRecord.format === "PDF"
      ? "application/pdf"
      : exportRecord.format === "DOCX"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "text/markdown";
  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename=\"${exportRecord.id}.${exportRecord.format.toLowerCase()}\"`,
    },
  });
}
