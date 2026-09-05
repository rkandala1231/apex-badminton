// Pure, DB-free reference implementation of the five Match KPI formulas, mirroring the
// server-side logic in supabase/migrations/20260905190000_match_kpi_schema_and_rpcs.sql
// (public._game_winner / public.get_match_kpis) statement-for-statement.
//
// This module is NOT what the app displays -- "All official KPI calculations must occur on the
// backend" (get_match_kpis is the one authoritative source; see useMatchKpis in queries.ts). It
// exists so the algorithm itself can be unit-tested fast, in isolation, against independently
// hand-computed fixtures (see calc.test.ts) without a database -- the same reason
// src/lib/standings/calc.ts takes plain arrays in and plain data out.

export type Side = 'A' | 'B';

export interface RallyLike {
  gameIndex: number;
  scoringSide: Side;
}

export interface GameFormat {
  targetPoints: number;
  winByTwo: boolean;
  maxPoints: number | null;
}

/** Mirrors public._game_winner(a, b, target, win_by_two, max) exactly. */
export function gameWinner(a: number, b: number, format: GameFormat): Side | null {
  const { targetPoints, winByTwo, maxPoints } = format;

  if (!winByTwo) {
    if (a >= targetPoints) return 'A';
    if (b >= targetPoints) return 'B';
    return null;
  }

  if (maxPoints !== null) {
    if (a >= maxPoints) return 'A';
    if (b >= maxPoints) return 'B';
  }
  if (a >= targetPoints && a - b >= 2) return 'A';
  if (b >= targetPoints && b - a >= 2) return 'B';
  return null;
}

export interface StreakDetail {
  length: number;
  game: number; // 1-based, matching the gameScores[].game convention
  startA: number;
  startB: number;
  endA: number;
  endB: number;
}

export interface SideKpis {
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

export interface MatchKpis {
  sideA: SideKpis;
  sideB: SideKpis;
}

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

/**
 * Replays a match's full rally log (in play order) and computes both sides' KPIs. `rallies` must
 * already be ordered by (gameIndex, pointIndex) -- the caller (get_match_kpis, or a test fixture)
 * owns that ordering, same division of responsibility as standings/calc.ts.
 */
export function computeMatchKpis(rallies: RallyLike[], format: GameFormat): MatchKpis {
  let totalA = 0;
  let totalB = 0;
  let clutchPlayed = 0;
  let clutchWonA = 0;
  let clutchWonB = 0;

  let bestA: StreakDetail | null = null;
  let bestB: StreakDetail | null = null;

  let runSide: Side | null = null;
  let runLen = 0;
  let runGame = 0;
  let runStartA = 0;
  let runStartB = 0;

  let curA = 0;
  let curB = 0;
  let curGame = -1;

  const clutchThreshold = format.targetPoints - 3;

  for (const rally of rallies) {
    if (rally.gameIndex !== curGame) {
      curGame = rally.gameIndex;
      curA = 0;
      curB = 0;
      runSide = null;
      runLen = 0;
    }

    if (rally.scoringSide === 'A') totalA += 1;
    else totalB += 1;

    // Clutch eligibility uses the score BEFORE this point.
    if (curA >= clutchThreshold && curB >= clutchThreshold && Math.abs(curA - curB) <= 2) {
      clutchPlayed += 1;
      if (rally.scoringSide === 'A') clutchWonA += 1;
      else clutchWonB += 1;
    }

    if (rally.scoringSide === runSide) {
      runLen += 1;
    } else {
      runSide = rally.scoringSide;
      runLen = 1;
      runGame = rally.gameIndex;
      runStartA = curA;
      runStartB = curB;
    }

    if (rally.scoringSide === 'A') curA += 1;
    else curB += 1;

    const detail: StreakDetail = {
      length: runLen,
      game: runGame + 1,
      startA: runStartA,
      startB: runStartB,
      endA: curA,
      endB: curB,
    };
    if (runSide === 'A') {
      if (!bestA || runLen > bestA.length) bestA = detail;
    } else {
      if (!bestB || runLen > bestB.length) bestB = detail;
    }
  }

  const sideA: SideKpis = {
    pointsWon: totalA,
    pointsLost: totalB,
    pointWinPercentage: pct(totalA, totalA + totalB),
    pointDifferential: totalA - totalB,
    longestScoringStreak: bestA?.length ?? 0,
    longestStreakDetail: bestA,
    clutchPointsWon: clutchWonA,
    clutchPointsPlayed: clutchPlayed,
    clutchPointWinPercentage: clutchPlayed === 0 ? null : pct(clutchWonA, clutchPlayed),
  };
  const sideB: SideKpis = {
    pointsWon: totalB,
    pointsLost: totalA,
    pointWinPercentage: pct(totalB, totalA + totalB),
    pointDifferential: totalB - totalA,
    longestScoringStreak: bestB?.length ?? 0,
    longestStreakDetail: bestB,
    clutchPointsWon: clutchWonB,
    clutchPointsPlayed: clutchPlayed,
    clutchPointWinPercentage: clutchPlayed === 0 ? null : pct(clutchWonB, clutchPlayed),
  };

  return { sideA, sideB };
}

/** required game wins for a best-of-N match, e.g. 3 -> 2, 1 -> 1, 5 -> 3. */
export function requiredGameWins(bestOfGames: number): number {
  return Math.floor(bestOfGames / 2) + 1;
}
