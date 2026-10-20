-- Lets the admin be invited as a co-judge on self-signup users' events.
--
-- The admin has no users row (it's identified by ALLOWED_LOGIN_EMAIL), so an
-- event_members invite to the admin's email never got a user_id and the
-- admin never saw the event. The admin's minted JWT now carries an `email`
-- claim (src/lib/auth/supabase-token.ts), and membership matches on it.
--
-- Apply once against the existing database, after
-- 20261019000000_self_serve_accounts.sql.

begin;

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

commit;
