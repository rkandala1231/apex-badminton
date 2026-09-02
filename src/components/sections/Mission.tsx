import { SectionHead } from '../ui/SectionHead';
import { Reveal } from '../ui/Reveal';

export function Mission() {
  return (
    <section id="mission" className="py-10 md:py-16 border-t border-border-soft">
      <div className="max-w-[1180px] mx-auto px-5 md:px-12">
        <SectionHead num="01" title="Mission & Vision">
          Growing badminton. Building community. Inspiring players.
        </SectionHead>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border-soft border-t border-border-soft">
          <Reveal className="py-9 md:pr-12">
            <span className="eyebrow" style={{ color: 'var(--color-accent)' }}>
              Mission
            </span>
            <p className="font-display normal-case text-[clamp(1.35rem,2.6vw,1.9rem)] leading-[1.25] text-text-primary mt-4 max-w-[28ch]">
              Build an inclusive badminton community — every age, every skill level — where players compete,
              learn, and thrive through events, coaching, and real partnerships.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="py-9 md:pl-12">
            <span className="eyebrow" style={{ color: 'var(--color-gold)' }}>
              Vision
            </span>
            <p className="font-display normal-case text-[clamp(1.35rem,2.6vw,1.9rem)] leading-[1.25] text-text-primary mt-4 max-w-[28ch]">
              The nation&apos;s leading community-driven badminton organization — connecting players, colleges,
              clubs, and coaches, inspiring lifelong participation in the sport.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
