-- Live Scoring persistence schema: one row per finished/abandoned match, one row per game
-- within it, and one row per point scored -- backing both the Live Scoring admin tool
-- (src/lib/matchStats.ts) and the public Match Center stats tab that reads aggregates off of it.
--
-- Player identity is display-text only for now (side_a_name/side_b_name); side_a_player_ids /
-- side_b_player_ids are carried as uuid[] so a future roster (public.players) can be linked up
-- without a schema change -- see the "Backfill migration for player_id links" punch-list item.
--
-- Applied to apex-badminton-prod on 2026-09-02 as Supabase migration
-- `live_scoring_match_stats_schema` (version 20260902022451). RLS enablement lives here;
-- policies and grants are in the companion `live_scoring_match_stats_grants` migration
-- (20260902022728_live_scoring_match_stats_grants.sql) so the two can be reasoned about (and,
-- if ever needed, rolled back) independently.

create table public.matches (
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

create index matches_event_code_idx on public.matches (event_code);
create index matches_college_a_idx on public.matches (college_a);
create index matches_college_b_idx on public.matches (college_b);
create index matches_side_a_player_ids_idx on public.matches using gin (side_a_player_ids);
create index matches_side_b_player_ids_idx on public.matches using gin (side_b_player_ids);

create table public.match_games (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  game_index integer not null check (game_index >= 0),
  a_score integer not null check (a_score >= 0),
  b_score integer not null check (b_score >= 0),
  winner_side text check (winner_side in ('A', 'B')),
  unique (match_id, game_index)
);

create index match_games_match_id_idx on public.match_games (match_id);

create table public.match_points (
  id bigint primary key generated always as identity,
  match_id uuid not null references public.matches(id) on delete cascade,
  game_index integer not null check (game_index >= 0),
  point_index integer not null check (point_index >= 1),
  scoring_side text not null check (scoring_side in ('A', 'B')),
  server_side text not null check (server_side in ('A', 'B')),
  unique (match_id, game_index, point_index)
);

create index match_points_match_id_idx on public.match_points (match_id, game_index);

alter table public.matches enable row level security;
alter table public.match_games enable row level security;
alter table public.match_points enable row level security;
