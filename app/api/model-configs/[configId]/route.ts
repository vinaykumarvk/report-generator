import { NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { configId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: config, error } = await supabase
    .from("model_configs")
    .select("*")
    .eq("id", params.configId)
    .single();
  if (error || !config) {
    return NextResponse.json({ error: "Model config not found" }, { status: 404 });
  }
  return NextResponse.json({ data: config });
}

export async function PUT(
  request: Request,
  { params }: { params: { configId: string } }
) {
  const body = await request.json();
  const supabase = supabaseAdmin();
  const { data: existing, error: findError } = await supabase
    .from("model_configs")
    .select("*")
    .eq("id", params.configId)
    .single();
  if (findError || !existing) {
    return NextResponse.json({ error: "Model config not found" }, { status: 404 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("model_configs")
    .update({
      provider_id: body.providerId ?? existing.provider_id,
      model: body.model ?? existing.model,
      temperature: body.temperature ?? existing.temperature,
      max_output_tokens: body.maxOutputTokens ?? existing.max_output_tokens,
      top_p: body.topP ?? existing.top_p,
      strictness: body.strictness ?? existing.strictness,
      verification: body.verification ?? existing.verification,
      stage_hints: body.stageHints ?? existing.stage_hints,
    })
    .eq("id", params.configId)
    .select("*")
    .single();
  assertNoSupabaseError(updateError, "Failed to update model config");

  const workspaceId = existing.workspace_id || (await getDefaultWorkspaceId());
  const { error: auditError } = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action_type: "MODEL_CONFIG_UPDATED",
    target_type: "ModelConfig",
    target_id: params.configId,
    details_json: { model: updated.model },
  });
  assertNoSupabaseError(auditError, "Failed to write audit log");
  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { configId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: existing, error: findError } = await supabase
    .from("model_configs")
    .select("*")
    .eq("id", params.configId)
    .single();
  if (findError || !existing) {
    return NextResponse.json({ error: "Model config not found" }, { status: 404 });
  }
  const { error: deleteError } = await supabase
    .from("model_configs")
    .delete()
    .eq("id", params.configId);
  assertNoSupabaseError(deleteError, "Failed to delete model config");

  const workspaceId = existing.workspace_id || (await getDefaultWorkspaceId());
  const { error: auditError } = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action_type: "MODEL_CONFIG_DELETED",
    target_type: "ModelConfig",
    target_id: params.configId,
    details_json: {},
  });
  assertNoSupabaseError(auditError, "Failed to write audit log");
  return NextResponse.json({ ok: true });
}
