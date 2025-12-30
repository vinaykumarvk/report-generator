import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";
import { getWorkspaceIdFromRequest } from "@/lib/workspaceContext";

export const runtime = "nodejs";

const VALID_TYPES = new Set(["VECTOR", "WEB_SEARCH"]);

export async function GET(request: NextRequest) {
  const workspaceId = await getWorkspaceIdFromRequest(request);
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("connectors")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load connectors" },
      { status: 500 }
    );
  }
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const workspaceId = await getWorkspaceIdFromRequest(request);
  const body = await request.json();
  if (!body?.name || !body?.type) {
    return NextResponse.json(
      { error: "name and type are required" },
      { status: 400 }
    );
  }
  if (!VALID_TYPES.has(body.type)) {
    return NextResponse.json(
      { error: "type must be VECTOR or WEB_SEARCH" },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();
  const { data: connector, error: createError } = await supabase
    .from("connectors")
    .insert({
      workspace_id: workspaceId,
      name: body.name,
      type: body.type,
      description: body.description || "",
      config_json: body.configJson || {},
      tags: Array.isArray(body.tags) ? body.tags : [],
    })
    .select("*")
    .single();
  assertNoSupabaseError(createError, "Failed to create connector");

  const { error: auditError } = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action_type: "CONNECTOR_CREATED",
    target_type: "Connector",
    target_id: connector.id,
    details_json: { type: connector.type, name: connector.name },
  });
  assertNoSupabaseError(auditError, "Failed to write audit log");

  return NextResponse.json(connector, { status: 201 });
}
