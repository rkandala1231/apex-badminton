import { useState } from 'react';
import { AssessmentEntryForm } from './AssessmentEntryForm';
import { AssessmentResults } from './AssessmentResults';
import { SubTabs } from '../matchcenter/shared';

type Tab = 'new' | 'results';

/**
 * Replaces the standalone "APEX Badminton Clinic - Player Assessment" Google Form: staff record
 * each player's clinic evaluation here instead, and review it as a table + charts on the Results
 * tab. Trimmed from the original form per RK -- Event, Top Strength, and Development Priority are
 * dropped, and "Recommended Next Step / Drill" is generalized to plain Comments.
 */
export function AdminAssessmentsSection() {
  const [tab, setTab] = useState<Tab>('new');

  return (
    <div>
      <h1 className="text-[1.8rem] mb-1.5">Player Assessments</h1>
      <p className="text-[0.95rem] mb-5 max-w-[60ch] text-text-secondary">
        Record each player&apos;s clinic evaluation, then review every assessment as a table and as
        charts on the Results tab.
      </p>

      <SubTabs
        tabs={[
          { id: 'new', label: 'New Assessment' },
          { id: 'results', label: 'Results' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      <div className="mt-5">
        {tab === 'new' && <AssessmentEntryForm />}
        {tab === 'results' && <AssessmentResults />}
      </div>
    </div>
  );
}
