import { Hono } from 'hono';
import { CLUB_BENEFITS, type Membership } from '@kreators/shared';
import type { AppEnv } from '../env';
import { audit, can, nameOf, newId, notify, nowIso, oneOf, str } from '../db';

export const club = new Hono<AppEnv>();

interface Row { id: string; user_id: string; user_name: string; membership_type: 'club'; status: Membership['status']; note: string; decision_note: string; approved_by: string | null; starts_at: string | null; ends_at: string | null; created_at: string }
const SELECT = 'SELECT m.*, u.display_name AS user_name FROM memberships m JOIN users u ON u.id = m.user_id';
const toM = (r: Row): Membership => ({ id: r.id, userId: r.user_id, userName: nameOf({ display_name: r.user_name }), membershipType: r.membership_type, status: r.status, note: r.note, decisionNote: r.decision_note, approvedBy: r.approved_by, startsAt: r.starts_at, endsAt: r.ends_at, createdAt: r.created_at });

club.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const mine = await db.prepare(`${SELECT} WHERE m.user_id = ?`).bind(user.id).first<Row>();
  const queue = can(user, 'review') ? await db.prepare(`${SELECT} ORDER BY CASE m.status WHEN 'applied' THEN 0 ELSE 1 END, m.created_at DESC LIMIT 200`).all<Row>() : { results: [] as Row[] };
  const members = await db.prepare("SELECT COUNT(*) AS n FROM memberships WHERE status IN ('approved','active')").first<{ n: number }>();
  return c.json({ benefits: CLUB_BENEFITS, mine: mine ? toM(mine) : null, queue: queue.results.map(toM), members: members?.n ?? 0, reviewer: can(user, 'review') });
});

club.post('/apply', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ note?: string }>().catch(() => ({}) as { note?: string });
  const prev = await db.prepare('SELECT status FROM memberships WHERE user_id = ?').bind(user.id).first<{ status: string }>();
  if (prev && prev.status !== 'rejected' && prev.status !== 'expired') return c.json({ error: `you are already ${prev.status}` }, 409);
  await db.prepare("INSERT OR REPLACE INTO memberships (id, user_id, membership_type, status, note, decision_note, approved_by, starts_at, ends_at, created_at) VALUES (?, ?, 'club', 'applied', ?, '', NULL, NULL, NULL, ?)").bind(newId(), user.id, str(body.note, 2000), nowIso()).run();
  return c.json({ ok: true }, 201);
});

club.post('/memberships/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (!can(user, 'review')) return c.json({ error: 'reviewers decide memberships' }, 403);
  const prev = await db.prepare(`${SELECT} WHERE m.id = ?`).bind(c.req.param('id')).first<Row>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ status?: string; note?: string; months?: number }>().catch(() => ({}) as Record<string, never>);
  const status = oneOf(body.status, ['approved', 'rejected', 'suspended', 'expired', 'active'] as const, prev.status === 'applied' ? 'approved' : prev.status);
  const now = new Date();
  const months = Math.max(1, Math.min(24, Number(body.months) || 12));
  const endsAt = status === 'approved' || status === 'active' ? new Date(now.getFullYear(), now.getMonth() + months, now.getDate()).toISOString() : prev.ends_at;
  await db.prepare('UPDATE memberships SET status = ?, decision_note = ?, approved_by = ?, starts_at = COALESCE(starts_at, ?), ends_at = ? WHERE id = ?').bind(status, str(body.note, 1000, prev.decision_note), user.id, status === 'approved' ? now.toISOString() : null, endsAt, prev.id).run();
  if (status === 'approved') await db.prepare("INSERT OR IGNORE INTO honors (user_id, honor_key, note, awarded_at) VALUES (?, 'community_star', 'Club member', ?)").bind(prev.user_id, nowIso()).run();
  await audit(db, user.id, 'membership.status', 'membership', prev.id, prev.status, status);
  await notify(db, prev.user_id, 'club', `Club: ${status}`, str(body.note, 160), '/club');
  return c.json({ ok: true });
});
