-- RLS policies and grants for the Live Scoring persistence tables created in
-- live_scoring_match_stats_schema (20260902022451). Read is public (results are the whole point
-- of the Match Center); write is restricted to admins via the existing is_admin() SECURITY
-- DEFINER helper, matching the pattern used everywhere else admin-only writes are enforced in
-- this project.
--
-- Applied to apex-badminton-prod on 2026-09-02 as Supabase migration
-- `live_scoring_match_stats_grants` (version 20260902022728).

grant select on public.matches, public.match_games, public.match_points to anon, authenticated;
grant insert, update, delete on public.matches, public.match_games, public.match_points to authenticated;

create policy "public can select matches" on public.matches
  for select
  using (true);

create policy "admins can insert matches" on public.matches
  for insert
  with check (public.is_admin());

create policy "admins can update matches" on public.matches
  for update
  using (public.is_admin());

create policy "admins can delete matches" on public.matches
  for delete
  using (public.is_admin());

create policy "public can select match_games" on public.match_games
  for select
  using (true);

create policy "admins can insert match_games" on public.match_games
  for insert
  with check (public.is_admin());

create policy "admins can update match_games" on public.match_games
  for update
  using (public.is_admin());

create policy "admins can delete match_games" on public.match_games
  for delete
  using (public.is_admin());

create policy "public can select match_points" on public.match_points
  for select
  using (true);

create policy "admins can insert match_points" on public.match_points
  for insert
  with check (public.is_admin());

create policy "admins can update match_points" on public.match_points
  for update
  using (public.is_admin());

create policy "admins can delete match_points" on public.match_points
  for delete
  using (public.is_admin());
