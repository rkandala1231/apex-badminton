import { useState } from 'react';
import { useMatchKpis } from '../../../lib/queries';
import { EmptyState, SubTabs } from '../shared';
import { SummaryView } from './SummaryView';
import { TableView } from './TableView';
import { ChartsView } from './ChartsView';

type ViewId = 'summary' | 'table' | 'charts';
const VIEW_KEY = 'apex-kpi-view';

function initialView(): ViewId {
  try {
    const stored = sessionStorage.getItem(VIEW_KEY);
    if (stored === 'summary' || stored === 'table' || stored === 'charts') return stored;
  } catch {
    // sessionStorage can throw in some contexts (private browsing, etc) -- fall back silently.
  }
  return 'summary';
}

/**
 * One `useMatchKpis` call feeds all three views -- switching tabs is a local state change, never
 * a refetch, so Summary/Table/Charts are always looking at the exact same backend response.
 */
export function MatchKpiDashboard({ matchId }: { matchId: string }) {
  const [view, setView] = useState<ViewId>(initialView);
  const { data: kpis, isLoading, isError } = useMatchKpis(matchId);

  const changeView = (id: string) => {
    setView(id as ViewId);
    try {
      sessionStorage.setItem(VIEW_KEY, id);
    } catch {
      // Non-fatal -- the view just won't persist across a reload this session.
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="h-9 w-64 bg-surface-2 rounded-full animate-pulse" />
        <div className="h-[300px] bg-surface-1 border border-border rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (isError || !kpis) {
    return <EmptyState text="Couldn't load this match's KPIs right now. Try refreshing." />;
  }

  return (
    <div>
      <div className="mb-5">
        <SubTabs
          tabs={[
            { id: 'summary', label: 'Summary' },
            { id: 'table', label: 'Table' },
            { id: 'charts', label: 'Charts' },
          ]}
          active={view}
          onChange={changeView}
        />
      </div>

      {view === 'summary' && <SummaryView kpis={kpis} />}
      {view === 'table' && <TableView kpis={kpis} />}
      {view === 'charts' && <ChartsView kpis={kpis} />}
    </div>
  );
}
