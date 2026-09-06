import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PageShell } from '../components/PageShell';

const SECTIONS = [
  { to: 'overview', label: 'Overview' },
  { to: 'players', label: 'Player Statistics' },
];

/**
 * Tab-nav shell for /analytics, mirroring MatchCenter.tsx's NavLink + Outlet pattern. Previously a
 * flat page wrapping the tournament-registration `<Analytics>` section directly; that section is
 * now the "Overview" tab (unchanged internally, just relocated to its own route) alongside the new
 * "Player Statistics" tab. Each tab supplies its own max-width container (matching `Analytics`'s
 * existing standalone-section layout) rather than this shell imposing one, since a bare nav bar is
 * the only thing every tab actually shares.
 */
export function AnalyticsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // /analytics on its own defaults to the Overview tab.
  useEffect(() => {
    if (location.pathname === '/analytics' || location.pathname === '/analytics/') {
      navigate('/analytics/overview', { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <PageShell title="Analytics">
      <div className="max-w-[1180px] mx-auto px-5 md:px-12 pt-8">
        <nav className="flex gap-2 border-b border-border-soft pb-3" aria-label="Analytics sections">
          {SECTIONS.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              className={({ isActive }) =>
                `px-3.5 py-2 rounded-full text-[0.85rem] font-semibold transition-colors no-underline ${
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
      </div>
      <Outlet />
    </PageShell>
  );
}
