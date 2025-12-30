import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type SectionOutput = {
  id: string;
  title: string | null;
  status: string | null;
  finalMarkdown: string;
};

function normalizeFinalMarkdown(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  
  // If it's an object, try to extract markdown content
  if (typeof value === "object") {
    const obj = value as any;
    
    // Check common markdown field names
    if (obj.markdown && typeof obj.markdown === "string") return obj.markdown;
    if (obj.content && typeof obj.content === "string") return obj.content;
    if (obj.text && typeof obj.text === "string") return obj.text;
    if (obj.finalMarkdown && typeof obj.finalMarkdown === "string") return obj.finalMarkdown;
    
    // If it's an array, join the items
    if (Array.isArray(obj)) {
      return obj.map(item => normalizeFinalMarkdown(item)).join("\n\n");
    }
  }
  
  // Otherwise, stringify it
  return JSON.stringify(value, null, 2);
}

export async function GET(
  _request: Request,
  { params }: { params: { runId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: run, error } = (await supabase
    .from("report_runs")
    .select("*")
    .eq("id", params.runId)
    .single()) as { data: any; error: any };
  if (error || !run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const { data: sectionRuns } = (await supabase
    .from("section_runs")
    .select("*, section_artifacts(*)")
    .eq("report_run_id", params.runId)
    .order("created_at", { ascending: true })) as { data: any; error: any };

  const sections: SectionOutput[] = (sectionRuns || []).map((section: any) => {
    const artifacts = Array.isArray(section.section_artifacts)
      ? section.section_artifacts
      : [];
    const finalArtifact = artifacts.find((artifact: any) => artifact.type === "FINAL");
    const content =
      finalArtifact?.content_markdown ??
      finalArtifact?.content_json ??
      finalArtifact?.provenance_json ??
      "";
    return {
      id: section.id,
      title: section.title,
      status: section.status,
      finalMarkdown: normalizeFinalMarkdown(content),
    };
  });

  let combinedMarkdown = normalizeFinalMarkdown(run.final_report_json);
  if (!combinedMarkdown) {
    const combinedSections = sections
      .map((section) => {
        const title = section.title || "Untitled Section";
        return `## ${title}\n\n${section.finalMarkdown || ""}`;
      })
      .join("\n\n");
    combinedMarkdown = `# Report\n\n${combinedSections}`.trim();
  }

  return NextResponse.json({
    runId: run.id,
    status: run.status,
    combinedMarkdown,
    sections,
  });
}
