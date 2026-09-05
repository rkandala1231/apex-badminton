import type { CollegeName } from '../../../lib/matchCenterData';

export type Side = 'A' | 'B';
export type Stage = 'roundrobin' | 'knockout';
export type Format = 'single' | 'bo3';
export type LiveEventType = 'MS' | 'WS' | 'MD' | 'WD' | 'XD' | 'TEAM';

export interface GameState {
  a: number;
  b: number;
  winner: Side | null;
  intervalShown: boolean;
}

export interface LogEntry {
  gameIndex: number;
  side: Side;
  prevServer: Side;
}

export interface MatchState {
  stage: Stage;
  format: Format;
  eventType: LiveEventType;
  nameA: string;
  nameB: string;
  collegeA: CollegeName | null;
  collegeB: CollegeName | null;
  playersA: string[];
  playersB: string[];
  firstServer: Side;
  started: boolean;
  games: GameState[];
  server: Side;
  matchWinner: Side | null;
  log: LogEntry[];
  /**
   * The Supabase `matches.id` for this match once `startLiveMatch` succeeds, null until then (or
   * forever, if that call failed -- e.g. offline court-side wifi). Drives whether live scoring
   * syncs progress as it happens (id present) or only saves once at the end (id null, the
   * pre-Live-Scores fallback). Persisted to localStorage with the rest of MatchState so a page
   * reload mid-match resumes syncing to the same row instead of creating a duplicate.
   */
  matchId: string | null;
}

export interface StartSetup {
  stage: Stage;
  format: Format;
  eventType: LiveEventType;
  nameA: string;
  nameB: string;
  collegeA: CollegeName | null;
  collegeB: CollegeName | null;
  playersA: string[];
  playersB: string[];
  firstServer: Side;
}
