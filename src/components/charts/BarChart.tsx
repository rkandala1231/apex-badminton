import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChartTooltip, type TooltipState } from './Tooltip';

export interface BarDatum {
  code: string;
  label: string;
  value: number;
  color: string;
}

const W = 420;
const H = 260;
const PAD_L = 34;
const PAD_R = 10;
const PAD_T = 14;
const PAD_B = 54;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

export function BarChart({ data, ariaLabel }: { data: BarDatum[]; ariaLabel: string }) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const maxV = Math.max(10, Math.ceil(Math.max(...data.map((d) => d.value)) / 10) * 10);
  const n = data.length;
  const gap = 14;
  const barW = (PLOT_W - gap * (n - 1)) / n;
  const y = (v: number) => PAD_T + PLOT_H - (v / maxV) * PLOT_H;
  const steps = 4;
  const gridSteps = Array.from({ length: steps + 1 }, (_, s) => (maxV / steps) * s);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="block w-full h-auto overflow-visible">
        {gridSteps.map((val, s) => (
          <g key={s}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(val)} y2={y(val)} className="stroke-border-soft" strokeWidth={1} />
            <text x={6} y={y(val) + 4} className="fill-text-muted" fontFamily="'JetBrains Mono',monospace" fontSize={10}>
              {val}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const bx = PAD_L + i * (barW + gap);
          const by = y(d.value);
          const bh = PAD_T + PLOT_H - by;
          return (
            <g key={d.code}>
              <motion.rect
                x={bx}
                width={barW}
                rx={4}
                ry={4}
                fill={d.color}
                style={{ cursor: 'pointer' }}
                initial={{ y: PAD_T + PLOT_H, height: 0 }}
                whileInView={{ y: by, height: bh }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, label: d.label, value: String(d.value) })}
                onMouseLeave={() => setTip(null)}
              />
              <text x={bx + barW / 2} y={H - 38} textAnchor="middle" className="fill-text-muted" fontFamily="'JetBrains Mono',monospace" fontSize={10}>
                {d.code}
              </text>
              <text x={bx + barW / 2} y={by - 8} textAnchor="middle" className="fill-text-secondary" fontFamily="'JetBrains Mono',monospace" fontSize={10}>
                {d.value}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  );
}
