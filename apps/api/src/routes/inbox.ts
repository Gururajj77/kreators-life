import { Hono, type Context } from 'hono';
import { INBOX_TAB_META, INBOX_TABS, inboxTabOf, isInboxKind, isInboxTab, roleRank, type InboxShow, type InboxTab, type Notification } from '@kreators/shared';
import type { AppEnv } from '../env';
import { nowIso, pageOf, paged } from '../db';
import { resolveAccess } from '../access';

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

/**
 * The tabs a person is offered. Team only to staff and admins (only they are sent its notes). Agency while Agency is on for them,
 * or while they hold an Agency note: a member asked into someone's Agency team, told their access changed or removed, has the
 * app off, and those notes still need a tab of their own. A tab asked for that is not offered is read as Everything, by the list
 * and by Mark all read, Archive read items and Delete all archived alike, so an action never reaches notes not on screen.
 */
async function offeredTabs(c: Context<AppEnv>): Promise<(k: InboxTab) => boolean> {
  const db = c.env.DB;
  const user = c.get('user');
  const staff = roleRank(user.role) >= roleRank('sub_admin');
  const [access, held] = await Promise.all([
    resolveAccess(db, user),
    db.prepare("SELECT 1 AS one FROM notifications WHERE user_id = ? AND kind = 'agency' LIMIT 1").bind(user.id).first<{ one: number }>(),
  ]);
  const agency = access.access.agency?.on === true || held !== null;
  return (k) => (k !== 'team' || staff) && (k !== 'agency' || agency);
}
const tabOf = (asked: unknown, offered: (k: InboxTab) => boolean): InboxTab => (isInboxTab(asked) && offered(asked) ? asked : 'all');

// A page of notes for one tab: the inbox (not archived), only the unread, or the archive.
inbox.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const offered = await offeredTabs(c);
  const tab = tabOf(c.req.query('tab'), offered);
  const showRaw = c.req.query('show');
  const show: InboxShow = showRaw === 'unread' || showRaw === 'archived' ? showRaw : 'inbox';
  const ask = pageOf(c);
  const t = tabWhere(tab);
  const state = show === 'archived' ? ' AND archived_at IS NOT NULL' : show === 'unread' ? ' AND archived_at IS NULL AND read_at IS NULL' : ' AND archived_at IS NULL';
  // The page and the unread count per tab (so each tab can say how many wait in it) do not depend on each other: read together.
  const [rows, unreadRows] = await Promise.all([
    db.prepare(`SELECT * FROM notifications WHERE user_id = ?${t.sql}${state} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(user.id, ...t.binds, ask.limit, ask.offset).all<Row>(),
    db.prepare('SELECT kind, COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL AND archived_at IS NULL GROUP BY kind').bind(user.id).all<{ kind: string; n: number }>(),
  ]);
  // Each kind sits in one tab (`inboxTabOf`), so a tab's count is the sum of its kinds' and Everything's is every kind's.
  const byTab = new Map<InboxTab, number>();
  for (const r of unreadRows.results) {
    const home = isInboxKind(r.kind) ? inboxTabOf(r.kind) : 'all';
    if (home !== 'all') byTab.set(home, (byTab.get(home) ?? 0) + r.n);
  }
  const everything = unreadRows.results.reduce((a, r) => a + r.n, 0);
  const tabs = INBOX_TABS.filter(offered).map((k) => ({ tab: k, unread: k === 'all' ? everything : (byTab.get(k) ?? 0) }));
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, notifications: pg.items.map(toN), unread: tabs.find((x) => x.tab === 'all')?.unread ?? 0, tab, show, tabs });
});

inbox.post('/read-all', async (c) => {
  const body = await c.req.json<{ tab?: unknown }>().catch(() => ({}) as { tab?: unknown });
  const t = tabWhere(tabOf(body.tab, await offeredTabs(c)));
  await c.env.DB.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL${t.sql}`).bind(nowIso(), c.get('user').id, ...t.binds).run();
  return c.json({ ok: true });
});

inbox.post('/:id/read', async (c) => {
  // `{ read: false }` marks it unread again (All tables' Read switch, 2026-11-14, the owner's own). No body marks it read, as Inbox sends.
  const body = await c.req.json<{ read?: unknown }>().catch(() => ({}) as { read?: unknown });
  if (body.read === false) {
    await c.env.DB.prepare('UPDATE notifications SET read_at = NULL WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
    return c.json({ ok: true, read: false });
  }
  await c.env.DB.prepare('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?').bind(nowIso(), c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});

// Put a note away, or bring it back. Putting it away also marks it read.
inbox.post('/:id/archive', async (c) => {
  const body = await c.req.json<{ archived?: unknown; unread?: unknown }>().catch(() => ({}) as { archived?: unknown; unread?: unknown });
  const now = nowIso();
  const away = body.archived !== false;
  // Undo right after archiving an unread note brings it back unread too (`unread: true`, only when bringing it back).
  if (!away && body.unread === true) {
    await c.env.DB.prepare('UPDATE notifications SET archived_at = NULL, read_at = NULL WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
    return c.json({ ok: true, archived: false });
  }
  await c.env.DB.prepare('UPDATE notifications SET archived_at = ?, read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?').bind(away ? now : null, now, c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true, archived: away });
});

// Put every read note in a tab away at once.
inbox.post('/archive-read', async (c) => {
  const body = await c.req.json<{ tab?: unknown }>().catch(() => ({}) as { tab?: unknown });
  const t = tabWhere(tabOf(body.tab, await offeredTabs(c)));
  const done = await c.env.DB.prepare(`UPDATE notifications SET archived_at = ? WHERE user_id = ? AND read_at IS NOT NULL AND archived_at IS NULL${t.sql}`).bind(nowIso(), c.get('user').id, ...t.binds).run();
  return c.json({ ok: true, archived: done.meta.changes ?? 0 });
});

// Delete for good, from the archive only: everything archived in a tab at once (before the :id route so "archived" is not read as an id)...
inbox.delete('/archived', async (c) => {
  const t = tabWhere(tabOf(c.req.query('tab'), await offeredTabs(c)));
  const done = await c.env.DB.prepare(`DELETE FROM notifications WHERE user_id = ? AND archived_at IS NOT NULL${t.sql}`).bind(c.get('user').id, ...t.binds).run();
  return c.json({ ok: true, deleted: done.meta.changes ?? 0 });
});

// ...or one archived note. A note that is not archived yet is refused: it has to be put away first.
inbox.delete('/:id', async (c) => {
  const done = await c.env.DB.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ? AND archived_at IS NOT NULL').bind(c.req.param('id'), c.get('user').id).run();
  if (!(done.meta.changes ?? 0)) return c.json({ error: 'only an archived note can be deleted' }, 404);
  return c.json({ ok: true });
});
