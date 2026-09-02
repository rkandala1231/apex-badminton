import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Home } from './pages/Home';
import { Register } from './pages/Register';
import { TournamentPage } from './pages/TournamentPage';
import { FormatsPage } from './pages/FormatsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { MatchCenter } from './pages/MatchCenter';
import { ScoresSection } from './components/matchcenter/ScoresSection';
import { DrawsSection } from './components/matchcenter/DrawsSection';
import { PlayersSection } from './components/matchcenter/PlayersSection';
import { ScheduleSection } from './components/matchcenter/ScheduleSection';
import { LiveStreamSection } from './components/matchcenter/LiveStreamSection';

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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/tournament" element={<TournamentPage />} />
          <Route path="/formats" element={<FormatsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/match-center" element={<MatchCenter />}>
            <Route path="scores" element={<ScoresSection />} />
            <Route path="draws" element={<DrawsSection />} />
            <Route path="players" element={<PlayersSection />} />
            <Route path="schedule" element={<ScheduleSection />} />
            <Route path="live-stream" element={<LiveStreamSection />} />
          </Route>
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={<div className="min-h-screen bg-bg" />}>
                <Admin />
              </Suspense>
            }
          />
        </Routes>
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
