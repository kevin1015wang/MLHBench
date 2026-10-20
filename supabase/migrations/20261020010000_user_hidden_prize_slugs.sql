-- Lets self-signup users hide discovered prize slugs that aren't real prize
-- tracks (the "x" on the Prize Categories page's Missing Configuration
-- card), without hiding them for everyone else.
--
-- owner_user_id null = hidden by the admin, for everyone (as before);
-- otherwise hidden only for that user. Writes go through the API.
--
-- Apply once against the existing database, after
-- 20261020000000_admin_event_invites.sql.

begin;

alter table ignored_prize_slugs add column owner_user_id uuid references users(id) on delete cascade;
alter table ignored_prize_slugs drop constraint ignored_prize_slugs_slug_unique;
alter table ignored_prize_slugs add constraint ignored_prize_slugs_owner_slug_unique unique nulls not distinct (owner_user_id, slug);

drop policy "signed in read" on ignored_prize_slugs;
create policy "global or own read" on ignored_prize_slugs
  for select to authenticated using (
    bench_app_role() <> ''
    and (
      owner_user_id is null
      or (bench_app_role() = 'user' and owner_user_id = bench_uid())
    )
  );

commit;
