import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useAdminRegistrations, useUpdateRegistrationStatus } from '../../lib/queries';
import { EVENT_META, REGIONS, type RegistrationStatus } from '../../lib/types';

const STATUSES: RegistrationStatus[] = ['pending', 'confirmed', 'waitlisted', 'cancelled'];

function eventColor(code: string) {
  return EVENT_META.find((m) => m.code === code)?.colorVar || 'var(--color-ev-ms)';
}

function toCsv(rows: ReturnType<typeof useAdminRegistrations>['data']) {
  const header = ['College', 'Captain', 'Email', 'Region', 'Events', 'Roster Size', 'Status', 'Registered At'];
  const lines = [header.join(',')];
  (rows || []).forEach((r) => {
    const cells = [r.college_name, r.captain_name, r.captain_email, r.region, (r.events || []).join(' '), r.roster_size ?? '', r.status, r.created_at];
    lines.push(
      cells
        .map((c) => {
          const v = String(c ?? '').replace(/"/g, '""');
          return /[",\n]/.test(v) ? `"${v}"` : v;
        })
        .join(',')
    );
  });
  return lines.join('\n');
}

export function AdminDashboard({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const { data: allRows, isLoading, refetch, isFetching } = useAdminRegistrations(true);
  const updateStatus = useUpdateRegistrationStatus();
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (allRows || []).filter((r) => {
      if (regionFilter && r.region !== regionFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (s) {
        const hay = `${r.college_name} ${r.captain_name} ${r.captain_email}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [allRows, search, regionFilter, statusFilter]);

  const handleStatusChange = (id: string, status: string) => {
    updateStatus.mutate(
      { id, status },
      {
        onError: (err) => toast.error('Could not update status', { description: err instanceof Error ? err.message : String(err) }),
        onSuccess: () => toast.success('Status updated'),
      }
    );
  };

  const handleExport = () => {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'apex-registrations.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <h2 className="text-[1.8rem]">Registrations</h2>
          <p className="text-[0.88rem] text-text-muted mt-1">
            {isLoading ? 'Loading…' : `${rows.length} of ${allRows?.length ?? 0} registration${(allRows?.length ?? 0) === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex gap-2.5 flex-wrap items-center">
          <input
            type="search"
            placeholder="Search college, captain, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-surface-2 border border-border rounded-md px-3 py-2.5 text-text-primary text-[0.85rem]"
          />
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="bg-surface-2 border border-border rounded-md px-3 py-2.5 text-text-primary text-[0.85rem]"
          >
            <option value="">All regions</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-surface-2 border border-border rounded-md px-3 py-2.5 text-text-primary text-[0.85rem]"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={handleExport}
            className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-2.5 bg-transparent text-text-primary border border-border hover:border-accent hover:text-accent transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-2.5 bg-transparent text-text-primary border border-border hover:border-accent hover:text-accent transition-colors disabled:opacity-60"
            disabled={isFetching}
          >
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            onClick={onSignOut}
            className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-2.5 bg-transparent text-text-primary border border-border hover:border-accent hover:text-accent transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      <p className="mono text-[0.78rem] text-text-muted mb-4">Signed in as {email}</p>

      {isLoading ? (
        <div className="border border-border rounded-2xl h-64 bg-surface-3 animate-pulse" />
      ) : allRows && allRows.length === 0 ? (
        <p className="text-center text-[0.86rem] text-text-muted py-12">No registrations yet.</p>
      ) : (
        <div className="overflow-x-auto border border-border rounded-2xl">
          <table className="w-full border-collapse text-[0.85rem] min-w-[920px]">
            <thead>
              <tr>
                {['College', 'Captain', 'Email', 'Region', 'Events', 'Roster', 'Registered', 'Status'].map((h) => (
                  <th
                    key={h}
                    className="text-left py-3 px-3.5 border-b border-border-soft text-text-muted text-[0.7rem] tracking-wide uppercase bg-surface-1 sticky top-0 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-normal">{r.college_name}</td>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap">{r.captain_name}</td>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap">{r.captain_email}</td>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap">{r.region}</td>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap">
                    {(r.events || []).map((code) => (
                      <span
                        key={code}
                        className="inline-block mono text-[0.68rem] font-bold px-1.5 py-0.5 rounded m-0.5 text-[#171310]"
                        style={{ background: eventColor(code) }}
                      >
                        {code}
                      </span>
                    ))}
                  </td>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap">{r.roster_size ?? '—'}</td>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap">
                    <select
                      value={r.status}
                      onChange={(e) => handleStatusChange(r.id, e.target.value)}
                      className="bg-surface-2 border border-border rounded-md text-text-primary mono text-[0.76rem] px-2 py-1.5"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
