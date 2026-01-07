#!/usr/bin/env node
/**
 * Standalone script to run the reap_expired_jobs function
 * Can be called via cron or scheduled job
 */

require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "commonjs", moduleResolution: "node" },
});
require("tsconfig-paths/register");

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

const envPath =
  process.env.DOTENV_CONFIG_PATH ||
  (fs.existsSync(path.join(process.cwd(), ".env.local"))
    ? path.join(process.cwd(), ".env.local")
    : path.join(process.cwd(), ".env"));
dotenv.config({ path: envPath });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function runReaper() {
  console.log("🔧 Running expired jobs reaper...\n");

  const maxAgeMinutes = parseInt(process.env.REAPER_MAX_AGE_MINUTES || "60", 10);

  try {
    const { data, error } = await supabase.rpc("reap_expired_jobs", {
      max_age_minutes: maxAgeMinutes,
    });

    if (error) {
      console.error("❌ Error running reaper:", error);
      process.exit(1);
    }

    const result = Array.isArray(data) ? data[0] : data;
    console.log("✅ Reaper completed:");
    console.log(`   Jobs reclaimed: ${result.jobs_reclaimed || 0}`);
    console.log(`   Jobs failed: ${result.jobs_failed || 0}`);

    if (result.details && result.details.jobs) {
      const jobs = result.details.jobs;
      if (Array.isArray(jobs) && jobs.length > 0) {
        console.log("\n📋 Processed jobs:");
        jobs.forEach((job) => {
          console.log(
            `   - ${job.action}: ${job.type} (${job.job_id.substring(0, 8)}...)`
          );
        });
      }
    }

    console.log("\n✅ Reaper finished successfully");
  } catch (err) {
    console.error("❌ Fatal error:", err);
    process.exit(1);
  }
}

runReaper()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

