import { NextResponse } from "next/server";
import { ChangeDetector, DependencyTracker } from "@/dependency-tracker";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { runId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: run, error } = await supabase
    .from("report_runs")
    .select("id")
    .eq("id", params.runId)
    .single();
  if (error || !run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  const body = await request.json();
  const changes = body?.changes || {};
  const { data: dependencySnapshot, error: depError } = await supabase
    .from("dependency_snapshots")
    .select("*")
    .eq("report_run_id", params.runId)
    .single();
  if (depError || !dependencySnapshot) {
    return NextResponse.json(
      { error: "No dependency snapshot found for run." },
      { status: 400 }
    );
  }

  const tracker = new DependencyTracker();
  tracker.setBlueprintSnapshot(
    ((dependencySnapshot.blueprint_assumptions as any[]) || []).map(
      (text: string, idx: number) => ({
        id: `assumption-${idx}`,
        text,
      })
    )
  );
  Object.entries((dependencySnapshot.section_outputs as Record<string, unknown>) || {}).forEach(
    ([sectionId, outputFingerprint]) => {
      tracker.recordSectionDependency({
        sectionId,
        blueprintAssumptionIds: [],
        retrievalQueries:
          ((dependencySnapshot.retrieval_queries_by_section as Record<
            string,
            string[]
          >) || {})[sectionId] || [],
        dependsOnSections: [],
        outputFingerprint: String(outputFingerprint || ""),
      });
    }
  );

  const detector = new ChangeDetector(tracker);
  const result = detector.detectChanges({
    blueprint: (changes.blueprintAssumptions || []).map(
      (text: string, idx: number) => ({
        id: `assumption-${idx}`,
        text,
      })
    ),
    retrievalQueriesBySection: changes.retrievalQueriesBySection || {},
    sectionOutputs: changes.sectionOutputs || {},
  });

  const impacted = Array.from(result.impactedSections) as string[];
  if (impacted.length > 0) {
    const { data: sectionRuns } = await supabase
      .from("section_runs")
      .select("id, template_section_id")
      .eq("report_run_id", params.runId);
    const impactedRunIds =
      (sectionRuns || [])
        .filter((runItem: any) => impacted.includes(runItem.template_section_id))
        .map((runItem: any) => runItem.id) || [];

    if (impactedRunIds.length > 0) {
      const { error: artifactError } = await supabase
        .from("section_artifacts")
        .delete()
        .in("section_run_id", impactedRunIds);
      assertNoSupabaseError(artifactError, "Failed to clear artifacts");
      const { error: evidenceError } = await supabase
        .from("evidence_bundles")
        .delete()
        .in("section_run_id", impactedRunIds);
      assertNoSupabaseError(evidenceError, "Failed to clear evidence bundles");
      const { error: scoreError } = await supabase
        .from("section_scores")
        .delete()
        .in("section_run_id", impactedRunIds);
      assertNoSupabaseError(scoreError, "Failed to clear section scores");
      const { error: updateError } = await supabase
        .from("section_runs")
        .update({ status: "QUEUED", attempt_count: 0 })
        .in("id", impactedRunIds);
      assertNoSupabaseError(updateError, "Failed to reset section runs");
    }
  }

  return NextResponse.json({
    impactedSections: impacted,
    reasonsBySection: Object.fromEntries(result.reasonsBySection),
  });
}
