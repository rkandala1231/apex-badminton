import type { ReactNode } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { SectionHead } from '../ui/SectionHead';
import { Reveal } from '../ui/Reveal';
import { useRegisterCollege } from '../../lib/queries';
import { REGIONS, type EventCode } from '../../lib/types';

const EVENT_OPTIONS: EventCode[] = ['MS', 'WS', 'MD', 'WD', 'XD', 'TEAM'];

const schema = z.object({
  college: z.string().trim().min(2, 'Enter your college or university name.'),
  captain: z.string().trim().min(2, "Enter the team captain's name."),
  email: z.string().trim().email('Enter a valid email address.'),
  region: z
    .string()
    .min(1, 'Select a region.')
    .refine((v) => (REGIONS as readonly string[]).includes(v), 'Select a valid region.'),
  roster: z
    .string()
    .optional()
    .refine((v) => !v || (Number(v) >= 1 && Number(v) <= 30), 'Roster size must be between 1 and 30.'),
  events: z.array(z.string()).min(1, 'Select at least one event.'),
});

type FormValues = z.infer<typeof schema>;

const STEPS = [
  {
    title: 'Check eligibility',
    body: 'Any full-time undergraduate or graduate student with current enrollment verification can play. One roster per college, no minimum program size.',
  },
  {
    title: 'Pick your events',
    body: 'Enter as many of the six categories as your squad can cover: MS, WS, MD, WD, XD, and the College Team format. Most colleges enter 3–4.',
  },
  {
    title: 'Submit your roster',
    body: 'Team captains submit a roster (up to 10 players) with student ID verification through the registration portal.',
  },
  {
    title: 'Pay entry fees',
    body: 'Per-event or bundle pricing — see the table below. Fees fund courts, shuttles, certified officiating, and the prize pool.',
  },
  {
    title: 'Get confirmed & seeded',
    body: "You'll receive a confirmation email and your pool assignment, seeded by regional ranking or self-reported season record.",
  },
];

const TIMELINE = [
  { date: 'SEP 15, 2026', label: 'Registration opens', done: false },
  { date: 'OCT 1, 2026', label: 'Early-bird deadline (10% off)', done: false },
  { date: 'OCT 24, 2026', label: 'Final registration deadline', done: false },
  { date: 'NOV 3, 2026', label: 'Pools announced & seeding released', done: false },
  { date: 'NOV 7, 2026', label: 'Apex tournament day', done: false },
];

const FEES = [
  { type: 'Individual event (MS / WS / MD / WD / XD) — per player', fee: '$25' },
  { type: 'Multi-event bundle (3+ events) — per player', fee: '$65' },
  { type: 'College Team format — per tie', fee: '$60' },
];

export function Registration() {
  const registerMutation = useRegisterCollege();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { events: ['MS', 'WS'], region: '', college: '', captain: '', email: '', roster: '' },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await registerMutation.mutateAsync({
        p_college_name: values.college,
        p_captain_name: values.captain,
        p_captain_email: values.email,
        p_region: values.region as (typeof REGIONS)[number],
        p_roster_size: values.roster ? parseInt(values.roster, 10) : null,
        p_notes: null,
        p_event_codes: values.events as EventCode[],
      });
      toast.success(`Thanks — ${values.college} is registered.`, {
        description: 'A tournament committee member will follow up by email.',
      });
      reset({ college: '', captain: '', email: '', region: '', roster: '', events: ['MS', 'WS'] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong — please try again.';
      toast.error('Registration failed', { description: message });
    }
  };

  return (
    <section id="registration" className="py-16 md:py-24">
      <div className="max-w-[1180px] mx-auto px-5 md:px-12">
        <SectionHead num="02" title="How Registration Works">
          Five steps from first sign-up to a seeded spot in the draw.
        </SectionHead>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 items-start">
          <Reveal>
            <div>
              <div className="flex flex-col">
                {STEPS.map((s, i) => (
                  <div key={s.title} className="grid grid-cols-[44px_1fr] gap-4.5 py-5.5 border-b border-border-soft last:border-b-0">
                    <div className="w-11 h-11 rounded-full border border-border text-accent font-display text-base flex items-center justify-center">
                      {i + 1}
                    </div>
                    <div>
                      <h4 className="text-[1.05rem] font-sans font-extrabold normal-case mb-1.5 text-text-primary">
                        {s.title}
                      </h4>
                      <p className="text-[0.95rem]">{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <table className="w-full border-collapse mt-3.5 text-[0.92rem]">
                <thead>
                  <tr>
                    <th className="text-left py-2.5 px-1 border-b border-border-soft text-text-muted font-semibold text-[0.72rem] tracking-wide uppercase">
                      Entry type
                    </th>
                    <th className="text-right py-2.5 px-1 border-b border-border-soft text-text-muted font-semibold text-[0.72rem] tracking-wide uppercase">
                      Fee
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {FEES.map((f) => (
                    <tr key={f.type}>
                      <td className="py-2.5 px-1 border-b border-border-soft">{f.type}</td>
                      <td className="py-2.5 px-1 border-b border-border-soft text-right mono text-text-primary">{f.fee}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-9 flex flex-col border-l-2 border-border pl-5.5">
                {TIMELINE.map((t, i) => (
                  <div key={t.date} className={`relative ${i !== TIMELINE.length - 1 ? 'pb-5.5' : ''}`}>
                    <span
                      className={`absolute -left-[29px] top-1 w-[11px] h-[11px] rounded-full border-2 border-accent ${t.done ? 'bg-accent' : 'bg-bg'}`}
                    />
                    <div className="mono text-[0.78rem] text-accent">{t.date}</div>
                    <div className="text-[0.95rem] text-text-secondary mt-0.5">{t.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="bg-surface-1 border border-border rounded-2xl p-6 md:p-8 lg:sticky lg:top-24"
            >
              <h3 className="text-[1.3rem] mb-1.5">Get on the list</h3>
              <p className="text-[0.85rem] text-text-muted mb-5.5">
                Reserve your college&apos;s spot before the early-bird deadline.
              </p>

              <Field label="College / University" error={errors.college?.message}>
                <input
                  {...register('college')}
                  type="text"
                  placeholder="e.g. Meridian State University"
                  className={inputClass}
                />
              </Field>
              <Field label="Team captain" error={errors.captain?.message}>
                <input {...register('captain')} type="text" placeholder="Full name" className={inputClass} />
              </Field>
              <Field label="Captain email" error={errors.email?.message}>
                <input {...register('email')} type="email" placeholder="you@college.edu" className={inputClass} />
              </Field>
              <Field label="Region" error={errors.region?.message}>
                <select {...register('region')} className={inputClass}>
                  <option value="" disabled>
                    Select a region…
                  </option>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Roster size (optional)" error={errors.roster?.message}>
                <input {...register('roster')} type="number" min={1} max={30} placeholder="e.g. 8" className={inputClass} />
              </Field>

              <div className="mb-4 flex flex-col gap-1.5">
                <label className="text-[0.78rem] font-bold text-text-secondary tracking-wide">Events you&apos;re entering</label>
                <Controller
                  control={control}
                  name="events"
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-2">
                      {EVENT_OPTIONS.map((code) => {
                        const checked = field.value?.includes(code);
                        return (
                          <label key={code} className="relative cursor-pointer">
                            <input
                              type="checkbox"
                              className="absolute opacity-0 inset-0 w-full h-full cursor-pointer m-0"
                              checked={checked}
                              onChange={(e) => {
                                const set = new Set(field.value || []);
                                if (e.target.checked) set.add(code);
                                else set.delete(code);
                                field.onChange(Array.from(set));
                              }}
                            />
                            <span
                              className={`inline-flex px-3.5 py-2 rounded-full border text-[0.8rem] font-semibold select-none transition-colors ${
                                checked
                                  ? 'bg-accent-soft border-accent text-accent'
                                  : 'border-border text-text-secondary'
                              }`}
                            >
                              {code === 'TEAM' ? 'Team' : code}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                />
                {errors.events && <p className="text-[0.78rem] text-ev-ws mt-1">{errors.events.message as string}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-1.5 inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-3 bg-accent text-[#181310] hover:bg-accent-hover transition-colors disabled:opacity-60 active:scale-95"
              >
                {isSubmitting ? 'Registering…' : 'Register My College'}
              </button>

              <motion.p className="text-[0.76rem] text-text-muted mt-3.5 leading-relaxed">
                Your registration is saved directly to Apex&apos;s database — a member of the tournament committee
                will follow up by email to confirm.
              </motion.p>
            </form>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

const inputClass =
  'bg-surface-2 border border-border rounded-md px-3 py-2.5 text-text-primary font-sans text-[0.92rem] w-full focus:outline-2 focus:outline-accent focus:outline-offset-1';

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-1.5">
      <label className="text-[0.78rem] font-bold text-text-secondary tracking-wide">{label}</label>
      {children}
      {error && <p className="text-[0.78rem] text-ev-ws">{error}</p>}
    </div>
  );
}
