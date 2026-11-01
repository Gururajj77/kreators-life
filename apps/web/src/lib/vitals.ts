/**
 * Real-user page speed, with no library and nothing stored. It watches the browser's own timings (the largest
 * paint, layout shifts, the slowest tap or key press, and the first byte), and when the person leaves or hides the
 * page it sends one small note: the route pattern (never a real id or a query string), five numbers, the kind of
 * screen and the kind of connection. No user id, no cookie, no storage. It stays silent when the browser says
 * Do Not Track or Global Privacy Control, and when the endpoint answers anything but yes (404, 429, offline).
 */
type Report = { route: string; lcp: number; inp: number; cls: number; ttfb: number; device: 'phone' | 'desktop'; conn: string };

const ENDPOINT = '/api/public/vitals';

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  const win = window as Window & { doNotTrack?: string };
  return nav.doNotTrack === '1' || win.doNotTrack === '1' || nav.globalPrivacyControl === true;
}

/** Keeps a route pattern to plain path characters, so nothing odd can ride along. */
function cleanRoute(r: string): string {
  const s = (r.split(/[?#]/)[0] ?? '').replace(/[^A-Za-z0-9/:_*.\-]/g, '');
  return (s || '/').slice(0, 80);
}

export function startVitals(currentRoute: () => string): void {
  try {
    if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;
    if (optedOut()) return;

    let lcp = 0;
    let lcpDone = false;
    let cls = 0;
    let inp = 0;
    let route = '';
    let sent = false;

    const watch = (type: string, onEntries: (entries: PerformanceEntryList) => void, extra: Record<string, unknown> = {}) => {
      try {
        const po = new PerformanceObserver((list) => onEntries(list.getEntries()));
        po.observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
      } catch {
        /* this browser does not report it */
      }
    };

    watch('largest-contentful-paint', (entries) => {
      if (!route) route = cleanRoute(currentRoute());
      if (lcpDone) return;
      const last = entries[entries.length - 1];
      if (last) lcp = last.startTime;
    });
    // The largest paint is settled by the first tap or key press, as the browsers define it.
    const settle = () => {
      lcpDone = true;
    };
    addEventListener('keydown', settle, { once: true, capture: true });
    addEventListener('pointerdown', settle, { once: true, capture: true });

    watch('layout-shift', (entries) => {
      for (const e of entries as unknown as { value: number; hadRecentInput: boolean }[]) {
        if (!e.hadRecentInput) cls += e.value;
      }
    });

    watch(
      'event',
      (entries) => {
        for (const e of entries as unknown as { interactionId?: number; duration: number }[]) {
          if (!e.interactionId) continue;
          if (e.duration > inp) inp = e.duration;
        }
      },
      { durationThreshold: 40 },
    );

    const report = () => {
      if (sent) return;
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const ttfb = nav ? nav.responseStart : 0;
      // Nothing was measured (a background tab, an old browser): there is nothing worth sending.
      if (!lcp && !ttfb) return;
      sent = true;
      const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? '';
      const body: Report = {
        route: route || cleanRoute(currentRoute()),
        lcp: Math.round(lcp),
        inp: Math.round(inp),
        cls: Math.round(cls * 1000) / 1000,
        ttfb: Math.round(ttfb),
        device: window.innerWidth < 768 ? 'phone' : 'desktop',
        conn: String(conn).slice(0, 12),
      };
      const json = JSON.stringify(body);
      try {
        if (navigator.sendBeacon?.(ENDPOINT, new Blob([json], { type: 'application/json' }))) return;
      } catch {
        /* fall through to fetch */
      }
      void fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: json, keepalive: true, credentials: 'omit' }).catch(() => {});
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') report();
    });
    addEventListener('pagehide', report);
  } catch {
    /* page speed notes must never get in the way of the page */
  }
}
