import { useState } from 'react';
import { DRAW_EVENTS, DRAWS, type EventCode } from '../../lib/matchCenterData';
import { SubTabs, EmptyState } from './shared';

export function DrawsSection() {
  const [tab, setTab] = useState<EventCode>('MS');
  const evLabel = DRAW_EVENTS.find((e) => e.code === tab)?.label ?? tab;
  const matches = DRAWS[tab];

  return (
    <div>
      <h1 className="text-[1.8rem] mb-1.5">Draws</h1>
      <p className="text-[0.95rem] mb-5 max-w-[60ch]">
        Bracket progress for each head-to-head event, seeded once registration closes.
      </p>

      <SubTabs
        tabs={DRAW_EVENTS.map((e) => ({ id: e.code, label: e.code }))}
        active={tab}
        onChange={(id) => setTab(id as EventCode)}
      />

      {matches.length === 0 ? (
        <EmptyState
          className="mt-5"
          text={`The ${evLabel} bracket hasn't been seeded yet — it'll post here once registration closes.`}
        />
      ) : (
        <div className="mt-5">{/* bracket render goes here */}</div>
      )}
    </div>
  );
}
