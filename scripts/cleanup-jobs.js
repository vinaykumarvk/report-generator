#!/usr/bin/env node

/**
 * Cleanup stuck jobs in the database
 * Usage: node scripts/cleanup-jobs.js [--all] [--status=QUEUED]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupJobs() {
  console.log('🧹 Cleaning up stuck jobs...');
  console.log('');

  // Get command line arguments
  const args = process.argv.slice(2);
  const deleteAll = args.includes('--all');
  const statusArg = args.find(arg => arg.startsWith('--status='));
  const targetStatus = statusArg ? statusArg.split('=')[1] : 'QUEUED';

  try {
    // First, show current jobs
    console.log('📊 Current jobs in database:');
    console.log('');

    const { data: allJobs, error: listError } = await supabase
      .from('jobs')
      .select('id, type, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (listError) {
      console.error('❌ Error fetching jobs:', listError.message);
      process.exit(1);
    }

    if (!allJobs || allJobs.length === 0) {
      console.log('✅ No jobs found in database');
      process.exit(0);
    }

    // Display jobs
    console.log('┌────────────────────────────────────────┬──────────────┬─────────────┬─────────────────────┐');
    console.log('│ Job ID                                 │ Type         │ Status      │ Created At          │');
    console.log('├────────────────────────────────────────┼──────────────┼─────────────┼─────────────────────┤');
    
    allJobs.forEach(job => {
      const id = job.id.substring(0, 36).padEnd(38);
      const type = (job.type || '').substring(0, 12).padEnd(12);
      const status = (job.status || '').substring(0, 11).padEnd(11);
      const created = new Date(job.created_at).toLocaleString().substring(0, 19).padEnd(19);
      console.log(`│ ${id} │ ${type} │ ${status} │ ${created} │`);
    });
    
    console.log('└────────────────────────────────────────┴──────────────┴─────────────┴─────────────────────┘');
    console.log('');

    // Count jobs by status
    const statusCounts = allJobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});

    console.log('Status summary:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    console.log('');

    // Determine which jobs to delete
    let jobsToDelete;
    if (deleteAll) {
      jobsToDelete = allJobs;
      console.log(`⚠️  Deleting ALL ${jobsToDelete.length} jobs...`);
    } else {
      jobsToDelete = allJobs.filter(job => job.status === targetStatus);
      console.log(`⚠️  Deleting ${jobsToDelete.length} jobs with status: ${targetStatus}`);
    }

    if (jobsToDelete.length === 0) {
      console.log(`✅ No jobs to delete with status: ${targetStatus}`);
      process.exit(0);
    }

    console.log('');
    console.log('Jobs to be deleted:');
    jobsToDelete.forEach(job => {
      console.log(`  - ${job.id} (${job.type}, ${job.status})`);
    });
    console.log('');

    // Ask for confirmation if not in CI/automated mode
    if (!process.env.CI && process.stdin.isTTY) {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        readline.question('Continue? (y/n) ', resolve);
      });
      readline.close();

      if (answer.toLowerCase() !== 'y') {
        console.log('❌ Cancelled');
        process.exit(0);
      }
    }

    // Delete jobs
    console.log('');
    console.log('🗑️  Deleting jobs...');
    
    const jobIds = jobsToDelete.map(job => job.id);
    const { error: deleteError } = await supabase
      .from('jobs')
      .delete()
      .in('id', jobIds);

    if (deleteError) {
      console.error('❌ Error deleting jobs:', deleteError.message);
      process.exit(1);
    }

    console.log('');
    console.log(`✅ Successfully deleted ${jobsToDelete.length} job(s)`);
    console.log('');

    // Show remaining jobs
    const { data: remainingJobs } = await supabase
      .from('jobs')
      .select('id, type, status')
      .order('created_at', { ascending: false })
      .limit(10);

    if (remainingJobs && remainingJobs.length > 0) {
      console.log('📊 Remaining jobs:');
      remainingJobs.forEach(job => {
        console.log(`  - ${job.id.substring(0, 8)}... (${job.type}, ${job.status})`);
      });
    } else {
      console.log('✅ No remaining jobs in database');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Show usage if --help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('');
  console.log('🧹 Cleanup Jobs Script');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/cleanup-jobs.js                 # Delete QUEUED jobs (default)');
  console.log('  node scripts/cleanup-jobs.js --status=FAILED # Delete FAILED jobs');
  console.log('  node scripts/cleanup-jobs.js --all           # Delete ALL jobs');
  console.log('');
  console.log('Options:');
  console.log('  --status=STATUS   Delete jobs with specific status (default: QUEUED)');
  console.log('  --all             Delete all jobs regardless of status');
  console.log('  --help, -h        Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/cleanup-jobs.js');
  console.log('  node scripts/cleanup-jobs.js --status=IN_PROGRESS');
  console.log('  node scripts/cleanup-jobs.js --all');
  console.log('');
  process.exit(0);
}

cleanupJobs();

