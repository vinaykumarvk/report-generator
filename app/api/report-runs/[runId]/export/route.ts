import { NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";
import { notifyJobQueued } from "@/lib/jobTrigger";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { runId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: run, error } = (await supabase
    .from("report_runs")
    .select("*")
    .eq("id", params.runId)
    .single()) as { data: any; error: any };
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
  const { data: job, error: jobError } = (await (supabase
    .from("jobs") as any)
    .insert({
      workspace_id: workspaceId,
      type: "EXPORT",
      status: "QUEUED",
      payload_json: { format },
      run_id: params.runId,
    })
    .select("id,type,run_id,section_run_id,workspace_id")
    .single()) as { data: any; error: any };
  assertNoSupabaseError(jobError, "Failed to enqueue export job");
  await notifyJobQueued({
    id: String(job.id),
    type: String(job.type),
    runId: job.run_id ? String(job.run_id) : null,
    sectionRunId: job.section_run_id ? String(job.section_run_id) : null,
    workspaceId: job.workspace_id ? String(job.workspace_id) : null,
  });

  const { error: eventError } = await (supabase.from("run_events") as any).insert({
    run_id: params.runId,
    workspace_id: workspaceId,
    type: "EXPORT_REQUESTED",
    payload_json: { jobId: job.id, format },
  });
  assertNoSupabaseError(eventError, "Failed to write run event");

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
