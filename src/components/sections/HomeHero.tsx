import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const STATS = [
  { v: '150+', l: 'Active players' },
  { v: '3+', l: 'Partner colleges & clubs' },
  { v: '15+', l: 'Tournaments hosted' },
  { v: '7', l: 'NJ communities connected' },
];

export function HomeHero() {
  return (
    <section
      className="relative pt-14 pb-9 md:pt-20 md:pb-12 border-b border-border-soft overflow-hidden"
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
          <span className="eyebrow">APEX Badminton Club · New Jersey &amp; Beyond</span>
        </motion.div>

        <motion.h1
          className="text-[clamp(3.2rem,10vw,7rem)] leading-[0.88] bg-clip-text text-transparent"
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
          className="font-display normal-case text-text-primary text-[clamp(1.15rem,2.6vw,1.7rem)] leading-tight max-w-[36ch] mt-3 mb-5"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Growing badminton. Building community. Inspiring players.
        </motion.p>

        <motion.p
          className="text-[clamp(1rem,1.6vw,1.2rem)] text-text-secondary max-w-[52ch] mb-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          Badminton is more than a game. It brings people together, builds confidence, promotes healthy lifestyles,
          and creates lasting friendships — for players, families, colleges, and communities.
        </motion.p>

        <motion.div
          className="flex flex-wrap gap-3.5 mb-10"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Link
            to="/register"
            className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-2.5 bg-accent text-[#181310] hover:bg-accent-hover transition-colors no-underline active:scale-95"
          >
            Register Your College
          </Link>
          <Link
            to="/tournament"
            className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-2.5 bg-transparent text-text-primary border border-border hover:border-accent hover:text-accent transition-colors no-underline active:scale-95"
          >
            See Our Tournament
          </Link>
        </motion.div>

        <motion.div
          className="grid grid-cols-2 gap-x-6 gap-y-5 sm:flex sm:flex-wrap sm:divide-x sm:divide-border-soft border-t border-border-soft pt-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          {STATS.map((s) => (
            <div key={s.l} className="sm:pr-6 sm:mr-6 sm:last:mr-0 sm:last:pr-0">
              <div className="mono text-[1.9rem] font-bold text-text-primary leading-none">{s.v}</div>
              <div className="text-[0.76rem] text-text-muted mt-2 uppercase tracking-wide">{s.l}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
