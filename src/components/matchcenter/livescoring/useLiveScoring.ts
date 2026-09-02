import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../lib/useAuth';
import { saveMatchResult } from '../../../lib/matchStats';
import { HARD_CAP, INTERVAL_AT, POINTS_TO_WIN, STORAGE_KEY, WIN_BY } from './constants';
import type { GameState, MatchState, Side, StartSetup } from './types';

function freshState(): MatchState {
  return {
    stage: 'roundrobin',
    format: 'single',
    eventType: 'MS',
    nameA: '',
    nameB: '',
    collegeA: null,
    collegeB: null,
    playersA: [],
    playersB: [],
    firstServer: 'A',
    started: false,
    games: [],
    server: 'A',
    matchWinner: null,
    log: [],
  };
}

function loadState(): MatchState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MatchState;
  } catch {
    // localStorage unavailable — start fresh.
  }
  return null;
}

function saveState(state: MatchState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable — nothing to persist.
  }
}

function checkGameWinner(a: number, b: number): Side | null {
  if (a >= HARD_CAP || b >= HARD_CAP) return a > b ? 'A' : 'B';
  if ((a >= POINTS_TO_WIN || b >= POINTS_TO_WIN) && Math.abs(a - b) >= WIN_BY) return a > b ? 'A' : 'B';
  return null;
}

function gamesWonCount(games: GameState[], side: Side) {
  return games.filter((g) => g.winner === side).length;
}

export function useLiveScoring() {
  const { user } = useAuth();
  const [state, setState] = useState<MatchState>(() => loadState() ?? freshState());
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }

  const gamesNeeded = state.format === 'bo3' ? 2 : 1;
  const currentGame = state.started ? state.games[state.games.length - 1] : null;

  // Fire-and-forget save to Supabase. Never blocks local scoring -- this runs court-side and
  // must keep working through a flaky connection; a failure just surfaces as a toast so staff
  // know the result didn't make it to the server this time.
  function persistResult(finalState: MatchState, winnerSide: Side | null, status: 'completed' | 'abandoned') {
    saveMatchResult({ state: finalState, winnerSide, status, scoredBy: user?.id ?? null }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to save match result', err);
      showToast(status === 'completed' ? "Saved locally — couldn't sync result to server" : "Couldn't sync abandoned match to server");
    });
  }

  function startMatch(setup: StartSetup) {
    setState({
      ...state,
      stage: setup.stage,
      format: setup.format,
      eventType: setup.eventType,
      nameA: setup.nameA.trim() || 'Side A',
      nameB: setup.nameB.trim() || 'Side B',
      collegeA: setup.collegeA,
      collegeB: setup.collegeB,
      playersA: setup.playersA,
      playersB: setup.playersB,
      firstServer: setup.firstServer,
      started: true,
      games: [{ a: 0, b: 0, winner: null, intervalShown: false }],
      server: setup.firstServer,
      matchWinner: null,
      log: [],
    });
  }

  function scorePoint(side: Side) {
    if (state.matchWinner) return;
    const games = state.games.map((g) => ({ ...g }));
    const g = games[games.length - 1];
    if (!g || g.winner) return;

    const log = [...state.log, { gameIndex: games.length - 1, side, prevServer: state.server }];
    if (side === 'A') g.a += 1;
    else g.b += 1;

    const leader = Math.max(g.a, g.b);
    let intervalMsg: string | null = null;
    if (!g.intervalShown && leader === INTERVAL_AT) {
      g.intervalShown = true;
      intervalMsg = `Interval — ${INTERVAL_AT} points`;
    }

    const winnerSide = checkGameWinner(g.a, g.b);
    let matchWinner: Side | null = null;
    if (winnerSide) {
      g.winner = winnerSide;
      const wins = gamesWonCount(games, winnerSide);
      if (wins >= gamesNeeded) matchWinner = winnerSide;
    }

    const nextState = { ...state, games, server: side, log, matchWinner };
    setState(nextState);
    if (intervalMsg) showToast(intervalMsg);
    if (matchWinner) persistResult(nextState, matchWinner, 'completed');
  }

  function undo() {
    if (state.log.length === 0) return;
    const log = [...state.log];
    const entry = log.pop()!;
    const games = state.games.map((g) => ({ ...g }));
    const g = games[entry.gameIndex];
    if (entry.side === 'A') g.a = Math.max(0, g.a - 1);
    else g.b = Math.max(0, g.b - 1);
    g.winner = null;
    setState({ ...state, games, server: entry.prevServer, matchWinner: null, log });
  }

  function nextGame() {
    if (!currentGame?.winner || state.matchWinner) return;
    const games = [...state.games];
    const prevWinner = games[games.length - 1].winner;
    games.push({ a: 0, b: 0, winner: null, intervalShown: false });
    setState({ ...state, games, server: prevWinner ?? state.server });
    showToast(`Change ends — Game ${games.length}`);
  }

  function newMatch() {
    const kept = { stage: state.stage, format: state.format, eventType: state.eventType };
    setState({ ...freshState(), ...kept });
  }

  function endMatch() {
    if (!window.confirm('End this match now? Current progress will be cleared.')) return;
    // Only worth recording if at least one point was actually scored -- an empty stub match
    // (started, then immediately ended) has nothing to say about anyone's performance.
    if (state.started && state.log.length > 0 && !state.matchWinner) {
      persistResult(state, null, 'abandoned');
    }
    newMatch();
  }

  return {
    state,
    toast,
    gamesNeeded,
    currentGame,
    gamesWonCount: (side: Side) => gamesWonCount(state.games, side),
    startMatch,
    scorePoint,
    undo,
    nextGame,
    newMatch,
    endMatch,
  };
}
