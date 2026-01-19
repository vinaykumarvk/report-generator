#!/usr/bin/env node
/**
 * CI/Deploy Database Verification Script
 * 
 * This script verifies that all required database functions exist and are callable
 * before deploying or starting the worker. It should be run as part of the CI/CD pipeline.
 * 
 * Usage:
 *   node scripts/ci-verify-db.js
 * 
 * Exit codes:
 *   0 - All functions verified successfully
 *   1 - One or more functions are missing or misconfigured
 * 
 * Environment variables:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
 */

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

const { supabaseAdmin } = require("../src/lib/supabaseAdmin");

// Required database functions with their test parameters
const REQUIRED_FUNCTIONS = [
  {
    name: "claim_next_job",
    description: "Claims the next available job from the queue",
    params: { worker_id: "ci-verify", lease_seconds: 1 },
    critical: true, // Worker cannot function without this
  },
  // Add more functions as needed
];

async function verifyFunction(supabase, func) {
  const startTime = Date.now();
  
  try {
    const { data, error } = await supabase.rpc(func.name, func.params);
    const duration = Date.now() - startTime;
    
    if (error) {
      return {
        name: func.name,
        status: "FAILED",
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        duration,
        critical: func.critical,
      };
    }
    
    return {
      name: func.name,
      status: "PASSED",
      returned: data ? (Array.isArray(data) ? `${data.length} rows` : "1 row") : "null",
      duration,
      critical: func.critical,
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    return {
      name: func.name,
      status: "ERROR",
      error: err instanceof Error ? err.message : String(err),
      duration,
      critical: func.critical,
    };
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  CI/Deploy Database Verification");
  console.log("═══════════════════════════════════════════════════════════════\n");
  
  // Check environment
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    console.error("❌ SUPABASE_URL is not set");
    process.exit(1);
  }
  
  try {
    const hostname = new URL(supabaseUrl).hostname;
    console.log(`📡 Target: ${hostname}\n`);
  } catch {
    console.log(`📡 Target: ${supabaseUrl}\n`);
  }
  
  const supabase = supabaseAdmin();
  const results = [];
  
  console.log("Verifying required database functions:\n");
  
  for (const func of REQUIRED_FUNCTIONS) {
    process.stdout.write(`  ${func.name}... `);
    const result = await verifyFunction(supabase, func);
    results.push(result);
    
    if (result.status === "PASSED") {
      console.log(`✅ PASSED (${result.duration}ms)`);
    } else {
      console.log(`❌ ${result.status}`);
      console.log(`     Error: ${result.error}`);
      if (result.code) console.log(`     Code: ${result.code}`);
      if (result.hint) console.log(`     Hint: ${result.hint}`);
    }
  }
  
  console.log("\n───────────────────────────────────────────────────────────────");
  
  const passed = results.filter(r => r.status === "PASSED").length;
  const failed = results.filter(r => r.status !== "PASSED").length;
  const criticalFailed = results.filter(r => r.status !== "PASSED" && r.critical).length;
  
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log("\n❌ VERIFICATION FAILED\n");
    
    if (criticalFailed > 0) {
      console.log("⚠️  CRITICAL functions are missing. The worker CANNOT process jobs.");
      console.log("   Deploy will be blocked to prevent jobs from queueing forever.\n");
    }
    
    console.log("To fix missing functions, run:");
    console.log("  node scripts/run-schema-migration.js scripts/fix-claim-next-job-comprehensive-clean.sql\n");
    
    console.log("═══════════════════════════════════════════════════════════════");
    process.exit(1);
  }
  
  console.log("\n✅ ALL FUNCTIONS VERIFIED - Safe to deploy\n");
  console.log("═══════════════════════════════════════════════════════════════");
  process.exit(0);
}

main().catch(err => {
  console.error("\n❌ Unexpected error:", err);
  process.exit(1);
});
