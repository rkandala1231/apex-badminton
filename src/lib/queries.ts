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
  winner_side: 'A' | 'B' | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  created_at: string;
  completed_at: string | null;
  match_games: MatchGameRow[];
}

/** Back-compat aliases — CompletedMatches.tsx was written against these names. */
export type CompletedMatchGameRow = MatchGameRow;
export type CompletedMatchRow = MatchRow;

const MATCH_SELECT =
  'id, event_code, stage, format, college_a, college_b, side_a_name, side_b_name, winner_side, status, created_at, completed_at, match_games(game_index, a_score, b_score, winner_side)';

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
 * Chronological schedule of every match that's either being played right now or already
 * finished, across all events. There's no "upcoming" state here by design: nothing in the schema
 * records a match before a scorer actually starts it (see matchStats.ts's startMatch), so a true
 * pre-game schedule doesn't exist as data yet -- this reflects the real matches table as-is
 * rather than inventing placeholder rows for matches nobody has started.
 */
export function useScheduleMatches(eventCode: EventCode | null) {
  return useQuery({
    queryKey: ['schedule-matches', eventCode],
    queryFn: async (): Promise<MatchRow[]> => {
      let query = supabase
        .from('matches')
        .select(MATCH_SELECT)
        .in('status', ['in_progress', 'completed'])
        .order('created_at', { ascending: false });

      if (eventCode) {
        query = query.eq('event_code', eventCode);
      }

      const { data, error } = await query;
      if (error) throw error;
      return sortGames((data as MatchRow[]) || []);
    },
    staleTime: 15_000,
    refetchInterval: 30_000, // realtime-first, same fallback cadence as useLiveMatches
    refetchOnWindowFocus: true,
  });
}

/**
 * Opens one Supabase Realtime subscription covering `matches` and `match_games`, and invalidates
 * every query family derived from them whenever a row changes -- Live Scores, Completed Matches,
 * Schedule, and Standings all refresh within about a second of an admin scoring a point or
 * finishing a match, instead of waiting on their next poll.
 *
 * Deliberately coarse: any insert/update/delete on either table invalidates all four query
 * families rather than patching the cache per-row. The dataset is small (one college
 * tournament's worth of matches), so a full refetch per change is cheap, and it can't drift out
 * of sync with calc.ts's ranking logic the way a hand-rolled partial cache update could.
 *
 * Mount this exactly once (in MatchCenter.tsx) so every tab underneath shares the one channel
 * instead of each opening its own socket. The polling on useLiveMatches/useScheduleMatches/
 * usePoolStandings stays in place as a fallback -- if the socket ever drops, those still
 * eventually catch up on their own.
 */
export function useRealtimeMatchSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ['live-matches'] });
      queryClient.invalidateQueries({ queryKey: ['completed-matches'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-matches'] });
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
