import { SectionHead } from '../ui/SectionHead';
import { Reveal } from '../ui/Reveal';

export function Mission() {
  return (
    <section id="mission" className="py-16 md:py-24">
      <div className="max-w-[1180px] mx-auto px-5 md:px-12">
        <SectionHead num="01" title="Mission & Vision">
          Why Apex exists, and what we&apos;re building toward.
        </SectionHead>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Reveal>
            <div className="relative overflow-hidden h-full flex flex-col gap-4.5 bg-surface-1 border border-border rounded-2xl p-7 md:p-10">
              <span className="absolute top-0 left-0 right-0 h-[3px] bg-accent" />
              <div className="w-11 h-11 rounded-xl flex items-center justify-center font-display text-lg bg-accent-soft text-accent">
                M
              </div>
              <h3 className="text-2xl">Mission</h3>
              <p className="text-[1.05rem]">
                Apex exists to give collegiate badminton players a stage worthy of their game — fair draws, real
                competition, and a tournament run with the discipline of a national championship, not a rec-league
                bracket.
              </p>
              <div className="flex gap-2.5 flex-wrap mt-auto pt-2.5">
                {['Fair Draws', 'Certified Officiating', 'Open Access'].map((p) => (
                  <span key={p} className="mono text-[0.72rem] px-3 py-1.5 rounded-full border border-border text-text-muted">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="relative overflow-hidden h-full flex flex-col gap-4.5 bg-surface-1 border border-border rounded-2xl p-7 md:p-10">
              <span className="absolute top-0 left-0 right-0 h-[3px] bg-gold" />
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center font-display text-lg"
                style={{ background: 'rgba(255,182,39,0.14)', color: 'var(--color-gold)' }}
              >
                V
              </div>
              <h3 className="text-2xl">Vision</h3>
              <p className="text-[1.05rem]">
                We&apos;re building the tournament collegiate badminton has been missing: the one ranked players
                circle on their calendar, the one programs measure their season against, the one that turns campus
                rec courts into a pipeline for the sport&apos;s future.
              </p>
              <div className="flex gap-2.5 flex-wrap mt-auto pt-2.5">
                {['National Pipeline', 'Program Growth', 'Player-First'].map((p) => (
                  <span key={p} className="mono text-[0.72rem] px-3 py-1.5 rounded-full border border-border text-text-muted">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
