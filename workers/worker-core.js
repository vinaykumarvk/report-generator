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

  // Update run status
  await updateRun(run.id, {
    status: "RUNNING",
    startedAt: new Date().toISOString(),
  });

  // Enqueue blueprint generation job
  await enqueueJob({
    type: "GENERATE_BLUEPRINT",
    payloadJson: {},
    runId: run.id,
    workspaceId: run.workspaceId ?? null,
  });
}

async function handleGenerateBlueprint(job) {
  const { generateReportBlueprint } = require("../src/lib/blueprintGenerator");
  
  const run = await getRunById(job.runId);
  if (!run) throw new Error("Run not found");
  const template = run.templateSnapshot;
  if (!template) throw new Error("Template snapshot missing");

  console.log("📋 Generating report blueprint...");
  
  // Generate the cohesion blueprint
  const cohesionBlueprint = await generateReportBlueprint({
    templateName: template.name || "Report",
    templateDescription: template.description,
    sections: (template.sections || []).map(s => ({
      id: s.id,
      title: s.title,
      purpose: s.purpose
    })),
    userInput: run.inputJson || {},
    context: run.contextJson || {}
  });

  // Also generate the technical blueprint (for dependencies)
  const technicalBlueprint = buildBlueprint(template);

  // Store both blueprints
  await updateRun(run.id, {
    blueprintJson: {
      technical: technicalBlueprint,
      cohesion: cohesionBlueprint
    }
  });

  await addRunEvent(run.id, run.workspaceId, "BLUEPRINT_CREATED", { 
    technical: technicalBlueprint,
    cohesion: cohesionBlueprint
  });

  console.log("✅ Blueprint generated");

  // Enqueue section generation jobs (parallel) - exclude Executive Summary
  const sectionRuns = await listSectionRuns(run.id);
  for (const sectionRun of sectionRuns) {
    // Skip Executive Summary - it will be generated last
    if (sectionRun.title && sectionRun.title.toLowerCase().includes("executive summary")) {
      console.log(`  ⏭️  Skipping "${sectionRun.title}" (will generate after assembly)`);
      continue;
    }
    
    await enqueueJob({
      type: "RUN_SECTION",
      payloadJson: { cohesionBlueprint },
      runId: run.id,
      sectionRunId: sectionRun.id,
      workspaceId: run.workspaceId ?? null,
    });
  }
}

async function handleRunSection(job) {
  const { formatBlueprintForSection } = require("../src/lib/blueprintGenerator");
  
  const run = await getRunById(job.runId);
  if (!run) throw new Error("Run not found");
  const template = run.templateSnapshot;
  if (!template) throw new Error("Template snapshot missing");
  const sectionRun = await getSectionRunById(job.sectionRunId);
  if (!sectionRun) throw new Error("Section run not found");
  const section = template.sections.find((item) => item.id === sectionRun.templateSectionId);
  if (!section) throw new Error("Section missing in template snapshot");

  const connectors = await listConnectors();
  
  // Get cohesion blueprint from job payload or run
  const cohesionBlueprint = job.payloadJson?.cohesionBlueprint || 
                            (run.blueprintJson && run.blueprintJson.cohesion);
  
  // Format blueprint guidance for this specific section
  let blueprintGuidance = "";
  if (cohesionBlueprint && section.id) {
    try {
      blueprintGuidance = formatBlueprintForSection(cohesionBlueprint, section.id);
    } catch (err) {
      console.warn("Failed to format blueprint for section:", err);
    }
  }
  
  // Track timing
  const startTime = Date.now();
  const updatedSectionRun = await runSection({
    sectionRun: { ...sectionRun, artifacts: [] },
    section,
    template,
    connectors,
    profile: run.profileSnapshot,
    runInput: run.inputJson || {},
    promptSet: run.promptSetSnapshot || null,
    blueprintGuidance, // Pass blueprint guidance to section generation
  });
  const endTime = Date.now();
  const durationMs = endTime - startTime;
  
  await updateSectionRun(updatedSectionRun.id, {
    status: updatedSectionRun.status,
    attemptCount: updatedSectionRun.attemptCount,
    timingsJson: {
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      durationMs,
      durationSeconds: Math.round(durationMs / 1000),
    },
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
  // Check if all non-executive-summary sections are done
  const allNonExecDone = all.every((item) => {
    const isExecSummary = item.title && item.title.toLowerCase().includes("executive summary");
    return isExecSummary || item.status === "COMPLETED";
  });
  
  if (allNonExecDone) {
    const existingAssemble = await hasAssembleJob(run.id);
    if (!existingAssemble) {
      await enqueueJob({
        type: "GENERATE_TRANSITIONS",
        payloadJson: {},
        runId: run.id,
        workspaceId: run.workspaceId ?? null,
      });
    }
  }
}

async function handleGenerateTransitions(job) {
  const { generateAllTransitions } = require("../src/lib/transitionsGenerator");
  
  const run = await getRunById(job.runId);
  if (!run) throw new Error("Run not found");
  
  console.log("🔗 Generating section transitions...");
  
  const sectionRuns = await listSectionRunsWithArtifacts(run.id);
  
  // Filter out executive summary and get section content
  const sectionsForTransitions = sectionRuns
    .filter(sr => {
      const isExecSummary = sr.title && sr.title.toLowerCase().includes("executive summary");
      return !isExecSummary && sr.status === "COMPLETED";
    })
    .map(sr => {
      const finalArtifact = (sr.artifacts || []).find(a => a.type === "FINAL");
      return {
        id: sr.id,
        title: sr.title || "Untitled",
        content: typeof finalArtifact?.content === "string" ? finalArtifact.content : ""
      };
    });

  // Get tone and terminology from blueprint
  const cohesionBlueprint = run.blueprintJson && run.blueprintJson.cohesion;
  const options = {};
  if (cohesionBlueprint) {
    options.tone = cohesionBlueprint.tone ? 
      `${cohesionBlueprint.tone.perspective}, formality ${cohesionBlueprint.tone.formality}/5` : 
      undefined;
    options.keyTerminology = cohesionBlueprint.keyTerminology;
  }

  const transitions = await generateAllTransitions(sectionsForTransitions, options);
  
  // Store transitions in run
  await updateRun(run.id, {
    transitionsJson: transitions
  });

  await addRunEvent(run.id, run.workspaceId, "TRANSITIONS_GENERATED", {
    count: transitions.length
  });

  console.log("✅ Transitions generated");

  // Now enqueue executive summary generation
  await enqueueJob({
    type: "GENERATE_EXEC_SUMMARY",
    payloadJson: {},
    runId: run.id,
    workspaceId: run.workspaceId ?? null,
  });
}

async function handleGenerateExecSummary(job) {
  const { generateHierarchicalExecutiveSummary } = require("../src/lib/executiveSummaryGenerator");
  
  const run = await getRunById(job.runId);
  if (!run) throw new Error("Run not found");
  
  console.log("📊 Generating executive summary...");
  
  const sectionRuns = await listSectionRunsWithArtifacts(run.id);
  
  // Filter out executive summary section and get content
  const sectionsForSummary = sectionRuns
    .filter(sr => {
      const isExecSummary = sr.title && sr.title.toLowerCase().includes("executive summary");
      return !isExecSummary && sr.status === "COMPLETED";
    })
    .map(sr => {
      const finalArtifact = (sr.artifacts || []).find(a => a.type === "FINAL");
      return {
        id: sr.id,
        title: sr.title || "Untitled",
        content: typeof finalArtifact?.content === "string" ? finalArtifact.content : ""
      };
    });

  const executiveSummaryContent = await generateHierarchicalExecutiveSummary(sectionsForSummary);
  
  // Find the executive summary section run
  const execSummarySectionRun = sectionRuns.find(sr => 
    sr.title && sr.title.toLowerCase().includes("executive summary")
  );

  if (execSummarySectionRun) {
    // Update the executive summary section with generated content
    await updateSectionRun(execSummarySectionRun.id, {
      status: "COMPLETED",
      attemptCount: 1
    });

    await replaceSectionArtifacts(execSummarySectionRun.id, [
      {
        type: "FINAL",
        content: executiveSummaryContent
      }
    ]);

    await addRunEvent(run.id, run.workspaceId, "EXEC_SUMMARY_GENERATED", {
      sectionRunId: execSummarySectionRun.id
    });
  }

  console.log("✅ Executive summary generated");

  // Now enqueue assembly
  await enqueueJob({
    type: "ASSEMBLE",
    payloadJson: {},
    runId: run.id,
    workspaceId: run.workspaceId ?? null,
  });
}

async function handleAssemble(job) {
  const { assembleReportWithTransitions } = require("../src/lib/transitionsGenerator");
  
  const run = await getRunById(job.runId);
  if (!run) throw new Error("Run not found");
  const template = run.templateSnapshot;
  if (!template) throw new Error("Template snapshot missing");
  
  console.log("📄 Assembling final report...");
  
  let sectionRuns = await listSectionRunsWithArtifacts(run.id);
  
  // Get sections in order with content
  const orderedSections = (template.sections || [])
    .map(templateSection => {
      const sectionRun = sectionRuns.find(sr => sr.templateSectionId === templateSection.id);
      if (!sectionRun) return null;
      
      const finalArtifact = (sectionRun.artifacts || []).find(a => a.type === "FINAL");
      return {
        id: sectionRun.id,
        title: sectionRun.title || templateSection.title || "Untitled",
        content: typeof finalArtifact?.content === "string" ? finalArtifact.content : ""
      };
    })
    .filter(Boolean);

  // Get transitions
  const transitions = run.transitionsJson || [];
  
  // Assemble report with transitions
  const finalReport = assembleReportWithTransitions(orderedSections, transitions);
  
  await updateRun(run.id, {
    status: "COMPLETED",
    completedAt: new Date().toISOString(),
    finalReportJson: {
      content: finalReport,
      sections: orderedSections,
      transitions: transitions
    }
  });
  
  // Create dependency snapshot
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
  const blueprintJson = run.blueprintJson || {};
  const technicalBlueprint = blueprintJson.technical || run.blueprint || {};
  const dependencySnapshot = {
    templateId: template.id,
    blueprintAssumptions: (technicalBlueprint && technicalBlueprint.assumptions) || [],
    retrievalQueriesBySection: Object.fromEntries(
      template.sections.map((section) => [section.id, [section.title]])
    ),
    sectionOutputs,
  };
  await upsertDependencySnapshot(run.id, dependencySnapshot);
  await addRunEvent(run.id, run.workspaceId, "RUN_COMPLETED", {});
  
  console.log("✅ Report assembly complete");
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
  if (job.type === "GENERATE_BLUEPRINT") return handleGenerateBlueprint(job);
  if (job.type === "RUN_SECTION") return handleRunSection(job);
  if (job.type === "GENERATE_TRANSITIONS") return handleGenerateTransitions(job);
  if (job.type === "GENERATE_EXEC_SUMMARY") return handleGenerateExecSummary(job);
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
