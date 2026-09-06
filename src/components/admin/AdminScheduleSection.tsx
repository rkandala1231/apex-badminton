import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { CollegeName } from '../../lib/matchCenterData';
import { computeDisplayName } from '../matchcenter/livescoring/pairing';
import type { PickedPlayer } from '../matchcenter/livescoring/PlayerPicker';
import { SidePicker } from '../matchcenter/livescoring/SidePicker';
import { EVENT_LABEL } from '../matchcenter/livescoring/constants';
import type { Format, LiveEventType, Side, Stage } from '../matchcenter/livescoring/types';
import {
  useAdminSchedule,
  useCancelScheduledMatch,
  useCreateScheduledMatch,
  useDeleteScheduledMatch,
  usePlayers,
  usePublishMatch,
  useUnpublishMatch,
  useUpdateScheduledMatch,
  type MatchRow,
  type PlayerRow,
  type ScheduledMatchPayload,
} from '../../lib/queries';

function idsToPickedPlayers(ids: string[], roster: PlayerRow[] | undefined): PickedPlayer[] {
  return ids
    .map((id) => roster?.find((p) => p.id === id))
    .filter((p): p is PlayerRow => !!p)
    .map((p) => ({ id: p.id, name: p.name }));
}
import { EmptyState } from '../matchcenter/shared';

const inputCls = 'bg-surface-2 border border-border rounded-md px-3 py-2.5 text-text-primary text-[0.88rem] w-full';
const labelCls = 'text-[0.78rem] font-bold text-text-secondary block mb-1.5';

const EVENT_OPTIONS: LiveEventType[] = ['MS', 'WS', 'MD', 'WD', 'XD', 'TEAM'];

/**
 * Real Schedule admin console -- see supabase/migrations/20260906010000_real_schedule_fields.sql
 * and queries.ts's "Real Schedule" section. A scheduled match is a draft until an admin publishes
 * it (public Match Center > Schedule only ever shows published rows); Cancel is a soft cancel --
 * the row stays and, if it was published, the public keeps seeing it marked "Canceled" instead of
 * it disappearing. Delete is only ever offered on scheduled/cancelled rows, never a match that's
 * actually been played.
 */
export function AdminScheduleSection() {
  const { data: matches, isLoading } = useAdminSchedule(true);
  const [formState, setFormState] = useState<'closed' | 'create' | MatchRow>('closed');

  const cancelMatch = useCancelScheduledMatch();
  const deleteMatch = useDeleteScheduledMatch();
  const publish = usePublishMatch();
  const unpublish = useUnpublishMatch();

  const [confirming, setConfirming] = useState<{ id: string; kind: 'cancel' | 'delete' } | null>(null);

  if (formState !== 'closed') {
    return (
      <div>
        <h1 className="text-[1.8rem] mb-1.5">Schedule</h1>
        <ScheduleMatchForm
          existing={formState === 'create' ? null : formState}
          onDone={() => setFormState('closed')}
        />
      </div>
    );
  }

  const sorted = [...(matches || [])].sort((a, b) => {
    const at = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
    const bt = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
    return at - bt;
  });

  return (
    <div>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-1.5">
        <h1 className="text-[1.8rem]">Schedule</h1>
        <button
          onClick={() => setFormState('create')}
          className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-[0.82rem] px-4 py-2.5 bg-accent text-[#0c0a08] hover:bg-accent-hover transition-colors"
        >
          + Schedule a match
        </button>
      </div>
      <p className="text-[0.95rem] mb-6 max-w-[60ch] text-text-secondary">
        Plan matches ahead of tournament day. Publish a match to put it on the public Schedule tab;
        Live Scoring can then pick it up by name and start it when it's actually time to play.
      </p>

      {isLoading ? (
        <div className="h-64 bg-surface-1 border border-border rounded-2xl animate-pulse" />
      ) : sorted.length === 0 ? (
        <EmptyState text="No matches scheduled yet. Use “+ Schedule a match” to plan the first one." />
      ) : (
        <div className="overflow-x-auto border border-border rounded-2xl">
          <table className="w-full border-collapse text-[0.85rem] min-w-[880px]">
            <thead>
              <tr>
                {['When', 'Event', 'Matchup', 'Court', 'Status', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="text-left py-3 px-3.5 border-b border-border-soft text-text-muted text-[0.7rem] tracking-wide uppercase bg-surface-1 sticky top-0 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => {
                const isCancelled = m.status === 'cancelled';
                const isConfirmingThis = confirming?.id === m.id;
                return (
                  <tr key={m.id}>
                    <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap">
                      {m.scheduled_at
                        ? new Date(m.scheduled_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap">{EVENT_LABEL[m.event_code as LiveEventType]}</td>
                    <td className="py-3 px-3.5 border-b border-border-soft whitespace-normal">
                      <span className="text-side-a font-semibold">{m.side_a_name}</span>
                      <span className="text-text-muted"> vs </span>
                      <span className="text-side-b font-semibold">{m.side_b_name}</span>
                      <div className="text-[0.72rem] text-text-muted">
                        {m.college_a} vs {m.college_b}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap">{m.court || '—'}</td>
                    <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap">
                      {isCancelled ? (
                        <span className="mono text-[0.7rem] font-bold uppercase tracking-wide px-2 py-1 rounded-full border border-red-500/40 bg-red-500/10 text-red-400">
                          Canceled
                        </span>
                      ) : m.is_published ? (
                        <span className="mono text-[0.7rem] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-accent-soft border border-accent text-accent">
                          Published
                        </span>
                      ) : (
                        <span className="mono text-[0.7rem] font-bold uppercase tracking-wide px-2 py-1 rounded-full border border-border text-text-muted">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 border-b border-border-soft whitespace-nowrap">
                      {isConfirmingThis ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[0.76rem] text-text-muted">
                            {confirming.kind === 'cancel' ? 'Cancel this match?' : 'Delete permanently?'}
                          </span>
                          <button
                            onClick={() => {
                              if (confirming.kind === 'cancel') {
                                cancelMatch.mutate(m.id, {
                                  onSuccess: () => toast.success('Match canceled.'),
                                  onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not cancel the match.'),
                                });
                              } else {
                                deleteMatch.mutate(m.id, {
                                  onSuccess: () => toast.success('Match deleted.'),
                                  onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not delete the match.'),
                                });
                              }
                              setConfirming(null);
                            }}
                            className="rounded-full bg-red-500 text-white font-bold text-[0.74rem] px-3 py-1.5"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirming(null)}
                            className="rounded-full border border-border text-text-secondary font-bold text-[0.74rem] px-3 py-1.5"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {!isCancelled && (
                            <button
                              onClick={() => setFormState(m)}
                              className="rounded-full border border-border text-text-secondary hover:text-text-primary font-bold text-[0.74rem] px-3 py-1.5"
                            >
                              Edit
                            </button>
                          )}
                          {!isCancelled &&
                            (m.is_published ? (
                              <button
                                onClick={() =>
                                  unpublish.mutate(m.id, {
                                    onSuccess: () => toast.success('Unpublished — hidden from the public Schedule again.'),
                                    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not unpublish.'),
                                  })
                                }
                                className="rounded-full border border-border text-text-secondary hover:text-text-primary font-bold text-[0.74rem] px-3 py-1.5"
                              >
                                Unpublish
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  publish.mutate(m.id, {
                                    onSuccess: () => toast.success('Published — now visible on the public Schedule.'),
                                    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not publish.'),
                                  })
                                }
                                className="rounded-full bg-accent text-[#0c0a08] font-bold text-[0.74rem] px-3 py-1.5"
                              >
                                Publish
                              </button>
                            ))}
                          {!isCancelled && (
                            <button
                              onClick={() => setConfirming({ id: m.id, kind: 'cancel' })}
                              className="rounded-full border border-red-500/40 text-red-400 font-bold text-[0.74rem] px-3 py-1.5"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            onClick={() => setConfirming({ id: m.id, kind: 'delete' })}
                            className="rounded-full border border-red-500/40 text-red-400 font-bold text-[0.74rem] px-3 py-1.5"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ScheduleMatchForm({ existing, onDone }: { existing: MatchRow | null; onDone: () => void }) {
  const createMatch = useCreateScheduledMatch();
  const updateMatch = useUpdateScheduledMatch();

  const [stage, setStage] = useState<Stage>(existing?.stage ?? 'roundrobin');
  const [format, setFormat] = useState<Format>(existing?.format ?? 'single');
  const [eventType, setEventType] = useState<LiveEventType>((existing?.event_code as LiveEventType) ?? 'MS');
  const [firstServer, setFirstServer] = useState<Side>('A');

  const [collegeA, setCollegeA] = useState<CollegeName | ''>((existing?.college_a as CollegeName) ?? '');
  const [collegeB, setCollegeB] = useState<CollegeName | ''>((existing?.college_b as CollegeName) ?? '');
  const [selectedA, setSelectedA] = useState<PickedPlayer[]>([]);
  const [selectedB, setSelectedB] = useState<PickedPlayer[]>([]);
  const [manualA, setManualA] = useState(existing?.side_a_name ?? '');
  const [manualB, setManualB] = useState(existing?.side_b_name ?? '');

  const [scheduledAtLocal, setScheduledAtLocal] = useState(toDatetimeLocal(existing?.scheduled_at ?? null));
  const [court, setCourt] = useState(existing?.court ?? '');

  // Editing an existing scheduled match: resolve its stored side_a/b_player_ids (uuids) back to
  // {id,name} pairs by matching against each side's roster, then seed the pickers once. A ref
  // guards this against re-firing on every roster refetch and clobbering the user's own edits.
  const prefilled = useRef(false);
  const { data: rosterA } = usePlayers(collegeA || null);
  const { data: rosterB } = usePlayers(collegeB || null);
  useEffect(() => {
    if (prefilled.current || !existing) return;
    const idsA = existing.side_a_player_ids ?? [];
    const idsB = existing.side_b_player_ids ?? [];
    if (idsA.length === 0 && idsB.length === 0) {
      prefilled.current = true;
      return;
    }
    if (!rosterA || !rosterB) return; // wait for both rosters to load before seeding
    setSelectedA(idsToPickedPlayers(idsA, rosterA));
    setSelectedB(idsToPickedPlayers(idsB, rosterB));
    prefilled.current = true;
  }, [existing, rosterA, rosterB]);

  const playersA = selectedA.map((p) => p.name);
  const playersB = selectedB.map((p) => p.name);
  const nameA = computeDisplayName({ eventType, college: collegeA, players: playersA, manual: manualA });
  const nameB = computeDisplayName({ eventType, college: collegeB, players: playersB, manual: manualB });

  const pending = createMatch.isPending || updateMatch.isPending;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegeA || !collegeB) {
      toast.error('Pick a college for both sides.');
      return;
    }
    if (collegeA === collegeB) {
      toast.error('Pick two different colleges.');
      return;
    }
    if (!nameA.trim() || !nameB.trim()) {
      toast.error(`Enter a ${eventType === 'TEAM' ? 'team' : 'player/pair'} for both sides.`);
      return;
    }
    if (!scheduledAtLocal) {
      toast.error('Pick a date and time.');
      return;
    }

    const payload: ScheduledMatchPayload = {
      eventCode: eventType,
      stage,
      format,
      collegeA,
      collegeB,
      sideAName: nameA.trim(),
      sideBName: nameB.trim(),
      sideAPlayerIds: selectedA.map((p) => p.id),
      sideBPlayerIds: selectedB.map((p) => p.id),
      firstServer,
      scheduledAt: new Date(scheduledAtLocal).toISOString(),
      court: court.trim() || null,
    };

    if (existing) {
      updateMatch.mutate(
        { id: existing.id, ...payload },
        {
          onSuccess: () => {
            toast.success('Schedule updated.');
            onDone();
          },
          onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not save changes.'),
        }
      );
    } else {
      createMatch.mutate(payload, {
        onSuccess: () => {
          toast.success('Match added to the schedule — publish it when it should go public.');
          onDone();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not schedule the match.'),
      });
    }
  };

  return (
    <form onSubmit={onSubmit} className="bg-surface-1 border border-border rounded-2xl p-5 max-w-[560px] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[1rem] font-bold">{existing ? 'Edit scheduled match' : 'Schedule a new match'}</h3>
        <button type="button" onClick={onDone} className="text-[0.8rem] text-text-secondary hover:text-text-primary">
          ← Back to schedule
        </button>
      </div>

      <div>
        <label className={labelCls}>Event</label>
        <select value={eventType} onChange={(e) => setEventType(e.target.value as LiveEventType)} className={inputCls}>
          {EVENT_OPTIONS.map((code) => (
            <option key={code} value={code}>
              {EVENT_LABEL[code]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Stage</label>
          <select
            value={stage}
            onChange={(e) => {
              const next = e.target.value as Stage;
              setStage(next);
              setFormat(next === 'knockout' ? 'bo3' : 'single');
            }}
            className={inputCls}
          >
            <option value="roundrobin">Round Robin</option>
            <option value="knockout">Knockout</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Format</label>
          <select value={format} onChange={(e) => setFormat(e.target.value as Format)} className={inputCls}>
            <option value="single">Single Game</option>
            <option value="bo3">Best of 3</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <SidePicker
          side="a"
          eventType={eventType}
          college={collegeA}
          onCollege={(c) => {
            setCollegeA(c);
            setSelectedA([]);
            setManualA('');
          }}
          selectedPlayers={selectedA}
          onSelectedPlayers={setSelectedA}
          manual={manualA}
          onManual={setManualA}
        />
        <SidePicker
          side="b"
          eventType={eventType}
          college={collegeB}
          onCollege={(c) => {
            setCollegeB(c);
            setSelectedB([]);
            setManualB('');
          }}
          selectedPlayers={selectedB}
          onSelectedPlayers={setSelectedB}
          manual={manualB}
          onManual={setManualB}
        />
      </div>

      <div>
        <label className={labelCls}>First server</label>
        <select value={firstServer} onChange={(e) => setFirstServer(e.target.value as Side)} className={inputCls}>
          <option value="A">{nameA.trim() || 'Side A'}</option>
          <option value="B">{nameB.trim() || 'Side B'}</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Date &amp; time</label>
          <input
            type="datetime-local"
            value={scheduledAtLocal}
            onChange={(e) => setScheduledAtLocal(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Court (optional)</label>
          <input
            type="text"
            value={court}
            onChange={(e) => setCourt(e.target.value)}
            placeholder="e.g. Court 2"
            maxLength={40}
            className={inputCls}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-[0.85rem] px-5 py-2.5 bg-accent text-[#0c0a08] hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        {pending ? 'Saving…' : existing ? 'Save changes' : 'Add to schedule (draft)'}
      </button>
    </form>
  );
}
