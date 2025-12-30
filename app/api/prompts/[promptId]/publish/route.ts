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

export async function POST(
  request: Request,
  { params }: { params: { promptId: string } }
) {
  let body: { note?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const supabase = supabaseAdmin();
  const { data: existing, error: findError } = await supabase
    .from("prompt_sets")
    .select("*")
    .eq("id", params.promptId)
    .single();
  if (findError || !existing) {
    return NextResponse.json({ error: "Prompt set not found" }, { status: 404 });
  }

  const history = Array.isArray(existing.history_json)
    ? [...existing.history_json]
    : [];
  history.push(
    snapshotEntry(
      {
        ...existing,
        state: "PUBLISHED",
        published_version: existing.version,
      },
      "published",
      body.note
    )
  );

  const { data: updated, error: updateError } = await supabase
    .from("prompt_sets")
    .update({
      state: "PUBLISHED",
      published_version: existing.version,
      history_json: history,
    })
    .eq("id", params.promptId)
    .select("*")
    .single();
  assertNoSupabaseError(updateError, "Failed to publish prompt set");
  return NextResponse.json(updated);
}
