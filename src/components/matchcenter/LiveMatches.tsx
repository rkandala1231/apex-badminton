import type { ReactNode } from 'react';
import { useState } from 'react';
import { useLiveMatches, type MatchRow } from '../../lib/queries';
import { EVENT_META, type EventCode } from '../../lib/types';
import { EmptyState } from './shared';

const selectCls =
  'bg-surface-2 border border-border rounded-lg px-3 py-2 text-text-primary font-semibold text-[0.82rem]';

export function LiveMatches() {
  const [eventCode, setEventCode] = useState<EventCode | ''>('');
  const { data: matches, isLoading, isError } = useLiveMatches(eventCode || null);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-[0.84rem] text-text-muted">Scores update automatically as points are played.</p>
        <select
          value={eventCode}
          onChange={(e) => setEventCode(e.target.value as EventCode | '')}
          className={selectCls}
        >
          <option value="">All events</option>
          {EVENT_META.map((e) => (
            <option key={e.code} value={e.code}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-[150px] bg-surface-1 border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState text="Couldn't load live matches right now. Try refreshing." />
      ) : !matches || matches.length === 0 ? (
        <EmptyState text="No matches are live right now. Scores will update here in real time once play begins." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {matches.map((m) => (
            <LiveMatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Exported so ScheduleSection can render the same live-match card inline in its merged feed. */
export function LiveMatchCard({ match }: { match: MatchRow }) {
  const eventLabel = EVENT_META.find((e) => e.code === match.event_code)?.label ?? match.event_code;
  const priorGames = match.match_games.slice(0, -1);
  const current = match.match_games[match.match_games.length - 1] ?? {
    game_index: 0,
    a_score: 0,
    b_score: 0,
    winner_side: null,
  };
  const gameLabel = match.format === 'bo3' ? `Game ${current.game_index + 1} of 3` : 'Single Game';

  return (
    <div className="bg-surface-1 border border-accent/40 rounded-2xl px-4.5 py-4">
      <div className="flex flex-wrap items-center gap-2 mb-3.5">
        <Pill accent>{match.event_code}</Pill>
        <Pill>{match.stage === 'knockout' ? 'Knockout' : 'Round Robin'}</Pill>
        <Pill>{gameLabel}</Pill>
        <span className="ml-auto flex items-center gap-1.5 text-[0.72rem] font-bold text-accent uppercase tracking-wide">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          Live
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 text-left">
          <div className="font-bold text-[0.9rem] truncate text-text-primary">{match.side_a_name}</div>
          <div className="mono text-[0.68rem] uppercase tracking-wide text-text-muted truncate">{match.college_a}</div>
        </div>

        <div className="mono font-display text-[1.9rem] leading-none px-2 shrink-0 text-text-primary">
          {current.a_score}–{current.b_score}
        </div>

        <div className="min-w-0 flex-1 text-right">
          <div className="font-bold text-[0.9rem] truncate text-text-primary">{match.side_b_name}</div>
          <div className="mono text-[0.68rem] uppercase tracking-wide text-text-muted truncate">{match.college_b}</div>
        </div>
      </div>

      {priorGames.length > 0 && (
        <div className="flex gap-1.5 justify-center mt-3">
          {priorGames.map((g) => (
            <span key={g.game_index} className="mono text-[0.72rem] font-semibold px-2 py-0.5 rounded-md bg-surface-2 text-text-muted">
              {g.a_score}–{g.b_score}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 pt-2.5 border-t border-border-soft text-[0.7rem] text-text-muted uppercase tracking-wide">
        {eventLabel}
      </div>
    </div>
  );
}

function Pill({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <span
      className={`mono text-[0.7rem] font-semibold tracking-wide px-2.5 py-1 rounded-full border uppercase ${
        accent ? 'text-gold border-gold/35 bg-surface-2' : 'text-text-secondary border-border bg-surface-2'
      }`}
    >
      {children}
    </span>
  );
}
