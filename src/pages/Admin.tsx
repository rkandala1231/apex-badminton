import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth, useIsAdmin } from '../lib/useAuth';
import { AdminAuthForm } from '../components/admin/AdminAuthForm';
import { AdminDashboard } from '../components/admin/AdminDashboard';

export function Admin() {
  const { user, loading } = useAuth();
  const isAdmin = useIsAdmin(user);

  return (
    <div className="min-h-screen bg-bg">
      <div className="flex items-center justify-between px-5 md:px-12 py-4 border-b border-border-soft sticky top-0 bg-bg/90 backdrop-blur-md z-10">
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <span className="w-[30px] h-[30px] rounded-lg bg-gradient-to-br from-accent to-gold flex items-center justify-center font-display text-[#171310] text-base shrink-0">
            A
          </span>
          <span className="font-display text-lg tracking-wide">APEX</span>
        </Link>
        {user && <span className="mono text-[0.78rem] text-text-muted">{user.email}</span>}
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
          <AdminDashboard email={user.email || ''} onSignOut={() => supabase.auth.signOut()} />
        )}
      </div>
    </div>
  );
}
