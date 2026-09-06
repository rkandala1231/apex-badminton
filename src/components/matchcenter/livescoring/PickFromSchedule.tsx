import { useState } from 'react';
import type { CollegeName } from '../../../lib/matchCenterData';
import { useAdminSchedule } from '../../../lib/queries';
import { EmptyState } from '../shared';
import type { LiveEventType, Side, StartSetup } from './types';

/**
 * The "pick from schedule" half of Live Scoring's setup step (see SetupScreen's From
 * Schedule/Ad Hoc toggle). Lists every not-yet-started scheduled match an admin can see --
 * draft or published, same as the Schedule admin console -- so a match doesn't have to be
 * published before it can be played; publishing only controls public visibility.
 */
export function PickFromSchedule({ onStart }: { onStart: (setup: StartSetup) => void }) {
  const { data: schedule, isLoading } = useAdminSchedule(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [firstServer, setFirstServer] = useState<Side>('A');

  const upcoming = [...(schedule || [])]
    .filter((m) => m.status === 'scheduled')
    .sort((a, b) => {
      const at = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
      const bt = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      return at - bt;
    });

  const selected = upcoming.find((m) => m.id === selectedId) ?? null;

  if (isLoading) {
    return <div className="h-40 bg-surface-1 border border-border rounded-2xl animate-pulse" />;
  }

  if (upcoming.length === 0) {
    return (
      <EmptyState text="Nothing on the schedule yet. Add a match on the Schedule tab, or switch to Ad Hoc to start one right now." />
    );
  }

  if (selected) {
    return (
      <div className="bg-surface-1 border border-border-soft rounded-2xl p-5">
        <div className="mono text-[0.68rem] tracking-[0.14em] uppercase text-text-muted font-semibold mb-3">
          Confirm &amp; start
        </div>

        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="min-w-0 flex-1">
            <div className="font-bold text-[0.95rem] text-side-a truncate">{selected.side_a_name}</div>
            <div className="text-[0.72rem] text-text-muted">{selected.college_a}</div>
          </div>
          <div className="text-text-muted font-display text-lg shrink-0">vs</div>
          <div className="min-w-0 flex-1 text-right">
            <div className="font-bold text-[0.95rem] text-side-b truncate">{selected.side_b_name}</div>
            <div className="text-[0.72rem] text-text-muted">{selected.college_b}</div>
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-[0.78rem] font-semibold text-text-muted uppercase tracking-wide mb-1.5">
            First server
          </label>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setFirstServer('A')}
              className={`flex-1 text-left rounded-lg border px-3 py-3 text-[0.86rem] font-bold transition-colors ${
                firstServer === 'A'
                  ? 'bg-side-a-soft border-side-a text-text-primary'
                  : 'bg-surface-2 border-border text-text-secondary'
              }`}
            >
              {selected.side_a_name}
            </button>
            <button
              type="button"
              onClick={() => setFirstServer('B')}
              className={`flex-1 text-left rounded-lg border px-3 py-3 text-[0.86rem] font-bold transition-colors ${
                firstServer === 'B'
                  ? 'bg-side-b-soft border-side-b text-text-primary'
                  : 'bg-surface-2 border-border text-text-secondary'
              }`}
            >
              {selected.side_b_name}
            </button>
          </div>
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="rounded-full border border-border text-text-secondary font-bold text-[0.82rem] px-4 py-2.5"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={() =>
              onStart({
                stage: selected.stage,
                format: selected.format,
                eventType: selected.event_code as LiveEventType,
                nameA: selected.side_a_name,
                nameB: selected.side_b_name,
                collegeA: (selected.college_a || null) as CollegeName | null,
                collegeB: (selected.college_b || null) as CollegeName | null,
                playersA: [],
                playersB: [],
                firstServer,
                scheduledMatchId: selected.id,
              })
            }
            className="flex-1 bg-accent text-[#08211a] rounded-xl py-3 font-extrabold text-[0.9rem] uppercase tracking-wide hover:bg-accent-hover transition-colors active:scale-[0.99]"
          >
            Start Match
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {upcoming.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => {
            setSelectedId(m.id);
            setFirstServer(m.first_server);
          }}
          className="text-left bg-surface-1 border border-border-soft rounded-2xl px-4 py-3.5 hover:border-accent transition-colors"
        >
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="mono text-[0.68rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-border text-text-secondary bg-surface-2">
              {m.event_code}
            </span>
            {m.court && (
              <span className="mono text-[0.68rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-border text-text-secondary bg-surface-2">
                {m.court}
              </span>
            )}
            {!m.is_published && (
              <span className="mono text-[0.68rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-border text-text-muted">
                Draft
              </span>
            )}
            <span className="ml-auto mono text-[0.72rem] text-text-muted">
              {m.scheduled_at
                ? new Date(m.scheduled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                : 'Time TBD'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-bold text-[0.9rem] text-text-primary truncate">{m.side_a_name}</span>
            <span className="text-text-muted text-[0.78rem] shrink-0">vs</span>
            <span className="font-bold text-[0.9rem] text-text-primary truncate text-right">{m.side_b_name}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
