import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { toStaffEmail } from '../../lib/staffAuth';

export function AdminAuthForm() {
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: toStaffEmail(staffId),
      password,
    });
    setSubmitting(false);
    if (authError) {
      setError(authError.message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-[420px] mx-auto mt-10 bg-surface-1 border border-border rounded-2xl p-7 md:p-8.5"
    >
      <h2 className="text-2xl mb-2">Tournament Staff</h2>
      <p className="text-[0.9rem] mb-5">Sign in with your staff ID and password.</p>

      <form onSubmit={onSubmit}>
        <div className="mb-4 flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-bold text-text-secondary">Staff ID</label>
          <input
            type="text"
            required
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            placeholder="e.g. admin1"
            className="bg-surface-2 border border-border rounded-md px-3 py-2.5 text-text-primary text-[0.92rem] focus:outline-2 focus:outline-accent focus:outline-offset-1"
          />
        </div>
        <div className="mb-4 flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-bold text-text-secondary">Password</label>
          <input
            type="password"
            required
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
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="text-[0.76rem] text-text-muted mt-4 leading-relaxed">
        Don&apos;t have a staff ID yet? Ask a super admin to create one for you.
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
    </motion.div>
  );
}
