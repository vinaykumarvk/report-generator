import { spawn } from "child_process";
import { runReviewerPrompt } from "@/lib/openaiReviewer";
import { logger } from "@/lib/logger";

type ReviewerContext = {
  section_name?: string;
  verification_summary?: string;
};

function runPython(payload: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonBin = process.env.PYTHON_BIN || "python3";
    const proc = spawn(pythonBin, ["scripts/reviewer_adapter.py"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Reviewer adapter failed: ${stderr.trim()}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(err);
      }
    });

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

export async function runReviewerSimulation(context: ReviewerContext) {
  let prompt = "";
  try {
    const promptResult = await runPython({ mode: "prompt", context });
    prompt = promptResult.prompt || "";
  } catch (err) {
    logger.warn({ error: err, context }, "Failed to generate reviewer prompt, using fallback");
    prompt = `Checklist:\n- Review section\nRisk Flags:\n- None\nConfidence: 0.6`;
  }

  let output = "";
  try {
    output = await runReviewerPrompt(prompt);
  } catch (err) {
    logger.warn({ error: err, prompt }, "OpenAI reviewer request failed, using fallback");
    output = "Checklist:\n- Review skipped (OpenAI error)\nRisk Flags:\n- Reviewer not available\nConfidence: 0.5";
  }

  try {
    const parsed = await runPython({ mode: "parse", output });
    return { prompt, output, parsed };
  } catch (err) {
    logger.warn({ error: err, output }, "Failed to parse reviewer output, using fallback");
    return { prompt, output, parsed: { checklist: [], risk_flags: [], confidence: null } };
  }
}
