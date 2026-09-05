-- Allow a `matches` row to represent a match currently being scored, not just a finished one.
-- Powers the "Live Scores" tab: a live-scoring session now inserts an `in_progress` row when the
-- match starts (instead of only inserting once at the end), updates it as points are scored, and
-- flips it to `completed`/`abandoned` when it's done -- at which point it stops matching the
-- Live Scores query (status = 'in_progress') and starts matching Completed Matches
-- (status = 'completed'). No RLS/grant changes needed: the existing public-SELECT / admin-write
-- policies on matches/match_games (live_scoring_match_stats_grants) already cover every status
-- value, and get_team_standings/get_head_to_head already filter to status = 'completed' only, so
-- in-progress matches can't leak into stats.
--
-- Applied to apex-badminton-dev on 2026-09-05 as Supabase migration
-- `matches_allow_in_progress_status` (version 20260905000000).

alter table public.matches drop constraint matches_status_check;
alter table public.matches add constraint matches_status_check
  check (status in ('in_progress', 'completed', 'abandoned'));
