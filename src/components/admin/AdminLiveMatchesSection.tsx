import { Link } from 'react-router-dom';
import { LIVE_MATCHES } from '../../lib/matchCenterData';
import { EmptyState } from '../matchcenter/shared';

export function AdminLiveMatchesSection() {
  return (
    <div>
      <h1 className="text-[1.8rem] mb-1.5">Live Matches</h1>
      <p className="text-[0.95rem] mb-6 max-w-[60ch] text-text-secondary">
        Oversight of every match being scored live, across every court.
      </p>

      {LIVE_MATCHES.length === 0 ? (
        <EmptyState text="No live matches right now. A cross-court view will appear here once live scoring syncs across devices — for now, each court runs its own scoreboard locally." />
      ) : (
        <div>{/* cross-court live match list renders here */}</div>
      )}

      <Link
        to="/admin/scoring"
        className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-2.5 mt-5 bg-accent text-[#0c1210] hover:bg-accent-hover transition-colors no-underline"
      >
        Open Live Scoring →
      </Link>
    </div>
  );
}
