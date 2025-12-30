import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const supabase = supabaseAdmin();
  const [
    templatesRes,
    connectorsRes,
    runsRes,
    exportsRes,
    statusRes,
    recentRes,
  ] = await Promise.all([
    supabase.from("templates").select("id", { count: "exact", head: true }),
    supabase.from("connectors").select("id", { count: "exact", head: true }),
    supabase.from("report_runs").select("id", { count: "exact", head: true }),
    supabase.from("exports").select("id", { count: "exact", head: true }),
    supabase.from("report_runs").select("status"),
    supabase
      .from("report_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const runStatusCounts = (statusRes.data || []).reduce(
    (acc: Record<string, number>, run: any) => {
      acc[run.status] = (acc[run.status] || 0) + 1;
      return acc;
    },
    {}
  );

  return NextResponse.json({
    templatesCount: templatesRes.count || 0,
    connectorsCount: connectorsRes.count || 0,
    runsCount: runsRes.count || 0,
    exportsCount: exportsRes.count || 0,
    runStatusCounts,
    recentRuns: recentRes.data || [],
  });
}
