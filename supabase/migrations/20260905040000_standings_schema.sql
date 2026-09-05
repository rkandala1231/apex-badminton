-- Schema for the BWF-aligned Tournament Standings feature (Match Center > Standings).
--
-- Two new grouping concepts that don't exist anywhere in the schema yet:
--   - `pools`: today "Pool A / Pool B" is only marketing copy on the Tournament/Formats pages --
--     nothing in the data model groups entries for round-robin standings. This table is that
--     grouping, scoped by event_code (one pool belongs to exactly one event).
--   - `team_ties`: the College Team event is scored today as ordinary rows in `matches` (one row
--     per event_code, same as any singles/doubles match) with no link between the 5 individual
--     rubbers (MS/WS/MD/WD/XD) that make up one real dual-tie between two colleges. This table is
--     that grouping. Recording a team tie still uses the existing Live Scoring flow for each of
--     the 5 individual matches -- this migration only adds the column that tags which tie a given
--     match belongs to; it does not change how matches are scored.
--
-- Both are populated by hand (direct SQL) for now -- the admin UI for creating pools, assigning
-- entries, and grouping matches into a team tie is a follow-up phase, not part of this migration.
-- Until pools/team_ties rows exist and matches are tagged, the Standings page simply has nothing
-- to show for that event/pool, which is the correct, safe default.
--
-- Player/pair identity is reused as-is from the existing convention (side_a_name/side_b_name
-- display text on `matches`) rather than introduced as a new identity system -- same
-- known limitation already called out on `matches.side_a_player_ids`/`side_b_player_ids`, pending
-- the roster PRD. `pool_entries.entry_name` must match the exact text used in the matches it's
-- meant to aggregate.

create table public.pools (
  id uuid primary key default gen_random_uuid(),
  event_code text not null check (event_code in ('MS', 'WS', 'MD', 'WD', 'XD', 'TEAM')),
  name text not null,
  qualifier_count integer not null default 2 check (qualifier_count >= 1),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  unique (event_code, name)
);

create table public.pool_entries (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  entry_name text not null,
  college text not null check (college in ('TCNJ', 'Rutgers', 'Rider University')),
  created_at timestamptz not null default now(),
  unique (pool_id, entry_name)
);

create index pool_entries_pool_id_idx on public.pool_entries (pool_id);

create table public.team_ties (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  college_a text not null check (college_a in ('TCNJ', 'Rutgers', 'Rider University')),
  college_b text not null check (college_b in ('TCNJ', 'Rutgers', 'Rider University')),
  tie_label text,
  created_at timestamptz not null default now(),
  constraint team_ties_distinct_colleges check (college_a <> college_b)
);

create index team_ties_pool_id_idx on public.team_ties (pool_id);

alter table public.matches add column pool_id uuid references public.pools(id) on delete set null;
alter table public.matches add column team_tie_id uuid references public.team_ties(id) on delete set null;
-- Distinguishes a normal finished match from the special-result cases the Standings page needs to
-- badge (WO/RET) and, later, from how corrections get audited (a future migration). Only
-- meaningful when status = 'completed'; left 'normal' for every match today via the default.
alter table public.matches add column result_type text not null default 'normal'
  check (result_type in ('normal', 'walkover', 'retirement', 'disqualification'));

create index matches_pool_id_idx on public.matches (pool_id);
create index matches_team_tie_id_idx on public.matches (team_tie_id);

alter table public.pools enable row level security;
alter table public.pool_entries enable row level security;
alter table public.team_ties enable row level security;

-- Same trust boundary as matches/match_games: public standings are the whole point of this
-- feature, so select is public; every write is admin-only.
grant select on public.pools, public.pool_entries, public.team_ties to anon, authenticated;
grant insert, update, delete on public.pools, public.pool_entries, public.team_ties to authenticated;

create policy "public can select pools" on public.pools for select using (true);
create policy "admins can insert pools" on public.pools for insert with check (public.is_admin());
create policy "admins can update pools" on public.pools for update using (public.is_admin());
create policy "admins can delete pools" on public.pools for delete using (public.is_admin());

create policy "public can select pool_entries" on public.pool_entries for select using (true);
create policy "admins can insert pool_entries" on public.pool_entries for insert with check (public.is_admin());
create policy "admins can update pool_entries" on public.pool_entries for update using (public.is_admin());
create policy "admins can delete pool_entries" on public.pool_entries for delete using (public.is_admin());

create policy "public can select team_ties" on public.team_ties for select using (true);
create policy "admins can insert team_ties" on public.team_ties for insert with check (public.is_admin());
create policy "admins can update team_ties" on public.team_ties for update using (public.is_admin());
create policy "admins can delete team_ties" on public.team_ties for delete using (public.is_admin());
