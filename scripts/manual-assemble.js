require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "commonjs", moduleResolution: "node" },
});
require("tsconfig-paths/register");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

const envPath =
  process.env.DOTENV_CONFIG_PATH ||
  (fs.existsSync(path.join(process.cwd(), ".env.local"))
    ? path.join(process.cwd(), ".env.local")
    : path.join(process.cwd(), ".env"));
dotenv.config({ path: envPath });

const { getRunById, updateRun, listSectionRunsWithArtifacts, addRunEvent, upsertDependencySnapshot } = require("../src/lib/workerStore");
const crypto = require("crypto");

async function manualAssemble(runId) {
  try {
    console.log(`🔍 Loading run ${runId}...`);
    
    const run = await getRunById(runId);
    if (!run) {
      throw new Error("Run not found");
    }
    
    const template = run.templateSnapshot;
    if (!template) {
      throw new Error("Template snapshot missing");
    }
    
    console.log(`📋 Template: ${template.name}`);
    console.log(`📊 Run status: ${run.status}`);
    
    let sectionRuns = await listSectionRunsWithArtifacts(runId);
    console.log(`📄 Found ${sectionRuns.length} section runs`);
    
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
    
    console.log(`✅ Assembling ${orderedSections.length} sections...`);
    
    // Assemble report
    const finalReport = orderedSections
      .map(section => {
        const title = section.title ? `# ${section.title}\n\n` : '';
        return title + section.content;
      })
      .join('\n\n---\n\n')
      .trim();
    
    console.log(`📝 Final report length: ${finalReport.length} characters`);
    
    // Update run
    await updateRun(runId, {
      status: "COMPLETED",
      completedAt: new Date().toISOString(),
      finalReport: {
        content: finalReport,
        sections: orderedSections
      }
    });
    
    console.log("✅ Run status updated to COMPLETED");
    
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
    const blueprintJson = run.blueprint || {};
    const technicalBlueprint = blueprintJson.technical || {};
    const dependencySnapshot = {
      templateId: template.id,
      blueprintAssumptions: (technicalBlueprint && technicalBlueprint.assumptions) || [],
      retrievalQueriesBySection: Object.fromEntries(
        template.sections.map((section) => [section.id, [section.title]])
      ),
      sectionOutputs,
    };
    await upsertDependencySnapshot(runId, dependencySnapshot);
    
    await addRunEvent(runId, run.workspaceId, "RUN_COMPLETED", {});
    
    console.log("✅ Report assembly complete!");
    console.log(`\n🎉 The final report is now available. Refresh the run details page to see it.`);
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

const runId = process.argv[2];
if (!runId) {
  console.error("Usage: node scripts/manual-assemble.js <runId>");
  process.exit(1);
}

manualAssemble(runId).then(() => {
  console.log("✅ Done");
  process.exit(0);
}).catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
