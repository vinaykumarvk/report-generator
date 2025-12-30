import { NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function nowIso() {
  return new Date().toISOString();
}

function snapshotEntry(set: any, action: string, note?: string) {
  return {
    version: set.version,
    timestamp: nowIso(),
    action,
    note: note || "",
    state: {
      name: set.name,
      state: set.state,
      sections: set.sections_json || [],
      globalPrompts: set.global_prompts || { system: "", developer: "" },
      templateId: set.template_id || null,
      publishedVersion: set.published_version || null,
    },
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { promptId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: set, error } = await supabase
    .from("prompt_sets")
    .select("*")
    .eq("id", params.promptId)
    .single();
  if (error || !set) {
    return NextResponse.json({ error: "Prompt set not found" }, { status: 404 });
  }
  return NextResponse.json(set);
}

export async function PUT(
  request: Request,
  { params }: { params: { promptId: string } }
) {
  const body = await request.json();
  const supabase = supabaseAdmin();
  const { data: existing, error: findError } = await supabase
    .from("prompt_sets")
    .select("*")
    .eq("id", params.promptId)
    .single();
  if (findError || !existing) {
    return NextResponse.json({ error: "Prompt set not found" }, { status: 404 });
  }
  const version = (existing.version || 0) + 1;
  const next = {
    name: body.name ?? existing.name,
    template_id:
      body.templateId !== undefined ? body.templateId : existing.template_id,
    global_prompts:
      body.globalPrompts !== undefined
        ? body.globalPrompts
        : existing.global_prompts || { system: "", developer: "" },
    sections_json: Array.isArray(body.sections)
      ? body.sections
      : existing.sections_json,
    state: body.state || existing.state,
  };
  const history = Array.isArray(existing.history_json)
    ? [...existing.history_json]
    : [];
  history.push(
    snapshotEntry({ ...existing, ...next, version }, "updated", body.note)
  );
  const { data: updated, error: updateError } = await supabase
    .from("prompt_sets")
    .update({
      ...next,
      version,
      history_json: history,
    })
    .eq("id", params.promptId)
    .select("*")
    .single();
  assertNoSupabaseError(updateError, "Failed to update prompt set");
  return NextResponse.json(updated);
}
