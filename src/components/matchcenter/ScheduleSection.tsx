import type { ReactNode } from 'react';
import { useState } from 'react';
import { useUpcomingSchedule, type MatchRow } from '../../lib/queries';
import { EVENT_META, type EventCode } from '../../lib/types';
import { EmptyState } from './shared';

const selectCls =
  'bg-surface-2 border border-border rounded-lg px-3 py-2 text-text-primary font-semibold text-[0.82rem]';

/**
 * Published matches that haven't started yet (plus a published match that was later canceled --
 * see the "soft cancel" design decision: it stays visible here marked Canceled rather than
 * disappearing). This is the true pre-game schedule, distinct from Scores' Live Matches and
 * Completed Matches tabs -- once a scheduled match is started from Live Scoring it moves off this
 * list and onto Live Matches, then Completed Matches, same as any ad hoc match.
 */
export function ScheduleSection() {
  const [eventCode, setEventCode] = useState<EventCode | ''>('');
  const { data: matches, isLoading, isError } = useUpcomingSchedule(eventCode || null);

  return (
    <div>
      <h1 className="text-[1.8rem] mb-1.5">Schedule</h1>
      <p className="text-[0.95rem] mb-5 max-w-[60ch]">
        Upcoming matches, soonest first. Once a match starts, find it on the Scores tab under Live
        Matches, then Completed Matches when it's done.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-[0.84rem] text-text-muted">
          {matches && matches.length > 0 ? `${matches.length} upcoming match${matches.length === 1 ? '' : 'es'}.` : ' '}
        </p>
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
        <EmptyState text="Couldn't load the schedule right now. Try refreshing." />
      ) : !matches || matches.length === 0 ? (
        <EmptyState
          text={
            eventCode
              ? `No ${EVENT_META.find((e) => e.code === eventCode)?.label ?? eventCode} matches are scheduled yet.`
              : 'Nothing scheduled yet — check back once matches are published.'
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {matches.map((m) => (
            <ScheduledMatchCard key={m.id} match={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduledMatchCard({ match }: { match: MatchRow }) {
  const eventLabel = EVENT_META.find((e) => e.code === match.event_code)?.label ?? match.event_code;
  const isCancelled = match.status === 'cancelled';
  const when = match.scheduled_at
    ? new Date(match.scheduled_at).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Time TBD';

  return (
    <div className={`bg-surface-1 border rounded-2xl px-4.5 py-4 ${isCancelled ? 'border-border opacity-70' : 'border-border-soft'}`}>
      <div className="flex flex-wrap items-center gap-2 mb-3.5">
        <Pill>{match.event_code}</Pill>
        <Pill>{match.stage === 'knockout' ? 'Knockout' : 'Round Robin'}</Pill>
        {match.court && <Pill>{match.court}</Pill>}
        {isCancelled && (
          <span className="ml-auto text-[0.72rem] font-bold text-red-400 uppercase tracking-wide">Canceled</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 text-left">
          <div className="font-bold text-[0.9rem] truncate text-text-primary">{match.side_a_name}</div>
          <div className="mono text-[0.68rem] uppercase tracking-wide text-text-muted truncate">{match.college_a}</div>
        </div>

        <div className="mono text-[0.78rem] font-semibold px-2 shrink-0 text-text-muted uppercase tracking-wide">vs</div>

        <div className="min-w-0 flex-1 text-right">
          <div className="font-bold text-[0.9rem] truncate text-text-primary">{match.side_b_name}</div>
          <div className="mono text-[0.68rem] uppercase tracking-wide text-text-muted truncate">{match.college_b}</div>
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-border-soft flex items-center justify-between text-[0.7rem] text-text-muted uppercase tracking-wide">
        <span>{eventLabel}</span>
        <span className="mono">{when}</span>
      </div>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="mono text-[0.7rem] font-semibold tracking-wide px-2.5 py-1 rounded-full border uppercase text-text-secondary border-border bg-surface-2">
      {children}
    </span>
  );
}
