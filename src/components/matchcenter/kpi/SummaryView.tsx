import type { MatchKpis } from '../../../lib/kpi/types';

const CARD_CLS = 'bg-surface-1 border border-border rounded-2xl p-5';

function StatRow({ label, a, b, format = (v: number) => String(v) }: {
  label: string;
  a: number | string;
  b: number | string;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border-soft last:border-b-0">
      <span className="mono text-[0.72rem] text-side-a font-bold w-16 shrink-0">
        {typeof a === 'number' ? format(a) : a}
      </span>
      <span className="text-[0.78rem] text-text-muted text-center flex-1">{label}</span>
      <span className="mono text-[0.72rem] text-side-b font-bold w-16 shrink-0 text-right">
        {typeof b === 'number' ? format(b) : b}
      </span>
    </div>
  );
}

export function SummaryView({ kpis }: { kpis: MatchKpis }) {
  const isDoubles = kpis.matchType === 'doubles';
  const noClutch = kpis.sideA.clutchPointsPlayed === 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {isDoubles && (
        <div className="sm:col-span-2 rounded-xl border border-border-soft bg-surface-1/60 px-4 py-2.5 text-[0.76rem] text-text-muted">
          These are <strong className="text-text-secondary">pair statistics</strong> for {kpis.sideAName} and{' '}
          {kpis.sideBName} — not broken out per individual player.
        </div>
      )}

      {/* 1. Match Result and Score */}
      <div className={`${CARD_CLS} sm:col-span-2`}>
        <h3 className="text-[0.95rem] mb-3">Match Result &amp; Score</h3>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className={`font-bold ${kpis.winningSide === 'A' ? 'text-side-a' : 'text-text-primary'}`}>
            {kpis.sideAName}
          </div>
          <span className="mono text-[0.72rem] text-text-muted uppercase">
            {kpis.winningSide ? (kpis.winningSide === 'A' ? 'won' : 'lost') : 'in progress'}
          </span>
          <div className={`font-bold text-right ${kpis.winningSide === 'B' ? 'text-side-b' : 'text-text-primary'}`}>
            {kpis.sideBName}
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {kpis.gameScores.map((g) => (
            <span key={g.game} className="mono text-[0.82rem] font-bold px-2.5 py-1 rounded-md bg-surface-2 text-text-primary">
              {g.sideA}–{g.sideB}
            </span>
          ))}
        </div>
        <p className="text-[0.72rem] text-text-muted mt-2">
          {kpis.gameScores.filter((g) => g.winner === 'A').length}–
          {kpis.gameScores.filter((g) => g.winner === 'B').length} games ·{' '}
          {kpis.completedAt ? new Date(kpis.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Not yet completed'}
        </p>
      </div>

      {/* 2. Point-Win Percentage */}
      <div className={CARD_CLS}>
        <h3 className="text-[0.95rem] mb-2">Point-Win Percentage</h3>
        <StatRow label="of total points played" a={kpis.sideA.pointWinPercentage} b={kpis.sideB.pointWinPercentage} format={(v) => `${v}%`} />
        <StatRow label="points won" a={kpis.sideA.pointsWon} b={kpis.sideB.pointsWon} />
        <StatRow label="points lost" a={kpis.sideA.pointsLost} b={kpis.sideB.pointsLost} />
      </div>

      {/* 3. Point Differential */}
      <div className={CARD_CLS}>
        <h3 className="text-[0.95rem] mb-2">Point Differential</h3>
        <StatRow
          label="points scored minus conceded"
          a={kpis.sideA.pointDifferential > 0 ? `+${kpis.sideA.pointDifferential}` : kpis.sideA.pointDifferential}
          b={kpis.sideB.pointDifferential > 0 ? `+${kpis.sideB.pointDifferential}` : kpis.sideB.pointDifferential}
        />
      </div>

      {/* 4. Longest Scoring Streak */}
      <div className={CARD_CLS}>
        <h3 className="text-[0.95rem] mb-2">Longest Scoring Streak</h3>
        <StatRow label="consecutive points won" a={kpis.sideA.longestScoringStreak} b={kpis.sideB.longestScoringStreak} />
        {kpis.sideA.longestStreakDetail && (
          <p className="text-[0.72rem] text-text-muted mt-1.5">
            {kpis.sideAName}: {kpis.sideA.longestScoringStreak} points in Game {kpis.sideA.longestStreakDetail.game}{' '}
            ({kpis.sideA.longestStreakDetail.startA}–{kpis.sideA.longestStreakDetail.startB} →{' '}
            {kpis.sideA.longestStreakDetail.endA}–{kpis.sideA.longestStreakDetail.endB})
          </p>
        )}
        {kpis.sideB.longestStreakDetail && (
          <p className="text-[0.72rem] text-text-muted">
            {kpis.sideBName}: {kpis.sideB.longestScoringStreak} points in Game {kpis.sideB.longestStreakDetail.game}{' '}
            ({kpis.sideB.longestStreakDetail.startA}–{kpis.sideB.longestStreakDetail.startB} →{' '}
            {kpis.sideB.longestStreakDetail.endA}–{kpis.sideB.longestStreakDetail.endB})
          </p>
        )}
      </div>

      {/* 5. Clutch-Point Win Rate */}
      <div className={CARD_CLS}>
        <h3 className="text-[0.95rem] mb-2">Clutch-Point Win Rate</h3>
        {noClutch ? (
          <p className="text-[0.8rem] text-text-muted">No clutch situations in this match</p>
        ) : (
          <>
            <StatRow
              label="of clutch points played"
              a={kpis.sideA.clutchPointWinPercentage ?? 0}
              b={kpis.sideB.clutchPointWinPercentage ?? 0}
              format={(v) => `${v}%`}
            />
            <StatRow label="clutch points won" a={kpis.sideA.clutchPointsWon} b={kpis.sideB.clutchPointsWon} />
            <p className="text-[0.7rem] text-text-muted mt-1.5">
              {kpis.sideA.clutchPointsPlayed} clutch point{kpis.sideA.clutchPointsPlayed === 1 ? '' : 's'} played
              (both sides within 2, at {kpis.targetPoints - 3}+)
            </p>
          </>
        )}
      </div>
    </div>
  );
}
