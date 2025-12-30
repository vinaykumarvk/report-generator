import { NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";

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
  return NextResponse.json(connector);
}

export async function PUT(
  request: Request,
  { params }: { params: { connectorId: string } }
) {
  const body = await request.json();
  const supabase = supabaseAdmin();
  const { data: existing, error: findError } = await supabase
    .from("connectors")
    .select("*")
    .eq("id", params.connectorId)
    .single();
  if (findError || !existing) {
    return NextResponse.json({ error: "Connector not found" }, { status: 404 });
  }
  const { data: updated, error: updateError } = await supabase
    .from("connectors")
    .update({
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      config_json:
        body.configJson !== undefined ? body.configJson : existing.config_json,
      tags: Array.isArray(body.tags) ? body.tags : existing.tags,
    })
    .eq("id", params.connectorId)
    .select("*")
    .single();
  assertNoSupabaseError(updateError, "Failed to update connector");

  const workspaceId = existing.workspace_id || (await getDefaultWorkspaceId());
  const { error: auditError } = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action_type: "CONNECTOR_UPDATED",
    target_type: "Connector",
    target_id: params.connectorId,
    details_json: { name: updated.name },
  });
  assertNoSupabaseError(auditError, "Failed to write audit log");
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { connectorId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: existing, error: findError } = await supabase
    .from("connectors")
    .select("*")
    .eq("id", params.connectorId)
    .single();
  if (findError || !existing) {
    return NextResponse.json({ error: "Connector not found" }, { status: 404 });
  }
  const { error: deleteError } = await supabase
    .from("connectors")
    .delete()
    .eq("id", params.connectorId);
  assertNoSupabaseError(deleteError, "Failed to delete connector");
  const workspaceId = existing.workspace_id || (await getDefaultWorkspaceId());
  const { error: auditError } = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action_type: "CONNECTOR_DELETED",
    target_type: "Connector",
    target_id: params.connectorId,
    details_json: {},
  });
  assertNoSupabaseError(auditError, "Failed to write audit log");
  return NextResponse.json({ ok: true });
}
