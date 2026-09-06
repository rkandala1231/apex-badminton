import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast as notify } from 'sonner';
import { LiveBoard } from './livescoring/LiveBoard';
import { SetupScreen } from './livescoring/SetupScreen';
import { useLiveScoring } from './livescoring/useLiveScoring';

export function LiveScoringSection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const resumeId = searchParams.get('resume');
  // Guards against re-handling the same ?resume=<id> on every re-render (setSearchParams below
  // strips it, but that update isn't synchronous) and against re-firing after the user has
  // declined to switch away from a different match already active on this device.
  const handledResumeId = useRef<string | null>(null);

  const {
    state,
    toast: liveToast,
    gamesNeeded,
    gamesWonCount,
    pointsSynced,
    startMatch,
    resumeMatch,
    scorePoint,
    undo,
    nextGame,
    newMatch,
    endMatch,
  } = useLiveScoring();

  // Picking up ?resume=<matchId> (from AdminLiveMatchesSection's "Resume Scoring" links) --
  // clears the query param once handled either way, so navigating here again with no param
  // doesn't retrigger it.
  useEffect(() => {
    if (!resumeId || handledResumeId.current === resumeId) return;

    if (state.started && state.matchId !== resumeId) {
      const ok = window.confirm(
        "You're currently scoring a different match on this device. Switch to this one instead? " +
          'The other match stays in progress in the database and can be resumed later the same way.'
      );
      if (!ok) {
        handledResumeId.current = resumeId;
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete('resume');
            return next;
          },
          { replace: true }
        );
        return;
      }
    }

    handledResumeId.current = resumeId;
    resumeMatch(resumeId)
      .then(() => notify.success('Resumed — pick up scoring where it left off.'))
      .catch((err) => notify.error(err instanceof Error ? err.message : 'Could not resume that match.'))
      .finally(() => {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete('resume');
            return next;
          },
          { replace: true }
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId]);

  // Keyboard shortcuts while a match is live: A / B to score, Z to undo.
  useEffect(() => {
    if (!state.started) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'a' || e.key === 'A') scorePoint('A');
      if (e.key === 'b' || e.key === 'B') scorePoint('B');
      if (e.key === 'z' || e.key === 'Z') undo();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.started, state.games, state.log, state.matchWinner, state.server]);

  return (
    <div>
      <h1 className="text-[1.8rem] mb-1.5">Live Scoring</h1>
      <p className="text-[0.95rem] mb-5 max-w-[60ch]">
        Court-side scorekeeping for tournament staff — BWF-style rally-point scoring, scaled to a
        15-point game. Scoring itself always works from this device, even offline; the score
        syncs to the server as you go, live on the public Match Center, and the match moves to
        Completed Matches the moment it finishes (or is ended early).
      </p>

      {state.started ? (
        <LiveBoard
          state={state}
          toast={liveToast}
          gamesNeeded={gamesNeeded}
          gamesWonCount={gamesWonCount}
          pointsSynced={pointsSynced}
          onScore={scorePoint}
          onUndo={undo}
          onEnd={endMatch}
          onNextGame={nextGame}
          onNewMatch={newMatch}
        />
      ) : (
        <SetupScreen onStart={startMatch} />
      )}
    </div>
  );
}
