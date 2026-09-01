import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SectionHead } from '../ui/SectionHead';
import { Reveal } from '../ui/Reveal';
import { TrendChart } from '../charts/TrendChart';
import { BarChart, type BarDatum } from '../charts/BarChart';
import { useAnalytics } from '../../lib/queries';
import { EVENT_META, REGIONS } from '../../lib/types';

function StatTile({ value, label, delta, loading }: { value: string; label: string; delta?: string; loading: boolean }) {
  return (
    <div className="bg-surface-1 border border-border rounded-2xl px-6 py-5.5">
      {loading ? (
        <div className="h-8 w-16 bg-surface-3 rounded animate-pulse" />
      ) : (
        <div className="mono text-[2.1rem] font-bold text-text-primary leading-none">{value}</div>
      )}
      <div className="text-[0.8rem] text-text-muted mt-2">{label}</div>
      <div className="text-[0.76rem] mt-1.5 mono" style={{ color: 'var(--color-ev-md)' }}>
        {delta || ' '}
      </div>
    </div>
  );
}

function DataTable({ rows, headers }: { rows: (string | number)[][]; headers: string[] }) {
  return (
    <table className="w-full border-collapse text-[0.84rem] mt-3.5">
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th
              key={h}
              className={`text-left py-2 px-1.5 border-b border-border-soft ${i === headers.length - 1 ? 'text-right mono' : ''}`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className={`py-2 px-1.5 border-b border-border-soft ${j === r.length - 1 ? 'text-right mono' : ''}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TableToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="mono text-[0.68rem] tracking-wide text-text-muted border border-border rounded-md px-2.5 py-1.5 whitespace-nowrap inline-flex items-center gap-1 hover:border-accent hover:text-accent transition-colors"
    >
      {show ? 'Hide table' : 'View table'}
      {show ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
    </button>
  );
}

export function Analytics() {
  const { data, isLoading, isFetching, isError } = useAnalytics();
  const [showTrend, setShowTrend] = useState(false);
  const [showCat, setShowCat] = useState(false);
  const [showRegion, setShowRegion] = useState(false);

  const catData: BarDatum[] = useMemo(() => {
    const counts = new Map((data?.events || []).map((r) => [r.event_code, Number(r.entries)]));
    return EVENT_META.map((m) => ({ code: m.code, label: m.label, value: counts.get(m.code) || 0, color: m.colorVar }));
  }, [data]);

  const regionData: BarDatum[] = useMemo(() => {
    const counts = new Map((data?.regions || []).map((r) => [r.region, Number(r.colleges)]));
    return REGIONS.map((r) => ({ code: r, label: `${r} region`, value: counts.get(r) || 0, color: 'var(--color-ev-ms)' }));
  }, [data]);

  const catTotal = catData.reduce((a, d) => a + d.value, 0);
  const regionTotal = regionData.reduce((a, d) => a + d.value, 0);
  const stats = data?.stats;
  const regionsRepresented = (data?.regions || []).filter((r) => Number(r.colleges) > 0).length;

  return (
    <section id="analytics" className="py-16 md:py-24">
      <div className="max-w-[1180px] mx-auto px-5 md:px-12">
        <SectionHead num="05" title="Tournament Analytics">
          Pulled live from the registration database — updates the moment a new college signs up.
        </SectionHead>
        {(isFetching || isError) && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="inline-flex items-center gap-2 text-[0.76rem] px-3 py-1.5 rounded-full mb-6 -mt-4"
            style={{
              color: isError ? 'var(--color-ev-ws)' : 'var(--color-gold)',
              background: isError ? 'rgba(217,89,38,0.1)' : 'rgba(255,182,39,0.1)',
              border: `1px solid ${isError ? 'var(--color-ev-ws)' : 'rgba(255,182,39,0.35)'}`,
            }}
          >
            <span style={{ fontSize: '0.5rem' }}>●</span>
            {isError ? 'Live — connection issue, showing last-known state' : 'Live — connecting…'}
          </motion.span>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4.5 mb-8">
          <StatTile
            loading={isLoading}
            value={String(stats?.colleges_registered ?? 0)}
            label="Colleges registered"
            delta={stats && stats.colleges_this_week > 0 ? `▲ ${stats.colleges_this_week} this week` : 'no new colleges this week'}
          />
          <StatTile
            loading={isLoading}
            value={String(stats?.total_entries ?? 0)}
            label="Total entries"
            delta={stats && stats.entries_this_week > 0 ? `▲ ${stats.entries_this_week} this week` : 'no new entries this week'}
          />
          <StatTile
            loading={isLoading}
            value={stats && stats.colleges_registered > 0 ? (stats.total_entries / stats.colleges_registered).toFixed(1) : '—'}
            label="Avg. events per college"
            delta="breadth of entry"
          />
          <StatTile loading={isLoading} value={String(regionsRepresented)} label="Regions represented" delta="of 6 possible" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
          <Reveal className="lg:col-span-2">
            <div className="bg-surface-1 border border-border rounded-2xl p-5 md:p-7">
              <div className="flex items-start justify-between gap-3 mb-4.5">
                <div>
                  <h4 className="font-sans normal-case font-extrabold text-[1.05rem] text-text-primary">Registration trend</h4>
                  <p className="text-[0.8rem] mt-1">Cumulative entries by week, Sep 15 – Dec 15 deadline.</p>
                </div>
                <TableToggle show={showTrend} onToggle={() => setShowTrend((v) => !v)} />
              </div>
              {isLoading ? (
                <div className="h-[260px] bg-surface-3 rounded-lg animate-pulse" />
              ) : (
                <TrendChart rows={data?.trend || []} />
              )}
              {showTrend && (
                <DataTable
                  headers={['Week of', 'Cumulative entries']}
                  rows={(data?.trend || []).map((r) => [new Date(r.week_start + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }), r.cumulative])}
                />
              )}
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="bg-surface-1 border border-border rounded-2xl p-5 md:p-7">
              <div className="flex items-start justify-between gap-3 mb-4.5">
                <div>
                  <h4 className="font-sans normal-case font-extrabold text-[1.05rem] text-text-primary">Entries by event</h4>
                  <p className="text-[0.8rem] mt-1">Registered entries per category.</p>
                </div>
                <TableToggle show={showCat} onToggle={() => setShowCat((v) => !v)} />
              </div>
              {isLoading ? (
                <div className="h-[260px] bg-surface-3 rounded-lg animate-pulse" />
              ) : catTotal === 0 ? (
                <p className="text-center text-[0.86rem] text-text-muted py-12 px-5 max-w-[34ch] mx-auto">
                  No entries yet — be the first college to register.
                </p>
              ) : (
                <BarChart data={catData} ariaLabel="Bar chart of entries by event category" />
              )}
              <div className="flex flex-wrap gap-3.5 mt-4">
                {EVENT_META.map((m) => (
                  <span key={m.code} className="inline-flex items-center gap-1.5 text-[0.78rem] text-text-secondary">
                    <i className="w-2.5 h-2.5 rounded-[3px] inline-block" style={{ background: m.colorVar }} />
                    {m.code} — {m.label}
                  </span>
                ))}
              </div>
              {showCat && <DataTable headers={['Event', 'Entries']} rows={catData.map((d) => [`${d.label} (${d.code})`, d.value])} />}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="bg-surface-1 border border-border rounded-2xl p-5 md:p-7">
              <div className="flex items-start justify-between gap-3 mb-4.5">
                <div>
                  <h4 className="font-sans normal-case font-extrabold text-[1.05rem] text-text-primary">Colleges by region</h4>
                  <p className="text-[0.8rem] mt-1">Where registered colleges are from.</p>
                </div>
                <TableToggle show={showRegion} onToggle={() => setShowRegion((v) => !v)} />
              </div>
              {isLoading ? (
                <div className="h-[260px] bg-surface-3 rounded-lg animate-pulse" />
              ) : regionTotal === 0 ? (
                <p className="text-center text-[0.86rem] text-text-muted py-12 px-5 max-w-[34ch] mx-auto">
                  No colleges registered yet.
                </p>
              ) : (
                <BarChart data={regionData} ariaLabel="Bar chart of colleges registered by region" />
              )}
              {showRegion && <DataTable headers={['Region', 'Colleges']} rows={regionData.map((d) => [d.label.replace(' region', ''), d.value])} />}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
