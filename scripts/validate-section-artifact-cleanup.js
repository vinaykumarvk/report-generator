#!/usr/bin/env node
/* eslint-disable no-console */
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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function getSectionRunId() {
  const argId = process.argv[2];
  if (argId) return argId;
  const { data, error } = await supabase
    .from("section_runs")
    .select("id")
    .limit(1);
  if (error || !data || data.length === 0) {
    throw new Error(error?.message || "No section_runs available to test.");
  }
  return data[0].id;
}

async function main() {
  const sectionRunId = await getSectionRunId();
  const { data: artifacts, error } = await supabase
    .from("section_artifacts")
    .select("id")
    .eq("section_run_id", sectionRunId)
    .limit(5);
  if (error) {
    throw new Error(error.message);
  }
  if (!artifacts || artifacts.length === 0) {
    console.warn("No artifacts found for section_run_id:", sectionRunId);
    return;
  }

  const insertedIds = artifacts.map((row) => row.id).filter(Boolean);
  const idList = `(${insertedIds.map((id) => `"${id}"`).join(",")})`;

  const { data: remaining, error: selectError } = await supabase
    .from("section_artifacts")
    .select("id")
    .eq("section_run_id", sectionRunId)
    .not("id", "in", idList)
    .limit(1);
  if (selectError) {
    throw new Error(selectError.message);
  }

  console.log("OK: .not('id','in', idList) accepted by Supabase client.");
  console.log("section_run_id:", sectionRunId);
  console.log("excluded_ids:", insertedIds);
  console.log("remaining_sample:", remaining && remaining[0] ? remaining[0].id : null);
}

main().catch((err) => {
  console.error("Validation failed:", err.message || err);
  process.exit(1);
});
