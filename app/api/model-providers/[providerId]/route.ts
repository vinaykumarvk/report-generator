import { NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { providerId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: provider, error } = await supabase
    .from("model_providers")
    .select("*")
    .eq("id", params.providerId)
    .single();
  if (error || !provider) {
    return NextResponse.json({ error: "Model provider not found" }, { status: 404 });
  }
  return NextResponse.json({ data: provider });
}

export async function PUT(
  request: Request,
  { params }: { params: { providerId: string } }
) {
  const body = await request.json();
  const supabase = supabaseAdmin();
  const { data: existing, error: findError } = await supabase
    .from("model_providers")
    .select("*")
    .eq("id", params.providerId)
    .single();
  if (findError || !existing) {
    return NextResponse.json({ error: "Model provider not found" }, { status: 404 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("model_providers")
    .update({
      name: body.name ?? existing.name,
      region: body.region ?? existing.region,
      models: Array.isArray(body.models) ? body.models : existing.models,
    })
    .eq("id", params.providerId)
    .select("*")
    .single();
  assertNoSupabaseError(updateError, "Failed to update model provider");

  const workspaceId = existing.workspace_id || (await getDefaultWorkspaceId());
  const { error: auditError } = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action_type: "MODEL_PROVIDER_UPDATED",
    target_type: "ModelProvider",
    target_id: params.providerId,
    details_json: { name: updated.name },
  });
  assertNoSupabaseError(auditError, "Failed to write audit log");
  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { providerId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: existing, error: findError } = await supabase
    .from("model_providers")
    .select("*")
    .eq("id", params.providerId)
    .single();
  if (findError || !existing) {
    return NextResponse.json({ error: "Model provider not found" }, { status: 404 });
  }
  const { error: deleteError } = await supabase
    .from("model_providers")
    .delete()
    .eq("id", params.providerId);
  assertNoSupabaseError(deleteError, "Failed to delete model provider");

  const workspaceId = existing.workspace_id || (await getDefaultWorkspaceId());
  const { error: auditError } = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action_type: "MODEL_PROVIDER_DELETED",
    target_type: "ModelProvider",
    target_id: params.providerId,
    details_json: {},
  });
  assertNoSupabaseError(auditError, "Failed to write audit log");
  return NextResponse.json({ ok: true });
}
