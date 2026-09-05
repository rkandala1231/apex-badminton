import { useMemo, useState } from 'react';
import { BarChart, type BarDatum } from '../charts/BarChart';
import { EmptyState } from '../matchcenter/shared';
import { COLLEGES } from '../../lib/matchCenterData';
import {
  useAdminAssessments,
  type FinalDecision,
  type SuggestedLevel,
} from '../../lib/queries';

const SUGGESTED_LEVELS: SuggestedLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Competitive'];
const FINAL_DECISIONS: FinalDecision[] = ['Advance', 'Hold', 'Reassess'];

const LEVEL_COLOR: Record<SuggestedLevel, string> = {
  Beginner: 'var(--color-ev-md)',
  Intermediate: 'var(--color-ev-ms)',
  Advanced: 'var(--color-gold)',
  Competitive: 'var(--color-ev-ws)',
};

const DECISION_COLOR: Record<FinalDecision, string> = {
  Advance: 'var(--color-accent)',
  Hold: 'var(--color-gold)',
  Reassess: 'var(--color-ev-ws)',
};

const selectCls = 'bg-surface-2 border border-border rounded-md px-3 py-2.5 text-text-primary text-[0.85rem]';

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function AssessmentResults() {
  const { data: allRows, isLoading } = useAdminAssessments(true);
  const [search, setSearch] = useState('');
  const [collegeFilter, setCollegeFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('');

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (allRows || []).filter((r) => {
      if (collegeFilter && r.college !== collegeFilter) return false;
      if (levelFilter && r.suggested_level !== levelFilter) return false;
      if (decisionFilter && r.final_decision !== decisionFilter) return false;
      if (s) {
        const hay = `${r.player_name} ${r.evaluator}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [allRows, search, collegeFilter, levelFilter, decisionFilter]);

  const levelData: BarDatum[] = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => counts.set(r.suggested_level, (counts.get(r.suggested_level) || 0) + 1));
    return SUGGESTED_LEVELS.map((l) => ({ code: l, label: l, value: counts.get(l) || 0, color: LEVEL_COLOR[l] }));
  }, [rows]);

  const decisionData: BarDatum[] = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => counts.set(r.final_decision, (counts.get(r.final_decision) || 0) + 1));
    return FINAL_DECISIONS.map((d) => ({ code: d, label: d, value: counts.get(d) || 0, color: DECISION_COLOR[d] }));
  }, [rows]);

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <div className="h-11 bg-surface-3 rounded-md animate-pulse max-w-[540px]" />
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="h-64 bg-surface-3 rounded-2xl animate-pulse" />
          <div className="h-64 bg-surface-3 rounded-2xl animate-pulse" />
        </div>
        <div className="h-56 bg-surface-3 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!allRows || allRows.length === 0) {
    return <EmptyState text="No assessments recorded yet — entries you save on the New Assessment tab will show up here as a table and as charts." />;
  }

  return (
    <div>
      <div className="flex gap-2.5 flex-wrap items-center mb-6">
        <input
          type="search"
          placeholder="Search player or evaluator…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={selectCls}
        />
        <select value={collegeFilter} onChange={(e) => setCollegeFilter(e.target.value)} className={selectCls}>
          <option value="">All colleges</option>
          {COLLEGES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className={selectCls}>
          <option value="">All levels</option>
          {SUGGESTED_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value)} className={selectCls}>
          <option value="">All decisions</option>
          {FINAL_DECISIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <span className="text-[0.82rem] text-text-muted ml-auto">
          {rows.length} of {allRows.length} assessment{allRows.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-surface-1 border border-border rounded-2xl p-5">
          <h4 className="font-sans normal-case font-extrabold text-[0.95rem] text-text-primary mb-3">Suggested level</h4>
          <BarChart data={levelData} ariaLabel="Bar chart of assessments by suggested level" />
        </div>
        <div className="bg-surface-1 border border-border rounded-2xl p-5">
          <h4 className="font-sans normal-case font-extrabold text-[0.95rem] text-text-primary mb-3">Final decision</h4>
          <BarChart data={decisionData} ariaLabel="Bar chart of assessments by final decision" />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-center text-[0.86rem] text-text-muted py-12">No assessments match those filters.</p>
      ) : (
        <div className="overflow-x-auto border border-border rounded-2xl">
          <table className="w-full border-collapse text-[0.85rem] min-w-[860px]">
            <thead>
              <tr>
                {['Player', 'College', 'Clinic Date', 'Evaluator', 'Suggested Level', 'Final Decision', 'Comments'].map((h) => (
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
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap">{r.player_name}</td>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap text-text-secondary">{r.college}</td>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap">{fmtDate(r.clinic_date)}</td>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap">{r.evaluator}</td>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap">
                    <span
                      className="inline-block text-[0.72rem] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `color-mix(in srgb, ${LEVEL_COLOR[r.suggested_level]} 18%, transparent)`, color: LEVEL_COLOR[r.suggested_level] }}
                    >
                      {r.suggested_level}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap">
                    <span
                      className="inline-block text-[0.72rem] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `color-mix(in srgb, ${DECISION_COLOR[r.final_decision]} 18%, transparent)`, color: DECISION_COLOR[r.final_decision] }}
                    >
                      {r.final_decision}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 border-b border-border-soft whitespace-normal max-w-[260px] text-text-secondary">
                    {r.comments || '—'}
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
