import { useState } from 'react';
import type { CollegeName } from '../../../lib/matchCenterData';
import { usePlayers, useCreatePlayer } from '../../../lib/queries';

export interface PickedPlayer {
  id: string;
  name: string;
}

interface PlayerPickerProps {
  college: CollegeName | '';
  /** 1 for a singles slot, 2 for a doubles pair. */
  max: 1 | 2;
  /** 0..max already-picked players. */
  selected: PickedPlayer[];
  onChange: (players: PickedPlayer[]) => void;
  disabled?: boolean;
}

const inputCls =
  'w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-text-primary font-semibold text-[0.9rem]';

/**
 * Real-roster player picker for Live Scoring / Schedule forms. Replaces the old always-empty
 * PLAYERS/eligiblePlayers() roster (matchCenterData.ts) with the actual `players` table, via the
 * already-existing-but-previously-unused usePlayers()/useCreatePlayer() hooks (src/lib/queries.ts).
 *
 * Renders `max` independent slots, each a type-to-filter combobox against the roster for
 * `college`. Typing a name with no exact roster match offers an inline "+ Add ... as a new
 * player" affordance that calls useCreatePlayer() and then selects the newly created row -- so a
 * court-side scorer never has to leave this form to enter a player who hasn't played yet.
 */
export function PlayerPicker({ college, max, selected, onChange, disabled }: PlayerPickerProps) {
  const { data: roster = [] } = usePlayers(college || null);
  const createPlayer = useCreatePlayer();
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [queries, setQueries] = useState<string[]>(() => Array.from({ length: max }, () => ''));
  const [creatingSlot, setCreatingSlot] = useState<number | null>(null);

  const slots = Array.from({ length: max }, (_, i) => selected[i] ?? null);

  function setQuery(i: number, value: string) {
    setQueries((q) => {
      const next = [...q];
      next[i] = value;
      return next;
    });
  }

  function pick(i: number, player: PickedPlayer) {
    const next = [...selected];
    next[i] = player;
    onChange(next.slice(0, max));
    setOpenSlot(null);
    setQuery(i, '');
  }

  function clear(i: number) {
    onChange(selected.filter((_, idx) => idx !== i));
  }

  async function addNew(i: number, name: string) {
    const trimmed = name.trim();
    if (!trimmed || !college) return;
    setCreatingSlot(i);
    try {
      const id = await createPlayer.mutateAsync({ name: trimmed, college });
      pick(i, { id, name: trimmed });
    } finally {
      setCreatingSlot(null);
    }
  }

  if (!college) {
    return (
      <div>
        <label className="block text-[0.7rem] font-semibold text-text-muted uppercase tracking-wide mb-1">
          {max === 2 ? 'Pair' : 'Player'}
        </label>
        <div className={`${inputCls} text-text-muted opacity-60`}>Select a college first</div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-[0.7rem] font-semibold text-text-muted uppercase tracking-wide mb-1">
        {max === 2 ? 'Pair' : 'Player'}
      </label>
      <div className={max === 2 ? 'grid grid-cols-2 gap-2' : undefined}>
        {slots.map((picked, i) => {
          const query = queries[i] ?? '';
          const takenIds = new Set(selected.filter((_, idx) => idx !== i).map((p) => p.id));
          const matches = roster.filter(
            (p) => !takenIds.has(p.id) && p.name.toLowerCase().includes(query.trim().toLowerCase())
          );
          const hasExactMatch = matches.some((p) => p.name.toLowerCase() === query.trim().toLowerCase());
          const isOpen = !disabled && !picked && openSlot === i;

          return (
            <div key={i} className="relative">
              {picked ? (
                <div className={`${inputCls} flex items-center justify-between gap-2`}>
                  <span className="truncate">{picked.name}</span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => clear(i)}
                      className="text-text-muted hover:text-text-primary text-[0.8rem] font-bold shrink-0"
                      aria-label={`Remove ${picked.name}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  disabled={disabled || creatingSlot === i}
                  placeholder={max === 2 ? `Player ${i + 1}` : 'Type a name…'}
                  value={creatingSlot === i ? 'Adding…' : query}
                  onChange={(e) => {
                    setQuery(i, e.target.value);
                    setOpenSlot(i);
                  }}
                  onFocus={() => setOpenSlot(i)}
                  onBlur={() => setTimeout(() => setOpenSlot((s) => (s === i ? null : s)), 150)}
                  className={inputCls}
                  autoComplete="off"
                  aria-label={max === 2 ? `Player ${i + 1}` : 'Player'}
                />
              )}

              {isOpen && (
                <div className="absolute z-10 mt-1 w-full bg-surface-1 border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {matches.length === 0 && !query.trim() && (
                    <div className="px-3 py-2 text-[0.8rem] text-text-muted">
                      No players yet for {college} — start typing to add one.
                    </div>
                  )}
                  {matches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(i, { id: p.id, name: p.name })}
                      className="w-full text-left px-3 py-2 text-[0.85rem] text-text-primary hover:bg-surface-2"
                    >
                      {p.name}
                    </button>
                  ))}
                  {query.trim() && !hasExactMatch && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addNew(i, query)}
                      disabled={creatingSlot === i}
                      className="w-full text-left px-3 py-2 text-[0.85rem] text-accent hover:bg-surface-2 border-t border-border-soft disabled:opacity-50"
                    >
                      {creatingSlot === i ? 'Adding…' : `+ Add "${query.trim()}" as a new player`}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
