/**
 * Turns raw `matches`/`match_games` rows into the per-entry (individual/pair pool) or per-college
 * (College Team pool) stats the Standings page ranks and displays.
 *
 * Pure, no Supabase import -- everything here operates on plain arrays so it's unit-testable the
 * same way rank.ts is. queries.ts is responsible for fetching the real rows and handing them to
 * these functions in the shapes declared below.
 */

import { cascadeRank, type HeadToHead, type RankedEntry, type Tiebreaker } from './rank';

// ---------------------------------------------------------------------------------------------
// Shared match shape
// ---------------------------------------------------------------------------------------------

export interface MatchGameLike {
  a_score: number;
  b_score: number;
  winner_side: 'A' | 'B' | null;
}

export interface MatchLike {
  id: string;
  pool_id: string | null;
  team_tie_id: string | null;
  college_a: string;
  college_b: string;
  side_a_name: string;
  side_b_name: string;
  winner_side: 'A' | 'B' | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  result_type: 'normal' | 'walkover' | 'retirement' | 'disqualification';
  match_games: MatchGameLike[];
}

/**
 * Only completed matches are real results for standings purposes -- an abandoned match (or one
 * still in progress) must never move a pool's table, same rule the existing Completed Matches tab
 * already applies (see queries.ts useCompletedMatches).
 */
function completedOnly(matches: MatchLike[]): MatchLike[] {
  return matches.filter((m) => m.status === 'completed');
}

// ---------------------------------------------------------------------------------------------
// Individual / pair pools (MS, WS, MD, WD, XD)
// ---------------------------------------------------------------------------------------------

export interface PoolEntryLike {
  id: string;
  entry_name: string;
  college: string;
}

export interface IndividualStats {
  entry: PoolEntryLike;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  gamesWon: number;
  gamesLost: number;
  rallyFor: number;
  rallyAgainst: number;
}

function emptyIndividualStats(entry: PoolEntryLike): IndividualStats {
  return { entry, matchesPlayed: 0, matchesWon: 0, matchesLost: 0, gamesWon: 0, gamesLost: 0, rallyFor: 0, rallyAgainst: 0 };
}

/**
 * Builds one stat line per pool entry from every completed match in the pool that entry played
 * in. A walkover/retirement/disqualification match still counts as a win or loss (result_type
 * doesn't change who won) but usually carries no match_games -- those matches simply contribute
 * 0 to games/rally, which is the correct, honest value for a match that was never actually played.
 */
export function computeIndividualStats(entries: PoolEntryLike[], matches: MatchLike[]): IndividualStats[] {
  const byName = new Map(entries.map((e) => [e.entry_name, emptyIndividualStats(e)]));

  for (const m of completedOnly(matches)) {
    if (!m.winner_side) continue; // guard against a malformed row rather than letting it corrupt stats
    for (const [name, side] of [
      [m.side_a_name, 'A'],
      [m.side_b_name, 'B'],
    ] as const) {
      const stats = byName.get(name);
      if (!stats) continue; // match references an entry not in this pool -- ignore, don't crash
      stats.matchesPlayed += 1;
      if (m.winner_side === side) stats.matchesWon += 1;
      else stats.matchesLost += 1;
      for (const g of m.match_games) {
        const own = side === 'A' ? g.a_score : g.b_score;
        const opp = side === 'A' ? g.b_score : g.a_score;
        stats.rallyFor += own;
        stats.rallyAgainst += opp;
        if (g.winner_side === side) stats.gamesWon += 1;
        else if (g.winner_side) stats.gamesLost += 1;
      }
    }
  }

  return entries.map((e) => byName.get(e.entry_name)!);
}

const individualTiebreakers: Tiebreaker<IndividualStats>[] = [
  { label: 'game difference', value: (s) => s.gamesWon - s.gamesLost },
  { label: 'rally-point difference', value: (s) => s.rallyFor - s.rallyAgainst },
];

/** Head-to-head: did `a`'s entry beat `b`'s entry directly, in a completed match in this pool? */
function individualHeadToHead(matches: MatchLike[]): HeadToHead<IndividualStats> {
  const completed = completedOnly(matches);
  return (a, b) => {
    for (const m of completed) {
      if (!m.winner_side) continue;
      const aIsSideA = m.side_a_name === a.entry.entry_name && m.side_b_name === b.entry.entry_name;
      const aIsSideB = m.side_b_name === a.entry.entry_name && m.side_a_name === b.entry.entry_name;
      if (aIsSideA) return m.winner_side === 'A' ? 'a' : 'b';
      if (aIsSideB) return m.winner_side === 'B' ? 'a' : 'b';
    }
    return 'tie';
  };
}

export function rankIndividualPool(entries: PoolEntryLike[], matches: MatchLike[]): RankedEntry<IndividualStats>[] {
  const stats = computeIndividualStats(entries, matches);
  return cascadeRank(stats, {
    primary: (s) => s.matchesWon,
    primaryLabel: 'matches won',
    tiebreakers: individualTiebreakers,
    headToHead: individualHeadToHead(matches),
  });
}

// ---------------------------------------------------------------------------------------------
// College Team pools (TEAM)
// ---------------------------------------------------------------------------------------------

export interface TeamTieLike {
  id: string;
  college_a: string;
  college_b: string;
}

export interface TeamStats {
  college: string;
  tiesWon: number;
  tiesLost: number;
  tiesPending: number;
  matchesWon: number;
  matchesLost: number;
  gamesWon: number;
  gamesLost: number;
  rallyFor: number;
  rallyAgainst: number;
}

function emptyTeamStats(college: string): TeamStats {
  return { college, tiesWon: 0, tiesLost: 0, tiesPending: 0, matchesWon: 0, matchesLost: 0, gamesWon: 0, gamesLost: 0, rallyFor: 0, rallyAgainst: 0 };
}

/**
 * A College Team "tie" is 5 individual rubbers (MS/WS/MD/WD/XD) sharing one team_tie_id. The tie
 * itself isn't decided until enough of those rubbers are completed to know who won more of them --
 * BWF Uber/Thomas Cup-style ties are single best-of-5, so as soon as one college has reached 3
 * rubber wins the tie's outcome is fixed even if 1-2 rubbers are still unplayed/dead. Until then
 * the tie counts as pending, not a result, for either college -- never guessed at.
 */
export function computeTeamStats(ties: TeamTieLike[], matches: MatchLike[]): TeamStats[] {
  const colleges = new Set<string>();
  for (const t of ties) {
    colleges.add(t.college_a);
    colleges.add(t.college_b);
  }
  const byCollege = new Map([...colleges].map((c) => [c, emptyTeamStats(c)]));
  const completed = completedOnly(matches);

  for (const tie of ties) {
    const tieMatches = completed.filter((m) => m.team_tie_id === tie.id);
    let aWins = 0;
    let bWins = 0;
    for (const m of tieMatches) {
      if (!m.winner_side) continue;
      const aSideIsCollegeA = m.college_a === tie.college_a;
      const collegeAWonThisRubber = (m.winner_side === 'A') === aSideIsCollegeA;
      if (collegeAWonThisRubber) aWins += 1;
      else bWins += 1;

      // Individual-rubber and game/rally tallies accrue per college regardless of whether the
      // overall tie has been decided yet -- these are the "individual-match difference" /
      // "game difference" / "rally-point difference" tiebreakers, which BWF applies across all
      // rubbers played, not just rubbers in decided ties.
      const aStats = byCollege.get(tie.college_a)!;
      const bStats = byCollege.get(tie.college_b)!;
      if (collegeAWonThisRubber) {
        aStats.matchesWon += 1;
        bStats.matchesLost += 1;
      } else {
        bStats.matchesWon += 1;
        aStats.matchesLost += 1;
      }
      for (const g of m.match_games) {
        const aScore = aSideIsCollegeA ? g.a_score : g.b_score;
        const bScore = aSideIsCollegeA ? g.b_score : g.a_score;
        aStats.rallyFor += aScore;
        aStats.rallyAgainst += bScore;
        bStats.rallyFor += bScore;
        bStats.rallyAgainst += aScore;
        if (g.winner_side === null) continue;
        const collegeAWonGame = (g.winner_side === 'A') === aSideIsCollegeA;
        if (collegeAWonGame) {
          aStats.gamesWon += 1;
          bStats.gamesLost += 1;
        } else {
          bStats.gamesWon += 1;
          aStats.gamesLost += 1;
        }
      }
    }

    const decided = aWins >= 3 || bWins >= 3;
    const aTeam = byCollege.get(tie.college_a)!;
    const bTeam = byCollege.get(tie.college_b)!;
    if (decided) {
      if (aWins > bWins) {
        aTeam.tiesWon += 1;
        bTeam.tiesLost += 1;
      } else {
        bTeam.tiesWon += 1;
        aTeam.tiesLost += 1;
      }
    } else {
      aTeam.tiesPending += 1;
      bTeam.tiesPending += 1;
    }
  }

  return [...byCollege.values()];
}

const teamTiebreakers: Tiebreaker<TeamStats>[] = [
  { label: 'team-tie difference', value: (s) => s.tiesWon - s.tiesLost },
  { label: 'individual-match difference', value: (s) => s.matchesWon - s.matchesLost },
  { label: 'game difference', value: (s) => s.gamesWon - s.gamesLost },
  { label: 'rally-point difference', value: (s) => s.rallyFor - s.rallyAgainst },
];

/** Head-to-head: did `a`'s college win the decided tie directly against `b`'s college? */
function teamHeadToHead(ties: TeamTieLike[], matches: MatchLike[]): HeadToHead<TeamStats> {
  return (a, b) => {
    const tie = ties.find(
      (t) => (t.college_a === a.college && t.college_b === b.college) || (t.college_b === a.college && t.college_a === b.college)
    );
    if (!tie) return 'tie';
    const completed = completedOnly(matches).filter((m) => m.team_tie_id === tie.id);
    let aWins = 0;
    let bWins = 0;
    for (const m of completed) {
      if (!m.winner_side) continue;
      const aSideIsA = m.college_a === a.college;
      const aCollegeWon = (m.winner_side === 'A') === aSideIsA;
      if (aCollegeWon) aWins += 1;
      else bWins += 1;
    }
    if (aWins < 3 && bWins < 3) return 'tie'; // not decided yet
    return aWins > bWins ? 'a' : 'b';
  };
}

export function rankTeamPool(ties: TeamTieLike[], matches: MatchLike[]): RankedEntry<TeamStats>[] {
  const stats = computeTeamStats(ties, matches);
  return cascadeRank(stats, {
    primary: (s) => s.tiesWon,
    primaryLabel: 'team ties won',
    tiebreakers: teamTiebreakers,
    headToHead: teamHeadToHead(ties, matches),
  });
}

// ---------------------------------------------------------------------------------------------
// Qualification status
// ---------------------------------------------------------------------------------------------

export type QualificationStatus = 'Q' | 'In Contention' | 'Eliminated' | 'Tie-break Required';

/**
 * A round-robin pool is only "complete" once every unique pair of its entries has met at least
 * once (any status counts as "met" here as long as the match is on record; only completed matches
 * feed the stats above, but a walkover still resolves the pairing). Until then we deliberately
 * never mark anyone Eliminated or Q -- ranking mid-pool is informative, but calling a spot locked
 * in before the pool is actually finished is exactly the premature-qualification failure mode the
 * feature spec calls out. This is a conservative, intentionally simple rule for Phase 1: it does
 * not attempt to detect a mathematical clinch/elimination before every pairing has been played,
 * which is a legitimate enhancement but out of scope here.
 */
export function isPoolComplete(entryNames: string[], matches: MatchLike[]): boolean {
  if (entryNames.length < 2) return true;
  const played = new Set<string>();
  for (const m of matches) {
    if (entryNames.includes(m.side_a_name) && entryNames.includes(m.side_b_name)) {
      const key = [m.side_a_name, m.side_b_name].sort().join('|');
      played.add(key);
    }
  }
  for (let i = 0; i < entryNames.length; i += 1) {
    for (let j = i + 1; j < entryNames.length; j += 1) {
      const key = [entryNames[i], entryNames[j]].sort().join('|');
      if (!played.has(key)) return false;
    }
  }
  return true;
}

export function isTeamPoolComplete(ties: TeamTieLike[], matches: MatchLike[]): boolean {
  return ties.every((tie) => {
    const tieMatches = completedOnly(matches).filter((m) => m.team_tie_id === tie.id);
    let aWins = 0;
    let bWins = 0;
    for (const m of tieMatches) {
      if (!m.winner_side) continue;
      const aSideIsA = m.college_a === tie.college_a;
      if ((m.winner_side === 'A') === aSideIsA) aWins += 1;
      else bWins += 1;
    }
    return aWins >= 3 || bWins >= 3;
  });
}

/**
 * Assigns Q / In Contention / Eliminated / Tie-break Required to a already-ranked pool.
 *
 * - While the pool isn't complete: everyone is "In Contention" -- never Q, never Eliminated.
 * - Once complete: the top `qualifierCount` spots are "Q", the rest "Eliminated" -- unless the
 *   cutoff falls inside an unresolved tied group (tieBreakRequired), in which case every entry in
 *   that group is "Tie-break Required" rather than guessed into Q or Eliminated.
 */
export function assignQualification<T>(ranked: RankedEntry<T>[], qualifierCount: number, poolComplete: boolean): (RankedEntry<T> & { status: QualificationStatus })[] {
  if (!poolComplete) {
    return ranked.map((r) => ({ ...r, status: 'In Contention' as const }));
  }
  return ranked.map((r) => {
    if (r.tieBreakRequired) return { ...r, status: 'Tie-break Required' as const };
    return { ...r, status: (r.rank <= qualifierCount ? 'Q' : 'Eliminated') as QualificationStatus };
  });
}
