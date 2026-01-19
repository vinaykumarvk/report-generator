# Root Cause Analysis: Assembly Process Failure

## Run ID
`0902c141-ac6b-4f54-8964-afb866c9677f`

## Timeline

1. **Jan 16, 08:54** - All 10 sections completed successfully
2. **Jan 18, 13:56** - Blueprint generation completed (after retry)
3. **Jan 18, 13:56-14:25** - 9 RUN_SECTION jobs were retried and ALL FAILED
4. **Jan 18, 14:25** - Run was marked as FAILED (due to failed retry jobs)
5. **Jan 19, 10:11** - GENERATE_EXEC_SUMMARY job completed (manually triggered)
6. **Jan 19, 13:52** - ASSEMBLE job was enqueued but never processed

## Root Cause Chain

### Primary Root Cause: Bug in `replaceSectionArtifacts` Function

**Location:** `src/lib/workerStore.ts:266`

**The Bug:**
```typescript
const idList = insertedIds.map((id: string) => `'${id}'`).join(",");
const { error: deleteError } = await supabase
  .from("section_artifacts")
  .delete()
  .eq("section_run_id", sectionRunId)
  .not("id", "in", `(${idList})`);  // ❌ INCORRECT SYNTAX
```

**Problem:**
- Supabase's `.not()` method doesn't accept SQL string syntax like `('id1','id2')`
- It expects an array: `.not("id", "in", insertedIds)`
- This causes the query to fail with "Supabase request failed"

### Secondary Root Cause: Failed Retries Marked Run as FAILED

**Location:** `workers/worker-core.js:779-783`

**The Problem:**
- When retry jobs fail after `maxAttempts`, the run is automatically marked as FAILED
- This happened even though the sections were already COMPLETED successfully
- The run being FAILED prevented ASSEMBLE from running

### Tertiary Root Cause: Retry Logic Retried Already-Completed Sections

**The Problem:**
- Sections completed successfully on Jan 16
- Something triggered retries on Jan 18 (possibly manual retry or recovery mechanism)
- The retry jobs attempted to regenerate already-completed sections
- The bug in `replaceSectionArtifacts` caused these retries to fail
- Failed retries caused the run to be marked as FAILED

## Impact

1. ✅ Sections were generated successfully (Jan 16)
2. ✅ Executive Summary was generated successfully (Jan 19)
3. ❌ Run was marked as FAILED (Jan 18)
4. ❌ ASSEMBLE job was never processed (because run was FAILED)
5. ❌ Final report was never assembled
6. ❌ Exports were unavailable

## Fix Required

1. **Fix `replaceSectionArtifacts` bug** - Use correct Supabase syntax
2. **Improve retry logic** - Don't retry already-completed sections
3. **Improve failure handling** - Don't mark run as FAILED if sections are already COMPLETED
4. **Add idempotency** - Check section status before attempting to save artifacts
