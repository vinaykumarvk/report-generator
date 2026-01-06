-- Requeue stale RUNNING jobs whose lock has expired.
update jobs
set status = 'QUEUED',
    locked_by = null,
    locked_at = null,
    lock_expires_at = null,
    last_error = 'Reaped stale lock',
    scheduled_at = now(),
    updated_at = now()
where status = 'RUNNING'
  and lock_expires_at is not null
  and lock_expires_at < now();
