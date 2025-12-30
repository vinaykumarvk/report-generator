import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { sectionRunId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: sectionRun, error } = await supabase
    .from("section_runs")
    .select("id")
    .eq("id", params.sectionRunId)
    .single();
  if (error || !sectionRun) {
    return NextResponse.json(
      { error: "Section run not found" },
      { status: 404 }
    );
  }
  const { data: provenance } = await supabase
    .from("section_artifacts")
    .select("*")
    .eq("section_run_id", params.sectionRunId)
    .eq("type", "PROVENANCE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json(provenance?.content_json || []);
}
