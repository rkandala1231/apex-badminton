import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, CircleDot, Trophy } from 'lucide-react';
import {
  usePoolStandings,
  usePools,
  type IndividualStandingsResult,
  type PoolRow,
  type TeamStandingsResult,
} from '../../lib/queries';
import type { IndividualStats, QualificationStatus } from '../../lib/standings/calc';
import type { RankedEntry } from '../../lib/standings/rank';
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

function IndividualStandingsTable({ data }: { data: IndividualStandingsResult }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (data.entries.length === 0) {
    return <EmptyState text="No entries in this pool yet." />;
  }

  return (
    <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden">
      {/* Desktop / tablet: full table, all columns, no scroll needed at normal widths. */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-[0.84rem]">
          <thead>
            <tr className="text-left text-text-muted text-[0.68rem] uppercase tracking-wide border-b border-border">
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
              <RowDesktop key={r.entry.entry.id} r={r} isCutoff={data.poolComplete && i === data.pool.qualifier_count - 1} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: condensed columns with the rest revealed by tapping the row. */}
      <div className="sm:hidden divide-y divide-border-soft">
        {data.entries.map((r, i) => (
          <RowMobile
            key={r.entry.entry.id}
            r={r}
            isCutoff={data.poolComplete && i === data.pool.qualifier_count - 1}
            expanded={expanded === r.entry.entry.id}
            onToggle={() => setExpanded(expanded === r.entry.entry.id ? null : r.entry.entry.id)}
          />
        ))}
      </div>
    </div>
  );
}

function RowDesktop({ r, isCutoff }: { r: RankedEntry<IndividualStats> & { status: QualificationStatus }; isCutoff: boolean }) {
  return (
    <tr className={`border-b border-border-soft last:border-0 ${isCutoff ? 'border-b-2 border-b-accent/50' : ''}`}>
      <Td>
        <RankBadge rank={r.rank} />
      </Td>
      <Td>
        <span className="font-bold text-text-primary">{r.entry.entry.entry_name}</span>
      </Td>
      <Td className="mono text-[0.72rem] uppercase tracking-wide text-text-muted">{r.entry.entry.college}</Td>
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
  );
}

function RowMobile({
  r,
  isCutoff,
  expanded,
  onToggle,
}: {
  r: RankedEntry<IndividualStats> & { status: QualificationStatus };
  isCutoff: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={isCutoff ? 'border-b-2 border-b-accent/50' : ''}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex flex-col gap-2 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <RankBadge rank={r.rank} />
          <span className="font-bold text-text-primary flex-1 min-w-0 break-words leading-tight">{r.entry.entry.entry_name}</span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-text-muted shrink-0" aria-hidden />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-muted shrink-0" aria-hidden />
          )}
        </div>
        <div className="flex items-center gap-2 pl-[1.9rem]">
          <span className="mono text-[0.66rem] uppercase tracking-wide text-text-muted flex-1 min-w-0 truncate">{r.entry.entry.college}</span>
          <span className="mono text-[0.8rem] tabular-nums text-text-secondary shrink-0">
            {r.entry.matchesWon}–{r.entry.matchesLost}
          </span>
          <StatusBadge status={r.status} compact />
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3.5 grid grid-cols-3 gap-3 text-[0.75rem]">
          <DetailStat label="Played" value={String(r.entry.matchesPlayed)} />
          <DetailStat label="Game diff" value={formatDiff(r.entry.gamesWon - r.entry.gamesLost)} />
          <DetailStat label="Rally diff" value={formatDiff(r.entry.rallyFor - r.entry.rallyAgainst)} />
          <div className="col-span-3 text-text-muted">Decided by: {r.decidedBy}</div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// College Team pools
// ---------------------------------------------------------------------------------------------

function TeamStandingsTable({ data }: { data: TeamStandingsResult }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (data.entries.length === 0) {
    return <EmptyState text="No colleges in this pool yet." />;
  }

  return (
    <div className="bg-surface-1 border border-border rounded-2xl overflow-hidden">
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-[0.84rem]">
          <thead>
            <tr className="text-left text-text-muted text-[0.68rem] uppercase tracking-wide border-b border-border">
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

      <div className="sm:hidden divide-y divide-border-soft">
        {data.entries.map((r, i) => {
          const isExpanded = expanded === r.entry.college;
          const isCutoff = data.poolComplete && i === data.pool.qualifier_count - 1;
          return (
            <div key={r.entry.college} className={isCutoff ? 'border-b-2 border-b-accent/50' : ''}>
              <button
                type="button"
                onClick={() => setExpanded(isExpanded ? null : r.entry.college)}
                aria-expanded={isExpanded}
                className="w-full flex flex-col gap-2 px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2.5">
                  <RankBadge rank={r.rank} />
                  <span className="font-bold text-text-primary flex-1 min-w-0 break-words leading-tight">{r.entry.college}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-text-muted shrink-0" aria-hidden />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-text-muted shrink-0" aria-hidden />
                  )}
                </div>
                <div className="flex items-center gap-2 pl-[1.9rem]">
                  <span className="mono text-[0.66rem] uppercase tracking-wide text-text-muted flex-1 min-w-0 truncate">
                    Ties{r.entry.tiesPending > 0 ? ` · ${r.entry.tiesPending} pending` : ''}
                  </span>
                  <span className="mono text-[0.8rem] tabular-nums text-text-secondary shrink-0">
                    {r.entry.tiesWon}–{r.entry.tiesLost}
                  </span>
                  <StatusBadge status={r.status} compact />
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 pb-3.5 grid grid-cols-3 gap-3 text-[0.75rem]">
                  <DetailStat label="Matches" value={`${r.entry.matchesWon}–${r.entry.matchesLost}`} />
                  <DetailStat label="Game diff" value={formatDiff(r.entry.gamesWon - r.entry.gamesLost)} />
                  <DetailStat label="Rally diff" value={formatDiff(r.entry.rallyFor - r.entry.rallyAgainst)} />
                  {r.entry.tiesPending > 0 && (
                    <div className="col-span-3 text-text-muted">{r.entry.tiesPending} tie(s) still in progress</div>
                  )}
                  <div className="col-span-3 text-text-muted">Decided by: {r.decidedBy}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------------------------

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <th className={`px-4 py-2.5 font-semibold ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</th>;
}

function Td({ children, align = 'left', className = '' }: { children: React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  return <td className={`px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}>{children}</td>;
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-text-muted text-[0.68rem] uppercase tracking-wide">{label}</div>
      <div className="mono tabular-nums text-text-primary font-semibold">{value}</div>
    </div>
  );
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

function StatusBadge({ status, compact }: { status: QualificationStatus; compact?: boolean }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1 mono text-[0.68rem] font-semibold uppercase tracking-wide px-2 py-1 rounded-full border shrink-0 ${s.className}`}
    >
      {s.icon}
      {compact && status === 'In Contention' ? '—' : s.text}
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
