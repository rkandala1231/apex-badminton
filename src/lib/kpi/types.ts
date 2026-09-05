import type { EventCode } from '../types';
import type { StreakDetail } from './calc';

export type Side = 'A' | 'B';
export type MatchStatus = 'scheduled' | 'in_progress' | 'completed' | 'abandoned';

/** One side's KPIs as returned by get_match_kpis() -- the backend-authoritative shape. */
export interface MatchKpiSide {
  pointsWon: number;
  pointsLost: number;
  pointWinPercentage: number;
  pointDifferential: number;
  longestScoringStreak: number;
  longestStreakDetail: StreakDetail | null;
  clutchPointsWon: number;
  clutchPointsPlayed: number;
  clutchPointWinPercentage: number | null; // null => "No clutch situations in this match"
}

export interface MatchKpiGameScore {
  game: number; // 1-based
  sideA: number;
  sideB: number;
  winner: Side | null;
  sideAPointWinPercentage: number;
  sideBPointWinPercentage: number;
}

/** The full get_match_kpis() response. One backend call feeds Summary, Table, and Charts alike. */
export interface MatchKpis {
  matchId: string;
  eventCode: EventCode;
  matchType: 'singles' | 'doubles';
  status: MatchStatus;
  winningSide: Side | null;
  sideAName: string;
  sideBName: string;
  collegeA: string;
  collegeB: string;
  targetPoints: number;
  winByTwo: boolean;
  maxPoints: number | null;
  bestOfGames: number;
  isSynthetic: boolean;
  externalVideoId: string | null;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  gameScores: MatchKpiGameScore[];
  sideA: MatchKpiSide;
  sideB: MatchKpiSide;
}

export interface RecordPointResult {
  gameIndex: number;
  sideAScore: number;
  sideBScore: number;
  gameWinner: Side | null;
  gamesWonA: number;
  gamesWonB: number;
  matchReadyToComplete: boolean;
}

export const SCORING_PRESETS = {
  apex15: { label: 'APEX 15-point', targetPoints: 15, winByTwo: false, maxPoints: null as number | null },
  standard21: { label: 'Standard 21-point', targetPoints: 21, winByTwo: true, maxPoints: 30 as number | null },
} as const;

export type ScoringPresetKey = keyof typeof SCORING_PRESETS;
