create extension if not exists "pgcrypto";

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  name text not null,
  description text,
  audience text,
  tone text,
  domain text,
  jurisdiction text,
  status text not null default 'DRAFT',
  version_number int not null default 1,
  active_prompt_set_id uuid,
  default_vector_store_ids text[] not null default '{}',
  formats text[] not null default '{}',
  history_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists template_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  title text not null,
  purpose text,
  "order" int not null default 1,
  output_format text not null default 'NARRATIVE',
  target_length_min int,
  target_length_max int,
  dependencies text[] not null default '{}',
  evidence_policy text,
  vector_policy_json jsonb,
  web_policy_json jsonb,
  quality_gates_json jsonb,
  status text not null default 'DRAFT',
  prompt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists prompt_sets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  template_id uuid references templates(id) on delete set null,
  name text not null,
  state text not null default 'DRAFT',
  version int not null default 1,
  published_version int,
  global_prompts jsonb,
  sections_json jsonb,
  history_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists connectors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  type text not null,
  name text not null,
  description text,
  config_json jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists model_providers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  name text not null,
  region text,
  models text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists model_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  provider_id uuid references model_providers(id) on delete set null,
  model text not null,
  temperature numeric not null default 0.5,
  max_output_tokens int not null default 1024,
  top_p numeric not null default 0.9,
  strictness text not null default 'medium',
  verification jsonb,
  stage_hints jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists generation_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  name text not null,
  description text,
  toggles jsonb,
  stage_config jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists report_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  template_id uuid not null references templates(id) on delete cascade,
  template_version_snapshot_json jsonb,
  profile_id uuid,
  profile_snapshot jsonb,
  prompt_set_id uuid,
  prompt_set_snapshot jsonb,
  input_json jsonb,
  status text not null default 'QUEUED',
  started_at timestamptz,
  completed_at timestamptz,
  blueprint_json jsonb,
  final_report_json jsonb,
  transitions_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists section_runs (
  id uuid primary key default gen_random_uuid(),
  report_run_id uuid not null references report_runs(id) on delete cascade,
  template_section_id uuid not null references template_sections(id) on delete cascade,
  title text,
  status text not null default 'QUEUED',
  attempt_count int not null default 0,
  timings_json jsonb,
  model_used text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists evidence_bundles (
  id uuid primary key default gen_random_uuid(),
  section_run_id uuid unique not null references section_runs(id) on delete cascade,
  vector_hits_json jsonb,
  web_hits_json jsonb,
  retrieval_metrics_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists section_artifacts (
  id uuid primary key default gen_random_uuid(),
  section_run_id uuid not null references section_runs(id) on delete cascade,
  type text not null,
  content_json jsonb,
  content_markdown text,
  provenance_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists exports (
  id uuid primary key default gen_random_uuid(),
  report_run_id uuid not null references report_runs(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete set null,
  format text not null,
  status text not null default 'QUEUED',
  file_path text,
  storage_url text,
  file_size bigint,
  checksum text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  actor_user_id uuid,
  action_type text not null,
  target_type text not null,
  target_id uuid,
  details_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  type text not null,
  status text not null default 'QUEUED',
  priority int not null default 100,
  payload_json jsonb,
  run_id uuid,
  section_run_id uuid,
  attempt_count int not null default 0,
  max_attempts int not null default 3,
  locked_by text,
  locked_at timestamptz,
  lock_expires_at timestamptz,
  scheduled_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists run_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references report_runs(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete set null,
  type text not null,
  payload_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists section_scores (
  id uuid primary key default gen_random_uuid(),
  report_run_id uuid not null references report_runs(id) on delete cascade,
  section_run_id uuid not null references section_runs(id) on delete cascade,
  coverage numeric not null default 0,
  diversity numeric not null default 0,
  recency numeric not null default 0,
  redundancy numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_run_id, section_run_id)
);

create table if not exists dependency_snapshots (
  id uuid primary key default gen_random_uuid(),
  report_run_id uuid not null unique references report_runs(id) on delete cascade,
  blueprint_assumptions jsonb,
  retrieval_queries_by_section jsonb,
  section_outputs jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_template_sections_template on template_sections(template_id);
create index if not exists idx_section_runs_report on section_runs(report_run_id);
create index if not exists idx_section_runs_template on section_runs(template_section_id);
create index if not exists idx_exports_run on exports(report_run_id);
create index if not exists idx_run_events_run on run_events(run_id);
create index if not exists idx_jobs_status on jobs(status, scheduled_at, priority);
create index if not exists idx_jobs_run on jobs(run_id);
create index if not exists idx_jobs_section on jobs(section_run_id);
create index if not exists idx_jobs_lock_expiry on jobs(lock_expires_at);

create or replace function claim_next_job(worker_id text, lease_seconds int default 300)
returns setof jobs
language plpgsql
as $$
declare
  job_record jobs%rowtype;
begin
  select *
    into job_record
    from jobs
   where status = 'QUEUED'
     and scheduled_at <= now()
     and (lock_expires_at is null or lock_expires_at <= now())
   order by priority asc, created_at asc
   limit 1
   for update skip locked;

  if not found then
    return;
  end if;

  update jobs
     set status = 'RUNNING',
         locked_by = worker_id,
         locked_at = now(),
         lock_expires_at = now() + make_interval(secs => lease_seconds),
         attempt_count = attempt_count + 1,
         updated_at = now()
   where id = job_record.id
   returning * into job_record;

  return next job_record;
end;
$$;
