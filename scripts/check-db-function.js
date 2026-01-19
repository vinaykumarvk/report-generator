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

async function checkFunction() {
  const supabase = supabaseAdmin();
  
  // Check if function exists by querying pg_proc
  const { data: functions, error } = await supabase.rpc("exec_sql", {
    sql: `
      SELECT 
        p.proname as function_name,
        pg_get_function_arguments(p.oid) as arguments,
        pg_get_function_result(p.oid) as return_type
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname = 'claim_next_job'
      ORDER BY p.oid;
    `
  }).catch(async () => {
    // If exec_sql doesn't exist, try direct query
    const { data, error } = await supabase
      .from("_realtime")
      .select("*")
      .limit(0);
    return { data: null, error: { message: "Cannot query pg_proc directly" } };
  });
  
  // Try to call the function with correct parameters
  console.log("🔍 Testing claim_next_job function...\n");
  
  try {
    const { data, error } = await supabase.rpc("claim_next_job", {
      worker_id: "test-worker",
      lease_seconds: 300,
    });
    
    if (error) {
      console.log("❌ Function call failed:");
      console.log(`   Error: ${error.message}`);
      console.log(`   Code: ${error.code}`);
      console.log(`   Details: ${error.details || 'N/A'}`);
      console.log(`   Hint: ${error.hint || 'N/A'}`);
    } else {
      console.log("✅ Function exists and can be called");
      console.log(`   Returned: ${data ? (Array.isArray(data) ? `${data.length} rows` : '1 row') : 'null'}`);
    }
  } catch (err) {
    console.log("❌ Exception calling function:");
    console.log(`   ${err.message}`);
  }
  
  // Check what the code expects
  console.log("\n📋 Code expects:");
  console.log("   Function: claim_next_job(worker_id TEXT, lease_seconds INTEGER)");
  console.log("   Returns: TABLE with job columns");
  
  // Check if there are any QUEUED jobs
  const { data: queuedJobs, error: jobsError } = await supabase
    .from("jobs")
    .select("id, type, status, priority")
    .eq("status", "QUEUED")
    .limit(5);
  
  if (!jobsError && queuedJobs) {
    console.log(`\n📦 Found ${queuedJobs.length} QUEUED job(s):`);
    queuedJobs.forEach(job => {
      console.log(`   - ${job.id}: ${job.type} (priority: ${job.priority})`);
    });
  }
}

checkFunction().then(() => {
  process.exit(0);
}).catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
