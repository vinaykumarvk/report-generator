import { NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("model_providers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load model providers" },
      { status: 500 }
    );
  }
  return NextResponse.json({ data: data || [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body?.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const supabase = supabaseAdmin();
  const workspaceId = await getDefaultWorkspaceId();
  const { data: provider, error: createError } = await supabase
    .from("model_providers")
    .insert({
      workspace_id: workspaceId,
      name: body.name,
      region: body.region || "unknown",
      models: Array.isArray(body.models) ? body.models : [],
    })
    .select("*")
    .single();
  assertNoSupabaseError(createError, "Failed to create model provider");

  const { error: auditError } = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action_type: "MODEL_PROVIDER_CREATED",
    target_type: "ModelProvider",
    target_id: provider.id,
    details_json: { name: provider.name },
  });
  assertNoSupabaseError(auditError, "Failed to write audit log");
  return NextResponse.json({ data: provider }, { status: 201 });
}
