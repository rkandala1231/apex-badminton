import { describe, expect, it } from 'vitest';
import { cascadeRank, type HeadToHead, type Tiebreaker } from './rank';

interface Entry {
  name: string;
  matchesWon: number;
  gameDiff: number;
  rallyDiff: number;
}

const individualTiebreakers: Tiebreaker<Entry>[] = [
  { label: 'game difference', value: (e) => e.gameDiff },
  { label: 'rally-point difference', value: (e) => e.rallyDiff },
];

function ranked(entries: Entry[], h2h: HeadToHead<Entry>) {
  return cascadeRank(entries, {
    primary: (e) => e.matchesWon,
    primaryLabel: 'matches won',
    tiebreakers: individualTiebreakers,
    headToHead: h2h,
  });
}

const noHeadToHead: HeadToHead<Entry> = () => 'tie';

describe('cascadeRank — individual/pair pools', () => {
  it('ranks a pool with no ties purely by matches won', () => {
    const A: Entry = { name: 'A', matchesWon: 3, gameDiff: 0, rallyDiff: 0 };
    const B: Entry = { name: 'B', matchesWon: 2, gameDiff: 0, rallyDiff: 0 };
    const C: Entry = { name: 'C', matchesWon: 1, gameDiff: 0, rallyDiff: 0 };
    const D: Entry = { name: 'D', matchesWon: 0, gameDiff: 0, rallyDiff: 0 };

    const result = ranked([D, B, A, C], noHeadToHead);

    expect(result.map((r) => r.entry.name)).toEqual(['A', 'B', 'C', 'D']);
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(result.every((r) => !r.tieBreakRequired)).toBe(true);
    expect(result[0].decidedBy).toBe('matches won');
  });

  it('resolves a two-way tie on matches won by head-to-head', () => {
    const A: Entry = { name: 'A', matchesWon: 2, gameDiff: 1, rallyDiff: 1 };
    const B: Entry = { name: 'B', matchesWon: 2, gameDiff: 5, rallyDiff: 5 }; // better stats, but lost head-to-head
    const C: Entry = { name: 'C', matchesWon: 1, gameDiff: 0, rallyDiff: 0 };

    const h2h: HeadToHead<Entry> = (a, b) => {
      if (a.name === 'A' && b.name === 'B') return 'a';
      if (a.name === 'B' && b.name === 'A') return 'b';
      return 'tie';
    };

    const result = ranked([A, B, C], h2h);

    expect(result.map((r) => r.entry.name)).toEqual(['A', 'B', 'C']);
    expect(result[0].decidedBy).toBe('head-to-head');
    expect(result[1].decidedBy).toBe('head-to-head');
    expect(result.every((r) => !r.tieBreakRequired)).toBe(true);
    // A decisive head-to-head result orders the pair definitively -- they must NOT share a rank
    // number the way a genuinely unresolved tie would.
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('resolves a three-way tie on matches won by game difference', () => {
    const A: Entry = { name: 'A', matchesWon: 2, gameDiff: 3, rallyDiff: 0 };
    const B: Entry = { name: 'B', matchesWon: 2, gameDiff: 1, rallyDiff: 0 };
    const C: Entry = { name: 'C', matchesWon: 2, gameDiff: -1, rallyDiff: 0 };

    const result = ranked([C, A, B], noHeadToHead);

    expect(result.map((r) => r.entry.name)).toEqual(['A', 'B', 'C']);
    expect(result.map((r) => r.decidedBy)).toEqual(['game difference', 'game difference', 'game difference']);
    expect(result.every((r) => !r.tieBreakRequired)).toBe(true);
  });

  it('falls through to rally-point difference when game difference is also tied three ways', () => {
    const A: Entry = { name: 'A', matchesWon: 2, gameDiff: 2, rallyDiff: 40 };
    const B: Entry = { name: 'B', matchesWon: 2, gameDiff: 2, rallyDiff: 20 };
    const C: Entry = { name: 'C', matchesWon: 2, gameDiff: 2, rallyDiff: 5 };

    const result = ranked([C, B, A], noHeadToHead);

    expect(result.map((r) => r.entry.name)).toEqual(['A', 'B', 'C']);
    expect(result.map((r) => r.decidedBy)).toEqual([
      'rally-point difference',
      'rally-point difference',
      'rally-point difference',
    ]);
  });

  it('drops a two-way tie straight to remaining tiebreakers when no head-to-head result exists yet', () => {
    const A: Entry = { name: 'A', matchesWon: 2, gameDiff: 4, rallyDiff: 0 };
    const B: Entry = { name: 'B', matchesWon: 2, gameDiff: 1, rallyDiff: 0 };

    const result = ranked([B, A], noHeadToHead);

    expect(result.map((r) => r.entry.name)).toEqual(['A', 'B']);
    expect(result.every((r) => !r.tieBreakRequired)).toBe(true);
  });

  it('flags an unresolved three-way tie after every criterion is exhausted', () => {
    const A: Entry = { name: 'A', matchesWon: 2, gameDiff: 2, rallyDiff: 10 };
    const B: Entry = { name: 'B', matchesWon: 2, gameDiff: 2, rallyDiff: 10 };
    const C: Entry = { name: 'C', matchesWon: 2, gameDiff: 2, rallyDiff: 10 };
    const D: Entry = { name: 'D', matchesWon: 0, gameDiff: -6, rallyDiff: -30 };

    const result = ranked([A, B, C, D], noHeadToHead);

    const top3 = result.filter((r) => r.entry.matchesWon === 2);
    expect(top3).toHaveLength(3);
    expect(top3.every((r) => r.tieBreakRequired)).toBe(true);
    expect(top3.every((r) => r.rank === 1)).toBe(true); // competition-style: all three share rank 1
    const last = result.find((r) => r.entry.name === 'D')!;
    expect(last.rank).toBe(4); // next rank skips past the 3 tied entries
    expect(last.tieBreakRequired).toBe(false);
  });
});

interface TeamEntry {
  college: string;
  tiesWon: number;
  tieDiff: number;
  matchDiff: number;
  gameDiff: number;
  rallyDiff: number;
}

describe('cascadeRank — College Team pools', () => {
  const teamTiebreakers: Tiebreaker<TeamEntry>[] = [
    { label: 'team-tie difference', value: (t) => t.tieDiff },
    { label: 'individual-match difference', value: (t) => t.matchDiff },
    { label: 'game difference', value: (t) => t.gameDiff },
    { label: 'rally-point difference', value: (t) => t.rallyDiff },
  ];

  function rankTeams(entries: TeamEntry[], h2h: HeadToHead<TeamEntry>) {
    return cascadeRank(entries, {
      primary: (t) => t.tiesWon,
      primaryLabel: 'team ties won',
      tiebreakers: teamTiebreakers,
      headToHead: h2h,
    });
  }

  it('resolves a three-way team tie by individual-match difference once tie-difference is level', () => {
    const rutgers: TeamEntry = { college: 'Rutgers', tiesWon: 2, tieDiff: 1, matchDiff: 3, gameDiff: 0, rallyDiff: 0 };
    const tcnj: TeamEntry = { college: 'TCNJ', tiesWon: 2, tieDiff: 1, matchDiff: 1, gameDiff: 0, rallyDiff: 0 };
    const rider: TeamEntry = { college: 'Rider University', tiesWon: 2, tieDiff: 1, matchDiff: -1, gameDiff: 0, rallyDiff: 0 };

    const result = rankTeams([rider, rutgers, tcnj], () => 'tie');

    expect(result.map((r) => r.entry.college)).toEqual(['Rutgers', 'TCNJ', 'Rider University']);
    expect(result.every((r) => r.decidedBy === 'individual-match difference')).toBe(true);
    expect(result.every((r) => !r.tieBreakRequired)).toBe(true);
  });

  it('uses head-to-head the moment team-tie difference narrows it to exactly two colleges', () => {
    const rutgers: TeamEntry = { college: 'Rutgers', tiesWon: 2, tieDiff: 1, matchDiff: 2, gameDiff: 0, rallyDiff: 0 };
    const tcnj: TeamEntry = { college: 'TCNJ', tiesWon: 2, tieDiff: 1, matchDiff: 2, gameDiff: 0, rallyDiff: 0 };
    const rider: TeamEntry = { college: 'Rider University', tiesWon: 2, tieDiff: -1, matchDiff: 0, gameDiff: 0, rallyDiff: 0 };

    const h2h: HeadToHead<TeamEntry> = (a, b) => {
      if (a.college === 'TCNJ' && b.college === 'Rutgers') return 'a';
      if (a.college === 'Rutgers' && b.college === 'TCNJ') return 'b';
      return 'tie';
    };

    const result = rankTeams([rutgers, rider, tcnj], h2h);

    expect(result.map((r) => r.entry.college)).toEqual(['TCNJ', 'Rutgers', 'Rider University']);
    expect(result[0].decidedBy).toBe('head-to-head');
    expect(result[1].decidedBy).toBe('head-to-head');
    // TCNJ and Rutgers are definitively ordered by head-to-head, so they get distinct sequential
    // ranks (1 and 2), not a shared rank -- Rider is a separate, lower primary-criterion group.
    expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
});
