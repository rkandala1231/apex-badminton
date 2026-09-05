-- ============================================================================
-- RECONSTRUCTION, NOT A VERIFIED COPY -- READ THIS BEFORE RUNNING ANYWHERE.
--
-- `registrations`, `register_for_apex()`, and `admin_registrations_view` have existed live on
-- prod since before this repo's migration history began (this app was rebuilt from an existing
-- plain-HTML site with the same Supabase backend -- see README.md's "Database contract" section
-- and commit 15a0661 "Rebuild as React + TypeScript"). No migration file for any of them has ever
-- existed in this repo. This file is a best-effort reconstruction written from:
--   - README.md's documented RPC signature
--   - the exact parameter/column names the frontend actually sends and reads
--     (src/lib/types.ts: RegisterPayload, AdminRegistrationRow; src/lib/queries.ts:
--     useRegisterCollege, useAdminRegistrations, useUpdateRegistrationStatus)
--   - the RegistrationStatus and RegionName enums the UI already enforces
--
-- It is NOT a copy of the real, currently-running function bodies or the real table's exact
-- column types/constraints/defaults/indexes -- this session had no live connection to the actual
-- Supabase project to introspect them (no service-role key, no database access from this
-- sandbox), unlike the admin_allowlist_and_role_tiers.sql migration, which WAS written from live
-- introspection of prod. Treat this file as a starting point for closing that drift gap, not as
-- proof of what's actually live.
--
-- BEFORE applying this anywhere real (dev or prod), do this instead:
--   1. In the Supabase SQL Editor, run:
--        select pg_get_functiondef('public.register_for_apex'::regproc);
--        \d public.registrations                          -- (psql) or check Table Editor's
--                                                           -- column list/constraints directly
--        select pg_get_viewdef('public.admin_registrations_view'::regclass, true);
--   2. Replace the bodies/DDL below with what those return.
--   3. Only then run this file elsewhere, or commit it as the accurate historical record.
--
-- Applying this AS-IS to an environment where these objects already exist is written to be safe
-- in the ways that matter most:
--   - `create table if not exists` -- will NOT touch the real table if it already exists (no
--     column changes, no data loss), so at worst this is a no-op on the table itself.
--   - The functions and view use `create or replace`, which is NOT a no-op -- running this file
--     against a database with the real functions already in place WILL overwrite them with this
--     reconstruction, silently changing behavior for every caller the moment it's applied, even
--     if the external signature matches. Do not run this against dev or prod until you've
--     completed the verification step above, or you are deliberately choosing to replace the
--     live implementation with this one.
-- ============================================================================

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  college_name text not null,
  captain_name text not null,
  captain_email text not null,
  region text not null check (region in ('Northeast', 'Southeast', 'Midwest', 'South', 'Mountain', 'Pacific')),
  roster_size integer,
  notes text,
  event_codes text[] not null default '{}'
    check (event_codes <@ array['MS', 'WS', 'MD', 'WD', 'XD', 'TEAM']::text[]),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'waitlisted', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists registrations_created_at_idx on public.registrations (created_at);
create index if not exists registrations_region_idx on public.registrations (region);

alter table public.registrations enable row level security;

-- No direct grant to anon at all -- public writes go through register_for_apex() below (a
-- SECURITY DEFINER function bypasses RLS internally, so it doesn't need the caller to have table
-- privileges). Admins read through admin_registrations_view, not this table directly, but
-- useUpdateRegistrationStatus (queries.ts) does call `.from('registrations').update(...)`
-- directly from the client, so authenticated admins need a real UPDATE policy here.
grant select, update on public.registrations to authenticated;

create policy "admins can select registrations" on public.registrations
  for select
  using (public.is_admin());

create policy "admins can update registrations" on public.registrations
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- Public registration write. SECURITY DEFINER so an anonymous caller can insert without any
-- direct grant on the table -- same pattern as create_admin_account/remove_admin_access.
create or replace function public.register_for_apex(
  p_college_name text,
  p_captain_name text,
  p_captain_email text,
  p_region text,
  p_roster_size integer default null,
  p_notes text default null,
  p_event_codes text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_id uuid;
begin
  if p_college_name is null or length(trim(p_college_name)) = 0 then
    raise exception 'college name is required';
  end if;
  if p_captain_name is null or length(trim(p_captain_name)) = 0 then
    raise exception 'captain name is required';
  end if;
  if p_captain_email is null or p_captain_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'a valid captain email is required';
  end if;
  if p_region not in ('Northeast', 'Southeast', 'Midwest', 'South', 'Mountain', 'Pacific') then
    raise exception 'invalid region: %', p_region;
  end if;
  if p_roster_size is not null and p_roster_size < 0 then
    raise exception 'roster size cannot be negative';
  end if;
  if not (coalesce(p_event_codes, '{}') <@ array['MS', 'WS', 'MD', 'WD', 'XD', 'TEAM']) then
    raise exception 'invalid event code in %', p_event_codes;
  end if;

  insert into public.registrations (
    college_name, captain_name, captain_email, region, roster_size, notes, event_codes
  ) values (
    trim(p_college_name), trim(p_captain_name), lower(trim(p_captain_email)),
    p_region, p_roster_size, p_notes, coalesce(p_event_codes, '{}')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.register_for_apex(text, text, text, text, integer, text, text[]) from public;
grant execute on function public.register_for_apex(text, text, text, text, integer, text, text[]) to anon, authenticated;

-- Admin-only read of every registration, including fields the public analytics views never
-- expose (captain name/email, notes). Filtering by is_admin() inside the view definition itself
-- (rather than relying only on the grant below) means the view returns zero rows for anyone who
-- isn't an admin even if the grant is ever loosened by mistake -- defense in depth, matching the
-- is_admin()-gated pattern used everywhere else in this schema.
create or replace view public.admin_registrations_view as
select
  id,
  college_name,
  captain_name,
  captain_email,
  region,
  roster_size,
  status,
  created_at,
  event_codes as events
from public.registrations
where public.is_admin();

revoke all on public.admin_registrations_view from public, anon;
grant select on public.admin_registrations_view to authenticated;
