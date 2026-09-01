import { motion } from 'framer-motion';

const FACTS = [
  { k: 'Dates', v: 'Feb 20–22, 2027' },
  { k: 'Venue', v: 'Meridian Fieldhouse' },
  { k: 'Events', v: '6 Categories' },
  { k: 'Eligibility', v: 'Open to All Colleges' },
];

export function Hero() {
  return (
    <section
      className="relative pt-16 pb-12 md:pt-28 md:pb-16 border-b border-border-soft overflow-hidden"
      style={{
        background:
          'radial-gradient(60% 55% at 82% 8%, rgba(16,185,129,0.16), transparent 70%), radial-gradient(45% 45% at 5% 95%, rgba(255,182,39,0.09), transparent 70%)',
      }}
    >
      <div className="relative z-10 max-w-[1180px] mx-auto px-5 md:px-12">
        <motion.div
          className="flex items-center gap-3 mb-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="eyebrow">Collegiate Badminton Championship · Feb 20&ndash;22, 2027</span>
        </motion.div>

        <motion.h1
          className="text-[clamp(3.6rem,12vw,8.4rem)] leading-[0.86] bg-clip-text text-transparent"
          style={{
            backgroundImage: 'linear-gradient(180deg,#fffaf3 0%, #eafbf3 40%, #10b981 130%)',
          }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          APEX
        </motion.h1>

        <motion.p
          className="text-[clamp(1.05rem,2vw,1.35rem)] text-text-secondary max-w-[46ch] mt-5 mb-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          Where college badminton programs settle it on the court.{' '}
          <strong className="text-text-primary">Six events, one bracket, every college welcome</strong> — run with the
          rigor of a national championship.
        </motion.p>

        <motion.div
          className="flex flex-wrap gap-3.5 mb-10"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
        >
          <a
            href="#registration"
            className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-2.5 bg-accent text-[#181310] hover:bg-accent-hover transition-colors no-underline active:scale-95"
          >
            Register Your College
          </a>
          <a
            href="#formats"
            className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-2.5 bg-transparent text-text-primary border border-border hover:border-accent hover:text-accent transition-colors no-underline active:scale-95"
          >
            See the Format
          </a>
        </motion.div>

        <motion.div
          className="flex flex-wrap border border-border rounded-[10px] overflow-hidden bg-surface-1"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
        >
          {FACTS.map((f, i) => (
            <div
              key={f.k}
              className={`flex-1 min-w-[160px] px-5 py-4 ${i !== FACTS.length - 1 ? 'border-r border-border sm:border-r' : ''} max-sm:border-b max-sm:border-r-0 max-sm:last:border-b-0`}
            >
              <div className="mono text-[0.68rem] tracking-[0.1em] text-text-muted uppercase">{f.k}</div>
              <div className="font-display text-xl mt-1 tracking-wide">{f.v}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
