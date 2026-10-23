import { Hono } from 'hono';
import { RELATIONSHIPS } from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { newId, nowIso, toUser } from '../db';

export const auth = new Hono<AppEnv>();

// Anonymous device session. Keep the token on the device; a later version can
// attach an email to the same user without losing progress.
auth.post('/anon', async (c) => {
  const db = c.env.DB;
  const id = newId();
  const token = `${newId()}${newId().replace(/-/g, '')}`;
  const now = nowIso();
  await db.batch([
    db.prepare('INSERT INTO users (id, created_at) VALUES (?, ?)').bind(id, now),
    db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').bind(token, id, now),
    ...RELATIONSHIPS.map((r) =>
      db.prepare('INSERT INTO relationship_scores (user_id, relationship, score, xp) VALUES (?, ?, 0, 0)').bind(id, r.key),
    ),
  ]);
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  return c.json({ token, user: user ? toUser(user) : null }, 201);
});
