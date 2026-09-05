-- Player Assessment feature: staff record a per-player skill assessment during each college's
-- clinic (previously collected via a standalone Google Form), then review results as a table and
-- charts in the admin portal. Internal staff data, not a public result like matches/registrations
-- -- so unlike live_scoring_match_stats_grants (public select), this table grants NOTHING to
-- anon and gates every operation, including select, to admins via the existing is_admin()
-- SECURITY DEFINER helper (see admin_allowlist_and_role_tiers).
--
-- Field set intentionally trims the original Google Form: "Event", "Top Strength", and
-- "Development Priority" are dropped (not useful enough to warrant a column per RK), and
-- "Recommended Next Step / Drill" is generalized to a plain "Comments" field. Player identity is
-- display-text only for now, same as matches.side_a_name/side_b_name, pending the roster PRD.

create table public.player_assessments (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  clinic_date date not null,
  evaluator text not null,
  suggested_level text not null check (suggested_level in ('Beginner', 'Intermediate', 'Advanced', 'Competitive')),
  final_decision text not null check (final_decision in ('Advance', 'Hold', 'Reassess')),
  comments text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index player_assessments_clinic_date_idx on public.player_assessments (clinic_date desc);
create index player_assessments_suggested_level_idx on public.player_assessments (suggested_level);
create index player_assessments_final_decision_idx on public.player_assessments (final_decision);

alter table public.player_assessments enable row level security;

-- No grant to anon at all -- this table is staff-only, unlike the public-readable match tables.
grant select, insert, update, delete on public.player_assessments to authenticated;

create policy "admins can select player_assessments" on public.player_assessments
  for select
  using (public.is_admin());

create policy "admins can insert player_assessments" on public.player_assessments
  for insert
  with check (public.is_admin());

create policy "admins can update player_assessments" on public.player_assessments
  for update
  using (public.is_admin());

create policy "admins can delete player_assessments" on public.player_assessments
  for delete
  using (public.is_admin());
