import { SCHEDULE } from '../../lib/matchCenterData';
import { EmptyState } from '../matchcenter/shared';

export function AdminScheduleSection() {
  return (
    <div>
      <h1 className="text-[1.8rem] mb-1.5">Schedule</h1>
      <p className="text-[0.95rem] mb-6 max-w-[60ch] text-text-secondary">
        Build and adjust match times and court assignments for tournament day.
      </p>

      {SCHEDULE.length === 0 ? (
        <EmptyState text="No matches scheduled yet. Once brackets are seeded, tools to assign courts and start times will appear here." />
      ) : (
        <div className="overflow-x-auto">{/* schedule editor renders here */}</div>
      )}
    </div>
  );
}
