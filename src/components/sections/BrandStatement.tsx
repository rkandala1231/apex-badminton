import { Reveal } from '../ui/Reveal';

const PILLARS = [
  { letter: 'A', word: 'Attitude' },
  { letter: 'P', word: 'Performance' },
  { letter: 'E', word: 'Excellence' },
  { letter: 'X', word: 'X-Factor' },
];

export function BrandStatement() {
  return (
    <section className="py-10 md:py-16 overflow-hidden">
      <div className="max-w-[1180px] mx-auto px-5 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-10 lg:gap-16 items-center">
          <Reveal className="relative mx-auto lg:mx-0 w-full max-w-[340px] lg:max-w-none">
            <div
              className="absolute -inset-6 -z-10 rounded-[32px] opacity-70 blur-2xl"
              style={{
                background:
                  'radial-gradient(60% 60% at 30% 15%, rgba(255,182,39,0.22), transparent 70%), radial-gradient(55% 55% at 80% 85%, rgba(16,185,129,0.16), transparent 70%)',
              }}
              aria-hidden="true"
            />
            <img
              src="/images/apex-brand-poster-v3.webp"
              alt="APEX Badminton Club brand poster — Play. Improve. Compete. Belong. Attitude, Performance, Excellence, X-Factor. Together we rise, together we win."
              loading="lazy"
              decoding="async"
              className="relative w-full h-auto rounded-[22px] border border-border shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
            />
          </Reveal>

          <Reveal delay={0.1}>
            <span className="eyebrow">The Apex Standard</span>
            <h2 className="text-[clamp(2rem,4.2vw,3rem)] leading-[1.02] mt-3.5 mb-5">Built on four pillars.</h2>
            <p className="text-[1.05rem] md:text-[1.15rem] leading-relaxed text-text-secondary max-w-[52ch]">
              Every tournament, every partnership, every match reflects the standard that gave us our name —
              attitude, performance, excellence, and the will to win, on and off the court.
            </p>

            <div className="flex flex-wrap gap-x-8 gap-y-3 mt-8 pt-6 border-t border-border-soft">
              {PILLARS.map((p) => (
                <div key={p.letter} className="flex items-baseline gap-2">
                  <span className="font-display text-[1.1rem]" style={{ color: 'var(--color-gold)' }}>
                    {p.letter}
                  </span>
                  <span className="text-text-secondary text-[0.92rem] font-semibold">{p.word}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
