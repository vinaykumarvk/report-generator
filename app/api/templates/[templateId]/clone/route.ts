import { NextResponse } from "next/server";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";

export const runtime = "nodejs";

/**
 * POST /api/templates/:templateId/clone
 * Clones a template with all its sections
 * Returns the newly created template
 */
export async function POST(
  request: Request,
  { params }: { params: { templateId: string } }
) {
  try {
    const { templateId } = params;
    const body = await request.json().catch(() => ({}));
    const newName = body.name;

    if (!newName || typeof newName !== "string" || !newName.trim()) {
      return NextResponse.json(
        { error: "New template name is required" },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();
    const workspaceId = await getDefaultWorkspaceId();

    // 1. Fetch the original template with all its sections
    const { data: originalTemplate, error: fetchError } = await supabase
      .from("templates")
      .select(
        `
        *,
        sections:template_sections(*)
      `
      )
      .eq("id", templateId)
      .single();

    if (fetchError || !originalTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // 2. Create the new template (clone objective fields)
    const newTemplate = {
      workspace_id: workspaceId,
      name: newName.trim(),
      description: originalTemplate.description,
      audience: originalTemplate.audience,
      tone: originalTemplate.tone,
      domain: originalTemplate.domain,
      jurisdiction: originalTemplate.jurisdiction,
      formats: originalTemplate.formats || [],
      status: "DRAFT", // Always start as draft
      version_number: 1, // Reset version
      default_vector_store_ids: originalTemplate.default_vector_store_ids || [],
      history_json: {
        clonedFrom: {
          templateId: originalTemplate.id,
          templateName: originalTemplate.name,
          clonedAt: new Date().toISOString(),
        },
      },
    };

    const { data: createdTemplate, error: createError } = await supabase
      .from("templates")
      .insert(newTemplate)
      .select()
      .single();

    assertNoSupabaseError(createError, "Failed to create cloned template");
    if (!createdTemplate) {
      return NextResponse.json(
        { error: "Failed to create cloned template" },
        { status: 500 }
      );
    }

    // 3. Clone all sections
    const sections: any[] = Array.isArray(originalTemplate.sections)
      ? originalTemplate.sections
      : [];
    const clonedSections = [];

    for (const section of sections) {
      const newSection = {
        template_id: createdTemplate.id,
        title: section.title,
        purpose: section.purpose,
        order: section.order,
        output_format: section.output_format,
        target_length_min: section.target_length_min,
        target_length_max: section.target_length_max,
        dependencies: section.dependencies || [],
        evidence_policy: section.evidence_policy,
        vector_policy_json: section.vector_policy_json,
        web_policy_json: section.web_policy_json,
        quality_gates_json: section.quality_gates_json,
        status: "DRAFT", // Reset section status to draft
        prompt: section.prompt,
      };

      const { data: createdSection, error: sectionError } = await supabase
        .from("template_sections")
        .insert(newSection)
        .select()
        .single();

      assertNoSupabaseError(sectionError, `Failed to clone section: ${section.title}`);
      clonedSections.push(createdSection);
    }

    // 4. Log the clone operation in audit logs (if table exists)
    try {
      await supabase.from("audit_logs").insert({
        workspace_id: workspaceId,
        action: "TEMPLATE_CLONED",
        entity_type: "template",
        entity_id: createdTemplate.id,
        details: {
          originalTemplateId: originalTemplate.id,
          originalTemplateName: originalTemplate.name,
          newTemplateName: newName,
          sectionCount: clonedSections.length,
        },
        created_at: new Date().toISOString(),
      });
    } catch (auditError) {
      // Audit logging is optional, don't fail the request
      console.warn("Failed to log clone operation:", auditError);
    }

    // 5. Return the new template with sections
    return NextResponse.json({
      template: {
        ...createdTemplate,
        sections: clonedSections,
      },
      message: `Template "${originalTemplate.name}" successfully cloned as "${newName}"`,
      clonedSectionCount: clonedSections.length,
    });
  } catch (error: any) {
    console.error("Failed to clone template:", error);
    return NextResponse.json(
      { error: error.message || "Failed to clone template" },
      { status: 500 }
    );
  }
}



