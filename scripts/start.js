const { spawn } = require("child_process");

const mode = (process.env.SERVICE_MODE || "web").toLowerCase();
const command =
  mode === "worker"
    ? { cmd: "node", args: ["workers/worker.js"] }
    : { cmd: "next", args: ["start"] };

const child = spawn(command.cmd, command.args, { stdio: "inherit" });

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
