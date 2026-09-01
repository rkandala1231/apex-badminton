import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';

export function AdminAuthForm() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);
    const action = isSignup
      ? supabase.auth.signUp({ email, password })
      : supabase.auth.signInWithPassword({ email, password });
    const { data, error: authError } = await action;
    setSubmitting(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    if (isSignup && data.user && !data.session) {
      setInfo('Account created — check your email to confirm it, then sign in.');
    }
    // Otherwise onAuthStateChange (in useAuth) will pick up the new session automatically.
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-[420px] mx-auto mt-10 bg-surface-1 border border-border rounded-2xl p-7 md:p-8.5"
    >
      <h2 className="text-2xl mb-2">Tournament Staff</h2>
      <p className="text-[0.9rem] mb-5">
        {isSignup
          ? "Create the staff account you'll sign in with. An existing admin still needs to approve it before you can see registrations."
          : 'Sign in to view and manage college registrations.'}
      </p>
      <form onSubmit={onSubmit}>
        <div className="mb-4 flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-bold text-text-secondary">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-surface-2 border border-border rounded-md px-3 py-2.5 text-text-primary text-[0.92rem] focus:outline-2 focus:outline-accent focus:outline-offset-1"
          />
        </div>
        <div className="mb-4 flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-bold text-text-secondary">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-surface-2 border border-border rounded-md px-3 py-2.5 text-text-primary text-[0.92rem] focus:outline-2 focus:outline-accent focus:outline-offset-1"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full mt-1.5 inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-3 bg-accent text-[#181310] hover:bg-accent-hover transition-colors disabled:opacity-60 active:scale-95"
        >
          {submitting ? (isSignup ? 'Creating…' : 'Signing in…') : isSignup ? 'Create account' : 'Sign in'}
        </button>
      </form>
      <p className="text-[0.76rem] text-text-muted mt-3.5 leading-relaxed">
        {isSignup ? 'Already have an account? ' : 'First time here? '}
        <button
          type="button"
          onClick={() => {
            setIsSignup((v) => !v);
            setError('');
            setInfo('');
          }}
          className="text-accent underline"
        >
          {isSignup ? 'Sign in instead' : 'Create a staff account'}
        </button>
      </p>
      {error && (
        <div
          className="flex items-start gap-2.5 rounded-md p-3.5 mt-3.5 text-[0.86rem] text-text-primary"
          style={{ background: 'rgba(217,89,38,0.12)', border: '1px solid var(--color-ev-ws)' }}
        >
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div
          className="flex items-start gap-2.5 rounded-md p-3.5 mt-3.5 text-[0.86rem] text-text-primary"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid var(--color-accent-dim)' }}
        >
          <span>ℹ</span>
          <span>{info}</span>
        </div>
      )}
    </motion.div>
  );
}
