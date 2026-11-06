import { TRACKED_EVENTS, type TrackedEvent } from '@kreators/shared';
import type { Context, Next } from 'hono';
import { LIMITS, type LimitName } from './limits';
import type { AppEnv, Env } from './env';
import { newId, nowIso } from './db';
import { fetchT, TIMEOUT } from './http';

/**
 * The operator's plumbing: transactional email through an outbox, an event timeline per order or booking,
 * product analytics, and rate limits. Each works without any key; keys make them reach further.
 */

/** Queue an email. Sent through Resend when RESEND_API_KEY is set; otherwise kept in the outbox so the admin can see it. */
export async function sendEmail(db: D1Database, env: Env, msg: { userId?: string | null; to: string | null | undefined; subject: string; body: string; marketing?: boolean; /** The words hold a live link (a password reset): the outbox keeps a note, not the link. */ private?: boolean }): Promise<void> {
  if (!msg.to) return;
  const id = newId();
  const now = nowIso();
  let status: 'sent' | 'failed' | 'skipped' = 'skipped';
  let error = '';
  let body = msg.body;
  let headers: Record<string, string> | undefined;
  // Marketing mail is never sent without a yes the person gave on their own, and always carries a postal address and a one-click way out.
  // Receipts and password resets are not marketing and are not affected by that choice.
  let blocked = '';
  if (msg.marketing) {
    const said = msg.userId ? await db.prepare("SELECT granted FROM user_consents WHERE user_id = ? AND purpose = 'marketing'").bind(msg.userId).first<{ granted: number }>() : null;
    if (!msg.userId || said?.granted !== 1) blocked = 'no yes to marketing mail from this person';
    else if (!env.BUSINESS_ADDRESS?.trim()) blocked = 'no business address is set for the footer';
    else {
      const link = `${env.PUBLIC_URL ?? ''}/unsubscribe/${await unsubscribeToken(env, msg.userId)}`;
      body = `${msg.body}\n\n--\nYou get this because you said yes to news and offers. Unsubscribe: ${link}\n${env.BUSINESS_NAME ?? 'kreators.app'}, ${env.BUSINESS_ADDRESS}`;
      headers = { 'List-Unsubscribe': `<${link}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
    }
  }
  if (blocked) error = blocked;
  else if (env.RESEND_API_KEY) {
    try {
      const res = await fetchT('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
        body: JSON.stringify({ from: env.EMAIL_FROM ?? 'kreators.app <hello@kreators.life>', to: [msg.to], subject: msg.subject, text: body, ...(headers ? { headers } : {}) }),
      }, TIMEOUT.quick);
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
    .bind(id, msg.userId ?? null, msg.to, msg.subject.slice(0, 200), msg.private ? '(the link in this mail is not kept)' : body.slice(0, 5000), status, error, now, status === 'sent' ? now : null)
    .run();
}

/** One line in an order's or booking's timeline. */
export async function logEvent(db: D1Database, entity: 'order' | 'booking' | 'user' | 'kyc' | 'call', entityId: string, type: string, data: unknown = ''): Promise<void> {
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

export const ipOf = (c: Context<AppEnv>) => c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'local';

/** Middleware: the named limit from limits.ts, per address, or per person once there is a session. */
export function rateLimit(name: LimitName, by?: 'address', when?: 'discountCode' | 'appPrefs') {
  const { max, windowSec } = LIMITS[name];
  return async (c: Context<AppEnv>, next: Next) => {
    // A limit that counts only code tries looks at the body (Hono keeps it, so the route still reads it).
    if (when === 'discountCode') {
      const body = await c.req.json<{ discountCode?: unknown }>().catch(() => null);
      if (!body || typeof body.discountCode !== 'string' || !body.discountCode.trim()) return next();
    }
    // A profile save counts against `prefs` only when it carries the app groups' arrangement.
    if (when === 'appPrefs') {
      const body = await c.req.json<{ appPrefs?: unknown }>().catch(() => null);
      if (!body || body.appPrefs === undefined) return next();
    }
    // `by: 'address'` counts the address even for a signed-in person, so one address cannot try codes through many accounts.
    const who = by === 'address' ? ipOf(c) : (c.get('user')?.id ?? ipOf(c));
    if (await limited(c.env.DB, `${name}${by === 'address' ? ':ip' : ''}:${who}`, max, windowSec)) return c.json({ error: 'too many tries, wait a minute' }, 429);
    await next();
  };
}

/** SHA-256 as hex, for salted hashes. */
export async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The token in an unsubscribe link: the person's id and a hash only this server can make. */
export async function unsubscribeToken(env: Env, userId: string): Promise<string> {
  return `${userId}.${(await sha(`${env.CLICK_SALT ?? 'kreators-local'}:unsubscribe:${userId}`)).slice(0, 24)}`;
}
