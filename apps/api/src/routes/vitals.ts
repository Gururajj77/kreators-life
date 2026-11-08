import { Hono } from 'hono';
import type { Env } from '../env';
import { cleanPath } from '../logs';

/**
 * Real-user page speed (Core Web Vitals), from the browser, with nothing that points at a person.
 *
 * `POST /api/public/vitals` takes one note a page view: `{ route, lcp, inp, cls, ttfb, device, conn }`. We keep the route pattern (ids
 * removed), the kind of screen, a short connection label and the numbers. We never keep a user id, an address, a user agent or a
 * cookie: the table has no column for them. Rows go after VITALS_KEEP_DAYS (`tidyOld` in cron.ts). `vitalsSummary` gives
 * Observability the 75th percentile per route and device, which is the number Google judges a page by.
 */
export const vitalsPublic = new Hono<{ Bindings: Env }>();

/** Rows older than this are deleted by the cron. */
export const VITALS_KEEP_DAYS = 90;
/** The most rows read to make a summary; the newest ones win. */
export const VITALS_SUMMARY_ROWS = 5000;
const MAX_BODY_CHARS = 1024;
const MAX_ROUTE_CHARS = 80;
const MAX_ROUTE_SEGMENTS = 6;
/** Nothing real takes a minute; anything over is a stuck tab or a lie, and would drag a percentile. */
const MAX_MS = 60_000;
const MAX_CLS = 10;

/** What "good" and "poor" mean for each number (web.dev): good at or under the first, poor over the second. CLS is a ratio. */
export const VITALS_RATING = {
  lcp: { good: 2500, poor: 4000 },
  inp: { good: 200, poor: 500 },
  cls: { good: 0.1, poor: 0.25 },
  ttfb: { good: 800, poor: 1800 },
} as const;
export type VitalMetric = keyof typeof VITALS_RATING;
export type VitalRating = 'good' | 'needs work' | 'poor';

export const rateVital = (metric: VitalMetric, value: number | null): VitalRating | null => {
  if (value === null) return null;
  const r = VITALS_RATING[metric];
  return value <= r.good ? 'good' : value <= r.poor ? 'needs work' : 'poor';
};

/**
 * A route pattern like `/store/:id`, with anything that looks like an id turned into `:id`, only plain path characters, at most six
 * segments and eighty characters. Returns null when nothing usable is left.
 */
export function cleanVitalsRoute(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const base = (raw.split(/[?#]/)[0] ?? '').replace(/[^A-Za-z0-9/:_*.\-]/g, '');
  if (!base.startsWith('/')) return null;
  const segments = cleanPath(base)
    .split('/')
    .filter(Boolean)
    .slice(0, MAX_ROUTE_SEGMENTS)
    // A long mixed run of letters and digits is an id or a token, not a page name.
    .map((s) => (s.startsWith(':') ? s : /^(?=.*\d)[A-Za-z0-9_-]{12,}$/.test(s) ? ':id' : s));
  return `/${segments.join('/')}`.slice(0, MAX_ROUTE_CHARS);
}

/** A whole number of milliseconds from 1 to MAX_MS, or null (the browser sends 0 for "did not happen"). */
const ms = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(Math.round(v), MAX_MS) : null);
/** Layout shift in thousandths (0.1 is 100). Zero is a real answer here: a page that did not shift. */
const clsMilli = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(Math.min(v, MAX_CLS) * 1000), MAX_CLS * 1000) : null);

vitalsPublic.post('/vitals', async (c) => {
  const raw = await c.req.text().catch(() => '');
  if (!raw || raw.length > MAX_BODY_CHARS) return c.json({ error: 'bad note' }, 400);
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    body = parsed as Record<string, unknown>;
  } catch {
    return c.json({ error: 'bad note' }, 400);
  }
  const route = cleanVitalsRoute(body.route);
  const device = body.device === 'phone' || body.device === 'desktop' ? body.device : null;
  if (!route || !device) return c.json({ error: 'bad note' }, 400);
  const lcp = ms(body.lcp);
  const inp = ms(body.inp);
  const ttfb = ms(body.ttfb);
  // A note with no timing at all (a background tab) says nothing.
  if (lcp === null && ttfb === null && inp === null) return c.body(null, 204);
  const conn = typeof body.conn === 'string' ? (body.conn.toLowerCase().match(/^[a-z0-9-]{1,12}$/)?.[0] ?? '') : '';
  await c.env.DB.prepare('INSERT INTO web_vitals (route, device, conn, lcp_ms, inp_ms, cls_milli, ttfb_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(route, device, conn, lcp, inp, clsMilli(body.cls), ttfb, new Date().toISOString())
    .run();
  return c.body(null, 204);
});

/** Delete notes older than VITALS_KEEP_DAYS. Run by the cron. Returns how many went. */
interface VitalsRow {
  route: string;
  device: string;
  lcp_ms: number | null;
  inp_ms: number | null;
  cls_milli: number | null;
  ttfb_ms: number | null;
}

export interface VitalsSummaryRow {
  route: string;
  device: 'phone' | 'desktop';
  /** Notes behind this row. */
  samples: number;
  /** 75th percentile of each number; null when no note carried it. LCP, INP and TTFB in milliseconds, CLS as a ratio. */
  lcp: number | null;
  inp: number | null;
  cls: number | null;
  ttfb: number | null;
  rating: Record<VitalMetric, VitalRating | null>;
}

export interface VitalsSummary {
  days: number;
  since: string;
  /** Notes read. When it equals VITALS_SUMMARY_ROWS the oldest ones in the window were left out. */
  read: number;
  truncated: boolean;
  budget: typeof VITALS_RATING;
  rows: VitalsSummaryRow[];
}

/** Nearest-rank 75th percentile of the numbers that are there. */
export const p75 = (values: (number | null)[]): number | null => {
  const v = values.filter((x): x is number => x !== null).sort((a, b) => a - b);
  return v.length ? v[Math.ceil(v.length * 0.75) - 1]! : null;
};

/**
 * The 75th percentile of each number for every route and device over the last `days` days, busiest route first. Reads at most
 * VITALS_SUMMARY_ROWS of the newest notes and works the percentile out here. Staff only: the caller (an /api/internal route)
 * checks the role.
 */
export async function vitalsSummary(db: D1Database, days = 7): Promise<VitalsSummary> {
  const span = Math.max(1, Math.min(VITALS_KEEP_DAYS, Math.floor(days) || 7));
  const since = new Date(Date.now() - span * 86_400_000).toISOString();
  const rows = await db
    .prepare('SELECT route, device, lcp_ms, inp_ms, cls_milli, ttfb_ms FROM web_vitals WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?')
    .bind(since, VITALS_SUMMARY_ROWS)
    .all<VitalsRow>();
  const groups = new Map<string, VitalsRow[]>();
  for (const r of rows.results) {
    const key = `${r.route}\n${r.device}`;
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }
  const out: VitalsSummaryRow[] = [...groups.values()].map((list) => {
    const first = list[0]!;
    const lcp = p75(list.map((r) => r.lcp_ms));
    const inp = p75(list.map((r) => r.inp_ms));
    const clsRaw = p75(list.map((r) => r.cls_milli));
    const cls = clsRaw === null ? null : clsRaw / 1000;
    const ttfb = p75(list.map((r) => r.ttfb_ms));
    return {
      route: first.route,
      device: first.device === 'phone' ? 'phone' : 'desktop',
      samples: list.length,
      lcp,
      inp,
      cls,
      ttfb,
      rating: { lcp: rateVital('lcp', lcp), inp: rateVital('inp', inp), cls: rateVital('cls', cls), ttfb: rateVital('ttfb', ttfb) },
    };
  });
  out.sort((a, b) => b.samples - a.samples || a.route.localeCompare(b.route) || a.device.localeCompare(b.device));
  return { days: span, since, read: rows.results.length, truncated: rows.results.length >= VITALS_SUMMARY_ROWS, budget: VITALS_RATING, rows: out };
}
