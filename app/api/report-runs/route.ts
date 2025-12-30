import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";
import { getWorkspaceIdFromRequest } from "@/lib/workspaceContext";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const workspaceId = await getWorkspaceIdFromRequest(request);
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("report_runs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load report runs" },
      { status: 500 }
    );
  }
  return NextResponse.json(data || []);
}

function snapshotPromptSet(promptSet: any) {
  if (!promptSet) return null;
  return {
    id: promptSet.id,
    name: promptSet.name,
    state: promptSet.state,
    version: promptSet.version,
    publishedVersion: promptSet.published_version,
    globalPrompts: promptSet.global_prompts || { system: "", developer: "" },
    sections: promptSet.sections_json || [],
  };
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body?.templateId) {
    return NextResponse.json(
      { error: "templateId is required" },
      { status: 400 }
    );
  }
  const supabase = supabaseAdmin();
  const { data: template, error: templateError } = (await supabase
    .from("templates")
    .select("*, template_sections(*)")
    .eq("id", body.templateId)
    .single()) as { data: any; error: any };
  if (templateError || !template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  let profile: any = null;
  if (body.profileId) {
    const { data, error } = (await supabase
      .from("generation_profiles")
      .select("*")
      .eq("id", body.profileId)
      .single()) as { data: any; error: any };
    if (error || !data) {
      return NextResponse.json(
        { error: "Generation profile not found" },
        { status: 404 }
      );
    }
    profile = data;
  }

  let promptSet: any = null;
  if (body.promptSetId) {
    const { data, error } = (await supabase
      .from("prompt_sets")
      .select("*")
      .eq("id", body.promptSetId)
      .single()) as { data: any; error: any };
    if (error || !data) {
      return NextResponse.json(
        { error: "Prompt set not found" },
        { status: 404 }
      );
    }
    if (data.template_id && data.template_id !== template.id) {
      return NextResponse.json(
        { error: "Prompt set does not match template" },
        { status: 400 }
      );
    }
    promptSet = data;
  } else if (template.active_prompt_set_id) {
    const { data } = await supabase
      .from("prompt_sets")
      .select("*")
      .eq("id", template.active_prompt_set_id)
      .single();
    promptSet = data || null;
  } else {
    const { data } = await supabase
      .from("prompt_sets")
      .select("*")
      .eq("template_id", template.id)
      .eq("state", "PUBLISHED")
      .order("published_version", { ascending: false })
      .limit(1);
    promptSet = data?.[0] || null;
  }

  const workspaceId = template.workspace_id || (await getDefaultWorkspaceId());
  const templateSnapshot = {
    ...template,
    sections: template.template_sections || [],
  };

  const { data: run, error: runError } = await supabase
    .from("report_runs")
    .insert({
      workspace_id: workspaceId,
      template_id: template.id,
      template_version_snapshot_json: templateSnapshot,
      profile_id: profile?.id || null,
      profile_snapshot: profile || null,
      prompt_set_id: promptSet?.id || null,
      prompt_set_snapshot: snapshotPromptSet(promptSet),
      input_json: body.inputJson || {},
      status: "QUEUED",
    })
    .select("*")
    .single();
  assertNoSupabaseError(runError, "Failed to create report run");
  if (!run) {
    return NextResponse.json(
      { error: "Failed to create report run" },
      { status: 500 }
    );
  }
  const runId = String(run.id);

  const sections = template.template_sections || [];
  if (sections.length > 0) {
    const { error: sectionError } = await supabase
      .from("section_runs")
      .insert(
        sections.map((section: any) => ({
          report_run_id: runId,
          template_section_id: section.id,
          title: section.title,
          status: "QUEUED",
        }))
      );
    assertNoSupabaseError(sectionError, "Failed to create section runs");
  }

  const { error: eventError } = await supabase.from("run_events").insert({
    run_id: runId,
    workspace_id: workspaceId,
    type: "RUN_CREATED",
    payload_json: { templateId: run.template_id },
  });
  assertNoSupabaseError(eventError, "Failed to create run event");

  const { error: auditError } = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action_type: "RUN_CREATED",
    target_type: "ReportRun",
    target_id: runId,
    details_json: { templateId: run.template_id },
  });
  assertNoSupabaseError(auditError, "Failed to write audit log");

  const { data: sectionRuns } = await supabase
    .from("section_runs")
    .select("*")
    .eq("report_run_id", runId)
    .order("created_at", { ascending: true });

  return NextResponse.json(
    { run, sectionRuns: sectionRuns || [] },
    { status: 201 }
  );
}
