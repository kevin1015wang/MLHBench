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

-- Guest accounts: a second, lightweight identity type alongside the single
-- Google-authenticated admin (Kevin, gated by ALLOWED_LOGIN_EMAIL -- see
-- src/lib/auth/session.ts). The admin creates these from the
-- guest-management page (email + a generated password, shared out of band)
-- -- there's no self-service signup. A fresh account gets a default AI run
-- quota (see default below) but zero event access -- it can't actually do
-- anything until the admin grants at least one event.
create table guests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  password_hash text not null,
  password_salt text not null,
  display_name text not null default '',

  ai_run_quota integer not null default 20,
  ai_run_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint guests_email_unique unique (email),
  constraint guests_email_format check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

-- Event-level access grants: which whole events a guest can see/act on.
-- Deliberately coarse (not per-project) -- see the guest permissions model
-- in the app.
create table guest_event_access (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint guest_event_access_unique unique (guest_id, event_id)
);

create index guest_event_access_guest_idx on guest_event_access(guest_id);

-- Atomically charges one AI run against a guest's quota. Called from
-- src/lib/auth/guest-access.ts via the service-role client instead of doing
-- a read-then-write from application code, so the UPDATE's row lock is what
-- actually prevents two concurrent requests from both squeaking past the
-- quota boundary. `found` reflects whether the WHERE clause matched (quota
-- was available) after the update ran.
create or replace function charge_guest_ai_run(p_guest_id uuid)
returns boolean
language plpgsql
as $$
begin
  update guests
  set ai_run_count = ai_run_count + 1
  where id = p_guest_id and ai_run_count < ai_run_quota;
  return found;
end;
$$;

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
  table_number text,

  status project_processing_status not null default 'unprocessed',
  project_processing_status_message text,
  process_started_at timestamptz,

  description_accuracy_level description_accuracy_level,
  description_accuracy_message text,
  technical_complexity complexity_rating,
  technical_complexity_message text,

  tech_stack text[] not null default '{}',
  -- True when the gitingest repo content exceeded the review model's context
  -- window and had to be cut down before the code/prize review agents ran.
  repo_content_truncated boolean not null default false,

  prize_results jsonb not null default '{}'::jsonb,

  is_favorite boolean not null default false
);

create index projects_event_id_idx on projects(event_id);
create index projects_status_idx on projects(event_id, status);
create index projects_shortlist_idx on projects(event_id, judging_shortlist);
create index projects_complexity_idx on projects(event_id, technical_complexity);
create index projects_project_title_idx on projects(event_id, project_title);
create index projects_favorite_idx on projects(event_id, is_favorite);

create table prize_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null default '',
  slug text not null,

  find_words text[] not null default '{}',
  -- Additional slugs (e.g. derived from a different event's differently-
  -- worded Devpost prize name) that should also resolve to this category
  -- during CSV import, alongside the canonical `slug`. See
  -- matchPrizeCategorySlugs() in src/lib/prize-category-matching.ts.
  alias_slugs text[] not null default '{}',

  system_prompt text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint prize_categories_slug_unique unique (slug),
  constraint prize_categories_name_unique unique (name)
);

create index prize_categories_slug_idx on prize_categories(slug);

-- Prize-name slugs (derived from projects' raw opt_in_prizes text via
-- extractMlhCandidateSlugs()) that an admin has reviewed and dismissed as
-- NOT actual MLH prize tracks -- e.g. hackathon-local awards like "Best
-- UI/UX" that Devpost exports without a sponsor prefix, so they look like
-- MLH candidates even though no prize_categories row should ever exist for
-- them. Dismissing keeps them out of the "Missing Configuration" list on
-- the Prize Categories page.
create table ignored_prize_slugs (
  id uuid primary key default gen_random_uuid(),
  slug text not null,

  created_at timestamptz not null default now(),

  constraint ignored_prize_slugs_slug_unique unique (slug)
);

-- One row per (project, prize_category) recording where that project ranks
-- within that category's shortlist. Rank order is rewritten wholesale on
-- every reorder (delete-then-reinsert, see src/lib/save-project-rankings.ts),
-- so there's intentionally no uniqueness constraint on (prize_category_id,
-- rank) -- enforcing it at the DB level would just create transient conflicts
-- mid-rewrite for no benefit.
create table project_rankings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  prize_category_id uuid not null references prize_categories(id) on delete cascade,
  rank integer not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_rankings_project_category_unique unique (project_id, prize_category_id)
);

create index project_rankings_category_idx on project_rankings(prize_category_id, rank);
create index project_rankings_event_idx on project_rankings(event_id);

-- Anon/publishable key is used for almost all reads and writes (no
-- service-role key for these tables), so RLS must permit the anon role to
-- select/insert/update/delete on them. See README "Notes & tips".
alter table events enable row level security;
alter table projects enable row level security;
alter table prize_categories enable row level security;
alter table project_rankings enable row level security;
alter table ignored_prize_slugs enable row level security;

create policy "anon full access" on events for all to anon using (true) with check (true);
create policy "anon full access" on projects for all to anon using (true) with check (true);
create policy "anon full access" on prize_categories for all to anon using (true) with check (true);
create policy "anon full access" on project_rankings for all to anon using (true) with check (true);
create policy "anon full access" on ignored_prize_slugs for all to anon using (true) with check (true);

-- guests/guest_event_access are the one exception: they gate authentication
-- and per-guest AI run quotas, so an "anon full access" policy here would
-- let any guest grant themselves unlimited quota or access to any event via
-- a raw Supabase call, bypassing every app-level check entirely. RLS is
-- enabled with NO policies defined for anon, which defaults to deny -- these
-- tables are only ever read/written server-side via the service-role client
-- (src/lib/supabase/admin.ts), which bypasses RLS.
alter table guests enable row level security;
alter table guest_event_access enable row level security;

-- The app's live "Processing Projects" view relies on Supabase Realtime
-- (useRealtimeSubscription) pushing postgres_changes events for status/result
-- updates. Tables aren't broadcast by default, so they must be added to the
-- realtime publication explicitly, or the UI will appear stuck on "Queued
-- for processing" even while the server-side review pipeline runs fine.
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table prize_categories;
alter publication supabase_realtime add table project_rankings;
alter publication supabase_realtime add table ignored_prize_slugs;
