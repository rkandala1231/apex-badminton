import type { EventCode } from '../matchCenterData';

/** Mirrors the jsonb shape `_player_career_stats` builds per format in the player-statistics migration. */
export interface PlayerFormatRecord {
  played: number;
  won: number;
  lost: number;
}

export interface PlaceholderInfo {
  available: false;
  reason: string;
}

/**
 * Mirrors `_player_career_stats`'s returned jsonb (20260907010000_player_statistics_rpcs.sql),
 * plus `mvpScore` which `get_player_profile`/`get_player_leaderboard` merge in afterward (null
 * below the 3-completed-match MVP eligibility threshold -- see that migration's header).
 */
export interface PlayerStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  winPercentage: number;
  byFormat: Record<EventCode, PlayerFormatRecord>;
  pointsWon: number;
  pointsLost: number;
  pointWinPercentage: number;
  pointDifferential: number;
  servePointsPlayed: number;
  servePointsWon: number;
  serveWinPercentage: number | null;
  comebackWins: number;
  momentumRuns: number;
  longestCareerStreak: number;
  intervalLeads: number;
  intervalLeadsConverted: number;
  intervalCloseOutPercentage: number | null;
  clutchPointsPlayed: number;
  clutchPointsWon: number;
  clutchPointWinPercentage: number | null;
  mvpScore: number | null;
}

export interface PlayerGameScore {
  a: number;
  b: number;
}

export interface PlayerMatchHistoryEntry {
  matchId: string;
  eventCode: EventCode;
  date: string | null;
  opponentName: string;
  opponentCollege: string | null;
  side: 'A' | 'B';
  gameScores: PlayerGameScore[];
  result: 'W' | 'L';
  externalVideoId: string | null;
}

export interface PlayerProfile {
  playerId: string;
  name: string;
  college: string | null;
  stats: PlayerStats;
  matchHistory: PlayerMatchHistoryEntry[];
  placeholders: {
    winnersUnforcedErrors: PlaceholderInfo;
    serveReceive: PlaceholderInfo;
    rallyLength: PlaceholderInfo;
  };
}

export interface PlayerLeaderboardRow {
  playerId: string;
  name: string;
  college: string | null;
  mvpScore: number;
  matchesPlayed: number;
  winPercentage: number;
  pointWinPercentage: number;
}
