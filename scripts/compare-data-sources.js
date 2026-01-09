require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const pgDumpPath = path.join(__dirname, '../../EKGproduct/pg_dump.sql');

(async () => {
  console.log('📊 Comparing Data Sources: pg_dump.sql vs Report Run Snapshots\n');
  console.log('='.repeat(70));
  
  // Get pg_dump.sql timestamp
  let pgDumpTime = null;
  if (fs.existsSync(pgDumpPath)) {
    const stats = fs.statSync(pgDumpPath);
    pgDumpTime = stats.mtime;
    console.log(`📁 pg_dump.sql:`);
    console.log(`   File modified: ${pgDumpTime.toISOString()}`);
    console.log(`   File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  } else {
    console.log(`❌ pg_dump.sql not found at: ${pgDumpPath}`);
  }
  
  // Get report run snapshot timestamps
  console.log(`\n📅 Report Run Snapshots:`);
  const { data: runs, error } = await supabase
    .from('report_runs')
    .select('id, template_id, created_at, updated_at, started_at, completed_at, template_version_snapshot_json')
    .not('template_version_snapshot_json', 'is', null)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (runs && runs.length > 0) {
    const dates = runs.map(r => new Date(r.created_at)).sort((a, b) => b - a);
    const latest = dates[0];
    const oldest = dates[dates.length - 1];
    
    console.log(`   Total runs with snapshots: ${runs.length}`);
    console.log(`   Latest snapshot: ${latest.toISOString()}`);
    console.log(`   Oldest snapshot: ${oldest.toISOString()}`);
    console.log(`   Time span: ${Math.round((latest - oldest) / (1000 * 60 * 60 * 24))} days`);
    
    // Count sections
    const sectionsByTemplate = {};
    runs.forEach(run => {
      const templateId = run.template_id;
      const sections = run.template_version_snapshot_json?.sections || [];
      if (!sectionsByTemplate[templateId]) {
        sectionsByTemplate[templateId] = {
          count: 0,
          latestRun: null,
          latestDate: null
        };
      }
      sectionsByTemplate[templateId].count += sections.length;
      const runDate = new Date(run.created_at);
      if (!sectionsByTemplate[templateId].latestDate || runDate > sectionsByTemplate[templateId].latestDate) {
        sectionsByTemplate[templateId].latestDate = runDate;
        sectionsByTemplate[templateId].latestRun = run.id;
      }
    });
    
    console.log(`\n📋 Sections by Template (from snapshots):`);
    Object.entries(sectionsByTemplate).forEach(([templateId, data]) => {
      console.log(`   Template ${templateId}: ${data.count} sections (latest: ${data.latestDate.toISOString()})`);
    });
  } else {
    console.log(`   No report runs with snapshots found`);
  }
  
  // Compare timestamps
  console.log(`\n` + '='.repeat(70));
  if (pgDumpTime && runs && runs.length > 0) {
    const latestSnapshot = new Date(runs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at);
    console.log(`\n🕐 Timestamp Comparison:\n`);
    console.log(`   pg_dump.sql:        ${pgDumpTime.toISOString()}`);
    console.log(`   Latest snapshot:    ${latestSnapshot.toISOString()}`);
    
    const diffMs = latestSnapshot - pgDumpTime;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    
    if (diffMs > 0) {
      console.log(`\n   ✅ Snapshots are ${diffDays} days (${diffHours} hours) NEWER than pg_dump.sql`);
      console.log(`   → Use snapshots for recovery (more recent data)`);
    } else if (diffMs < 0) {
      console.log(`\n   ⚠️  pg_dump.sql is ${Math.abs(diffDays)} days (${Math.abs(diffHours)} hours) NEWER than snapshots`);
      console.log(`   → Consider using pg_dump.sql data`);
    } else {
      console.log(`\n   ⚖️  Timestamps are very close`);
    }
  }
  
  console.log(`\n` + '='.repeat(70));
})();
