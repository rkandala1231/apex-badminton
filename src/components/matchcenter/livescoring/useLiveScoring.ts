import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../lib/useAuth';
import {
  discardLiveMatch,
  finishLiveMatch,
  saveMatchResult,
  startLiveMatch,
  syncLiveGame,
} from '../../../lib/matchStats';
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
    matchId: null,
  };
}

function loadState(): MatchState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MatchState>;
      // Normalize state saved before `matchId` existed (older STORAGE_KEY payloads) --
      // treat it as "no live row yet", which falls back to the one-shot save at match end.
      return { ...freshState(), ...parsed, matchId: parsed.matchId ?? null };
    }
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
  // Bumped on every startMatch call so a slow/late startLiveMatch response from a match the
  // scorer has already left (started a new one, or backed out) can't attach its id to the
  // wrong match.
  const generationRef = useRef(0);

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

  // Fire-and-forget: never blocks local scoring, since this runs court-side and must keep
  // working through a flaky connection. A failure just surfaces as a toast so staff know the
  // live score or final result didn't make it to the server this time.
  function syncGame(matchId: string | null, gameIndex: number, g: GameState) {
    if (!matchId) return;
    syncLiveGame(matchId, { index: gameIndex, a: g.a, b: g.b, winner: g.winner }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to sync live score', err);
    });
  }

  function finishMatch(finalState: MatchState, winnerSide: Side | null, status: 'completed' | 'abandoned') {
    if (finalState.matchId) {
      finishLiveMatch({ matchId: finalState.matchId, winnerSide, status, log: finalState.log }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to finish live match', err);
        showToast(status === 'completed' ? "Saved locally — couldn't sync final result to server" : "Couldn't sync abandoned match to server");
      });
    } else {
      // No live row ever got created (e.g. the device was offline right when the match started)
      // -- fall back to saving the whole match in one shot, same as before Live Scores existed.
      saveMatchResult({ state: finalState, winnerSide, status, scoredBy: user?.id ?? null }).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to save match result', err);
        showToast(status === 'completed' ? "Saved locally — couldn't sync result to server" : "Couldn't sync abandoned match to server");
      });
    }
  }

  function startMatch(setup: StartSetup) {
    const myGeneration = ++generationRef.current;
    const nextState: MatchState = {
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
      matchId: null,
    };
    setState(nextState);

    // Create the live row immediately -- this is what makes the match appear on the public Live
    // Scores tab before a single point has been played.
    startLiveMatch({
      stage: setup.stage,
      format: setup.format,
      eventType: setup.eventType,
      nameA: nextState.nameA,
      nameB: nextState.nameB,
      collegeA: setup.collegeA,
      collegeB: setup.collegeB,
      firstServer: setup.firstServer,
      scoredBy: user?.id ?? null,
    })
      .then((id) => {
        if (generationRef.current !== myGeneration) return; // scorer already moved on
        setState((prev) => {
          if (prev.matchId !== null || !prev.started) return prev;
          const g = prev.games[prev.games.length - 1];
          if (g) syncGame(id, prev.games.length - 1, g); // backfill whatever's been scored since
          return { ...prev, matchId: id };
        });
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to start live match on server', err);
        showToast("Scoring locally — couldn't start live sync");
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

    syncGame(nextState.matchId, games.length - 1, g);
    if (matchWinner) finishMatch(nextState, matchWinner, 'completed');
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
    const nextState = { ...state, games, server: entry.prevServer, matchWinner: null, log };
    setState(nextState);
    syncGame(nextState.matchId, entry.gameIndex, g);
  }

  function nextGame() {
    if (!currentGame?.winner || state.matchWinner) return;
    const games = [...state.games];
    const prevWinner = games[games.length - 1].winner;
    const newGame: GameState = { a: 0, b: 0, winner: null, intervalShown: false };
    games.push(newGame);
    const nextState = { ...state, games, server: prevWinner ?? state.server };
    setState(nextState);
    showToast(`Change ends — Game ${games.length}`);
    syncGame(nextState.matchId, games.length - 1, newGame);
  }

  function newMatch() {
    const kept = { stage: state.stage, format: state.format, eventType: state.eventType };
    setState({ ...freshState(), ...kept });
  }

  function endMatch() {
    if (!window.confirm('End this match now? Current progress will be cleared.')) return;
    if (state.started && state.log.length > 0 && !state.matchWinner) {
      // Only worth recording if at least one point was actually scored -- an empty stub match
      // (started, then immediately ended) has nothing to say about anyone's performance.
      finishMatch(state, null, 'abandoned');
    } else if (state.started && state.matchId && state.log.length === 0) {
      // A live row was already created (match started) but nothing was ever scored -- remove
      // it rather than stranding an empty `in_progress` row on Live Scores forever.
      discardLiveMatch(state.matchId).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to discard empty live match', err);
      });
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
