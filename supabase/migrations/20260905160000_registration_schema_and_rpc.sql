-- ============================================================================
-- VERIFIED against the real, live prod definitions -- not the guess this file started as.
--
-- `registrations`, `register_for_apex()`, and `admin_registrations_view` have existed live on
-- prod since before this repo's migration history began (this app was rebuilt from an existing
-- plain-HTML site with the same Supabase backend -- see README.md's "Database contract" section
-- and commit 15a0661 "Rebuild as React + TypeScript"). No migration file for any of them had ever
-- existed in this repo until now.
--
-- The function body of register_for_apex() and the SELECT body of admin_registrations_view below
-- are a verbatim transcription of `pg_get_functiondef('public.register_for_apex'::regproc)` and
-- `pg_get_viewdef('public.admin_registrations_view'::regclass, true)` run directly against prod
-- -- not a guess. Two things this exercise corrected from an earlier draft of this file that
-- guessed instead of checking: (1) events are stored in a separate `registration_events` junction
-- table (registration_id, event_code), not a `text[]` column directly on `registrations`; (2) the
-- admin view has no inline `is_admin()` filter -- access is gated purely by
-- `grant select ... to authenticated` below. That second point only holds because this app has no
-- general user signup at all -- every authenticated account is a staff account created via
-- create_admin_account() (see 20260901204945_admin_staff_management_rpcs.sql). If this app ever
-- adds a non-admin authenticated user type, this view's grant needs to be replaced with an
-- explicit `where public.is_admin()` filter in its body, or it will leak registrant PII
-- (captain_name/captain_email) to any signed-in user, not just staff.
--
-- What is still NOT independently verified (this session has no live database connection of its
-- own -- everything above came from the user running these three queries by hand and pasting the
-- results back): the exact column types/defaults/constraints/indexes on `registrations` and
-- `registration_events` beyond what the function/view bodies imply, and whether either table has
-- RLS policies beyond what's written here. The `create table if not exists` below is deliberately
-- a no-op if the real tables already exist (matching what the function/view bodies need column-
-- name-wise), so it will not clobber real structure even if these guessed details are wrong --
-- but if you want the DDL itself verified too, run in the SQL Editor:
--   select column_name, data_type, is_nullable, column_default
--   from information_schema.columns where table_schema = 'public' and table_name = 'registrations';
--   (same query with table_name = 'registration_events')
--   select policyname, cmd, qual, with_check from pg_policies
--   where schemaname = 'public' and tablename in ('registrations', 'registration_events');
--
-- The function and view use `create or replace`, which DOES overwrite the live objects the
-- moment this file is applied -- but since the bodies below are now a verbatim transcription of
-- what's already live, applying this to dev/prod should be a functional no-op (it re-creates the
-- same behavior, just now version-controlled). Still worth a diff-and-confirm before running on
-- prod, on general principle for anything gated `create or replace`.
-- ============================================================================

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  college_name text not null,
  captain_name text not null,
  captain_email text not null,
  region text not null check (region in ('Northeast', 'Southeast', 'Midwest', 'South', 'Mountain', 'Pacific')),
  roster_size integer,
  notes text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'waitlisted', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.registration_events (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  event_code text not null check (event_code in ('MS', 'WS', 'MD', 'WD', 'XD', 'TEAM'))
);

create index if not exists registrations_created_at_idx on public.registrations (created_at);
create index if not exists registrations_region_idx on public.registrations (region);
create index if not exists registration_events_registration_id_idx on public.registration_events (registration_id);
create index if not exists registration_events_event_code_idx on public.registration_events (event_code);

alter table public.registrations enable row level security;
alter table public.registration_events enable row level security;

-- No direct grant to anon on either table -- public writes go through register_for_apex() below
-- (SECURITY DEFINER bypasses RLS internally, so the anon caller doesn't need table privileges).
-- useUpdateRegistrationStatus (queries.ts) calls `.from('registrations').update(...)` directly
-- from an authenticated admin's browser, so that role needs a real UPDATE policy here.
grant select, update on public.registrations to authenticated;
grant select on public.registration_events to authenticated;

create policy "admins can select registrations" on public.registrations
  for select
  using (public.is_admin());

create policy "admins can update registrations" on public.registrations
  for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins can select registration_events" on public.registration_events
  for select
  using (public.is_admin());

-- Public registration write -- verbatim transcription of the live function.
create or replace function public.register_for_apex(
  p_college_name text,
  p_captain_name text,
  p_captain_email text,
  p_region text,
  p_roster_size integer,
  p_notes text,
  p_event_codes text[]
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_code text;
begin
  if p_event_codes is null or array_length(p_event_codes, 1) is null then
    raise exception 'Select at least one event.';
  end if;

  insert into public.registrations (college_name, captain_name, captain_email, region, roster_size, notes)
  values (p_college_name, p_captain_name, p_captain_email, p_region, p_roster_size, p_notes)
  returning id into v_id;

  foreach v_code in array p_event_codes loop
    insert into public.registration_events (registration_id, event_code)
    values (v_id, v_code);
  end loop;
end;
$function$;

revoke execute on function public.register_for_apex(text, text, text, text, integer, text, text[]) from public;
grant execute on function public.register_for_apex(text, text, text, text, integer, text, text[]) to anon, authenticated;

-- Admin-only read of every registration, including captain_name/captain_email -- PII that never
-- appears in the public analytics RPCs. Gated purely by the grant below (authenticated only, not
-- anon) -- see the header comment on why that's sufficient today and what would need to change if
-- it stops being sufficient. Verbatim transcription of the live view's SELECT body.
create or replace view public.admin_registrations_view as
select
  r.id,
  r.college_name,
  r.captain_name,
  r.captain_email,
  r.region,
  r.roster_size,
  r.status,
  r.created_at,
  coalesce(array_agg(e.event_code order by e.event_code) filter (where e.event_code is not null), '{}') as events
from public.registrations r
left join public.registration_events e on e.registration_id = r.id
group by r.id;

revoke all on public.admin_registrations_view from public, anon;
grant select on public.admin_registrations_view to authenticated;
