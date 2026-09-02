import type { ReactNode } from 'react';
import type { MatchState, Side } from './types';

export function LiveBoard({
  state,
  toast,
  gamesNeeded,
  gamesWonCount,
  onScore,
  onUndo,
  onEnd,
  onNextGame,
  onNewMatch,
}: {
  state: MatchState;
  toast: string | null;
  gamesNeeded: number;
  gamesWonCount: (side: Side) => number;
  onScore: (side: Side) => void;
  onUndo: () => void;
  onEnd: () => void;
  onNextGame: () => void;
  onNewMatch: () => void;
}) {
  const g = state.games[state.games.length - 1];
  if (!g) return null;

  const gameOver = !!g.winner && !state.matchWinner;
  const matchOver = !!state.matchWinner;

  return (
    <div className="max-w-[560px]">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Pill>{state.stage === 'knockout' ? 'Knockout' : 'Round Robin'}</Pill>
        <Pill>{state.format === 'bo3' ? 'Best of 3' : 'Single Game'}</Pill>
        <Pill gold>{state.eventType}</Pill>
        <Pill>{gamesNeeded === 1 ? 'Race to 15' : `Game ${state.games.length} of 3`}</Pill>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <ScorePanel
          side="A"
          name={state.nameA}
          college={state.eventType !== 'TEAM' ? state.collegeA : null}
          score={g.a}
          serving={state.server === 'A'}
          gamesNeeded={gamesNeeded}
          gamesWon={gamesWonCount('A')}
          disabled={gameOver || matchOver}
          onTap={() => onScore('A')}
        />
        <ScorePanel
          side="B"
          name={state.nameB}
          college={state.eventType !== 'TEAM' ? state.collegeB : null}
          score={g.b}
          serving={state.server === 'B'}
          gamesNeeded={gamesNeeded}
          gamesWon={gamesWonCount('B')}
          disabled={gameOver || matchOver}
          onTap={() => onScore('B')}
        />
      </div>

      <div className="flex gap-2.5 mt-4">
        <button
          type="button"
          onClick={onUndo}
          className="flex-1 text-center bg-transparent border border-border rounded-lg px-3.5 py-2.5 text-text-secondary font-bold text-[0.82rem] hover:border-text-muted hover:text-text-primary transition-colors"
        >
          ↺ Undo last point
        </button>
        <button
          type="button"
          onClick={onEnd}
          className="flex-1 text-center bg-transparent border border-border rounded-lg px-3.5 py-2.5 text-text-secondary font-bold text-[0.82rem] hover:border-text-muted hover:text-text-primary transition-colors"
        >
          End match
        </button>
      </div>

      <details className="bg-surface-1 border border-border-soft rounded-2xl p-5 mt-4 [&_summary]:list-none [&_summary::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer flex items-center justify-between font-bold text-[0.88rem] text-text-primary">
          How the scoring works
          <span className="mono text-accent text-[1.1rem]">+</span>
        </summary>
        <div className="mt-3.5 flex flex-col gap-2.5">
          <RuleRow k="Points" v="Rally-point scoring — every rally wins a point, regardless of who served." />
          <RuleRow k="Game win" v="First to 15 points with a 2-point lead. Tied at 14-14, play continues until one side leads by 2 — or reaches 16, which wins outright." />
          <RuleRow k="Interval" v="A break is called when either side first reaches 8 points in a game." />
          <RuleRow
            k="Match win"
            v={state.format === 'bo3' ? 'Best of 3: first side to win 2 games takes the match.' : 'Single Game: one game decides it.'}
          />
          <RuleRow k="Serve" v="Whoever wins the rally serves next. The winner of a completed game serves first in the next one." />
        </div>
      </details>

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-6 bg-surface-3 border border-border text-text-primary px-4.5 py-2.5 rounded-full text-[0.84rem] font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.4)] z-20 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-gold" />
          {toast}
        </div>
      )}

      {gameOver && (
        <Overlay>
          <div className="eyebrow mb-0">Game Complete</div>
          <h2 className="text-[1.7rem] mt-2 mb-1">{g.winner === 'A' ? state.nameA : state.nameB}</h2>
          <div className="mono text-[0.9rem] text-text-secondary mb-4.5">
            {g.a}–{g.b}
          </div>
          <button
            type="button"
            onClick={onNextGame}
            className="w-full bg-accent text-[#08211a] rounded-xl py-3.5 font-extrabold text-[0.98rem] uppercase tracking-wide hover:bg-accent-hover transition-colors"
          >
            Start Next Game
          </button>
        </Overlay>
      )}

      {matchOver && (
        <Overlay>
          <div className="eyebrow mb-0">Match Winner</div>
          <h2 className="text-[1.7rem] mt-2 mb-1">{state.matchWinner === 'A' ? state.nameA : state.nameB}</h2>
          <div className="flex flex-col gap-1.5 my-3.5">
            {state.games.map((gm, i) => (
              <div key={i} className="mono text-[0.82rem] text-text-secondary flex justify-between px-2.5 py-1.5 bg-surface-2 rounded-lg">
                <span>Game {i + 1}</span>
                <span>
                  {gm.a}–{gm.b}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onNewMatch}
            className="w-full bg-accent text-[#08211a] rounded-xl py-3.5 font-extrabold text-[0.98rem] uppercase tracking-wide hover:bg-accent-hover transition-colors mt-2.5"
          >
            New Match
          </button>
        </Overlay>
      )}
    </div>
  );
}

function ScorePanel({
  side,
  name,
  college,
  score,
  serving,
  gamesNeeded,
  gamesWon,
  disabled,
  onTap,
}: {
  side: Side;
  name: string;
  college?: string | null;
  score: number;
  serving: boolean;
  gamesNeeded: number;
  gamesWon: number;
  disabled: boolean;
  onTap: () => void;
}) {
  const bar = side === 'A' ? 'before:bg-side-a' : 'before:bg-side-b';
  const pipTotal = gamesNeeded === 1 ? 1 : 3;

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      aria-label={`Point for Side ${side}`}
      className={`relative overflow-hidden select-none bg-surface-1 border-[1.5px] rounded-[18px] px-3.5 pt-4.5 pb-5 flex flex-col items-center gap-2.5 transition-colors active:scale-[0.98] before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] ${bar} ${
        serving ? 'border-accent' : 'border-border'
      } ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
    >
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1.5 font-extrabold text-[0.92rem] text-center leading-tight">
          {serving && (
            <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_0_3px_var(--color-accent-soft)] shrink-0" />
          )}
          <span>{name}</span>
        </div>
        {college && (
          <span className="mono text-[0.66rem] uppercase tracking-wide text-text-muted">{college}</span>
        )}
      </div>
      <div className="font-display text-[clamp(3.2rem,15vw,4.6rem)] leading-[0.9] text-text-primary">{score}</div>
      {pipTotal > 1 && (
        <div className="flex gap-1.5">
          {Array.from({ length: pipTotal }).map((_, i) => (
            <span
              key={i}
              className={`w-2.5 h-2.5 rounded-full border-[1.5px] ${
                i < gamesWon
                  ? side === 'A'
                    ? 'bg-side-a border-side-a'
                    : 'bg-side-b border-side-b'
                  : 'border-border'
              }`}
            />
          ))}
        </div>
      )}
      <div className="text-[0.68rem] text-text-muted uppercase tracking-wide">Tap to score</div>
    </button>
  );
}

function Pill({ children, gold }: { children: ReactNode; gold?: boolean }) {
  return (
    <span
      className={`mono text-[0.7rem] font-semibold tracking-wide px-2.5 py-1 rounded-full border uppercase ${
        gold ? 'text-gold border-gold/35 bg-gold-soft' : 'text-text-secondary border-border bg-surface-2'
      }`}
    >
      {children}
    </span>
  );
}

function RuleRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2.5 text-[0.86rem] text-text-secondary leading-relaxed">
      <span className="mono shrink-0 w-[92px] text-accent-hover font-bold text-[0.74rem] uppercase tracking-wide pt-0.5">
        {k}
      </span>
      <span>{v}</span>
    </div>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 bg-[rgba(10,8,7,0.82)] backdrop-blur-[3px] flex items-center justify-center p-5 z-30">
      <div className="bg-surface-1 border border-border rounded-[20px] px-6.5 py-7 max-w-[380px] w-full text-center">
        {children}
      </div>
    </div>
  );
}
