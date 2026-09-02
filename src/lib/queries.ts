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
