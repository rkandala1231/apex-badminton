// Match Center content model.
// Intentionally empty for players / schedule / draws until real tournament data is entered —
// these arrays are the seams to fill in (or wire to Supabase) once registration & seeding are live.

export type CollegeName = 'TCNJ' | 'Rutgers' | 'Rider University';

export const COLLEGES: CollegeName[] = ['TCNJ', 'Rutgers', 'Rider University'];

export type EventCode = 'MS' | 'WS' | 'MD' | 'WD' | 'XD';

export const DRAW_EVENTS: { code: EventCode; label: string }[] = [
  { code: 'MS', label: "Men's Singles" },
  { code: 'WS', label: "Women's Singles" },
  { code: 'MD', label: "Men's Doubles" },
  { code: 'WD', label: "Women's Doubles" },
  { code: 'XD', label: 'Mixed Doubles' },
];

export interface Player {
  name: string;
  college: CollegeName;
  events: EventCode[];
}

// No players yet — colleges are registered, rosters are not in.
export const PLAYERS: Player[] = [];

export interface ScheduleRow {
  time: string;
  event: EventCode | 'TEAM';
  match: string;
  court: string;
  status: 'FINAL' | 'LIVE' | 'UPCOMING';
}

// No matches scheduled yet.
export const SCHEDULE: ScheduleRow[] = [];

export interface DrawMatch {
  round: string;
  a: { name: string; score?: number };
  b: { name: string; score?: number };
  status: 'final' | 'live' | 'upcoming';
}

// No brackets seeded yet, one empty list per event (now includes Mixed Doubles).
export const DRAWS: Record<EventCode, DrawMatch[]> = {
  MS: [],
  WS: [],
  MD: [],
  WD: [],
  XD: [],
};

export interface LiveMatch {
  event: EventCode | 'TEAM';
  a: string;
  aScore: number;
  b: string;
  bScore: number;
  court: string;
}

export const LIVE_MATCHES: LiveMatch[] = [];
export const COMPLETED_MATCHES: LiveMatch[] = [];
