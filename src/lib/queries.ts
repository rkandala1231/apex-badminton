import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { CollegeName } from './matchCenterData';
import type {
  AdminRegistrationRow,
  EventCode,
  EventCountRow,
  RegionCountRow,
  RegisterPayload,
  SummaryStats,
  WeeklyTrendRow,
} from './types';
import type { MatchKpis, RecordPointResult } from './kpi/types';
import type { PlayerLeaderboardRow, PlayerProfile } from './playerStats/types';
import {
  assignQualification,
  isPoolComplete,
  isTeamPoolComplete,
  rankIndividualPool,
  rankTeamPool,
  type IndividualStats,
  type MatchLike,
  type PoolEntryLike,
  type QualificationStatus,
  type TeamStats,
  type TeamTieLike,
} from './standings/calc';
import type { RankedEntry } from './standings/rank';

export interface TeamStandingRow {
  college: string;
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  games_won: number;
  games_lost: number;
  points_won: number;
  points_lost: number;
  point_diff: number;
}

export function useTeamStandings(eventCode: string | null, stage: string | null) {
  return useQuery({
    queryKey: ['team-standings', eventCode, stage],
    queryFn: async (): Promise<TeamStandingRow[]> => {
      const { data, error } = await supabase.rpc('get_team_standings', {
        p_event_code: eventCode,
        p_stage: stage,
      });
      if (error) throw error;
      return (data as TeamStandingRow[]) || [];
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

export interface HeadToHeadRow {
  college_a: string;
  college_b: string;
  matches_played: number;
  college_a_wins: number;
  college_b_wins: number;
  college_a_points: number;
  college_b_points: number;
}

export function useHeadToHead(collegeA: string | null, collegeB: string | null, eventCode: string | null) {
  return useQuery({
    queryKey: ['head-to-head', collegeA, collegeB, eventCode],
    queryFn: async (): Promise<HeadToHeadRow | null> => {
      const { data, error } = await supabase.rpc('get_head_to_head', {
        p_college_a: collegeA,
        p_college_b: collegeB,
        p_event_code: eventCode,
      });
      if (error) throw error;
      return (data as HeadToHeadRow[])?.[0] ?? null;
    },
    enabled: !!collegeA && !!collegeB && collegeA !== collegeB,
    staleTime: 15_000,
  });
}

export interface MatchGameRow {
  game_index: number;
  a_score: number;
  b_score: number;
  winner_side: 'A' | 'B' | null;
}

export interface MatchRow {
  id: string;
  event_code: EventCode;
  stage: 'roundrobin' | 'knockout';
  format: 'single' | 'bo3';
  college_a: string;
  college_b: string;
  side_a_name: string;
  side_b_name: string;
  side_a_player_ids: string[];
  side_b_player_ids: string[];
  first_server: 'A' | 'B';
  winner_side: 'A' | 'B' | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'abandoned' | 'cancelled';
  created_at: string;
  completed_at: string | null;
  scheduled_at: string | null;
  court: string | null;
  is_published: boolean;
  external_video_id: string | null;
  match_games: MatchGameRow[];
}

/** Back-compat aliases — CompletedMatches.tsx was written against these names. */
export type CompletedMatchGameRow = MatchGameRow;
export type CompletedMatchRow = MatchRow;

const MATCH_SELECT =
  'id, event_code, stage, format, college_a, college_b, side_a_name, side_b_name, side_a_player_ids, side_b_player_ids, first_server, winner_side, status, created_at, completed_at, scheduled_at, court, is_published, external_video_id, match_games(game_index, a_score, b_score, winner_side)';

/** Supabase doesn't guarantee ordering within an embedded relation — sort games client-side. */
function sortGames(rows: MatchRow[]): MatchRow[] {
  return rows.map((m) => ({
    ...m,
    match_games: [...m.match_games].sort((a, b) => a.game_index - b.game_index),
  }));
}

/**
 * Finished matches for the public Completed Matches tab. `matches`/`match_games` are
 * public-SELECT RLS tables (see live_scoring_match_stats_grants), so this reads them directly
 * rather than through an RPC — same trust boundary the standings/head-to-head functions already
 * rely on. Only `status = 'completed'` rows are returned; abandoned matches aren't real results.
 */
export function useCompletedMatches(eventCode: EventCode | null) {
  return useQuery({
    queryKey: ['completed-matches', eventCode],
    queryFn: async (): Promise<MatchRow[]> => {
      let query = supabase
        .from('matches')
        .select(MATCH_SELECT)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      if (eventCode) {
        query = query.eq('event_code', eventCode);
      }

      const { data, error } = await query;
      if (error) throw error;
      return sortGames((data as MatchRow[]) || []);
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Matches currently being scored. Same `matches`/`match_games` tables as Completed Matches, just
 * filtered to `status = 'in_progress'` instead -- a match can only ever match one of the two
 * queries at a time, and `finishLiveMatch` (matchStats.ts) is what flips it from one to the
 * other. Refreshes via the shared Realtime subscription (see useRealtimeMatchSync) within about a
 * second of an admin scoring a point; the interval below is just a polling fallback.
 */
export function useLiveMatches(eventCode: EventCode | null) {
  return useQuery({
    queryKey: ['live-matches', eventCode],
    queryFn: async (): Promise<MatchRow[]> => {
      let query = supabase
        .from('matches')
        .select(MATCH_SELECT)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false });

      if (eventCode) {
        query = query.eq('event_code', eventCode);
      }

      const { data, error } = await query;
      if (error) throw error;
      return sortGames((data as MatchRow[]) || []);
    },
    staleTime: 0,
    // Realtime (useRealtimeMatchSync) is the fast path now -- an admin's point update reaches
    // this tab in about a second via the subscription below. This interval only exists as a
    // fallback in case that socket ever drops, so it can be much longer than it used to be.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Opens one Supabase Realtime subscription covering `matches` and `match_games`, and invalidates
 * every query family derived from them whenever a row changes -- Live Scores, Completed Matches,
 * Schedule (both the public upcoming list and the admin draft+published list), and Standings all
 * refresh within about a second of an admin scoring a point, publishing a match, or finishing one,
 * instead of waiting on their next poll.
 *
 * Deliberately coarse: any insert/update/delete on either table invalidates every query family
 * rather than patching the cache per-row. The dataset is small (one college tournament's worth of
 * matches), so a full refetch per change is cheap, and it can't drift out of sync with calc.ts's
 * ranking logic the way a hand-rolled partial cache update could.
 *
 * Mount this exactly once (in MatchCenter.tsx) so every tab underneath shares the one channel
 * instead of each opening its own socket. The polling on useLiveMatches/usePoolStandings stays in
 * place as a fallback -- if the socket ever drops, those still eventually catch up on their own.
 */
export function useRealtimeMatchSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ['live-matches'] });
      queryClient.invalidateQueries({ queryKey: ['completed-matches'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-admin'] });
      queryClient.invalidateQueries({ queryKey: ['pool-standings'] });
    };

    const channel = supabase
      .channel('matches-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, invalidateAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_games' }, invalidateAll)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

// ---------------------------------------------------------------------------------------------
// Real Schedule (Admin > Schedule, public Match Center > Schedule) -- see
// supabase/migrations/20260906010000_real_schedule_fields.sql. A scheduled match is a `matches`
// row with status 'scheduled' (or 'cancelled', if called off before it started); `is_published`
// controls whether the public can see it at all (RLS enforces this server-side -- the
// `.eq('is_published', true)` below is belt-and-suspenders, not the actual security boundary).
// These are direct table reads/writes gated by the same RLS policies matchStats.ts already
// relies on for Live Scoring -- no new RPCs needed. All scoring-format columns (target_points,
// win_by_two, max_points, best_of_games) are left out of every insert/update below so they fall
// back to the same column defaults (15 / true / 16 / from-format) that Live Scoring's ad hoc
// matches already use.
// ---------------------------------------------------------------------------------------------

/**
 * Published, not-yet-started (or published-then-cancelled) matches for the public Schedule tab.
 * Ordered soonest-first so the next match up is always at the top.
 */
export function useUpcomingSchedule(eventCode: EventCode | null) {
  return useQuery({
    queryKey: ['schedule-upcoming', eventCode],
    queryFn: async (): Promise<MatchRow[]> => {
      let query = supabase
        .from('matches')
        .select(MATCH_SELECT)
        .in('status', ['scheduled', 'cancelled'])
        .eq('is_published', true)
        .order('scheduled_at', { ascending: true });
      if (eventCode) {
        query = query.eq('event_code', eventCode);
      }
      const { data, error } = await query;
      if (error) throw error;
      return sortGames((data as MatchRow[]) || []);
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Every scheduled/cancelled match, published or still in draft -- the admin Schedule list. Relies
 * on the "admins can select all matches" RLS policy to see drafts a normal public query can't;
 * gate `enabled` on isAdmin the same way useAdminRegistrations/useAdminAssessments do.
 */
export function useAdminSchedule(enabled: boolean) {
  return useQuery({
    queryKey: ['schedule-admin'],
    queryFn: async (): Promise<MatchRow[]> => {
      const { data, error } = await supabase
        .from('matches')
        .select(MATCH_SELECT)
        .in('status', ['scheduled', 'cancelled'])
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return sortGames((data as MatchRow[]) || []);
    },
    enabled,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
}

function invalidateScheduleQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['schedule-admin'] });
  queryClient.invalidateQueries({ queryKey: ['schedule-upcoming'] });
}

export interface ScheduledMatchPayload {
  eventCode: EventCode;
  stage: 'roundrobin' | 'knockout';
  format: 'single' | 'bo3';
  collegeA: CollegeName;
  collegeB: CollegeName;
  sideAName: string;
  sideBName: string;
  sideAPlayerIds?: string[];
  sideBPlayerIds?: string[];
  firstServer: 'A' | 'B';
  scheduledAt: string; // ISO timestamp
  court?: string | null;
}

/** Creates a new scheduled match in draft (is_published defaults to false) -- an admin publishes it separately. */
export function useCreateScheduledMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (p: ScheduledMatchPayload): Promise<string> => {
      const { data, error } = await supabase
        .from('matches')
        .insert({
          event_code: p.eventCode,
          stage: p.stage,
          format: p.format,
          college_a: p.collegeA,
          college_b: p.collegeB,
          side_a_player_ids: p.sideAPlayerIds ?? [],
          side_b_player_ids: p.sideBPlayerIds ?? [],
          side_a_name: p.sideAName,
          side_b_name: p.sideBName,
          first_server: p.firstServer,
          status: 'scheduled',
          scheduled_at: p.scheduledAt,
          court: p.court || null,
        })
        .select('id')
        .single();
      if (error) throw error;
      if (!data) throw new Error('Scheduled match insert returned no row');
      return data.id as string;
    },
    onSuccess: () => invalidateScheduleQueries(queryClient),
  });
}

/** Edits a scheduled match's details. Restricted to status = 'scheduled' -- once a match starts or is cancelled, editing its matchup here no longer makes sense (Cancel/Delete cover those cases instead). */
export function useUpdateScheduledMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...p }: ScheduledMatchPayload & { id: string }) => {
      const { error } = await supabase
        .from('matches')
        .update({
          event_code: p.eventCode,
          stage: p.stage,
          format: p.format,
          college_a: p.collegeA,
          college_b: p.collegeB,
          side_a_player_ids: p.sideAPlayerIds ?? [],
          side_b_player_ids: p.sideBPlayerIds ?? [],
          side_a_name: p.sideAName,
          side_b_name: p.sideBName,
          first_server: p.firstServer,
          scheduled_at: p.scheduledAt,
          court: p.court || null,
        })
        .eq('id', id)
        .eq('status', 'scheduled');
      if (error) throw error;
    },
    onSuccess: () => invalidateScheduleQueries(queryClient),
  });
}

function useSetSchedulePublished(published: boolean) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('matches').update({ is_published: published }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateScheduleQueries(queryClient),
  });
}

export function usePublishMatch() {
  return useSetSchedulePublished(true);
}

export function useUnpublishMatch() {
  return useSetSchedulePublished(false);
}

/**
 * Soft cancel: the row stays (never deleted), status flips to 'cancelled'. If it was already
 * published, `is_published` is left untouched -- the public keeps seeing the match, now marked
 * "Canceled", rather than it silently disappearing (the "Soft cancel" design decision).
 */
export function useCancelScheduledMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('matches').update({ status: 'cancelled' }).eq('id', id).eq('status', 'scheduled');
      if (error) throw error;
    },
    onSuccess: () => invalidateScheduleQueries(queryClient),
  });
}

/** Hard delete -- only ever offered on scheduled/cancelled rows, never a match that has actually been played. */
export function useDeleteScheduledMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('matches').delete().eq('id', id).in('status', ['scheduled', 'cancelled']);
      if (error) throw error;
    },
    onSuccess: () => invalidateScheduleQueries(queryClient),
  });
}

export interface AnalyticsData {
  stats: SummaryStats;
  events: EventCountRow[];
  regions: RegionCountRow[];
  trend: WeeklyTrendRow[];
}

const EMPTY_STATS: SummaryStats = {
  colleges_registered: 0,
  total_entries: 0,
  colleges_this_week: 0,
  entries_this_week: 0,
};

async function fetchAnalytics(): Promise<AnalyticsData> {
  // These are RPC calls to SECURITY DEFINER functions, not table/view selects. Public analytics
  // only ever return aggregate counts (no PII), and the underlying tables are RLS-locked with no
  // anon policy — a plain view would either leak raw rows (security definer) or hard-error for
  // anon (security invoker, since anon has no table grant). A function sidesteps both.
  const [statsRes, eventsRes, regionsRes, trendRes] = await Promise.all([
    supabase.rpc('get_public_summary_stats'),
    supabase.rpc('get_public_event_counts'),
    supabase.rpc('get_public_region_counts'),
    supabase.rpc('get_public_weekly_trend'),
  ]);

  const firstError = statsRes.error || eventsRes.error || regionsRes.error || trendRes.error;
  if (firstError) throw firstError;

  const statsRow = (statsRes.data as SummaryStats[] | null)?.[0];

  return {
    stats: statsRow || EMPTY_STATS,
    events: (eventsRes.data as EventCountRow[]) || [],
    regions: (regionsRes.data as RegionCountRow[]) || [],
    trend: (trendRes.data as WeeklyTrendRow[]) || [],
  };
}

export function useAnalytics() {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: fetchAnalytics,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useRegisterCollege() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const { error } = await supabase.rpc('register_for_apex', payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useAdminRegistrations(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-registrations'],
    queryFn: async (): Promise<AdminRegistrationRow[]> => {
      const { data, error } = await supabase
        .from('admin_registrations_view')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as AdminRegistrationRow[]) || [];
    },
    enabled,
  });
}

export interface AdminStaffRow {
  email: string;
  role: 'admin' | 'super_admin';
  note: string | null;
  since: string;
}

export function useAdminStaff(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-staff'],
    queryFn: async (): Promise<AdminStaffRow[]> => {
      const { data, error } = await supabase.rpc('list_admin_staff');
      if (error) throw error;
      return (data as AdminStaffRow[]) || [];
    },
    enabled,
  });
}

export function useCreateAdminAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      email,
      password,
      role,
      note,
    }: {
      email: string;
      password: string;
      role: 'admin' | 'super_admin';
      note?: string;
    }) => {
      const { error } = await supabase.rpc('create_admin_account', {
        p_email: email,
        p_password: password,
        p_role: role,
        p_note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
    },
  });
}

export function useRemoveAdminAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.rpc('remove_admin_access', { p_email: email });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
    },
  });
}

export type SuggestedLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Competitive';
export type FinalDecision = 'Advance' | 'Hold' | 'Reassess';

export interface PlayerAssessmentRow {
  id: string;
  player_name: string;
  college: CollegeName;
  clinic_date: string;
  evaluator: string;
  suggested_level: SuggestedLevel;
  final_decision: FinalDecision;
  comments: string | null;
  created_at: string;
}

export interface NewPlayerAssessment {
  player_name: string;
  college: CollegeName;
  clinic_date: string;
  evaluator: string;
  suggested_level: SuggestedLevel;
  final_decision: FinalDecision;
  comments?: string | null;
}

/**
 * Player Assessment entries from the clinic evaluation flow (admin-entered, replacing the old
 * standalone Google Form). `player_assessments` is admin-only end to end -- no anon grant at all
 * (see the player_assessments migration) -- so this, unlike useCompletedMatches/useLiveMatches,
 * is only ever called with `enabled` gated on isAdmin, same as useAdminRegistrations.
 */
export function useAdminAssessments(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-assessments'],
    queryFn: async (): Promise<PlayerAssessmentRow[]> => {
      const { data, error } = await supabase
        .from('player_assessments')
        .select('id, player_name, college, clinic_date, evaluator, suggested_level, final_decision, comments, created_at')
        .order('clinic_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as PlayerAssessmentRow[]) || [];
    },
    enabled,
  });
}

export function useCreatePlayerAssessment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: NewPlayerAssessment) => {
      const { error } = await supabase
        .from('player_assessments')
        .insert({ ...payload, comments: payload.comments || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-assessments'] });
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Standings (Match Center > Standings)
// ---------------------------------------------------------------------------------------------

export interface PoolRow {
  id: string;
  event_code: EventCode;
  name: string;
  qualifier_count: number;
}

/**
 * Published pools for one event (or every event, when eventCode is null). `pools` is
 * public-SELECT (see the standings schema migration) -- same trust boundary as matches -- so this
 * is safe to call from the public Standings page with no auth check.
 */
export function usePools(eventCode: EventCode | null) {
  return useQuery({
    queryKey: ['pools', eventCode],
    queryFn: async (): Promise<PoolRow[]> => {
      let query = supabase
        .from('pools')
        .select('id, event_code, name, qualifier_count')
        .eq('published', true)
        .order('name', { ascending: true });
      if (eventCode) query = query.eq('event_code', eventCode);
      const { data, error } = await query;
      if (error) throw error;
      return (data as PoolRow[]) || [];
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

// Public-safe columns only -- no email/student ID anywhere on pool_entries or matches, so there's
// nothing to filter out here (unlike, say, admin_registrations_view).
const STANDINGS_MATCH_SELECT =
  'id, pool_id, team_tie_id, college_a, college_b, side_a_name, side_b_name, winner_side, status, result_type, completed_at, match_games(a_score, b_score, winner_side)';

type StandingsMatchRow = MatchLike & { completed_at: string | null };

function latestCompletedAt(matches: { completed_at: string | null }[]): string | null {
  const dates = matches.map((m) => m.completed_at).filter((d): d is string => !!d);
  return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
}

export interface IndividualStandingsResult {
  kind: 'individual';
  pool: PoolRow;
  entries: (RankedEntry<IndividualStats> & { status: QualificationStatus })[];
  poolComplete: boolean;
  lastUpdated: string | null;
  hasLiveMatches: boolean;
}

export interface TeamStandingsResult {
  kind: 'team';
  pool: PoolRow;
  entries: (RankedEntry<TeamStats> & { status: QualificationStatus })[];
  poolComplete: boolean;
  lastUpdated: string | null;
  hasLiveMatches: boolean;
}

export type PoolStandingsResult = IndividualStandingsResult | TeamStandingsResult;

/**
 * Fetches everything one pool needs and returns fully ranked, qualification-tagged standings --
 * the UI just renders the result, it never re-derives ranking itself. Only status = 'completed'
 * matches feed calc.ts (see completedOnly in standings/calc.ts), so an in-progress live match can
 * never move the public table -- but the moment a match IS marked completed, the shared Realtime
 * subscription (useRealtimeMatchSync) invalidates this query and the table updates within about a
 * second, rather than waiting for the polling fallback below.
 */
export function usePoolStandings(pool: PoolRow | null) {
  return useQuery({
    queryKey: ['pool-standings', pool?.id],
    queryFn: async (): Promise<PoolStandingsResult | null> => {
      if (!pool) return null;

      if (pool.event_code === 'TEAM') {
        const { data: tieData, error: tiesError } = await supabase
          .from('team_ties')
          .select('id, college_a, college_b, tie_label')
          .eq('pool_id', pool.id);
        if (tiesError) throw tiesError;
        const ties = (tieData as TeamTieLike[]) || [];

        let matches: StandingsMatchRow[] = [];
        if (ties.length > 0) {
          const { data, error } = await supabase
            .from('matches')
            .select(STANDINGS_MATCH_SELECT)
            .in(
              'team_tie_id',
              ties.map((t) => t.id)
            );
          if (error) throw error;
          matches = (data as StandingsMatchRow[]) || [];
        }

        const ranked = rankTeamPool(ties, matches);
        const poolComplete = isTeamPoolComplete(ties, matches);
        const entries = assignQualification(ranked, pool.qualifier_count, poolComplete);
        return {
          kind: 'team',
          pool,
          entries,
          poolComplete,
          lastUpdated: latestCompletedAt(matches),
          hasLiveMatches: matches.some((m) => m.status === 'in_progress'),
        };
      }

      const { data: entryData, error: entriesError } = await supabase
        .from('pool_entries')
        .select('id, entry_name, college')
        .eq('pool_id', pool.id);
      if (entriesError) throw entriesError;
      const poolEntries = (entryData as PoolEntryLike[]) || [];

      const { data, error } = await supabase.from('matches').select(STANDINGS_MATCH_SELECT).eq('pool_id', pool.id);
      if (error) throw error;
      const matches = (data as StandingsMatchRow[]) || [];

      const ranked = rankIndividualPool(poolEntries, matches);
      const poolComplete = isPoolComplete(
        poolEntries.map((e) => e.entry_name),
        matches
      );
      const entries = assignQualification(ranked, pool.qualifier_count, poolComplete);
      return {
        kind: 'individual',
        pool,
        entries,
        poolComplete,
        lastUpdated: latestCompletedAt(matches),
        hasLiveMatches: matches.some((m) => m.status === 'in_progress'),
      };
    },
    enabled: !!pool,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    // Realtime (useRealtimeMatchSync) invalidates this the moment a match completes -- this
    // interval is now just a fallback in case that socket ever drops, not the primary sync path.
    refetchInterval: 60_000,
  });
}

export function useUpdateRegistrationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('registrations').update({ status }).eq('id', id);
      if (error) throw error;
      return { id, status };
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['admin-registrations'] });
      const previous = queryClient.getQueryData<AdminRegistrationRow[]>(['admin-registrations']);
      queryClient.setQueryData<AdminRegistrationRow[]>(['admin-registrations'], (old) =>
        old?.map((row) => (row.id === id ? { ...row, status: status as AdminRegistrationRow['status'] } : row))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['admin-registrations'], context.previous);
      }
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Match KPIs (point-win %, point differential, longest streak, clutch-point win rate, result) --
// see supabase/migrations/20260905190000_match_kpi_schema_and_rpcs.sql. `matches` is already a
// public-SELECT table, and get_match_kpis() is granted to anon + authenticated, so the dashboard
// itself needs no auth; only the scoring screen (create/record/undo/complete/synthetic data) is
// admin-gated, matching the same split Live Scoring already uses.
// ---------------------------------------------------------------------------------------------

/**
 * The one backend-authoritative source for all five KPIs. Summary, Table, and Charts all read
 * this same query result -- switching between them is a local view-state change, not a refetch
 * (see MatchKpiDashboard.tsx). A completed match's KPIs never change unless a point is undone
 * (which only admins can do, before completion), so this stays fresh far longer than the live
 * match lists above.
 */
export function useMatchKpis(matchId: string | null) {
  return useQuery({
    queryKey: ['match-kpis', matchId],
    queryFn: async (): Promise<MatchKpis> => {
      const { data, error } = await supabase.rpc('get_match_kpis', { p_match_id: matchId });
      if (error) throw error;
      return data as MatchKpis;
    },
    enabled: !!matchId,
    staleTime: 60_000,
  });
}

export interface PlayerRow {
  id: string;
  name: string;
  college: CollegeName | null;
  is_synthetic: boolean;
}

/** Public read of the minimal KPI-feature roster (see the migration header for scope). */
export function usePlayers(college?: CollegeName | null) {
  return useQuery({
    queryKey: ['players', college ?? null],
    queryFn: async (): Promise<PlayerRow[]> => {
      let query = supabase.from('players').select('id, name, college, is_synthetic').order('name');
      if (college) query = query.eq('college', college);
      const { data, error } = await query;
      if (error) throw error;
      return (data as PlayerRow[]) || [];
    },
  });
}

export function useCreatePlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, college }: { name: string; college?: CollegeName | null }) => {
      const { data, error } = await supabase.rpc('create_player', { p_name: name, p_college: college ?? null });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Player Statistics (Home > Analytics > Player Statistics) -- see
// supabase/migrations/20260907010000_player_statistics_rpcs.sql. Both RPCs are public analytics
// (granted to anon + authenticated, same trust posture as get_match_kpis) and deliberately kept
// short-lived/refetch-happy rather than long-cached, since the whole point is that a player's
// numbers are current the moment their latest match completes.
// ---------------------------------------------------------------------------------------------

/** One player's full profile: career stats, MVP score (once qualified), and match history. */
export function usePlayerProfile(playerId: string | null) {
  return useQuery({
    queryKey: ['player-profile', playerId],
    queryFn: async (): Promise<PlayerProfile> => {
      const { data, error } = await supabase.rpc('get_player_profile', { p_player_id: playerId });
      if (error) throw error;
      return data as PlayerProfile;
    },
    enabled: !!playerId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** MVP-ranked leaderboard across every player with >= 3 completed matches. */
export function usePlayerLeaderboard() {
  return useQuery({
    queryKey: ['player-leaderboard'],
    queryFn: async (): Promise<PlayerLeaderboardRow[]> => {
      const { data, error } = await supabase.rpc('get_player_leaderboard');
      if (error) throw error;
      return (data as PlayerLeaderboardRow[]) || [];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Sets (or clears) a completed match's linked YouTube video -- a plain `matches` update, not an
 * RPC, matching how other simple admin edits (startScheduledMatch/revertScheduledMatch) already
 * bypass the RPC layer here; there's no business rule to enforce beyond the existing
 * "admins can update matches" RLS policy. Accepts either a bare YouTube video id or a full URL --
 * MatchVideoLinkControl extracts the id client-side before calling this.
 */
export function useSetMatchVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ matchId, videoId }: { matchId: string; videoId: string | null }) => {
      const { error } = await supabase.from('matches').update({ external_video_id: videoId }).eq('id', matchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player-profile'] });
      queryClient.invalidateQueries({ queryKey: ['match-kpis'] });
    },
  });
}

export interface CreateMatchPayload {
  eventCode: EventCode;
  stage: 'roundrobin' | 'knockout';
  collegeA: CollegeName;
  collegeB: CollegeName;
  sideAName: string;
  sideBName: string;
  sideAPlayerIds?: string[];
  sideBPlayerIds?: string[];
  targetPoints: number;
  winByTwo: boolean;
  maxPoints: number | null;
  bestOfGames: number;
  firstServer: 'A' | 'B';
}

export function useCreateMatch() {
  return useMutation({
    mutationFn: async (p: CreateMatchPayload): Promise<string> => {
      const { data, error } = await supabase.rpc('create_match', {
        p_event_code: p.eventCode,
        p_stage: p.stage,
        p_college_a: p.collegeA,
        p_college_b: p.collegeB,
        p_side_a_name: p.sideAName,
        p_side_b_name: p.sideBName,
        p_side_a_player_ids: p.sideAPlayerIds ?? [],
        p_side_b_player_ids: p.sideBPlayerIds ?? [],
        p_target_points: p.targetPoints,
        p_win_by_two: p.winByTwo,
        p_max_points: p.maxPoints,
        p_best_of_games: p.bestOfGames,
        p_first_server: p.firstServer,
        p_is_synthetic: false,
        p_external_video_id: null,
      });
      if (error) throw error;
      return data as string;
    },
  });
}

function invalidateMatchQueries(queryClient: ReturnType<typeof useQueryClient>, matchId: string) {
  queryClient.invalidateQueries({ queryKey: ['match-kpis', matchId] });
  queryClient.invalidateQueries({ queryKey: ['live-matches'] });
  queryClient.invalidateQueries({ queryKey: ['completed-matches'] });
}

export function useRecordPoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ matchId, side }: { matchId: string; side: 'A' | 'B' }): Promise<RecordPointResult> => {
      const { data, error } = await supabase.rpc('record_match_point', { p_match_id: matchId, p_winning_side: side });
      if (error) throw error;
      return data as RecordPointResult;
    },
    onSuccess: (_data, { matchId }) => invalidateMatchQueries(queryClient, matchId),
  });
}

export function useUndoPoint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string) => {
      const { data, error } = await supabase.rpc('undo_last_match_point', { p_match_id: matchId });
      if (error) throw error;
      return data as RecordPointResult;
    },
    onSuccess: (_data, matchId) => invalidateMatchQueries(queryClient, matchId),
  });
}

export function useCompleteMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string) => {
      const { data, error } = await supabase.rpc('complete_match', { p_match_id: matchId });
      if (error) throw error;
      return data as { matchId: string; winningSide: 'A' | 'B' };
    },
    onSuccess: (_data, matchId) => invalidateMatchQueries(queryClient, matchId),
  });
}

/**
 * Dev-only synthetic-data controls. `generate_synthetic_kpi_matches()` itself refuses to run
 * unless a super_admin has explicitly enabled `app_config.allow_synthetic_data` against this
 * specific Supabase project (never done on prod) -- this hook has no client-side environment
 * check of its own, deliberately, since the backend is the real gate (see the migration header).
 */
export function useGenerateSyntheticData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('generate_synthetic_kpi_matches');
      if (error) throw error;
      return data as { playersCreated: number; matchesCreated: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['completed-matches'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
    },
  });
}

export function useDeleteSyntheticData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('delete_synthetic_kpi_matches');
      if (error) throw error;
      return data as { matchesDeleted: number; playersDeleted: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['completed-matches'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
    },
  });
}
