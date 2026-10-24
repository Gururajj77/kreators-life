import { Hono } from 'hono';
import { RELATIONSHIPS } from '@kreators/shared';
import { track } from '../ops';
import type { AppEnv, UserRow } from '../env';
import { getUser, newId, nowIso, randomCode, sessionUser, toUser } from '../db';

export const auth = new Hono<AppEnv>();

const enc = new TextEncoder();

async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100_000 }, key, 256);
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function newSession(db: D1Database, userId: string): Promise<string> {
  const token = `${newId()}${newId().replace(/-/g, '')}`;
  await db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').bind(token, userId, nowIso()).run();
  return token;
}

// Anonymous device session. Progress lives on the device until an email is attached.
auth.post('/anon', async (c) => {
  const db = c.env.DB;
  const id = newId();
  const now = nowIso();
  const body = await c.req.json<{ ref?: string }>().catch(() => ({}) as { ref?: string });
  const ref = typeof body.ref === 'string' && body.ref.trim() ? body.ref.trim().toUpperCase().slice(0, 12) : null;
  await db.batch([
    db.prepare('INSERT INTO users (id, created_at, referral_code, referred_by) VALUES (?, ?, ?, ?)').bind(id, now, randomCode(), ref),
    ...RELATIONSHIPS.map((r) =>
      db.prepare('INSERT INTO relationship_scores (user_id, relationship, score, xp) VALUES (?, ?, 0, 0)').bind(id, r.key),
    ),
  ]);
  const token = await newSession(db, id);
  const user = await getUser(db, id);
  return c.json({ token, user: user ? toUser(user) : null }, 201);
});

// Attach an email and password to the current device session, so progress
// survives a new phone. Without a session, it creates a fresh account.
auth.post('/signup', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<{ email?: string; password?: string; displayName?: string }>().catch(() => ({}) as Record<string, never>);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!EMAIL_RE.test(email)) return c.json({ error: 'that email does not look right' }, 400);
  if (password.length < 8) return c.json({ error: 'use at least eight characters' }, 400);
  const taken = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
  if (taken) return c.json({ error: 'that email already has an account. Sign in instead.' }, 409);

  const salt = randomCode(16);
  const hash = await hashPassword(password, salt);
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 40) : '';

  let user = await sessionUser(c);
  if (user && user.email) user = null; // already an account; make a new one rather than overwrite
  let token: string;
  if (user) {
    await db
      .prepare('UPDATE users SET email = ?, password_hash = ?, password_salt = ?, display_name = CASE WHEN display_name = \'\' THEN ? ELSE display_name END WHERE id = ?')
      .bind(email, hash, salt, displayName, user.id)
      .run();
    token = (c.req.header('Authorization') ?? '').slice(7).trim();
  } else {
    const id = newId();
    const now = nowIso();
    await db.batch([
      db
        .prepare('INSERT INTO users (id, created_at, email, password_hash, password_salt, display_name, referral_code) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id, now, email, hash, salt, displayName, randomCode()),
      ...RELATIONSHIPS.map((r) =>
        db.prepare('INSERT INTO relationship_scores (user_id, relationship, score, xp) VALUES (?, ?, 0, 0)').bind(id, r.key),
      ),
    ]);
    user = await getUser(db, id);
    token = await newSession(db, id);
  }
  const fresh = user ? await getUser(db, user.id) : null;
  if (user) await track(c.env.DB, user.id, 'creator_signed_up', { method: 'email' });
  return c.json({ token, user: fresh ? toUser(fresh) : null }, 201);
});

auth.post('/signin', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({}) as Record<string, never>);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  if (!user || !user.password_hash || !user.password_salt) return c.json({ error: 'no account with that email and password' }, 401);
  const hash = await hashPassword(password, user.password_salt);
  if (!safeEqual(hash, user.password_hash)) return c.json({ error: 'no account with that email and password' }, 401);
  const token = await newSession(db, user.id);
  return c.json({ token, user: toUser(user) });
});

auth.post('/signout', async (c) => {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  return c.json({ ok: true });
});
