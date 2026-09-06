import { Link } from 'react-router-dom';
import { usePlayerLeaderboard } from '../../lib/queries';
import { EmptyState } from '../matchcenter/shared';

/**
 * Home > Analytics > Player Statistics — the MVP leaderboard. Reuses Analytics.tsx's own
 * standalone-section layout (max-width container, SectionHead-style heading) since this tab lives
 * alongside that one under the same /analytics parent route.
 */
export function PlayerStatsSection() {
  const { data: rows, isLoading, isError } = usePlayerLeaderboard();

  return (
    <section className="py-10 md:py-14">
      <div className="max-w-[1180px] mx-auto px-5 md:px-12">
        <div className="mb-6">
          <div className="mono text-[0.7rem] tracking-[0.18em] uppercase text-accent font-bold mb-1.5">06 — Player Statistics</div>
          <h3 className="text-[1.7rem] md:text-[2rem] font-extrabold text-text-primary">MVP Leaderboard</h3>
          <p className="text-[0.9rem] text-text-muted mt-1.5 max-w-[62ch]">
            Ranked by MVP score — a v1 heuristic weighting match win rate, point win rate, clutch
            performance, and comeback wins. Computed fresh from every completed singles/doubles
            match; players need at least 3 completed matches to qualify. Team events aren't
            individually attributed and don't count toward these numbers.
          </p>
        </div>

        {isLoading ? (
          <div className="h-64 bg-surface-1 border border-border rounded-2xl animate-pulse" />
        ) : isError ? (
          <EmptyState text="Couldn't load the leaderboard right now — try again shortly." />
        ) : !rows || rows.length === 0 ? (
          <EmptyState text="No players have reached the 3-match MVP threshold yet. Check back once more matches are completed." />
        ) : (
          <div className="overflow-x-auto border border-border rounded-2xl">
            <table className="w-full border-collapse text-[0.85rem] min-w-[720px]">
              <thead>
                <tr>
                  {['Rank', 'Player', 'College', 'MVP', 'Matches', 'Win %', 'Point Win %'].map((h, i) => (
                    <th
                      key={h}
                      className={`text-left py-3 px-3.5 border-b border-border-soft text-text-muted text-[0.7rem] tracking-wide uppercase bg-surface-1 whitespace-nowrap ${
                        i >= 3 ? 'text-right mono' : ''
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.playerId}>
                    <td className="py-3 px-3.5 border-b border-border-soft mono text-text-muted">{i + 1}</td>
                    <td className="py-3 px-3.5 border-b border-border-soft">
                      <Link
                        to={`/analytics/players/${row.playerId}`}
                        className="font-semibold text-text-primary hover:text-accent transition-colors no-underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="py-3 px-3.5 border-b border-border-soft text-text-secondary whitespace-nowrap">
                      {row.college || '—'}
                    </td>
                    <td className="py-3 px-3.5 border-b border-border-soft text-right mono font-bold text-accent">
                      {row.mvpScore.toFixed(2)}
                    </td>
                    <td className="py-3 px-3.5 border-b border-border-soft text-right mono">{row.matchesPlayed}</td>
                    <td className="py-3 px-3.5 border-b border-border-soft text-right mono">{row.winPercentage.toFixed(1)}%</td>
                    <td className="py-3 px-3.5 border-b border-border-soft text-right mono">{row.pointWinPercentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
