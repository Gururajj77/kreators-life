import { Component, useEffect, type ReactNode } from 'react';
import { useRouteError } from 'react-router';
import { BTN_MD } from '../lib/ui';

const sent = new Set<string>();

/**
 * Tells Logs that something broke in this browser (`POST /api/public/client-error`, which keeps a short message and the page, never who,
 * limited per address): the error's name, its words and where in the code it was thrown. Each different message once a page load, at most
 * five, so a loop can never flood it. Refusals the screens already handle (an ApiError, a cancelled request) and the browser's own noise
 * (a ResizeObserver note, another site's "Script error.") are left out.
 */
export function reportError(err: unknown): void {
  if (err && typeof err === 'object' && 'status' in err) return; // an ApiError: the screen that asked shows it
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Unknown error');
  if (e.name === 'AbortError' || /ResizeObserver loop|^Script error\.?$/i.test(e.message)) return;
  const frame = (e.stack ?? '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /\/assets\/|\.tsx?:|\.js:/.test(l));
  const where = frame ? ` @ ${frame.replace(/^at\s+/, '').replace(window.location.origin, '')}` : '';
  const message = `${e.name}: ${e.message}${where}`.replace(/\s+/g, ' ').slice(0, 200);
  if (sent.has(message) || sent.size >= 5) return;
  sent.add(message);
  try {
    void fetch('/api/public/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* nothing more to do */
  }
}

/** Errors thrown outside drawing (a tap's handler, a timer, a promise nobody waited for) reach Logs too. Started once, in main.tsx. */
export function reportUncaught(): void {
  window.addEventListener('error', (e) => reportError(e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason));
}

/**
 * The app's one error catcher (2026-11-17, the founder: the app broke on refresh on his phone, and with no catcher an error while drawing
 * left a blank page). When anything throws while a screen draws, the page says so in plain words, shows the error's own line so it can be
 * passed on, and offers Reload and Home, instead of going blank; the error goes to Logs. It sits round the whole app, so it never depends
 * on a provider, the router or the theme's JavaScript.
 */
export class CrashCatcher extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown) {
    reportError(error);
  }

  render() {
    return this.state.error ? <CrashScreen error={this.state.error} /> : this.props.children;
  }
}

/**
 * The router's own error page (`errorElement` on the root route in App.tsx). React Router catches an error thrown while a page draws
 * before any boundary round the app can, and its default page ("Unexpected Application Error!", a developer note) has no way out and tells
 * nobody, which is what the founder's phone showed on refresh (2026-11-17). This shows the same plain screen as the catcher and reports it.
 */
export function RouteCrash() {
  const raw = useRouteError();
  const error = raw instanceof Error ? raw : new Error(typeof raw === 'string' ? raw : 'The page could not be drawn.');
  useEffect(() => reportError(raw), [raw]);
  return <CrashScreen error={error} />;
}

/** What a broken page shows: plain words, the error's own line so it can be passed on, Reload and Home. Nothing here can throw again. */
function CrashScreen({ error }: { error: Error }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-center gap-sm px-md py-xl" role="alert">
      <h1 className="m-0 text-title2">This page stopped working</h1>
      <p className="m-0 text-subhead text-ink-soft">Reload to try again. If it keeps happening, send this line to the team:</p>
      <p className="m-0 rounded-tile bg-card p-sm font-mono text-footnote [overflow-wrap:anywhere]">
        {error.name}: {error.message}
      </p>
      <div className="flex flex-wrap gap-xs">
        <button type="button" onClick={() => window.location.reload()} className={`toy btn-primary inline-flex items-center justify-center rounded-pill bg-ink px-md text-headline text-on-ink ${BTN_MD}`}>
          Reload
        </button>
        <a href="/home" className={`toy toy-ink btn-outline inline-flex items-center justify-center rounded-pill border border-ink/30 bg-card-strong px-md text-headline text-ink ${BTN_MD}`}>
          Go to Home
        </a>
      </div>
    </main>
  );
}
