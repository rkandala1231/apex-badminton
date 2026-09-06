import { useAdminRegistrations, usePlayers } from '../../lib/queries';
import { COLLEGES } from '../../lib/matchCenterData';
import { EmptyState } from '../matchcenter/shared';

export function AdminPlayersSection() {
  const { data: registrations, isLoading } = useAdminRegistrations(true);
  // Real roster, populated as of the Player Statistics feature -- Live Scoring's setup screen and
  // the admin Schedule form now write real players.id rows here via PlayerPicker, instead of the
  // old always-empty static PLAYERS constant this section used to read.
  const { data: players } = usePlayers();

  return (
    <div>
      <h1 className="text-[1.8rem] mb-1.5">Players</h1>
      <p className="text-[0.95rem] mb-6 max-w-[60ch] text-text-secondary">
        Players are added as they're picked in Live Scoring or the Schedule form — there's no
        separate roster upload yet. Grouped by college, checked against the roster size their
        captain claimed at registration.
      </p>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        {COLLEGES.map((c) => {
          const reg = (registrations || []).find((r) => r.college_name === c);
          const roster = (players || []).filter((p) => p.college === c);
          return (
            <div key={c} className="bg-surface-1 border border-border rounded-2xl p-5">
              <h3 className="font-sans normal-case font-extrabold text-[0.98rem] text-text-primary mb-2.5">{c}</h3>
              {isLoading ? (
                <div className="h-4 w-28 bg-surface-3 rounded animate-pulse" />
              ) : reg ? (
                <p className="text-[0.82rem] text-text-muted">
                  {reg.roster_size ?? '—'} players claimed at registration
                  <span className="block mt-0.5 capitalize">{reg.status}</span>
                </p>
              ) : (
                <p className="text-[0.82rem] text-text-muted">Not registered yet.</p>
              )}
              <p className="text-[0.8rem] text-text-secondary mt-3 pt-3 border-t border-border-soft">
                {roster.length === 0 ? 'No named players yet' : `${roster.length} named`}
              </p>
            </div>
          );
        })}
      </div>

      <EmptyState text="Individual player names, years, and event entries will populate here once rosters are submitted." />
    </div>
  );
}
