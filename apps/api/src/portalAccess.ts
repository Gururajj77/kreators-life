import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { makePortalPassword } from '@kreators/shared';
import type { AppEnv } from './env';
import { LIMITS } from './limits';
import { limited, sha } from './ops';
import { hashPassword, randomHex, safeEqual } from './routes/auth';
import { nowIso } from './db';

/**
 * The password on a client's link. The owner sets it per client; a client who opens the link without it sees a lock screen, and unlocking it
 * gives a portal session: a random token the browser keeps in sessionStorage only and sends in `X-Portal-Session`, kept here as a SHA-256 hash,
 * good for twelve hours, for that one client. The same session opens the client's agreement and invoice links, through `portalDocGate` below.
 *
 * Another route that shows a client something by a link (a document, a report) asks one question: `requirePortalAccess(c, clientId)`. It
 * answers null when the client may see it, else the 401 `{ error: 'locked', clientName }` to return as is.
 */
export const PORTAL_SESSION_HEADER = 'X-Portal-Session';
export const PORTAL_SESSION_HOURS = 12;
/** A client has at most this many open sessions; the oldest give way. */
const MAX_SESSIONS = 20;
const SESSION_RE = /^[0-9a-f]{64}$/;

/** A salt for a link that does not exist, so an unknown link takes as long to refuse as a wrong password. */
const DECOY_SALT = 'decoy-salt-for-unknown-portal-links';

export interface LockRow {
  id: string;
  name: string;
  portal_pass_hash: string | null;
  portal_pass_salt: string | null;
}

/** The sessions the browser sent: up to five tokens, comma separated, each 64 hex characters. */
function sessionsSent(c: Context<AppEnv>): string[] {
  const raw = c.req.header(PORTAL_SESSION_HEADER) ?? '';
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => SESSION_RE.test(t))
    .slice(0, 5);
}

/** True when one of the tokens is a live session for this client. */
export async function hasPortalSession(db: D1Database, clientId: string, tokens: string[]): Promise<boolean> {
  if (tokens.length === 0) return false;
  const hashes = await Promise.all(tokens.map((t) => sha(t)));
  const row = await db
    .prepare(`SELECT 1 AS x FROM portal_sessions WHERE client_id = ? AND expires_at > ? AND token_hash IN (${hashes.map(() => '?').join(',')}) LIMIT 1`)
    .bind(clientId, nowIso(), ...hashes)
    .first();
  return Boolean(row);
}

/** Whether the client's link asks for a password. */
export async function portalIsLocked(db: D1Database, clientId: string): Promise<boolean> {
  const row = await db.prepare('SELECT portal_pass_hash FROM agency_clients WHERE id = ?').bind(clientId).first<{ portal_pass_hash: string | null }>();
  return Boolean(row?.portal_pass_hash);
}

/**
 * The one check every client-facing route makes. Null when the client has no password or the request carries a live session for them;
 * else the 401 to send. The answer holds the client's name and nothing else.
 */
export async function requirePortalAccess(c: Context<AppEnv>, clientId: string): Promise<Response | null> {
  const row = await c.env.DB.prepare('SELECT name, portal_pass_hash FROM agency_clients WHERE id = ?').bind(clientId).first<{ name: string; portal_pass_hash: string | null }>();
  if (!row || !row.portal_pass_hash) return null;
  if (await hasPortalSession(c.env.DB, clientId, sessionsSent(c))) return null;
  c.header('Cache-Control', 'no-store');
  return c.json({ error: 'locked' as const, clientName: row.name }, 401);
}

/** Every open session of a client ends: the password changed, the link is fresh or closed. */
export function clearPortalSessions(db: D1Database, clientId: string): D1PreparedStatement {
  return db.prepare('DELETE FROM portal_sessions WHERE client_id = ?').bind(clientId);
}

/** The cron's tidy-up: sessions past their twelve hours. */
export async function pruneExpiredPortalSessions(db: D1Database): Promise<void> {
  await db.prepare('DELETE FROM portal_sessions WHERE expires_at <= ?').bind(nowIso()).run();
}

/** A whole number from 0 to n - 1, without the bias of a remainder. */
export function randomInt(n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0]! < limit) return buf[0]! % n;
  }
}
/** A readable password for the owner to hand over: four words and two digits. Shown once. */
export const newPortalPassword = (): string => makePortalPassword(randomInt);

/** The hash and salt to keep for a password. The same PBKDF2 as every password here. */
export async function passwordColumns(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomHex(16);
  return { hash: await hashPassword(password, salt), salt };
}

/** True when the password is right. A client with no password or no client at all is hashed against a decoy, so the time is the same. */
async function passwordMatches(row: Pick<LockRow, 'portal_pass_hash' | 'portal_pass_salt'> | null, password: string): Promise<boolean> {
  if (!row || !row.portal_pass_hash || !row.portal_pass_salt) {
    await hashPassword(password, DECOY_SALT);
    return false;
  }
  return safeEqual(await hashPassword(password, row.portal_pass_salt), row.portal_pass_hash);
}

/**
 * The unlock door, for the client link and for a document link alike. Counted per address before it gets here (`portalLogin`), and again per
 * client here (`portalLoginLink`), so many addresses cannot guess one password. A wrong password and an unknown link answer the same words.
 * `linkKey` names what is being tried: the client's id when there is one, else the token that was given.
 */
export async function unlockPortal(c: Context<AppEnv>, client: LockRow | null, linkKey: string): Promise<Response> {
  const db = c.env.DB;
  const body = await c.req.json<{ password?: unknown }>().catch(() => ({}) as { password?: unknown });
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
  if (await limited(db, `portal-link:${linkKey.slice(0, 64)}`, LIMITS.portalLoginLink.max, LIMITS.portalLoginLink.windowSec)) {
    c.set('logNote', 'portal unlock: too many tries on one link');
    return c.json({ error: 'too many tries, wait a minute' }, 429);
  }
  // A link with no password has nothing to unlock: it is open.
  if (client && !client.portal_pass_hash) return c.json({ open: true, session: null, expiresAt: null });
  const ok = await passwordMatches(client, password);
  c.header('Cache-Control', 'no-store');
  if (!client || !ok) {
    // A line for the app log, without the password.
    c.set('logNote', 'portal unlock: wrong password or unknown link');
    return c.json({ error: 'That password did not work.' }, 401);
  }
  const session = await startPortalSession(db, client.id);
  c.set('logNote', 'portal unlock: opened');
  return c.json({ open: true, session: session.token, expiresAt: session.expiresAt });
}

/** A new session for a client who gave the password. The token is returned once; only its hash is kept. */
export async function startPortalSession(db: D1Database, clientId: string): Promise<{ token: string; expiresAt: string }> {
  const token = randomHex(32);
  const hash = await sha(token);
  const now = nowIso();
  const expiresAt = new Date(Date.now() + PORTAL_SESSION_HOURS * 3_600_000).toISOString();
  await db.batch([
    db.prepare('DELETE FROM portal_sessions WHERE client_id = ? AND expires_at <= ?').bind(clientId, now),
    db.prepare('INSERT INTO portal_sessions (token_hash, client_id, expires_at, created_at) VALUES (?, ?, ?, ?)').bind(hash, clientId, expiresAt, now),
    db.prepare('DELETE FROM portal_sessions WHERE client_id = ? AND token_hash NOT IN (SELECT token_hash FROM portal_sessions WHERE client_id = ? ORDER BY created_at DESC LIMIT ?)').bind(clientId, clientId, MAX_SESSIONS),
  ]);
  return { token, expiresAt };
}

/** The client lock row for a link token, or null. Switched-off links have no token, so they find nothing. */
export async function lockRowForToken(db: D1Database, token: string): Promise<LockRow | null> {
  if (!/^[A-Z0-9]{16}$/.test(token)) return null;
  return db.prepare('SELECT id, name, portal_pass_hash, portal_pass_salt FROM agency_clients WHERE portal_token = ?').bind(token).first<LockRow>();
}

// ---- the agreement and invoice links of a client who has a password

export type DocKind = 'contract' | 'invoice' | 'doc';
/** The client a document link belongs to, or null when it belongs to none (an invoice made outside Agency, an unknown token). */
async function clientOfDocument(db: D1Database, kind: DocKind, token: string): Promise<LockRow | null> {
  if (!/^[A-Za-z0-9]{8,40}$/.test(token)) return null;
  const sql =
    kind === 'contract'
      ? 'SELECT c.id, c.name, c.portal_pass_hash, c.portal_pass_salt FROM agency_contracts k JOIN agency_clients c ON c.id = k.client_id WHERE k.token = ?'
      : kind === 'invoice'
        ? 'SELECT c.id, c.name, c.portal_pass_hash, c.portal_pass_salt FROM invoices i JOIN agency_clients c ON c.id = i.agency_client_id WHERE i.token = ?'
        : 'SELECT c.id, c.name, c.portal_pass_hash, c.portal_pass_salt FROM agency_docs d JOIN agency_clients c ON c.id = d.client_id WHERE d.token = ?';
  return db.prepare(sql).bind(token).first<LockRow>();
}

/** Middleware in front of /public/contracts/:token, /public/invoices/:token and /public/agency/doc/:token: a client with a password needs a live session to read or answer. */
export function portalDocGate(kind: DocKind) {
  return async (c: Context<AppEnv>, next: Next) => {
    const path = c.req.path;
    if (path.endsWith('/unlock') || path.endsWith('/lock')) return next();
    const client = await clientOfDocument(c.env.DB, kind, c.req.param('token') ?? '');
    if (client?.portal_pass_hash) {
      const denied = await requirePortalAccess(c, client.id);
      if (denied) return denied;
    }
    return next();
  };
}

/**
 * Two small doors for each document link, in front of the document's own routes: `lock` says whether the page needs the password
 * (so the page can show the lock screen without a failed read), `unlock` takes the password and starts the same session as the client link.
 */
export const portalDocs = new Hono<AppEnv>();
for (const [prefix, kind] of [['contracts', 'contract'], ['invoices', 'invoice'], ['agency/doc', 'doc']] as const) {
  portalDocs.get(`/${prefix}/:token/lock`, async (c) => {
    const client = await clientOfDocument(c.env.DB, kind, c.req.param('token'));
    c.header('Cache-Control', 'no-store');
    if (!client?.portal_pass_hash) return c.json({ locked: false });
    const open = await hasPortalSession(c.env.DB, client.id, sessionsSent(c));
    return c.json(open ? { locked: false } : { locked: true, clientName: client.name });
  });
  portalDocs.post(`/${prefix}/:token/unlock`, async (c) => {
    const token = c.req.param('token');
    const client = await clientOfDocument(c.env.DB, kind, token);
    return unlockPortal(c, client, client?.id ?? token);
  });
}
