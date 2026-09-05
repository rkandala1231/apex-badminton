import { useEffect } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { staffIdFromEmail } from '../lib/staffAuth';
import { useAuth, useIsAdmin, useIsSuperAdmin } from '../lib/useAuth';
import { AdminAuthForm } from '../components/admin/AdminAuthForm';
import { AdminDashboard } from '../components/admin/AdminDashboard';
import { AdminAssessmentsSection } from '../components/admin/AdminAssessmentsSection';
import { AdminPlayersSection } from '../components/admin/AdminPlayersSection';
import { AdminScheduleSection } from '../components/admin/AdminScheduleSection';
import { AdminDrawsSection } from '../components/admin/AdminDrawsSection';
import { AdminLiveMatchesSection } from '../components/admin/AdminLiveMatchesSection';
import { AdminMatchKpiSection } from '../components/admin/AdminMatchKpiSection';
import { AdminManageStaffSection } from '../components/admin/AdminManageStaffSection';
import { AdminAccountSection } from '../components/admin/AdminAccountSection';
import { LiveScoringSection } from '../components/matchcenter/LiveScoringSection';

const TOURNEY_SECTIONS = [
  { to: 'registrations', label: 'Registrations' },
  { to: 'assessments', label: 'Player Assessments' },
  { to: 'players', label: 'Players' },
  { to: 'schedule', label: 'Schedule' },
  { to: 'draws', label: 'Draws' },
  { to: 'live-matches', label: 'Live Matches' },
  { to: 'scoring', label: 'Live Scoring' },
  { to: 'match-kpis', label: 'Match KPIs' },
  { to: 'account', label: 'Account' },
];
const SUPER_ADMIN_SECTION = { to: 'staff', label: 'Manage Admins' };

export function Admin() {
  const { user, loading } = useAuth();
  const isAdmin = useIsAdmin(user);
  const isSuperAdmin = useIsSuperAdmin(user);
  const sections = isSuperAdmin ? [...TOURNEY_SECTIONS, SUPER_ADMIN_SECTION] : TOURNEY_SECTIONS;

  useEffect(() => {
    document.title = 'Tournament Staff — Apex Collegiate Badminton';
  }, []);

  return (
    <div className="min-h-screen bg-bg">
      <div className="flex items-center justify-between px-5 md:px-12 py-4 border-b border-border-soft sticky top-0 bg-bg/90 backdrop-blur-md z-10">
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <span className="w-[30px] h-[30px] rounded-lg bg-gradient-to-br from-accent to-gold flex items-center justify-center font-display text-[#171310] text-base shrink-0">
            A
          </span>
          <span className="font-display text-lg tracking-wide">APEX</span>
          <span className="hidden sm:inline-block mono text-[0.68rem] uppercase tracking-wider text-text-muted border border-border-soft rounded-full px-2.5 py-1 ml-1">
            Tournament Staff
          </span>
        </Link>
        <div className="flex items-center gap-3.5">
          {user?.email && isAdmin === true && (
            <span className="mono text-[0.78rem] text-text-muted hidden sm:inline">
              {staffIdFromEmail(user.email)}
            </span>
          )}
          {isAdmin === true && (
            <button
              onClick={() => supabase.auth.signOut()}
              className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-[0.78rem] px-4 py-2 bg-transparent text-text-primary border border-border hover:border-accent hover:text-accent transition-colors"
            >
              Sign out
            </button>
          )}
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-5 md:px-12 py-8 md:py-14">
        {loading ? (
          <div className="max-w-[420px] mx-auto mt-10 h-72 bg-surface-1 border border-border rounded-2xl animate-pulse" />
        ) : !user ? (
          <AdminAuthForm />
        ) : isAdmin === null ? (
          <div className="max-w-[420px] mx-auto mt-10 h-40 bg-surface-1 border border-border rounded-2xl animate-pulse" />
        ) : isAdmin === false ? (
          <div className="max-w-[420px] mx-auto mt-10 bg-surface-1 border border-border rounded-2xl p-7 md:p-8.5">
            <h2 className="text-2xl mb-2">Not authorized</h2>
            <p className="text-[0.9rem] mb-5">
              You&apos;re signed in, but this account isn&apos;t on the Apex admin list yet. Ask an existing admin to
              add your account.
            </p>
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-2.5 bg-transparent text-text-primary border border-border hover:border-accent hover:text-accent transition-colors"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8 items-start">
            <nav
              className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible border-b md:border-b-0 md:border-r border-border-soft pb-3 md:pb-0 md:pr-5"
              aria-label="Tournament staff sections"
            >
              {sections.map((s) => (
                <NavLink
                  key={s.to}
                  to={`/admin/${s.to}`}
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
              <Routes>
                <Route index element={<Navigate to="/admin/registrations" replace />} />
                <Route path="registrations" element={<AdminDashboard />} />
                <Route path="assessments" element={<AdminAssessmentsSection />} />
                <Route path="players" element={<AdminPlayersSection />} />
                <Route path="schedule" element={<AdminScheduleSection />} />
                <Route path="draws" element={<AdminDrawsSection />} />
                <Route path="live-matches" element={<AdminLiveMatchesSection />} />
                <Route path="scoring" element={<LiveScoringSection />} />
                <Route path="match-kpis" element={<AdminMatchKpiSection />} />
                <Route path="account" element={<AdminAccountSection />} />
                <Route
                  path="staff"
                  element={isSuperAdmin ? <AdminManageStaffSection /> : <Navigate to="/admin/registrations" replace />}
                />
                <Route path="*" element={<Navigate to="/admin/registrations" replace />} />
              </Routes>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
