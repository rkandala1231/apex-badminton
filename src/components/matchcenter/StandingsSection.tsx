import { useState } from 'react';
import { AlertTriangle, CircleDot, Trophy } from 'lucide-react';
import {
  usePoolStandings,
  usePools,
  type IndividualStandingsResult,
  type PoolRow,
  type TeamStandingsResult,
} from '../../lib/queries';
import type { QualificationStatus } from '../../lib/standings/calc';
import { EVENT_META, type EventCode } from '../../lib/types';
import { EmptyState } from './shared';

const selectCls =
  'bg-surface-2 border border-border rounded-lg px-3 py-2 text-text-primary font-semibold text-[0.82rem]';

/**
 * Rank-position styling. Deliberately never the ONLY signal for a position -- the numeral itself
 * (1, 2, 3...) is always printed too, and the medal icon carries its own accessible label. Color
 * is reinforcement, not the message.
 */
const RANK_STYLE: Record<number, { color: string; label: string }> = {
  1: { color: 'var(--color-gold)', label: 'Gold position' },
  2: { color: 'var(--color-silver)', label: 'Silver position' },
  3: { color: 'var(--color-bronze)', label: 'Bronze position' },
};

export function StandingsSection() {
  const [eventCode, setEventCode] = useState<EventCode>('MS');
  const { data: pools, isLoading: poolsLoading, isError: poolsError } = usePools(eventCode);

  // Which pool the visitor explicitly picked, if any -- `null` means "no explicit choice yet",
  // which resolves to the first published pool for the current event. Derived during render
  // rather than pushed into state from an effect, so there's no extra render pass and no risk of
  // this falling out of sync with `pools` when the event changes.
  const [explicitPoolId, setExplicitPoolId] = useState<string | null>(null);
  const poolId = explicitPoolId && pools?.some((p) => p.id === explicitPoolId) ? explicitPoolId : (pools?.[0]?.id ?? '');

  const selectedPool: PoolRow | null = pools?.find((p) => p.id === poolId) ?? null;
  const { data: standings, isLoading: standingsLoading, isError: standingsError } = usePoolStandings(selectedPool);

  return (
    <div>
      <h1 className="text-[1.5rem] sm:text-[1.8rem] mb-1 sm:mb-1.5">Standings</h1>
      <p className="text-[0.86rem] sm:text-[0.95rem] mb-1.5 sm:mb-2 max-w-[62ch] leading-snug">
        Pool rankings for round-robin play, calculated live from completed match results using
        BWF-aligned tie-break rules.
      </p>
      <p className="text-[0.74rem] sm:text-[0.78rem] text-text-muted mb-4 sm:mb-5 max-w-[62ch] leading-snug">
        Draft or in-progress scores never affect this table — a result counts here only once it's
        published as completed. Ties that can't be resolved by the numeric criteria below are
        flagged for manual review rather than guessed.
      </p>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 mb-4 sm:mb-5">
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <select
            value={eventCode}
            onChange={(e) => {
              setEventCode(e.target.value as EventCode);
              setExplicitPoolId(null); // switching events invalidates whatever pool was picked
            }}
            className={`${selectCls} w-full sm:w-auto`}
            aria-label="Event"
          >
            {EVENT_META.map((e) => (
              <option key={e.code} value={e.code}>
                {e.label}
              </option>
            ))}
          </select>

          <select
            value={poolId}
            onChange={(e) => setExplicitPoolId(e.target.value)}
            className={`${selectCls} w-full sm:w-auto`}
            disabled={!pools || pools.length === 0}
            aria-label="Pool"
          >
            {!pools || pools.length === 0 ? (
              <option value="">No pools yet</option>
            ) : (
              pools.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))
            )}
          </select>
        </div>

        {standings && (
          <div className="flex items-center gap-2 sm:ml-auto text-[0.72rem] text-text-muted">
            {standings.hasLiveMatches && (
              <span className="flex items-center gap-1.5 mono font-semibold uppercase tracking-wide text-accent">
                <CircleDot className="w-3 h-3 animate-pulse" aria-hidden />
                Live
              </span>
            )}
            {standings.lastUpdated ? (
              <span>
                Updated{' '}
                {new Date(standings.lastUpdated).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            ) : (
              <span>No results yet</span>
            )}
          </div>
        )}
      </div>

      {poolsLoading || (standingsLoading && !!selectedPool) ? (
        <div className="h-[260px] bg-surface-1 border border-border rounded-2xl animate-pulse" />
      ) : poolsError || standingsError ? (
        <EmptyState text="Couldn't load standings right now. Try refreshing." />
      ) : !pools || pools.length === 0 ? (
        <EmptyState text={`No pools have been set up for ${EVENT_META.find((e) => e.code === eventCode)?.label ?? eventCode} yet.`} />
      ) : !standings ? (
        <EmptyState text="Select a pool to see standings." />
      ) : standings.kind === 'team' ? (
        <TeamStandingsTable data={standings} />
      ) : (
        <IndividualStandingsTable data={standings} />
      )}

      <Legend />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Individual / pair pools
// ---------------------------------------------------------------------------------------------
//
// One real <table> at every screen size -- no separate mobile card list. Mobile-first sizing
// (small type/padding by default, roomier from `sm:` up) keeps it usable on a phone; if a very
// narrow screen still can't fit every column, the wrapper scrolls horizontally rather than the
// page ever hiding data or wrapping the layout into something else.

function IndividualStandingsTable({ data }: { data: IndividualStandingsResult }) {
  if (data.entries.length === 0) {
    return <EmptyState text="No entries in this pool yet." />;
  }

  return (
    <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[0.76rem] sm:text-[0.84rem]">
          <thead>
            <tr className="text-left text-text-muted text-[0.62rem] sm:text-[0.68rem] uppercase tracking-wide border-b border-border">
              <Th>Rank</Th>
              <Th>Player / Pair</Th>
              <Th>College</Th>
              <Th align="right">P</Th>
              <Th align="right">W–L</Th>
              <Th align="right">Game Diff</Th>
              <Th align="right">Rally Diff</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((r, i) => (
              <tr
                key={r.entry.entry.id}
                className={`border-b border-border-soft last:border-0 ${data.poolComplete && i === data.pool.qualifier_count - 1 ? 'border-b-2 border-b-accent/50' : ''}`}
              >
                <Td>
                  <RankBadge rank={r.rank} />
                </Td>
                <Td>
                  <span className="font-bold text-text-primary">{r.entry.entry.entry_name}</span>
                </Td>
                <Td className="mono text-[0.68rem] sm:text-[0.72rem] uppercase tracking-wide text-text-muted">
                  {r.entry.entry.college}
                </Td>
                <Td align="right" className="mono tabular-nums">
                  {r.entry.matchesPlayed}
                </Td>
                <Td align="right" className="mono tabular-nums">
                  {r.entry.matchesWon}–{r.entry.matchesLost}
                </Td>
                <Td align="right" className="mono tabular-nums">
                  {formatDiff(r.entry.gamesWon - r.entry.gamesLost)}
                </Td>
                <Td align="right" className="mono tabular-nums">
                  {formatDiff(r.entry.rallyFor - r.entry.rallyAgainst)}
                </Td>
                <Td>
                  <StatusBadge status={r.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// College Team pools
// ---------------------------------------------------------------------------------------------

function TeamStandingsTable({ data }: { data: TeamStandingsResult }) {
  if (data.entries.length === 0) {
    return <EmptyState text="No colleges in this pool yet." />;
  }

  return (
    <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-[0.76rem] sm:text-[0.84rem]">
          <thead>
            <tr className="text-left text-text-muted text-[0.62rem] sm:text-[0.68rem] uppercase tracking-wide border-b border-border">
              <Th>Rank</Th>
              <Th>College</Th>
              <Th align="right">Ties</Th>
              <Th align="right">Matches</Th>
              <Th align="right">Game Diff</Th>
              <Th align="right">Rally Diff</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((r, i) => (
              <tr
                key={r.entry.college}
                className={`border-b border-border-soft last:border-0 ${data.poolComplete && i === data.pool.qualifier_count - 1 ? 'border-b-2 border-b-accent/50' : ''}`}
              >
                <Td>
                  <RankBadge rank={r.rank} />
                </Td>
                <Td className="font-bold text-text-primary">{r.entry.college}</Td>
                <Td align="right" className="mono tabular-nums">
                  {r.entry.tiesWon}–{r.entry.tiesLost}
                  {r.entry.tiesPending > 0 && <span className="text-text-muted"> ({r.entry.tiesPending} pending)</span>}
                </Td>
                <Td align="right" className="mono tabular-nums">
                  {r.entry.matchesWon}–{r.entry.matchesLost}
                </Td>
                <Td align="right" className="mono tabular-nums">
                  {formatDiff(r.entry.gamesWon - r.entry.gamesLost)}
                </Td>
                <Td align="right" className="mono tabular-nums">
                  {formatDiff(r.entry.rallyFor - r.entry.rallyAgainst)}
                </Td>
                <Td>
                  <StatusBadge status={r.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------------------------

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <th className={`px-2.5 py-2 sm:px-4 sm:py-2.5 font-semibold ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</th>;
}

function Td({ children, align = 'left', className = '' }: { children: React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  return <td className={`px-2.5 py-2.5 sm:px-4 sm:py-3 ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}>{children}</td>;
}

function formatDiff(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function RankBadge({ rank }: { rank: number }) {
  const style = RANK_STYLE[rank];
  return (
    <span className="inline-flex items-center gap-1.5 mono font-bold tabular-nums text-[0.9rem]" title={style?.label}>
      {style ? <Trophy className="w-3.5 h-3.5" style={{ color: style.color }} aria-hidden /> : null}
      <span style={style ? { color: style.color } : undefined}>{rank}</span>
    </span>
  );
}

const STATUS_STYLE: Record<QualificationStatus, { text: string; className: string; icon?: React.ReactNode }> = {
  Q: { text: 'Q', className: 'text-accent border-accent/40 bg-accent-soft' },
  'In Contention': { text: 'In Contention', className: 'text-text-secondary border-border bg-surface-2' },
  Eliminated: { text: 'Eliminated', className: 'text-text-muted border-border bg-surface-2' },
  'Tie-break Required': {
    text: 'Tie-break',
    className: 'text-gold border-gold/40 bg-surface-2',
    icon: <AlertTriangle className="w-3 h-3" aria-hidden />,
  },
};

function StatusBadge({ status }: { status: QualificationStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1 mono text-[0.62rem] sm:text-[0.68rem] font-semibold uppercase tracking-wide px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full border whitespace-nowrap ${s.className}`}
    >
      {s.icon}
      {s.text}
    </span>
  );
}

function Legend() {
  return (
    <div className="mt-4 sm:mt-6 rounded-xl border border-border-soft bg-surface-1/60 px-4 py-3.5 text-[0.72rem] sm:text-[0.74rem] text-text-muted flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2">
      <div className="flex items-center gap-4">
        <LegendItem swatch="var(--color-gold)" label="1st" />
        <LegendItem swatch="var(--color-silver)" label="2nd" />
        <LegendItem swatch="var(--color-bronze)" label="3rd" />
      </div>
      <span className="flex items-center gap-1.5">
        <span className="mono text-[0.68rem] font-semibold uppercase px-2 py-0.5 rounded-full border text-accent border-accent/40 bg-accent-soft shrink-0">
          Q
        </span>
        Qualified for the next round
      </span>
      <span className="flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-gold shrink-0" aria-hidden />
        Tie-break Required — decided by officials, not shown automatically
      </span>
      <span className="flex items-center gap-1.5">
        <span className="border-t-2 border-accent/50 w-5 shrink-0" aria-hidden />
        Marks the qualification cutoff line
      </span>
    </div>
  );
}

function LegendItem({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <Trophy className="w-3.5 h-3.5" style={{ color: swatch }} aria-hidden />
      {label}
    </span>
  );
}
