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
  /**
   * True when `matchId` is an existing row picked from Schedule (see StartSetup.scheduledMatchId)
   * rather than one `startLiveMatch` created fresh for this session. Matters only if the match is
   * ended with zero points scored: an ad hoc row gets discarded outright (nothing worth keeping),
   * but a scheduled row is admin's Schedule data -- possibly already published -- so it's reverted
   * back to `scheduled` instead of deleted. See useLiveScoring's endMatch.
   */
  startedFromSchedule: boolean;
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
  /**
   * Set when this match was picked from the Schedule tab instead of set up ad hoc. Tells
   * useLiveScoring to transition the existing scheduled `matches` row (startScheduledMatch) rather
   * than create a new one (startLiveMatch) -- see AdminScheduleSection / PickFromSchedule.
   */
  scheduledMatchId?: string;
}
