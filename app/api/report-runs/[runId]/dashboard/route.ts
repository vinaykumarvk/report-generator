import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function average(values: number[]) {
  if (!values.length) return 0;
  return Number(
    (values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(3)
  );
}

export async function GET(
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

  const [{ data: sectionRuns }, { data: scores }, { data: exportsList }] =
    await Promise.all([
      supabase.from("section_runs").select("*").eq("report_run_id", params.runId),
      supabase.from("section_scores").select("*").eq("report_run_id", params.runId),
      supabase.from("exports").select("*").eq("report_run_id", params.runId),
    ]);

  const coverage = (scores || []).map((item: any) => Number(item.coverage || 0));
  const diversity = (scores || []).map((item: any) => Number(item.diversity || 0));
  const recency = (scores || []).map((item: any) => Number(item.recency || 0));
  const redundancy = (scores || []).map((item: any) => Number(item.redundancy || 0));

  const statusCounts = (sectionRuns || []).reduce(
    (acc: Record<string, number>, section: any) => {
      acc[section.status] = (acc[section.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return NextResponse.json({
    runId: run.id,
    status: run.status,
    createdAt: run.created_at,
    completedAt: run.completed_at,
    sectionCount: (sectionRuns || []).length,
    sectionStatusCounts: statusCounts,
    exportsCount: (exportsList || []).length,
    averageScores: {
      coverage: average(coverage),
      diversity: average(diversity),
      recency: average(recency),
      redundancy: average(redundancy),
    },
  });
}
