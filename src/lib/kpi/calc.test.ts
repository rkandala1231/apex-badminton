import { describe, expect, it } from 'vitest';
import { computeMatchKpis, gameWinner, requiredGameWins, type RallyLike, type Side } from './calc';

/** Expands a compact scoring string like 'AAABBA' into ordered RallyLike rows for one game. */
function game(gameIndex: number, seq: string): RallyLike[] {
  return seq.split('').map((ch) => ({ gameIndex, scoringSide: ch as Side }));
}

describe('gameWinner', () => {
  it('standard 21, win-by-two: requires a 2-point margin at or past target', () => {
    expect(gameWinner(21, 19, { targetPoints: 21, winByTwo: true, maxPoints: 30 })).toBe('A');
    expect(gameWinner(21, 20, { targetPoints: 21, winByTwo: true, maxPoints: 30 })).toBeNull();
    expect(gameWinner(22, 20, { targetPoints: 21, winByTwo: true, maxPoints: 30 })).toBe('A');
  });

  it('standard 21, capped at 30: reaching the cap wins outright regardless of margin', () => {
    expect(gameWinner(30, 29, { targetPoints: 21, winByTwo: true, maxPoints: 30 })).toBe('A');
  });

  it('APEX 15, no win-by-two: first to target wins outright', () => {
    expect(gameWinner(15, 14, { targetPoints: 15, winByTwo: false, maxPoints: null })).toBe('A');
    expect(gameWinner(14, 15, { targetPoints: 15, winByTwo: false, maxPoints: null })).toBe('B');
    expect(gameWinner(14, 14, { targetPoints: 15, winByTwo: false, maxPoints: null })).toBeNull();
  });
});

describe('requiredGameWins', () => {
  it('best of three needs 2 game wins; best of one needs 1', () => {
    expect(requiredGameWins(3)).toBe(2);
    expect(requiredGameWins(1)).toBe(1);
    expect(requiredGameWins(5)).toBe(3);
  });
});

describe('computeMatchKpis — full three-game match (independently hand-computed expectations)', () => {
  // Same fixture verified end-to-end against the real get_match_kpis() Postgres RPC before this
  // test was written (see the delivery notes) -- these expected numbers were derived by hand
  // from the scoring rules, not by running computeMatchKpis and copying its output.
  //
  // Game 1 (target 21, win-by-two, cap 30): A run of 9, B, A run of 11, B, A -- A wins 21-2.
  // Game 2: alternating B,A x19 then B,B -- B wins 21-19; 4 clutch points (both >=18, diff<=2):
  //   B,A,B,B in that order -- B wins 3, A wins 1.
  // Game 3: B x5 then A x21 -- A wins 21-5, a 21-long streak (the match-wide longest).
  const format = { targetPoints: 21, winByTwo: true, maxPoints: 30 };
  const rallies: RallyLike[] = [
    ...game(0, 'A'.repeat(9) + 'B' + 'A'.repeat(11) + 'B' + 'A'),
    ...game(1, 'BA'.repeat(19) + 'BB'),
    ...game(2, 'B'.repeat(5) + 'A'.repeat(21)),
  ];
  const result = computeMatchKpis(rallies, format);

  it('point totals and point-win percentage', () => {
    expect(result.sideA.pointsWon).toBe(61);
    expect(result.sideB.pointsWon).toBe(28);
    expect(result.sideA.pointWinPercentage).toBeCloseTo(68.54, 2);
    expect(result.sideB.pointWinPercentage).toBeCloseTo(31.46, 2);
  });

  it('point differential', () => {
    expect(result.sideA.pointDifferential).toBe(33);
    expect(result.sideB.pointDifferential).toBe(-33);
  });

  it('longest scoring streak, with game/start/end detail', () => {
    expect(result.sideA.longestScoringStreak).toBe(21);
    expect(result.sideA.longestStreakDetail).toEqual({
      length: 21, game: 3, startA: 0, startB: 5, endA: 21, endB: 5,
    });
    expect(result.sideB.longestScoringStreak).toBe(5);
    expect(result.sideB.longestStreakDetail).toEqual({
      length: 5, game: 3, startA: 0, startB: 0, endA: 0, endB: 5,
    });
  });

  it('clutch-point win rate', () => {
    expect(result.sideA.clutchPointsPlayed).toBe(4);
    expect(result.sideB.clutchPointsPlayed).toBe(4);
    expect(result.sideA.clutchPointsWon).toBe(1);
    expect(result.sideB.clutchPointsWon).toBe(3);
    expect(result.sideA.clutchPointWinPercentage).toBeCloseTo(25, 2);
    expect(result.sideB.clutchPointWinPercentage).toBeCloseTo(75, 2);
  });

  it('invariant: side A points + side B points = total recorded rallies', () => {
    expect(result.sideA.pointsWon + result.sideB.pointsWon).toBe(rallies.length);
  });
});

describe('computeMatchKpis — straight-game match (2-0, no decider)', () => {
  const format = { targetPoints: 21, winByTwo: true, maxPoints: 30 };
  const rallies: RallyLike[] = [...game(0, 'A'.repeat(21)), ...game(1, 'A'.repeat(21) + 'B'.repeat(10))];
  const result = computeMatchKpis(rallies, format);

  it('sums points across exactly two games', () => {
    expect(result.sideA.pointsWon).toBe(42);
    expect(result.sideB.pointsWon).toBe(10);
  });
});

describe('computeMatchKpis — APEX 15 format (no win-by-two)', () => {
  const format = { targetPoints: 15, winByTwo: false, maxPoints: null };

  it('games to 15, decided the instant target is reached, no clutch when margins stay wide', () => {
    const rallies = game(0, 'A'.repeat(15) + 'B'.repeat(3));
    const result = computeMatchKpis(rallies, format);
    expect(result.sideA.pointsWon).toBe(15);
    expect(result.sideB.pointsWon).toBe(3);
    expect(result.sideA.clutchPointsPlayed).toBe(0);
    expect(result.sideA.clutchPointWinPercentage).toBeNull();
  });
});

describe('computeMatchKpis — no clutch situations', () => {
  it('reports null clutchPointWinPercentage (UI renders "No clutch situations in this match")', () => {
    const format = { targetPoints: 21, winByTwo: true, maxPoints: 30 };
    // A blowout where B never gets within reach of the clutch threshold at the same time as A.
    const rallies = game(0, 'A'.repeat(21) + 'B'.repeat(3));
    const result = computeMatchKpis(rallies, format);
    expect(result.sideA.clutchPointsPlayed).toBe(0);
    expect(result.sideB.clutchPointsPlayed).toBe(0);
    expect(result.sideA.clutchPointWinPercentage).toBeNull();
    expect(result.sideB.clutchPointWinPercentage).toBeNull();
  });
});

describe('computeMatchKpis — deuce beyond target under win-by-two, capped at 30', () => {
  it('a game can extend past target_points as long as the cap is not reached', () => {
    // 23-21: alternating to 21-21, then A,A to close it out at +2.
    const rallies = game(0, 'AB'.repeat(21) + 'AA');
    const result = computeMatchKpis(rallies, { targetPoints: 21, winByTwo: true, maxPoints: 30 });
    expect(result.sideA.pointsWon).toBe(23);
    expect(result.sideB.pointsWon).toBe(21);
  });
});
