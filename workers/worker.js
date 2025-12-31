require("dotenv").config();

const { startPolling } = require("./worker-core");

const WORKER_ID = `worker-${Date.now()}`;

console.log(`🚀 Worker ${WORKER_ID} initialized`);

startPolling({ workerId: WORKER_ID }).catch((err) => {
  console.error("❌ Fatal error in worker:", err);
  process.exit(1);
});
