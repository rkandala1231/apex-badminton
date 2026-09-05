-- Adds the College field to player_assessments -- missed in the original pass (RK caught it
-- after dev verification). Same fixed three-college list as matches.college_a/college_b.
--
-- Written as an ALTER on top of player_assessments (20260905010000) rather than folding it into
-- that file, since apex-badminton-dev already ran the original version of this table by the time
-- this was needed -- same reasoning as matches_allow_in_progress_status being its own migration
-- rather than a rewrite of live_scoring_match_stats_schema. A database that hasn't run
-- 20260905010000 yet (prod, as of this migration) just runs both in order.
--
-- Backfilled to 'TCNJ' for any row that predates this column (there's at most a couple of dev
-- test rows -- nothing real), then the default is dropped so every future insert must specify a
-- real value explicitly, same as college_a/college_b on matches.

alter table public.player_assessments
  add column college text not null default 'TCNJ' check (college in ('TCNJ', 'Rutgers', 'Rider University'));

alter table public.player_assessments alter column college drop default;

create index player_assessments_college_idx on public.player_assessments (college);
