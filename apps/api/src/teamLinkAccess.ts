import type { Context, Next } from 'hono';
import type { AppEnv } from './env';
import { LIMITS } from './limits';
import { limited, limitKey, sha } from './ops';
import { randomHex } from './routes/auth';
import { nowIso } from './db';
import { agencyFace, passwordMatches, PORTAL_SESSION_HOURS, type LockRow } from './portalAccess';

/**
 * The team link's own lock (2026-11-04). The team link (`/t/<token>`) is the client page for the client's own team, without the paper.
 * Its password is the owner's, hashed the same way as the client link's (portalAccess.ts), but its sessions live in their own table
 * (`team_link_sessions`) and come in their own header, so a team session can never open the client link, an agreement, an invoice or a
 * document: those routes read only `portal_sessions`, and they refuse outright any request that carries this header (`refuseTeamSession`).
 */
export const TEAM_LINK_SESSION_HEADER = 'X-Team-Link-Session';
/** A client has at most this many open team sessions; the oldest give way. */
const MAX_SESSIONS = 20;
const SESSION_RE = /^[0-9a-f]{64}$/;

/** The team sessions the browser sent: up to five tokens, comma separated, each 64 hex characters. */
function teamSessionsSent(c: Context<AppEnv>): string[] {
  const raw = c.req.header(TEAM_LINK_SESSION_HEADER) ?? '';
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => SESSION_RE.test(t))
    .slice(0, 5);
}

async function hasTeamLinkSession(db: D1Database, clientId: string, tokens: string[]): Promise<boolean> {
  if (tokens.length === 0) return false;
  const hashes = await Promise.all(tokens.map((t) => sha(t)));
  const row = await db
    .prepare(`SELECT 1 AS x FROM team_link_sessions WHERE client_id = ? AND expires_at > ? AND token_hash IN (${hashes.map(() => '?').join(',')}) LIMIT 1`)
    .bind(clientId, nowIso(), ...hashes)
    .first();
  return Boolean(row);
}

/**
 * The one check every team link route makes. Null when the team link has no password or the request carries a live team session for
 * this client; else the 401 to send, with the client's name and who sent the link, nothing more. A client link session never counts.
 */
export async function requireTeamLinkAccess(c: Context<AppEnv>, clientId: string): Promise<Response | null> {
  const row = await c.env.DB.prepare('SELECT name, user_id, team_link_pass_hash FROM agency_clients WHERE id = ?').bind(clientId).first<{ name: string; user_id: string; team_link_pass_hash: string | null }>();
  if (!row || !row.team_link_pass_hash) return null;
  if (await hasTeamLinkSession(c.env.DB, clientId, teamSessionsSent(c))) return null;
  c.header('Cache-Control', 'no-store');
  const face = await agencyFace(c.env.DB, row.user_id);
  return c.json({ error: 'locked' as const, clientName: row.name, agencyName: face.agencyName, agencyLogo: face.agencyLogo }, 401);
}

/** Every open team session of a client ends: the team link's password changed, or the team link is fresh or closed. */
export function clearTeamLinkSessions(db: D1Database, clientId: string): D1PreparedStatement {
  return db.prepare('DELETE FROM team_link_sessions WHERE client_id = ?').bind(clientId);
}

/** The client behind a team link, in the lock row's shape (the team link's own hash and salt), or null. A switched-off link has no token. */
export async function teamLockRowForToken(db: D1Database, token: string): Promise<LockRow | null> {
  if (!/^[A-Z0-9]{16}$/.test(token)) return null;
  return db
    .prepare('SELECT id, user_id, name, team_link_pass_hash AS portal_pass_hash, team_link_pass_salt AS portal_pass_salt FROM agency_clients WHERE team_link_token = ?')
    .bind(token)
    .first<LockRow>();
}

async function startTeamLinkSession(db: D1Database, clientId: string): Promise<{ token: string; expiresAt: string }> {
  const token = randomHex(32);
  const hash = await sha(token);
  const now = nowIso();
  const expiresAt = new Date(Date.now() + PORTAL_SESSION_HOURS * 3_600_000).toISOString();
  await db.batch([
    db.prepare('DELETE FROM team_link_sessions WHERE client_id = ? AND expires_at <= ?').bind(clientId, now),
    db.prepare('INSERT INTO team_link_sessions (token_hash, client_id, expires_at, created_at) VALUES (?, ?, ?, ?)').bind(hash, clientId, expiresAt, now),
    db.prepare('DELETE FROM team_link_sessions WHERE client_id = ? AND token_hash NOT IN (SELECT token_hash FROM team_link_sessions WHERE client_id = ? ORDER BY created_at DESC LIMIT ?)').bind(clientId, clientId, MAX_SESSIONS),
  ]);
  return { token, expiresAt };
}

/**
 * The team link's unlock door. Counted per address before it gets here (`teamLinkLogin`) and per client here (`teamLinkLoginLink`). A wrong
 * password and an unknown link answer the same words, and an unknown link is hashed against the decoy so the time is the same.
 */
export async function unlockTeamLink(c: Context<AppEnv>, client: LockRow | null, linkKey: string): Promise<Response> {
  const db = c.env.DB;
  const body = await c.req.json<{ password?: unknown }>().catch(() => ({}) as { password?: unknown });
  const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
  if (await limited(db, `team-link:${await limitKey(c.env, linkKey)}`, LIMITS.teamLinkLoginLink.max, LIMITS.teamLinkLoginLink.windowSec)) {
    c.set('logNote', 'team link unlock: too many tries on one link');
    return c.json({ error: 'too many tries, wait a minute' }, 429);
  }
  if (client && !client.portal_pass_hash) return c.json({ open: true, session: null, expiresAt: null });
  const ok = await passwordMatches(client, password);
  c.header('Cache-Control', 'no-store');
  if (!client || !ok) {
    c.set('logNote', 'team link unlock: wrong password or unknown link');
    return c.json({ error: 'That password did not work.' }, 401);
  }
  const session = await startTeamLinkSession(db, client.id);
  c.set('logNote', 'team link unlock: opened');
  return c.json({ open: true, session: session.token, expiresAt: session.expiresAt });
}

/**
 * In front of every client link, agreement, invoice and document route: a request that carries a team session is answered 404, so the
 * team link's unlock can never be carried to the paper or the client link. Our own pages send this header only to the team link.
 */
export async function refuseTeamSession(c: Context<AppEnv>, next: Next) {
  if ((c.req.header(TEAM_LINK_SESSION_HEADER) ?? '').trim()) {
    c.set('logNote', 'team link session sent to a client or paper link');
    return c.json({ error: 'no page at this link' }, 404);
  }
  return next();
}
