import { useState } from 'react';
import { CompletedMatches } from './CompletedMatches';
import { EventStatistics } from './EventStatistics';
import { LiveMatches } from './LiveMatches';
import { SubTabs } from './shared';

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

      {tab === 'live' && (
        <div className="mt-5">
          <LiveMatches />
        </div>
      )}

      {tab === 'completed' && (
        <div className="mt-5">
          <CompletedMatches />
        </div>
      )}

      {tab === 'stats' && <EventStatistics />}
    </div>
  );
}
