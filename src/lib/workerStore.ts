import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";

type RunRecord = {
  id: string;
  workspaceId: string | null;
  templateSnapshot: any | null;
  profileSnapshot: any | null;
  promptSetSnapshot: any | null;
  inputJson: Record<string, unknown>;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  blueprint: any | null;
  finalReport: any | null;
};

type SectionRunRecord = {
  id: string;
  runId: string;
  templateSectionId: string;
  title: string | null;
  status: string;
  attemptCount: number;
  artifacts: Array<{
    id: string;
    type: string;
    content: unknown;
    createdAt: string;
  }>;
};

function mapSectionSnapshot(raw: any) {
  return {
    id: raw.id,
    title: raw.title,
    purpose: raw.purpose ?? "",
    order: raw.order ?? 1,
    outputFormat: raw.output_format ?? raw.outputFormat ?? "NARRATIVE",
    evidencePolicy: raw.evidence_policy ?? raw.evidencePolicy ?? "LLM_ONLY",
    targetLengthMin: raw.target_length_min ?? raw.targetLengthMin ?? 0,
    targetLengthMax: raw.target_length_max ?? raw.targetLengthMax ?? 0,
    dependencies: raw.dependencies ?? [],
    vectorPolicyJson: raw.vector_policy_json ?? raw.vectorPolicyJson ?? null,
    webPolicyJson: raw.web_policy_json ?? raw.webPolicyJson ?? null,
    qualityGatesJson: raw.quality_gates_json ?? raw.qualityGatesJson ?? null,
    prompt: raw.prompt ?? "",
  };
}

function mapTemplateSnapshot(raw: any) {
  if (!raw) return null;
  const sections = raw.sections || raw.template_sections || [];
  return {
    id: raw.id,
    name: raw.name,
    defaultVectorStoreIds:
      raw.default_vector_store_ids ?? raw.defaultVectorStoreIds ?? [],
    sections: sections.map(mapSectionSnapshot),
  };
}

function mapProfileSnapshot(raw: any) {
  if (!raw) return null;
  return {
    id: raw.id,
    name: raw.name,
    toggles: raw.toggles ?? {},
    stageConfig: raw.stage_config ?? raw.stageConfig ?? {},
  };
}

function mapPromptSetSnapshot(raw: any) {
  if (!raw) return null;
  return {
    id: raw.id,
    globalPrompts: raw.globalPrompts ?? raw.global_prompts ?? {},
    sections: raw.sections ?? raw.sections_json ?? [],
  };
}

function mapRun(raw: any): RunRecord {
  return {
    id: raw.id,
    workspaceId: raw.workspace_id ?? null,
    templateSnapshot: mapTemplateSnapshot(raw.template_version_snapshot_json),
    profileSnapshot: mapProfileSnapshot(raw.profile_snapshot),
    promptSetSnapshot: mapPromptSetSnapshot(raw.prompt_set_snapshot),
    inputJson: raw.input_json ?? {},
    status: raw.status,
    startedAt: raw.started_at ?? null,
    completedAt: raw.completed_at ?? null,
    blueprint: raw.blueprint_json ?? null,
    finalReport: raw.final_report_json ?? null,
  };
}

function mapSectionRun(raw: any): SectionRunRecord {
  const artifacts = Array.isArray(raw.section_artifacts)
    ? raw.section_artifacts.map((artifact: any) => ({
        id: artifact.id,
        type: artifact.type,
        content:
          artifact.content_json ??
          artifact.content_markdown ??
          artifact.provenance_json ??
          null,
        createdAt: artifact.created_at,
      }))
    : [];
  return {
    id: raw.id,
    runId: raw.report_run_id,
    templateSectionId: raw.template_section_id,
    title: raw.title,
    status: raw.status,
    attemptCount: raw.attempt_count ?? 0,
    artifacts,
  };
}

export async function getRunById(runId: string): Promise<RunRecord> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("report_runs")
    .select("*")
    .eq("id", runId)
    .single();
  assertNoSupabaseError(error, "Failed to load run");
  return mapRun(data);
}

export async function updateRun(
  runId: string,
  updates: {
    status?: string;
    startedAt?: string | null;
    completedAt?: string | null;
    blueprint?: unknown | null;
    finalReport?: unknown | null;
  }
) {
  const supabase = supabaseAdmin();
  const payload: Record<string, unknown> = {};
  if (updates.status) payload.status = updates.status;
  if (updates.startedAt !== undefined) payload.started_at = updates.startedAt;
  if (updates.completedAt !== undefined) payload.completed_at = updates.completedAt;
  if (updates.blueprint !== undefined) payload.blueprint_json = updates.blueprint;
  if (updates.finalReport !== undefined) payload.final_report_json = updates.finalReport;
  const { error } = await supabase.from("report_runs").update(payload).eq("id", runId);
  assertNoSupabaseError(error, "Failed to update run");
}

export async function listSectionRuns(runId: string): Promise<SectionRunRecord[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("section_runs")
    .select("*")
    .eq("report_run_id", runId)
    .order("created_at", { ascending: true });
  assertNoSupabaseError(error, "Failed to load section runs");
  return (data || []).map((row) => ({
    id: String(row.id),
    runId: String(row.report_run_id),
    templateSectionId: String(row.template_section_id),
    title: String(row.title ?? ""),
    status: String(row.status ?? ""),
    attemptCount: Number(row.attempt_count ?? 0),
    artifacts: [],
  }));
}

export async function getSectionRunById(sectionRunId: string): Promise<SectionRunRecord | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("section_runs")
    .select("*")
    .eq("id", sectionRunId)
    .single();
  if (error) return null;
  return {
    id: String(data.id),
    runId: String(data.report_run_id),
    templateSectionId: String(data.template_section_id),
    title: String(data.title ?? ""),
    status: String(data.status ?? ""),
    attemptCount: Number(data.attempt_count ?? 0),
    artifacts: [],
  };
}

export async function listSectionRunsWithArtifacts(
  runId: string
): Promise<SectionRunRecord[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("section_runs")
    .select("*, section_artifacts(*)")
    .eq("report_run_id", runId)
    .order("created_at", { ascending: true });
  assertNoSupabaseError(error, "Failed to load section runs with artifacts");
  return (data || []).map(mapSectionRun);
}

export async function updateSectionRun(
  sectionRunId: string,
  updates: { status?: string; attemptCount?: number }
) {
  const supabase = supabaseAdmin();
  const payload: Record<string, unknown> = {};
  if (updates.status) payload.status = updates.status;
  if (updates.attemptCount !== undefined) payload.attempt_count = updates.attemptCount;
  const { error } = await supabase
    .from("section_runs")
    .update(payload)
    .eq("id", sectionRunId);
  assertNoSupabaseError(error, "Failed to update section run");
}

export async function replaceSectionArtifacts(
  sectionRunId: string,
  artifacts: Array<{ type: string; content: unknown }>
) {
  const supabase = supabaseAdmin();
  const { error: deleteError } = await supabase
    .from("section_artifacts")
    .delete()
    .eq("section_run_id", sectionRunId);
  assertNoSupabaseError(deleteError, "Failed to clear section artifacts");
  if (!artifacts.length) return;
  const { error } = await supabase.from("section_artifacts").insert(
    artifacts.map((artifact) => ({
      section_run_id: sectionRunId,
      type: artifact.type,
      content_json: artifact.content,
      content_markdown:
        typeof artifact.content === "string" ? artifact.content : null,
    }))
  );
  assertNoSupabaseError(error, "Failed to insert section artifacts");
}

export async function listConnectors() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("connectors").select("*");
  assertNoSupabaseError(error, "Failed to load connectors");
  return (data || []).map((row) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    configJson: row.config_json || {},
  }));
}

export async function addRunEvent(
  runId: string,
  workspaceId: string | null,
  type: string,
  payload: Record<string, unknown>
) {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("run_events").insert({
    run_id: runId,
    workspace_id: workspaceId,
    type,
    payload_json: payload,
  });
  assertNoSupabaseError(error, "Failed to write run event");
}

export async function addAuditLog(
  workspaceId: string | null,
  actionType: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown>
) {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("audit_logs").insert({
    workspace_id: workspaceId,
    action_type: actionType,
    target_type: targetType,
    target_id: targetId,
    details_json: details,
  });
  assertNoSupabaseError(error, "Failed to write audit log");
}

export async function upsertScore(
  runId: string,
  sectionRunId: string,
  score: { coverage: number; diversity: number; recency: number; redundancy: number }
) {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("section_scores").upsert(
    {
      report_run_id: runId,
      section_run_id: sectionRunId,
      coverage: score.coverage,
      diversity: score.diversity,
      recency: score.recency,
      redundancy: score.redundancy,
    },
    { onConflict: "report_run_id,section_run_id" }
  );
  assertNoSupabaseError(error, "Failed to upsert section score");
}

export async function upsertDependencySnapshot(
  runId: string,
  snapshot: {
    blueprintAssumptions: unknown;
    retrievalQueriesBySection: unknown;
    sectionOutputs: unknown;
  }
) {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("dependency_snapshots").upsert(
    {
      report_run_id: runId,
      blueprint_assumptions: snapshot.blueprintAssumptions,
      retrieval_queries_by_section: snapshot.retrievalQueriesBySection,
      section_outputs: snapshot.sectionOutputs,
    },
    { onConflict: "report_run_id" }
  );
  assertNoSupabaseError(error, "Failed to upsert dependency snapshot");
}

export async function createExport(
  runId: string,
  workspaceId: string | null,
  exportRecord: { format: string; filePath: string }
) {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("exports").insert({
    report_run_id: runId,
    workspace_id: workspaceId,
    format: exportRecord.format,
    file_path: exportRecord.filePath,
  });
  assertNoSupabaseError(error, "Failed to create export");
}

export async function hasAssembleJob(runId: string): Promise<boolean> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("jobs")
    .select("id,status")
    .eq("run_id", runId)
    .eq("type", "ASSEMBLE")
    .in("status", ["QUEUED", "RUNNING", "COMPLETED"])
    .limit(1);
  assertNoSupabaseError(error, "Failed to check assemble job");
  return (data || []).length > 0;
}
