import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Nav } from './Nav';
import { Footer } from './Footer';

export function PageShell({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} — Apex Collegiate Badminton`;
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <>
      <Nav />
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.main>
      <Footer />
    </>
  );
}
