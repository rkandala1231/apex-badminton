import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MatchKpis } from '../../../lib/kpi/types';

// Matches src/index.css's --color-side-a / --color-side-b / --color-text-* tokens exactly --
// Recharts renders raw SVG and needs literal color values, not Tailwind classes.
const SIDE_A = '#3987e5';
const SIDE_B = '#d95926';
const TEXT_MUTED = '#948b7f';
const BORDER = '#362f27';
const SURFACE_1 = '#1c1815';

const axisStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fill: TEXT_MUTED };

function ChartCard({ title, formula, children, caption }: {
  title: string;
  formula: string;
  children: React.ReactNode;
  caption: string;
}) {
  return (
    <div className="bg-surface-1 border border-border rounded-2xl p-5">
      <h3 className="text-[0.95rem] mb-0.5">{title}</h3>
      <p className="text-[0.7rem] text-text-muted mb-3">{formula}</p>
      {children}
      {/* Equivalent text data for every chart above -- screen readers and non-visual contexts. */}
      <p className="text-[0.74rem] text-text-secondary mt-2 mono">{caption}</p>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-[0.78rem]"
      style={{ background: SURFACE_1, borderColor: BORDER, color: '#f7f3ec' }}
    >
      {label && <div className="text-text-muted text-[0.7rem] mb-0.5">{label}</div>}
      {payload.map((p) => (
        <div key={p.name} className="font-bold" style={{ color: p.color }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

export function ChartsView({ kpis }: { kpis: MatchKpis }) {
  const noClutch = kpis.sideA.clutchPointsPlayed === 0;

  const gameData = kpis.gameScores.map((g) => ({
    name: `Game ${g.game}`,
    [kpis.sideAName]: g.sideA,
    [kpis.sideBName]: g.sideB,
  }));

  const winPctData = [
    { name: kpis.sideAName, value: kpis.sideA.pointWinPercentage, fill: SIDE_A },
    { name: kpis.sideBName, value: kpis.sideB.pointWinPercentage, fill: SIDE_B },
  ];

  const diffData = [
    { name: kpis.sideAName, value: kpis.sideA.pointDifferential, fill: SIDE_A },
    { name: kpis.sideBName, value: kpis.sideB.pointDifferential, fill: SIDE_B },
  ];

  const streakData = [
    { name: kpis.sideAName, value: kpis.sideA.longestScoringStreak, fill: SIDE_A },
    { name: kpis.sideBName, value: kpis.sideB.longestScoringStreak, fill: SIDE_B },
  ];

  const clutchData = noClutch
    ? []
    : [
        { name: kpis.sideAName, value: kpis.sideA.clutchPointWinPercentage ?? 0, fill: SIDE_A },
        { name: kpis.sideBName, value: kpis.sideB.clutchPointWinPercentage ?? 0, fill: SIDE_B },
      ];

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <ChartCard
        title="Match Score"
        formula="Points scored by each side, per game"
        caption={kpis.gameScores.map((g) => `G${g.game}: ${g.sideA}–${g.sideB}`).join('   ')}
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={gameData} barGap={4} role="img" aria-label="Grouped bar chart of each game's score">
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
            <XAxis dataKey="name" tick={axisStyle} axisLine={{ stroke: BORDER }} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={{ stroke: BORDER }} tickLine={false} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: TEXT_MUTED }} />
            <Bar dataKey={kpis.sideAName} fill={SIDE_A} radius={[4, 4, 0, 0]} label={{ position: 'top', fill: TEXT_MUTED, fontSize: 10 }} />
            <Bar dataKey={kpis.sideBName} fill={SIDE_B} radius={[4, 4, 0, 0]} label={{ position: 'top', fill: TEXT_MUTED, fontSize: 10 }} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Point-Win Percentage"
        formula="Share of total points won across the whole match"
        caption={`${kpis.sideAName} ${kpis.sideA.pointWinPercentage}% · ${kpis.sideBName} ${kpis.sideB.pointWinPercentage}%`}
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={winPctData} layout="vertical" role="img" aria-label="Bar chart of point-win percentage by side">
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={axisStyle} axisLine={{ stroke: BORDER }} tickLine={false} unit="%" />
            <YAxis type="category" dataKey="name" tick={axisStyle} axisLine={{ stroke: BORDER }} tickLine={false} width={90} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: TEXT_MUTED, fontSize: 11, formatter: (v) => `${v}%` }}>
              {winPctData.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Point Differential"
        formula="Points scored minus points conceded"
        caption={`${kpis.sideAName} ${kpis.sideA.pointDifferential > 0 ? '+' : ''}${kpis.sideA.pointDifferential} · ${kpis.sideBName} ${kpis.sideB.pointDifferential > 0 ? '+' : ''}${kpis.sideB.pointDifferential}`}
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={diffData} layout="vertical" role="img" aria-label="Centered bar chart of point differential by side">
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
            <XAxis type="number" tick={axisStyle} axisLine={{ stroke: BORDER }} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={axisStyle} axisLine={{ stroke: BORDER }} tickLine={false} width={90} />
            <ReferenceLine x={0} stroke={BORDER} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar
              dataKey="value"
              radius={[4, 4, 4, 4]}
              label={{ position: 'right', fill: TEXT_MUTED, fontSize: 11, formatter: (v) => (Number(v) > 0 ? `+${v}` : v) }}
            >
              {diffData.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Longest Scoring Streak"
        formula="Highest number of consecutive points won"
        caption={`${kpis.sideAName} ${kpis.sideA.longestScoringStreak} · ${kpis.sideBName} ${kpis.sideB.longestScoringStreak}`}
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={streakData} layout="vertical" role="img" aria-label="Bar chart comparing longest scoring streak by side">
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={axisStyle} axisLine={{ stroke: BORDER }} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={axisStyle} axisLine={{ stroke: BORDER }} tickLine={false} width={90} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: TEXT_MUTED, fontSize: 11 }}>
              {streakData.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Clutch Performance"
        formula={`Win rate on points where both sides had reached ${kpis.targetPoints - 3}+ within 2 points`}
        caption={noClutch ? 'No clutch situations in this match' : `${kpis.sideAName} ${kpis.sideA.clutchPointWinPercentage}% · ${kpis.sideBName} ${kpis.sideB.clutchPointWinPercentage}%`}
      >
        {noClutch ? (
          <div className="h-[220px] flex items-center justify-center rounded-xl border border-dashed border-border bg-surface-2/40">
            <p className="text-[0.82rem] text-text-muted">No clutch situations in this match</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={clutchData} layout="vertical" role="img" aria-label="Bar chart comparing clutch-point win rate by side">
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={axisStyle} axisLine={{ stroke: BORDER }} tickLine={false} unit="%" />
              <YAxis type="category" dataKey="name" tick={axisStyle} axisLine={{ stroke: BORDER }} tickLine={false} width={90} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: TEXT_MUTED, fontSize: 11, formatter: (v) => `${v}%` }}>
                {clutchData.map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
