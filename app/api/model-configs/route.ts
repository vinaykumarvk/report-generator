import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";
import { getWorkspaceIdFromRequest } from "@/lib/workspaceContext";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const workspaceId = await getWorkspaceIdFromRequest(request);
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("model_configs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load model configs" },
      { status: 500 }
    );
  }
  return NextResponse.json({ data: data || [] });
}

export async function POST(request: NextRequest) {
  const workspaceId = await getWorkspaceIdFromRequest(request);
  const body = await request.json();
  if (!body?.providerId || !body?.model) {
    return NextResponse.json(
      { error: "providerId and model are required" },
      { status: 400 }
    );
  }
  const supabase = supabaseAdmin();
  const { data: config, error: createError } = await supabase
    .from("model_configs")
    .insert({
      workspace_id: workspaceId,
      provider_id: body.providerId,
      model: body.model,
      temperature: body.temperature ?? 0.5,
      max_output_tokens: body.maxOutputTokens ?? 1024,
      top_p: body.topP ?? 0.9,
      strictness: body.strictness || "medium",
      verification: body.verification || {},
      stage_hints: body.stageHints || {},
    })
    .select("*")
    .single();
  assertNoSupabaseError(createError, "Failed to create model config");

  const { error: auditError } = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action_type: "MODEL_CONFIG_CREATED",
    target_type: "ModelConfig",
    target_id: config.id,
    details_json: { model: config.model },
  });
  assertNoSupabaseError(auditError, "Failed to write audit log");
  return NextResponse.json({ data: config }, { status: 201 });
}
