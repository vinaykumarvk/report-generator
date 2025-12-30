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
  const body = await request.json();
  if (!body?.version) {
    return NextResponse.json(
      { error: "version is required" },
      { status: 400 }
    );
  }
  const supabase = supabaseAdmin();
  const { data: set, error: findError } = (await supabase
    .from("prompt_sets")
    .select("*")
    .eq("id", params.promptId)
    .single()) as { data: any; error: any };
  if (findError || !set) {
    return NextResponse.json({ error: "Prompt set not found" }, { status: 404 });
  }

  const history = Array.isArray(set.history_json) ? [...set.history_json] : [];
  const target = history
    .slice()
    .reverse()
    .find((entry: any) => entry.version === body.version);

  if (!target) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const nextVersion = (set.version || 0) + 1;
  const nextState = target.state || {};
  const { data: updated, error: updateError } = (await (supabase
    .from("prompt_sets") as any)
    .update({
      name: nextState.name ?? set.name,
      sections_json: nextState.sections ?? set.sections_json,
      global_prompts: nextState.globalPrompts ?? set.global_prompts,
      template_id: nextState.templateId ?? set.template_id,
      state: "DRAFT",
      version: nextVersion,
      history_json: [
        ...history,
        snapshotEntry(
          { ...set, ...nextState, state: "DRAFT", version: nextVersion },
          "rollback",
          body.note || `Rolled back to version ${body.version}`
        ),
      ],
    })
    .eq("id", params.promptId)
    .select("*")
    .single()) as { data: any; error: any };
  assertNoSupabaseError(updateError, "Failed to rollback prompt set");
  return NextResponse.json(updated);
}
