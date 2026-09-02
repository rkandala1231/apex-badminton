import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function SectionHead({ num, title, children }: { num: string; title: string; children: ReactNode }) {
  return (
    <motion.div
      className="relative flex flex-col gap-3.5 max-w-[60ch] mb-8 md:mb-10"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <span
        className="absolute -top-3 md:-top-6 -left-1 font-display text-[clamp(4rem,11vw,7.5rem)] leading-none text-text-primary/[0.045] select-none pointer-events-none"
        aria-hidden="true"
      >
        {num}
      </span>
      <div className="relative flex flex-col gap-3.5">
        <h2 className="text-[clamp(2rem,4.2vw,3rem)] leading-[1.02]">{title}</h2>
        <p className="text-[1.05rem]">{children}</p>
      </div>
    </motion.div>
  );
}
