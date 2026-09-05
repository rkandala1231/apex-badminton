import { describe, expect, it } from 'vitest';
import {
  assignQualification,
  computeIndividualStats,
  computeTeamStats,
  isPoolComplete,
  isTeamPoolComplete,
  rankIndividualPool,
  rankTeamPool,
  type MatchLike,
  type PoolEntryLike,
  type TeamTieLike,
} from './calc';

function match(overrides: Partial<MatchLike>): MatchLike {
  return {
    id: 'm',
    pool_id: 'pool-1',
    team_tie_id: null,
    college_a: 'TCNJ',
    college_b: 'Rutgers',
    side_a_name: 'A',
    side_b_name: 'B',
    winner_side: 'A',
    status: 'completed',
    result_type: 'normal',
    match_games: [],
    ...overrides,
  };
}

describe('computeIndividualStats', () => {
  const entries: PoolEntryLike[] = [
    { id: '1', entry_name: 'Alice', college: 'TCNJ' },
    { id: '2', entry_name: 'Bob', college: 'Rutgers' },
    { id: '3', entry_name: 'Cara', college: 'Rider University' },
  ];

  it('aggregates games and rally points from a normal completed match', () => {
    const matches: MatchLike[] = [
      match({
        side_a_name: 'Alice',
        side_b_name: 'Bob',
        winner_side: 'A',
        match_games: [
          { a_score: 21, b_score: 15, winner_side: 'A' },
          { a_score: 18, b_score: 21, winner_side: 'B' },
          { a_score: 21, b_score: 12, winner_side: 'A' },
        ],
      }),
    ];

    const stats = computeIndividualStats(entries, matches);
    const alice = stats.find((s) => s.entry.entry_name === 'Alice')!;
    const bob = stats.find((s) => s.entry.entry_name === 'Bob')!;

    expect(alice.matchesPlayed).toBe(1);
    expect(alice.matchesWon).toBe(1);
    expect(alice.gamesWon).toBe(2);
    expect(alice.gamesLost).toBe(1);
    expect(alice.rallyFor).toBe(60);
    expect(alice.rallyAgainst).toBe(48);

    expect(bob.matchesLost).toBe(1);
    expect(bob.gamesWon).toBe(1);
    expect(bob.rallyFor).toBe(48);
    expect(bob.rallyAgainst).toBe(60);
  });

  it('counts a walkover as a win/loss without inventing games or rally points', () => {
    const matches: MatchLike[] = [
      match({ side_a_name: 'Alice', side_b_name: 'Cara', winner_side: 'A', result_type: 'walkover', match_games: [] }),
    ];

    const stats = computeIndividualStats(entries, matches);
    const alice = stats.find((s) => s.entry.entry_name === 'Alice')!;
    const cara = stats.find((s) => s.entry.entry_name === 'Cara')!;

    expect(alice.matchesWon).toBe(1);
    expect(alice.gamesWon).toBe(0);
    expect(alice.rallyFor).toBe(0);
    expect(cara.matchesLost).toBe(1);
  });

  it('ignores matches that are not completed', () => {
    const matches: MatchLike[] = [match({ side_a_name: 'Alice', side_b_name: 'Bob', status: 'in_progress' })];
    const stats = computeIndividualStats(entries, matches);
    expect(stats.every((s) => s.matchesPlayed === 0)).toBe(true);
  });
});

describe('rankIndividualPool + qualification', () => {
  const entries: PoolEntryLike[] = [
    { id: '1', entry_name: 'Alice', college: 'TCNJ' },
    { id: '2', entry_name: 'Bob', college: 'Rutgers' },
    { id: '3', entry_name: 'Cara', college: 'Rider University' },
  ];

  it('never marks anyone Eliminated or Q while the pool is incomplete', () => {
    // Only Alice-vs-Bob has been played; Alice-vs-Cara and Bob-vs-Cara haven't happened yet.
    const matches: MatchLike[] = [match({ side_a_name: 'Alice', side_b_name: 'Bob', winner_side: 'A' })];

    expect(isPoolComplete(['Alice', 'Bob', 'Cara'], matches)).toBe(false);

    const ranked = rankIndividualPool(entries, matches);
    const withStatus = assignQualification(ranked, 2, false);
    expect(withStatus.every((r) => r.status === 'In Contention')).toBe(true);
  });

  it('assigns Q to the top qualifierCount and Eliminated to the rest once the pool is complete', () => {
    const matches: MatchLike[] = [
      match({ side_a_name: 'Alice', side_b_name: 'Bob', winner_side: 'A' }),
      match({ side_a_name: 'Alice', side_b_name: 'Cara', winner_side: 'A' }),
      match({ side_a_name: 'Bob', side_b_name: 'Cara', winner_side: 'A' }),
    ];

    expect(isPoolComplete(['Alice', 'Bob', 'Cara'], matches)).toBe(true);

    const ranked = rankIndividualPool(entries, matches);
    const withStatus = assignQualification(ranked, 2, true);

    const alice = withStatus.find((r) => r.entry.entry.entry_name === 'Alice')!;
    const bob = withStatus.find((r) => r.entry.entry.entry_name === 'Bob')!;
    const cara = withStatus.find((r) => r.entry.entry.entry_name === 'Cara')!;

    expect(alice.status).toBe('Q'); // 2 wins
    expect(bob.status).toBe('Q'); // 1 win, beats Cara
    expect(cara.status).toBe('Eliminated'); // 0 wins
  });

  it('flags an unresolved tie straddling the cutoff as Tie-break Required instead of guessing', () => {
    const fourEntries: PoolEntryLike[] = [
      ...entries,
      { id: '4', entry_name: 'Dev', college: 'TCNJ' },
    ];
    // Alice beats everyone (clear 1st, 3 wins). Bob/Cara/Dev form a 3-cycle among themselves
    // (Bob beats Cara, Cara beats Dev, Dev beats Bob) with identical 21-10 scorelines, so all
    // three finish 1 win/1 loss with equal game diff and equal rally diff -- genuinely
    // unresolvable by any BWF numeric criterion, and there's no 2-way head-to-head to fall back
    // on since it's a 3-way cyclic tie.
    const matches: MatchLike[] = [
      match({ side_a_name: 'Alice', side_b_name: 'Bob', winner_side: 'A', match_games: [{ a_score: 21, b_score: 10, winner_side: 'A' }] }),
      match({ side_a_name: 'Alice', side_b_name: 'Cara', winner_side: 'A', match_games: [{ a_score: 21, b_score: 10, winner_side: 'A' }] }),
      match({ side_a_name: 'Alice', side_b_name: 'Dev', winner_side: 'A', match_games: [{ a_score: 21, b_score: 10, winner_side: 'A' }] }),
      match({ side_a_name: 'Bob', side_b_name: 'Cara', winner_side: 'A', match_games: [{ a_score: 21, b_score: 10, winner_side: 'A' }] }),
      match({ side_a_name: 'Cara', side_b_name: 'Dev', winner_side: 'A', match_games: [{ a_score: 21, b_score: 10, winner_side: 'A' }] }),
      match({ side_a_name: 'Dev', side_b_name: 'Bob', winner_side: 'A', match_games: [{ a_score: 21, b_score: 10, winner_side: 'A' }] }),
    ];

    expect(isPoolComplete(['Alice', 'Bob', 'Cara', 'Dev'], matches)).toBe(true);

    const ranked = rankIndividualPool(fourEntries, matches);
    const withStatus = assignQualification(ranked, 2, true);

    const tied = withStatus.filter((r) => r.entry.entry.entry_name !== 'Alice');
    expect(tied).toHaveLength(3);
    expect(tied.every((r) => r.status === 'Tie-break Required')).toBe(true);
    expect(withStatus.find((r) => r.entry.entry.entry_name === 'Alice')!.status).toBe('Q');
  });
});

describe('computeTeamStats + rankTeamPool', () => {
  const ties: TeamTieLike[] = [{ id: 'tie-1', college_a: 'TCNJ', college_b: 'Rutgers' }];

  function rubber(overrides: Partial<MatchLike>): MatchLike {
    return match({ team_tie_id: 'tie-1', college_a: 'TCNJ', college_b: 'Rutgers', ...overrides });
  }

  it('leaves a tie pending until one college reaches 3 rubber wins', () => {
    const matches: MatchLike[] = [
      rubber({ side_a_name: 'MS-T', side_b_name: 'MS-R', winner_side: 'A' }),
      rubber({ side_a_name: 'WS-T', side_b_name: 'WS-R', winner_side: 'B' }),
    ];
    expect(isTeamPoolComplete(ties, matches)).toBe(false);

    const stats = computeTeamStats(ties, matches);
    const tcnj = stats.find((s) => s.college === 'TCNJ')!;
    expect(tcnj.tiesWon).toBe(0);
    expect(tcnj.tiesLost).toBe(0);
    expect(tcnj.tiesPending).toBe(1);
    // Individual-rubber tallies still accrue even though the tie overall isn't decided.
    expect(tcnj.matchesWon).toBe(1);
    expect(tcnj.matchesLost).toBe(1);
  });

  it('resolves the tie once a college reaches 3 rubber wins, even with rubbers unplayed', () => {
    const matches: MatchLike[] = [
      rubber({ side_a_name: 'MS-T', side_b_name: 'MS-R', winner_side: 'A' }),
      rubber({ side_a_name: 'WS-T', side_b_name: 'WS-R', winner_side: 'A' }),
      rubber({ side_a_name: 'MD-T', side_b_name: 'MD-R', winner_side: 'A' }),
      // WD and XD never played -- tie is already decided 3-0.
    ];
    expect(isTeamPoolComplete(ties, matches)).toBe(true);

    const stats = computeTeamStats(ties, matches);
    const tcnj = stats.find((s) => s.college === 'TCNJ')!;
    const rutgers = stats.find((s) => s.college === 'Rutgers')!;
    expect(tcnj.tiesWon).toBe(1);
    expect(rutgers.tiesLost).toBe(1);

    const ranked = rankTeamPool(ties, matches);
    expect(ranked.map((r) => r.entry.college)).toEqual(['TCNJ', 'Rutgers']);
    expect(ranked[0].decidedBy).toBe('team ties won');
  });
});
