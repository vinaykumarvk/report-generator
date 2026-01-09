# Export Root Cause Analysis

## Problem

Exports are getting stuck in `QUEUED` status and not being processed by workers.

## Root Cause

### Issue 1: Job Claiming Priority

The `claim_next_job` function has a two-phase approach:
1. **First**: Tries to reclaim expired RUNNING jobs (to handle stuck jobs)
2. **Second**: Only if no expired RUNNING jobs exist, claims QUEUED jobs

**Problem**: If there are many expired RUNNING jobs (or jobs that keep expiring), export jobs may never get claimed.

### Issue 2: Export Job Priority

Export jobs are created with default `priority: 100`, which is the same as section run jobs. This means:
- Export jobs compete equally with section run jobs
- If section runs are still processing, exports wait

### Issue 3: Export Jobs Created Before Run Completes

Export jobs can be created while the run is still `RUNNING`. The export handler checks:
```javascript
if (!finalReportContent) {
  throw new Error("No final report content available for export");
}
```

If the run hasn't completed yet, the export fails and gets retried, wasting attempts.

## Evidence

From investigation:
- ✅ Run `b8d2ea4a-ceb3-4db6-8420-3dbc98f034cc` is COMPLETED
- ✅ Has `final_report_json` with content (46879 chars)
- ❌ 2 export jobs stuck in QUEUED for 160s+
- ❌ Jobs are ready to claim (scheduled_at in past)
- ❌ Worker is running but not claiming export jobs

## Solutions

### Solution 1: Increase Export Job Priority (Quick Fix)

Give export jobs higher priority so they're processed first:

```sql
UPDATE jobs 
SET priority = 50  -- Higher priority (lower number = higher priority)
WHERE type = 'EXPORT' 
AND status = 'QUEUED';
```

### Solution 2: Check Run Status Before Creating Export Job

Only create export jobs when run is COMPLETED:

```typescript
// In export route
if (run.status !== 'COMPLETED') {
  return NextResponse.json(
    { error: "Run must be completed before exporting" },
    { status: 400 }
  );
}
```

### Solution 3: Separate Export Job Queue (Long-term)

Create a separate queue or worker pool for exports to avoid competition with section runs.

### Solution 4: Fix claim_next_job to Balance Priorities

Modify `claim_next_job` to alternate between reclaiming expired jobs and processing new QUEUED jobs, or use a weighted approach.

## Recommended Immediate Fix

1. **Increase export job priority** (Solution 1)
2. **Add run status check** (Solution 2)
3. **Manually claim stuck export jobs** to unblock them

## Files to Modify

1. `app/api/report-runs/[runId]/export/route.ts` - Add run status check
2. `app/api/report-runs/[runId]/export/route.ts` - Set higher priority for export jobs
3. `scripts/fix-claim-next-job-comprehensive.sql` - Consider priority balancing
