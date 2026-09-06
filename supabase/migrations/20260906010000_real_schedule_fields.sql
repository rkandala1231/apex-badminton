-- Turns the "Schedule" concept from a stub into real data. Before this, `matches.status =
-- 'scheduled'` only existed as a lifecycle state a KPI-flow match briefly passed through on its
-- way to being scored (created and started in the same admin session); there was no notion of a
-- match planned ahead of time, in draft, and published for the public to see later. This
-- migration adds exactly the columns that distinction needs, reusing `matches` rather than a
-- parallel schedule table -- the same additive approach as the KPI migration.
--
-- Also fixes a latent visibility gap: `matches`' public SELECT policy has been `using (true)`
-- since it was created, which was harmless while every 'scheduled' row was created and started in
-- the same breath (nothing to leak). Once scheduled matches can sit in draft for real, that
-- policy would let anon/authenticated read draft schedules straight off the table regardless of
-- what the UI shows. Fixed below.

alter table public.matches add column if not exists scheduled_at timestamptz;
alter table public.matches add column if not exists court text;
alter table public.matches add column if not exists is_published boolean not null default false;

-- Backfill for rows that existed before this migration: scheduled_at from the best time already
-- on the row (when scoring actually started, else when the row was created), and is_published
-- true so nothing already-visible under the old blanket SELECT policy disappears. New rows going
-- forward get the real column defaults (scheduled_at explicit, is_published false until an admin
-- publishes) -- see AdminScheduleSection's create-match flow.
update public.matches set scheduled_at = coalesce(started_at, created_at) where scheduled_at is null;
update public.matches set is_published = true where is_published = false;

-- 'cancelled' -- a scheduled match that was called off before it started. Distinct from
-- 'abandoned', which already means a match that was started (in_progress) and then cut short --
-- conflating the two would lose that distinction for anyone looking at match history.
alter table public.matches drop constraint matches_status_check;
alter table public.matches add constraint matches_status_check
  check (status in ('scheduled', 'in_progress', 'completed', 'abandoned', 'cancelled'));

-- Draft (unpublished) scheduled matches, and a match cancelled before it was ever published, stay
-- private to admins. Everything else -- in_progress, completed, abandoned, and a *published* match
-- that's later cancelled -- keeps behaving exactly like the old `using (true)` policy: fans should
-- still see "Canceled" on a match they already knew was scheduled, not have it vanish.
drop policy if exists "public can select matches" on public.matches;
create policy "public can select matches" on public.matches
  for select
  using (status not in ('scheduled', 'cancelled') or is_published = true);

-- RLS policies on the same table are OR'd together, so without this an admin session would be
-- just as restricted as anon/public by the policy above and could never see their own drafts in
-- the admin Schedule list -- confirmed by testing exactly that against a local database before
-- adding this.
drop policy if exists "admins can select all matches" on public.matches;
create policy "admins can select all matches" on public.matches
  for select
  using (public.is_admin());

-- is_admin()'s EXECUTE grant was revoked from `public` and only re-granted to `authenticated`
-- (20260901195430_admin_allowlist_and_role_tiers.sql). A permissive RLS policy is evaluated for
-- EVERY role attempting the select it applies to, including anon -- so without this grant, the
-- policy above turns any anon select against `matches` into an outright "permission denied for
-- function is_admin" error instead of just contributing `false` to the OR. Confirmed by
-- reproducing it directly: anon's schedule-visibility query failed with exactly that error before
-- this grant, and returned the correct filtered rows after. Safe to grant broadly -- the function
-- is SECURITY DEFINER and only ever returns a boolean, never admin data itself.
grant execute on function public.is_admin() to anon;

-- get_match_kpis's scheduledAt should reflect a real planned time now that one exists, falling
-- back to created_at for matches that predate this column (Live Scoring's ad hoc matches, and any
-- KPI-flow match created before this migration).
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
    'scheduledAt', coalesce(v_match.scheduled_at, v_match.created_at),
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
