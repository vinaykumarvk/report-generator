import { NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";
import { notifyJobQueued } from "@/lib/jobTrigger";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
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

  if (!run.template_version_snapshot_json) {
    return NextResponse.json(
      { error: "Template snapshot missing" },
      { status: 400 }
    );
  }

  const workspaceId = run.workspace_id || (await getDefaultWorkspaceId());
  const { data: existingJob } = await supabase
    .from("jobs")
    .select("id,type,run_id,section_run_id,workspace_id")
    .eq("run_id", params.runId)
    .eq("type", "START_RUN")
    .in("status", ["QUEUED", "RUNNING"])
    .limit(1)
    .maybeSingle();
  if (existingJob) {
    return NextResponse.json({ runId: run.id, jobId: existingJob.id }, { status: 202 });
  }

  const { data: job, error: jobError } = (await (supabase
    .from("jobs") as any)
    .insert({
      workspace_id: workspaceId,
      type: "START_RUN",
      status: "QUEUED",
      payload_json: { runId: run.id },
      run_id: run.id,
    })
    .select("id,type,run_id,section_run_id,workspace_id")
    .single()) as { data: any; error: any };
  assertNoSupabaseError(jobError, "Failed to create job");
  await notifyJobQueued({
    id: String(job.id),
    type: String(job.type),
    runId: job.run_id ? String(job.run_id) : null,
    sectionRunId: job.section_run_id ? String(job.section_run_id) : null,
    workspaceId: job.workspace_id ? String(job.workspace_id) : null,
  });

  try {
    const { error: updateError } = await (supabase.from("report_runs") as any)
      .update({
        status: "RUNNING",
        started_at: new Date().toISOString(),
      })
      .eq("id", params.runId);
    assertNoSupabaseError(updateError, "Failed to update report run");

    const { error: eventError } = await (supabase.from("run_events") as any).insert({
      run_id: run.id,
      workspace_id: workspaceId,
      type: "RUN_STARTED",
      payload_json: {},
    });
    assertNoSupabaseError(eventError, "Failed to write run event");
    const { error: auditError } = await (supabase.from("audit_logs") as any).insert({
      workspace_id: workspaceId,
      action_type: "RUN_STARTED",
      target_type: "ReportRun",
      target_id: run.id,
      details_json: {},
    });
    assertNoSupabaseError(auditError, "Failed to write audit log");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[StartRun] Non-fatal update failed for run ${run.id}: ${message}`);
  }

  return NextResponse.json({ runId: run.id, jobId: job.id }, { status: 202 });
}
