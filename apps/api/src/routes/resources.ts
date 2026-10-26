import { Hono } from 'hono';
import type { Resource, ResourceKind } from '@kreators/shared';
import type { AppEnv } from '../env';
import { nameOf, newId, nowIso, requireRole, pageOf, paged } from '../db';

export const resources = new Hono<AppEnv>();

interface Row {
  id: string;
  kind: ResourceKind;
  title: string;
  summary: string;
  body: string;
  url: string | null;
  tags: string;
  published: number;
  author_name: string | null;
  created_at: string;
}
const SELECT = `SELECT r.*, u.display_name AS author_name FROM resources r LEFT JOIN users u ON u.id = r.author_id`;
function toR(r: Row): Resource {
  let tags: string[] = [];
  try {
    tags = JSON.parse(r.tags || '[]') as string[];
  } catch {
    tags = [];
  }
  return { id: r.id, kind: r.kind, title: r.title, summary: r.summary, body: r.body, url: r.url, tags, published: r.published === 1, authorName: r.author_name ? nameOf({ display_name: r.author_name }) : 'kreators.app guides', createdAt: r.created_at };
}

resources.get('/', async (c) => {
  const tag = (c.req.query('tag') ?? '').trim();
  const ask = pageOf(c);
  const rows = tag
    ? await c.env.DB.prepare(`${SELECT} WHERE r.published = 1 AND r.tags LIKE ? ORDER BY r.created_at DESC LIMIT ? OFFSET ?`).bind(`%"${tag}"%`, ask.limit, ask.offset).all<Row>()
    : await c.env.DB.prepare(`${SELECT} WHERE r.published = 1 ORDER BY r.created_at DESC LIMIT ? OFFSET ?`).bind(ask.limit, ask.offset).all<Row>();
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, resources: pg.items.map(toR) });
});

resources.get('/:id', async (c) => {
  const row = await c.env.DB.prepare(`${SELECT} WHERE r.id = ?`).bind(c.req.param('id')).first<Row>();
  if (!row || (row.published !== 1 && c.get('user').role === 'user')) return c.json({ error: 'not found' }, 404);
  return c.json({ resource: toR(row) });
});

// Guides and admins author resources.
export const manageResources = new Hono<AppEnv>();
manageResources.use('*', requireRole('sub_admin'));

function parse(body: Record<string, unknown>, prev?: Row) {
  const kind = body.kind === 'exercise' || body.kind === 'video' || body.kind === 'article' ? body.kind : (prev?.kind ?? 'article');
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 140) : (prev?.title ?? '');
  const summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, 300) : (prev?.summary ?? '');
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 20000) : (prev?.body ?? '');
  const url = typeof body.url === 'string' && body.url.trim() ? body.url.trim().slice(0, 500) : body.url === null ? null : (prev?.url ?? null);
  const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === 'string').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8) : prev ? (JSON.parse(prev.tags || '[]') as string[]) : [];
  const published = typeof body.published === 'boolean' ? body.published : prev ? prev.published === 1 : false;
  return { kind, title, summary, text, url, tags, published };
}

manageResources.get('/', async (c) => {
  const ask = pageOf(c);
  const rows = await c.env.DB.prepare(`${SELECT} ORDER BY r.updated_at DESC LIMIT ? OFFSET ?`).bind(ask.limit, ask.offset).all<Row>();
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, resources: pg.items.map(toR) });
});

manageResources.post('/', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const p = parse(body);
  if (!p.title) return c.json({ error: 'title required' }, 400);
  const id = newId();
  const now = nowIso();
  await c.env.DB.prepare('INSERT INTO resources (id, author_id, kind, title, summary, body, url, tags, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, c.get('user').id, p.kind, p.title, p.summary, p.text, p.url, JSON.stringify(p.tags), p.published ? 1 : 0, now, now)
    .run();
  const row = await c.env.DB.prepare(`${SELECT} WHERE r.id = ?`).bind(id).first<Row>();
  return c.json({ resource: row ? toR(row) : null }, 201);
});

manageResources.patch('/:id', async (c) => {
  const prev = await c.env.DB.prepare(`${SELECT} WHERE r.id = ?`).bind(c.req.param('id')).first<Row>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const p = parse(body, prev);
  await c.env.DB.prepare('UPDATE resources SET kind = ?, title = ?, summary = ?, body = ?, url = ?, tags = ?, published = ?, updated_at = ? WHERE id = ?')
    .bind(p.kind, p.title, p.summary, p.text, p.url, JSON.stringify(p.tags), p.published ? 1 : 0, nowIso(), prev.id)
    .run();
  const row = await c.env.DB.prepare(`${SELECT} WHERE r.id = ?`).bind(prev.id).first<Row>();
  return c.json({ resource: row ? toR(row) : null });
});

manageResources.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM resources WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});
