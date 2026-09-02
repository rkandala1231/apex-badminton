import { Link } from 'react-router-dom';
import { Reveal } from '../ui/Reveal';

export function ClosingCta() {
  return (
    <section className="pt-2 md:pt-3 pb-12 md:pb-16">
      <div className="max-w-[1180px] mx-auto px-5 md:px-12">
        <Reveal>
          <div
            className="relative overflow-hidden rounded-2xl border border-border p-8 md:p-14 text-center flex flex-col items-center gap-5"
            style={{
              background:
                'radial-gradient(60% 120% at 50% 0%, rgba(16,185,129,0.14), transparent 70%), var(--color-surface-1)',
            }}
          >
            <h2 className="text-[clamp(1.8rem,4vw,2.6rem)] max-w-[22ch]">Ready to grow badminton with us?</h2>
            <p className="text-[1rem] md:text-[1.05rem] max-w-[52ch]">
              Register your college for the Apex tournament, or explore how the formats and schedule work.
            </p>
            <div className="flex flex-wrap justify-center gap-3.5 mt-2">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-6 py-3 bg-accent text-[#181310] hover:bg-accent-hover transition-colors no-underline active:scale-95"
              >
                Register Your College
              </Link>
              <Link
                to="/analytics"
                className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-6 py-3 bg-transparent text-text-primary border border-border hover:border-accent hover:text-accent transition-colors no-underline active:scale-95"
              >
                View Live Analytics
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
