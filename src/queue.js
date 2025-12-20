const { Queue, Worker, QueueScheduler } = require('bullmq');
const IORedis = require('ioredis');
const { STATUSES } = require('./models');

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

const SECTION_QUEUE = 'section-jobs';
const BLUEPRINT_QUEUE = 'blueprint-jobs';

const sectionQueue = new Queue(SECTION_QUEUE, { connection });
const blueprintQueue = new Queue(BLUEPRINT_QUEUE, { connection });
new QueueScheduler(SECTION_QUEUE, { connection });
new QueueScheduler(BLUEPRINT_QUEUE, { connection });

async function enqueueBlueprint(runId) {
  await blueprintQueue.add('blueprint', { runId });
}

async function enqueueSection(section, run) {
  const { dependencies } = section;
  const jobId = section.id;

  // Only enqueue when dependencies are satisfied
  if (dependencies && dependencies.length > 0) {
    const dependencyJobs = await Promise.all(
      dependencies.map((depId) => sectionQueue.getJob(depId))
    );
    const incompleteDeps = dependencyJobs.filter((job) => !job || job.finishedOn === null);
    if (incompleteDeps.length > 0) {
      // defer enqueue; caller should recheck later
      return false;
    }
  }

  await sectionQueue.add('section', { section, runId: run.id }, { jobId });
  return true;
}

function resumeQueues(processors) {
  const sectionWorker = new Worker(
    SECTION_QUEUE,
    processors.sectionProcessor,
    { connection }
  );
  const blueprintWorker = new Worker(
    BLUEPRINT_QUEUE,
    processors.blueprintProcessor,
    { connection }
  );

  return { sectionWorker, blueprintWorker };
}

module.exports = {
  sectionQueue,
  blueprintQueue,
  enqueueSection,
  enqueueBlueprint,
  resumeQueues,
};
