import { SectionHead } from '../ui/SectionHead';
import { Reveal } from '../ui/Reveal';

const FORMATS = [
  { name: "Men's Singles", code: 'MS', color: 'bg-ev-ms', desc: 'One player, one college. Best-of-3 games to 21, rally scoring. Straight into pool play.' },
  { name: "Women's Singles", code: 'WS', color: 'bg-ev-ws', desc: 'Same structure as MS — one player, one college, pools of four feeding the knockout bracket.' },
  { name: "Men's Doubles", code: 'MD', color: 'bg-ev-md', desc: 'Two players, one college. Chemistry matters — most pairs play together all season before Apex.' },
  { name: "Women's Doubles", code: 'WD', color: 'bg-ev-wd', desc: 'Two players, one college. Pools of four, top two advance — identical draw logic to every event.' },
  { name: 'Mixed Doubles', code: 'XD', color: 'bg-ev-xd', desc: 'One man, one woman, same college. Often the event that decides bragging rights between rival programs.' },
  { name: 'College Team', code: 'TEAM', color: 'bg-ev-team', desc: 'Dual-tie format. Each tie runs 1 MS + 1 WS + 1 MD + 1 WD + 1 XD rubber — first college to 3 wins takes it.' },
];

export function Formats() {
  return (
    <section id="formats" className="py-16 md:py-24">
      <div className="max-w-[1180px] mx-auto px-5 md:px-12">
        <SectionHead num="04" title="Tournament Formats">
          Six ways to compete — five individual events plus a dual-tie team format, all feeding the same
          pool-to-knockout structure.
        </SectionHead>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FORMATS.map((f, i) => (
            <Reveal key={f.code} delay={i * 0.05}>
              <div className="bg-surface-1 border border-border rounded-2xl p-6 flex flex-col gap-3 h-full transition-all duration-150 hover:border-accent-dim hover:-translate-y-0.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-sans normal-case font-extrabold text-[1.12rem] text-text-primary">{f.name}</h4>
                  <span className={`mono text-[0.72rem] font-bold px-2.5 py-1 rounded-md text-[#171310] ${f.color}`}>
                    {f.code}
                  </span>
                </div>
                <p className="text-[0.9rem]">{f.desc}</p>
              </div>
            </Reveal>
          ))}
          <Reveal delay={0.3} className="sm:col-span-2 lg:col-span-3">
            <div className="bg-surface-1 border border-border rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6.5">
              <div className="flex-1">
                <h4 className="font-sans normal-case font-extrabold text-[1.3rem] text-text-primary mb-2">
                  Why round robin + knockout?
                </h4>
                <p className="text-[0.9rem]">
                  Every entrant is guaranteed at least three matches in pool play before anyone is eliminated — no
                  early flameouts on a bad bounce. The top two from each pool then move into a straight knockout
                  bracket, so the back half of the weekend is win-or-go-home. It&apos;s the same structure the format
                  diagram above shows, run identically across all six events.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
