import { NextResponse } from "next/server";
import { getStoreStats } from "@/lib/vectorStore";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { connectorId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: connector, error } = await supabase
    .from("connectors")
    .select("*")
    .eq("id", params.connectorId)
    .single();
  if (error || !connector) {
    return NextResponse.json({ error: "Connector not found" }, { status: 404 });
  }

  if (connector.type === "VECTOR") {
    const stats = getStoreStats(connector.id);
    return NextResponse.json({
      status: "ok",
      connectorId: connector.id,
      documentCount: stats.documentCount,
      chunkCount: stats.chunkCount,
      updatedAt: stats.updatedAt,
    });
  }

  if (connector.type === "WEB_SEARCH") {
    const hasConfig = Boolean(
      connector.config_json && Object.keys(connector.config_json).length
    );
    return NextResponse.json({
      status: hasConfig ? "ok" : "degraded",
      connectorId: connector.id,
      configured: hasConfig,
    });
  }

  return NextResponse.json({ status: "unknown" });
}
