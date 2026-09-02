import { COLLEGES, type CollegeName } from '../../../lib/matchCenterData';
import { computeDisplayName, eligiblePlayers, isDoublesEvent, isTeamEvent } from './pairing';
import type { LiveEventType } from './types';

const inputCls =
  'w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-text-primary font-semibold text-[0.9rem]';

export function SidePicker({
  side,
  eventType,
  college,
  onCollege,
  players,
  onPlayers,
  manual,
  onManual,
}: {
  side: 'a' | 'b';
  eventType: LiveEventType;
  college: CollegeName | '';
  onCollege: (c: CollegeName | '') => void;
  players: string[];
  onPlayers: (p: string[]) => void;
  manual: string;
  onManual: (v: string) => void;
}) {
  const doubles = isDoublesEvent(eventType);
  const team = isTeamEvent(eventType);
  const roster = eligiblePlayers(college, eventType);
  const hasRoster = roster.length > 0;
  const dot = side === 'a' ? 'text-side-a' : 'text-side-b';
  const preview = computeDisplayName({ eventType, college, players, manual });

  return (
    <div className="bg-surface-2/40 border border-border-soft rounded-xl p-3.5">
      <div className="flex items-center gap-1.5 text-[0.78rem] font-semibold text-text-muted uppercase tracking-wide mb-2.5">
        <span className={`${dot} text-[0.6rem]`}>●</span> Side {side.toUpperCase()}
      </div>

      <div className="mb-2.5">
        <label htmlFor={`ls-college-${side}`} className="block text-[0.7rem] font-semibold text-text-muted uppercase tracking-wide mb-1">
          College
        </label>
        <select
          id={`ls-college-${side}`}
          value={college}
          onChange={(e) => {
            onCollege(e.target.value as CollegeName | '');
            onPlayers([]);
            onManual('');
          }}
          className={inputCls}
        >
          <option value="">Select college</option>
          {COLLEGES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {college && team && (
        <p className="text-[0.78rem] text-text-muted">
          Using <span className="font-semibold text-text-secondary">{college}</span> as the team name.
        </p>
      )}

      {college && !team && hasRoster && !doubles && (
        <div>
          <label htmlFor={`ls-player-${side}`} className="block text-[0.7rem] font-semibold text-text-muted uppercase tracking-wide mb-1">
            Player
          </label>
          <select
            id={`ls-player-${side}`}
            value={players[0] ?? ''}
            onChange={(e) => onPlayers(e.target.value ? [e.target.value] : [])}
            className={inputCls}
          >
            <option value="">Select player</option>
            {roster.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {college && !team && hasRoster && doubles && (
        <div>
          <label className="block text-[0.7rem] font-semibold text-text-muted uppercase tracking-wide mb-1">Pair</label>
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="Player 1"
              value={players[0] ?? ''}
              onChange={(e) => onPlayers([e.target.value, players[1] ?? ''].filter(Boolean))}
              className={inputCls}
            >
              <option value="">Player 1</option>
              {roster
                .filter((p) => p.name !== players[1])
                .map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
            </select>
            <select
              aria-label="Player 2"
              value={players[1] ?? ''}
              onChange={(e) => onPlayers([players[0] ?? '', e.target.value].filter(Boolean))}
              className={inputCls}
            >
              <option value="">Player 2</option>
              {roster
                .filter((p) => p.name !== players[0])
                .map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}

      {college && !team && !hasRoster && (
        <div>
          <label htmlFor={`ls-manual-${side}`} className="block text-[0.7rem] font-semibold text-text-muted uppercase tracking-wide mb-1">
            {doubles ? 'Pair name' : 'Player name'}
          </label>
          <input
            id={`ls-manual-${side}`}
            type="text"
            maxLength={40}
            placeholder={doubles ? 'e.g. Priya Shah / Maya Lee' : 'e.g. Priya Shah'}
            value={manual}
            onChange={(e) => onManual(e.target.value)}
            className={inputCls}
          />
          <p className="text-[0.72rem] text-text-muted mt-1">
            No roster entered for {college} in this event yet — enter {doubles ? 'the pair' : 'the player'} manually.
          </p>
        </div>
      )}

      {preview && (
        <p className="text-[0.74rem] text-text-muted mt-2.5 pt-2.5 border-t border-border-soft">
          On scoreboard: <span className="font-semibold text-text-secondary">{preview}</span>
        </p>
      )}
    </div>
  );
}
