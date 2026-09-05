import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../lib/useAuth';
import { staffIdFromEmail } from '../../lib/staffAuth';
import { COLLEGES, type CollegeName } from '../../lib/matchCenterData';
import { useCreatePlayerAssessment, type FinalDecision, type SuggestedLevel } from '../../lib/queries';

const SUGGESTED_LEVELS: SuggestedLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Competitive'];
const FINAL_DECISIONS: FinalDecision[] = ['Advance', 'Hold', 'Reassess'];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function defaultEvaluator(email: string | undefined) {
  if (!email) return '';
  const id = staffIdFromEmail(email);
  return id.includes('@') ? '' : id;
}

const inputCls =
  'bg-surface-2 border border-border rounded-md px-3 py-2.5 text-text-primary text-[0.88rem] w-full';
const labelCls = 'text-[0.78rem] font-bold text-text-secondary';

export function AssessmentEntryForm() {
  const { user } = useAuth();
  const createAssessment = useCreatePlayerAssessment();

  const [playerName, setPlayerName] = useState('');
  const [college, setCollege] = useState<CollegeName | ''>('');
  const [clinicDate, setClinicDate] = useState(todayIso());
  const [evaluator, setEvaluator] = useState(() => defaultEvaluator(user?.email));
  const [suggestedLevel, setSuggestedLevel] = useState<SuggestedLevel>('Beginner');
  const [finalDecision, setFinalDecision] = useState<FinalDecision>('Advance');
  const [comments, setComments] = useState('');

  const resetForKeepGoing = () => {
    setPlayerName('');
    setComments('');
    // College, clinic date, evaluator, suggested level and final decision stay put -- staff are
    // almost always entering several players back-to-back at the same clinic, for the same
    // college, on the same date, and re-picking all of that every single time would be pure
    // friction.
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !college || !clinicDate || !evaluator.trim()) return;

    createAssessment.mutate(
      {
        player_name: playerName.trim(),
        college,
        clinic_date: clinicDate,
        evaluator: evaluator.trim(),
        suggested_level: suggestedLevel,
        final_decision: finalDecision,
        comments: comments.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(`Saved assessment for ${playerName.trim()}`);
          resetForKeepGoing();
        },
        onError: (err) =>
          toast.error('Could not save assessment', { description: err instanceof Error ? err.message : String(err) }),
      }
    );
  };

  return (
    <form onSubmit={onSubmit} className="p-5 md:p-6 bg-surface-1 border border-border rounded-2xl max-w-[640px]">
      <div className="mb-1.5">
        <div className="text-[0.72rem] font-bold uppercase tracking-wide text-text-muted">Player Info</div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mb-5 pb-5 border-b border-border-soft">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Player Name *</label>
          <input
            type="text"
            required
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="e.g. Priya Nair"
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>College *</label>
          <select
            required
            value={college}
            onChange={(e) => setCollege(e.target.value as CollegeName | '')}
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
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Clinic Date *</label>
          <input
            type="date"
            required
            value={clinicDate}
            onChange={(e) => setClinicDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Evaluator *</label>
          <input
            type="text"
            required
            value={evaluator}
            onChange={(e) => setEvaluator(e.target.value)}
            placeholder="e.g. Coach Patel"
            className={inputCls}
          />
        </div>
      </div>

      <div className="mb-1.5">
        <div className="text-[0.72rem] font-bold uppercase tracking-wide text-text-muted">Final Evaluation</div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mb-5">
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Suggested Level *</label>
          <select
            value={suggestedLevel}
            onChange={(e) => setSuggestedLevel(e.target.value as SuggestedLevel)}
            className={inputCls}
          >
            {SUGGESTED_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Final Decision *</label>
          <select
            value={finalDecision}
            onChange={(e) => setFinalDecision(e.target.value as FinalDecision)}
            className={inputCls}
          >
            {FINAL_DECISIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className={labelCls}>Comments</label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Optional notes for this player"
            rows={3}
            className={`${inputCls} resize-y`}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={createAssessment.isPending}
        className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-2.5 bg-accent text-[#181310] hover:bg-accent-hover transition-colors disabled:opacity-60"
      >
        {createAssessment.isPending ? 'Saving…' : 'Save assessment'}
      </button>
    </form>
  );
}
