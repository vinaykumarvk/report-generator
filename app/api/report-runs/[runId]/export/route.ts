import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";
import { notifyJobQueued } from "@/lib/jobTrigger";
import { createExportSchema, uuidSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { runId: string } }
) {
  try {
    // Validate runId
    const runIdResult = uuidSchema.safeParse(params.runId);
    if (!runIdResult.success) {
      return NextResponse.json(
        { error: "Invalid run ID format" },
        { status: 400 }
      );
    }
    
    // Validate request body
    const body = await request.json();
    const result = createExportSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: result.error.errors.map(err => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
        },
        { status: 400 }
      );
    }
    
    const { format } = result.data;
    
    const supabase = supabaseAdmin();
    const { data: run, error } = (await supabase
      .from("report_runs")
      .select("*")
      .eq("id", params.runId)
      .single()) as { data: any; error: any };
    if (error || !run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

  const workspaceId = run.workspace_id || (await getDefaultWorkspaceId());
  const exportId = crypto.randomUUID();
  const { error: exportError } = await supabase.from("exports").insert({
    id: exportId,
    report_run_id: params.runId,
    workspace_id: workspaceId,
    format,
    status: "QUEUED",
  });
  assertNoSupabaseError(exportError, "Failed to create export record");

  const { data: job, error: jobError } = (await (supabase
    .from("jobs") as any)
    .insert({
      workspace_id: workspaceId,
      type: "EXPORT",
      status: "QUEUED",
      payload_json: { format, exportId },
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
    payload_json: { jobId: job.id, format, exportId },
  });
  assertNoSupabaseError(eventError, "Failed to write run event");

  return NextResponse.json({ jobId: job.id, exportId }, { status: 202 });
  } catch (error) {
    console.error('Error creating export:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
