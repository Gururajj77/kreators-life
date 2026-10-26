import { Hono } from 'hono';
import { isBadgeKey, TOOL_CATEGORIES, unlockFor, type Tool } from '@kreators/shared';
import type { AppEnv } from '../env';
import { badgesNow, can, honorKeys, nameOf, newId, nowIso, num, oneOf, str, pageOf, paged } from '../db';
import type { UserRow } from '../env';
import { featureUntil } from './market';

export const tools = new Hono<AppEnv>();

interface Row { id: string; name: string; category: string; url: string; description: string; affiliate: number; verified: number; suggested_by_name: string | null; created_at: string; featured_until: string | null; clicks: number; min_points: number; badge: string }
const SELECT = "SELECT t.*, u.display_name AS suggested_by_name, (SELECT COUNT(*) FROM outbound_clicks c WHERE c.kind = 'tool' AND c.target_id = t.id) AS clicks FROM tools t LEFT JOIN users u ON u.id = t.suggested_by";
type Have = { points: number; badges: readonly string[] };
const toT = (r: Row, have: Have): Tool => {
  const unlock = unlockFor({ minPoints: r.min_points, badge: r.badge }, have);
  return { id: r.id, name: r.name, category: r.category, url: unlock.ok ? r.url : '', description: r.description, affiliate: r.affiliate === 1, verified: r.verified === 1, suggestedByName: r.suggested_by_name ? nameOf({ display_name: r.suggested_by_name }) : 'kreators.app', createdAt: r.created_at, featuredUntil: r.featured_until, clicks: r.clicks, minPoints: r.min_points, badge: r.badge, unlock };
};
const haveFor = async (db: D1Database, user: UserRow): Promise<Have> => ({ points: user.points, badges: [...(await badgesNow(db, user.id)), ...(await honorKeys(db, user))] });

tools.get('/', async (c) => {
  const user = c.get('user');
  const staff = can(user, 'review');
  const now = nowIso();
  const order = `ORDER BY CASE WHEN t.featured_until > '${now}' THEN 0 ELSE 1 END, t.verified DESC, t.name`;
  const ask = pageOf(c);
  const rows = await c.env.DB.prepare(staff ? `${SELECT} ${order} LIMIT ? OFFSET ?` : `${SELECT} WHERE t.verified = 1 OR t.suggested_by = ? ${order} LIMIT ? OFFSET ?`).bind(...(staff ? [] : [user.id]), ask.limit, ask.offset).all<Row>();
  const have = await haveFor(c.env.DB, user);
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, tools: pg.items.map((r) => toT(r, have)), categories: TOOL_CATEGORIES, reviewer: staff });
});

tools.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const name = str(body.name, 80);
  const url = str(body.url, 500);
  if (!name || !/^https?:\/\//.test(url)) return c.json({ error: 'a name and a link' }, 400);
  const id = newId();
  const staff = can(user, 'review');
  await db.prepare('INSERT INTO tools (id, name, category, url, description, affiliate, verified, suggested_by, created_at, min_points, badge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, name, oneOf(body.category, TOOL_CATEGORIES, 'Editing'), url, str(body.description, 500), body.affiliate === true ? 1 : 0, staff ? 1 : 0, user.id, nowIso(), staff ? (num(body.minPoints, 0, 0) ?? 0) : 0, staff && isBadgeKey(str(body.badge, 40)) ? str(body.badge, 40) : '').run();
  return c.json({ ok: true, id, verified: can(user, 'review') }, 201);
});

tools.post('/:id', async (c) => {
  const user = c.get('user');
  if (!can(user, 'review')) return c.json({ error: 'you do not have access to that' }, 403);
  type Body = { verified?: boolean; affiliate?: boolean; featured?: boolean; minPoints?: number; badge?: string };
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
  if (body.minPoints !== undefined) {
    sets.push('min_points = ?');
    binds.push(num(body.minPoints, 0, 0) ?? 0);
  }
  if (body.badge !== undefined) {
    sets.push('badge = ?');
    binds.push(isBadgeKey(str(body.badge, 40)) ? str(body.badge, 40) : '');
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
