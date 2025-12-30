import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load audit logs" },
      { status: 500 }
    );
  }
  return NextResponse.json(data || []);
}
