# Generation + Export Test Cases

These cases cover report generation and export flows end to end, including error handling.

## Generation (Run lifecycle)

1) **Create run → jobs created**
   - API: `POST /api/report-runs` with valid template ID.
   - Expect: `report_runs.status=QUEUED`, `jobs.type=START_RUN` queued.
   - Verify: DB rows created.

2) **Run completes with sections**
   - Worker running.
   - Expect: section runs `COMPLETED`, run `RUNNING → COMPLETED`.
   - Verify: `section_runs.status=COMPLETED`, `run_events` includes `RUN_COMPLETED`.

3) **Exec summary generated after sections**
   - Expect: `jobs.type=GENERATE_EXEC_SUMMARY` runs after transitions.
   - Verify: exec summary section has `FINAL` artifact and `EXEC_SUMMARY_GENERATED` event.

4) **Failure transitions run to FAILED**
   - Inject failure (invalid OpenAI key).
   - Expect: job fails after max attempts; run status becomes `FAILED`.
   - Verify: `jobs.status=FAILED`, `report_runs.status=FAILED`.

5) **Stale lock reaper (manual)**
   - Simulate expired lock: set `jobs.status=RUNNING`, `lock_expires_at < now()`.
   - Run: `node scripts/reap-stale-jobs.js`.
   - Expect: job re-queued.

## Export

1) **Export request creates export + job**
   - API: `POST /api/report-runs/:runId/export` with format `PDF`.
   - Expect: `exports.status=QUEUED`, `jobs.type=EXPORT`.

2) **Worker export upload**
   - Expect: `exports.status=READY`, `storage_url` set, `file_size` and `checksum` set.
   - Verify in DB.

3) **Download redirects**
   - `GET /api/report-runs/:runId/exports/:exportId`
   - Expect: 302 redirect to `storage_url`.

4) **Export failure path**
   - Force failure in export (e.g., invalid Supabase storage).
   - Expect: `exports.status=FAILED`, `error_message` populated.

5) **Markdown fallback**
   - Delete local file, keep export record.
   - For MARKDOWN: endpoint should generate on the fly.

## UI

1) **Download buttons**
   - Start export; status changes from “Generating…” to “Downloaded”.
   - Verify Refresh updates list.

2) **Failure surfaced**
   - Failed export shows error text in UI.

## Notes

- Cloud Tasks / HTTP trigger should result in immediate job execution without polling.
- Use `scripts/check-run-status.js <runId>` and worker logs to validate state.
