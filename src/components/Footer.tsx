import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-border-soft pt-12 pb-8">
      <div className="max-w-[1180px] mx-auto px-5 md:px-12">
        <div className="flex justify-between gap-8 flex-wrap">
          <div className="max-w-[34ch]">
            <Link to="/" className="flex items-center gap-2.5 no-underline">
              <span className="w-[30px] h-[30px] rounded-lg bg-gradient-to-br from-accent to-gold flex items-center justify-center font-display text-[#171310] text-base shrink-0">
                A
              </span>
              <span className="font-display text-lg tracking-wide">APEX</span>
            </Link>
            <p className="text-[0.88rem] mt-2.5">
              Growing badminton. Building community. Inspiring players — across New Jersey and beyond.
            </p>
          </div>
          <div className="flex gap-14 flex-wrap">
            <div>
              <h5 className="mono text-[0.7rem] tracking-[0.1em] uppercase text-text-muted mb-3 font-semibold">
                Organization
              </h5>
              <Link to="/" className="block no-underline text-text-secondary hover:text-accent text-[0.88rem] py-1.5">
                Mission &amp; Vision
              </Link>
              <Link to="/tournament" className="block no-underline text-text-secondary hover:text-accent text-[0.88rem] py-1.5">
                Schedule &amp; Venue
              </Link>
              <Link to="/formats" className="block no-underline text-text-secondary hover:text-accent text-[0.88rem] py-1.5">
                Formats
              </Link>
            </div>
            <div>
              <h5 className="mono text-[0.7rem] tracking-[0.1em] uppercase text-text-muted mb-3 font-semibold">Compete</h5>
              <Link to="/register" className="block no-underline text-text-secondary hover:text-accent text-[0.88rem] py-1.5">
                Registration
              </Link>
              <Link to="/analytics" className="block no-underline text-text-secondary hover:text-accent text-[0.88rem] py-1.5">
                Analytics
              </Link>
            </div>
            <div>
              <h5 className="mono text-[0.7rem] tracking-[0.1em] uppercase text-text-muted mb-3 font-semibold">Contact</h5>
              <a
                href="mailto:apexclubusa@gmail.com"
                className="block no-underline text-text-secondary hover:text-accent text-[0.88rem] py-1.5"
              >
                apexclubusa@gmail.com
              </a>
              <span className="block text-text-secondary text-[0.88rem] py-1.5">New Jersey &amp; Beyond</span>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-5 border-t border-border-soft text-[0.78rem] text-text-muted">
          <span>&copy; 2026&ndash;2027 Apex Badminton Club.</span>
        </div>
      </div>
    </footer>
  );
}
