import { NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";

export const runtime = "nodejs";

export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("generation_profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load profiles" },
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
  const { data: profile, error: createError } = (await (supabase
    .from("generation_profiles") as any)
    .insert({
      workspace_id: workspaceId,
      name: body.name,
      description: body.description || "",
      toggles: body.toggles || {},
      stage_config: body.stageConfig || {},
    })
    .select("*")
    .single()) as { data: any; error: any };
  assertNoSupabaseError(createError, "Failed to create generation profile");

  const { error: auditError } = await (supabase.from("audit_logs") as any).insert({
    workspace_id: workspaceId,
    action_type: "PROFILE_CREATED",
    target_type: "GenerationProfile",
    target_id: profile?.id,
    details_json: { name: profile?.name },
  });
  assertNoSupabaseError(auditError, "Failed to write audit log");
  return NextResponse.json({ data: profile }, { status: 201 });
}
