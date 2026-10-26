import { Hono } from 'hono';
import type { Notification } from '@kreators/shared';
import type { AppEnv } from '../env';
import { nowIso, pageOf, paged } from '../db';

export const inbox = new Hono<AppEnv>();

interface Row {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}
const toN = (r: Row): Notification => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, link: r.link, readAt: r.read_at, createdAt: r.created_at });

inbox.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const ask = pageOf(c);
  const rows = await db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(user.id, ask.limit, ask.offset).all<Row>();
  const unread = await db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').bind(user.id).first<{ n: number }>();
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, notifications: pg.items.map(toN), unread: unread?.n ?? 0 });
});

inbox.post('/read-all', async (c) => {
  await c.env.DB.prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').bind(nowIso(), c.get('user').id).run();
  return c.json({ ok: true });
});

inbox.post('/:id/read', async (c) => {
  await c.env.DB.prepare('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?').bind(nowIso(), c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});
