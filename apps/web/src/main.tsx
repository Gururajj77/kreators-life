import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App, routePattern } from './App';
import { CelebrationProvider } from './components/Celebration';
import { ApiError } from './lib/api';
import { startVitals } from './lib/vitals';
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

startVitals(routePattern);

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <CelebrationProvider>
        <App />
      </CelebrationProvider>
    </QueryClientProvider>
  </StrictMode>,
);
