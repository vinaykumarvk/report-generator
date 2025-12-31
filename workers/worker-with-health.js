/**
 * Worker with HTTP Health Check and optional HTTP job trigger.
 */

require("dotenv").config();

const http = require("http");
const { processJobOnce, startPolling } = require("./worker-core");

const PORT = process.env.PORT || 8080;
const WORKER_ID = `worker-${Date.now()}`;

const triggerMode = String(process.env.JOB_TRIGGER_MODE || "db").toLowerCase();
const triggerSecret = String(process.env.WORKER_TRIGGER_SECRET || "");
const pollingEnabled = triggerMode !== "http" || process.env.WORKER_POLLING_ENABLED === "true";

if (pollingEnabled) {
  console.log("🚀 Starting worker polling loop...");
  startPolling({ workerId: WORKER_ID }).catch((err) => {
    console.error("❌ Fatal error in worker polling:", err);
    process.exit(1);
  });
} else {
  console.log("🚀 HTTP trigger mode enabled; polling is disabled.");
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

server.listen(PORT, () => {
  console.log(`✅ Health check server listening on port ${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("📥 Received SIGTERM, shutting down gracefully...");
  server.close(() => {
    console.log("✅ Health check server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("📥 Received SIGINT, shutting down gracefully...");
  server.close(() => {
    console.log("✅ Health check server closed");
    process.exit(0);
  });
});
