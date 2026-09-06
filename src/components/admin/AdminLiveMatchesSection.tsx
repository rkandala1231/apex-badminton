import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LiveMatchCard } from '../matchcenter/LiveMatches';
import { useLiveMatches } from '../../lib/queries';
import { EVENT_META, type EventCode } from '../../lib/types';
import { EmptyState } from '../matchcenter/shared';

const selectCls =
  'bg-surface-2 border border-border rounded-lg px-3 py-2 text-text-primary font-semibold text-[0.82rem]';

/**
 * Admin oversight of every live match, each with a "Resume Scoring" link so a match can be picked
 * back up from any device -- not just the one that started it (see useLiveScoring's resumeMatch /
 * matchStats.ts's fetchResumableMatch). Before this, the only control here was one generic "Open
 * Live Scoring" link with no way to attach to a *specific* in-progress match -- Live Scoring only
 * ever remembers one match's state, local to the browser/device that started it, so opening it
 * elsewhere just showed the setup screen with no sign the match existed.
 */
export function AdminLiveMatchesSection() {
  const [eventCode, setEventCode] = useState<EventCode | ''>('');
  const { data: matches, isLoading, isError } = useLiveMatches(eventCode || null);

  return (
    <div>
      <h1 className="text-[1.8rem] mb-1.5">Live Matches</h1>
      <p className="text-[0.95rem] mb-6 max-w-[60ch] text-text-secondary">
        Oversight of every match being scored live, across every court — the same feed the public
        Match Center shows. Use "Resume Scoring" on any match to pick it up and keep going, even if
        it was started on a different device or browser.
      </p>

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
            <div key={i} className="h-[190px] bg-surface-1 border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState text="Couldn't load live matches right now. Try refreshing." />
      ) : !matches || matches.length === 0 ? (
        <EmptyState text="No matches are live right now. Start one from Live Scoring below." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 mb-5">
          {matches.map((m) => (
            <div key={m.id} className="flex flex-col gap-2">
              <LiveMatchCard match={m} />
              <Link
                to={`/admin/scoring?resume=${m.id}`}
                className="text-center rounded-full border border-accent text-accent font-bold text-[0.8rem] px-4 py-2.5 no-underline hover:bg-accent-soft transition-colors"
              >
                Resume Scoring →
              </Link>
            </div>
          ))}
        </div>
      )}

      <Link
        to="/admin/scoring"
        className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-2.5 bg-accent text-[#0c1210] hover:bg-accent-hover transition-colors no-underline"
      >
        Open Live Scoring (new match) →
      </Link>
    </div>
  );
}
