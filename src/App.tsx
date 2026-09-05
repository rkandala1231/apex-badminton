import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Home } from './pages/Home';

// Route-based code splitting: only Home (the landing page most visitors hit first) loads eagerly.
// Everything else -- Register, Tournament, Formats, Analytics, the whole Match Center, and Admin --
// is its own lazy chunk, so a visitor to `/` doesn't pay for code they'll never run. This is what
// the "main JS bundle ~813 KB" punch-list item was flagging.
const Register = lazy(() => import('./pages/Register').then((m) => ({ default: m.Register })));
const TournamentPage = lazy(() =>
  import('./pages/TournamentPage').then((m) => ({ default: m.TournamentPage }))
);
const FormatsPage = lazy(() =>
  import('./pages/FormatsPage').then((m) => ({ default: m.FormatsPage }))
);
const AnalyticsPage = lazy(() =>
  import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage }))
);
const MatchCenter = lazy(() =>
  import('./pages/MatchCenter').then((m) => ({ default: m.MatchCenter }))
);
const ScoresSection = lazy(() =>
  import('./components/matchcenter/ScoresSection').then((m) => ({ default: m.ScoresSection }))
);
const StandingsSection = lazy(() =>
  import('./components/matchcenter/StandingsSection').then((m) => ({ default: m.StandingsSection }))
);
const DrawsSection = lazy(() =>
  import('./components/matchcenter/DrawsSection').then((m) => ({ default: m.DrawsSection }))
);
const PlayersSection = lazy(() =>
  import('./components/matchcenter/PlayersSection').then((m) => ({ default: m.PlayersSection }))
);
const ScheduleSection = lazy(() =>
  import('./components/matchcenter/ScheduleSection').then((m) => ({ default: m.ScheduleSection }))
);
const LiveStreamSection = lazy(() =>
  import('./components/matchcenter/LiveStreamSection').then((m) => ({
    default: m.LiveStreamSection,
  }))
);
const MatchKpiPage = lazy(() =>
  import('./pages/MatchKpiPage').then((m) => ({ default: m.MatchKpiPage }))
);
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })));

const LEGACY_HASH_ROUTES: Record<string, string> = {
  '#admin': '/admin',
  '#registration': '/register',
  '#tournament': '/tournament',
  '#formats': '/formats',
  '#analytics': '/analytics',
  '#mission': '/',
};

/** Redirects old single-page hash links (from the previous site structure) to their new routes. */
function LegacyHashRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const target = LEGACY_HASH_ROUTES[window.location.hash];
    if (target) {
      navigate(target, { replace: true });
    }
  }, [navigate]);
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LegacyHashRedirect />
        <Suspense fallback={<div className="min-h-screen bg-bg" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/register" element={<Register />} />
            <Route path="/tournament" element={<TournamentPage />} />
            <Route path="/formats" element={<FormatsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/match-center" element={<MatchCenter />}>
              <Route path="scores" element={<ScoresSection />} />
              <Route path="standings" element={<StandingsSection />} />
              <Route path="draws" element={<DrawsSection />} />
              <Route path="players" element={<PlayersSection />} />
              <Route path="schedule" element={<ScheduleSection />} />
              <Route path="live-stream" element={<LiveStreamSection />} />
            </Route>
            <Route path="/match-center/match/:matchId" element={<MatchKpiPage />} />
            <Route path="/admin/*" element={<Admin />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1c1815',
            border: '1px solid #362f27',
            color: '#f7f3ec',
          },
        }}
      />
    </QueryClientProvider>
  );
}
