import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { templateId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: template, error: templateError } = await supabase
    .from("templates")
    .select("id")
    .eq("id", params.templateId)
    .single();
  if (templateError || !template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const body = await request.json();
  const vectorPolicyJson =
    body.vectorPolicyJson ??
    (body.sourceMode === "custom"
      ? { connectorIds: Array.isArray(body.customConnectorIds) ? body.customConnectorIds : [] }
      : null);
  
  // Prepare dependencies - ensure it's a text array or empty array
  const dependencies = Array.isArray(body.dependencies) && body.dependencies.length > 0
    ? body.dependencies
    : [];
  
  const insertData: any = {
    template_id: params.templateId,
    title: body.title,
    order: typeof body.order === "number" ? body.order : 1,
    purpose: body.purpose || null,
    output_format: body.outputFormat || "NARRATIVE",
    writing_style: body.writingStyle || null,
    source_mode: body.sourceMode || "inherit",
    target_length_min: Number.isFinite(body.targetLengthMin)
      ? body.targetLengthMin
      : null,
    target_length_max: Number.isFinite(body.targetLengthMax)
      ? body.targetLengthMax
      : null,
    evidence_policy: body.evidencePolicy || null,
    vector_policy_json: vectorPolicyJson,
    web_policy_json: body.webPolicyJson || null,
    quality_gates_json: body.qualityGatesJson || null,
    prompt: body.prompt || null,
    status: body.status || "ACTIVE",
    section_type: body.sectionType || "narrative", // Required field from old schema
    is_editable: body.isEditable !== undefined ? body.isEditable : true, // Required field from old schema
  };
  
  // Only include dependencies if it's not empty (to use default from DB)
  if (dependencies.length > 0) {
    insertData.dependencies = dependencies;
  }
  
  const { data: section, error: createError } = await supabase
    .from("template_sections")
    .insert(insertData)
    .select("*")
    .single();
  
  if (createError) {
    console.error("[POST /api/templates/[templateId]/sections] Error:", createError);
    return NextResponse.json(
      { error: createError.message || "Failed to create section" },
      { status: 500 }
    );
  }

  return NextResponse.json(section, { status: 201 });
}
