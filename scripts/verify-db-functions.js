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

async function verifyFunctions() {
  const supabase = supabaseAdmin();
  
  console.log("🔍 Verifying required database functions...\n");
  
  const requiredFunctions = [
    {
      name: "claim_next_job",
      signature: "claim_next_job(worker_id TEXT, lease_seconds INTEGER)",
      testParams: { worker_id: "test-worker", lease_seconds: 300 },
    },
    {
      name: "claim_job_by_id",
      signature: "claim_job_by_id(job_id UUID, worker_id TEXT, lease_seconds INTEGER)",
      testParams: { job_id: "00000000-0000-0000-0000-000000000000", worker_id: "test-worker", lease_seconds: 300 },
      optional: true, // Not all deployments may have this
    },
  ];
  
  let allPassed = true;
  
  for (const func of requiredFunctions) {
    console.log(`Checking ${func.name}...`);
    
    try {
      const { data, error } = await supabase.rpc(func.name, func.testParams);
      
      if (error) {
        if (func.optional) {
          console.log(`  ⚠️  OPTIONAL (not found): ${error.message}`);
        } else {
          console.log(`  ❌ FAILED: ${error.message}`);
          console.log(`     Code: ${error.code || 'N/A'}`);
          console.log(`     Details: ${error.details || 'N/A'}`);
          console.log(`     Hint: ${error.hint || 'N/A'}`);
          allPassed = false;
        }
      } else {
        console.log(`  ✅ PASSED: Function exists and is callable`);
        console.log(`     Returned: ${data ? (Array.isArray(data) ? `${data.length} rows` : '1 row') : 'null'}`);
      }
    } catch (err) {
      console.log(`  ❌ EXCEPTION: ${err.message}`);
      allPassed = false;
    }
    
    console.log("");
  }
  
  if (!allPassed) {
    console.log("❌ Some required functions are missing or incorrect!");
    console.log("\n💡 To fix, run:");
    console.log("   node scripts/run-schema-migration.js scripts/fix-claim-next-job-comprehensive-clean.sql");
    process.exit(1);
  } else {
    console.log("✅ All required functions verified!");
    process.exit(0);
  }
}

verifyFunctions().catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
