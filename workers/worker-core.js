require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "commonjs", moduleResolution: "node" },
});
require("tsconfig-paths/register");
require("dotenv").config();

const {
  enqueueJob,
  claimNextJob,
  claimJobById,
  completeJob,
  failJob,
  heartbeat,
} = require("../src/lib/dbqueue");
const {
  buildBlueprint,
  runSection,
  assembleFinalReport,
  synthesizeExecutiveSummary,
} = require("../src/lib/runEngine");
const { writeMarkdownExport } = require("../src/lib/exporter");
const {
  getRunById,
  updateRun,
  listSectionRuns,
  listSectionRunsWithArtifacts,
  getSectionRunById,
  updateSectionRun,
  replaceSectionArtifacts,
  listConnectors,
  addRunEvent,
  addAuditLog,
  upsertScore,
  upsertDependencySnapshot,
  createExport,
  hasAssembleJob,
} = require("../src/lib/workerStore");
const crypto = require("crypto");

const HEARTBEAT_INTERVAL_MS = 60000;
const DEFAULT_POLL_INTERVAL_MS = 1000;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleStartRun(job) {
  const run = await getRunById(job.runId);
  if (!run) throw new Error("Run not found");
  const template = run.templateSnapshot;
  if (!template) throw new Error("Template snapshot missing");

  const blueprint = buildBlueprint(template);
  await updateRun(run.id, {
    status: "RUNNING",
    startedAt: new Date().toISOString(),
    blueprint,
  });
  await addRunEvent(run.id, run.workspaceId, "BLUEPRINT_CREATED", { blueprint });

  const sectionRuns = await listSectionRuns(run.id);
  for (const sectionRun of sectionRuns) {
    await enqueueJob({
      type: "RUN_SECTION",
      payloadJson: {},
      runId: run.id,
      sectionRunId: sectionRun.id,
      workspaceId: run.workspaceId ?? null,
    });
  }
}

async function handleRunSection(job) {
  const run = await getRunById(job.runId);
  if (!run) throw new Error("Run not found");
  const template = run.templateSnapshot;
  if (!template) throw new Error("Template snapshot missing");
  const sectionRun = await getSectionRunById(job.sectionRunId);
  if (!sectionRun) throw new Error("Section run not found");
  const section = template.sections.find((item) => item.id === sectionRun.templateSectionId);
  if (!section) throw new Error("Section missing in template snapshot");

  const connectors = await listConnectors();
  const updatedSectionRun = await runSection({
    sectionRun: { ...sectionRun, artifacts: [] },
    section,
    template,
    connectors,
    profile: run.profileSnapshot,
    runInput: run.inputJson || {},
    promptSet: run.promptSetSnapshot || null,
  });
  await updateSectionRun(updatedSectionRun.id, {
    status: updatedSectionRun.status,
    attemptCount: updatedSectionRun.attemptCount,
  });
  await replaceSectionArtifacts(updatedSectionRun.id, updatedSectionRun.artifacts || []);
  await addRunEvent(run.id, run.workspaceId, "SECTION_STATUS", {
    sectionRunId: updatedSectionRun.id,
    status: updatedSectionRun.status,
  });
  const provenance = updatedSectionRun.artifacts?.find(
    (artifact) => artifact.type === "PROVENANCE"
  );
  if (provenance) {
    await addAuditLog(run.workspaceId, "CLAIM_PROVENANCE_CAPTURED", "SectionRun", updatedSectionRun.id, {
      claimCount: Array.isArray(provenance.content) ? provenance.content.length : 0,
    });
  }

  const scores = updatedSectionRun.artifacts?.find((artifact) => artifact.type === "SCORES");
  if (scores) {
    await upsertScore(run.id, updatedSectionRun.id, scores.content);
  }

  const all = await listSectionRuns(run.id);
  const allDone = all.every((item) => item.status === "COMPLETED");
  if (allDone) {
    const existingAssemble = await hasAssembleJob(run.id);
    if (!existingAssemble) {
      await enqueueJob({
        type: "ASSEMBLE",
        payloadJson: {},
        runId: run.id,
        workspaceId: run.workspaceId ?? null,
      });
    }
  }
}

async function handleAssemble(job) {
  const run = await getRunById(job.runId);
  if (!run) throw new Error("Run not found");
  const template = run.templateSnapshot;
  if (!template) throw new Error("Template snapshot missing");
  let sectionRuns = await listSectionRunsWithArtifacts(run.id);
  const execSummary = synthesizeExecutiveSummary(template, sectionRuns);
  if (execSummary) {
    sectionRuns = sectionRuns.map((runItem) =>
      runItem.id === execSummary.id ? execSummary : runItem
    );
    await updateSectionRun(execSummary.id, {
      status: execSummary.status,
      attemptCount: execSummary.attemptCount,
    });
    await replaceSectionArtifacts(execSummary.id, execSummary.artifacts || []);
    await addRunEvent(run.id, run.workspaceId, "EXEC_SUMMARY_SYNTHESIZED", {
      sectionRunId: execSummary.id,
    });
  }
  const finalReport = assembleFinalReport(template, sectionRuns);
  await updateRun(run.id, {
    status: "COMPLETED",
    completedAt: new Date().toISOString(),
    finalReport,
  });
  const outputFingerprint = (value) =>
    value ? crypto.createHash("sha1").update(value).digest("hex") : "";
  const sectionOutputs = Object.fromEntries(
    sectionRuns.map((sectionRun) => {
      const finalArtifact = (sectionRun.artifacts || []).find(
        (artifact) => artifact.type === "FINAL"
      );
      const content =
        typeof finalArtifact?.content === "string" ? finalArtifact.content : "";
      return [sectionRun.templateSectionId, outputFingerprint(content)];
    })
  );
  const dependencySnapshot = {
    templateId: template.id,
    blueprintAssumptions: (run.blueprint && run.blueprint.assumptions) || [],
    retrievalQueriesBySection: Object.fromEntries(
      template.sections.map((section) => [section.id, [section.title]])
    ),
    sectionOutputs,
  };
  await upsertDependencySnapshot(run.id, dependencySnapshot);
  await addRunEvent(run.id, run.workspaceId, "RUN_COMPLETED", {});
}

async function handleExport(job) {
  const run = await getRunById(job.runId);
  if (!run) throw new Error("Run not found");
  const format = job.payloadJson?.format || "MARKDOWN";
  const sectionRuns = await listSectionRunsWithArtifacts(run.id);
  const sources = [];
  sectionRuns.forEach((sectionRun) => {
    const evidence = (sectionRun.artifacts || []).find(
      (artifact) => artifact.type === "EVIDENCE"
    );
    if (!evidence) return;
    (evidence.content || []).forEach((item) => {
      if (item.kind === "web" && item.metadata?.url) {
        sources.push(item.metadata.url);
      }
    });
  });
  const uniqueSources = Array.from(new Set(sources));
  if (format === "MARKDOWN") {
    const exportRecord = writeMarkdownExport(
      {
        id: run.id,
        templateSnapshot: run.templateSnapshot,
        finalReport: run.finalReport,
      },
      { sourcesAppendix: uniqueSources }
    );
    await createExport(run.id, run.workspaceId, exportRecord);
    await addRunEvent(run.id, run.workspaceId, "EXPORT_READY", {
      exportId: exportRecord.id,
      format: exportRecord.format,
    });
    return;
  }
  if (format === "DOCX") {
    const { writeDocxExport } = require("../src/lib/docxExport");
    const exportRecord = await writeDocxExport(
      {
        id: run.id,
        templateSnapshot: run.templateSnapshot,
        finalReport: run.finalReport,
      },
      { sourcesAppendix: uniqueSources }
    );
    await createExport(run.id, run.workspaceId, exportRecord);
    await addRunEvent(run.id, run.workspaceId, "EXPORT_READY", {
      exportId: exportRecord.id,
      format: exportRecord.format,
    });
    return;
  }
  if (format === "PDF") {
    const { writePdfExport } = require("../src/lib/pdfExport");
    const exportRecord = await writePdfExport(
      {
        id: run.id,
        templateSnapshot: run.templateSnapshot,
        finalReport: run.finalReport,
      },
      { sourcesAppendix: uniqueSources }
    );
    await createExport(run.id, run.workspaceId, exportRecord);
    await addRunEvent(run.id, run.workspaceId, "EXPORT_READY", {
      exportId: exportRecord.id,
      format: exportRecord.format,
    });
    return;
  }
  throw new Error(`Unsupported export format: ${format}`);
}

async function handleJob(job) {
  if (job.type === "START_RUN") return handleStartRun(job);
  if (job.type === "RUN_SECTION") return handleRunSection(job);
  if (job.type === "ASSEMBLE") return handleAssemble(job);
  if (job.type === "EXPORT") return handleExport(job);
  throw new Error(`Unknown job type: ${job.type}`);
}

async function processJob(job) {
  const heartbeatTimer = setInterval(() => {
    void heartbeat(job);
  }, HEARTBEAT_INTERVAL_MS);

  try {
    await handleJob(job);
    await completeJob(job);
    return { status: "completed", jobId: job.id, type: job.type };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ Job failed: ${job.id}`, message);
    await failJob(job, message || "Job failed");
    return { status: "failed", jobId: job.id, type: job.type, error: message };
  } finally {
    clearInterval(heartbeatTimer);
  }
}

async function processJobOnce({ workerId, jobId }) {
  const job = jobId ? await claimJobById(jobId, workerId) : await claimNextJob(workerId);
  if (!job) {
    return { status: "no_job" };
  }

  console.log(`✅ Claimed job: ${job.id} (${job.type})`);
  return processJob(job);
}

async function startPolling({ workerId }) {
  console.log(`🔄 Worker ${workerId} starting polling loop...`);
  let pollCount = 0;
  const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS || DEFAULT_POLL_INTERVAL_MS);

  while (true) {
    try {
      const job = await claimNextJob(workerId);
      if (!job) {
        pollCount++;
        if (pollCount % 60 === 0) {
          console.log(`⏳ Polled ${pollCount} times, no jobs found. Still waiting...`);
        }
        await sleep(pollIntervalMs);
        continue;
      }

      console.log(`✅ Claimed job: ${job.id} (${job.type})`);
      pollCount = 0;

      await processJob(job);
      console.log(`✅ Job processed: ${job.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("❌ Error in polling loop:", message);
      await sleep(5000);
    }
  }
}

module.exports = {
  processJobOnce,
  startPolling,
};
