alter table exports
  add column if not exists status text not null default 'QUEUED',
  add column if not exists storage_url text,
  add column if not exists file_size bigint,
  add column if not exists checksum text,
  add column if not exists error_message text,
  add column if not exists updated_at timestamptz not null default now();

alter table exports
  alter column file_path drop not null;

update exports
  set status = 'READY',
      updated_at = now()
where status = 'QUEUED'
  and file_path is not null;
