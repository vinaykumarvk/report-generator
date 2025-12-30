import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";
import { getWorkspaceIdFromRequest } from "@/lib/workspaceContext";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const workspaceId = await getWorkspaceIdFromRequest(request);
  const supabase = supabaseAdmin();
  const { data, error} = await supabase
    .from("templates")
    .select("*, template_sections(*)")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .order("order", { foreignTable: "template_sections", ascending: true });
  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load templates" },
      { status: 500 }
    );
  }
  
  let templates = data || [];
  if (!templates.length) {
    const fallbackWorkspaceId = await getDefaultWorkspaceId();
    if (fallbackWorkspaceId !== workspaceId) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("templates")
        .select("*, template_sections(*)")
        .eq("workspace_id", fallbackWorkspaceId)
        .order("updated_at", { ascending: false })
        .order("order", { foreignTable: "template_sections", ascending: true });
      if (fallbackError) {
        return NextResponse.json(
          { error: fallbackError.message || "Failed to load templates" },
          { status: 500 }
        );
      }
      templates = fallbackData || [];
    }
  }

  // Map sources_json to connectors and template_sections to sections for frontend
  const mappedTemplates = templates.map((template: any) => {
    const mappedTemplate: any = {
      ...template,
      connectors: Array.isArray(template.sources_json) ? template.sources_json : [],
    };
    
    // Map sections to camelCase for frontend
    if (template.template_sections) {
      mappedTemplate.sections = template.template_sections.map((s: any) => ({
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
      delete mappedTemplate.template_sections;
    } else {
      mappedTemplate.sections = [];
    }
    
    return mappedTemplate;
  });
  
  return NextResponse.json(mappedTemplates);
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body?.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const workspaceId = await getWorkspaceIdFromRequest(request as NextRequest);
  const now = new Date().toISOString();
  const history = [
    {
      version: 1,
      timestamp: now,
      action: "created",
      state: {
        name: body.name.trim(),
        description: body.description || "",
        audience: body.audience || "",
        tone: body.tone || "",
        domain: body.domain || "",
        jurisdiction: body.jurisdiction || "",
        formats: Array.isArray(body.formats) ? body.formats : [],
        defaultVectorStoreIds: [],
        activePromptSetId: null,
      },
    },
  ];

  const { data: template, error: createError } = await supabase
    .from("templates")
    .insert({
      workspace_id: workspaceId,
      name: body.name.trim(),
      description: body.description || "",
      audience: body.audience || "",
      tone: body.tone || "",
      domain: body.domain || "",
      jurisdiction: body.jurisdiction || "",
      status: "ACTIVE",
      formats: Array.isArray(body.formats) ? body.formats : [],
      sources_json: Array.isArray(body.connectors) ? body.connectors : [],
      history_json: history,
    })
    .select("*")
    .single();
  assertNoSupabaseError(createError, "Failed to create template");

  const { error: auditError } = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action_type: "TEMPLATE_CREATED",
    target_type: "Template",
    target_id: template.id,
    details_json: { name: template.name },
  });
  assertNoSupabaseError(auditError, "Failed to write audit log");

  return NextResponse.json(template, { status: 201 });
}
