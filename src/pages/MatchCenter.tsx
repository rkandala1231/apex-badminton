import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PageShell } from '../components/PageShell';

const SECTIONS = [
  { to: 'scores', label: 'Scores' },
  { to: 'draws', label: 'Draws' },
  { to: 'players', label: 'Players' },
  { to: 'schedule', label: 'Schedule' },
  { to: 'live-stream', label: 'Live Stream' },
];

export function MatchCenter() {
  const location = useLocation();
  const navigate = useNavigate();

  // /match-center on its own defaults to the Scores tab.
  useEffect(() => {
    if (location.pathname === '/match-center' || location.pathname === '/match-center/') {
      navigate('/match-center/scores', { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <PageShell title="Match Center">
      <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-10 md:py-14">
        <div className="mb-7 rounded-xl border border-border-soft bg-surface-1/60 px-4 py-3 text-[0.8rem] text-text-muted">
          Registration is still open — scores, draws, rosters, and the schedule will populate here as
          colleges sign up and seeding is finalized.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8 items-start">
          <nav
            className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible border-b md:border-b-0 md:border-r border-border-soft pb-3 md:pb-0 md:pr-5"
            aria-label="Match Center sections"
          >
            {SECTIONS.map((s) => (
              <NavLink
                key={s.to}
                to={s.to}
                className={({ isActive }) =>
                  `whitespace-nowrap px-3.5 py-2.5 rounded-lg text-[0.85rem] font-semibold transition-colors no-underline ${
                    isActive
                      ? 'bg-accent-soft text-accent'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-1'
                  }`
                }
              >
                {s.label}
              </NavLink>
            ))}
          </nav>

          <div className="min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
