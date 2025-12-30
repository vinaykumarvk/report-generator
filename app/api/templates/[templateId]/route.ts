import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";
import { getWorkspaceIdFromRequest, validateWorkspaceAccess } from "@/lib/workspaceContext";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const workspaceId = await getWorkspaceIdFromRequest(request);
  const supabase = supabaseAdmin();
  const { data: template, error } = await supabase
    .from("templates")
    .select("*, template_sections(*)")
    .eq("id", params.templateId)
    .single();
  if (error) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  
  // Validate workspace access
  if (!validateWorkspaceAccess(template.workspace_id, workspaceId)) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  
  // Map sections to camelCase for frontend
  if (template.template_sections) {
    template.sections = template.template_sections.map((s: any) => ({
      id: s.id,
      title: s.title,
      purpose: s.purpose,
      order: s.order,
      outputFormat: s.output_format,
      evidencePolicy: s.evidence_policy,
      writingStyle: s.writing_style,
      sourceMode: s.source_mode || 'inherit',
      targetLengthMin: s.target_length_min,
      targetLengthMax: s.target_length_max,
      status: s.status,
    }));
    delete template.template_sections;
  }
  
  // Map sources_json to connectors for frontend
  if (template.sources_json) {
    template.connectors = Array.isArray(template.sources_json) ? template.sources_json : [];
  } else {
    template.connectors = [];
  }
  
  return NextResponse.json(template);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const workspaceId = await getWorkspaceIdFromRequest(request);
  const body = await request.json();
  const supabase = supabaseAdmin();
  const { data: template, error } = await supabase
    .from("templates")
    .select("*")
    .eq("id", params.templateId)
    .single();
  if (error || !template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  
  // Validate workspace access
  if (!validateWorkspaceAccess(template.workspace_id, workspaceId)) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  let activePromptSetId = template.active_prompt_set_id || null;
  if (body.activePromptSetId !== undefined) {
    if (body.activePromptSetId) {
      const { data: set, error: setError } = await supabase
        .from("prompt_sets")
        .select("id, template_id")
        .eq("id", body.activePromptSetId)
        .single();
      if (setError || !set || set.template_id !== template.id) {
        return NextResponse.json(
          { error: "Prompt set not found for template" },
          { status: 400 }
        );
      }
      activePromptSetId = set.id;
    } else {
      activePromptSetId = null;
    }
  }

  const history = Array.isArray(template.history_json)
    ? [...template.history_json]
    : [];
  history.push({
    version: template.version_number || 1,
    timestamp: new Date().toISOString(),
    action: "updated",
    state: {
      name: body.name ?? template.name,
      description: body.description ?? template.description,
      audience: body.audience ?? template.audience,
      tone: body.tone ?? template.tone,
      domain: body.domain ?? template.domain,
      jurisdiction: body.jurisdiction ?? template.jurisdiction,
      formats: Array.isArray(body.formats) ? body.formats : template.formats,
      defaultVectorStoreIds: Array.isArray(body.defaultVectorStoreIds)
        ? body.defaultVectorStoreIds
        : template.default_vector_store_ids || [],
      activePromptSetId,
    },
  });

  const { data: updated, error: updateError } = await supabase
    .from("templates")
    .update({
      name: body.name ?? template.name,
      description: body.description ?? template.description,
      audience: body.audience ?? template.audience,
      tone: body.tone ?? template.tone,
      domain: body.domain ?? template.domain,
      jurisdiction: body.jurisdiction ?? template.jurisdiction,
      default_vector_store_ids: Array.isArray(body.defaultVectorStoreIds)
        ? body.defaultVectorStoreIds
        : template.default_vector_store_ids || [],
      formats: Array.isArray(body.formats) ? body.formats : template.formats,
      active_prompt_set_id: activePromptSetId,
      sources_json: Array.isArray(body.connectors) ? body.connectors : (template.sources_json || []),
      history_json: history,
    })
    .eq("id", params.templateId)
    .select("*")
    .single();
  assertNoSupabaseError(updateError, "Failed to update template");

  // Update sections if provided
  if (Array.isArray(body.sections)) {
    for (const section of body.sections) {
      if (section.id) {
        // Update existing section
        await supabase
          .from("template_sections")
          .update({
            title: section.title,
            purpose: section.purpose,
            output_format: section.outputFormat,
            evidence_policy: section.evidencePolicy,
            writing_style: section.writingStyle,
            source_mode: section.sourceMode || 'inherit',
            target_length_min: section.targetLengthMin,
            target_length_max: section.targetLengthMax,
            order: section.order,
          })
          .eq("id", section.id)
          .eq("template_id", params.templateId);
      }
    }
  }

  const workspaceId = template.workspace_id || (await getDefaultWorkspaceId());
  const { error: auditError } = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action_type: "TEMPLATE_UPDATED",
    target_type: "Template",
    target_id: params.templateId,
    details_json: { name: updated.name },
  });
  assertNoSupabaseError(auditError, "Failed to write audit log");

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const workspaceId = await getWorkspaceIdFromRequest(request);
  const supabase = supabaseAdmin();
  
  // First check if template exists
  const { data: template, error: fetchError } = await supabase
    .from("templates")
    .select("id, name, workspace_id")
    .eq("id", params.templateId)
    .single();
    
  if (fetchError || !template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  
  // Validate workspace access
  if (!validateWorkspaceAccess(template.workspace_id, workspaceId)) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Delete the template (sections will cascade delete)
  const { error: deleteError } = await supabase
    .from("templates")
    .delete()
    .eq("id", params.templateId);
    
  assertNoSupabaseError(deleteError, "Failed to delete template");

  // Log the deletion
  const workspaceId = template.workspace_id || (await getDefaultWorkspaceId());
  const { error: auditError } = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action_type: "TEMPLATE_DELETED",
    target_type: "Template",
    target_id: params.templateId,
    details_json: { name: template.name },
  });
  assertNoSupabaseError(auditError, "Failed to write audit log");

  return NextResponse.json({ success: true, message: "Template deleted" });
}
