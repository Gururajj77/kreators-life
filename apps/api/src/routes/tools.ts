import { Hono } from 'hono';
import { TOOL_CATEGORIES, type Tool } from '@kreators/shared';
import type { AppEnv } from '../env';
import { can, nameOf, newId, nowIso, oneOf, str } from '../db';

export const tools = new Hono<AppEnv>();

interface Row { id: string; name: string; category: string; url: string; description: string; affiliate: number; verified: number; suggested_by_name: string | null; created_at: string }
const SELECT = 'SELECT t.*, u.display_name AS suggested_by_name FROM tools t LEFT JOIN users u ON u.id = t.suggested_by';
const toT = (r: Row): Tool => ({ id: r.id, name: r.name, category: r.category, url: r.url, description: r.description, affiliate: r.affiliate === 1, verified: r.verified === 1, suggestedByName: r.suggested_by_name ? nameOf({ display_name: r.suggested_by_name }) : 'Kreators', createdAt: r.created_at });

tools.get('/', async (c) => {
  const user = c.get('user');
  const staff = can(user, 'review');
  const rows = await c.env.DB.prepare(staff ? `${SELECT} ORDER BY t.verified DESC, t.name` : `${SELECT} WHERE t.verified = 1 OR t.suggested_by = ? ORDER BY t.verified DESC, t.name`).bind(...(staff ? [] : [user.id])).all<Row>();
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
  if (!can(user, 'review')) return c.json({ error: 'reviewers verify tools' }, 403);
  const body = await c.req.json<{ verified?: boolean; affiliate?: boolean }>().catch(() => ({}) as Record<string, never>);
  await c.env.DB.prepare('UPDATE tools SET verified = COALESCE(?, verified), affiliate = COALESCE(?, affiliate) WHERE id = ?').bind(typeof body.verified === 'boolean' ? (body.verified ? 1 : 0) : null, typeof body.affiliate === 'boolean' ? (body.affiliate ? 1 : 0) : null, c.req.param('id')).run();
  return c.json({ ok: true });
});

tools.delete('/:id', async (c) => {
  const user = c.get('user');
  if (!can(user, 'review')) return c.json({ error: 'reviewers remove tools' }, 403);
  await c.env.DB.prepare('DELETE FROM tools WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});
