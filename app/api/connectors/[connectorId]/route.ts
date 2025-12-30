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
  const typedExisting = existing as {
    id: string;
    name: string | null;
    description: string | null;
    config_json?: Record<string, unknown> | null;
    tags?: string[] | null;
    workspace_id?: string | null;
  } | null;
  if (findError || !typedExisting) {
    return NextResponse.json({ error: "Connector not found" }, { status: 404 });
  }
  
  // Prepare update data
  const updatePayload = {
    name: body.name ?? typedExisting.name,
    description: body.description ?? typedExisting.description,
    config_json:
      body.configJson !== undefined ? body.configJson : typedExisting.config_json,
    tags: Array.isArray(body.tags) ? body.tags : typedExisting.tags,
  };
  
  const { data: updated, error: updateError } = (await (supabase
    .from("connectors") as any)
    .update(updatePayload)
    .eq("id", params.connectorId)
    .select("*")
    .single()) as { data: any; error: any };
  assertNoSupabaseError(updateError, "Failed to update connector");

  const workspaceId = typedExisting.workspace_id || (await getDefaultWorkspaceId());
  const { error: auditError } = await (supabase.from("audit_logs") as any).insert({
    workspace_id: workspaceId,
    action_type: "CONNECTOR_UPDATED",
    target_type: "Connector",
    target_id: params.connectorId,
    details_json: { name: updated?.name },
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
  const typedExisting = existing as { workspace_id?: string | null } | null;
  if (findError || !typedExisting) {
    return NextResponse.json({ error: "Connector not found" }, { status: 404 });
  }
  const { error: deleteError } = await supabase
    .from("connectors")
    .delete()
    .eq("id", params.connectorId);
  assertNoSupabaseError(deleteError, "Failed to delete connector");
  const workspaceId = typedExisting.workspace_id || (await getDefaultWorkspaceId());
  const { error: auditError } = await (supabase.from("audit_logs") as any).insert({
    workspace_id: workspaceId,
    action_type: "CONNECTOR_DELETED",
    target_type: "Connector",
    target_id: params.connectorId,
    details_json: {},
  });
  assertNoSupabaseError(auditError, "Failed to write audit log");
  return NextResponse.json({ ok: true });
}
