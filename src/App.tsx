import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Home } from './pages/Home';

const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })));

/** Redirects the old GitHub Pages `#admin` hash link to the new `/admin` route. */
function LegacyHashRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    if (window.location.hash === '#admin') {
      navigate('/admin', { replace: true });
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
          <Route
            path="/admin"
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
