import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/register', label: 'Register' },
  { to: '/tournament', label: 'Tournament' },
  { to: '/match-center', label: 'Match Center' },
  { to: '/formats', label: 'Formats' },
  { to: '/analytics', label: 'Analytics' },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 bg-bg/86 backdrop-blur-md border-b border-border-soft">
      <div className="max-w-[1180px] mx-auto flex items-center justify-between gap-6 px-5 md:px-12 py-3.5">
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <span className="w-[30px] h-[30px] rounded-lg bg-gradient-to-br from-accent to-gold flex items-center justify-center font-display text-[#171310] text-base shrink-0">
            A
          </span>
          <span className="font-display text-lg tracking-wide">APEX</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            to="/register"
            className="hidden sm:inline-flex items-center justify-center gap-2 rounded-full font-bold text-sm px-5 py-2.5 bg-accent text-[#181310] hover:bg-accent-hover transition-colors no-underline"
          >
            Register Now
          </Link>
          <button
            className="flex items-center justify-center w-[38px] h-[38px] rounded-lg border border-border text-text-primary hover:border-accent hover:text-accent transition-colors"
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
            className="overflow-hidden border-t border-border-soft"
          >
            <div className="max-w-[1180px] mx-auto px-5 md:px-12">
              <div className="flex flex-col py-2">
                {LINKS.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={`no-underline font-semibold text-[0.98rem] py-3.5 border-b border-border-soft transition-colors ${
                      location.pathname === l.to || (l.to !== '/' && location.pathname.startsWith(l.to))
                        ? 'text-accent'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
