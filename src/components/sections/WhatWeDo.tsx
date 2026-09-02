import { ArrowUpRight } from 'lucide-react';
import { SectionHead } from '../ui/SectionHead';
import { Reveal } from '../ui/Reveal';
import { ScrollGauge } from '../ui/ScrollGauge';
import { useScrollTrack } from '../../lib/useScrollTrack';

const ITEMS = [
  'Host professionally organized tournaments',
  'Build college and community partnerships',
  'Support youth and adult player development',
  'Promote health, wellness, and active lifestyles',
  'Connect badminton communities across New Jersey and beyond',
  'Leverage technology to create a modern tournament experience',
];

export function WhatWeDo() {
  const { ref: trackRef, ratio, progress, onScroll } = useScrollTrack<HTMLDivElement>();

  return (
    <section className="py-10 md:py-16 border-t border-border-soft">
      <div className="max-w-[1180px] mx-auto px-5 md:px-12">
        <SectionHead num="03" title="What We Do">
          The work behind the mission, in practice.
        </SectionHead>

        <Reveal>
          <div className="relative">
            <div
              ref={trackRef}
              onScroll={onScroll}
              className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {ITEMS.map((item, i) => (
                <div
                  key={item}
                  className={`group relative shrink-0 w-[220px] sm:w-[240px] snap-start border-y border-r border-border-soft p-6 flex flex-col gap-5 justify-between transition-colors duration-150 hover:bg-surface-1 ${i === 0 ? 'border-l' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <span className="mono text-text-muted text-[0.82rem]">{String(i + 1).padStart(2, '0')}</span>
                    <ArrowUpRight
                      size={16}
                      className="text-accent opacity-0 -translate-y-0.5 translate-x-0.5 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all duration-200"
                    />
                  </div>
                  <p className="text-text-primary text-[0.98rem] font-medium leading-snug">{item}</p>
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
