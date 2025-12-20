const express = require('express');
const { enqueueSection, enqueueBlueprint, resumeQueues, sectionQueue } = require('./queue');
const { createReportRun, STATUSES } = require('./models');
const { generateBlueprint, runSectionPipeline, normalizeSections, assembleReport } = require('./pipeline');

// In-memory store for simplicity
const state = {
  runs: new Map(),
};

function createServer(services) {
  const app = express();
  app.use(express.json());

  app.post('/runs', async (req, res) => {
    const { templateId, title, profile, sections } = req.body;
    const run = createReportRun({ templateId, title, profile, sections });
    state.runs.set(run.id, run);
    await enqueueBlueprint(run.id);
    res.status(201).json({ runId: run.id });
  });

  app.get('/runs/:id', (req, res) => {
    const run = state.runs.get(req.params.id);
    if (!run) return res.status(404).send('Not found');
    res.json(run);
  });

  app.get('/runs/:id/stream', (req, res) => {
    const run = state.runs.get(req.params.id);
    if (!run) return res.status(404).send('Not found');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const interval = setInterval(() => {
      const latest = state.runs.get(req.params.id);
      res.write(`data: ${JSON.stringify(latest)}\n\n`);
      if (latest.status === STATUSES.COMPLETED || latest.status === STATUSES.FAILED) {
        clearInterval(interval);
        res.end();
      }
    }, 1000);

    req.on('close', () => clearInterval(interval));
  });

  app.post('/runs/:id/retry', async (req, res) => {
    const run = state.runs.get(req.params.id);
    if (!run) return res.status(404).send('Not found');

    for (const section of run.sections.filter((s) => s.status === STATUSES.FAILED)) {
      section.status = STATUSES.PENDING;
      await enqueueSection(section, run);
    }

    res.json({ ok: true });
  });

  app.get('/runs/:id/artifacts/:sectionId', (req, res) => {
    const run = state.runs.get(req.params.id);
    if (!run) return res.status(404).send('Not found');
    const section = run.sections.find((s) => s.id === req.params.sectionId);
    if (!section) return res.status(404).send('Section not found');
    res.json(section.artifacts);
  });

  // Queue processors
  resumeQueues({
    blueprintProcessor: async (job) => {
      const run = state.runs.get(job.data.runId);
      if (!run) return;
      run.status = STATUSES.PLANNING;
      run.blueprint = await generateBlueprint(run, services);
      run.status = STATUSES.RETRIEVING;

      // enqueue sections respecting dependencies
      for (const section of run.sections) {
        await enqueueSection(section, run);
      }
    },
    sectionProcessor: async (job) => {
      const { section, runId } = job.data;
      const run = state.runs.get(runId);
      if (!run) return;
      try {
        await runSectionPipeline(section, run, services);
        // check if dependencies allow more jobs to enqueue
        const pendingSections = run.sections.filter((s) => s.status === STATUSES.PENDING);
        for (const pending of pendingSections) {
          await enqueueSection(pending, run);
        }

        // update run status
        if (run.sections.every((s) => s.status === STATUSES.COMPLETED)) {
          run.status = STATUSES.VERIFYING;
          const normalized = await normalizeSections(run.sections, services);
          const assembled = await assembleReport(run, normalized, services);
          run.artifacts.push({ id: 'final', content: assembled });
          run.status = STATUSES.COMPLETED;
        }
      } catch (err) {
        section.status = STATUSES.FAILED;
        section.error = err.message;
        run.status = STATUSES.FAILED;
      }
    },
  });

  return app;
}

module.exports = { createServer, state };
