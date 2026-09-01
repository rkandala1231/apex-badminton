import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChartTooltip, type TooltipState } from './Tooltip';
import type { WeeklyTrendRow } from '../../lib/types';

function fmtWeek(iso: string) {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const W = 900;
const H = 260;
const PAD_L = 40;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 34;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

export function TrendChart({ rows }: { rows: WeeklyTrendRow[] }) {
  const [tip, setTip] = useState<TooltipState | null>(null);

  const trend = useMemo(() => rows.map((r) => ({ w: fmtWeek(r.week_start), v: Number(r.cumulative) })), [rows]);

  if (trend.length < 2) {
    return (
      <p className="text-center text-[0.86rem] text-text-muted py-12 px-5 max-w-[34ch] mx-auto">
        Not enough weeks of data yet to plot a trend — check back once a few colleges have signed up.
      </p>
    );
  }

  const maxV = Math.max(20, Math.ceil(Math.max(...trend.map((d) => d.v)) / 20) * 20);
  const x = (i: number) => (trend.length === 1 ? PAD_L : PAD_L + (i / (trend.length - 1)) * PLOT_W);
  const y = (v: number) => PAD_T + PLOT_H - (v / maxV) * PLOT_H;
  const steps = 4;
  const gridSteps = Array.from({ length: steps + 1 }, (_, s) => (maxV / steps) * s);

  const areaPts = trend.map((d, i) => `${x(i)},${y(d.v)}`).join(' L ');
  const areaPath = `M ${x(0)},${y(0)} L ${areaPts} L ${x(trend.length - 1)},${y(0)} Z`;
  const linePts = trend.map((d, i) => `${x(i)},${y(d.v)}`).join(' L ');

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Line chart of cumulative registration entries by week" className="block w-full h-auto overflow-visible">
        {gridSteps.map((val, s) => (
          <g key={s}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(val)} y2={y(val)} className="stroke-border-soft" strokeWidth={1} />
            <text x={6} y={y(val) + 4} className="fill-text-muted" fontFamily="'JetBrains Mono',monospace" fontSize={10}>
              {Math.round(val)}
            </text>
          </g>
        ))}
        {trend.map(
          (d, i) =>
            (i % 2 === 0 || i === trend.length - 1) && (
              <text key={i} x={x(i)} y={H - 10} textAnchor="middle" className="fill-text-muted" fontFamily="'JetBrains Mono',monospace" fontSize={10}>
                {d.w}
              </text>
            )
        )}

        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.32} />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <motion.path
          d={areaPath}
          fill="url(#trendGrad)"
          stroke="none"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        />
        <motion.path
          d={`M ${linePts}`}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />

        {trend.map((d, i) => {
          const isLast = i === trend.length - 1;
          return (
            <circle
              key={i}
              cx={x(i)}
              cy={y(d.v)}
              r={isLast ? 5 : 3}
              fill={isLast ? 'var(--color-accent)' : 'var(--color-bg)'}
              stroke="var(--color-accent)"
              strokeWidth={2}
            />
          );
        })}

        {trend.map((d, i) => {
          const xPrev = i === 0 ? x(0) - (trend.length > 1 ? x(1) - x(0) : 1) : x(i - 1);
          const xNext = i === trend.length - 1 ? x(i) + (trend.length > 1 ? x(i) - x(i - 1) : 1) : x(i + 1);
          const left = Math.max(PAD_L, (x(i) + xPrev) / 2);
          const right = Math.min(W - PAD_R, (x(i) + xNext) / 2);
          return (
            <g key={i}>
              <line
                x1={x(i)}
                x2={x(i)}
                y1={PAD_T}
                y2={PAD_T + PLOT_H}
                stroke="var(--color-accent)"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={tip?.label === `Week of ${d.w}` ? 1 : 0}
              />
              <rect
                x={left}
                y={PAD_T}
                width={Math.max(1, right - left)}
                height={PLOT_H}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, label: `Week of ${d.w}`, value: `${d.v} cumulative entries` })}
                onMouseLeave={() => setTip(null)}
              />
            </g>
          );
        })}
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  );
}
