import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { COLLEGES, type CollegeName } from '../../lib/matchCenterData';
import { EVENT_META, type EventCode } from '../../lib/types';
import { SCORING_PRESETS, type ScoringPresetKey, type Side } from '../../lib/kpi/types';
import {
  useCreateMatch,
  useMatchKpis,
  useRecordPoint,
  useUndoPoint,
  useCompleteMatch,
  useGenerateSyntheticData,
  useDeleteSyntheticData,
} from '../../lib/queries';
import { SubTabs } from '../matchcenter/shared';

const inputCls = 'bg-surface-2 border border-border rounded-md px-3 py-2.5 text-text-primary text-[0.88rem] w-full';
const labelCls = 'text-[0.78rem] font-bold text-text-secondary block mb-1.5';

type Tab = 'score' | 'test-data';

// Same pattern as MatchKpiDashboard's VIEW_KEY: sessionStorage so the "View full KPIs" link
// survives a refresh or navigating away and back within the same tab, without needing a backend
// "recent matches" list. Cleared once you start scoring a different match ("Score another
// match"), so it never points at a stale match indefinitely.
const ACTIVE_MATCH_KEY = 'apex-kpi-active-match';

function initialActiveMatchId(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_MATCH_KEY);
  } catch {
    // sessionStorage can throw in some contexts (private browsing, etc) -- fall back silently.
    return null;
  }
}

export function AdminMatchKpiSection() {
  const [tab, setTab] = useState<Tab>('score');
  const [activeMatchId, setActiveMatchId] = useState<string | null>(initialActiveMatchId);

  const setActiveMatch = (matchId: string | null) => {
    setActiveMatchId(matchId);
    try {
      if (matchId) sessionStorage.setItem(ACTIVE_MATCH_KEY, matchId);
      else sessionStorage.removeItem(ACTIVE_MATCH_KEY);
    } catch {
      // Non-fatal -- it just won't survive a refresh this session.
    }
  };

  return (
    <div>
      <h1 className="text-[1.8rem] mb-1.5">Match KPIs</h1>
      <p className="text-[0.95rem] mb-5 max-w-[70ch] text-text-secondary">
        Score a match by point, and every viewer gets Match Result, Point-Win %, Point Differential,
        Longest Streak, and Clutch-Point Win Rate automatically once it's complete.
      </p>

      <SubTabs
        tabs={[
          { id: 'score', label: 'Score a Match' },
          { id: 'test-data', label: 'Test Data' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      <div className="mt-5">
        {tab === 'score' &&
          (activeMatchId ? (
            <ScoringBoard matchId={activeMatchId} onDone={() => setActiveMatch(null)} />
          ) : (
            <NewMatchForm onCreated={setActiveMatch} />
          ))}
        {tab === 'test-data' && <TestDataControls />}
      </div>
    </div>
  );
}

function NewMatchForm({ onCreated }: { onCreated: (matchId: string) => void }) {
  const createMatch = useCreateMatch();
  const [eventCode, setEventCode] = useState<EventCode>('MS');
  const [collegeA, setCollegeA] = useState<CollegeName>(COLLEGES[0]);
  const [collegeB, setCollegeB] = useState<CollegeName>(COLLEGES[1]);
  const [sideAName, setSideAName] = useState('');
  const [sideBName, setSideBName] = useState('');
  const [preset, setPreset] = useState<ScoringPresetKey>('standard21');
  const [bestOfGames, setBestOfGames] = useState(3);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sideAName.trim() || !sideBName.trim()) {
      toast.error('Enter a name for both sides.');
      return;
    }
    if (collegeA === collegeB) {
      toast.error('Pick two different colleges.');
      return;
    }
    const format = SCORING_PRESETS[preset];
    createMatch.mutate(
      {
        eventCode,
        stage: 'roundrobin',
        collegeA,
        collegeB,
        sideAName: sideAName.trim(),
        sideBName: sideBName.trim(),
        targetPoints: format.targetPoints,
        winByTwo: format.winByTwo,
        maxPoints: format.maxPoints,
        bestOfGames,
        firstServer: 'A',
      },
      {
        onSuccess: (matchId) => {
          toast.success('Match created — start scoring below.');
          onCreated(matchId);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not create the match.'),
      }
    );
  };

  return (
    <form onSubmit={onSubmit} className="bg-surface-1 border border-border rounded-2xl p-5 max-w-[520px] flex flex-col gap-4">
      <div>
        <label className={labelCls}>Event</label>
        <select value={eventCode} onChange={(e) => setEventCode(e.target.value as EventCode)} className={inputCls}>
          {EVENT_META.map((e) => (
            <option key={e.code} value={e.code}>{e.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Side A college</label>
          <select value={collegeA} onChange={(e) => setCollegeA(e.target.value as CollegeName)} className={inputCls}>
            {COLLEGES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Side B college</label>
          <select value={collegeB} onChange={(e) => setCollegeB(e.target.value as CollegeName)} className={inputCls}>
            {COLLEGES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Side A name(s)</label>
          <input value={sideAName} onChange={(e) => setSideAName(e.target.value)} placeholder="e.g. Ramesh/Naveen" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Side B name(s)</label>
          <input value={sideBName} onChange={(e) => setSideBName(e.target.value)} placeholder="e.g. Srini/Pradeep" className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Scoring format</label>
        <select value={preset} onChange={(e) => setPreset(e.target.value as ScoringPresetKey)} className={inputCls}>
          <option value="standard21">Standard 21 — win by two, capped at 30</option>
          <option value="apex15">APEX 15 — first to 15, no win-by-two</option>
        </select>
      </div>

      <div>
        <label className={labelCls}>Best of</label>
        <select value={bestOfGames} onChange={(e) => setBestOfGames(Number(e.target.value))} className={inputCls}>
          <option value={1}>1 game</option>
          <option value={3}>3 games</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={createMatch.isPending}
        className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-[0.85rem] px-5 py-2.5 bg-accent text-[#0c0a08] hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        {createMatch.isPending ? 'Creating…' : 'Create match & start scoring'}
      </button>
    </form>
  );
}

function ScoringBoard({ matchId, onDone }: { matchId: string; onDone: () => void }) {
  const { data: kpis, isLoading, isError } = useMatchKpis(matchId);
  const recordPoint = useRecordPoint();
  const undoPoint = useUndoPoint();
  const completeMatch = useCompleteMatch();
  const [confirmingComplete, setConfirmingComplete] = useState(false);

  // A matchId recovered from a prior session (see ACTIVE_MATCH_KEY) can point at a match that no
  // longer resolves -- without this, that would otherwise get stuck on the loading skeleton below
  // forever, since isLoading turns false but kpis stays undefined.
  if (isError) {
    return (
      <div className="bg-surface-1 border border-border rounded-2xl p-6 max-w-[560px] flex flex-col gap-3">
        <p className="text-[0.85rem] text-text-secondary">Couldn&apos;t load that match anymore.</p>
        <button
          onClick={onDone}
          className="self-start rounded-full bg-accent text-[#0c0a08] font-bold text-[0.82rem] px-4 py-2"
        >
          Start a new match
        </button>
      </div>
    );
  }

  if (isLoading || !kpis) {
    return <div className="h-64 bg-surface-1 border border-border rounded-2xl animate-pulse" />;
  }

  const current = kpis.gameScores[kpis.gameScores.length - 1];
  const gamesWonA = kpis.gameScores.filter((g) => g.winner === 'A').length;
  const gamesWonB = kpis.gameScores.filter((g) => g.winner === 'B').length;
  const requiredWins = Math.floor(kpis.bestOfGames / 2) + 1;
  const readyToComplete = gamesWonA >= requiredWins || gamesWonB >= requiredWins;
  const isCompleted = kpis.status === 'completed';

  const score = (side: Side) => {
    recordPoint.mutate(
      { matchId, side },
      { onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not record that point.') }
    );
  };

  return (
    <div className="bg-surface-1 border border-border rounded-2xl p-6 max-w-[560px]">
      <div className="flex items-center justify-between mb-1">
        <span className="mono text-[0.72rem] text-text-muted uppercase">
          {isCompleted ? 'Completed' : `Game ${(current?.game ?? 1)} of up to ${kpis.bestOfGames}`}
        </span>
        <span className="mono text-[0.72rem] text-text-muted">
          {gamesWonA}–{gamesWonB} games
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 my-5">
        <div className="text-center flex-1">
          <div className="font-bold text-side-a mb-1 truncate">{kpis.sideAName}</div>
          <div className="mono text-4xl font-bold text-side-a">{current?.sideA ?? 0}</div>
        </div>
        <div className="text-text-muted font-display text-xl">–</div>
        <div className="text-center flex-1">
          <div className="font-bold text-side-b mb-1 truncate">{kpis.sideBName}</div>
          <div className="mono text-4xl font-bold text-side-b">{current?.sideB ?? 0}</div>
        </div>
      </div>

      {kpis.gameScores.length > 1 && (
        <div className="flex gap-1.5 justify-center mb-5 flex-wrap">
          {kpis.gameScores.map((g) => (
            <span key={g.game} className="mono text-[0.72rem] px-2 py-1 rounded-md bg-surface-2 text-text-muted">
              {g.sideA}–{g.sideB}
            </span>
          ))}
        </div>
      )}

      {!isCompleted && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => score('A')}
              disabled={recordPoint.isPending || readyToComplete}
              className="rounded-xl border-2 border-side-a bg-side-a-soft text-side-a font-bold py-4 text-[0.9rem] disabled:opacity-40"
            >
              Side A won point
            </button>
            <button
              onClick={() => score('B')}
              disabled={recordPoint.isPending || readyToComplete}
              className="rounded-xl border-2 border-side-b bg-side-b-soft text-side-b font-bold py-4 text-[0.9rem] disabled:opacity-40"
            >
              Side B won point
            </button>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => undoPoint.mutate(matchId, { onError: (err) => toast.error(err instanceof Error ? err.message : 'Nothing to undo.') })}
              disabled={undoPoint.isPending}
              className="rounded-full border border-border text-text-secondary hover:text-text-primary font-bold text-[0.78rem] px-4 py-2"
            >
              Undo last point
            </button>

            {readyToComplete &&
              (confirmingComplete ? (
                <>
                  <span className="text-[0.78rem] text-text-muted self-center">Finalize this match?</span>
                  <button
                    onClick={() =>
                      completeMatch.mutate(matchId, {
                        onSuccess: () => toast.success('Match completed.'),
                        onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not complete the match.'),
                      })
                    }
                    disabled={completeMatch.isPending}
                    className="rounded-full bg-accent text-[#0c0a08] font-bold text-[0.78rem] px-4 py-2"
                  >
                    Yes, complete match
                  </button>
                  <button onClick={() => setConfirmingComplete(false)} className="rounded-full border border-border text-text-secondary font-bold text-[0.78rem] px-4 py-2">
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmingComplete(true)}
                  className="rounded-full bg-accent text-[#0c0a08] font-bold text-[0.78rem] px-4 py-2"
                >
                  Complete match
                </button>
              ))}
          </div>
        </>
      )}

      {isCompleted && (
        <div className="flex items-center gap-3">
          <Link to={`/match-center/match/${matchId}`} className="rounded-full bg-accent text-[#0c0a08] font-bold text-[0.82rem] px-5 py-2.5 no-underline">
            View full KPIs →
          </Link>
          <button onClick={onDone} className="rounded-full border border-border text-text-secondary font-bold text-[0.78rem] px-4 py-2">
            Score another match
          </button>
        </div>
      )}
    </div>
  );
}

function TestDataControls() {
  const generate = useGenerateSyntheticData();
  const del = useDeleteSyntheticData();

  return (
    <div className="bg-surface-1 border border-border rounded-2xl p-5 max-w-[560px]">
      <h3 className="text-[0.95rem] mb-2">Synthetic test data</h3>
      <p className="text-[0.82rem] text-text-secondary mb-4">
        Generates 20 synthetic players and 30 completed matches (singles/doubles, both scoring
        presets, straight-game and three-game results, deuce games, and matches with and without
        clutch situations) with a fixed seed, so the KPI dashboard has real data to try. Blocked at
        the database level unless a super_admin has explicitly enabled it for this project — never
        enabled on prod.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() =>
            generate.mutate(undefined, {
              onSuccess: (r) => toast.success(`Created ${r.playersCreated} players and ${r.matchesCreated} matches.`),
              onError: (err) => toast.error(err instanceof Error ? err.message : 'Synthetic data generation failed.'),
            })
          }
          disabled={generate.isPending}
          className="rounded-full bg-accent text-[#0c0a08] font-bold text-[0.82rem] px-4 py-2.5 disabled:opacity-50"
        >
          {generate.isPending ? 'Generating…' : 'Generate synthetic data'}
        </button>
        <button
          onClick={() =>
            del.mutate(undefined, {
              onSuccess: (r) => toast.success(`Deleted ${r.matchesDeleted} matches and ${r.playersDeleted} players.`),
              onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not delete synthetic data.'),
            })
          }
          disabled={del.isPending}
          className="rounded-full border border-border text-text-secondary hover:text-text-primary font-bold text-[0.82rem] px-4 py-2.5 disabled:opacity-50"
        >
          {del.isPending ? 'Deleting…' : 'Delete synthetic data'}
        </button>
      </div>
    </div>
  );
}
