import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";
import { getWorkspaceIdFromRequest } from "@/lib/workspaceContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const workspaceId = await getWorkspaceIdFromRequest(request);
  const supabase = supabaseAdmin();
  
  // Try relationship query first, fallback to separate queries if it fails
  let { data, error } = await supabase
    .from("templates")
    .select("*, template_sections(*)")
    .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
    .order("updated_at", { ascending: false });
  
  // If relationship query fails, use separate queries
  if (error && (error.message.includes("relationship") || error.message.includes("foreignTable"))) {
    // Fetch templates separately
    const { data: templatesData, error: templatesError } = await supabase
      .from("templates")
      .select("*")
      .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
      .order("updated_at", { ascending: false });
    
    if (templatesError) {
      return NextResponse.json(
        { error: templatesError.message || "Failed to load templates" },
        { status: 500 }
      );
    }
    
    // Fetch sections separately and combine
    if (templatesData && templatesData.length > 0) {
      const templateIds = templatesData.map((t: any) => t.id);
      const { data: sectionsData } = await supabase
        .from("template_sections")
        .select("*")
        .in("template_id", templateIds)
        .order("order", { ascending: true });
      
      // Combine data
      data = templatesData.map((template: any) => ({
        ...template,
        template_sections: sectionsData?.filter((s: any) => s.template_id === template.id) || []
      }));
      error = null;
    } else {
      data = [];
    }
  }
  
  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load templates" },
      { status: 500 }
    );
  }
  
  let templates = data || [];
  if (!templates.length) {
    const fallbackWorkspaceId = String(await getDefaultWorkspaceId());
    if (fallbackWorkspaceId !== workspaceId) {
      // Try relationship query for fallback
      let { data: fallbackData, error: fallbackError } = await supabase
        .from("templates")
        .select("*, template_sections(*)")
        .or(`workspace_id.eq.${fallbackWorkspaceId},workspace_id.is.null`)
        .order("updated_at", { ascending: false });
      
      // If relationship query fails, use separate queries
      if (fallbackError && (fallbackError.message.includes("relationship") || fallbackError.message.includes("foreignTable"))) {
        const { data: fallbackTemplatesData, error: fallbackTemplatesError } = await supabase
          .from("templates")
          .select("*")
          .or(`workspace_id.eq.${fallbackWorkspaceId},workspace_id.is.null`)
          .order("updated_at", { ascending: false });
        
        if (fallbackTemplatesError) {
          return NextResponse.json(
            { error: fallbackTemplatesError.message || "Failed to load templates" },
            { status: 500 }
          );
        }
        
        if (fallbackTemplatesData && fallbackTemplatesData.length > 0) {
          const fallbackTemplateIds = fallbackTemplatesData.map((t: any) => t.id);
          const { data: fallbackSectionsData } = await supabase
            .from("template_sections")
            .select("*")
            .in("template_id", fallbackTemplateIds)
            .order("order", { ascending: true });
          
          fallbackData = fallbackTemplatesData.map((template: any) => ({
            ...template,
            template_sections: fallbackSectionsData?.filter((s: any) => s.template_id === template.id) || []
          }));
          fallbackError = null;
        } else {
          fallbackData = [];
        }
      }
      
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
    
    // Map sections to camelCase for frontend, sorted by order
    if (template.template_sections) {
      const sortedSections = [...template.template_sections].sort((a: any, b: any) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        return orderA - orderB;
      });
      mappedTemplate.sections = sortedSections.map((s: any) => ({
        id: s.id,
        title: s.title,
        purpose: s.purpose,
        order: s.order,
        outputFormat: s.output_format,
        evidencePolicy: s.evidence_policy,
        writingStyle: s.writing_style,
        sourceMode: s.source_mode || 'inherit',
        customConnectorIds: s.vector_policy_json?.connectorIds || [],
        targetLengthMin: s.target_length_min,
        targetLengthMax: s.target_length_max,
        status: s.status,
      }));
      delete mappedTemplate.template_sections;
    } else {
      mappedTemplate.sections = [];
    }
    
    // Map is_master to isMaster
    mappedTemplate.isMaster = template.is_master === true;
    
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
      is_master: body.isMaster === true,
    })
    .select("*")
    .single();
  assertNoSupabaseError(createError, "Failed to create template");
  if (!template) {
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action_type: "TEMPLATE_CREATED",
    target_type: "Template",
    target_id: String(template.id),
    details_json: { name: template.name },
  });
  assertNoSupabaseError(auditError, "Failed to write audit log");

  return NextResponse.json(template, { status: 201 });
}
