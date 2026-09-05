import { Link, useParams } from 'react-router-dom';
import { PageShell } from '../components/PageShell';
import { MatchKpiDashboard } from '../components/matchcenter/kpi/MatchKpiDashboard';

export function MatchKpiPage() {
  const { matchId } = useParams<{ matchId: string }>();

  return (
    <PageShell title="Match KPIs">
      <div className="max-w-[900px] mx-auto px-5 md:px-12 py-10 md:py-14">
        <Link to="/match-center/scores" className="text-[0.8rem] text-text-muted hover:text-accent no-underline mb-4 inline-block">
          ← Back to Scores
        </Link>
        <h1 className="text-2xl mb-6">Match KPIs</h1>
        {matchId ? (
          <MatchKpiDashboard matchId={matchId} />
        ) : (
          <p className="text-text-secondary">No match specified.</p>
        )}
      </div>
    </PageShell>
  );
}
