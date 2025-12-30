import { NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: { sectionRunId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: sectionRun, error } = await supabase
    .from("section_runs")
    .select("*")
    .eq("id", params.sectionRunId)
    .single();
  if (error || !sectionRun) {
    return NextResponse.json(
      { error: "Section run not found" },
      { status: 404 }
    );
  }

  const { data: run } = await supabase
    .from("report_runs")
    .select("workspace_id")
    .eq("id", sectionRun.report_run_id)
    .single();
  const workspaceId = run?.workspace_id || (await getDefaultWorkspaceId());

  const { error: artifactError } = await supabase
    .from("section_artifacts")
    .delete()
    .eq("section_run_id", params.sectionRunId);
  assertNoSupabaseError(artifactError, "Failed to clear section artifacts");
  const { error: evidenceError } = await supabase
    .from("evidence_bundles")
    .delete()
    .eq("section_run_id", params.sectionRunId);
  assertNoSupabaseError(evidenceError, "Failed to clear evidence bundle");
  const { error: scoreError } = await supabase
    .from("section_scores")
    .delete()
    .eq("section_run_id", params.sectionRunId);
  assertNoSupabaseError(scoreError, "Failed to clear section scores");
  const { error: updateError } = await supabase
    .from("section_runs")
    .update({ status: "QUEUED", attempt_count: 0 })
    .eq("id", params.sectionRunId);
  assertNoSupabaseError(updateError, "Failed to reset section run");

  const { error: jobError } = await supabase.from("jobs").insert({
    workspace_id: workspaceId,
    type: "RUN_SECTION",
    status: "QUEUED",
    payload_json: {},
    run_id: sectionRun.report_run_id,
    section_run_id: sectionRun.id,
  });
  assertNoSupabaseError(jobError, "Failed to enqueue section run");

  return NextResponse.json({ ok: true });
}
