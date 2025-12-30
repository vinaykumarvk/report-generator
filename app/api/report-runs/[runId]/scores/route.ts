import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { runId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: run, error } = await supabase
    .from("report_runs")
    .select("id")
    .eq("id", params.runId)
    .single();
  if (error || !run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  const { data: scores } = await supabase
    .from("section_scores")
    .select("*")
    .eq("report_run_id", params.runId);
  return NextResponse.json(scores || []);
}
