import { NextResponse } from "next/server";
import { rebuildIndex } from "@/lib/vectorStore";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const connectorId = body?.connectorId;

  if (!connectorId) {
    return NextResponse.json(
      { error: "connectorId is required" },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();
  const { data: connector, error } = await supabase
    .from("connectors")
    .select("*")
    .eq("id", connectorId)
    .single();
  if (error || !connector || connector.type !== "VECTOR") {
    return NextResponse.json(
      { error: "Vector connector not found" },
      { status: 404 }
    );
  }

  const result = rebuildIndex(connectorId);
  const workspaceId = connector.workspace_id || (await getDefaultWorkspaceId());
  const { error: auditError } = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action_type: "VECTOR_REINDEX",
    target_type: "Connector",
    target_id: connectorId,
    details_json: result,
  });
  assertNoSupabaseError(auditError, "Failed to write audit log");
  return NextResponse.json(result);
}
