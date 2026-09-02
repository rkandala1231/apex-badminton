import { Link } from 'react-router-dom';
import { SectionHead } from '../ui/SectionHead';
import { Reveal } from '../ui/Reveal';
import { Bracket } from '../charts/Bracket';

const CARDS = [
  {
    k: 'When',
    v: 'Sat, November 7, 2026',
    d: 'One day. Pool play runs in the morning, knockout rounds in the afternoon.',
  },
  {
    k: 'Where',
    v: 'TBD',
    d: 'Venue to be announced — check back or watch your confirmation email.',
  },
  {
    k: 'Structure',
    v: 'Pools → Knockout',
    d: 'Round-robin pools of four, top two advance to a single-elimination bracket.',
  },
  {
    k: 'Awards',
    v: 'Champion + Team Cup',
    d: 'Champion & runner-up per event, an All-Tournament Team, and the Apex Team Championship trophy.',
  },
];

export function Tournament() {
  return (
    <section id="tournament" className="py-16 md:py-24">
      <div className="max-w-[1180px] mx-auto px-5 md:px-12">
        <SectionHead num="03" title="The Tournament">
          One Saturday. Every division. One champion per event.
        </SectionHead>

        <Reveal>
          <Link
            to="/match-center/scores"
            className="inline-flex items-center gap-2 rounded-full font-bold text-sm px-5 py-2.5 mb-9 bg-transparent text-accent border border-accent hover:bg-accent-soft transition-colors no-underline active:scale-95"
          >
            Open Match Center — scores, draws, players &amp; schedule
          </Link>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          {CARDS.map((c, i) => (
            <Reveal key={c.k} delay={i * 0.06}>
              <div className="bg-surface-1 border border-border rounded-2xl p-6.5 flex flex-col gap-1.5 h-full">
                <div className="mono text-[0.7rem] tracking-[0.1em] text-text-muted uppercase">{c.k}</div>
                <div className="text-[1.35rem] font-extrabold text-text-primary">{c.v}</div>
                <div className="text-[0.88rem] text-text-muted mt-0.5">{c.d}</div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="bg-surface-1 border border-border rounded-2xl p-5 md:p-8 overflow-x-auto">
            <Bracket />
            <div className="flex gap-5.5 flex-wrap mt-4.5 text-[0.82rem] text-text-muted">
              <span className="inline-flex items-center gap-2">
                <i className="w-2.5 h-2.5 rounded-[3px] inline-block bg-ev-ms" />
                Pool stage (round robin, pools of 4)
              </span>
              <span className="inline-flex items-center gap-2">
                <i className="w-2.5 h-2.5 rounded-[3px] inline-block bg-accent" />
                Knockout (top 2 per pool advance)
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
