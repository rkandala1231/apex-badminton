import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const LINKS = [
  { href: '#mission', label: 'Mission' },
  { href: '#registration', label: 'Register' },
  { href: '#tournament', label: 'Tournament' },
  { href: '#formats', label: 'Formats' },
  { href: '#analytics', label: 'Analytics' },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 bg-bg/86 backdrop-blur-md border-b border-border-soft">
      <div className="max-w-[1180px] mx-auto flex items-center justify-between gap-6 px-5 md:px-12 py-3.5">
        <a href="#top" className="flex items-center gap-2.5 no-underline">
          <span className="w-[30px] h-[30px] rounded-lg bg-gradient-to-br from-accent to-gold flex items-center justify-center font-display text-[#171310] text-base shrink-0">
            A
          </span>
          <span className="font-display text-lg tracking-wide">APEX</span>
        </a>

        <nav className="hidden md:flex items-center gap-7">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="no-underline text-[0.86rem] font-semibold text-text-secondary hover:text-text-primary transition-colors tracking-wide"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <a
            href="#registration"
            className="hidden sm:inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-2.5 bg-accent text-[#181310] hover:bg-accent-hover transition-colors no-underline"
          >
            Register Now
          </a>
          <button
            className="md:hidden flex items-center justify-center w-[38px] h-[38px] rounded-lg border border-border text-text-primary"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden overflow-hidden max-w-[1180px] mx-auto px-5"
          >
            <div className="flex flex-col pb-4">
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="no-underline text-text-secondary hover:text-text-primary font-semibold text-[0.95rem] py-3 border-b border-border-soft"
                >
                  {l.label}
                </a>
              ))}
              <a
                href="#registration"
                onClick={() => setOpen(false)}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-2.5 bg-accent text-[#181310] no-underline"
              >
                Register Now
              </a>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
