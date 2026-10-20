-- Self-serve accounts: anyone can sign in with Google, create their own
-- events, invite co-judges, keep private prize categories, and run AI
-- reviews billed to their own OpenRouter key.
--
-- This also replaces the old "anon full access" RLS policies. The browser
-- now talks to Supabase with a short-lived JWT the app server mints from
-- the bench_session cookie (see src/lib/auth/supabase-token.ts), carrying:
--   role      = 'authenticated'
--   app_role  = 'admin' | 'guest' | 'user'
--   app_uid   = guests.id / users.id (absent for the admin)
--   app_judge_id = the session user id written to project_judges.judge_id
-- and every policy below keys off those claims. Server-side API routes use
-- the service-role client and do their own authorization checks.
--
-- Apply once against the existing database (SQL editor or `psql`).
-- supabase/schema.sql is kept in sync for fresh installs.

begin;

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

-- Self-signup Google accounts. The admin (ALLOWED_LOGIN_EMAIL) is not stored
-- here; guests stay in their own table. Only ever read/written server-side
-- via the service role -- the encrypted OpenRouter key lives on this row.
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

-- Null = an admin-run (MLH) event; otherwise the self-signup user who owns
-- it and whose OpenRouter key pays for its AI reviews.
alter table events add column owner_user_id uuid references users(id) on delete cascade;
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

-- Null = a global category the admin curates (visible to everyone);
-- otherwise private to that user and the co-judges on their events. Slugs
-- and names are now unique per owner rather than globally.
alter table prize_categories add column owner_user_id uuid references users(id) on delete cascade;
alter table prize_categories drop constraint prize_categories_slug_unique;
alter table prize_categories drop constraint prize_categories_name_unique;
alter table prize_categories add constraint prize_categories_owner_slug_unique unique nulls not distinct (owner_user_id, slug);
alter table prize_categories add constraint prize_categories_owner_name_unique unique nulls not distinct (owner_user_id, name);
create index prize_categories_owner_idx on prize_categories(owner_user_id);

-- ---------------------------------------------------------------------------
-- RLS helpers (claims minted by src/lib/auth/supabase-token.ts)
-- ---------------------------------------------------------------------------

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
    )
    when 'user' then exists (
      select 1 from events e
      where e.id = p_event_id and e.owner_user_id = bench_uid()
    ) or exists (
      select 1 from event_members m
      where m.event_id = p_event_id and m.user_id = bench_uid()
    )
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
    when bench_app_role() <> 'user' then false
    when p_owner_user_id = bench_uid() then true
    else exists (
      select 1 from event_members m
      join events e on e.id = m.event_id
      where m.user_id = bench_uid() and e.owner_user_id = p_owner_user_id
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

drop policy "anon full access" on events;
drop policy "anon full access" on projects;
drop policy "anon full access" on prize_categories;
drop policy "anon full access" on project_rankings;
drop policy "anon full access" on project_judges;
drop policy "anon full access" on ignored_prize_slugs;

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
create policy "signed in read" on ignored_prize_slugs
  for select to authenticated using (true);

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

commit;
