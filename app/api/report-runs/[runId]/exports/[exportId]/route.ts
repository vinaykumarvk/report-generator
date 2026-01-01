import { NextResponse } from "next/server";
import fs from "fs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildMarkdownDocument } from "@/lib/exporter";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { runId: string; exportId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: exportRecord, error } = (await supabase
    .from("exports")
    .select("*")
    .eq("id", params.exportId)
    .eq("report_run_id", params.runId)
    .single()) as { data: any; error: any };
  if (error || !exportRecord) {
    return NextResponse.json({ error: "Export not found" }, { status: 404 });
  }
  const contentType =
    exportRecord.format === "PDF"
      ? "application/pdf"
      : exportRecord.format === "DOCX"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "text/markdown";
  if (!fs.existsSync(exportRecord.file_path)) {
    if (exportRecord.format !== "MARKDOWN") {
      return NextResponse.json({ error: "Export file missing" }, { status: 404 });
    }
    const { data: run, error: runError } = (await supabase
      .from("report_runs")
      .select("id, template_version_snapshot_json, final_report_json")
      .eq("id", params.runId)
      .single()) as { data: any; error: any };
    if (runError || !run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    const createdAt = exportRecord.created_at || new Date().toISOString();
    const document = buildMarkdownDocument(
      {
        id: String(run.id),
        templateSnapshot: run.template_version_snapshot_json || undefined,
        finalReport: run.final_report_json ?? null,
      },
      String(createdAt)
    );
    return new NextResponse(document, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename=\"${exportRecord.id}.markdown\"`,
      },
    });
  }

  const fileBuffer = fs.readFileSync(exportRecord.file_path);
  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename=\"${exportRecord.id}.${exportRecord.format.toLowerCase()}\"`,
    },
  });
}
