import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function SectionHead({ num, title, children }: { num: string; title: string; children: ReactNode }) {
  return (
    <motion.div
      className="flex flex-col gap-3.5 max-w-[60ch] mb-9 md:mb-14"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center gap-2.5">
        <span className="mono text-text-muted text-sm">{num}</span>
        <span className="h-px flex-1 max-w-[40px] bg-border" />
      </div>
      <h2 className="text-[clamp(2rem,4.2vw,3rem)] leading-[1.02]">{title}</h2>
      <p className="text-[1.05rem]">{children}</p>
    </motion.div>
  );
}
