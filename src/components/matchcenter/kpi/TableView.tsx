import type { MatchKpis } from '../../../lib/kpi/types';

function Better({ better }: { better: 'A' | 'B' | 'tie' | null }) {
  if (better === 'tie' || better === null) return <span className="text-text-muted">—</span>;
  return <span className={better === 'A' ? 'text-side-a font-bold' : 'text-side-b font-bold'}>Side {better}</span>;
}

/** Tooltip via native title attr -- lightweight, keyboard/AT-reachable, no extra deps. */
function Th({ children, formula }: { children: string; formula: string }) {
  return (
    <th
      title={formula}
      className="text-left px-3 py-2.5 text-[0.72rem] font-bold uppercase tracking-wide text-text-muted border-b border-border cursor-help"
    >
      {children}
    </th>
  );
}

export function TableView({ kpis }: { kpis: MatchKpis }) {
  const noClutch = kpis.sideA.clutchPointsPlayed === 0;

  const rows: { kpi: string; a: string; b: string; better: 'A' | 'B' | 'tie' | null; formula: string }[] = [
    {
      kpi: 'Match Result',
      a: kpis.winningSide === 'A' ? 'Won' : kpis.winningSide === 'B' ? 'Lost' : '—',
      b: kpis.winningSide === 'B' ? 'Won' : kpis.winningSide === 'A' ? 'Lost' : '—',
      better: kpis.winningSide,
      formula: 'Games won, best of ' + kpis.bestOfGames,
    },
    {
      kpi: 'Point-Win Percentage',
      a: `${kpis.sideA.pointWinPercentage}%`,
      b: `${kpis.sideB.pointWinPercentage}%`,
      better: kpis.sideA.pointWinPercentage === kpis.sideB.pointWinPercentage ? 'tie' : kpis.sideA.pointWinPercentage > kpis.sideB.pointWinPercentage ? 'A' : 'B',
      formula: 'Total points won ÷ total points played × 100',
    },
    {
      kpi: 'Point Differential',
      a: kpis.sideA.pointDifferential > 0 ? `+${kpis.sideA.pointDifferential}` : String(kpis.sideA.pointDifferential),
      b: kpis.sideB.pointDifferential > 0 ? `+${kpis.sideB.pointDifferential}` : String(kpis.sideB.pointDifferential),
      better: kpis.sideA.pointDifferential === kpis.sideB.pointDifferential ? 'tie' : kpis.sideA.pointDifferential > kpis.sideB.pointDifferential ? 'A' : 'B',
      formula: 'Total points won − total points lost',
    },
    {
      kpi: 'Longest Scoring Streak',
      a: String(kpis.sideA.longestScoringStreak),
      b: String(kpis.sideB.longestScoringStreak),
      better: kpis.sideA.longestScoringStreak === kpis.sideB.longestScoringStreak ? 'tie' : kpis.sideA.longestScoringStreak > kpis.sideB.longestScoringStreak ? 'A' : 'B',
      formula: 'Highest number of consecutive points won',
    },
    {
      kpi: 'Clutch-Point Win Rate',
      a: noClutch ? 'No clutch opportunities' : `${kpis.sideA.clutchPointWinPercentage}%`,
      b: noClutch ? 'No clutch opportunities' : `${kpis.sideB.clutchPointWinPercentage}%`,
      better: noClutch
        ? null
        : (kpis.sideA.clutchPointWinPercentage ?? 0) === (kpis.sideB.clutchPointWinPercentage ?? 0)
          ? 'tie'
          : (kpis.sideA.clutchPointWinPercentage ?? 0) > (kpis.sideB.clutchPointWinPercentage ?? 0)
            ? 'A'
            : 'B',
      formula: `Clutch points won ÷ total clutch points played × 100. A point is clutch when both sides have reached ${kpis.targetPoints - 3}+ and are within 2 points.`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-[0.95rem] mb-3">Match comparison</h3>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse min-w-[480px]">
            <thead>
              <tr className="bg-surface-2">
                <Th formula="The five tracked KPIs">KPI</Th>
                <Th formula={kpis.sideAName}>{kpis.sideAName}</Th>
                <Th formula={kpis.sideBName}>{kpis.sideBName}</Th>
                <Th formula="Which side performed better on this KPI">Better Performance</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.kpi} className="border-b border-border-soft last:border-b-0 odd:bg-surface-1 even:bg-surface-1/50">
                  <td title={r.formula} className="px-3 py-2.5 text-[0.82rem] font-semibold cursor-help">
                    {r.kpi}
                  </td>
                  <td className="mono px-3 py-2.5 text-[0.82rem] text-right">{r.a}</td>
                  <td className="mono px-3 py-2.5 text-[0.82rem] text-right">{r.b}</td>
                  <td className="px-3 py-2.5 text-[0.8rem]">
                    <Better better={r.better} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-[0.95rem] mb-3">Game by game</h3>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse min-w-[560px]">
            <thead>
              <tr className="bg-surface-2">
                <Th formula="Game number">Game</Th>
                <Th formula={kpis.sideAName}>{kpis.sideAName}</Th>
                <Th formula={kpis.sideBName}>{kpis.sideBName}</Th>
                <Th formula="Which side won the game">Winner</Th>
                <Th formula="This side's points won ÷ points played in this game × 100">{`${kpis.sideAName} Point-Win %`}</Th>
                <Th formula="This side's points won ÷ points played in this game × 100">{`${kpis.sideBName} Point-Win %`}</Th>
              </tr>
            </thead>
            <tbody>
              {kpis.gameScores.map((g) => (
                <tr key={g.game} className="border-b border-border-soft last:border-b-0 odd:bg-surface-1 even:bg-surface-1/50">
                  <td className="px-3 py-2.5 text-[0.82rem] font-semibold">{g.game}</td>
                  <td className={`mono px-3 py-2.5 text-[0.82rem] text-right ${g.winner === 'A' ? 'text-side-a font-bold' : ''}`}>{g.sideA}</td>
                  <td className={`mono px-3 py-2.5 text-[0.82rem] text-right ${g.winner === 'B' ? 'text-side-b font-bold' : ''}`}>{g.sideB}</td>
                  <td className="px-3 py-2.5 text-[0.8rem]">
                    {g.winner ? <span className={g.winner === 'A' ? 'text-side-a font-bold' : 'text-side-b font-bold'}>Side {g.winner}</span> : '—'}
                  </td>
                  <td className="mono px-3 py-2.5 text-[0.82rem] text-right">{g.sideAPointWinPercentage}%</td>
                  <td className="mono px-3 py-2.5 text-[0.82rem] text-right">{g.sideBPointWinPercentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
