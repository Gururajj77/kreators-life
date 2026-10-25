import { Hono } from 'hono';
import { TOOL_CATEGORIES, type Tool } from '@kreators/shared';
import type { AppEnv } from '../env';
import { can, nameOf, newId, nowIso, oneOf, str } from '../db';
import { featureUntil } from './market';

export const tools = new Hono<AppEnv>();

interface Row { id: string; name: string; category: string; url: string; description: string; affiliate: number; verified: number; suggested_by_name: string | null; created_at: string; featured_until: string | null; clicks: number }
const SELECT = "SELECT t.*, u.display_name AS suggested_by_name, (SELECT COUNT(*) FROM outbound_clicks c WHERE c.kind = 'tool' AND c.target_id = t.id) AS clicks FROM tools t LEFT JOIN users u ON u.id = t.suggested_by";
const toT = (r: Row): Tool => ({ id: r.id, name: r.name, category: r.category, url: r.url, description: r.description, affiliate: r.affiliate === 1, verified: r.verified === 1, suggestedByName: r.suggested_by_name ? nameOf({ display_name: r.suggested_by_name }) : 'Kreators', createdAt: r.created_at, featuredUntil: r.featured_until, clicks: r.clicks });

tools.get('/', async (c) => {
  const user = c.get('user');
  const staff = can(user, 'review');
  const now = nowIso();
  const order = `ORDER BY CASE WHEN t.featured_until > '${now}' THEN 0 ELSE 1 END, t.verified DESC, t.name`;
  const rows = await c.env.DB.prepare(staff ? `${SELECT} ${order}` : `${SELECT} WHERE t.verified = 1 OR t.suggested_by = ? ${order}`).bind(...(staff ? [] : [user.id])).all<Row>();
  return c.json({ tools: rows.results.map(toT), categories: TOOL_CATEGORIES, reviewer: staff });
});

tools.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const name = str(body.name, 80);
  const url = str(body.url, 500);
  if (!name || !/^https?:\/\//.test(url)) return c.json({ error: 'a name and a link' }, 400);
  const id = newId();
  await db.prepare('INSERT INTO tools (id, name, category, url, description, affiliate, verified, suggested_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, name, oneOf(body.category, TOOL_CATEGORIES, 'Editing'), url, str(body.description, 500), body.affiliate === true ? 1 : 0, can(user, 'review') ? 1 : 0, user.id, nowIso()).run();
  return c.json({ ok: true, id, verified: can(user, 'review') }, 201);
});

tools.post('/:id', async (c) => {
  const user = c.get('user');
  if (!can(user, 'review')) return c.json({ error: 'you do not have access to that' }, 403);
  type Body = { verified?: boolean; affiliate?: boolean; featured?: boolean };
  const body = await c.req.json<Body>().catch(() => ({}) as Body);
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (typeof body.verified === 'boolean') {
    sets.push('verified = ?');
    binds.push(body.verified ? 1 : 0);
  }
  if (typeof body.affiliate === 'boolean') {
    sets.push('affiliate = ?');
    binds.push(body.affiliate ? 1 : 0);
  }
  if (typeof body.featured === 'boolean') {
    sets.push('featured_until = ?');
    binds.push(body.featured ? featureUntil() : null);
  }
  if (sets.length === 0) return c.json({ error: 'nothing to change' }, 400);
  const r = await c.env.DB.prepare(`UPDATE tools SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, c.req.param('id')).run();
  if (!r.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

tools.delete('/:id', async (c) => {
  const user = c.get('user');
  if (!can(user, 'review')) return c.json({ error: 'reviewers remove tools' }, 403);
  await c.env.DB.prepare('DELETE FROM tools WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});
