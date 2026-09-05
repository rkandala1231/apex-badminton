-- ============================================================================
-- RECONSTRUCTION, NOT A VERIFIED COPY -- same caveat as
-- 20260905160000_registration_schema_and_rpc.sql, read that file's header first.
--
-- `get_public_summary_stats`, `get_public_event_counts`, `get_public_region_counts`, and
-- `get_public_weekly_trend` back the public /analytics page and have existed live on prod since
-- before this repo's migration history began. No migration file for any of them has ever existed
-- in this repo. Reconstructed from the exact shapes the frontend reads
-- (src/lib/types.ts: SummaryStats, EventCountRow, RegionCountRow, WeeklyTrendRow;
-- src/lib/queries.ts: fetchAnalytics) and the plausible aggregation each name implies -- NOT from
-- the real function bodies, which this session has no live access to introspect.
--
-- Before applying this anywhere real, pull the actual definitions first:
--   select pg_get_functiondef('public.get_public_summary_stats'::regproc);
--   select pg_get_functiondef('public.get_public_event_counts'::regproc);
--   select pg_get_functiondef('public.get_public_region_counts'::regproc);
--   select pg_get_functiondef('public.get_public_weekly_trend'::regproc);
-- and replace the bodies below with what those return. All four use `create or replace function`
-- -- applying this file as-is to an environment where the real versions already exist WILL
-- overwrite them with this reconstruction's aggregation logic, which may not exactly match
-- (e.g. "colleges_registered" could plausibly count total registration rows instead of distinct
-- college names on the real prod function -- this file assumes distinct, since a college
-- registering twice shouldn't inflate the headline count, but that's an assumption, not a fact
-- pulled from the real definition).
--
-- Depends on 20260905160000_registration_schema_and_rpc.sql (the `registrations` table) already
-- being applied.
-- ============================================================================

create or replace function public.get_public_summary_stats()
returns table (
  colleges_registered bigint,
  total_entries bigint,
  colleges_this_week bigint,
  entries_this_week bigint
)
language sql
stable
security definer
set search_path = 'public'
as $$
  select
    count(distinct college_name)::bigint as colleges_registered,
    coalesce(sum(coalesce(array_length(event_codes, 1), 0)), 0)::bigint as total_entries,
    count(distinct college_name) filter (where created_at >= now() - interval '7 days')::bigint as colleges_this_week,
    coalesce(sum(coalesce(array_length(event_codes, 1), 0)) filter (where created_at >= now() - interval '7 days'), 0)::bigint as entries_this_week
  from public.registrations;
$$;

create or replace function public.get_public_event_counts()
returns table (
  event_code text,
  entries bigint
)
language sql
stable
security definer
set search_path = 'public'
as $$
  select ec.event_code, count(*)::bigint as entries
  from public.registrations r
  cross join lateral unnest(r.event_codes) as ec(event_code)
  group by ec.event_code
  order by entries desc, ec.event_code asc;
$$;

create or replace function public.get_public_region_counts()
returns table (
  region text,
  colleges bigint
)
language sql
stable
security definer
set search_path = 'public'
as $$
  select r.region, count(distinct r.college_name)::bigint as colleges
  from public.registrations r
  group by r.region
  order by colleges desc, r.region asc;
$$;

create or replace function public.get_public_weekly_trend()
returns table (
  week_start date,
  new_regs bigint,
  cumulative bigint
)
language sql
stable
security definer
set search_path = 'public'
as $$
  with weekly as (
    select date_trunc('week', created_at)::date as week_start, count(*)::bigint as new_regs
    from public.registrations
    group by 1
  )
  select
    week_start,
    new_regs,
    sum(new_regs) over (order by week_start)::bigint as cumulative
  from weekly
  order by week_start;
$$;

-- Public, read-only, no PII (no captain name/email/notes -- those stay behind
-- admin_registrations_view) -- same trust boundary as get_team_standings/get_head_to_head.
revoke execute on function public.get_public_summary_stats() from public;
revoke execute on function public.get_public_event_counts() from public;
revoke execute on function public.get_public_region_counts() from public;
revoke execute on function public.get_public_weekly_trend() from public;
grant execute on function public.get_public_summary_stats() to anon, authenticated;
grant execute on function public.get_public_event_counts() to anon, authenticated;
grant execute on function public.get_public_region_counts() to anon, authenticated;
grant execute on function public.get_public_weekly_trend() to anon, authenticated;
