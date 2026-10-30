import { Hono } from 'hono';
import { INBOX_TAB_META, INBOX_TABS, isInboxTab, roleRank, type InboxShow, type InboxTab, type Notification } from '@kreators/shared';
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
  archived_at: string | null;
  created_at: string;
}
const toN = (r: Row): Notification => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, link: r.link, readAt: r.read_at, archivedAt: r.archived_at, createdAt: r.created_at });

/** The SQL that keeps one tab's kinds, with its binds. All keeps everything. */
function tabWhere(tab: InboxTab): { sql: string; binds: string[] } {
  const kinds = INBOX_TAB_META[tab].kinds;
  return kinds.length ? { sql: ` AND kind IN (${kinds.map(() => '?').join(',')})`, binds: [...kinds] } : { sql: '', binds: [] };
}

// A page of notes for one tab: the inbox (not archived), only the unread, or the archive. Team is for staff only.
inbox.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const staff = roleRank(user.role) >= roleRank('sub_admin');
  const asked = c.req.query('tab');
  const tab: InboxTab = isInboxTab(asked) && (asked !== 'team' || staff) ? asked : 'all';
  const showRaw = c.req.query('show');
  const show: InboxShow = showRaw === 'unread' || showRaw === 'archived' ? showRaw : 'inbox';
  const ask = pageOf(c);
  const t = tabWhere(tab);
  const state = show === 'archived' ? ' AND archived_at IS NOT NULL' : show === 'unread' ? ' AND archived_at IS NULL AND read_at IS NULL' : ' AND archived_at IS NULL';
  const rows = await db.prepare(`SELECT * FROM notifications WHERE user_id = ?${t.sql}${state} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(user.id, ...t.binds, ask.limit, ask.offset).all<Row>();
  // Unread per tab, so each tab can say how many wait in it.
  const unreadRows = await db.prepare('SELECT kind, COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL AND archived_at IS NULL GROUP BY kind').bind(user.id).all<{ kind: string; n: number }>();
  const tabs = INBOX_TABS.filter((k) => k !== 'team' || staff).map((k) => {
    const kinds = INBOX_TAB_META[k].kinds;
    return { tab: k, unread: unreadRows.results.filter((r) => kinds.length === 0 || kinds.includes(r.kind)).reduce((a, r) => a + r.n, 0) };
  });
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, notifications: pg.items.map(toN), unread: tabs.find((x) => x.tab === 'all')?.unread ?? 0, tab, show, tabs });
});

inbox.post('/read-all', async (c) => {
  const body = await c.req.json<{ tab?: unknown }>().catch(() => ({}) as { tab?: unknown });
  const t = tabWhere(isInboxTab(body.tab) ? body.tab : 'all');
  await c.env.DB.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL${t.sql}`).bind(nowIso(), c.get('user').id, ...t.binds).run();
  return c.json({ ok: true });
});

inbox.post('/:id/read', async (c) => {
  await c.env.DB.prepare('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?').bind(nowIso(), c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});

// Put a note away, or bring it back. Putting it away also marks it read.
inbox.post('/:id/archive', async (c) => {
  const body = await c.req.json<{ archived?: unknown }>().catch(() => ({}) as { archived?: unknown });
  const now = nowIso();
  const away = body.archived !== false;
  await c.env.DB.prepare('UPDATE notifications SET archived_at = ?, read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?').bind(away ? now : null, now, c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true, archived: away });
});

// Put every read note in a tab away at once.
inbox.post('/archive-read', async (c) => {
  const body = await c.req.json<{ tab?: unknown }>().catch(() => ({}) as { tab?: unknown });
  const t = tabWhere(isInboxTab(body.tab) ? body.tab : 'all');
  const done = await c.env.DB.prepare(`UPDATE notifications SET archived_at = ? WHERE user_id = ? AND read_at IS NOT NULL AND archived_at IS NULL${t.sql}`).bind(nowIso(), c.get('user').id, ...t.binds).run();
  return c.json({ ok: true, archived: done.meta.changes ?? 0 });
});

// Delete for good, from the archive only: everything archived in a tab at once (before the :id route so "archived" is not read as an id)...
inbox.delete('/archived', async (c) => {
  const asked = c.req.query('tab');
  const t = tabWhere(isInboxTab(asked) ? asked : 'all');
  const done = await c.env.DB.prepare(`DELETE FROM notifications WHERE user_id = ? AND archived_at IS NOT NULL${t.sql}`).bind(c.get('user').id, ...t.binds).run();
  return c.json({ ok: true, deleted: done.meta.changes ?? 0 });
});

// ...or one archived note. A note that is not archived yet is refused: it has to be put away first.
inbox.delete('/:id', async (c) => {
  const done = await c.env.DB.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ? AND archived_at IS NOT NULL').bind(c.req.param('id'), c.get('user').id).run();
  if (!(done.meta.changes ?? 0)) return c.json({ error: 'only an archived note can be deleted' }, 404);
  return c.json({ ok: true });
});
