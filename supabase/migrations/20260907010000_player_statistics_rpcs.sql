-- ============================================================================
-- Player Statistics: cross-match, cross-format career stats per player -- win/loss record,
-- serve-point win rate, point-win %/differential, comeback tracker, momentum runs, interval
-- close-out rate, an MVP leaderboard, and a player profile (stats + match history).
--
-- This is the cross-match sibling of get_match_kpis (20260905190000_match_kpi_schema_and_rpcs.sql,
-- single-match only): same source data (`matches`/`match_games`/`match_points`), same replay
-- technique (score-before/after each point derived from the log, nothing pre-materialized), but
-- looped across every completed, non-TEAM match a player appears in via `side_a_player_ids`/
-- `side_b_player_ids` -- the uuid[] columns that have existed since 20260902022451 as a
-- forward-compat seam and, until now, were never actually populated by any insert path. That's a
-- companion frontend change (Live Scoring's setup screen and the admin Schedule form both get a
-- real player picker, wired to the already-existing-but-unused `public.players` table), not part
-- of this migration -- this migration only adds the read side.
--
-- Deliberately does NOT introduce a materialized/cached stats table: every function here is
-- `stable`, computed fresh on each call, so a player's numbers are correct the instant a match
-- completes (no batch job, no staleness beyond normal Postgres MVCC visibility).
--
-- IMPORTANT correctness note for the replay algorithm: a flat loop over the union of every
-- qualifying match's `match_points`, resetting streak/score state only on `game_index` change (the
-- way get_match_kpis does for a single match), would be WRONG here -- two different matches both
-- start their first game at game_index = 0, so a match boundary would not necessarily show up as a
-- game_index change and state could leak across matches. Every function below therefore nests the
-- replay as match -> game -> point, with a fresh score/streak reset at every game (not just every
-- match).
--
-- Known, deliberate limitation: doubles pairs (side_a_player_ids/side_b_player_ids can hold up to
-- 2 players) share one side's point log -- there is no data distinguishing which partner won or
-- served any given rally. Both partners' profiles show identical point/win figures for a shared
-- match. TEAM matches carry no individual player_ids at all today and are excluded outright
-- (`event_code <> 'TEAM'`) rather than silently returning zeros for something that was never
-- attributable in the first place.
--
-- Shot-level stats explicitly out of scope for this migration -- winners/unforced errors,
-- serve/receive outcome detail, and rally length -- because `match_points` has no columns for any
-- of them (only game_index/point_index/scoring_side/server_side exist). get_player_profile
-- surfaces this directly as a `placeholders` block rather than silently omitting them, so the
-- frontend can render an honest "coming soon" instead of the stat just not appearing.
-- ============================================================================

-- ---------------------------------------------------------------------------------------------
-- 1. Internal: full career replay for one player. No grants -- callable only from within another
--    SECURITY DEFINER function's body (same convention as `_game_winner`/`_apply_match_point`).
-- ---------------------------------------------------------------------------------------------

create or replace function public._player_career_stats(p_player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_match record;
  v_game record;
  v_point record;
  v_side text;

  v_matches_played integer := 0;
  v_wins integer := 0;
  v_losses integer := 0;
  v_by_format jsonb := jsonb_build_object(
    'MS', jsonb_build_object('played', 0, 'won', 0, 'lost', 0),
    'WS', jsonb_build_object('played', 0, 'won', 0, 'lost', 0),
    'MD', jsonb_build_object('played', 0, 'won', 0, 'lost', 0),
    'WD', jsonb_build_object('played', 0, 'won', 0, 'lost', 0),
    'XD', jsonb_build_object('played', 0, 'won', 0, 'lost', 0)
  );
  v_fmt_rec jsonb;

  v_points_won integer := 0;
  v_points_lost integer := 0;
  v_serve_played integer := 0;
  v_serve_won integer := 0;
  v_comeback_wins integer := 0;
  v_momentum_runs integer := 0;
  v_longest_streak integer := 0;
  v_interval_leads integer := 0;
  v_interval_leads_converted integer := 0;
  v_clutch_played integer := 0;
  v_clutch_won integer := 0;

  -- per-game working state, reset at the top of every game iteration
  v_cur_a integer;
  v_cur_b integer;
  v_run_side text;
  v_run_len integer;
  v_trailed_3 boolean;
  v_interval_reached boolean;
  v_interval_leader text;

  -- per-match constants, reset at the top of every match iteration
  v_clutch_threshold integer;
  v_interval_at integer;
begin
  for v_match in
    select *
    from public.matches
    where status = 'completed'
      and event_code <> 'TEAM'
      and coalesce(is_synthetic, false) = false
      and (p_player_id = any(side_a_player_ids) or p_player_id = any(side_b_player_ids))
  loop
    -- Determine which side the player was on. Skip (don't double-count or guess) a match where the
    -- id shows up on both sides at once -- that's malformed data, not a real doubles/singles match.
    if (p_player_id = any(v_match.side_a_player_ids)) and (p_player_id = any(v_match.side_b_player_ids)) then
      continue;
    elsif p_player_id = any(v_match.side_a_player_ids) then
      v_side := 'A';
    elsif p_player_id = any(v_match.side_b_player_ids) then
      v_side := 'B';
    else
      continue; -- defensive; the WHERE clause above should make this unreachable
    end if;

    v_matches_played := v_matches_played + 1;
    if v_match.winner_side = v_side then
      v_wins := v_wins + 1;
    else
      v_losses := v_losses + 1;
    end if;

    v_fmt_rec := v_by_format -> v_match.event_code;
    v_fmt_rec := jsonb_set(v_fmt_rec, '{played}', to_jsonb((v_fmt_rec ->> 'played')::int + 1));
    if v_match.winner_side = v_side then
      v_fmt_rec := jsonb_set(v_fmt_rec, '{won}', to_jsonb((v_fmt_rec ->> 'won')::int + 1));
    else
      v_fmt_rec := jsonb_set(v_fmt_rec, '{lost}', to_jsonb((v_fmt_rec ->> 'lost')::int + 1));
    end if;
    v_by_format := jsonb_set(v_by_format, array[v_match.event_code], v_fmt_rec);

    -- Same clutch-threshold convention as get_match_kpis; interval_at generalizes Live Scoring's
    -- hardcoded INTERVAL_AT=8 (constants.ts) via the match's own target_points (15/2+1=8, and this
    -- also correctly gives 11 for a 21-point format instead of assuming 15 forever).
    v_clutch_threshold := v_match.target_points - 3;
    v_interval_at := v_match.target_points / 2 + 1;

    for v_game in
      select * from public.match_games where match_id = v_match.id order by game_index
    loop
      v_cur_a := 0;
      v_cur_b := 0;
      v_run_side := null;
      v_run_len := 0;
      v_trailed_3 := false;
      v_interval_reached := false;
      v_interval_leader := null;

      for v_point in
        select *
        from public.match_points
        where match_id = v_match.id and game_index = v_game.game_index
        order by point_index
      loop
        -- Clutch eligibility uses the score BEFORE this point, matching get_match_kpis exactly.
        if v_cur_a >= v_clutch_threshold and v_cur_b >= v_clutch_threshold and abs(v_cur_a - v_cur_b) <= 2 then
          v_clutch_played := v_clutch_played + 1;
          if v_point.scoring_side = v_side then
            v_clutch_won := v_clutch_won + 1;
          end if;
        end if;

        -- Serve-point win rate ("hold rate"): of the points where the player's side served, how
        -- many did they also win?
        if v_point.server_side = v_side then
          v_serve_played := v_serve_played + 1;
          if v_point.scoring_side = v_side then
            v_serve_won := v_serve_won + 1;
          end if;
        end if;

        if v_point.scoring_side = v_side then
          v_points_won := v_points_won + 1;
        else
          v_points_lost := v_points_lost + 1;
        end if;

        -- Streak tracking, by absolute scoring side (not "is it the player").
        if v_point.scoring_side = v_run_side then
          v_run_len := v_run_len + 1;
        else
          v_run_side := v_point.scoring_side;
          v_run_len := 1;
        end if;
        if v_run_side = v_side then
          if v_run_len > v_longest_streak then
            v_longest_streak := v_run_len;
          end if;
          -- Fires exactly once per qualifying streak, at the point it crosses 4 -- a run of 7 is
          -- one momentum run, not four.
          if v_run_len = 4 then
            v_momentum_runs := v_momentum_runs + 1;
          end if;
        end if;

        if v_point.scoring_side = 'A' then
          v_cur_a := v_cur_a + 1;
        else
          v_cur_b := v_cur_b + 1;
        end if;

        -- Comeback flag: player's side trailing by >= 3 at any point during the game, checked on
        -- the POST-point score (distinct from the clutch check above, which is pre-point).
        if v_side = 'A' then
          if (v_cur_b - v_cur_a) >= 3 then
            v_trailed_3 := true;
          end if;
        else
          if (v_cur_a - v_cur_b) >= 3 then
            v_trailed_3 := true;
          end if;
        end if;

        -- First-interval snapshot: who's ahead the first time either side reaches v_interval_at.
        if not v_interval_reached and (v_cur_a >= v_interval_at or v_cur_b >= v_interval_at) then
          v_interval_reached := true;
          if v_cur_a > v_cur_b then
            v_interval_leader := 'A';
          elsif v_cur_b > v_cur_a then
            v_interval_leader := 'B';
          else
            v_interval_leader := null; -- tied exactly at the interval -- no leader to credit
          end if;
        end if;
      end loop; -- points

      -- Finalize game-level facts using match_games.winner_side, reliably populated on every
      -- completed game regardless of which insert path wrote it (Live Scoring's direct inserts or
      -- the KPI admin flow's RPCs).
      if v_trailed_3 and v_game.winner_side = v_side then
        v_comeback_wins := v_comeback_wins + 1;
      end if;

      if v_interval_reached and v_interval_leader = v_side then
        v_interval_leads := v_interval_leads + 1;
        if v_game.winner_side = v_side then
          v_interval_leads_converted := v_interval_leads_converted + 1;
        end if;
      end if;
    end loop; -- games
  end loop; -- matches

  return jsonb_build_object(
    'matchesPlayed', v_matches_played,
    'wins', v_wins,
    'losses', v_losses,
    'winPercentage', case when v_matches_played = 0 then 0
      else round((v_wins::numeric / v_matches_played) * 100, 2) end,
    'byFormat', v_by_format,
    'pointsWon', v_points_won,
    'pointsLost', v_points_lost,
    'pointWinPercentage', case when (v_points_won + v_points_lost) = 0 then 0
      else round((v_points_won::numeric / (v_points_won + v_points_lost)) * 100, 2) end,
    'pointDifferential', v_points_won - v_points_lost,
    'servePointsPlayed', v_serve_played,
    'servePointsWon', v_serve_won,
    'serveWinPercentage', case when v_serve_played = 0 then null
      else round((v_serve_won::numeric / v_serve_played) * 100, 2) end,
    'comebackWins', v_comeback_wins,
    'momentumRuns', v_momentum_runs,
    'longestCareerStreak', v_longest_streak,
    'intervalLeads', v_interval_leads,
    'intervalLeadsConverted', v_interval_leads_converted,
    'intervalCloseOutPercentage', case when v_interval_leads = 0 then null
      else round((v_interval_leads_converted::numeric / v_interval_leads) * 100, 2) end,
    'clutchPointsPlayed', v_clutch_played,
    'clutchPointsWon', v_clutch_won,
    'clutchPointWinPercentage', case when v_clutch_played = 0 then null
      else round((v_clutch_won::numeric / v_clutch_played) * 100, 2) end
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. Internal: MVP composite score from a `_player_career_stats` blob. Factored out so
--    get_player_profile and get_player_leaderboard compute it identically -- no drift between the
--    number shown on a profile and the number used to rank the leaderboard.
--
--    v1 heuristic, deliberately simple and documented rather than tuned:
--      MVP = 40 * matchWin% + 25 * pointWin% + 20 * (clutchWin%, or pointWin% if no clutch points
--            were ever played) + 15 * min(comebackWins / matchesPlayed, 1.0)
--    on a 0-100ish scale (weights apply to 0.0-1.0 fractions, not raw 0-100 percentages, to keep
--    the result in that range). No grants -- internal only, same convention as above.
-- ---------------------------------------------------------------------------------------------

create or replace function public._mvp_score(v_stats jsonb)
returns numeric
language sql
immutable
as $$
  select round(
    40 * (coalesce((v_stats ->> 'winPercentage')::numeric, 0) / 100)
    + 25 * (coalesce((v_stats ->> 'pointWinPercentage')::numeric, 0) / 100)
    + 20 * (
        case when coalesce((v_stats ->> 'clutchPointsPlayed')::int, 0) > 0
          then coalesce((v_stats ->> 'clutchPointWinPercentage')::numeric, 0) / 100
          else coalesce((v_stats ->> 'pointWinPercentage')::numeric, 0) / 100
        end
      )
    + 15 * least(
        case when coalesce((v_stats ->> 'matchesPlayed')::int, 0) > 0
          then coalesce((v_stats ->> 'comebackWins')::numeric, 0) / (v_stats ->> 'matchesPlayed')::numeric
          else 0
        end,
        1.0
      ),
    2
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Public: one player's full profile -- career stats, MVP score (once qualified), match
--    history, and the shot-level placeholders block. Same public-analytics trust posture as
--    get_match_kpis/get_public_summary_stats: read-only, no PII beyond name + college (already
--    public via the existing `players` SELECT policy).
-- ---------------------------------------------------------------------------------------------

create or replace function public.get_player_profile(p_player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_player record;
  v_stats jsonb;
  v_mvp numeric;
  v_history jsonb;
begin
  select * into v_player from public.players where id = p_player_id;
  if not found then
    raise exception 'player not found';
  end if;

  v_stats := public._player_career_stats(p_player_id);
  -- MVP is null (not 0) below the 3-match threshold, so the frontend can render "not enough
  -- matches yet" instead of a misleadingly low real score.
  v_mvp := case when (v_stats ->> 'matchesPlayed')::int >= 3 then public._mvp_score(v_stats) else null end;

  select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'matchId', m.id,
          'eventCode', m.event_code,
          'date', m.completed_at,
          'opponentName', case when p_player_id = any(m.side_a_player_ids) then m.side_b_name else m.side_a_name end,
          'opponentCollege', case when p_player_id = any(m.side_a_player_ids) then m.college_b else m.college_a end,
          'side', case when p_player_id = any(m.side_a_player_ids) then 'A' else 'B' end,
          'gameScores', (
            select coalesce(jsonb_agg(jsonb_build_object('a', g.a_score, 'b', g.b_score) order by g.game_index), '[]'::jsonb)
            from public.match_games g
            where g.match_id = m.id
          ),
          'result', case
            when m.winner_side = (case when p_player_id = any(m.side_a_player_ids) then 'A' else 'B' end) then 'W'
            else 'L'
          end,
          'externalVideoId', m.external_video_id
        )
        order by m.completed_at desc
      ),
      '[]'::jsonb
    )
    into v_history
    from public.matches m
    where m.status = 'completed'
      and m.event_code <> 'TEAM'
      and coalesce(m.is_synthetic, false) = false
      and (p_player_id = any(m.side_a_player_ids) or p_player_id = any(m.side_b_player_ids))
      and not (p_player_id = any(m.side_a_player_ids) and p_player_id = any(m.side_b_player_ids));

  return jsonb_build_object(
    'playerId', v_player.id,
    'name', v_player.name,
    'college', v_player.college,
    'stats', v_stats || jsonb_build_object('mvpScore', v_mvp),
    'matchHistory', v_history,
    'placeholders', jsonb_build_object(
      'winnersUnforcedErrors', jsonb_build_object(
        'available', false,
        'reason', 'Requires shot-level data entry during live scoring — not yet instrumented.'
      ),
      'serveReceive', jsonb_build_object(
        'available', false,
        'reason', 'Requires shot-level data entry during live scoring — not yet instrumented.'
      ),
      'rallyLength', jsonb_build_object(
        'available', false,
        'reason', 'Requires shot-level data entry during live scoring — not yet instrumented.'
      )
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Public: MVP leaderboard across every player with >= 3 completed (non-TEAM) matches. Same
--    trust posture as get_player_profile.
--
--    O(players x their matches x their points) -- fine at club scale (dozens of players, hundreds
--    of matches). If the roster grows into the thousands this should become a single set-based
--    query instead of a per-player function call in a loop; out of scope for v1.
-- ---------------------------------------------------------------------------------------------

create or replace function public.get_player_leaderboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  v_row record;
  v_stats jsonb;
  v_rows jsonb[] := '{}';
begin
  for v_row in select id, name, college from public.players where coalesce(is_synthetic, false) = false order by name loop
    v_stats := public._player_career_stats(v_row.id);
    if (v_stats ->> 'matchesPlayed')::int < 3 then
      continue;
    end if;
    v_rows := v_rows || jsonb_build_object(
      'playerId', v_row.id,
      'name', v_row.name,
      'college', v_row.college,
      'mvpScore', public._mvp_score(v_stats),
      'matchesPlayed', (v_stats ->> 'matchesPlayed')::int,
      'winPercentage', (v_stats ->> 'winPercentage')::numeric,
      'pointWinPercentage', (v_stats ->> 'pointWinPercentage')::numeric
    );
  end loop;

  return coalesce(
    (select jsonb_agg(elem order by (elem ->> 'mvpScore')::numeric desc) from unnest(v_rows) elem),
    '[]'::jsonb
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Execute grants
-- ---------------------------------------------------------------------------------------------

revoke execute on function public.get_player_profile(uuid) from public;
revoke execute on function public.get_player_leaderboard() from public;
grant execute on function public.get_player_profile(uuid) to anon, authenticated;
grant execute on function public.get_player_leaderboard() to anon, authenticated;

-- `_player_career_stats` and `_mvp_score` are internal only, reachable exclusively from inside the
-- two SECURITY DEFINER functions above. Postgres grants EXECUTE to PUBLIC by default at function
-- creation, so an explicit revoke is required here -- without it, ANY anon/authenticated caller
-- could call `_player_career_stats` directly, same as the two public wrappers, defeating the
-- point of keeping it unlisted. (This is verified, not assumed: the existing `_game_winner`/
-- `_apply_match_point`/`_synthetic_data_allowed` helpers from 20260905190000_match_kpi_schema_
-- and_rpcs.sql never received this revoke either, and are consequently ALSO directly callable by
-- anon today -- confirmed against a local Postgres simulation while verifying this migration.
-- `_apply_match_point` in particular performs a real scoring write with no `is_admin()` check of
-- its own -- it relies entirely on `record_match_point` having already checked -- so this is a
-- live, unauthorized-write security gap in already-shipped code, not merely a style nit. Flagged
-- separately for a dedicated follow-up migration; fixing it here would be silent, unrelated scope
-- creep into a security-relevant file. Not repeating that mistake for the two new functions below.)
revoke execute on function public._player_career_stats(uuid) from public;
revoke execute on function public._mvp_score(jsonb) from public;

-- No table/RLS changes in this migration: `matches`/`match_games`/`match_points` SELECT is already
-- public, which doesn't even matter for the two functions above (they're SECURITY DEFINER), and
-- the admin-only "edit a match's YouTube link" frontend feature that accompanies this migration
-- goes through a plain `update matches set external_video_id = ...` under the existing
-- "admins can update matches" policy (`using (public.is_admin())`, no separate `with check`,
-- so -- being row-level, not column-level -- it already covers this column). Verified directly
-- against a local Postgres simulation rather than assumed; see the verification notes delivered
-- alongside this migration.
