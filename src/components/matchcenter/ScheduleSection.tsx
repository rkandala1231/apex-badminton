import { useState } from 'react';
import { MatchCard as CompletedMatchCard } from './CompletedMatches';
import { LiveMatchCard } from './LiveMatches';
import { useScheduleMatches } from '../../lib/queries';
import { EVENT_META, type EventCode } from '../../lib/types';
import { EmptyState } from './shared';

const selectCls =
  'bg-surface-2 border border-border rounded-lg px-3 py-2 text-text-primary font-semibold text-[0.82rem]';

/**
 * Every match that's live or finished today, most recently started first -- the same underlying
 * `matches` data as Scores' Live/Completed tabs, just merged into one feed instead of split
 * across tabs. There's no "upcoming" row here: a match only exists in the database once a scorer
 * actually starts it (see matchStats.ts's startMatch), so a true pre-game schedule isn't data
 * this app has yet -- this reflects real matches, not a placeholder list.
 */
export function ScheduleSection() {
  const [eventCode, setEventCode] = useState<EventCode | ''>('');
  const { data: matches, isLoading, isError } = useScheduleMatches(eventCode || null);

  return (
    <div>
      <h1 className="text-[1.8rem] mb-1.5">Schedule</h1>
      <p className="text-[0.95rem] mb-5 max-w-[60ch]">
        Every match today, live or finished, in the order it started. Updates automatically as play
        happens — nothing to refresh.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-[0.84rem] text-text-muted">
          {matches?.some((m) => m.status === 'in_progress')
            ? 'Matches marked Live are being scored right now.'
            : 'Matches will appear here the moment a scorer starts one.'}
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
              ? `No ${EVENT_META.find((e) => e.code === eventCode)?.label ?? eventCode} matches have started yet.`
              : 'No matches have started yet — the schedule will populate here as play begins.'
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {matches.map((m) =>
            m.status === 'in_progress' ? <LiveMatchCard key={m.id} match={m} /> : <CompletedMatchCard key={m.id} match={m} />
          )}
        </div>
      )}
    </div>
  );
}
