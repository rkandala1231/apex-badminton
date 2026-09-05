-- ============================================================================
-- VERIFIED against the real, live prod definitions -- not the guess this file started as.
--
-- `get_public_summary_stats`, `get_public_event_counts`, `get_public_region_counts`, and
-- `get_public_weekly_trend` back the public /analytics page and have existed live on prod since
-- before this repo's migration history began. No migration file for any of them had ever existed
-- in this repo until now. All four bodies below are a verbatim transcription of
-- `pg_get_functiondef(...)` run directly against prod by the user, not a guess.
--
-- Worth calling out since an earlier draft of this file guessed wrong on it: "colleges_registered"
-- and "colleges" (in get_public_region_counts) both count `distinct r.id` -- i.e. distinct
-- REGISTRATION ROWS, not distinct `college_name` values. If the same college ever submits two
-- registration rows, both real functions count that as 2, not 1. That's the actual live behavior,
-- preserved here even though "count distinct college_name" might sound like the more obviously
-- correct interpretation of the column name -- don't "fix" this without confirming it's actually
-- wrong to the app's owner first, since analytics history/comparisons would shift underneath it.
--
-- Depends on 20260905160000_registration_schema_and_rpc.sql (the `registrations` and
-- `registration_events` tables) already being applied.
-- ============================================================================

create or replace function public.get_public_summary_stats()
returns table (
  colleges_registered bigint,
  total_entries bigint,
  colleges_this_week bigint,
  entries_this_week bigint
)
language sql
security definer
set search_path to 'public'
as $function$
  select count(distinct r.id) as colleges_registered,
    count(e.id) as total_entries,
    count(distinct r.id) filter (where r.created_at >= now() - interval '7 days') as colleges_this_week,
    count(e.id) filter (where r.created_at >= now() - interval '7 days') as entries_this_week
  from public.registrations r
  left join public.registration_events e on e.registration_id = r.id;
$function$;

create or replace function public.get_public_event_counts()
returns table (
  event_code text,
  entries bigint
)
language sql
security definer
set search_path to 'public'
as $function$
  select e.event_code, count(*) as entries
  from public.registration_events e
  group by e.event_code;
$function$;

create or replace function public.get_public_region_counts()
returns table (
  region text,
  colleges bigint
)
language sql
security definer
set search_path to 'public'
as $function$
  select r.region, count(distinct r.id) as colleges
  from public.registrations r
  group by r.region;
$function$;

create or replace function public.get_public_weekly_trend()
returns table (
  week_start date,
  new_regs bigint,
  cumulative bigint
)
language sql
security definer
set search_path to 'public'
as $function$
  with weeks as (
    select date_trunc('week', r.created_at)::date as week_start, count(*) as new_regs
    from public.registrations r
    group by 1
  )
  select week_start, new_regs, sum(new_regs) over (order by week_start) as cumulative
  from weeks
  order by week_start;
$function$;

-- Public, read-only, no PII (no captain name/email -- those stay behind admin_registrations_view)
-- -- same trust boundary as get_team_standings/get_head_to_head.
revoke execute on function public.get_public_summary_stats() from public;
revoke execute on function public.get_public_event_counts() from public;
revoke execute on function public.get_public_region_counts() from public;
revoke execute on function public.get_public_weekly_trend() from public;
grant execute on function public.get_public_summary_stats() to anon, authenticated;
grant execute on function public.get_public_event_counts() to anon, authenticated;
grant execute on function public.get_public_region_counts() to anon, authenticated;
grant execute on function public.get_public_weekly_trend() to anon, authenticated;
