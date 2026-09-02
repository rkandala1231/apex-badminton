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
