import { Reveal } from '../ui/Reveal';

export function FounderMessage() {
  return (
    <section
      className="relative py-14 md:py-20 overflow-hidden border-y border-border-soft"
      style={{ background: 'linear-gradient(180deg, var(--color-surface-1) 0%, var(--color-bg) 78%)' }}
    >
      <span
        className="absolute -top-6 md:-top-10 left-1/2 -translate-x-1/2 font-display text-[9rem] md:text-[14rem] leading-none text-accent/[0.06] select-none pointer-events-none"
        aria-hidden="true"
      >
        &ldquo;
      </span>
      <div className="relative max-w-[820px] mx-auto px-5 md:px-12 text-center">
        <Reveal>
          <span className="eyebrow">Founder&apos;s Message</span>
          <p className="font-display normal-case text-[clamp(1.6rem,3.6vw,2.6rem)] leading-[1.22] text-text-primary mt-5">
            APEX started with one belief: badminton brings people together. What began as a passion for running
            great tournaments has grown into a community where every player feels welcome, challenged, and
            inspired.
          </p>
          <p className="text-[1rem] md:text-[1.1rem] leading-relaxed text-text-secondary max-w-[62ch] mx-auto mt-6">
            Beginner or competitive athlete, APEX is your community to learn, compete, connect, and grow — thank
            you for joining us as we work to elevate the sport and inspire the next generation of players.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3">
            <span className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-gold flex items-center justify-center font-display text-[#171310] text-sm">
              A
            </span>
            <div className="text-left">
              <div className="text-text-primary font-bold text-[0.92rem]">The APEX Founder</div>
              <div className="mono text-text-muted text-[0.76rem]">APEX Badminton Club</div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
