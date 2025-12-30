import { NextResponse } from "next/server";
import { searchWeb } from "@/lib/webSearch";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const connectorId = body?.connectorId;
  const query = body?.query;
  if (!connectorId || !query) {
    return NextResponse.json(
      { error: "connectorId and query are required" },
      { status: 400 }
    );
  }
  const supabase = supabaseAdmin();
  const { data: connector, error } = await supabase
    .from("connectors")
    .select("*")
    .eq("id", connectorId)
    .single();
  if (error || !connector || connector.type !== "WEB_SEARCH") {
    return NextResponse.json(
      { error: "Web connector not found" },
      { status: 404 }
    );
  }
  const results = await searchWeb(connector as any, query, 5);
  return NextResponse.json(results);
}
