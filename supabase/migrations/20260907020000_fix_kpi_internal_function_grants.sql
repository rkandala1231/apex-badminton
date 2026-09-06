-- ============================================================================
-- SECURITY FIX: lock down internal Match KPI helper functions that were never explicitly
-- revoked from PUBLIC.
--
-- Postgres grants EXECUTE to PUBLIC by default at function creation -- an explicit
-- `revoke execute ... from public` is required to actually restrict a function to its intended
-- callers. 20260905190000_match_kpi_schema_and_rpcs.sql's grants section (its "9. Execute grants"
-- block) revokes-and-regrants every PUBLIC-FACING function it defines (create_player, create_match,
-- record_match_point, undo_last_match_point, complete_match, get_match_kpis,
-- generate_synthetic_kpi_matches, delete_synthetic_kpi_matches) but never touches the three
-- INTERNAL helpers that migration also defines: `_game_winner`, `_apply_match_point`, and
-- `_synthetic_data_allowed`. All three have consequently been directly callable by `anon` and
-- `authenticated` since that migration shipped.
--
-- Discovered as a side effect of verifying the new Player Statistics migration
-- (20260907010000_player_statistics_rpcs.sql), which got its own equivalent internal helpers'
-- revokes right and, in fixing them, prompted checking whether the earlier migration had done the
-- same -- it had not.
--
-- Severity: `_apply_match_point(p_match_id uuid, p_winning_side text)` is the serious one. It
-- performs a real write (advances a match's score, inserts match_points/match_games rows, can even
-- flip a match from 'scheduled' to 'in_progress') and, by design, contains NO admin check of its
-- own -- it entirely trusts that its one intended caller, `record_match_point`, already verified
-- `is_admin()` before calling it. Because `_apply_match_point` itself was directly executable by
-- `anon`, anyone who knows (or guesses/enumerates) a match id could call it directly, with no
-- login at all, and manipulate that match's live score -- a full authentication bypass on a write
-- path. `_game_winner` and `_synthetic_data_allowed` are lower severity (a pure scoring-math
-- function and a boolean config read, respectively) but are locked down here too on the same
-- principle -- an internal helper should never be reachable except through the public entry point
-- that's supposed to gate it.
--
-- This migration only adds the missing revokes. It does not change either function's behavior,
-- and does not touch any of the already-correctly-gated public-facing RPCs.
-- ============================================================================

revoke execute on function public._game_winner(integer, integer, integer, boolean, integer) from public;
revoke execute on function public._apply_match_point(uuid, text) from public;
revoke execute on function public._synthetic_data_allowed() from public;

-- No re-grant to authenticated/anon for any of the three: each is called exclusively from within
-- another SECURITY DEFINER function's body (record_match_point / undo_last_match_point /
-- complete_match for _game_winner and _apply_match_point; generate_synthetic_kpi_matches /
-- delete_synthetic_kpi_matches / create_match for _synthetic_data_allowed), which already have
-- their own correct grants from the original migration. A caller with no direct execute grant can
-- still have code inside a SECURITY DEFINER function call these -- that's the entire point of the
-- SECURITY DEFINER + no-direct-grant pattern already used elsewhere in this codebase (see
-- _player_career_stats/_mvp_score in 20260907010000_player_statistics_rpcs.sql for the same
-- convention applied correctly from day one).
