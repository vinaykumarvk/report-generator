import { NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";

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
  const { data: section, error: createError } = await supabase
    .from("template_sections")
    .insert({
      template_id: params.templateId,
      title: body.title,
      order: typeof body.order === "number" ? body.order : 1,
      purpose: body.purpose || null,
      output_format: body.outputFormat || "NARRATIVE",
      target_length_min: Number.isFinite(body.targetLengthMin)
        ? body.targetLengthMin
        : null,
      target_length_max: Number.isFinite(body.targetLengthMax)
        ? body.targetLengthMax
        : null,
      dependencies: Array.isArray(body.dependencies) ? body.dependencies : [],
      evidence_policy: body.evidencePolicy || null,
      vector_policy_json: body.vectorPolicyJson || null,
      web_policy_json: body.webPolicyJson || null,
      quality_gates_json: body.qualityGatesJson || null,
      prompt: body.prompt || null,
    })
    .select("*")
    .single();
  assertNoSupabaseError(createError, "Failed to create section");

  return NextResponse.json(section, { status: 201 });
}
