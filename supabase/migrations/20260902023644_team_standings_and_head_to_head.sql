-- Team standings and head-to-head stats for the Match Center's "Event Statistics" tab.
--
-- Both functions are plain SQL, STABLE, and deliberately NOT SECURITY DEFINER: they read
-- through the caller's own privileges, relying on the existing public-SELECT RLS policies on
-- `matches` and `match_games` (see live_scoring_match_stats_schema /
-- live_scoring_match_stats_grants) rather than bypassing them. That's intentional and was
-- verified end-to-end against a real anon-role session before this file was written — see the
-- pre-deployment security review for this feature. Only completed matches are ever considered;
-- abandoned/in-progress matches are excluded so stats never reflect an unfinished result.
--
-- Applied to apex-badminton-prod on 2026-09-02 as Supabase migration
-- `team_standings_and_head_to_head` (version 20260902023644). This file makes that change
-- reviewable and reproducible in dev/qa instead of existing only as prod-only state.

create or replace function public.get_team_standings(p_event_code text default null, p_stage text default null)
returns table (
  college text,
  matches_played bigint,
  matches_won bigint,
  matches_lost bigint,
  games_won bigint,
  games_lost bigint,
  points_won bigint,
  points_lost bigint,
  point_diff bigint
)
language sql
stable
set search_path = 'public'
as $$
  with relevant_matches as (
    select m.*
    from public.matches m
    where m.status = 'completed'
      and (p_event_code is null or m.event_code = p_event_code)
      and (p_stage is null or m.stage = p_stage)
  ),
  game_agg as (
    select mg.match_id,
      sum(mg.a_score) as a_points, sum(mg.b_score) as b_points,
      count(*) filter (where mg.winner_side = 'A') as a_games,
      count(*) filter (where mg.winner_side = 'B') as b_games
    from public.match_games mg
    where mg.match_id in (select id from relevant_matches)
    group by mg.match_id
  ),
  sides as (
    select rm.college_a as college,
           (rm.winner_side = 'A') as won,
           coalesce(ga.a_points, 0) as points_for,
           coalesce(ga.b_points, 0) as points_against,
           coalesce(ga.a_games, 0) as games_for,
           coalesce(ga.b_games, 0) as games_against
    from relevant_matches rm
    left join game_agg ga on ga.match_id = rm.id
    union all
    select rm.college_b as college,
           (rm.winner_side = 'B') as won,
           coalesce(ga.b_points, 0),
           coalesce(ga.a_points, 0),
           coalesce(ga.b_games, 0),
           coalesce(ga.a_games, 0)
    from relevant_matches rm
    left join game_agg ga on ga.match_id = rm.id
  )
  select
    college,
    count(*)::bigint as matches_played,
    count(*) filter (where won)::bigint as matches_won,
    count(*) filter (where not won)::bigint as matches_lost,
    sum(games_for)::bigint as games_won,
    sum(games_against)::bigint as games_lost,
    sum(points_for)::bigint as points_won,
    sum(points_against)::bigint as points_lost,
    (sum(points_for) - sum(points_against))::bigint as point_diff
  from sides
  group by college
  order by matches_won desc, point_diff desc, college asc;
$$;

create or replace function public.get_head_to_head(p_college_a text, p_college_b text, p_event_code text default null)
returns table (
  college_a text,
  college_b text,
  matches_played bigint,
  college_a_wins bigint,
  college_b_wins bigint,
  college_a_points bigint,
  college_b_points bigint
)
language sql
stable
set search_path = 'public'
as $$
  with relevant as (
    select m.id, m.winner_side,
           (m.college_a = p_college_a) as a_is_first_arg
    from public.matches m
    where m.status = 'completed'
      and (p_event_code is null or m.event_code = p_event_code)
      and ((m.college_a = p_college_a and m.college_b = p_college_b)
        or (m.college_a = p_college_b and m.college_b = p_college_a))
  ),
  game_points as (
    select mg.match_id, sum(mg.a_score) as a_points, sum(mg.b_score) as b_points
    from public.match_games mg
    where mg.match_id in (select id from relevant)
    group by mg.match_id
  )
  select
    p_college_a,
    p_college_b,
    count(*)::bigint as matches_played,
    count(*) filter (
      where (r.a_is_first_arg and r.winner_side = 'A') or (not r.a_is_first_arg and r.winner_side = 'B')
    )::bigint as college_a_wins,
    count(*) filter (
      where (r.a_is_first_arg and r.winner_side = 'B') or (not r.a_is_first_arg and r.winner_side = 'A')
    )::bigint as college_b_wins,
    coalesce(sum(case when r.a_is_first_arg then gp.a_points else gp.b_points end), 0)::bigint as college_a_points,
    coalesce(sum(case when r.a_is_first_arg then gp.b_points else gp.a_points end), 0)::bigint as college_b_points
  from relevant r
  left join game_points gp on gp.match_id = r.id;
$$;

-- Both functions read data that's already public (completed match results), so grant EXECUTE
-- explicitly to anon and authenticated rather than relying on the implicit default PUBLIC grant
-- Postgres adds at CREATE FUNCTION time -- being explicit here matches the pattern used for the
-- other public analytics RPCs and keeps intent auditable in `get_advisors` / grant listings.
grant execute on function public.get_team_standings(text, text) to anon, authenticated;
grant execute on function public.get_head_to_head(text, text, text) to anon, authenticated;
