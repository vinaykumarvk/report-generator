/**
 * Worker with HTTP Health Check and optional HTTP job trigger.
 */

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const envPath =
  process.env.DOTENV_CONFIG_PATH ||
  (fs.existsSync(path.join(process.cwd(), ".env.local"))
    ? path.join(process.cwd(), ".env.local")
    : path.join(process.cwd(), ".env"));
dotenv.config({ path: envPath });

const http = require("http");
const { processJobOnce, startPolling } = require("./worker-core");

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const WORKER_ID = `worker-${Date.now()}`;

const triggerMode = String(process.env.JOB_TRIGGER_MODE || "db").toLowerCase();
const triggerSecret = String(process.env.WORKER_TRIGGER_SECRET || "");
const pollingEnabled =
  triggerMode === "db" || process.env.WORKER_POLLING_ENABLED === "true";
let isShuttingDown = false;

if ((triggerMode === "http" || triggerMode === "cloud-tasks" || triggerMode === "tasks") && !triggerSecret) {
  throw new Error("WORKER_TRIGGER_SECRET is required for HTTP/Cloud Tasks trigger modes.");
}

let pollingPromise;
if (pollingEnabled) {
  console.log("🚀 Starting worker polling loop...");
  pollingPromise = startPolling({ workerId: WORKER_ID, shouldStop: () => isShuttingDown }).catch((err) => {
    console.error("❌ Fatal error in worker polling:", err);
    process.exit(1);
  });
} else {
  console.log("🚀 HTTP trigger mode enabled; polling is disabled.");
}

/**
 * CRITICAL: Verify required database functions exist before starting worker.
 * This prevents jobs from silently queueing forever if functions are missing.
 */
async function verifyDatabaseFunctions() {
  console.log("🔍 Verifying required database functions...");
  
  const { supabaseAdmin } = require("../src/lib/supabaseAdmin");
  const supabase = supabaseAdmin();
  
  const requiredFunctions = [
    { name: "claim_next_job", params: { worker_id: "startup-check", lease_seconds: 1 } },
  ];
  
  const failures = [];
  
  for (const func of requiredFunctions) {
    try {
      const { error } = await supabase.rpc(func.name, func.params);
      if (error) {
        failures.push(`${func.name}: ${error.message}`);
      } else {
        console.log(`   ✅ ${func.name} - OK`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${func.name}: ${message}`);
    }
  }
  
  if (failures.length > 0) {
    console.error("\n❌ CRITICAL: Required database functions are missing or misconfigured!");
    console.error("   Worker cannot process jobs without these functions.\n");
    failures.forEach(f => console.error(`   - ${f}`));
    console.error("\n💡 To fix, run:");
    console.error("   node scripts/run-schema-migration.js scripts/fix-claim-next-job-comprehensive-clean.sql");
    console.error("\n⛔ Worker startup aborted to prevent jobs from queueing forever.");
    process.exit(1);
  }
  
  console.log("✅ All required database functions verified\n");
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

/**
 * Queue health check - detects jobs stuck in QUEUED status
 * Returns unhealthy if jobs have been QUEUED for too long
 */
async function checkQueueHealth() {
  const STUCK_THRESHOLD_MINUTES = parseInt(process.env.QUEUE_STUCK_THRESHOLD_MINUTES || "30", 10);
  
  try {
    const { supabaseAdmin } = require("../src/lib/supabaseAdmin");
    const supabase = supabaseAdmin();
    
    const thresholdTime = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString();
    
    // Count jobs stuck in QUEUED for too long
    const { data: stuckJobs, error } = await supabase
      .from("jobs")
      .select("id, type, created_at")
      .eq("status", "QUEUED")
      .lt("created_at", thresholdTime)
      .limit(100);
    
    if (error) {
      return { healthy: false, error: error.message, stuckJobs: [] };
    }
    
    // Count total queued jobs
    const { count: totalQueued } = await supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "QUEUED");
    
    // Count running jobs
    const { count: totalRunning } = await supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "RUNNING");
    
    const stuckCount = stuckJobs?.length || 0;
    const healthy = stuckCount === 0;
    
    return {
      healthy,
      totalQueued: totalQueued || 0,
      totalRunning: totalRunning || 0,
      stuckCount,
      stuckThresholdMinutes: STUCK_THRESHOLD_MINUTES,
      stuckJobs: (stuckJobs || []).slice(0, 10).map(j => ({
        id: j.id,
        type: j.type,
        queuedAt: j.created_at,
        stuckMinutes: Math.round((Date.now() - new Date(j.created_at).getTime()) / 60000),
      })),
    };
  } catch (err) {
    return { healthy: false, error: err instanceof Error ? err.message : String(err), stuckJobs: [] };
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "healthy",
        service: "report-generator-worker",
        triggerMode,
        pollingEnabled,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }
  
  // Queue health check endpoint - for monitoring/alerting
  if (req.url === "/queue-health") {
    const queueHealth = await checkQueueHealth();
    const statusCode = queueHealth.healthy ? 200 : 503;
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      ...queueHealth,
      service: "report-generator-worker",
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  if (req.url === "/process-job" && req.method === "POST") {
    if (triggerSecret) {
      const header = req.headers["x-worker-trigger"];
      if (header !== triggerSecret) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
    }

    try {
      const rawBody = await readRequestBody(req);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const jobId = payload.jobId || null;
      const result = await processJobOnce({ workerId: WORKER_ID, jobId });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, result }));
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: message }));
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, HOST, () => {
  console.log(`✅ Health check server listening on ${HOST}:${PORT}`);
});

// CRITICAL: Verify database functions before accepting any jobs
void verifyDatabaseFunctions();

async function handleShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`📥 Received ${signal}, initiating graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    console.log("⚠️  Shutdown timeout reached, forcing exit");
    process.exit(1);
  }, 30000);

  server.close(async () => {
    console.log("✅ Health check server closed");
    try {
      if (pollingPromise) {
        await pollingPromise;
      }
    } finally {
      clearTimeout(shutdownTimeout);
      process.exit(0);
    }
  });
}

process.on("SIGTERM", () => {
  void handleShutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void handleShutdown("SIGINT");
});
