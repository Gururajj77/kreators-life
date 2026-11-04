import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from './env';

/**
 * The app's own log: what changed, where, by whom, and what went wrong. Super admins read it (Observability, Logs).
 * It keeps a line, never a request: no body, no query string, and ids in the path are replaced. The areas below are the person's own
 * and leave nothing but a bare server-error line, with no name and no path.
 */
export type LogLevel = 'info' | 'warn' | 'error';
const PRIVATE_AREAS = new Set(['journal', 'wellbeing', 'companion', 'discover', 'assistant']);
const KEEP_DAYS = 30;
/** A plain read that takes longer than this is logged as a warning ("slow read"), so slow screens show up in Logs with their time. */
export const SLOW_READ_MS = 1500;

export interface LogLine {
  level: LogLevel;
  area: string;
  method?: string;
  path?: string;
  status?: number;
  ms?: number;
  actorId?: string | null;
  actorName?: string | null;
  message?: string;
}

/** `/api/community/3f2a.../reply` becomes `/community/:id/reply`. */
export function cleanPath(path: string): string {
  const parts = path.replace(/^\/api/, '').split('/');
  // The address of a client link, agreement, invoice or document is its key: it never reaches the log (parts[0] is empty, so /public/agency/<token> is at 3).
  // A page of the app that holds one (/a/<token>, /k/, /i/, /d/) is named the same way.
  const at = parts[1] === 'public' && (parts[2] === 'agency' || parts[2] === 'contracts' || parts[2] === 'invoices') ? (parts[2] === 'agency' && parts[3] === 'doc' ? 4 : 3) : ['a', 'k', 'i', 'd'].includes(parts[1] ?? '') ? 2 : -1;
  return parts
    .map((seg, i) => (i === at && seg ? ':token' : /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) || /^[0-9a-f]{16,}$/i.test(seg) || /^\d{5,}$/.test(seg) ? ':id' : seg))
    .join('/')
    .slice(0, 160);
}
export const areaOf = (clean: string): string => clean.split('/')[1] || 'core';

export async function writeLog(db: D1Database, line: LogLine): Promise<void> {
  try {
    await db
      .prepare('INSERT INTO app_logs (at, level, area, method, path, status, ms, actor_id, actor_name, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(new Date().toISOString(), line.level, line.area.slice(0, 40), line.method ?? '', line.path ?? '', line.status ?? 0, Math.round(line.ms ?? 0), line.actorId ?? null, line.actorName ?? null, (line.message ?? '').slice(0, 300))
      .run();
  } catch {
    // a log line must never break the request it describes
  }
}

/** Old lines go after thirty days. Run by the cron. */
export async function pruneLogs(db: D1Database): Promise<number> {
  const done = await db.prepare('DELETE FROM app_logs WHERE at < ?').bind(new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString()).run();
  return done.meta.changes ?? 0;
}

/**
 * Wraps every API call. A change (anything but a read), a refusal, a failure: a line. A plain read that worked: nothing, so the log stays
 * readable, unless it took SLOW_READ_MS or more (then a warning with its time). Sign-in failures count (they show who is trying), a missing session does not (it is every signed-out visitor).
 */
export const logger = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const started = Date.now();
  await next();
  const method = c.req.method;
  if (method === 'OPTIONS') return;
  const clean = cleanPath(new URL(c.req.url).pathname);
  if (clean === '/health' || clean.startsWith('/internal/logs') || clean === '/public/client-error' || clean === '/public/vitals') return;
  const status = c.res.status;
  const area = areaOf(clean);
  const user = c.get('user') as { id: string; display_name: string } | undefined;
  const note = (c.get('logNote') as string | undefined) ?? '';
  const took = Date.now() - started;
  let level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  let message = note;
  if (level === 'info' && method === 'GET') {
    // A read that worked is not a line, unless it was slow.
    if (took < SLOW_READ_MS) return;
    level = 'warn';
    message = note || 'slow read';
  }
  if (status === 401 && !clean.startsWith('/auth/')) return;
  const run = (p: Promise<void>) => {
    try {
      c.executionCtx.waitUntil(p);
    } catch {
      void p;
    }
  };
  if (PRIVATE_AREAS.has(area)) {
    if (level === 'error') run(writeLog(c.env.DB, { level, area: 'private', status, ms: Date.now() - started, message: 'a server error in a private area' }));
    return;
  }
  // A team member working on someone's Agency is named, not the owner whose agency it is.
  const team = c.get('team');
  run(writeLog(c.env.DB, { level, area, method, path: clean, status, ms: took, actorId: team?.memberId ?? user?.id ?? null, actorName: team?.memberName ?? user?.display_name ?? null, message }));
};

/** What the browser reports when a screen breaks. No person, no body: a short message and the screen it happened on. */
export async function writeClientError(c: Context<AppEnv>, body: { message?: unknown; path?: unknown }): Promise<void> {
  const message = typeof body.message === 'string' ? body.message.replace(/\s+/g, ' ').slice(0, 200) : '';
  const path = typeof body.path === 'string' ? cleanPath(body.path.split('?')[0]!.split('#')[0]!) : '';
  if (!message) return;
  await writeLog(c.env.DB, { level: 'error', area: 'client', method: 'GET', path, message });
}
