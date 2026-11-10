import { Hono } from 'hono';
import { CLUB_BENEFITS, type Membership } from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { audit, can, getUser, liveUser, nameOf, newId, notify, nowIso, oneOf, str, pageOf, paged } from '../db';
import { ADMIN_NAMED_MANAGER, adminHolds, endManagerRows } from '../connectRank';

export const club = new Hono<AppEnv>();

interface Row { id: string; user_id: string; user_name: string; membership_type: 'club'; status: Membership['status']; note: string; decision_note: string; approved_by: string | null; manager_user_id: string | null; manager_name: string | null; starts_at: string | null; ends_at: string | null; created_at: string }
const SELECT = 'SELECT m.*, u.display_name AS user_name, g.display_name AS manager_name FROM memberships m JOIN users u ON u.id = m.user_id LEFT JOIN users g ON g.id = m.manager_user_id';
const toM = (r: Row): Membership => ({ id: r.id, userId: r.user_id, userName: nameOf({ display_name: r.user_name }), membershipType: r.membership_type, status: r.status, note: r.note, decisionNote: r.decision_note, approvedBy: r.approved_by, managerId: r.manager_user_id, managerName: r.manager_user_id ? nameOf({ display_name: r.manager_name ?? '' }) : null, startsAt: r.starts_at, endsAt: r.ends_at, createdAt: r.created_at });

club.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const mine = await db.prepare(`${SELECT} WHERE m.user_id = ?`).bind(user.id).first<Row>();
  const ask = pageOf(c);
  // A deleted account is never in the queue or the count (`liveUser`).
  const queue = can(user, 'review') ? await db.prepare(`${SELECT} WHERE ${liveUser('u')} ORDER BY CASE m.status WHEN 'applied' THEN 0 ELSE 1 END, m.created_at DESC LIMIT ? OFFSET ?`).bind(ask.limit, ask.offset).all<Row>() : { results: [] as Row[] };
  const pg = paged(queue.results, ask);
  const members = await db.prepare(`SELECT COUNT(*) AS n FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.status IN ('approved','active') AND ${liveUser('u')}`).first<{ n: number }>();
  // Reviewers pick a manager from the staff, so they get the list.
  const staff = can(user, 'review') ? await db.prepare(`SELECT id, display_name FROM users u WHERE role IN ('sub_admin', 'admin') AND ${liveUser('u')} ORDER BY display_name LIMIT 100`).all<{ id: string; display_name: string }>() : { results: [] as { id: string; display_name: string }[] };
  return c.json({ page: pg.page, benefits: CLUB_BENEFITS, mine: mine ? toM(mine) : null, queue: pg.items.map(toM), members: members?.n ?? 0, reviewer: can(user, 'review'), staff: staff.results.map((r) => ({ id: r.id, name: nameOf(r) })) });
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
  await notify(db, prev.user_id, 'club', `Club: ${status}`, str(body.note, 160), '/club#mine-heading');
  return c.json({ ok: true });
});

// Name a manager for a member: someone on staff who knows their work. Reviewers do this; the member is told.
club.post('/memberships/:id/manager', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (!can(user, 'review')) return c.json({ error: 'reviewers name managers' }, 403);
  const body = await c.req.json<{ managerId?: string | null }>().catch(() => ({}) as { managerId?: string | null });
  const r = await nameClubManager(db, user, c.req.param('id'), typeof body.managerId === 'string' && body.managerId ? body.managerId : null);
  return c.json(r.body, r.code);
});

/**
 * Name (or clear) a member's Club manager, the one way: a reviewer's route above, and the team's Connect people in Admin
 * (routes/adminConnect.ts). A manager is someone on staff; the member is told. Null is the admin key. By rank (connectRank.ts): a manager
 * an admin or the key named through Connect people stays until an admin changes it. With `from` (the manager the caller read, null for
 * none) the change is guarded on it, so it never takes off someone named a moment ago (Connect people's End); 409 then. Every team row
 * that named the one before ends with the change, in the same batch.
 */
export async function nameClubManager(db: D1Database, actor: UserRow | null, membershipId: string, managerId: string | null, from?: string | null): Promise<{ code: 200 | 400 | 403 | 404 | 409; body: { ok?: true; error?: string } }> {
  const prev = await db.prepare(`${SELECT} WHERE m.id = ?`).bind(membershipId).first<Row>();
  if (!prev) return { code: 404, body: { error: 'not found' } };
  if (actor && actor.role !== 'admin' && prev.manager_user_id && (await adminHolds(db, 'club', prev.id))) return { code: 403, body: { error: ADMIN_NAMED_MANAGER } };
  let managerName = '';
  if (managerId) {
    const m = await getUser(db, managerId);
    if (!m || m.role === 'user') return { code: 400, body: { error: 'a manager is someone on staff' } };
    managerName = nameOf(m);
  }
  const was = from === undefined ? prev.manager_user_id : from;
  const [res] = await db.batch([
    db.prepare('UPDATE memberships SET manager_user_id = ? WHERE id = ? AND manager_user_id IS ?').bind(managerId, prev.id, was),
    endManagerRows(db, 'club', prev.id, managerId, nowIso()),
  ]);
  if (!res?.meta.changes) return { code: 409, body: { error: 'Someone changed it a moment ago. Read it again.' } };
  await audit(db, actor?.id ?? null, 'membership.manager', 'membership', prev.id, prev.manager_user_id ?? '', managerId ?? '');
  if (managerId) await notify(db, prev.user_id, 'club', `Your Club manager is ${managerName}`, 'Someone on staff who knows your work. Write to the team under Help to reach them.', '/club#mine-heading');
  return { code: 200, body: { ok: true } };
}
