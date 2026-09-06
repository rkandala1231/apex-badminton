import { useState } from 'react';
import type { CollegeName } from '../../../lib/matchCenterData';
import { EVENT_LABEL, HARD_CAP, INTERVAL_AT, POINTS_TO_WIN, WIN_BY } from './constants';
import { computeDisplayName } from './pairing';
import { PickFromSchedule } from './PickFromSchedule';
import { SidePicker } from './SidePicker';
import type { Format, LiveEventType, Side, Stage, StartSetup } from './types';

type SetupMode = 'schedule' | 'adhoc';

const EVENT_OPTIONS: LiveEventType[] = ['MS', 'WS', 'MD', 'WD', 'XD', 'TEAM'];

function SegButton({
  active,
  label,
  sub,
  onClick,
  side,
}: {
  active: boolean;
  label: string;
  sub: string;
  onClick: () => void;
  side?: 'a' | 'b';
}) {
  const sideActive =
    side === 'a'
      ? 'bg-side-a-soft border-side-a text-text-primary'
      : side === 'b'
        ? 'bg-side-b-soft border-side-b text-text-primary'
        : 'bg-accent-soft border-accent text-text-primary';
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`text-left rounded-lg border px-3 py-3 text-[0.86rem] font-bold transition-colors ${
        active ? sideActive : 'bg-surface-2 border-border text-text-secondary'
      }`}
    >
      {label}
      <span className={`block font-medium text-[0.74rem] mt-0.5 ${active ? 'text-accent-hover' : 'text-text-muted'}`}>
        {sub}
      </span>
    </button>
  );
}

export function SetupScreen({ onStart }: { onStart: (setup: StartSetup) => void }) {
  const [mode, setMode] = useState<SetupMode>('schedule');

  return (
    <div className="max-w-[560px]">
      <div className="flex gap-2 mb-5" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'schedule'}
          onClick={() => setMode('schedule')}
          className={`px-3.5 py-2 rounded-full text-[0.8rem] font-semibold border transition-colors ${
            mode === 'schedule' ? 'bg-accent-soft border-accent text-accent' : 'border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          From Schedule
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'adhoc'}
          onClick={() => setMode('adhoc')}
          className={`px-3.5 py-2 rounded-full text-[0.8rem] font-semibold border transition-colors ${
            mode === 'adhoc' ? 'bg-accent-soft border-accent text-accent' : 'border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          Ad Hoc
        </button>
      </div>

      {mode === 'schedule' ? (
        <>
          <p className="text-[0.95rem] mb-5 max-w-[60ch]">
            Pick a match already on the Schedule tab. Its matchup and format carry over automatically
            — just confirm who serves first and start.
          </p>
          <PickFromSchedule onStart={onStart} />
        </>
      ) : (
        <AdHocForm onStart={onStart} />
      )}
    </div>
  );
}

function AdHocForm({ onStart }: { onStart: (setup: StartSetup) => void }) {
  const [stage, setStage] = useState<Stage>('roundrobin');
  const [format, setFormat] = useState<Format>('single');
  const [eventType, setEventType] = useState<LiveEventType>('MS');
  const [firstServer, setFirstServer] = useState<Side>('A');

  const [collegeA, setCollegeA] = useState<CollegeName | ''>('');
  const [collegeB, setCollegeB] = useState<CollegeName | ''>('');
  const [playersA, setPlayersA] = useState<string[]>([]);
  const [playersB, setPlayersB] = useState<string[]>([]);
  const [manualA, setManualA] = useState('');
  const [manualB, setManualB] = useState('');

  function pickStage(next: Stage) {
    setStage(next);
    // Sensible default: round robin -> single game, knockout -> best of 3 (still user-overridable).
    setFormat(next === 'knockout' ? 'bo3' : 'single');
  }

  function pickEvent(next: LiveEventType) {
    setEventType(next);
    // Player/pair eligibility depends on the event — clear stale picks rather than carry them over.
    setPlayersA([]);
    setPlayersB([]);
    setManualA('');
    setManualB('');
  }

  const nameA = computeDisplayName({ eventType, college: collegeA, players: playersA, manual: manualA });
  const nameB = computeDisplayName({ eventType, college: collegeB, players: playersB, manual: manualB });
  const readyA = nameA.trim().length > 0;
  const readyB = nameB.trim().length > 0;

  return (
    <div className="max-w-[560px]">
      <p className="text-[0.95rem] mb-6 max-w-[60ch]">
        Live match scoring for tournament day — BWF match structure, scaled to a {POINTS_TO_WIN}-point
        game. Pick a stage below; pool play defaults to a single game, knockout to best-of-three.
      </p>

      <div className="bg-surface-1 border border-border-soft rounded-2xl p-5 mb-4">
        <div className="mono text-[0.68rem] tracking-[0.14em] uppercase text-text-muted font-semibold mb-3">
          Stage
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SegButton active={stage === 'roundrobin'} label="Round Robin" sub="Pool play" onClick={() => pickStage('roundrobin')} />
          <SegButton active={stage === 'knockout'} label="Knockout" sub="Semifinal · Final" onClick={() => pickStage('knockout')} />
        </div>
      </div>

      <div className="bg-surface-1 border border-border-soft rounded-2xl p-5 mb-4">
        <div className="mono text-[0.68rem] tracking-[0.14em] uppercase text-text-muted font-semibold mb-3">
          Match format
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SegButton active={format === 'single'} label="Single Game" sub={`Race to ${POINTS_TO_WIN}`} onClick={() => setFormat('single')} />
          <SegButton active={format === 'bo3'} label="Best of 3" sub="First to 2 games" onClick={() => setFormat('bo3')} />
        </div>
      </div>

      <div className="bg-surface-1 border border-border-soft rounded-2xl p-5 mb-4">
        <div className="mono text-[0.68rem] tracking-[0.14em] uppercase text-text-muted font-semibold mb-3">
          Match details
        </div>

        <div className="mb-4">
          <label htmlFor="ls-event" className="block text-[0.78rem] font-semibold text-text-muted uppercase tracking-wide mb-1.5">
            Event
          </label>
          <select
            id="ls-event"
            value={eventType}
            onChange={(e) => pickEvent(e.target.value as LiveEventType)}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-text-primary font-semibold text-[0.9rem]"
          >
            {EVENT_OPTIONS.map((code) => (
              <option key={code} value={code}>
                {EVENT_LABEL[code]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
          <SidePicker
            side="a"
            eventType={eventType}
            college={collegeA}
            onCollege={setCollegeA}
            players={playersA}
            onPlayers={setPlayersA}
            manual={manualA}
            onManual={setManualA}
          />
          <SidePicker
            side="b"
            eventType={eventType}
            college={collegeB}
            onCollege={setCollegeB}
            players={playersB}
            onPlayers={setPlayersB}
            manual={manualB}
            onManual={setManualB}
          />
        </div>

        <div>
          <label className="block text-[0.78rem] font-semibold text-text-muted uppercase tracking-wide mb-1.5">
            First server
          </label>
          <div className="flex gap-2.5">
            <SegButton
              active={firstServer === 'A'}
              label={readyA ? nameA : 'Side A'}
              sub=""
              onClick={() => setFirstServer('A')}
              side="a"
            />
            <SegButton
              active={firstServer === 'B'}
              label={readyB ? nameB : 'Side B'}
              sub=""
              onClick={() => setFirstServer('B')}
              side="b"
            />
          </div>
        </div>
      </div>

      <details className="bg-surface-1 border border-border-soft rounded-2xl p-5 mb-5 [&_summary]:list-none [&_summary::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer flex items-center justify-between font-bold text-[0.88rem] text-text-primary">
          How the scoring works
          <span className="mono text-accent text-[1.1rem]">+</span>
        </summary>
        <div className="mt-3.5 flex flex-col gap-2.5">
          <RuleRow k="Points" v="Rally-point scoring — every rally wins a point, regardless of who served." />
          <RuleRow
            k="Game win"
            v={`First to ${POINTS_TO_WIN} points with a ${WIN_BY}-point lead. Tied at ${POINTS_TO_WIN - 1}-${POINTS_TO_WIN - 1}, play continues until one side leads by ${WIN_BY} — or reaches ${HARD_CAP}, which wins outright.`}
          />
          <RuleRow k="Interval" v={`A break is called when either side first reaches ${INTERVAL_AT} points in a game.`} />
          <RuleRow k="Match win" v="Single Game: one game decides it. Best of 3: first side to win 2 games takes the match." />
          <RuleRow k="Serve" v="Whoever wins the rally serves next. The winner of a completed game serves first in the next one." />
        </div>
      </details>

      {!(readyA && readyB) && (
        <p className="text-[0.78rem] text-text-muted mb-2.5 text-center">
          Pick a college and {eventType === 'TEAM' ? 'team' : 'player/pair'} for both sides to continue.
        </p>
      )}

      <button
        type="button"
        disabled={!(readyA && readyB)}
        onClick={() =>
          onStart({
            stage,
            format,
            eventType,
            nameA,
            nameB,
            collegeA: collegeA || null,
            collegeB: collegeB || null,
            playersA,
            playersB,
            firstServer,
          })
        }
        className="w-full bg-accent text-[#08211a] rounded-xl py-3.5 font-extrabold text-[0.98rem] uppercase tracking-wide hover:bg-accent-hover transition-colors active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Start Match
      </button>
    </div>
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
