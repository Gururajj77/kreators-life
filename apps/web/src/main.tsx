import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App, routePattern } from './App';
import { CelebrationProvider } from './components/Celebration';
import { ApiError } from './lib/api';
import { useSession } from './lib/store';
import './app.css';

// Read data counts as fresh for 30 seconds, so moving between screens and back to a tab does not ask the server again
// each time (the screens that change something refresh what they changed). One retry, and none for a refusal such as
// 401, 403 or 404, which a second try would only repeat.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, err) => count < 1 && !(err instanceof ApiError && err.status >= 400 && err.status < 500),
    },
  },
});

// A change of account (signing out, or another session on the same device) drops every cached answer, so the next person never
// sees the last one's data, not even for a moment (Emerging's one query per day is not keyed by person).
let lastToken = useSession.getState().token;
useSession.subscribe((s) => {
  if (s.token === lastToken) return;
  if (lastToken) queryClient.clear();
  lastToken = s.token;
});

// Page speed notes load beside the app, not in its first download. The browser keeps the timings it took before (buffered), so
// nothing is missed by starting a moment later.
import('./lib/vitals').then((v) => v.startVitals(routePattern), () => {});

// Motion's animation, drag and layout code is fetched as the app starts rather than with the first download (lib/motionFeatures.ts).
// Asked for here, before the first render, so it arrives while the first screen is drawn.
const motionFeatures = import('./lib/motionFeatures').then((r) => r.default);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <LazyMotion features={() => motionFeatures}>
      <QueryClientProvider client={queryClient}>
        <CelebrationProvider>
          <App />
        </CelebrationProvider>
      </QueryClientProvider>
    </LazyMotion>
  </StrictMode>,
);
