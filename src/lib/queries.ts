import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import type {
  AdminRegistrationRow,
  EventCountRow,
  RegionCountRow,
  RegisterPayload,
  SummaryStats,
  WeeklyTrendRow,
} from './types';

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
  const [statsRes, eventsRes, regionsRes, trendRes] = await Promise.all([
    supabase.from('public_summary_stats').select('*').maybeSingle(),
    supabase.from('public_event_counts').select('*'),
    supabase.from('public_region_counts').select('*'),
    supabase.from('public_weekly_trend').select('*').order('week_start'),
  ]);

  const firstError = statsRes.error || eventsRes.error || regionsRes.error || trendRes.error;
  if (firstError) throw firstError;

  return {
    stats: (statsRes.data as SummaryStats) || EMPTY_STATS,
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
