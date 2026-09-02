import { SCHEDULE } from '../../lib/matchCenterData';
import { EmptyState } from './shared';

export function ScheduleSection() {
  return (
    <div>
      <h1 className="text-[1.8rem] mb-1.5">Schedule</h1>
      <p className="text-[0.95rem] mb-5 max-w-[60ch]">
        All matches for tournament day, in order. Court numbers will be illustrative until the venue is
        confirmed.
      </p>

      {SCHEDULE.length === 0 ? (
        <EmptyState text="The match schedule will be posted here closer to tournament day." />
      ) : (
        <div className="overflow-x-auto">{/* schedule table renders here */}</div>
      )}
    </div>
  );
}
