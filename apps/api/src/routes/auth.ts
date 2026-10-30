import { Hono } from 'hono';
import { birthDateProblem, normalizePhone, passwordProblem, phoneProblem, RELATIONSHIPS } from '@kreators/shared';
import { limited, sendEmail, track } from '../ops';
import { promoteBootstrapAdmin } from '../admins';
import { LIMITS } from '../limits';
import type { AppEnv, UserRow } from '../env';
import { getUser, newFriendCode, newHandle, newId, nowIso, randomCode, sessionUser, toUser } from '../db';

export const auth = new Hono<AppEnv>();

const enc = new TextEncoder();

export async function hashPassword(password: string, salt: string): Promise<string> {
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
const EMAIL_MAX = 254;

/** 16 random bytes as hex: the salt under a password. */
export function randomHex(bytes = 16): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}
// A salt and hash for a password nobody has, so an unknown email takes as long to answer as a wrong password.
const DECOY_SALT = 'decoy-salt-for-unknown-emails';

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
    db.prepare('INSERT INTO users (id, created_at, referral_code, referred_by, handle, friend_code) VALUES (?, ?, ?, ?, ?, ?)').bind(id, now, randomCode(), ref, newHandle(), newFriendCode()),
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
  const body = await c.req.json<{ email?: string; password?: string; displayName?: string; phone?: string; birthDate?: string }>().catch(() => ({}) as Record<string, never>);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!EMAIL_RE.test(email) || email.length > EMAIL_MAX) return c.json({ error: 'that email does not look right' }, 400);
  const weak = passwordProblem(password, email);
  if (weak) return c.json({ error: weak.charAt(0).toLowerCase() + weak.slice(1) }, 400);
  // A phone number and a date of birth, both required; nobody under MIN_AGE gets an account.
  const phoneBad = phoneProblem(typeof body.phone === 'string' ? body.phone : '');
  if (phoneBad) return c.json({ error: phoneBad.charAt(0).toLowerCase() + phoneBad.slice(1) }, 400);
  const phone = normalizePhone(body.phone as string);
  const birthDate = typeof body.birthDate === 'string' ? body.birthDate.trim() : '';
  const ageBad = birthDateProblem(birthDate);
  if (ageBad) return c.json({ error: ageBad.charAt(0).toLowerCase() + ageBad.slice(1) }, 400);
  const taken = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>();
  if (taken) return c.json({ error: 'that email already has an account. Sign in instead.' }, 409);

  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 40) : '';

  let user = await sessionUser(c);
  if (user && user.email) user = null; // already an account; make a new one rather than overwrite
  let token: string;
  if (user) {
    await db
      .prepare('UPDATE users SET email = ?, password_hash = ?, password_salt = ?, phone = ?, birth_date = ?, display_name = CASE WHEN display_name = \'\' THEN ? ELSE display_name END WHERE id = ?')
      .bind(email, hash, salt, phone, birthDate, displayName, user.id)
      .run();
    token = (c.req.header('Authorization') ?? '').slice(7).trim();
  } else {
    const id = newId();
    const now = nowIso();
    await db.batch([
      db
        .prepare('INSERT INTO users (id, created_at, email, password_hash, password_salt, display_name, referral_code, phone, birth_date, handle, friend_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, now, email, hash, salt, displayName, randomCode(), phone, birthDate, newHandle(), newFriendCode()),
      ...RELATIONSHIPS.map((r) =>
        db.prepare('INSERT INTO relationship_scores (user_id, relationship, score, xp) VALUES (?, ?, 0, 0)').bind(id, r.key),
      ),
    ]);
    user = await getUser(db, id);
    token = await newSession(db, id);
  }
  if (user) await promoteBootstrapAdmin(db, c.env, { ...user, email });
  const fresh = user ? await getUser(db, user.id) : null;
  if (user) await track(c.env.DB, user.id, 'creator_signed_up', { method: 'email' });
  return c.json({ token, user: fresh ? toUser(fresh) : null }, 201);
});

auth.post('/signin', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({}) as Record<string, never>);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const wrong = { error: 'no account with that email and password' };
  if (!EMAIL_RE.test(email) || email.length > EMAIL_MAX || !password || password.length > 1024) return c.json(wrong, 401);
  // One account can only be tried so often, whatever the address it is tried from.
  if (await limited(db, `signin-email:${email}`, LIMITS.signinEmail.max, LIMITS.signinEmail.windowSec)) return c.json({ error: 'too many tries, wait a minute' }, 429);
  const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  if (!user || !user.password_hash || !user.password_salt) {
    await hashPassword(password, DECOY_SALT);
    return c.json(wrong, 401);
  }
  const hash = await hashPassword(password, user.password_salt);
  if (!safeEqual(hash, user.password_hash)) return c.json(wrong, 401);
  const token = await newSession(db, user.id);
  const promoted = await promoteBootstrapAdmin(db, c.env, user);
  const fresh = promoted ? await getUser(db, user.id) : user;
  return c.json({ token, user: toUser(fresh ?? user) });
});

const RESET_MINUTES = 30;

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Forgot the password: an email in, a one-time reset link out. The answer is the same whether or not
// the email has an account, so this cannot be used to find out who is here.
auth.post('/forgot', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<{ email?: string }>().catch(() => ({}) as { email?: string });
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > EMAIL_MAX) return c.json({ error: 'that email does not look right' }, 400);
  if (await limited(db, `forgot-email:${email}`, LIMITS.forgotEmail.max, LIMITS.forgotEmail.windowSec)) return c.json({ ok: true, minutes: RESET_MINUTES });
  const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  if (user && user.password_hash) {
    const now = new Date();
    const token = randomHex(32);
    await db.batch([
      db.prepare('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL').bind(now.toISOString(), user.id),
      db.prepare('INSERT INTO password_resets (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').bind(newId(), user.id, await sha256Hex(token), now.toISOString(), new Date(now.getTime() + RESET_MINUTES * 60_000).toISOString()),
    ]);
    const link = `${new URL(c.req.url).origin}/signin/reset?token=${token}`;
    await sendEmail(db, c.env, {
      userId: user.id,
      to: email,
      subject: 'Reset your kreators.app password',
      body: `Tap this link to choose a new password. It works once, for ${RESET_MINUTES} minutes.\n\n${link}\n\nIf you did not ask for it, ignore this mail. Your password stays as it is.`,
    });
  }
  return c.json({ ok: true, minutes: RESET_MINUTES });
});

// The reset link lands here with the new password. The token is claimed first, every session is
// signed out, and the person comes back in with a fresh one.
auth.post('/reset', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<{ token?: string; password?: string }>().catch(() => ({}) as { token?: string; password?: string });
  const raw = typeof body.token === 'string' ? body.token.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const gone = { error: 'that link has expired or was already used. Ask for a new one.' };
  if (!/^[0-9a-f]{64}$/.test(raw)) return c.json(gone, 400);
  const now = nowIso();
  const row = await db.prepare('SELECT * FROM password_resets WHERE token_hash = ?').bind(await sha256Hex(raw)).first<{ id: string; user_id: string; expires_at: string; used_at: string | null }>();
  if (!row || row.used_at || row.expires_at < now) return c.json(gone, 400);
  const user = await getUser(db, row.user_id);
  if (!user || !user.email) return c.json(gone, 400);
  const weak = passwordProblem(password, user.email);
  if (weak) return c.json({ error: weak.charAt(0).toLowerCase() + weak.slice(1) }, 400);
  const claimed = await db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ? AND used_at IS NULL').bind(now, row.id).run();
  if (!claimed.meta.changes) return c.json(gone, 400);
  const salt = randomHex(16);
  await db.batch([
    db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(await hashPassword(password, salt), salt, user.id),
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
  ]);
  const token = await newSession(db, user.id);
  const fresh = await getUser(db, user.id);
  return c.json({ token, user: fresh ? toUser(fresh) : null });
});

auth.post('/signout', async (c) => {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  return c.json({ ok: true });
});
