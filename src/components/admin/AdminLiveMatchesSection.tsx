import { Link } from 'react-router-dom';
import { LiveMatches } from '../matchcenter/LiveMatches';

export function AdminLiveMatchesSection() {
  return (
    <div>
      <h1 className="text-[1.8rem] mb-1.5">Live Matches</h1>
      <p className="text-[0.95rem] mb-6 max-w-[60ch] text-text-secondary">
        Oversight of every match being scored live, across every court — the same feed the public
        Match Center shows.
      </p>

      <LiveMatches />

      <Link
        to="/admin/scoring"
        className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-2.5 mt-5 bg-accent text-[#0c1210] hover:bg-accent-hover transition-colors no-underline"
      >
        Open Live Scoring →
      </Link>
    </div>
  );
}
