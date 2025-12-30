import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getWorkspaceIdFromRequest } from "@/lib/workspaceContext";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const workspaceId = await getWorkspaceIdFromRequest(request);
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("prompt_sets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false});
  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load prompt sets" },
      { status: 500 }
    );
  }
  return NextResponse.json(data || []);
}
