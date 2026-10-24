import { TRACKED_EVENTS, type TrackedEvent } from '@kreators/shared';
import type { Context, Next } from 'hono';
import type { AppEnv, Env } from './env';
import { newId, nowIso } from './db';

/**
 * The operator's plumbing: transactional email through an outbox, an event timeline per order or booking,
 * product analytics, and rate limits. Each works without any key; keys make them reach further.
 */

/** Queue an email. Sent through Resend when RESEND_API_KEY is set; otherwise kept in the outbox so the admin can see it. */
export async function sendEmail(db: D1Database, env: Env, msg: { userId?: string | null; to: string | null | undefined; subject: string; body: string }): Promise<void> {
  if (!msg.to) return;
  const id = newId();
  const now = nowIso();
  let status: 'sent' | 'failed' | 'skipped' = 'skipped';
  let error = '';
  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify({ from: env.EMAIL_FROM ?? 'Kreators Life <hello@kreators.life>', to: [msg.to], subject: msg.subject, text: msg.body }),
      });
      if (res.ok) status = 'sent';
      else {
        status = 'failed';
        error = `Resend answered ${res.status}`;
      }
    } catch {
      status = 'failed';
      error = 'could not reach Resend';
    }
  } else error = 'no RESEND_API_KEY on the server';
  await db
    .prepare('INSERT INTO email_outbox (id, user_id, to_email, subject, body, status, error, created_at, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, msg.userId ?? null, msg.to, msg.subject.slice(0, 200), msg.body.slice(0, 5000), status, error, now, status === 'sent' ? now : null)
    .run();
}

/** One line in an order's or booking's timeline. */
export async function logEvent(db: D1Database, entity: 'order' | 'booking' | 'user' | 'kyc', entityId: string, type: string, data: unknown = ''): Promise<void> {
  await db.prepare('INSERT INTO timeline_events (id, entity, entity_id, type, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId(), entity, entityId, type, typeof data === 'string' ? data : JSON.stringify(data).slice(0, 2000), nowIso()).run();
}

/** Product analytics, kept in our own table so funnels work without a third party. */
export async function track(db: D1Database, userId: string | null, name: TrackedEvent, props: Record<string, unknown> = {}): Promise<void> {
  if (!(TRACKED_EVENTS as readonly string[]).includes(name)) return;
  await db.prepare('INSERT INTO analytics_events (id, user_id, name, props_json, created_at) VALUES (?, ?, ?, ?, ?)').bind(newId(), userId, name, JSON.stringify(props).slice(0, 1000), nowIso()).run();
}

/** True when the key has gone over `max` hits in the current window. One row per key, reset when the window turns. */
export async function limited(db: D1Database, key: string, max: number, windowSec: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSec);
  await db
    .prepare('INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window_start = ?2 THEN count + 1 ELSE 1 END, window_start = ?2')
    .bind(key, windowStart)
    .run();
  const row = await db.prepare('SELECT count FROM rate_limits WHERE key = ?').bind(key).first<{ count: number }>();
  return (row?.count ?? 0) > max;
}

const ipOf = (c: Context<AppEnv>) => c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'local';

/** Middleware: `max` requests per `windowSec` per IP (or per person when there is a session). */
export function rateLimit(name: string, max: number, windowSec: number) {
  return async (c: Context<AppEnv>, next: Next) => {
    const who = c.get('user')?.id ?? ipOf(c);
    if (await limited(c.env.DB, `${name}:${who}`, max, windowSec)) return c.json({ error: 'too many tries, wait a minute' }, 429);
    await next();
  };
}
