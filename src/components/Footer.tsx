export function Footer() {
  return (
    <footer className="border-t border-border-soft pt-12 pb-8">
      <div className="max-w-[1180px] mx-auto px-5 md:px-12">
        <div className="flex justify-between gap-8 flex-wrap">
          <div className="max-w-[34ch]">
            <a href="#top" className="flex items-center gap-2.5 no-underline">
              <span className="w-[30px] h-[30px] rounded-lg bg-gradient-to-br from-accent to-gold flex items-center justify-center font-display text-[#171310] text-base shrink-0">
                A
              </span>
              <span className="font-display text-lg tracking-wide">APEX</span>
            </a>
            <p className="text-[0.88rem] mt-2.5">
              The collegiate badminton championship built for every program — from club teams to varsity squads.
            </p>
          </div>
          <div className="flex gap-14 flex-wrap">
            <div>
              <h5 className="mono text-[0.7rem] tracking-[0.1em] uppercase text-text-muted mb-3 font-semibold">
                Tournament
              </h5>
              <a href="#mission" className="block no-underline text-text-secondary hover:text-accent text-[0.88rem] py-1.5">
                Mission &amp; Vision
              </a>
              <a href="#tournament" className="block no-underline text-text-secondary hover:text-accent text-[0.88rem] py-1.5">
                Schedule &amp; Venue
              </a>
              <a href="#formats" className="block no-underline text-text-secondary hover:text-accent text-[0.88rem] py-1.5">
                Formats
              </a>
            </div>
            <div>
              <h5 className="mono text-[0.7rem] tracking-[0.1em] uppercase text-text-muted mb-3 font-semibold">Compete</h5>
              <a href="#registration" className="block no-underline text-text-secondary hover:text-accent text-[0.88rem] py-1.5">
                Registration
              </a>
              <a href="#analytics" className="block no-underline text-text-secondary hover:text-accent text-[0.88rem] py-1.5">
                Analytics
              </a>
            </div>
            <div>
              <h5 className="mono text-[0.7rem] tracking-[0.1em] uppercase text-text-muted mb-3 font-semibold">Contact</h5>
              <a
                href="mailto:info@apexbadminton.example"
                className="block no-underline text-text-secondary hover:text-accent text-[0.88rem] py-1.5"
              >
                info@apexbadminton.example
              </a>
              <a href="#top" className="block no-underline text-text-secondary hover:text-accent text-[0.88rem] py-1.5">
                Meridian, TX
              </a>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-5 border-t border-border-soft flex justify-between flex-wrap gap-2.5 text-[0.78rem] text-text-muted">
          <span>&copy; 2026&ndash;2027 Apex Collegiate Badminton Championship.</span>
          <a href="/admin" className="text-text-muted underline">
            Tournament staff login
          </a>
        </div>
      </div>
    </footer>
  );
}
