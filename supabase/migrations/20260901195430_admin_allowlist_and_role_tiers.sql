-- Admin role tiers (admin / super_admin) and the email-based allowlist, plus the final,
-- lockdown RLS posture for both `admins` and `admin_allowlist`.
--
-- This consolidates what was, on prod, several incremental migrations (including a Google-OAuth
-- admin experiment and a since-fixed infinite-recursion RLS bug) into the FINAL state those
-- migrations converged on -- there is no value in replaying bugs that were later fixed. Written
-- from live introspection of apex-badminton-prod, not from the original migration history (which
-- Supabase does not retain the SQL text of).
--
-- Written to be idempotent against a database that already has an older, single-tier `admins`
-- table -- as apex-badminton-dev does -- via `add column if not exists` and `create table if not
-- exists`, rather than assuming a from-scratch database. Verified against apex-badminton-dev
-- directly: dev's original `admins` table turned out to have only `user_id` (no `created_at`
-- either, not just missing `role`/`note` as first assumed) -- `list_admin_staff()` in the
-- companion RPCs file selects `created_at`, so it's added here too rather than assumed present.
--
-- Key final-state fact worth calling out: `admins` and `admin_allowlist` have RLS enabled but
-- deliberately NO policies -- all access goes through the SECURITY DEFINER functions below, not
-- direct table policies. Dev's current `admins` table has a direct "admins can select admins"
-- policy (qual: is_admin()) that predates this lockdown; this migration drops it so dev matches
-- prod's actual current security posture instead of an earlier, superseded one.

alter table public.admins add column if not exists role text not null default 'admin';
alter table public.admins add column if not exists note text;
alter table public.admins add column if not exists created_at timestamptz not null default now();
do $$ begin
  alter table public.admins add constraint admins_role_check check (role in ('admin', 'super_admin'));
exception when duplicate_object then null;
end $$;

create table if not exists public.admin_allowlist (
  email text primary key,
  note text,
  added_at timestamptz not null default now(),
  role text not null default 'admin' check (role in ('admin', 'super_admin'))
);

alter table public.admins enable row level security;
alter table public.admin_allowlist enable row level security;

drop policy if exists "admins can select admins" on public.admins;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select
    exists (
      select 1
      from public.admins a
      join auth.users au on au.id = a.user_id
      where a.user_id = (select auth.uid())
         or (
           au.email_confirmed_at is not null
           and au.email = (select auth.jwt() ->> 'email')
         )
    )
    or exists (
      select 1
      from public.admin_allowlist al
      where lower(al.email) = lower((select auth.jwt() ->> 'email'))
    );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select
    exists (
      select 1
      from public.admins a
      join auth.users au on au.id = a.user_id
      where a.role = 'super_admin'
        and (
          a.user_id = (select auth.uid())
          or (
            au.email_confirmed_at is not null
            and au.email = (select auth.jwt() ->> 'email')
          )
        )
    )
    or exists (
      select 1
      from public.admin_allowlist al
      where al.role = 'super_admin'
        and lower(al.email) = lower((select auth.jwt() ->> 'email'))
    );
$$;

revoke execute on function public.is_admin() from public;
revoke execute on function public.is_super_admin() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
