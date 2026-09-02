import { SectionHead } from '../ui/SectionHead';
import { Reveal } from '../ui/Reveal';

export function Impact() {
  return (
    <section className="py-10 md:py-16 border-t border-border-soft">
      <div className="max-w-[1180px] mx-auto px-5 md:px-12">
        <SectionHead num="04" title="Our Impact">
          The badminton ecosystem we&apos;re building, one event at a time.
        </SectionHead>
        <Reveal>
          <p className="font-display normal-case text-[clamp(1.4rem,3.2vw,2.1rem)] leading-[1.4] text-text-primary max-w-[900px]">
            New players feel welcome. <span className="text-text-muted">Competitive players find real competition.</span>{' '}
            Colleges connect with local communities. <span className="text-text-muted">Coaches and clubs collaborate.</span>{' '}
            Healthcare, education, and business support the sport —{' '}
            <span className="text-accent">every event leaves the community stronger.</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
