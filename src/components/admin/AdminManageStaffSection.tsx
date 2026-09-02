import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useAdminStaff, useCreateAdminAccount, useRemoveAdminAccess } from '../../lib/queries';
import { staffIdFromEmail, toStaffEmail } from '../../lib/staffAuth';

function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%^&*+-=';
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function AdminManageStaffSection() {
  const { data: staff, isLoading } = useAdminStaff(true);
  const createAccount = useCreateAdminAccount();
  const removeAccess = useRemoveAdminAccess();

  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'super_admin'>('admin');
  const [note, setNote] = useState('');

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    const email = toStaffEmail(staffId);
    createAccount.mutate(
      { email, password, role, note: note || undefined },
      {
        onSuccess: () => {
          toast.success(`${staffIdFromEmail(email)} can now sign in with that ID and password`);
          setStaffId('');
          setPassword('');
          setNote('');
          setRole('admin');
        },
        onError: (err) =>
          toast.error('Could not create account', { description: err instanceof Error ? err.message : String(err) }),
      }
    );
  };

  const onRevoke = (email: string) => {
    const id = staffIdFromEmail(email);
    if (!window.confirm(`Revoke staff access for ${id}? This deletes the account entirely.`)) return;
    removeAccess.mutate(email, {
      onSuccess: () => toast.success(`Revoked ${id}`),
      onError: (err) => toast.error('Could not revoke', { description: err instanceof Error ? err.message : String(err) }),
    });
  };

  return (
    <div>
      <h1 className="text-[1.8rem] mb-1.5">Manage Admins</h1>
      <p className="text-[0.95rem] mb-6 max-w-[60ch] text-text-secondary">
        Super admin only. Create a staff ID + password for a new admin, or revoke access from
        anyone currently on the list.
      </p>

      <form
        onSubmit={onCreate}
        className="flex flex-wrap items-end gap-3 mb-8 p-5 bg-surface-1 border border-border rounded-2xl"
      >
        <div className="flex flex-col gap-1.5 min-w-[160px]">
          <label className="text-[0.78rem] font-bold text-text-secondary">Staff ID</label>
          <input
            type="text"
            required
            autoCapitalize="off"
            autoCorrect="off"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            placeholder="e.g. admin4"
            className="bg-surface-2 border border-border rounded-md px-3 py-2.5 text-text-primary text-[0.88rem]"
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-[220px]">
          <label className="text-[0.78rem] font-bold text-text-secondary">Password</label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="flex-1 bg-surface-2 border border-border rounded-md px-3 py-2.5 text-text-primary text-[0.88rem]"
            />
            <button
              type="button"
              onClick={() => setPassword(generatePassword())}
              className="whitespace-nowrap rounded-md border border-border px-3 py-2.5 text-[0.8rem] font-semibold text-text-secondary hover:text-text-primary hover:border-accent transition-colors"
            >
              Generate
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[0.78rem] font-bold text-text-secondary">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'super_admin')}
            className="bg-surface-2 border border-border rounded-md px-3 py-2.5 text-text-primary text-[0.88rem]"
          >
            <option value="admin">Admin — manages the tournament</option>
            <option value="super_admin">Super admin — all access</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
          <label className="text-[0.78rem] font-bold text-text-secondary">Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. tournament director"
            className="bg-surface-2 border border-border rounded-md px-3 py-2.5 text-text-primary text-[0.88rem]"
          />
        </div>
        <button
          type="submit"
          disabled={createAccount.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-2.5 bg-accent text-[#181310] hover:bg-accent-hover transition-colors disabled:opacity-60"
        >
          {createAccount.isPending ? 'Creating…' : 'Create account'}
        </button>
      </form>

      {isLoading ? (
        <div className="border border-border rounded-2xl h-40 bg-surface-3 animate-pulse" />
      ) : !staff || staff.length === 0 ? (
        <p className="text-center text-[0.86rem] text-text-muted py-12">No staff on the list yet.</p>
      ) : (
        <div className="overflow-x-auto border border-border rounded-2xl">
          <table className="w-full border-collapse text-[0.85rem] min-w-[560px]">
            <thead>
              <tr>
                {['Staff ID', 'Role', 'Note', 'Since', ''].map((h) => (
                  <th
                    key={h}
                    className="text-left py-3 px-3.5 border-b border-border-soft text-text-muted text-[0.7rem] tracking-wide uppercase bg-surface-1 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.email}>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap mono">
                    {staffIdFromEmail(s.email)}
                  </td>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap capitalize">
                    {s.role === 'super_admin' ? 'Super admin' : 'Admin'}
                  </td>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap text-text-muted">
                    {s.note || '—'}
                  </td>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap">
                    {new Date(s.since).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap">
                    <button
                      onClick={() => onRevoke(s.email)}
                      disabled={removeAccess.isPending}
                      className="text-[0.78rem] font-semibold text-text-muted hover:text-[var(--color-ev-ws)] transition-colors disabled:opacity-60"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
