-- QA-schema counterpart to the three prod migrations added in commit
-- "Add Standings/Head-to-Head stats and version the Live Scoring persistence schema":
--   20260902022451_live_scoring_match_stats_schema.sql
--   20260902022728_live_scoring_match_stats_grants.sql
--   20260902023644_team_standings_and_head_to_head.sql
--
-- QA runs inside the apex-badminton-dev project but in its own Postgres schema ("qa") rather
-- than "public", per ENVIRONMENTS.md -- so every object below is schema-qualified `qa.` instead
-- of `public.`, mirroring the existing QA baseline (registrations/admin auth/analytics) that was
-- already replicated into the qa schema before tonight's Live Scoring / stats work existed.
--
-- ASSUMPTION, not yet independently verified by this session: `qa.is_admin()` already exists as
-- part of that earlier QA replication (ENVIRONMENTS.md describes QA as having its own "fully
-- separate tables, RLS policies, and functions" mirroring Dev's public schema). This file was
-- written without live access to the apex-badminton-dev project -- run the verification block at
-- the bottom first, and if `qa.is_admin()` does NOT exist, stop and replicate the admin-auth
-- baseline into `qa` before running the rest of this file, rather than assuming this SQL is safe
-- to run as-is.

-- ---- verify prerequisites before running anything below ----
-- select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'qa' and p.proname = 'is_admin') as qa_is_admin_exists;
-- select exists (select 1 from pg_namespace where nspname = 'qa') as qa_schema_exists;

create schema if not exists qa;

create table qa.matches (
  id uuid primary key default gen_random_uuid(),
  stage text not null check (stage in ('roundrobin', 'knockout')),
  format text not null check (format in ('single', 'bo3')),
  event_code text not null check (event_code in ('MS', 'WS', 'MD', 'WD', 'XD', 'TEAM')),
  college_a text not null check (college_a in ('TCNJ', 'Rutgers', 'Rider University')),
  college_b text not null check (college_b in ('TCNJ', 'Rutgers', 'Rider University')),
  side_a_player_ids uuid[] not null default '{}'::uuid[],
  side_b_player_ids uuid[] not null default '{}'::uuid[],
  side_a_name text not null,
  side_b_name text not null,
  first_server text not null check (first_server in ('A', 'B')),
  winner_side text check (winner_side in ('A', 'B')),
  status text not null default 'completed' check (status in ('completed', 'abandoned')),
  scored_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint matches_side_a_player_count check (array_length(side_a_player_ids, 1) is null or array_length(side_a_player_ids, 1) <= 2),
  constraint matches_side_b_player_count check (array_length(side_b_player_ids, 1) is null or array_length(side_b_player_ids, 1) <= 2)
);

create index matches_event_code_idx on qa.matches (event_code);
create index matches_college_a_idx on qa.matches (college_a);
create index matches_college_b_idx on qa.matches (college_b);
create index matches_side_a_player_ids_idx on qa.matches using gin (side_a_player_ids);
create index matches_side_b_player_ids_idx on qa.matches using gin (side_b_player_ids);

create table qa.match_games (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references qa.matches(id) on delete cascade,
  game_index integer not null check (game_index >= 0),
  a_score integer not null check (a_score >= 0),
  b_score integer not null check (b_score >= 0),
  winner_side text check (winner_side in ('A', 'B')),
  unique (match_id, game_index)
);

create index match_games_match_id_idx on qa.match_games (match_id);

create table qa.match_points (
  id bigint primary key generated always as identity,
  match_id uuid not null references qa.matches(id) on delete cascade,
  game_index integer not null check (game_index >= 0),
  point_index integer not null check (point_index >= 1),
  scoring_side text not null check (scoring_side in ('A', 'B')),
  server_side text not null check (server_side in ('A', 'B')),
  unique (match_id, game_index, point_index)
);

create index match_points_match_id_idx on qa.match_points (match_id, game_index);

alter table qa.matches enable row level security;
alter table qa.match_games enable row level security;
alter table qa.match_points enable row level security;

grant usage on schema qa to anon, authenticated;
grant select on qa.matches, qa.match_games, qa.match_points to anon, authenticated;
grant insert, update, delete on qa.matches, qa.match_games, qa.match_points to authenticated;

create policy "public can select matches" on qa.matches for select using (true);
create policy "admins can insert matches" on qa.matches for insert with check (qa.is_admin());
create policy "admins can update matches" on qa.matches for update using (qa.is_admin());
create policy "admins can delete matches" on qa.matches for delete using (qa.is_admin());

create policy "public can select match_games" on qa.match_games for select using (true);
create policy "admins can insert match_games" on qa.match_games for insert with check (qa.is_admin());
create policy "admins can update match_games" on qa.match_games for update using (qa.is_admin());
create policy "admins can delete match_games" on qa.match_games for delete using (qa.is_admin());

create policy "public can select match_points" on qa.match_points for select using (true);
create policy "admins can insert match_points" on qa.match_points for insert with check (qa.is_admin());
create policy "admins can update match_points" on qa.match_points for update using (qa.is_admin());
create policy "admins can delete match_points" on qa.match_points for delete using (qa.is_admin());

create or replace function qa.get_team_standings(p_event_code text default null, p_stage text default null)
returns table (
  college text, matches_played bigint, matches_won bigint, matches_lost bigint,
  games_won bigint, games_lost bigint, points_won bigint, points_lost bigint, point_diff bigint
)
language sql
stable
set search_path = 'qa'
as $$
  with relevant_matches as (
    select m.*
    from qa.matches m
    where m.status = 'completed'
      and (p_event_code is null or m.event_code = p_event_code)
      and (p_stage is null or m.stage = p_stage)
  ),
  game_agg as (
    select mg.match_id,
      sum(mg.a_score) as a_points, sum(mg.b_score) as b_points,
      count(*) filter (where mg.winner_side = 'A') as a_games,
      count(*) filter (where mg.winner_side = 'B') as b_games
    from qa.match_games mg
    where mg.match_id in (select id from relevant_matches)
    group by mg.match_id
  ),
  sides as (
    select rm.college_a as college, (rm.winner_side = 'A') as won,
           coalesce(ga.a_points, 0) as points_for, coalesce(ga.b_points, 0) as points_against,
           coalesce(ga.a_games, 0) as games_for, coalesce(ga.b_games, 0) as games_against
    from relevant_matches rm left join game_agg ga on ga.match_id = rm.id
    union all
    select rm.college_b as college, (rm.winner_side = 'B') as won,
           coalesce(ga.b_points, 0), coalesce(ga.a_points, 0),
           coalesce(ga.b_games, 0), coalesce(ga.a_games, 0)
    from relevant_matches rm left join game_agg ga on ga.match_id = rm.id
  )
  select college,
    count(*)::bigint, count(*) filter (where won)::bigint, count(*) filter (where not won)::bigint,
    sum(games_for)::bigint, sum(games_against)::bigint,
    sum(points_for)::bigint, sum(points_against)::bigint,
    (sum(points_for) - sum(points_against))::bigint
  from sides
  group by college
  order by 3 desc, 9 desc, college asc;
$$;

create or replace function qa.get_head_to_head(p_college_a text, p_college_b text, p_event_code text default null)
returns table (
  college_a text, college_b text, matches_played bigint,
  college_a_wins bigint, college_b_wins bigint, college_a_points bigint, college_b_points bigint
)
language sql
stable
set search_path = 'qa'
as $$
  with relevant as (
    select m.id, m.winner_side, (m.college_a = p_college_a) as a_is_first_arg
    from qa.matches m
    where m.status = 'completed'
      and (p_event_code is null or m.event_code = p_event_code)
      and ((m.college_a = p_college_a and m.college_b = p_college_b)
        or (m.college_a = p_college_b and m.college_b = p_college_a))
  ),
  game_points as (
    select mg.match_id, sum(mg.a_score) as a_points, sum(mg.b_score) as b_points
    from qa.match_games mg
    where mg.match_id in (select id from relevant)
    group by mg.match_id
  )
  select
    p_college_a, p_college_b, count(*)::bigint,
    count(*) filter (where (r.a_is_first_arg and r.winner_side = 'A') or (not r.a_is_first_arg and r.winner_side = 'B'))::bigint,
    count(*) filter (where (r.a_is_first_arg and r.winner_side = 'B') or (not r.a_is_first_arg and r.winner_side = 'A'))::bigint,
    coalesce(sum(case when r.a_is_first_arg then gp.a_points else gp.b_points end), 0)::bigint,
    coalesce(sum(case when r.a_is_first_arg then gp.b_points else gp.a_points end), 0)::bigint
  from relevant r left join game_points gp on gp.match_id = r.id;
$$;

grant execute on function qa.get_team_standings(text, text) to anon, authenticated;
grant execute on function qa.get_head_to_head(text, text, text) to anon, authenticated;
