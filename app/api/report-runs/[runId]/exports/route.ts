import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/report-runs/[runId]/exports
 * List all exports for a run
 */
export async function GET(
  _request: Request,
  { params }: { params: { runId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: exports, error } = await supabase
    .from("exports")
    .select("*")
    .eq("report_run_id", params.runId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const response = NextResponse.json(exports || []);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}
