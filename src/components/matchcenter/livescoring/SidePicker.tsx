import { COLLEGES, type CollegeName } from '../../../lib/matchCenterData';
import { computeDisplayName, isDoublesEvent, isTeamEvent } from './pairing';
import { PlayerPicker, type PickedPlayer } from './PlayerPicker';
import type { LiveEventType } from './types';

const inputCls =
  'w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-text-primary font-semibold text-[0.9rem]';

export function SidePicker({
  side,
  eventType,
  college,
  onCollege,
  selectedPlayers,
  onSelectedPlayers,
  manual,
  onManual,
}: {
  side: 'a' | 'b';
  eventType: LiveEventType;
  college: CollegeName | '';
  onCollege: (c: CollegeName | '') => void;
  selectedPlayers: PickedPlayer[];
  onSelectedPlayers: (p: PickedPlayer[]) => void;
  manual: string;
  onManual: (v: string) => void;
}) {
  const doubles = isDoublesEvent(eventType);
  const team = isTeamEvent(eventType);
  const dot = side === 'a' ? 'text-side-a' : 'text-side-b';
  const preview = computeDisplayName({
    eventType,
    college,
    players: selectedPlayers.map((p) => p.name),
    manual,
  });

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
            onSelectedPlayers([]);
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

      {team ? (
        college && (
          <p className="text-[0.78rem] text-text-muted">
            Using <span className="font-semibold text-text-secondary">{college}</span> as the team name.
          </p>
        )
      ) : (
        <PlayerPicker
          college={college}
          max={doubles ? 2 : 1}
          selected={selectedPlayers}
          onChange={onSelectedPlayers}
        />
      )}

      {preview && (
        <p className="text-[0.74rem] text-text-muted mt-2.5 pt-2.5 border-t border-border-soft">
          On scoreboard: <span className="font-semibold text-text-secondary">{preview}</span>
        </p>
      )}
    </div>
  );
}
