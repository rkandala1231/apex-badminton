/**
 * Generic BWF-aligned cascade ranking.
 *
 * Same shape serves both individual/pair pools and College Team pools -- only the criteria
 * differ (see calc.ts) -- because the actual cascade RULE is identical in both cases:
 *
 *   1. Sort by the primary criterion (matches won, or team ties won).
 *   2. Whenever that leaves exactly TWO entries level, the head-to-head result between just
 *      those two decides it immediately -- before consulting any other numeric criterion.
 *   3. Whenever it leaves THREE OR MORE entries level, move to the next numeric tiebreaker
 *      (e.g. game difference) and re-group by that instead.
 *   4. Repeat: any resulting 2-way tie goes back to head-to-head; any resulting 3+-way tie moves
 *      to the next tiebreaker in the list.
 *   5. If entries are still 3-or-more-way tied after every tiebreaker is exhausted, they cannot
 *      be safely ordered by an algorithm -- surfaced as `tieBreakRequired` for a human to decide.
 *
 * This module has no knowledge of matches, players, or colleges -- it only knows how to order an
 * array of `T` given a way to score each one and a way to compare two of them head-to-head, which
 * keeps it fully unit-testable without a database or any fixture data.
 */

export type HeadToHead<T> = (a: T, b: T) => 'a' | 'b' | 'tie';

export interface Tiebreaker<T> {
  /** Human-readable name, surfaced later so an admin can see which criterion decided a rank. */
  label: string;
  /** Higher value ranks better. */
  value: (entry: T) => number;
}

export interface CascadeOptions<T> {
  /** Higher value ranks better. Entries are grouped by equal primary value first. */
  primary: (entry: T) => number;
  primaryLabel: string;
  /** Applied in order, only to groups of 3+ that remain tied after the previous criterion. */
  tiebreakers: Tiebreaker<T>[];
  headToHead: HeadToHead<T>;
}

export interface RankedEntry<T> {
  entry: T;
  /** 1-based, competition-style: a 3-way unresolved tie for e.g. 2nd all show rank 2, and the
   *  next entry after them is rank 5, not 3 -- consistent with how "T2" ties are usually shown. */
  rank: number;
  tieBreakRequired: boolean;
  /** What actually separated this entry from the rest at its position, for transparency. */
  decidedBy: string;
}

function groupByDesc<T>(entries: T[], value: (e: T) => number): T[][] {
  // Stable grouping: entries keep their relative input order within a group, and groups are
  // emitted highest-value-first.
  const groups = new Map<number, T[]>();
  for (const e of entries) {
    const v = value(e);
    const g = groups.get(v);
    if (g) g.push(e);
    else groups.set(v, [e]);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([, g]) => g);
}

interface ResolvedGroup<T> {
  entries: T[];
  tieBreakRequired: boolean;
  decidedBy: string;
}

// `currentLabel` is the criterion that produced the group being resolved right now -- it's only
// ever updated at the point a grouping actually SPLITS the incoming entries into more than one
// subgroup (i.e. that criterion is what separated them). A criterion that leaves everyone still
// tied is not a decision, so it's never recorded -- resolution just moves on to the next one with
// the previous label carried through unchanged.
function resolveGroup<T>(group: T[], tiebreakers: Tiebreaker<T>[], tbIndex: number, headToHead: HeadToHead<T>, currentLabel: string): ResolvedGroup<T>[] {
  if (group.length <= 1) {
    return [{ entries: group, tieBreakRequired: false, decidedBy: currentLabel }];
  }

  if (group.length === 2) {
    const [a, b] = group;
    const h2h = headToHead(a, b);
    if (h2h === 'a') return [{ entries: [a, b], tieBreakRequired: false, decidedBy: 'head-to-head' }];
    if (h2h === 'b') return [{ entries: [b, a], tieBreakRequired: false, decidedBy: 'head-to-head' }];
    // No decisive head-to-head available (e.g. the pool hasn't reached that match yet) -- fall
    // through to whatever numeric criteria remain rather than guessing.
    if (tbIndex < tiebreakers.length) {
      const crit = tiebreakers[tbIndex];
      const subgroups = groupByDesc(group, crit.value);
      if (subgroups.length === 1) {
        return resolveGroup(group, tiebreakers, tbIndex + 1, headToHead, currentLabel);
      }
      return subgroups.flatMap((sg) => resolveGroup(sg, tiebreakers, tbIndex + 1, headToHead, crit.label));
    }
    return [{ entries: group, tieBreakRequired: true, decidedBy: 'no head-to-head result and no further tiebreakers' }];
  }

  // 3 or more still level.
  if (tbIndex >= tiebreakers.length) {
    return [{ entries: group, tieBreakRequired: true, decidedBy: 'tied on every BWF criterion' }];
  }
  const crit = tiebreakers[tbIndex];
  const subgroups = groupByDesc(group, crit.value);
  if (subgroups.length === 1) {
    // Still fully tied on this criterion too -- move straight to the next one, unresolved.
    return resolveGroup(group, tiebreakers, tbIndex + 1, headToHead, currentLabel);
  }
  return subgroups.flatMap((sg) => resolveGroup(sg, tiebreakers, tbIndex + 1, headToHead, crit.label));
}

export function cascadeRank<T>(entries: T[], opts: CascadeOptions<T>): RankedEntry<T>[] {
  const primaryGroups = groupByDesc(entries, opts.primary);
  const resolvedGroups = primaryGroups.flatMap((g) => resolveGroup(g, opts.tiebreakers, 0, opts.headToHead, opts.primaryLabel));

  const ranked: RankedEntry<T>[] = [];
  let position = 1;
  for (const g of resolvedGroups) {
    for (const entry of g.entries) {
      ranked.push({ entry, rank: position, tieBreakRequired: g.tieBreakRequired, decidedBy: g.decidedBy });
    }
    position += g.entries.length;
  }
  return ranked;
}
