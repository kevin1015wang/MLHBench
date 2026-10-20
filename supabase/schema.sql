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

-- Self-signup Google accounts (anyone who isn't ALLOWED_LOGIN_EMAIL). The
-- admin isn't stored here; guests stay in their own table. Only ever
-- read/written server-side via the service role -- the encrypted OpenRouter
-- key lives on this row.
create table users (
  id uuid primary key default gen_random_uuid(),
  google_sub text not null,
  email text not null,
  first_name text not null default '',
  last_name text not null default '',
  avatar_url text,

  -- AES-256-GCM ciphertext (see src/lib/crypto/secret-box.ts), keyed by the
  -- server-only API_KEY_ENCRYPTION_KEY env var. last4 is for display only.
  openrouter_key_encrypted text,
  openrouter_key_last4 text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),

  constraint users_google_sub_unique unique (google_sub),
  constraint users_email_unique unique (email)
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

  -- The projects table's sort order, shared by everyone judging this event
  -- (a TanStack SortingState: [{ "id": "<column id>", "desc": bool }]).
  -- Null means the default, table number ascending.
  projects_sort jsonb,

  -- Null = an admin-run (MLH) event; otherwise the self-signup user who owns
  -- it and whose OpenRouter key pays for its AI reviews.
  owner_user_id uuid references users(id) on delete cascade,

  constraint events_slug_unique unique (slug),
  constraint events_start_before_end check (starts_at is null or ends_at is null or starts_at < ends_at)
);

create index events_created_at_idx on events(created_at desc);
create index events_slug_idx on events(slug);
create index events_owner_user_idx on events(owner_user_id);

-- Co-judges an event owner has invited by email. user_id is filled in when
-- someone with that (Google-verified) email signs in, so owners can invite
-- people before they've ever logged in.
create table event_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  email text not null,
  user_id uuid references users(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint event_members_event_email_unique unique (event_id, email),
  constraint event_members_email_format check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

create index event_members_user_idx on event_members(user_id);
create index event_members_pending_email_idx on event_members(email) where user_id is null;

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
  -- True when the review pipeline found the repo's first/last commit outside
  -- the event's starts_at/ends_at window. This no longer blocks the review:
  -- the code/prize review agents still run so judges get real AI analysis of
  -- what the team built, and this flag (plus its message) is how the rule
  -- violation surfaces instead. See hackingTimelineAgent in
  -- src/lib/review/agents/2-hacking-timeline.ts.
  commits_outside_window boolean not null default false,
  commits_outside_window_message text,

  prize_results jsonb not null default '{}'::jsonb,

  is_favorite boolean not null default false,
  -- Set by a judge to take a project out of the running without deleting
  -- it; the projects table greys the row out.
  is_unconsidered boolean not null default false
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

  -- Null = a global category the admin curates (visible to everyone);
  -- otherwise private to that user and the co-judges on their events.
  owner_user_id uuid references users(id) on delete cascade,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint prize_categories_owner_slug_unique unique nulls not distinct (owner_user_id, slug),
  constraint prize_categories_owner_name_unique unique nulls not distinct (owner_user_id, name)
);

create index prize_categories_slug_idx on prize_categories(slug);
create index prize_categories_owner_idx on prize_categories(owner_user_id);

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

  -- Null = hidden by the admin, for everyone; otherwise hidden only for
  -- that self-signup user.
  owner_user_id uuid references users(id) on delete cascade,

  created_at timestamptz not null default now(),

  constraint ignored_prize_slugs_owner_slug_unique unique nulls not distinct (owner_user_id, slug)
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

-- Who judged what: one row per (project, judge), upserted whenever a judge
-- saves a score or notes, or favorites/unconsiders the project. A separate
-- table (rather than an array column on projects) so two coaches judging the
-- same project at once can't clobber each other's entry. judge_id is the
-- session user id (admin Google id or guest id), not a FK, since admins
-- aren't stored in a table; name/avatar are snapshotted for display.
create table project_judges (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  judge_id text not null,
  judge_name text not null,
  judge_avatar_url text,
  judge_role text not null default 'admin',

  created_at timestamptz not null default now(),
  last_judged_at timestamptz not null default now(),

  constraint project_judges_project_judge_unique unique (project_id, judge_id)
);

create index project_judges_event_idx on project_judges(event_id);

-- Row level security. The browser talks to Supabase with a short-lived JWT
-- the app server mints from the bench_session cookie (see
-- src/lib/auth/supabase-token.ts), carrying:
--   role         = 'authenticated'
--   app_role     = 'admin' | 'guest' | 'user'
--   app_uid      = guests.id / users.id (absent for the admin)
--   app_judge_id = the session user id written to project_judges.judge_id
-- Nothing is reachable with only the public key. Server-side API routes use
-- the service-role client (src/lib/supabase/admin.ts) and do their own
-- authorization checks (src/lib/auth/event-access.ts).

create or replace function bench_app_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'app_role', '');
$$;

create or replace function bench_uid()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'app_uid', '')::uuid;
$$;

-- Whether the caller was invited to this event: by user id for self-signup
-- users, by (server-signed) email claim for the admin.
create or replace function is_event_member(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from event_members m
    where m.event_id = p_event_id
      and (
        (bench_app_role() = 'user' and m.user_id = bench_uid())
        or (
          bench_app_role() = 'admin'
          and m.email = lower(auth.jwt() ->> 'email')
        )
      )
  );
$$;

-- security definer so policies on events can call it without recursing
-- into events' own RLS, and so it can read the service-role-only
-- event_members / guest_event_access tables.
create or replace function can_access_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case bench_app_role()
    when 'admin' then exists (
      select 1 from events e
      where e.id = p_event_id and e.owner_user_id is null
    ) or is_event_member(p_event_id)
    when 'user' then exists (
      select 1 from events e
      where e.id = p_event_id and e.owner_user_id = bench_uid()
    ) or is_event_member(p_event_id)
    when 'guest' then exists (
      select 1 from guest_event_access g
      where g.event_id = p_event_id and g.guest_id = bench_uid()
    )
    else false
  end;
$$;

-- Global categories are readable by anyone signed in; a user's private
-- categories by them and by co-judges on any event they own (so the
-- projects table can label those prize tracks).
create or replace function can_read_prize_category(p_owner_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when bench_app_role() = '' then false
    when p_owner_user_id is null then true
    when bench_app_role() = 'user' and p_owner_user_id = bench_uid() then true
    when bench_app_role() in ('user', 'admin') then exists (
      select 1 from events e
      where e.owner_user_id = p_owner_user_id and is_event_member(e.id)
    )
    else false
  end;
$$;

alter table events enable row level security;
alter table projects enable row level security;
alter table prize_categories enable row level security;
alter table project_rankings enable row level security;
alter table project_judges enable row level security;
alter table ignored_prize_slugs enable row level security;
alter table guests enable row level security;
alter table guest_event_access enable row level security;
alter table users enable row level security;
alter table event_members enable row level security;

-- Nothing is reachable with just the public key any more.
revoke all on events, projects, prize_categories, project_rankings,
  project_judges, ignored_prize_slugs, guests, guest_event_access, users,
  event_members
  from anon;

-- Account/access tables stay service-role only (no policies = deny).
revoke all on guests, guest_event_access, users, event_members from authenticated;

-- events: create/edit/delete go through the API (owner checks there); the
-- one write the browser makes is the shared projects-table sort order.
revoke insert, update, delete on events from authenticated;
grant update (projects_sort) on events to authenticated;
create policy "event members read" on events
  for select to authenticated using (can_access_event(id));
create policy "event members update sort" on events
  for update to authenticated
  using (can_access_event(id)) with check (can_access_event(id));

create policy "event members full access" on projects
  for all to authenticated
  using (can_access_event(event_id)) with check (can_access_event(event_id));

create policy "event members full access" on project_rankings
  for all to authenticated
  using (can_access_event(event_id)) with check (can_access_event(event_id));

-- Judges can only record themselves as the judge.
create policy "event members full access" on project_judges
  for all to authenticated
  using (can_access_event(event_id))
  with check (
    can_access_event(event_id)
    and judge_id = auth.jwt() ->> 'app_judge_id'
  );

-- prize_categories / ignored_prize_slugs: read-only from the browser;
-- writes go through the API.
revoke insert, update, delete on prize_categories, ignored_prize_slugs from authenticated;
create policy "visible categories read" on prize_categories
  for select to authenticated using (can_read_prize_category(owner_user_id));
create policy "global or own read" on ignored_prize_slugs
  for select to authenticated using (
    bench_app_role() <> ''
    and (
      owner_user_id is null
      or (bench_app_role() = 'user' and owner_user_id = bench_uid())
    )
  );

-- Event images are uploaded straight from the browser, which now sends the
-- 'authenticated' role instead of 'anon'. Upserts need select + update too.
-- Guarded since storage policies aren't part of this repo's schema.sql.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'bench event-images insert'
  ) then
    create policy "bench event-images insert" on storage.objects
      for insert to authenticated with check (bucket_id = 'event-images');
    create policy "bench event-images select" on storage.objects
      for select to authenticated using (bucket_id = 'event-images');
    create policy "bench event-images update" on storage.objects
      for update to authenticated using (bucket_id = 'event-images');
  end if;
end $$;


-- The app's live "Processing Projects" view relies on Supabase Realtime
-- (useRealtimeSubscription) pushing postgres_changes events for status/result
-- updates. Tables aren't broadcast by default, so they must be added to the
-- realtime publication explicitly, or the UI will appear stuck on "Queued
-- for processing" even while the server-side review pipeline runs fine.
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table prize_categories;
alter publication supabase_realtime add table project_rankings;
alter publication supabase_realtime add table project_judges;
alter publication supabase_realtime add table ignored_prize_slugs;
