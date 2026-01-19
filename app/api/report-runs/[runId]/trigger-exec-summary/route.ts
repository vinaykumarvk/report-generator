import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enqueueJob } from "@/lib/dbqueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isExecSummarySection(section: any) {
  const sectionType = section?.sectionType ?? section?.section_type;
  if (sectionType) {
    return String(sectionType).toLowerCase().includes("executive");
  }
  return false;
}

export async function POST(
  _request: Request,
  { params }: { params: { runId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: run, error: runError } = await supabase
    .from("report_runs")
    .select("*")
    .eq("id", params.runId)
    .single();
  if (runError || !run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const { data: existingJobs, error: jobsError } = await supabase
    .from("jobs")
    .select("id,type,status")
    .eq("run_id", params.runId)
    .in("type", ["GENERATE_EXEC_SUMMARY", "ASSEMBLE"])
    .in("status", ["QUEUED", "RUNNING", "COMPLETED"])
    .limit(1);
  if (jobsError) {
    return NextResponse.json(
      { error: jobsError.message || "Failed to check job status" },
      { status: 500 }
    );
  }
  if (existingJobs && existingJobs.length > 0) {
    return NextResponse.json(
      { message: "Executive summary job already exists.", job: existingJobs[0] },
      { status: 200 }
    );
  }

  const { data: sectionRuns, error: sectionError } = await supabase
    .from("section_runs")
    .select("id, title, status, template_section_id")
    .eq("report_run_id", params.runId);
  if (sectionError) {
    return NextResponse.json(
      { error: sectionError.message || "Failed to load section runs" },
      { status: 500 }
    );
  }

  const template = (run.template_version_snapshot_json || {}) as any;
  const execSummaryIds = new Set(
    ((template.sections || template.template_sections || []) as any[])
      .filter((section: any) => isExecSummarySection(section))
      .map((section: any) => section.id)
  );

  const allNonExecDone = (sectionRuns || []).every((item: any) => {
    const isExecSummary =
      (item.template_section_id && execSummaryIds.has(item.template_section_id)) ||
      (item.title && item.title.toLowerCase().includes("executive summary"));
    return isExecSummary ? true : item.status === "COMPLETED";
  });

  if (!allNonExecDone) {
    return NextResponse.json(
      { error: "Not all non-executive-summary sections are completed." },
      { status: 409 }
    );
  }

  await enqueueJob({
    type: "GENERATE_EXEC_SUMMARY",
    payloadJson: {},
    runId: params.runId,
    workspaceId: (run.workspace_id as string | null) ?? null,
  });

  return NextResponse.json({
    message: "GENERATE_EXEC_SUMMARY job enqueued.",
    runId: params.runId,
  });
}
