-- Enables Supabase Realtime (postgres_changes) broadcasts for the two tables that drive live
-- sync across the app: `matches` and `match_games`. Nothing in the app has used Realtime before
-- this -- every live-updating view (Live Scores, Standings) has relied on short-interval polling
-- instead. This migration is what lets the frontend subscribe to row-level changes on these
-- tables and react within ~1 second of an admin scoring a point, instead of waiting for the next
-- poll.
--
-- Safe to broadcast publicly: both tables already grant public `select` with a `using (true)`
-- RLS policy (see `live_scoring_match_stats_grants`, 20260902022728) -- anon/authenticated can
-- already read every row in these tables today via the REST API, so Realtime isn't exposing
-- anything new. Writes remain admin-only via the existing `is_admin()`-gated policies; this
-- migration only changes how *read* access is delivered (push vs. poll), not who has it.
--
-- Wrapped in existence checks so this migration is safe to re-run and won't fail with
-- "relation is already member of publication" if a table was already added by hand via the
-- Supabase dashboard's Realtime toggle before this migration was written.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_games'
  ) then
    alter publication supabase_realtime add table public.match_games;
  end if;
end $$;
