import { useEffect } from 'react';
import { LiveBoard } from './livescoring/LiveBoard';
import { SetupScreen } from './livescoring/SetupScreen';
import { useLiveScoring } from './livescoring/useLiveScoring';

export function LiveScoringSection() {
  const { state, toast, gamesNeeded, gamesWonCount, startMatch, scorePoint, undo, nextGame, newMatch, endMatch } =
    useLiveScoring();

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
        15-point game. Runs on this device only; nothing here is shared until the match is entered
        into the schedule.
      </p>

      {state.started ? (
        <LiveBoard
          state={state}
          toast={toast}
          gamesNeeded={gamesNeeded}
          gamesWonCount={gamesWonCount}
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
