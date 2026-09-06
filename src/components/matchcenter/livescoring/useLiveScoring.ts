import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../lib/useAuth';
import {
  deleteLivePoint,
  discardLiveMatch,
  fetchResumableMatch,
  finishLiveMatch,
  revertScheduledMatch,
  saveMatchResult,
  startLiveMatch,
  startScheduledMatch,
  syncLiveGame,
  syncLivePoint,
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
    playerIdsA: [],
    playerIdsB: [],
    firstServer: 'A',
    started: false,
    games: [],
    server: 'A',
    matchWinner: null,
    log: [],
    matchId: null,
    startedFromSchedule: false,
  };
}

function loadState(): MatchState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MatchState>;
      // Normalize state saved before `matchId`/`startedFromSchedule` existed (older STORAGE_KEY
      // payloads) -- treat it as "no live row yet" / "not from schedule", which falls back to the
      // one-shot save at match end and the discard (not revert) path respectively.
      return {
        ...freshState(),
        ...parsed,
        matchId: parsed.matchId ?? null,
        startedFromSchedule: parsed.startedFromSchedule ?? false,
      };
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
  // True once `finishLiveMatch`'s point-log write has actually landed for the *current* completed
  // match -- Live Scoring defers writing `match_points` until the very end (unlike the Match KPIs
  // admin flow, which writes each point immediately via record_match_point), so `get_match_kpis`
  // would compute every KPI from an EMPTY point log if the "View Match KPIs" link appeared before
  // this resolves. Gates that link in LiveBoard; reset false on every new match.
  const [pointsSynced, setPointsSynced] = useState(false);

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

  // Same fire-and-forget contract as syncGame -- syncs one point to `match_points` the moment
  // it's scored, instead of batching the whole log into one write at match end. A dropped call
  // just leaves a gap that finishLiveMatch's reconciling upsert fills in once the match completes.
  function syncPoint(matchId: string | null, gameIndex: number, pointIndex: number, side: Side, serverSide: Side) {
    if (!matchId) return;
    syncLivePoint(matchId, { gameIndex, pointIndex, side, serverSide }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to sync live point', err);
    });
  }

  // Mirrors syncPoint for Undo -- removes the exact point being undone by its (game_index,
  // point_index) key so a dropped/late sync can never delete the wrong row.
  function unsyncPoint(matchId: string | null, gameIndex: number, pointIndex: number) {
    if (!matchId) return;
    deleteLivePoint(matchId, gameIndex, pointIndex).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to remove live point', err);
    });
  }

  function finishMatch(finalState: MatchState, winnerSide: Side | null, status: 'completed' | 'abandoned') {
    if (finalState.matchId) {
      finishLiveMatch({ matchId: finalState.matchId, winnerSide, status, log: finalState.log })
        .then(() => setPointsSynced(true))
        .catch((err) => {
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
    setPointsSynced(false);
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
      playerIdsA: setup.playerIdsA ?? [],
      playerIdsB: setup.playerIdsB ?? [],
      firstServer: setup.firstServer,
      started: true,
      games: [{ a: 0, b: 0, winner: null, intervalShown: false }],
      server: setup.firstServer,
      matchWinner: null,
      log: [],
      // Picked from Schedule: the row already exists, so its id is known up front -- no need to
      // wait on a round trip the way the ad hoc path below does.
      matchId: setup.scheduledMatchId ?? null,
      startedFromSchedule: !!setup.scheduledMatchId,
    };
    setState(nextState);

    if (setup.scheduledMatchId) {
      // Transition the existing scheduled row to in_progress instead of creating a new one --
      // this is what keeps the match's identity (and public visibility, if already published)
      // continuous from Schedule through Live Scores to Completed Matches.
      startScheduledMatch(setup.scheduledMatchId, setup.firstServer).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to start scheduled match on server', err);
        showToast("Scoring locally — couldn't start live sync");
      });
      return;
    }

    // Ad hoc path: create the live row immediately -- this is what makes the match appear on the
    // public Live Scores tab before a single point has been played.
    startLiveMatch({
      stage: setup.stage,
      format: setup.format,
      eventType: setup.eventType,
      nameA: nextState.nameA,
      nameB: nextState.nameB,
      collegeA: setup.collegeA,
      collegeB: setup.collegeB,
      sideAPlayerIds: setup.playerIdsA,
      sideBPlayerIds: setup.playerIdsB,
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

  /**
   * Picks up scoring an in-progress match from wherever it left off, regardless of which
   * device/browser started it -- see AdminLiveMatchesSection's "Resume Scoring" links.
   * fetchResumableMatch now reconstructs the real point-by-point log (from `match_points`, synced
   * live as the match was played), so this restores full Undo history and the exact server, not
   * just the running score. Throws on failure so the caller (LiveScoringSection) can toast a real
   * error instead of silently doing nothing.
   */
  async function resumeMatch(matchId: string) {
    const resumable = await fetchResumableMatch(matchId);
    generationRef.current++; // invalidate any in-flight ad hoc startLiveMatch this device had pending
    setPointsSynced(false);
    const nextState: MatchState = {
      ...state,
      stage: resumable.stage,
      format: resumable.format,
      eventType: resumable.eventType,
      nameA: resumable.nameA,
      nameB: resumable.nameB,
      collegeA: resumable.collegeA,
      collegeB: resumable.collegeB,
      playersA: [],
      playersB: [],
      playerIdsA: resumable.playerIdsA,
      playerIdsB: resumable.playerIdsB,
      firstServer: resumable.firstServer,
      started: true,
      games: resumable.games,
      server: resumable.server,
      matchWinner: resumable.matchWinner,
      log: resumable.log,
      matchId: resumable.matchId,
      startedFromSchedule: false,
    };
    setState(nextState);

    // Edge case: the match was already effectively won (enough games synced to match_games) but
    // the status flip to 'completed' never made it to the server -- e.g. the original device lost
    // its connection or the tab closed right after the winning point. Finish it properly now
    // rather than leaving the match stuck showing a "Match Winner" overlay that never actually
    // completes the row server-side.
    if (resumable.matchWinner) {
      finishMatch(nextState, resumable.matchWinner, 'completed');
    }
  }

  function scorePoint(side: Side) {
    if (state.matchWinner) return;
    const games = state.games.map((g) => ({ ...g }));
    const g = games[games.length - 1];
    if (!g || g.winner) return;

    const gameIndex = games.length - 1;
    // 1-based within-game point index, matching toPointsRows' convention exactly -- the count of
    // this game's points already in the log, plus the one being added now.
    const pointIndex = state.log.filter((e) => e.gameIndex === gameIndex).length + 1;
    const prevServer = state.server;
    const log = [...state.log, { gameIndex, side, prevServer }];
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

    syncGame(nextState.matchId, gameIndex, g);
    syncPoint(nextState.matchId, gameIndex, pointIndex, side, prevServer);
    if (matchWinner) finishMatch(nextState, matchWinner, 'completed');
  }

  function undo() {
    if (state.log.length === 0) return;
    const log = [...state.log];
    const entry = log.pop()!;
    // The point index it was synced under -- same 1-based-within-game convention as scorePoint,
    // computed from what's left in the log after popping this entry off.
    const removedPointIndex = log.filter((e) => e.gameIndex === entry.gameIndex).length + 1;
    const games = state.games.map((g) => ({ ...g }));
    const g = games[entry.gameIndex];
    if (entry.side === 'A') g.a = Math.max(0, g.a - 1);
    else g.b = Math.max(0, g.b - 1);
    g.winner = null;
    const nextState = { ...state, games, server: entry.prevServer, matchWinner: null, log };
    setState(nextState);
    syncGame(nextState.matchId, entry.gameIndex, g);
    unsyncPoint(nextState.matchId, entry.gameIndex, removedPointIndex);
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
    setPointsSynced(false);
  }

  function endMatch() {
    if (!window.confirm('End this match now? Current progress will be cleared.')) return;
    // Belt-and-suspenders: resumeMatch() now restores the real log via fetchResumableMatch, so
    // `log.length` alone is normally accurate even for a resumed match. Still also checking the
    // actual game scores costs nothing and guards against any future path that legitimately ends
    // up with a nonempty score but an empty local log.
    const hasProgress = state.log.length > 0 || state.games.some((g) => g.a > 0 || g.b > 0);
    if (state.started && hasProgress && !state.matchWinner) {
      // Only worth recording if at least one point was actually scored -- an empty stub match
      // (started, then immediately ended) has nothing to say about anyone's performance.
      finishMatch(state, null, 'abandoned');
    } else if (state.started && state.matchId && !hasProgress) {
      if (state.startedFromSchedule) {
        // This row is admin's Schedule data (possibly already published), not one created just
        // for this live session -- put it back to `scheduled` rather than deleting it.
        revertScheduledMatch(state.matchId).catch((err) => {
          // eslint-disable-next-line no-console
          console.error('Failed to revert scheduled match', err);
        });
      } else {
        // A live row was already created (match started) but nothing was ever scored -- remove
        // it rather than stranding an empty `in_progress` row on Live Scores forever.
        discardLiveMatch(state.matchId).catch((err) => {
          // eslint-disable-next-line no-console
          console.error('Failed to discard empty live match', err);
        });
      }
    }
    newMatch();
  }

  return {
    state,
    toast,
    gamesNeeded,
    currentGame,
    pointsSynced,
    gamesWonCount: (side: Side) => gamesWonCount(state.games, side),
    startMatch,
    resumeMatch,
    scorePoint,
    undo,
    nextGame,
    newMatch,
    endMatch,
  };
}
