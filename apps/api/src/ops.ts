import { TRACKED_EVENTS, type TrackedEvent } from '@kreators/shared';
import type { Context, Next } from 'hono';
import { LIMITS, type LimitName } from './limits';
import type { AppEnv, Env } from './env';
import { newId, nowIso, sessionUser } from './db';
import { fetchT, TIMEOUT } from './http';

/**
 * The operator's plumbing: transactional email through an outbox, an event timeline per order or booking,
 * product analytics, and rate limits. Each works without any key; keys make them reach further.
 */

/** Queue an email. Sent through Resend when RESEND_API_KEY is set; otherwise kept in the outbox so the admin can see it. */
export async function sendEmail(db: D1Database, env: Env, msg: { userId?: string | null; to: string | null | undefined; subject: string; body: string; marketing?: boolean; /** The words hold a live link (a password reset): the outbox keeps a note, not the link. */ private?: boolean }): Promise<'sent' | 'failed' | 'skipped'> {
  if (!msg.to) return 'skipped';
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
  // What happened to it: an invite's approval says whether the link went out, so the admin can copy it when mail is not set up.
  return status;
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
  // One round trip: the count comes back with the write.
  const row = await db
    .prepare('INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window_start = ?2 THEN count + 1 ELSE 1 END, window_start = ?2 RETURNING count')
    .bind(key, windowStart)
    .first<{ count: number }>();
  return (row?.count ?? 0) > max;
}

export const ipOf = (c: Context<AppEnv>) => c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'local';

/**
 * What a count's key holds in place of an address or a typed email (the founder, 2026-11-07): a salted hash, so rate_limits holds neither. The same words
 * always give the same key, so a limit counts as it did. The salt is the one the /go redirect uses, with the same fallback, so a limit still counts on a
 * server with none set; `:limit:` keeps these apart from a click's hash, so the two tables cannot be joined on it.
 */
export async function limitKey(env: { CLICK_SALT?: string }, raw: string): Promise<string> {
  return (await sha(`${env.CLICK_SALT ?? 'kreators-local'}:limit:${raw}`)).slice(0, 32);
}

/** Middleware: the named limit from limits.ts, per address, or per person once there is a session. */
export function rateLimit(name: LimitName, by?: 'address', when?: 'discountCode' | 'appPrefs' | 'datePrefs' | 'adminKey' | 'session') {
  const { max, windowSec } = LIMITS[name];
  return async (c: Context<AppEnv>, next: Next) => {
    if (when === 'adminKey') return adminKeyDoor(c, next, `${name}:ip:${await limitKey(c.env, ipOf(c))}`, max, windowSec);
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
    // The same for the date and time format (Profile): the form sends it only when it changed.
    if (when === 'datePrefs') {
      const body = await c.req.json<{ datePrefs?: unknown }>().catch(() => null);
      if (!body || body.datePrefs === undefined) return next();
    }
    // `by: 'address'` counts the address even for a signed-in person, so one address cannot try codes through many accounts. A door that
    // runs before the session check (`session`, /admin/connect) reads the session itself, so a signed-in person is counted as themself.
    const userId = by === 'address' ? undefined : (c.get('user') ?? (when === 'session' ? await sessionUser(c) : null))?.id;
    const who = userId ?? (await limitKey(c.env, ipOf(c)));
    if (await limited(c.env.DB, `${name}${by === 'address' ? ':ip' : ''}:${who}`, max, windowSec)) return c.json({ error: 'too many tries, wait a minute' }, 429);
    await next();
  };
}

/**
 * The door to /api/admin with the shared key. Only a request that carries a key is looked at, and an admin's own session never is, even beside an
 * old key left on a device, so signing in as an admin is never slowed. Each try takes a place before the compare, so however many arrive at once
 * no more than the limit are ever compared; a right key gives its place back, so using the key wears nothing out. Once an address has spent its
 * places even the right key waits, or a good guess would still show. Both sides are hashed first, so the compare takes the same time whatever the
 * length. admin.ts trusts only the flag set here, so a method with no door (OPTIONS) opens nothing and cannot be used to test a guess.
 */
async function adminKeyDoor(c: Context<AppEnv>, next: Next, place: string, max: number, windowSec: number) {
  const given = c.req.header('X-Admin-Key');
  if (!given) return next();
  if ((await sessionUser(c))?.role === 'admin') return next();
  if (await limited(c.env.DB, place, max, windowSec)) return c.json({ error: 'too many tries, wait a minute' }, 429);
  if (c.env.ADMIN_KEY && safeEqual(await sha(given), await sha(c.env.ADMIN_KEY))) {
    await c.env.DB.prepare('UPDATE rate_limits SET count = count - 1 WHERE key = ? AND count > 0').bind(place).run();
    c.set('adminKeyOk', true);
  }
  return next();
}

/** SHA-256 as hex, for salted hashes. */
export async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time compare of two strings of the same kind (hex hashes, signatures). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The token in an unsubscribe link: the person's id and a hash only this server can make. */
export async function unsubscribeToken(env: Env, userId: string): Promise<string> {
  return `${userId}.${(await sha(`${env.CLICK_SALT ?? 'kreators-local'}:unsubscribe:${userId}`)).slice(0, 24)}`;
}
