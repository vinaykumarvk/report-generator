import { NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";

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
  const { data: updated, error: updateError } = (await (supabase
    .from("report_runs") as any)
    .update({
      status: "RUNNING",
      started_at: new Date().toISOString(),
    })
    .eq("id", params.runId)
    .select("*")
    .single()) as { data: any; error: any };
  assertNoSupabaseError(updateError, "Failed to update report run");

  const { data: job, error: jobError } = (await (supabase
    .from("jobs") as any)
    .insert({
      workspace_id: workspaceId,
      type: "START_RUN",
      status: "QUEUED",
      payload_json: { runId: run.id },
      run_id: run.id,
    })
    .select("id")
    .single()) as { data: any; error: any };
  assertNoSupabaseError(jobError, "Failed to create job");

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

  return NextResponse.json({ runId: updated.id, jobId: job.id });
}
