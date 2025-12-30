import { NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  { params }: { params: { templateId: string; sectionId: string } }
) {
  const body = await request.json();
  const supabase = supabaseAdmin();
  const { data: existing, error: findError } = await supabase
    .from("template_sections")
    .select("*")
    .eq("id", params.sectionId)
    .eq("template_id", params.templateId)
    .single();

  if (findError || !existing) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("template_sections")
    .update({
      title: body.title ?? existing.title,
      order: typeof body.order === "number" ? body.order : existing.order,
      purpose: body.purpose ?? existing.purpose,
      output_format: body.outputFormat ?? existing.output_format,
      target_length_min: Number.isFinite(body.targetLengthMin)
        ? body.targetLengthMin
        : existing.target_length_min,
      target_length_max: Number.isFinite(body.targetLengthMax)
        ? body.targetLengthMax
        : existing.target_length_max,
      dependencies: Array.isArray(body.dependencies)
        ? body.dependencies
        : existing.dependencies,
      evidence_policy: body.evidencePolicy ?? existing.evidence_policy,
      vector_policy_json:
        body.vectorPolicyJson !== undefined
          ? body.vectorPolicyJson
          : existing.vector_policy_json,
      web_policy_json:
        body.webPolicyJson !== undefined
          ? body.webPolicyJson
          : existing.web_policy_json,
      quality_gates_json:
        body.qualityGatesJson !== undefined
          ? body.qualityGatesJson
          : existing.quality_gates_json,
      prompt: body.prompt ?? existing.prompt,
    })
    .eq("id", params.sectionId)
    .select("*")
    .single();
  assertNoSupabaseError(updateError, "Failed to update section");

  return NextResponse.json(updated);
}
