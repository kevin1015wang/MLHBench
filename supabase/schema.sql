-- Bench Supabase schema
-- Source of truth: src/database.types.ts (matches the app code's expectations).
-- Fixes two errors present in docs/DB_SCHEMA.md's sketch:
--   - events.judging_end_time -> judging_ends_at
--   - projects indexes referencing nonexistent columns `shortlist`/`complexity`
--     -> judging_shortlist / technical_complexity
-- The unused `run_status` enum from the old generated types is intentionally omitted.

create extension if not exists pgcrypto;

create type project_processing_status as enum (
  'unprocessed',
  'processing:code_review',
  'processing:prize_category_review',
  'invalid:github_inaccessible',
  'invalid:rule_violation',
  'errored',
  'processed'
);

create type complexity_rating as enum (
  'invalid',
  'beginner',
  'intermediate',
  'advanced'
);

create type description_accuracy_level as enum (
  'low',
  'medium',
  'high'
);

create table events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  slug text not null,
  name text not null,
  status text not null,
  program text,
  starts_at timestamptz,
  ends_at timestamptz,
  event_format text,
  type text,
  website_url text,
  registration_url text,
  logo_url text,
  background_url text,
  event_staff_emails text,
  judging_ends_at timestamptz,

  city text,
  state text,
  country text,

  constraint events_slug_unique unique (slug),
  constraint events_start_before_end check (starts_at is null or ends_at is null or starts_at < ends_at)
);

create index events_created_at_idx on events(created_at desc);
create index events_slug_idx on events(slug);

create table projects (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  project_title text,
  submission_url text,
  project_created_at timestamptz,
  about_the_project text,
  try_it_out_links text[] not null default '{}',
  video_demo_link text,
  opt_in_prizes text not null default '',
  built_with text not null default '',
  standardized_opt_in_prizes text[] not null default '{}',

  submitter_first_name text,
  submitter_last_name text,
  submitter_email text,
  notes text,
  team_size numeric,

  github_url text,

  csv_row jsonb not null default '{}'::jsonb,

  judging_shortlist boolean not null default false,
  judging_rating numeric,
  judging_notes text,

  status project_processing_status not null default 'unprocessed',
  project_processing_status_message text,
  process_started_at timestamptz,

  description_accuracy_level description_accuracy_level,
  description_accuracy_message text,
  technical_complexity complexity_rating,
  technical_complexity_message text,

  tech_stack text[] not null default '{}',

  prize_results jsonb not null default '{}'::jsonb
);

create index projects_event_id_idx on projects(event_id);
create index projects_status_idx on projects(event_id, status);
create index projects_shortlist_idx on projects(event_id, judging_shortlist);
create index projects_complexity_idx on projects(event_id, technical_complexity);
create index projects_project_title_idx on projects(event_id, project_title);

create table prize_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null default '',
  slug text not null,

  find_words text[] not null default '{}',

  system_prompt text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint prize_categories_slug_unique unique (slug),
  constraint prize_categories_name_unique unique (name)
);

create index prize_categories_slug_idx on prize_categories(slug);

-- Anon/publishable key is used for all reads and writes (no service-role key
-- in the app), so RLS must permit the anon role to select/insert/update/delete
-- on all three tables. See README "Notes & tips".
alter table events enable row level security;
alter table projects enable row level security;
alter table prize_categories enable row level security;

create policy "anon full access" on events for all to anon using (true) with check (true);
create policy "anon full access" on projects for all to anon using (true) with check (true);
create policy "anon full access" on prize_categories for all to anon using (true) with check (true);
