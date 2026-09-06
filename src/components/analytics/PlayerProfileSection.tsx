import { Link, useParams } from 'react-router-dom';
import type { EventCode } from '../../lib/matchCenterData';
import { usePlayerProfile } from '../../lib/queries';
import { EVENT_LABEL } from '../matchcenter/livescoring/constants';
import { EmptyState } from '../matchcenter/shared';
import { MatchVideoLinkControl } from './MatchVideoLinkControl';

const FORMAT_ORDER: EventCode[] = ['MS', 'WS', 'MD', 'WD', 'XD'];

function StatTile({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="bg-surface-1 border border-border rounded-2xl px-5 py-4.5">
      <div className="mono text-[1.7rem] font-bold text-text-primary leading-none">{value}</div>
      <div className="text-[0.78rem] text-text-muted mt-2">{label}</div>
      {sub && <div className="text-[0.72rem] text-text-secondary mt-1">{sub}</div>}
    </div>
  );
}

function ComingSoonCard({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="bg-surface-1/60 border border-dashed border-border rounded-2xl px-5 py-4.5">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="mono text-[0.65rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-border text-text-muted">
          Coming soon
        </span>
        <span className="font-semibold text-[0.88rem] text-text-secondary">{title}</span>
      </div>
      <p className="text-[0.78rem] text-text-muted">{reason}</p>
    </div>
  );
}

export function PlayerProfileSection() {
  const { playerId } = useParams<{ playerId: string }>();
  const { data: profile, isLoading, isError } = usePlayerProfile(playerId ?? null);

  return (
    <section className="py-10 md:py-14">
      <div className="max-w-[1180px] mx-auto px-5 md:px-12">
        <Link to="/analytics/players" className="text-[0.82rem] text-text-secondary hover:text-text-primary no-underline">
          ← Back to leaderboard
        </Link>

        {isLoading ? (
          <div className="h-64 bg-surface-1 border border-border rounded-2xl animate-pulse mt-4" />
        ) : isError || !profile ? (
          <EmptyState className="mt-4" text="Couldn't load this player's profile — they may not exist, or something went wrong." />
        ) : (
          <ProfileBody profile={profile} />
        )}
      </div>
    </section>
  );
}

function ProfileBody({ profile }: { profile: NonNullable<ReturnType<typeof usePlayerProfile>['data']> }) {
  const { stats } = profile;
  const mvpEligible = stats.mvpScore !== null;

  return (
    <>
      <div className="flex items-start justify-between gap-4 flex-wrap mt-3 mb-6">
        <div>
          <h3 className="text-[1.7rem] md:text-[2rem] font-extrabold text-text-primary">{profile.name}</h3>
          <p className="text-[0.9rem] text-text-muted mt-1">{profile.college || 'No college on file'}</p>
        </div>
        <div className="bg-surface-1 border border-accent/40 rounded-2xl px-5 py-3 text-right">
          <div className="mono text-[1.9rem] font-bold text-accent leading-none">
            {mvpEligible ? stats.mvpScore!.toFixed(2) : '—'}
          </div>
          <div className="text-[0.72rem] text-text-muted mt-1">
            {mvpEligible ? 'MVP score' : `MVP score — needs 3 matches (has ${stats.matchesPlayed})`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-8">
        <StatTile value={`${stats.wins}–${stats.losses}`} label="Win/Loss record" sub={`${stats.winPercentage.toFixed(1)}% win rate`} />
        <StatTile value={`${stats.pointWinPercentage.toFixed(1)}%`} label="Point win %" sub={`${stats.pointDifferential >= 0 ? '+' : ''}${stats.pointDifferential} differential`} />
        <StatTile
          value={stats.serveWinPercentage === null ? '—' : `${stats.serveWinPercentage.toFixed(1)}%`}
          label="Serve-point win rate"
          sub={`${stats.servePointsWon}/${stats.servePointsPlayed} points held`}
        />
        <StatTile
          value={stats.clutchPointWinPercentage === null ? '—' : `${stats.clutchPointWinPercentage.toFixed(1)}%`}
          label="Clutch point win %"
          sub={`${stats.clutchPointsWon}/${stats.clutchPointsPlayed} clutch points`}
        />
        <StatTile value={String(stats.comebackWins)} label="Comeback wins" sub="games won after trailing by 3+" />
        <StatTile value={String(stats.momentumRuns)} label="Momentum runs" sub={`longest streak: ${stats.longestCareerStreak}`} />
        <StatTile
          value={stats.intervalCloseOutPercentage === null ? '—' : `${stats.intervalCloseOutPercentage.toFixed(1)}%`}
          label="Interval close-out rate"
          sub={`${stats.intervalLeadsConverted}/${stats.intervalLeads} leads converted`}
        />
        <StatTile value={String(stats.matchesPlayed)} label="Matches played" sub="singles & doubles, non-TEAM" />
      </div>

      <div className="mb-8">
        <h4 className="font-extrabold text-[1.05rem] text-text-primary mb-3">Record by format</h4>
        <div className="overflow-x-auto border border-border rounded-2xl">
          <table className="w-full border-collapse text-[0.85rem] min-w-[480px]">
            <thead>
              <tr>
                {['Format', 'Played', 'Won', 'Lost'].map((h, i) => (
                  <th
                    key={h}
                    className={`text-left py-2.5 px-3.5 border-b border-border-soft text-text-muted text-[0.7rem] tracking-wide uppercase bg-surface-1 ${
                      i > 0 ? 'text-right mono' : ''
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FORMAT_ORDER.map((code) => {
                const rec = stats.byFormat[code];
                return (
                  <tr key={code}>
                    <td className="py-2.5 px-3.5 border-b border-border-soft">{EVENT_LABEL[code]}</td>
                    <td className="py-2.5 px-3.5 border-b border-border-soft text-right mono">{rec.played}</td>
                    <td className="py-2.5 px-3.5 border-b border-border-soft text-right mono">{rec.won}</td>
                    <td className="py-2.5 px-3.5 border-b border-border-soft text-right mono">{rec.lost}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-8">
        <h4 className="font-extrabold text-[1.05rem] text-text-primary mb-3">Coming soon</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <ComingSoonCard title="Winners / unforced errors" reason={profile.placeholders.winnersUnforcedErrors.reason} />
          <ComingSoonCard title="Serve / receive stats" reason={profile.placeholders.serveReceive.reason} />
          <ComingSoonCard title="Rally length" reason={profile.placeholders.rallyLength.reason} />
        </div>
      </div>

      <div>
        <h4 className="font-extrabold text-[1.05rem] text-text-primary mb-3">Match history</h4>
        {profile.matchHistory.length === 0 ? (
          <EmptyState text="No completed matches with a real player id yet." />
        ) : (
          <div className="overflow-x-auto border border-border rounded-2xl">
            <table className="w-full border-collapse text-[0.85rem] min-w-[760px]">
              <thead>
                <tr>
                  {['Date', 'Format', 'Opponent', 'Games', 'Result', 'Video'].map((h) => (
                    <th
                      key={h}
                      className="text-left py-2.5 px-3.5 border-b border-border-soft text-text-muted text-[0.7rem] tracking-wide uppercase bg-surface-1 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profile.matchHistory.map((m) => (
                  <tr key={m.matchId}>
                    <td className="py-2.5 px-3.5 border-b border-border-soft whitespace-nowrap">
                      {m.date
                        ? new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="py-2.5 px-3.5 border-b border-border-soft whitespace-nowrap">{EVENT_LABEL[m.eventCode]}</td>
                    <td className="py-2.5 px-3.5 border-b border-border-soft">
                      <span className="font-semibold text-text-primary">{m.opponentName}</span>
                      {m.opponentCollege && <span className="text-text-muted"> · {m.opponentCollege}</span>}
                    </td>
                    <td className="py-2.5 px-3.5 border-b border-border-soft mono whitespace-nowrap">
                      {m.gameScores.map((g) => `${g.a}-${g.b}`).join(', ')}
                    </td>
                    <td className="py-2.5 px-3.5 border-b border-border-soft">
                      <span
                        className={`mono text-[0.7rem] font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${
                          m.result === 'W'
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-red-500/40 bg-red-500/10 text-red-400'
                        }`}
                      >
                        {m.result === 'W' ? 'Win' : 'Loss'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 border-b border-border-soft whitespace-nowrap">
                      <MatchVideoLinkControl matchId={m.matchId} externalVideoId={m.externalVideoId} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
