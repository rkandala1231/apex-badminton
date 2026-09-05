-- ============================================================================
-- Match KPI MVP: point-win %, point differential, longest scoring streak, clutch-point win rate,
-- and match result/score -- computed server-side from the point-by-point rally log that Live
-- Scoring already writes to `match_points` (live_scoring_match_stats_schema, 20260902022451).
--
-- Deliberately reuses the existing `matches` / `match_games` / `match_points` tables instead of
-- introducing a parallel Match/Game/Rally schema: `match_points` already IS a rally log
-- (game_index, point_index, scoring_side), so every KPI below is computed by replaying it --
-- score-before/after each point is derived, not stored, keeping this migration additive only.
--
-- What this migration adds:
--   1. Five columns on `matches` (target_points, win_by_two, max_points, best_of_games,
--      is_synthetic, external_video_id) plus `started_at`, so a match's scoring format is data,
--      not a hardcoded constant -- existing rows backfill to 15/win-by-two/cap-16, which is the
--      real rule apex-badminton's Live Scoring has always played under
--      (src/components/matchcenter/livescoring/constants.ts: POINTS_TO_WIN=15, WIN_BY=2,
--      HARD_CAP=16). New matches created the old way (matchStats.ts, which never sets these
--      columns) keep getting that same default -- this migration changes no existing behavior.
--   2. `public.players` -- a minimal roster keyed off `matches.side_a_player_ids` /
--      `side_b_player_ids` (uuid[] columns that have existed since 20260902022451 specifically as
--      this forward-compat seam, always empty until now). Scoped narrowly to what this feature
--      needs (tagging who played a KPI-tracked match, and giving the synthetic-data generator
--      real rows to reference) -- NOT the full self-service/CSV roster-import feature still
--      tracked as a separate, open PRD item ("Roster management" on the punch list). Both public
--      Match Center Players and the admin Players section are untouched by this migration.
--   3. `public.app_config` -- a locked-down (RLS enabled, no policies, same posture as
--      `admins`/`admin_allowlist`) single-row settings table whose only current use is gating
--      synthetic-data generation off by default in every environment, including prod. Enabling it
--      is a deliberate, manual, one-time action against a specific Supabase project -- see the
--      comment above `generate_synthetic_kpi_matches()` below.
--   4. RPC functions, following this repo's existing convention (verb-first writes, `get_`-prefix
--      reads, `p_`-prefixed args, `security definer` + explicit `is_admin()` check rather than
--      relying on the EXECUTE grant alone -- see create_admin_account/register_for_apex):
--        create_player, create_match, record_match_point, undo_last_match_point, complete_match,
--        get_match_kpis, generate_synthetic_kpi_matches, delete_synthetic_kpi_matches.
--      These are this app's answer to the KPI spec's REST endpoints (POST /api/matches, etc.) --
--      there is no REST layer in this app; every write/read goes through Postgres RPC from the
--      browser via supabase-js, same as register_for_apex/get_team_standings/is_admin.
-- ============================================================================

-- ---------------------------------------------------------------------------------------------
-- 1. `matches` — scoring-format + lifecycle columns
-- ---------------------------------------------------------------------------------------------

alter table public.matches add column if not exists target_points integer not null default 15;
alter table public.matches add column if not exists win_by_two boolean not null default true;
alter table public.matches add column if not exists max_points integer;
alter table public.matches add column if not exists is_synthetic boolean not null default false;
alter table public.matches add column if not exists external_video_id text;
alter table public.matches add column if not exists started_at timestamptz;
alter table public.matches add column if not exists best_of_games integer;

-- Existing rows (and any future insert going through the unchanged matchStats.ts path, which
-- never sets these columns) played under the real, hardcoded Live Scoring rule: first to 15,
-- win-by-two, capped at 16.
update public.matches set max_points = 16 where max_points is null;

-- started_at didn't exist before this migration -- every existing row already has a `created_at`
-- from the moment Live Scoring started it (or, for the saveMatchResult fallback, the moment it
-- was saved), so that's the correct backfill for "when did this match start".
update public.matches set started_at = created_at where started_at is null;

-- best_of_games depends on the existing `format` column ('single' | 'bo3') -- backfill from it,
-- then make future inserts self-sufficient via a trigger (below) rather than a static column
-- default, so the old matchStats.ts insert path (which sets `format` but has never heard of
-- `best_of_games`) keeps working unchanged.
update public.matches set best_of_games = case when format = 'single' then 1 else 3 end
  where best_of_games is null;
alter table public.matches alter column best_of_games set not null;

do $$ begin
  alter table public.matches add constraint matches_best_of_games_check
    check (best_of_games > 0 and best_of_games % 2 = 1);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.matches add constraint matches_max_points_check
    check (win_by_two = false or (max_points is not null and max_points > target_points));
exception when duplicate_object then null;
end $$;

create or replace function public._set_default_best_of_games()
returns trigger
language plpgsql
as $$
begin
  if new.best_of_games is null then
    new.best_of_games := case when new.format = 'single' then 1 else 3 end;
  end if;
  return new;
end;
$$;

drop trigger if exists matches_default_best_of_games on public.matches;
create trigger matches_default_best_of_games
  before insert on public.matches
  for each row execute function public._set_default_best_of_games();

-- Adds the pre-scoring lifecycle state the KPI spec's Match.status/scheduledAt/startedAt model
-- needs (a match created via create_match() below but not yet started) -- 'in_progress',
-- 'completed', 'abandoned' already existed (matches_allow_in_progress_status, 20260905000000).
-- `created_at` already serves as "scheduledAt"; no separate column needed for it.
alter table public.matches drop constraint matches_status_check;
alter table public.matches add constraint matches_status_check
  check (status in ('scheduled', 'in_progress', 'completed', 'abandoned'));

-- ---------------------------------------------------------------------------------------------
-- 2. `public.players` — minimal roster (KPI-feature-scoped; see header comment)
-- ---------------------------------------------------------------------------------------------

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  college text check (college in ('TCNJ', 'Rutgers', 'Rider University')),
  is_synthetic boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists players_college_idx on public.players (college);

alter table public.players enable row level security;

grant select on public.players to anon, authenticated;
grant insert, update, delete on public.players to authenticated;

drop policy if exists "public can select players" on public.players;
create policy "public can select players" on public.players
  for select
  using (true);

drop policy if exists "admins can insert players" on public.players;
create policy "admins can insert players" on public.players
  for insert
  with check (public.is_admin());

drop policy if exists "admins can update players" on public.players;
create policy "admins can update players" on public.players
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins can delete players" on public.players;
create policy "admins can delete players" on public.players
  for delete
  using (public.is_admin());

-- ---------------------------------------------------------------------------------------------
-- 3. `public.app_config` — locked down, no direct policies (same posture as admin_allowlist)
-- ---------------------------------------------------------------------------------------------

create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
-- Deliberately no grants/policies at all -- every access goes through a SECURITY DEFINER
-- function (below), matching admins/admin_allowlist's lockdown posture exactly.

insert into public.app_config (key, value)
values ('allow_synthetic_data', 'false')
on conflict (key) do nothing;

create or replace function public._synthetic_data_allowed()
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select coalesce((select value from public.app_config where key = 'allow_synthetic_data'), 'false') = 'true';
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Scoring-rule helper (shared by point recording, undo, and KPI replay)
-- ---------------------------------------------------------------------------------------------

create or replace function public._game_winner(p_a integer, p_b integer, p_target integer, p_win_by_two boolean, p_max integer)
returns text
language plpgsql
immutable
as $$
begin
  if not p_win_by_two then
    if p_a >= p_target then return 'A'; end if;
    if p_b >= p_target then return 'B'; end if;
    return null;
  end if;

  if p_max is not null and p_a >= p_max then return 'A'; end if;
  if p_max is not null and p_b >= p_max then return 'B'; end if;

  if p_a >= p_target and (p_a - p_b) >= 2 then return 'A'; end if;
  if p_b >= p_target and (p_b - p_a) >= 2 then return 'B'; end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Player + match creation
-- ---------------------------------------------------------------------------------------------

create or replace function public.create_player(p_name text, p_college text default null, p_is_synthetic boolean default false)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_name is null or trim(p_name) = '' then
    raise exception 'player name is required';
  end if;

  insert into public.players (name, college, is_synthetic)
  values (trim(p_name), p_college, coalesce(p_is_synthetic, false))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.create_match(
  p_event_code text,
  p_stage text,
  p_college_a text,
  p_college_b text,
  p_side_a_name text,
  p_side_b_name text,
  p_side_a_player_ids uuid[] default '{}'::uuid[],
  p_side_b_player_ids uuid[] default '{}'::uuid[],
  p_target_points integer default 21,
  p_win_by_two boolean default true,
  p_max_points integer default 30,
  p_best_of_games integer default 3,
  p_first_server text default 'A',
  p_is_synthetic boolean default false,
  p_external_video_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_id uuid;
  v_format text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_target_points is null or p_target_points <= 0 then
    raise exception 'target_points must be positive';
  end if;
  if p_win_by_two and (p_max_points is null or p_max_points <= p_target_points) then
    raise exception 'max_points must be greater than target_points when win_by_two is true';
  end if;
  if p_best_of_games is null or p_best_of_games <= 0 or p_best_of_games % 2 = 0 then
    raise exception 'best_of_games must be a positive odd number';
  end if;

  v_format := case when p_best_of_games = 1 then 'single' else 'bo3' end;

  insert into public.matches (
    stage, format, event_code, college_a, college_b,
    side_a_player_ids, side_b_player_ids, side_a_name, side_b_name,
    first_server, status, target_points, win_by_two, max_points, best_of_games,
    is_synthetic, external_video_id
  ) values (
    p_stage, v_format, p_event_code, p_college_a, p_college_b,
    coalesce(p_side_a_player_ids, '{}'::uuid[]), coalesce(p_side_b_player_ids, '{}'::uuid[]),
    p_side_a_name, p_side_b_name,
    p_first_server, 'scheduled', p_target_points, p_win_by_two, p_max_points, p_best_of_games,
    coalesce(p_is_synthetic, false), p_external_video_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. Point-by-point scoring: record / undo / complete
-- ---------------------------------------------------------------------------------------------

-- Internal -- shared by record_match_point() and generate_synthetic_kpi_matches() so both go
-- through the exact same rules engine (no parallel/duplicated scoring logic that could drift).
create or replace function public._apply_match_point(p_match_id uuid, p_winning_side text)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_match record;
  v_games_won_a integer;
  v_games_won_b integer;
  v_required_wins integer;
  v_game_index integer;
  v_a integer;
  v_b integer;
  v_winner text;
  v_next_point integer;
  v_server text;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match not found';
  end if;
  if v_match.status in ('completed', 'abandoned') then
    raise exception 'match is no longer being scored';
  end if;
  if p_winning_side not in ('A', 'B') then
    raise exception 'winning side must be A or B';
  end if;

  select count(*) filter (where winner_side = 'A'), count(*) filter (where winner_side = 'B')
    into v_games_won_a, v_games_won_b
    from public.match_games where match_id = p_match_id;
  v_required_wins := (v_match.best_of_games / 2) + 1;
  if v_games_won_a >= v_required_wins or v_games_won_b >= v_required_wins then
    raise exception 'match is already decided -- call complete_match to finalize it';
  end if;

  select game_index, a_score, b_score, winner_side
    into v_game_index, v_a, v_b, v_winner
    from public.match_games where match_id = p_match_id
    order by game_index desc limit 1;

  if not found or v_winner is not null then
    v_game_index := coalesce(v_game_index, -1) + 1;
    v_a := 0;
    v_b := 0;
    insert into public.match_games (match_id, game_index, a_score, b_score, winner_side)
    values (p_match_id, v_game_index, 0, 0, null);
  end if;

  select coalesce(max(point_index), 0) + 1 into v_next_point
    from public.match_points where match_id = p_match_id and game_index = v_game_index;

  if v_next_point = 1 then
    -- First point of a game: game 0 starts with the match's declared first server; later games
    -- alternate from it. Not KPI-relevant (no KPI here uses server_side) -- just satisfies the
    -- existing not-null column and keeps the point log structurally consistent.
    v_server := case
      when v_game_index % 2 = 0 then v_match.first_server
      else (case when v_match.first_server = 'A' then 'B' else 'A' end)
    end;
  else
    select scoring_side into v_server from public.match_points
      where match_id = p_match_id and game_index = v_game_index and point_index = v_next_point - 1;
  end if;

  insert into public.match_points (match_id, game_index, point_index, scoring_side, server_side)
  values (p_match_id, v_game_index, v_next_point, p_winning_side, v_server);

  if p_winning_side = 'A' then v_a := v_a + 1; else v_b := v_b + 1; end if;
  v_winner := public._game_winner(v_a, v_b, v_match.target_points, v_match.win_by_two, v_match.max_points);

  update public.match_games set a_score = v_a, b_score = v_b, winner_side = v_winner
    where match_id = p_match_id and game_index = v_game_index;

  if v_match.status = 'scheduled' then
    update public.matches set status = 'in_progress', started_at = coalesce(started_at, now())
      where id = p_match_id;
  end if;

  if v_winner is not null then
    if v_winner = 'A' then v_games_won_a := v_games_won_a + 1; else v_games_won_b := v_games_won_b + 1; end if;
  end if;

  return jsonb_build_object(
    'gameIndex', v_game_index,
    'sideAScore', v_a,
    'sideBScore', v_b,
    'gameWinner', v_winner,
    'gamesWonA', v_games_won_a,
    'gamesWonB', v_games_won_b,
    'matchReadyToComplete', (v_games_won_a >= v_required_wins or v_games_won_b >= v_required_wins)
  );
end;
$$;

create or replace function public.record_match_point(p_match_id uuid, p_winning_side text)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return public._apply_match_point(p_match_id, p_winning_side);
end;
$$;

create or replace function public.undo_last_match_point(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_status text;
  v_match record;
  v_game_index integer;
  v_point_index integer;
  v_new_a integer;
  v_new_b integer;
  v_winner text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match not found';
  end if;
  if v_match.status = 'completed' then
    raise exception 'cannot undo a point on a completed match';
  end if;

  select game_index, point_index into v_game_index, v_point_index
    from public.match_points where match_id = p_match_id
    order by game_index desc, point_index desc limit 1;
  if not found then
    raise exception 'no points to undo';
  end if;

  delete from public.match_points
    where match_id = p_match_id and game_index = v_game_index and point_index = v_point_index;

  select count(*) filter (where scoring_side = 'A'), count(*) filter (where scoring_side = 'B')
    into v_new_a, v_new_b
    from public.match_points where match_id = p_match_id and game_index = v_game_index;

  if v_new_a = 0 and v_new_b = 0 then
    delete from public.match_games where match_id = p_match_id and game_index = v_game_index;
  else
    v_winner := public._game_winner(v_new_a, v_new_b, v_match.target_points, v_match.win_by_two, v_match.max_points);
    update public.match_games set a_score = v_new_a, b_score = v_new_b, winner_side = v_winner
      where match_id = p_match_id and game_index = v_game_index;
  end if;

  return jsonb_build_object('gameIndex', v_game_index, 'sideAScore', v_new_a, 'sideBScore', v_new_b);
end;
$$;

create or replace function public.complete_match(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_match record;
  v_games_won_a integer;
  v_games_won_b integer;
  v_required_wins integer;
  v_winner text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match not found';
  end if;
  if v_match.status = 'completed' then
    raise exception 'match is already completed';
  end if;

  select count(*) filter (where winner_side = 'A'), count(*) filter (where winner_side = 'B')
    into v_games_won_a, v_games_won_b
    from public.match_games where match_id = p_match_id;
  v_required_wins := (v_match.best_of_games / 2) + 1;

  if v_games_won_a < v_required_wins and v_games_won_b < v_required_wins then
    raise exception 'match is not yet decided -- keep scoring, or undo back to a decided state';
  end if;

  v_winner := case when v_games_won_a >= v_required_wins then 'A' else 'B' end;

  update public.matches
    set status = 'completed', winner_side = v_winner, completed_at = now()
    where id = p_match_id;

  return jsonb_build_object('matchId', p_match_id, 'winningSide', v_winner);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 7. get_match_kpis — the one backend-authoritative source of all five KPIs
-- ---------------------------------------------------------------------------------------------

create or replace function public.get_match_kpis(p_match_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_match record;
  v_games jsonb;
  v_total_a integer := 0;
  v_total_b integer := 0;
  v_clutch_played integer := 0;
  v_clutch_won_a integer := 0;
  v_clutch_won_b integer := 0;
  v_best_a jsonb := null;
  v_best_b jsonb := null;
  v_run_side text := null;
  v_run_len integer := 0;
  v_run_game integer := null;
  v_run_start_a integer := 0;
  v_run_start_b integer := 0;
  v_cur_a integer := 0;
  v_cur_b integer := 0;
  v_cur_game integer := -1;
  v_clutch_threshold integer;
  rec record;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found then
    raise exception 'match not found';
  end if;

  v_clutch_threshold := v_match.target_points - 3;

  select coalesce(jsonb_agg(jsonb_build_object(
      'game', g.game_index + 1,
      'sideA', g.a_score,
      'sideB', g.b_score,
      'winner', g.winner_side,
      'sideAPointWinPercentage',
        case when (g.a_score + g.b_score) = 0 then 0
          else round((g.a_score::numeric / (g.a_score + g.b_score)) * 100, 2) end,
      'sideBPointWinPercentage',
        case when (g.a_score + g.b_score) = 0 then 0
          else round((g.b_score::numeric / (g.a_score + g.b_score)) * 100, 2) end
    ) order by g.game_index), '[]'::jsonb)
    into v_games
    from public.match_games g where g.match_id = p_match_id;

  -- Single pass over the full rally log, in play order, to derive: totals, the longest
  -- same-side streak per side (with the game/start/end score it happened in), and clutch points
  -- (both sides at target-3, margin <= 2 *before* the point is played).
  for rec in
    select game_index, point_index, scoring_side
    from public.match_points
    where match_id = p_match_id
    order by game_index, point_index
  loop
    if rec.game_index <> v_cur_game then
      v_cur_game := rec.game_index;
      v_cur_a := 0;
      v_cur_b := 0;
      v_run_side := null;
      v_run_len := 0;
    end if;

    if rec.scoring_side = 'A' then v_total_a := v_total_a + 1; else v_total_b := v_total_b + 1; end if;

    -- Clutch eligibility uses the score BEFORE this point (v_cur_a/v_cur_b, not yet incremented).
    if v_cur_a >= v_clutch_threshold and v_cur_b >= v_clutch_threshold and abs(v_cur_a - v_cur_b) <= 2 then
      v_clutch_played := v_clutch_played + 1;
      if rec.scoring_side = 'A' then v_clutch_won_a := v_clutch_won_a + 1; else v_clutch_won_b := v_clutch_won_b + 1; end if;
    end if;

    if rec.scoring_side = v_run_side then
      v_run_len := v_run_len + 1;
    else
      v_run_side := rec.scoring_side;
      v_run_len := 1;
      v_run_game := rec.game_index;
      v_run_start_a := v_cur_a;
      v_run_start_b := v_cur_b;
    end if;

    if rec.scoring_side = 'A' then v_cur_a := v_cur_a + 1; else v_cur_b := v_cur_b + 1; end if;

    -- v_run_side always equals rec.scoring_side at this point (just set above), so this records
    -- the running streak as the new best-for-that-side whenever it's a new high.
    if v_run_side = 'A' then
      if v_best_a is null or v_run_len > (v_best_a->>'length')::int then
        v_best_a := jsonb_build_object(
          'length', v_run_len, 'game', v_run_game + 1,
          'startA', v_run_start_a, 'startB', v_run_start_b,
          'endA', v_cur_a, 'endB', v_cur_b
        );
      end if;
    else
      if v_best_b is null or v_run_len > (v_best_b->>'length')::int then
        v_best_b := jsonb_build_object(
          'length', v_run_len, 'game', v_run_game + 1,
          'startA', v_run_start_a, 'startB', v_run_start_b,
          'endA', v_cur_a, 'endB', v_cur_b
        );
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'matchId', p_match_id,
    'eventCode', v_match.event_code,
    'matchType', case when v_match.event_code in ('MS', 'WS') then 'singles' else 'doubles' end,
    'status', v_match.status,
    'winningSide', v_match.winner_side,
    'sideAName', v_match.side_a_name,
    'sideBName', v_match.side_b_name,
    'collegeA', v_match.college_a,
    'collegeB', v_match.college_b,
    'targetPoints', v_match.target_points,
    'winByTwo', v_match.win_by_two,
    'maxPoints', v_match.max_points,
    'bestOfGames', v_match.best_of_games,
    'isSynthetic', v_match.is_synthetic,
    'externalVideoId', v_match.external_video_id,
    'scheduledAt', v_match.created_at,
    'startedAt', v_match.started_at,
    'completedAt', v_match.completed_at,
    'gameScores', v_games,
    'sideA', jsonb_build_object(
      'pointsWon', v_total_a,
      'pointsLost', v_total_b,
      'pointWinPercentage', case when (v_total_a + v_total_b) = 0 then 0
        else round((v_total_a::numeric / (v_total_a + v_total_b)) * 100, 2) end,
      'pointDifferential', v_total_a - v_total_b,
      'longestScoringStreak', coalesce((v_best_a->>'length')::int, 0),
      'longestStreakDetail', v_best_a,
      'clutchPointsWon', v_clutch_won_a,
      'clutchPointsPlayed', v_clutch_played,
      'clutchPointWinPercentage', case when v_clutch_played = 0 then null
        else round((v_clutch_won_a::numeric / v_clutch_played) * 100, 2) end
    ),
    'sideB', jsonb_build_object(
      'pointsWon', v_total_b,
      'pointsLost', v_total_a,
      'pointWinPercentage', case when (v_total_a + v_total_b) = 0 then 0
        else round((v_total_b::numeric / (v_total_a + v_total_b)) * 100, 2) end,
      'pointDifferential', v_total_b - v_total_a,
      'longestScoringStreak', coalesce((v_best_b->>'length')::int, 0),
      'longestStreakDetail', v_best_b,
      'clutchPointsWon', v_clutch_won_b,
      'clutchPointsPlayed', v_clutch_played,
      'clutchPointWinPercentage', case when v_clutch_played = 0 then null
        else round((v_clutch_won_b::numeric / v_clutch_played) * 100, 2) end
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 8. Synthetic test data — deterministic, dev-only
--
-- Disabled by default in EVERY environment (app_config.allow_synthetic_data = 'false', seeded by
-- section 3 above) -- generate_synthetic_kpi_matches() raises an exception unless a super_admin
-- has explicitly flipped that row to 'true' against a SPECIFIC Supabase project. This is a
-- deliberate one-time, manual, per-environment action (same pattern already used for the
-- dev-only bootstrap admin account) -- NOT something a migration (which runs identically against
-- dev and prod) can safely default on anywhere. To enable on dev only, run directly against the
-- dev project's SQL Editor:
--   update public.app_config set value = 'true', updated_at = now() where key = 'allow_synthetic_data';
-- and to turn it back off when done:
--   update public.app_config set value = 'false', updated_at = now() where key = 'allow_synthetic_data';
-- Never run the enabling statement against apex-badminton-prod.
-- ---------------------------------------------------------------------------------------------

create or replace function public.delete_synthetic_kpi_matches()
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_matches_deleted integer;
  v_players_deleted integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  with deleted as (delete from public.matches where is_synthetic = true returning id)
    select count(*) into v_matches_deleted from deleted;

  with deleted as (delete from public.players where is_synthetic = true returning id)
    select count(*) into v_players_deleted from deleted;

  return jsonb_build_object('matchesDeleted', v_matches_deleted, 'playersDeleted', v_players_deleted);
end;
$$;

-- Generates the same 30-match, 20-player synthetic dataset every time it's run (fixed seed
-- 'APEX-KPI-MVP-2026'), by driving the exact same _apply_match_point()/create_match()/
-- complete_match() functions real scoring uses -- so every invariant real matches satisfy
-- (scores never decrease, exactly one side wins each rally, rally numbers sequential, games end
-- per their own target/win-by-two/max-points config, matches end after the required game wins)
-- holds for synthetic matches by construction, not by a second, separately-trusted code path.
--
-- Deterministically re-runnable: always deletes any prior synthetic data first, so calling this
-- twice reproduces the same 30 matches rather than accumulating 60.
--
-- Scenario coverage across the 30 matches (mode = (match index - 1) % 5), verified empirically
-- during development against a local database (see the delivery notes for the exact query used):
--   mode 0/4 -- one side heavily favored every game (bias 0.85/0.92): straight-game, dominant
--              wins, and -- since the margin rarely both closes to target-3 with <=2 apart --
--              the guaranteed source of "no clutch situations" matches.
--   mode 1    -- near-even bias (0.53) every game: close games, and the near-even margin near
--              the target reliably produces clutch points.
--   mode 2    -- games 0/1 split 1-1 (bias 0.82/0.18), decider game starts biased against the
--              eventual winner then flips partway through: three-game matches with a genuine
--              come-from-behind decider.
--   mode 3    -- same 1-1 split, but the decider stays near-even (bias 0.51) throughout: three-
--              game matches whose decider is close enough to reach deuce/extension on the
--              win-by-two (even match-index) matches in the set.
-- Singles/doubles: matches 1-15 singles (MS/WS alternating), 16-30 doubles (MD/WD/XD cycling).
-- Format: odd match index -> APEX 15 (no win-by-two), even -> Standard 21 (win-by-two, cap 30) --
-- so both presets, and both a hard-target finish and a win-by-two/capped finish, appear.
create or replace function public.generate_synthetic_kpi_matches()
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_colleges text[] := array['TCNJ', 'Rutgers', 'Rider University'];
  v_player_ids uuid[] := '{}';
  v_player_college text[] := '{}';
  v_i integer;
  v_match_id uuid;
  v_college_a text;
  v_college_b text;
  v_event text;
  v_target integer;
  v_win_by_two boolean;
  v_max_points integer;
  v_side_a_name text;
  v_side_b_name text;
  v_side_a_ids uuid[];
  v_side_b_ids uuid[];
  v_mode integer;
  v_favored text;
  v_games_won_a integer;
  v_games_won_b integer;
  v_game_no integer;
  v_result jsonb;
  v_side text;
  v_bias numeric;
  v_rallies integer;
  v_iterations integer;
  v_matches_created integer := 0;
  v_pool_a integer[];
  v_pool_b integer[];
  v_pa1 integer;
  v_pa2 integer;
  v_pb1 integer;
  v_pb2 integer;
  v_is_doubles boolean;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if not public._synthetic_data_allowed() then
    raise exception 'synthetic data generation is disabled in this environment';
  end if;

  perform public.delete_synthetic_kpi_matches();
  perform setseed((hashtext('APEX-KPI-MVP-2026')::numeric / 2147483648));

  for v_i in 1..20 loop
    v_player_ids := v_player_ids || public.create_player(
      'Synthetic Player ' || v_i, v_colleges[((v_i - 1) % 3) + 1], true
    );
    v_player_college := v_player_college || v_colleges[((v_i - 1) % 3) + 1];
  end loop;

  for v_i in 1..30 loop
    v_is_doubles := v_i > 15;
    v_college_a := v_colleges[((v_i - 1) % 3) + 1];
    v_college_b := v_colleges[(v_i % 3) + 1];

    if not v_is_doubles then
      v_event := case when v_i % 2 = 0 then 'WS' else 'MS' end;
    else
      v_event := (array['MD', 'WD', 'XD'])[((v_i - 1) % 3) + 1];
    end if;

    if v_i % 2 = 1 then
      v_target := 15;
      v_win_by_two := false;
      v_max_points := null;
    else
      v_target := 21;
      v_win_by_two := true;
      v_max_points := 30;
    end if;

    select array_agg(gs) into v_pool_a from generate_series(1, 20) gs where v_player_college[gs] = v_college_a;
    select array_agg(gs) into v_pool_b from generate_series(1, 20) gs where v_player_college[gs] = v_college_b;

    v_pa1 := v_pool_a[((v_i - 1) % array_length(v_pool_a, 1)) + 1];
    v_pb1 := v_pool_b[((v_i - 1) % array_length(v_pool_b, 1)) + 1];

    if v_is_doubles then
      v_pa2 := v_pool_a[(v_i % array_length(v_pool_a, 1)) + 1];
      v_pb2 := v_pool_b[(v_i % array_length(v_pool_b, 1)) + 1];
      v_side_a_ids := array[v_player_ids[v_pa1], v_player_ids[v_pa2]];
      v_side_b_ids := array[v_player_ids[v_pb1], v_player_ids[v_pb2]];
      v_side_a_name := 'Synthetic Player ' || v_pa1 || '/Synthetic Player ' || v_pa2;
      v_side_b_name := 'Synthetic Player ' || v_pb1 || '/Synthetic Player ' || v_pb2;
    else
      v_side_a_ids := array[v_player_ids[v_pa1]];
      v_side_b_ids := array[v_player_ids[v_pb1]];
      v_side_a_name := 'Synthetic Player ' || v_pa1;
      v_side_b_name := 'Synthetic Player ' || v_pb1;
    end if;

    v_match_id := public.create_match(
      v_event, 'roundrobin', v_college_a, v_college_b, v_side_a_name, v_side_b_name,
      v_side_a_ids, v_side_b_ids, v_target, v_win_by_two, v_max_points, 3, 'A', true, null
    );

    v_mode := (v_i - 1) % 5;
    v_favored := case when v_i % 2 = 0 then 'A' else 'B' end;

    v_games_won_a := 0;
    v_games_won_b := 0;
    v_game_no := 0;
    v_iterations := 0;

    -- best_of_games is always 3 for synthetic matches, so 2 game wins decides it.
    while v_games_won_a < 2 and v_games_won_b < 2 and v_iterations < 400 loop
      v_iterations := v_iterations + 1;

      select coalesce(a_score + b_score, 0) into v_rallies
        from public.match_games where match_id = v_match_id and game_index = v_game_no;
      v_rallies := coalesce(v_rallies, 0);

      v_bias := case v_mode
        when 0 then (case when v_favored = 'A' then 0.85 else 0.15 end)
        when 4 then (case when v_favored = 'A' then 0.92 else 0.08 end)
        when 1 then (case when v_favored = 'A' then 0.53 else 0.47 end)
        when 2 then (
          case
            when v_game_no = 0 then 0.82
            when v_game_no = 1 then 0.18
            else (case when v_rallies < (v_target * 0.55) then 0.25 else 0.85 end)
          end
        )
        when 3 then (
          case
            when v_game_no = 0 then 0.82
            when v_game_no = 1 then 0.18
            else 0.51
          end
        )
        else 0.5
      end;

      v_side := case when random() < v_bias then 'A' else 'B' end;
      v_result := public._apply_match_point(v_match_id, v_side);

      if (v_result ->> 'gameWinner') is not null then
        v_games_won_a := (v_result ->> 'gamesWonA')::int;
        v_games_won_b := (v_result ->> 'gamesWonB')::int;
        v_game_no := (v_result ->> 'gameIndex')::int + 1;
      end if;
    end loop;

    perform public.complete_match(v_match_id);
    v_matches_created := v_matches_created + 1;
  end loop;

  return jsonb_build_object('playersCreated', 20, 'matchesCreated', v_matches_created);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 9. Execute grants
-- ---------------------------------------------------------------------------------------------

revoke execute on function public.create_player(text, text, boolean) from public;
revoke execute on function public.create_match(text, text, text, text, text, text, uuid[], uuid[], integer, boolean, integer, integer, text, boolean, text) from public;
revoke execute on function public.record_match_point(uuid, text) from public;
revoke execute on function public.undo_last_match_point(uuid) from public;
revoke execute on function public.complete_match(uuid) from public;
revoke execute on function public.get_match_kpis(uuid) from public;
revoke execute on function public.generate_synthetic_kpi_matches() from public;
revoke execute on function public.delete_synthetic_kpi_matches() from public;

grant execute on function public.create_player(text, text, boolean) to authenticated;
grant execute on function public.create_match(text, text, text, text, text, text, uuid[], uuid[], integer, boolean, integer, integer, text, boolean, text) to authenticated;
grant execute on function public.record_match_point(uuid, text) to authenticated;
grant execute on function public.undo_last_match_point(uuid) to authenticated;
grant execute on function public.complete_match(uuid) to authenticated;
grant execute on function public.get_match_kpis(uuid) to anon, authenticated;
grant execute on function public.generate_synthetic_kpi_matches() to authenticated;
grant execute on function public.delete_synthetic_kpi_matches() to authenticated;
