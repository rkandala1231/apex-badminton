import type { ReactNode } from 'react';
import { useState } from 'react';
import { useCompletedMatches, type CompletedMatchRow } from '../../lib/queries';
import { EVENT_META, type EventCode } from '../../lib/types';
import { EmptyState } from './shared';

const selectCls =
  'bg-surface-2 border border-border rounded-lg px-3 py-2 text-text-primary font-semibold text-[0.82rem]';

export function CompletedMatches() {
  const [eventCode, setEventCode] = useState<EventCode | ''>('');
  const { data: matches, isLoading, isError } = useCompletedMatches(eventCode || null);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-[0.84rem] text-text-muted">Every finished match, most recent first.</p>
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
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[92px] bg-surface-1 border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState text="Couldn't load completed matches right now. Try refreshing." />
      ) : !matches || matches.length === 0 ? (
        <EmptyState
          text={
            eventCode
              ? `No completed ${EVENT_META.find((e) => e.code === eventCode)?.label ?? eventCode} matches yet.`
              : 'No completed matches yet.'
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {matches.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Exported so ScheduleSection can render the same completed-match card inline in its merged feed. */
export function MatchCard({ match }: { match: CompletedMatchRow }) {
  const eventLabel = EVENT_META.find((e) => e.code === match.event_code)?.label ?? match.event_code;
  const when = match.completed_at
    ? new Date(match.completed_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="bg-surface-1 border border-border rounded-2xl px-4.5 py-4">
      <div className="flex flex-wrap items-center gap-2 mb-3.5">
        <Pill accent>{match.event_code}</Pill>
        <Pill>{match.stage === 'knockout' ? 'Knockout' : 'Round Robin'}</Pill>
        <Pill>{match.format === 'bo3' ? 'Best of 3' : 'Single Game'}</Pill>
        {when && <span className="ml-auto mono text-[0.72rem] text-text-muted">{when}</span>}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Side name={match.side_a_name} college={match.college_a} won={match.winner_side === 'A'} />

        {match.match_games.length > 0 && (
          <div className="flex gap-1.5 shrink-0">
            {match.match_games.map((g) => (
              <span
                key={g.game_index}
                className={`mono text-[0.82rem] font-bold px-2 py-1 rounded-md ${
                  g.winner_side === match.winner_side && match.winner_side
                    ? 'bg-surface-3 text-text-primary'
                    : 'bg-surface-2 text-text-muted'
                }`}
              >
                {g.a_score}–{g.b_score}
              </span>
            ))}
          </div>
        )}

        <Side name={match.side_b_name} college={match.college_b} won={match.winner_side === 'B'} align="right" />
      </div>

      <div className="mt-3 pt-2.5 border-t border-border-soft text-[0.7rem] text-text-muted uppercase tracking-wide">
        {eventLabel}
      </div>
    </div>
  );
}

function Side({
  name,
  college,
  won,
  align = 'left',
}: {
  name: string;
  college: string;
  won: boolean;
  align?: 'left' | 'right';
}) {
  return (
    <div className={`min-w-0 flex-1 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <div className={`font-bold text-[0.9rem] truncate ${won ? 'text-accent' : 'text-text-primary'}`}>{name}</div>
      <div className="mono text-[0.68rem] uppercase tracking-wide text-text-muted truncate">{college}</div>
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
