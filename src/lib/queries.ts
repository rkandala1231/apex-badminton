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
  completed_at: string | null;
  match_games: MatchGameRow[];
}

/** Back-compat aliases — CompletedMatches.tsx was written against these names. */
export type CompletedMatchGameRow = MatchGameRow;
export type CompletedMatchRow = MatchRow;

const MATCH_SELECT =
  'id, event_code, stage, format, college_a, college_b, side_a_name, side_b_name, winner_side, completed_at, match_games(game_index, a_score, b_score, winner_side)';

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
 * other. Polls on a short interval since this is the one Match Center tab meant to visibly
 * update while someone's looking at it, without adding a Realtime subscription.
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
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
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
