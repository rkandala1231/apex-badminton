import { SectionHead } from '../ui/SectionHead';
import { Reveal } from '../ui/Reveal';
import { ScrollGauge } from '../ui/ScrollGauge';
import { useScrollTrack } from '../../lib/useScrollTrack';

const VALUES = [
  { letter: 'C', name: 'Community First', desc: 'Every player belongs.' },
  { letter: 'S', name: 'Sportsmanship', desc: 'Respect opponents, officials, and teammates.' },
  { letter: 'E', name: 'Excellence', desc: 'Deliver high-quality events and experiences.' },
  { letter: 'G', name: 'Growth', desc: 'Help players continuously improve.' },
  { letter: 'I', name: 'Integrity', desc: 'Be fair, transparent, and accountable.' },
  { letter: 'N', name: 'Innovation', desc: 'Use technology to enhance the player experience.' },
];

export function CoreValues() {
  const { ref: trackRef, ratio, progress, onScroll } = useScrollTrack<HTMLDivElement>();

  return (
    <section className="py-10 md:py-16 border-t border-border-soft">
      <div className="max-w-[1180px] mx-auto px-5 md:px-12">
        <SectionHead num="02" title="Core Values">
          What guides every event, every partnership, every match.
        </SectionHead>

        <Reveal>
          <div className="relative">
            <div
              ref={trackRef}
              onScroll={onScroll}
              className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {VALUES.map((v, i) => (
                <div
                  key={v.name}
                  className={`group relative shrink-0 w-[220px] sm:w-[240px] snap-start border-y border-r border-border-soft p-6 flex flex-col gap-1 transition-colors duration-150 hover:bg-surface-1 ${i === 0 ? 'border-l' : ''}`}
                >
                  <span className="font-display text-[2.6rem] leading-none text-text-primary/[0.07] group-hover:text-accent/25 transition-colors duration-150">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h4 className="font-sans normal-case font-extrabold text-[1.02rem] text-text-primary mt-3">{v.name}</h4>
                  <p className="text-[0.88rem] mt-1">{v.desc}</p>
                </div>
              ))}
            </div>
            <div
              className="pointer-events-none absolute top-0 bottom-0 right-0 w-14 bg-gradient-to-l from-bg to-transparent"
              aria-hidden="true"
            />
          </div>

          <ScrollGauge ratio={ratio} progress={progress} className="mt-5" />
        </Reveal>
      </div>
    </section>
  );
}
