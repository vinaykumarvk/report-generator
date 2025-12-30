import { NextResponse } from "next/server";
import { lintTemplate, detectDependencyCycles } from "@/lib/linter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
  const cycles = detectDependencyCycles(sections);

  return NextResponse.json({
    valid: result.pass,
    issues: [...result.errors, ...result.warnings],
    errors: result.errors,
    warnings: result.warnings,
    cycles,
  });
}
