import { NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { runId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: run, error } = await supabase
    .from("report_runs")
    .select("*")
    .eq("id", params.runId)
    .single();
  if (error || !run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const body = await request.json();
  const format = body?.format || "MARKDOWN";
  if (!["MARKDOWN", "DOCX", "PDF"].includes(format)) {
    return NextResponse.json(
      { error: "format must be MARKDOWN, DOCX, or PDF." },
      { status: 400 }
    );
  }

  const workspaceId = run.workspace_id || (await getDefaultWorkspaceId());
  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .insert({
      workspace_id: workspaceId,
      type: "EXPORT",
      status: "QUEUED",
      payload_json: { format },
      run_id: params.runId,
    })
    .select("id")
    .single();
  assertNoSupabaseError(jobError, "Failed to enqueue export job");

  const { error: eventError } = await supabase.from("run_events").insert({
    run_id: params.runId,
    workspace_id: workspaceId,
    type: "EXPORT_REQUESTED",
    payload_json: { jobId: job.id, format },
  });
  assertNoSupabaseError(eventError, "Failed to write run event");

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
