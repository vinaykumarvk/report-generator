import { NextResponse } from "next/server";
import { lintTemplate } from "@/lib/linter";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: { templateId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: template, error } = await supabase
    .from("templates")
    .select("*, template_sections(*)")
    .eq("id", params.templateId)
    .single();
  if (error || !template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const { data: vectorConnectors } = await supabase
    .from("connectors")
    .select("id")
    .eq("type", "VECTOR");
  const { data: webConnectors } = await supabase
    .from("connectors")
    .select("id")
    .eq("type", "WEB_SEARCH");
  const sections = template.template_sections || [];
  const result = lintTemplate(template, sections, {
    webProviderConfigured: (webConnectors || []).length > 0,
    vectorConnectorIds: (vectorConnectors || []).map((connector) => connector.id),
  });

  if (!result.pass) {
    return NextResponse.json(
      {
        valid: false,
        issues: [...result.errors, ...result.warnings],
        errors: result.errors,
        warnings: result.warnings,
      },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const history = Array.isArray(template.history_json)
    ? [...template.history_json]
    : [];
  history.push({
    version: (template.version_number || 0) + 1,
    timestamp: now,
    action: "published",
    state: {
      name: template.name,
      description: template.description,
      audience: template.audience,
      tone: template.tone,
      domain: template.domain,
      jurisdiction: template.jurisdiction,
      formats: template.formats,
      defaultVectorStoreIds: template.default_vector_store_ids || [],
    },
  });

  const { data: updated, error: updateError } = await supabase
    .from("templates")
    .update({
      status: "PUBLISHED",
      version_number: (template.version_number || 0) + 1,
      published_at: now,
      history_json: history,
    })
    .eq("id", template.id)
    .select("*")
    .single();
  assertNoSupabaseError(updateError, "Failed to publish template");

  const workspaceId = template.workspace_id || (await getDefaultWorkspaceId());
  const { error: auditError } = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action_type: "TEMPLATE_PUBLISHED",
    target_type: "Template",
    target_id: template.id,
    details_json: { name: template.name },
  });
  assertNoSupabaseError(auditError, "Failed to write audit log");

  return NextResponse.json({
    message: `Template "${updated.name}" published.`,
  });
}
