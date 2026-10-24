import { Hono } from 'hono';
import { HONOR_BY_KEY, type AdminRedemption, type AdminUser } from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { getUser, nowIso } from '../db';
import { toRedemption, type RedemptionRow } from './rewards';

export const admin = new Hono<AppEnv>();

// A single shared secret. Set it with `wrangler secret put ADMIN_KEY`
// (or ADMIN_KEY in apps/api/.dev.vars locally). Unset means no admin at all.
admin.use('*', async (c, next) => {
  const key = c.env.ADMIN_KEY;
  if (!key) return c.json({ error: 'admin is not enabled on this deployment' }, 503);
  const given = c.req.header('X-Admin-Key') ?? '';
  if (given.length !== key.length || !timingSafeEqual(given, key)) return c.json({ error: 'forbidden' }, 403);
  await next();
});

function timingSafeEqual(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface UserListRow extends UserRow {
  honor_keys: string | null;
}

function toAdminUser(r: UserListRow): AdminUser {
  return {
    id: r.id,
    displayName: r.display_name,
    focus: r.creator_type,
    xp: r.xp,
    points: r.points,
    streak: r.streak,
    isPro: r.is_pro === 1,
    createdAt: r.created_at,
    honors: r.honor_keys ? r.honor_keys.split(',') : [],
  };
}

const USER_SELECT = `SELECT u.*, (SELECT GROUP_CONCAT(honor_key) FROM honors h WHERE h.user_id = u.id) AS honor_keys FROM users u`;

admin.get('/users', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const rows = q
    ? await c.env.DB.prepare(`${USER_SELECT} WHERE u.display_name LIKE ? OR u.id LIKE ? ORDER BY u.xp DESC LIMIT 50`)
        .bind(`%${q}%`, `${q}%`)
        .all<UserListRow>()
    : await c.env.DB.prepare(`${USER_SELECT} ORDER BY u.created_at DESC LIMIT 50`).all<UserListRow>();
  return c.json({ users: rows.results.map(toAdminUser) });
});

async function loadUser(db: D1Database, id: string): Promise<UserListRow | null> {
  return db.prepare(`${USER_SELECT} WHERE u.id = ?`).bind(id).first<UserListRow>();
}

admin.post('/users/:id/pro', async (c) => {
  const db = c.env.DB;
  const user = await getUser(db, c.req.param('id'));
  if (!user) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ pro?: boolean }>().catch(() => ({}) as { pro?: boolean });
  const pro = body.pro === true;
  const now = nowIso();
  await db.batch([
    db.prepare('UPDATE users SET is_pro = ? WHERE id = ?').bind(pro ? 1 : 0, user.id),
    pro
      ? db.prepare("INSERT OR IGNORE INTO honors (user_id, honor_key, note, awarded_at) VALUES (?, 'pro', 'Pro membership', ?)").bind(user.id, now)
      : db.prepare("DELETE FROM honors WHERE user_id = ? AND honor_key = 'pro'").bind(user.id),
  ]);
  const fresh = await loadUser(db, user.id);
  return c.json({ user: fresh ? toAdminUser(fresh) : null });
});

admin.post('/users/:id/honors', async (c) => {
  const db = c.env.DB;
  const user = await getUser(db, c.req.param('id'));
  if (!user) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ key?: string; note?: string }>().catch(() => ({}) as { key?: string; note?: string });
  const honor = body.key ? HONOR_BY_KEY[body.key] : undefined;
  if (!honor || honor.source !== 'admin') return c.json({ error: 'not an admin-given honor' }, 400);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : '';
  await db
    .prepare('INSERT OR REPLACE INTO honors (user_id, honor_key, note, awarded_at) VALUES (?, ?, ?, ?)')
    .bind(user.id, honor.key, note, nowIso())
    .run();
  const fresh = await loadUser(db, user.id);
  return c.json({ user: fresh ? toAdminUser(fresh) : null });
});

admin.delete('/users/:id/honors/:key', async (c) => {
  const db = c.env.DB;
  await db.prepare('DELETE FROM honors WHERE user_id = ? AND honor_key = ?').bind(c.req.param('id'), c.req.param('key')).run();
  const fresh = await loadUser(db, c.req.param('id'));
  if (!fresh) return c.json({ error: 'not found' }, 404);
  return c.json({ user: toAdminUser(fresh) });
});

admin.post('/users/:id/points', async (c) => {
  const db = c.env.DB;
  const user = await getUser(db, c.req.param('id'));
  if (!user) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ amount?: number; note?: string }>().catch(() => ({}) as { amount?: number; note?: string });
  const amount = Math.trunc(Number(body.amount));
  if (!Number.isFinite(amount) || amount === 0) return c.json({ error: 'amount must be a non-zero whole number' }, 400);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : '';
  await db.batch([
    db.prepare('UPDATE users SET points = MAX(0, points + ?) WHERE id = ?').bind(amount, user.id),
    db
      .prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(user.id, amount, 'admin', note, nowIso()),
  ]);
  const fresh = await loadUser(db, user.id);
  return c.json({ user: fresh ? toAdminUser(fresh) : null });
});

interface AdminRedemptionRow extends RedemptionRow {
  user_name: string;
}

admin.get('/redemptions', async (c) => {
  const status = c.req.query('status');
  const where = status ? 'WHERE r.status = ?' : '';
  const stmt = c.env.DB.prepare(
    `SELECT r.*, u.display_name AS user_name FROM redemptions r JOIN users u ON u.id = r.user_id ${where} ORDER BY r.created_at DESC LIMIT 100`,
  );
  const rows = await (status ? stmt.bind(status) : stmt).all<AdminRedemptionRow>();
  const list: AdminRedemption[] = rows.results.map((r) => ({ ...toRedemption(r), userId: r.user_id, userName: r.user_name || 'Anonymous climber' }));
  return c.json({ redemptions: list });
});

admin.post('/redemptions/:id', async (c) => {
  const db = c.env.DB;
  const row = await db.prepare('SELECT * FROM redemptions WHERE id = ?').bind(c.req.param('id')).first<RedemptionRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ status?: string; note?: string }>().catch(() => ({}) as { status?: string; note?: string });
  if (body.status !== 'fulfilled' && body.status !== 'cancelled') return c.json({ error: 'status must be fulfilled or cancelled' }, 400);
  if (row.status !== 'reserved') return c.json({ error: `already ${row.status}` }, 400);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : row.note;
  const now = nowIso();
  const stmts = [db.prepare('UPDATE redemptions SET status = ?, note = ?, updated_at = ? WHERE id = ?').bind(body.status, note, now, row.id)];
  if (body.status === 'cancelled') {
    stmts.push(
      db.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(row.points, row.user_id),
      db
        .prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(row.user_id, row.points, 'refund', row.id, now),
    );
  }
  await db.batch(stmts);
  const fresh = await db.prepare('SELECT * FROM redemptions WHERE id = ?').bind(row.id).first<RedemptionRow>();
  return c.json({ redemption: fresh ? toRedemption(fresh) : null });
});
