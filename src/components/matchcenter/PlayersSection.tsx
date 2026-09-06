import { useState } from 'react';
import { COLLEGES } from '../../lib/matchCenterData';
import { usePlayers } from '../../lib/queries';
import { SubTabs, EmptyState } from './shared';

type Tab = 'name' | 'college';

export function PlayersSection() {
  const [tab, setTab] = useState<Tab>('name');
  // Real roster, populated as players are picked in Live Scoring / Schedule (PlayerPicker) --
  // replaces the old always-empty static PLAYERS constant this section used to read.
  const { data: players } = usePlayers();
  const roster = players || [];

  return (
    <div>
      <h1 className="text-[1.8rem] mb-1.5">Players</h1>
      <p className="text-[0.95rem] mb-5 max-w-[60ch]">
        Every registered athlete, browsable by name or grouped by the college they represent.
      </p>

      <SubTabs
        tabs={[
          { id: 'name', label: 'By Name' },
          { id: 'college', label: 'By College' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      {tab === 'name' &&
        (roster.length === 0 ? (
          <EmptyState className="mt-5" text="No players registered yet. Rosters will appear here as colleges register." />
        ) : (
          <ul className="mt-5 columns-2 sm:columns-3 gap-4">
            {roster.map((p) => (
              <li key={p.id} className="text-[0.88rem] text-text-secondary break-inside-avoid mb-1.5">
                {p.name}
                {p.college && <span className="text-text-muted"> · {p.college}</span>}
              </li>
            ))}
          </ul>
        ))}

      {tab === 'college' && (
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {COLLEGES.map((c) => {
            const collegeRoster = roster.filter((p) => p.college === c);
            return (
              <div key={c} className="bg-surface-1 border border-border rounded-2xl p-5">
                <h3 className="font-sans normal-case font-extrabold text-[0.98rem] text-text-primary mb-2">{c}</h3>
                {collegeRoster.length === 0 ? (
                  <p className="text-[0.82rem] text-text-muted">No players registered yet.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {collegeRoster.map((p) => (
                      <li key={p.id} className="text-[0.88rem] text-text-secondary">
                        {p.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
