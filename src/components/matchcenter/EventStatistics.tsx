import { useState, type ReactNode } from 'react';
import { useHeadToHead, useTeamStandings } from '../../lib/queries';
import { EVENT_META, type EventCode } from '../../lib/types';
import { COLLEGES, type CollegeName } from '../../lib/matchCenterData';
import { EmptyState } from './shared';

const selectCls =
  'bg-surface-2 border border-border rounded-lg px-3 py-2 text-text-primary font-semibold text-[0.82rem]';

export function EventStatistics() {
  return (
    <div className="mt-5 flex flex-col gap-8">
      <Standings />
      <HeadToHead />
    </div>
  );
}

function Standings() {
  const [eventCode, setEventCode] = useState<EventCode | ''>('');
  const [stage, setStage] = useState<'' | 'roundrobin' | 'knockout'>('');

  const { data: rows, isLoading, isError } = useTeamStandings(eventCode || null, stage || null);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
        <h2 className="text-[1.15rem]">Standings</h2>
        <div className="flex flex-wrap gap-2">
          <select value={eventCode} onChange={(e) => setEventCode(e.target.value as EventCode | '')} className={selectCls}>
            <option value="">All events</option>
            {EVENT_META.map((e) => (
              <option key={e.code} value={e.code}>
                {e.label}
              </option>
            ))}
          </select>
          <select value={stage} onChange={(e) => setStage(e.target.value as typeof stage)} className={selectCls}>
            <option value="">All stages</option>
            <option value="roundrobin">Round Robin</option>
            <option value="knockout">Knockout</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="h-40 bg-surface-1 border border-border rounded-2xl animate-pulse" />
      ) : isError ? (
        <EmptyState text="Couldn't load standings right now. Try refreshing." />
      ) : !rows || rows.length === 0 ? (
        <EmptyState text="Standings will appear here once completed matches have been scored." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface-1">
          <table className="w-full text-[0.84rem] border-collapse min-w-[560px]">
            <thead>
              <tr className="text-left border-b border-border-soft">
                <Th className="pl-4">#</Th>
                <Th>College</Th>
                <Th align="center">Record</Th>
                <Th align="center">Games</Th>
                <Th align="center">Points</Th>
                <Th align="right" className="pr-4">
                  Diff
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.college} className={i > 0 ? 'border-t border-border-soft' : ''}>
                  <Td className="pl-4 text-text-muted">{i + 1}</Td>
                  <Td className="font-bold text-text-primary">{r.college}</Td>
                  <Td align="center" className="mono">
                    {r.matches_won}–{r.matches_lost}
                  </Td>
                  <Td align="center" className="mono text-text-secondary">
                    {r.games_won}–{r.games_lost}
                  </Td>
                  <Td align="center" className="mono text-text-secondary">
                    {r.points_won}–{r.points_lost}
                  </Td>
                  <Td align="right" className={`pr-4 mono font-bold ${r.point_diff > 0 ? 'text-accent' : r.point_diff < 0 ? 'text-text-muted' : ''}`}>
                    {r.point_diff > 0 ? '+' : ''}
                    {r.point_diff}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HeadToHead() {
  const [collegeA, setCollegeA] = useState<CollegeName>(COLLEGES[0]);
  const [collegeB, setCollegeB] = useState<CollegeName>(COLLEGES[1]);
  const [eventCode, setEventCode] = useState<EventCode | ''>('');

  const { data: h2h, isLoading, isError } = useHeadToHead(collegeA, collegeB, eventCode || null);
  const sameCollege = collegeA === collegeB;

  return (
    <div>
      <h2 className="text-[1.15rem] mb-3.5">Head-to-Head</h2>

      <div className="flex flex-wrap gap-2 mb-4">
        <select value={collegeA} onChange={(e) => setCollegeA(e.target.value as CollegeName)} className={selectCls}>
          {COLLEGES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="self-center text-text-muted text-[0.8rem] font-semibold">vs</span>
        <select value={collegeB} onChange={(e) => setCollegeB(e.target.value as CollegeName)} className={selectCls}>
          {COLLEGES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={eventCode} onChange={(e) => setEventCode(e.target.value as EventCode | '')} className={selectCls}>
          <option value="">All events</option>
          {EVENT_META.map((e) => (
            <option key={e.code} value={e.code}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      {sameCollege ? (
        <EmptyState text="Pick two different colleges to see their head-to-head record." />
      ) : isLoading ? (
        <div className="h-28 bg-surface-1 border border-border rounded-2xl animate-pulse" />
      ) : isError ? (
        <EmptyState text="Couldn't load this head-to-head record right now. Try refreshing." />
      ) : !h2h || h2h.matches_played === 0 ? (
        <EmptyState text={`No completed matches between ${collegeA} and ${collegeB} yet.`} />
      ) : (
        <div className="bg-surface-1 border border-border rounded-2xl p-5 grid grid-cols-2 gap-4 max-w-[440px]">
          <HeadToHeadSide name={collegeA} wins={h2h.college_a_wins} points={h2h.college_a_points} leading={h2h.college_a_wins > h2h.college_b_wins} />
          <HeadToHeadSide name={collegeB} wins={h2h.college_b_wins} points={h2h.college_b_points} leading={h2h.college_b_wins > h2h.college_a_wins} />
          <div className="col-span-2 text-center text-[0.74rem] text-text-muted pt-3 border-t border-border-soft mono uppercase tracking-wide">
            {h2h.matches_played} match{h2h.matches_played === 1 ? '' : 'es'} played
          </div>
        </div>
      )}
    </div>
  );
}

function HeadToHeadSide({ name, wins, points, leading }: { name: string; wins: number; points: number; leading: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-[0.85rem] font-bold mb-1 ${leading ? 'text-accent' : 'text-text-primary'}`}>{name}</div>
      <div className="font-display text-[2.2rem] leading-none mb-1">{wins}</div>
      <div className="mono text-[0.7rem] text-text-muted uppercase tracking-wide">{points} pts</div>
    </div>
  );
}

function Th({ children, align = 'left', className = '' }: { children: ReactNode; align?: 'left' | 'center' | 'right'; className?: string }) {
  return (
    <th
      className={`py-2.5 font-semibold text-[0.7rem] uppercase tracking-wide text-text-muted ${
        align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left', className = '' }: { children: ReactNode; align?: 'left' | 'center' | 'right'; className?: string }) {
  return (
    <td className={`py-2.5 ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'} ${className}`}>
      {children}
    </td>
  );
}
