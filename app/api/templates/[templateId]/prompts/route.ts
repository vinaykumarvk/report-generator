import { NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";

export const runtime = "nodejs";

const DEFAULT_STAGES = {
  plan: "Outline the section plan.",
  write: "Draft the section content.",
  verify: "Verify compliance with evidence policy.",
  repair: "Repair the section based on issues.",
  synthesis: "Summarize section outputs only.",
};

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
  { params }: { params: { templateId: string } }
) {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("prompt_sets")
    .select("*")
    .eq("template_id", params.templateId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load prompt sets" },
      { status: 500 }
    );
  }
  return NextResponse.json(data || []);
}

export async function POST(
  request: Request,
  { params }: { params: { templateId: string } }
) {
  const body = await request.json();
  const supabase = supabaseAdmin();
  let sections = body.sections;
  if (!Array.isArray(sections) || sections.length === 0) {
    const { data: template, error: templateError } = await supabase
      .from("templates")
      .select("id, template_sections(*)")
      .eq("id", params.templateId)
      .single();
    if (templateError || !template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }
    sections = (template.template_sections || []).map((section: any) => ({
      id: section.id,
      name: section.title,
      purpose: section.purpose || "",
      evidencePolicy: section.evidence_policy || "LLM_ONLY",
      stages: { ...DEFAULT_STAGES },
      guardrails: [],
    }));
  }
  const workspaceId = await getDefaultWorkspaceId();
  const { data: created, error: createError } = await supabase
    .from("prompt_sets")
    .insert({
      workspace_id: workspaceId,
      template_id: params.templateId,
      name: body.name || "Untitled Prompt Set",
      state: "DRAFT",
      version: 1,
      global_prompts: body.globalPrompts || { system: "", developer: "" },
      sections_json: sections,
      history_json: [],
    })
    .select("*")
    .single();
  assertNoSupabaseError(createError, "Failed to create prompt set");

  const history = [snapshotEntry(created, "created", "Initial draft created")];
  const { data: updated, error: updateError } = await supabase
    .from("prompt_sets")
    .update({ history_json: history })
    .eq("id", created.id)
    .select("*")
    .single();
  assertNoSupabaseError(updateError, "Failed to update prompt history");

  return NextResponse.json(updated, { status: 201 });
}
