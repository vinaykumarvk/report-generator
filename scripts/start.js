const { spawn } = require("child_process");

const mode = (process.env.SERVICE_MODE || "web").toLowerCase();

// For worker mode, use worker-with-health.js which includes HTTP health check
// This is required for Cloud Run which expects services to listen on a port
const command =
  mode === "worker"
    ? { cmd: "node", args: ["workers/worker-with-health.js"] }
    : { cmd: "next", args: ["start"] };

console.log(`🚀 Starting in ${mode.toUpperCase()} mode...`);

const child = spawn(command.cmd, command.args, { stdio: "inherit" });

child.on("exit", (code) => {
  console.error(`Process exited with code ${code}`);
  process.exit(code ?? 0);
});
