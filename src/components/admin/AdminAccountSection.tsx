import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../lib/useAuth';
import { supabase } from '../../lib/supabase';
import { staffIdFromEmail } from '../../lib/staffAuth';

const MIN_LENGTH = 8;

export function AdminAccountSection() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const staffId = user?.email ? staffIdFromEmail(user.email) : '';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;

    if (newPassword.length < MIN_LENGTH) {
      toast.error(`New password must be at least ${MIN_LENGTH} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation don't match");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error('New password must be different from your current one');
      return;
    }

    setSubmitting(true);

    // Re-verify the current password before allowing a change, even though the
    // user already has a valid session -- guards against someone with a few
    // minutes at an unlocked, still-logged-in device.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) {
      setSubmitting(false);
      toast.error('Current password is incorrect');
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setSubmitting(false);

    if (updateError) {
      toast.error('Could not update password', {
        description: updateError.message,
      });
      return;
    }

    toast.success('Password updated');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div>
      <h1 className="text-[1.8rem] mb-1.5">Account</h1>
      <p className="text-[0.95rem] mb-6 max-w-[60ch] text-text-secondary">
        Signed in as <span className="mono">{staffId}</span>. Change your password below — this
        applies to your own account only.
      </p>

      <form
        onSubmit={onSubmit}
        className="max-w-[380px] flex flex-col gap-4 p-5 bg-surface-1 border border-border rounded-2xl"
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-bold text-text-secondary">Current password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="bg-surface-2 border border-border rounded-md px-3 py-2.5 text-text-primary text-[0.92rem] focus:outline-2 focus:outline-accent focus:outline-offset-1"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-bold text-text-secondary">New password</label>
          <input
            type="password"
            required
            minLength={MIN_LENGTH}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={`At least ${MIN_LENGTH} characters`}
            className="bg-surface-2 border border-border rounded-md px-3 py-2.5 text-text-primary text-[0.92rem] focus:outline-2 focus:outline-accent focus:outline-offset-1"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-bold text-text-secondary">Confirm new password</label>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="bg-surface-2 border border-border rounded-md px-3 py-2.5 text-text-primary text-[0.92rem] focus:outline-2 focus:outline-accent focus:outline-offset-1"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="mt-1.5 inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-2.5 bg-accent text-[#181310] hover:bg-accent-hover transition-colors disabled:opacity-60"
        >
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  );
}
