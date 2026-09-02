import { useState } from 'react';
import { LIVE_MATCHES, COMPLETED_MATCHES } from '../../lib/matchCenterData';
import { SubTabs, EmptyState } from './shared';

type Tab = 'live' | 'completed' | 'stats';

export function ScoresSection() {
  const [tab, setTab] = useState<Tab>('live');

  return (
    <div>
      <h1 className="text-[1.8rem] mb-1.5">Scores</h1>
      <p className="text-[0.95rem] mb-5 max-w-[60ch]">
        Live in-progress matches, completed results, and event-level stats — updated in real time on
        tournament day.
      </p>

      <SubTabs
        tabs={[
          { id: 'live', label: 'Live Scores' },
          { id: 'completed', label: 'Completed Matches' },
          { id: 'stats', label: 'Event Statistics' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      {tab === 'live' &&
        (LIVE_MATCHES.length === 0 ? (
          <EmptyState className="mt-5" text="No matches are live right now. Scores will update here in real time once play begins." />
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{/* live match cards render here */}</div>
        ))}

      {tab === 'completed' &&
        (COMPLETED_MATCHES.length === 0 ? (
          <EmptyState className="mt-5" text="No completed matches yet." />
        ) : (
          <div className="mt-5">{/* completed matches table renders here */}</div>
        ))}

      {tab === 'stats' && (
        <EmptyState className="mt-5" text="Event statistics will appear once matches are underway." />
      )}
    </div>
  );
}
