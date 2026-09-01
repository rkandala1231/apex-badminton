export type EventCode = 'MS' | 'WS' | 'MD' | 'WD' | 'XD' | 'TEAM';

export type RegionName = 'Northeast' | 'Southeast' | 'Midwest' | 'South' | 'Mountain' | 'Pacific';

export type RegistrationStatus = 'pending' | 'confirmed' | 'waitlisted' | 'cancelled';

export interface EventMeta {
  code: EventCode;
  label: string;
  colorVar: string;
}

export const EVENT_META: EventMeta[] = [
  { code: 'MS', label: "Men's Singles", colorVar: 'var(--color-ev-ms)' },
  { code: 'WS', label: "Women's Singles", colorVar: 'var(--color-ev-ws)' },
  { code: 'MD', label: "Men's Doubles", colorVar: 'var(--color-ev-md)' },
  { code: 'WD', label: "Women's Doubles", colorVar: 'var(--color-ev-wd)' },
  { code: 'XD', label: 'Mixed Doubles', colorVar: 'var(--color-ev-xd)' },
  { code: 'TEAM', label: 'College Team', colorVar: 'var(--color-ev-team)' },
];

export const REGIONS: RegionName[] = ['Northeast', 'Southeast', 'Midwest', 'South', 'Mountain', 'Pacific'];

export interface SummaryStats {
  colleges_registered: number;
  total_entries: number;
  colleges_this_week: number;
  entries_this_week: number;
}

export interface EventCountRow {
  event_code: EventCode;
  entries: number;
}

export interface RegionCountRow {
  region: RegionName;
  colleges: number;
}

export interface WeeklyTrendRow {
  week_start: string;
  new_regs: number;
  cumulative: number;
}

export interface AdminRegistrationRow {
  id: string;
  college_name: string;
  captain_name: string;
  captain_email: string;
  region: RegionName;
  roster_size: number | null;
  status: RegistrationStatus;
  created_at: string;
  events: EventCode[];
}

export interface RegisterPayload {
  p_college_name: string;
  p_captain_name: string;
  p_captain_email: string;
  p_region: RegionName;
  p_roster_size: number | null;
  p_notes: string | null;
  p_event_codes: EventCode[];
}
