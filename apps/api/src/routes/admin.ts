import { Hono } from 'hono';
import { attendeeXpLocked, type AdminCoachAsk, type AdminCoachLink, EVENT_TYPES, HONOR_BY_KEY, isPaidPlan, type AdminAttendeeCode, type AttendeeCodeApp, isRole, MAX_CREDIT_GRANT, PLAN_DAYS, LISTING_TYPES, MODULE_BY_KEY, MODULES, OPPORTUNITY_TYPES, PERMISSIONS, TOOL_CATEGORIES, type AdminRedemption, type AdminUser, type AuditLog, type FlagOverride, type Listing, type ListingType, type ModuleSetting, type Permission } from '@kreators/shared';
import { resolveAccess } from '../access';
import { listingsFor } from './explore';
import { ORDER_SELECT, toOrder, type OrderRow } from './studio';
import { refundOrder } from './growth';
import { handlePaymentEvent } from './go';
import { handleComment } from './growth';
import { providerFor } from '../payments';
import { toKyc, type KycRow } from './kyc';
import { logEvent, sendEmail, track } from '../ops';
import { notify, pageOf, paged } from '../db';
import type { AdminFunnel, AdminKyc, AdminOrder, OrderEvent, OutboxEmail, WebhookEvent } from '@kreators/shared';
import type { Context } from 'hono';
import type { AppEnv, UserRow } from '../env';
import { audit, can, getUser, nameOf, newId, nowIso, num, oneOf, parseList, sessionUser, str } from '../db';
import { accountOf, addCredits, setPlan } from '../credits';
import { setEventCode, setRunCode } from '../attendee';
import { endLink, LINK, linkById, logCoach, type LinkRow } from '../coaching';
import { linkProblem, startLink } from './coach';
import { toRedemption, type RedemptionRow } from './rewards';

export const admin = new Hono<AppEnv>();

// A single shared secret. Set it with `wrangler secret put ADMIN_KEY`
// (or ADMIN_KEY in apps/api/.dev.vars locally). Unset means no admin at all.
// Either the shared admin key, or a signed-in person whose role is admin.
admin.use('*', async (c, next) => {
  const key = c.env.ADMIN_KEY;
  const given = c.req.header('X-Admin-Key') ?? '';
  const user = await sessionUser(c);
  if (user) c.set('user', user);
  if (key && given && given.length === key.length && timingSafeEqual(given, key)) return next();
  if (user?.role === 'admin') return next();
  if (!key && !user) return c.json({ error: 'admin is not enabled on this deployment' }, 503);
  return c.json({ error: 'forbidden' }, 403);
});

const actorOf = (c: { get: (k: 'user') => UserRow | undefined }) => c.get('user')?.id ?? null;

/** Rows that need an author get the signed-in admin, else the first admin account, else the key itself. */
async function authorFor(c: { get: (k: 'user') => UserRow | undefined; env: { DB: D1Database } }): Promise<string> {
  const actor = actorOf(c);
  if (actor) return actor;
  const first = await c.env.DB.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1").first<{ id: string }>();
  return first?.id ?? 'admin-key';
}

function timingSafeEqual(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface UserListRow extends UserRow {
  honor_keys: string | null;
  coach_asked_at: string | null;
  ca_plan: string | null;
  ca_plan_until: string | null;
  ca_plan_credits: number | null;
  ca_extra_credits: number | null;
}

function toAdminUser(r: UserListRow): AdminUser {
  const live = isPaidPlan(r.ca_plan) && (!r.ca_plan_until || r.ca_plan_until > nowIso());
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
    role: r.role,
    email: r.email,
    handle: r.handle,
    permissions: parseList(r.permissions).filter((p): p is Permission => (PERMISSIONS as readonly string[]).includes(p)),
    // A plan whose time is up reads as none here; it is closed for good the next time the account is read.
    plan: live ? (r.ca_plan as AdminUser['plan']) : 'none',
    planUntil: live ? r.ca_plan_until : null,
    planCredits: live ? (r.ca_plan_credits ?? 0) : 0,
    extraCredits: r.ca_extra_credits ?? 0,
    coachAskedAt: r.coach_asked_at ?? null,
  };
}

admin.post('/users/:id/permissions', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<{ permissions?: unknown }>().catch(() => ({}) as { permissions?: unknown });
  const perms = Array.isArray(body.permissions) ? body.permissions.filter((p): p is Permission => (PERMISSIONS as readonly string[]).includes(String(p))) : [];
  const prev = await getUser(db, c.req.param('id'));
  if (!prev) return c.json({ error: 'not found' }, 404);
  await db.prepare('UPDATE users SET permissions = ? WHERE id = ?').bind(JSON.stringify(perms), prev.id).run();
  await audit(db, actorOf(c), 'user.permissions', 'user', prev.id, parseList(prev.permissions), perms);
  // Life coach is the one permission the person hears about: given, it answers their ask; taken, their students are told.
  const was = parseList(prev.permissions).includes('coach');
  const now = perms.includes('coach');
  if (!was && now) {
    await db.prepare('UPDATE coach_profiles SET asked_at = NULL WHERE user_id = ?').bind(prev.id).run();
    await notify(db, prev.id, 'coach', 'You are a life coach now', 'Your badge says Life coach. Open Coaching to write your line and ask your first students; each one has to say yes.', '/coaching');
  } else if (was && !now) {
    const open = await db.prepare(`${LINK} WHERE l.coach_id = ? AND l.status IN ('pending','active')`).bind(prev.id).all<LinkRow>();
    for (const l of open.results) await endLink(db, l, { id: null, name: 'The team' });
    await notify(db, prev.id, 'coach', 'You are no longer a life coach', open.results.length ? 'Your students were told, and you no longer see their progress.' : '', '/coaching');
  }
  const fresh = await loadUser(db, prev.id);
  return c.json({ user: fresh ? toAdminUser(fresh) : null });
});

// ---- life coaches: the asks to become one, every link between a coach and a student, and linking two people
const COACH_LINK_SELECT = `SELECT l.id, l.coach_id, l.student_id, l.status, l.asked_by, l.created_at, l.ended_at, c.display_name AS coach_name, s.display_name AS student_name
  FROM coach_links l JOIN users c ON c.id = l.coach_id JOIN users s ON s.id = l.student_id`;
interface AdminLinkRow { id: string; coach_id: string; student_id: string; status: AdminCoachLink['status']; asked_by: AdminCoachLink['askedBy']; created_at: string; ended_at: string | null; coach_name: string; student_name: string }
const toAdminLink = (r: AdminLinkRow): AdminCoachLink => ({ id: r.id, coachId: r.coach_id, coachName: nameOf({ display_name: r.coach_name }), studentId: r.student_id, studentName: nameOf({ display_name: r.student_name }), status: r.status, askedBy: r.asked_by, createdAt: r.created_at, endedAt: r.ended_at });

admin.get('/coaching/links', async (c) => {
  const ask = pageOf(c);
  const want = c.req.query('status') ?? '';
  const status = ['pending', 'active', 'declined', 'ended'].includes(want) ? want : '';
  const q = (c.req.query('q') ?? '').trim();
  const rows = await c.env.DB.prepare(`${COACH_LINK_SELECT} WHERE (?1 = '' OR l.status = ?1) AND (?2 = '' OR c.display_name LIKE ?3 OR s.display_name LIKE ?3) ORDER BY l.created_at DESC, l.id LIMIT ?4 OFFSET ?5`)
    .bind(status, q, `%${q.replace(/[%_]/g, '')}%`, ask.limit, ask.offset)
    .all<AdminLinkRow>();
  const pg = paged(rows.results, ask);
  return c.json({ links: pg.items.map(toAdminLink), page: pg.page });
});

// Every life coach, for the link form: who they are and how many students they have.
admin.get('/coaching/coaches', async (c) => {
  const ask = pageOf(c);
  const rows = await c.env.DB.prepare(
    `SELECT u.id, u.display_name, u.handle, u.email, (SELECT COUNT(*) FROM coach_links x WHERE x.coach_id = u.id AND x.status = 'active') AS students
     FROM users u WHERE u.permissions LIKE '%"coach"%' ORDER BY u.display_name COLLATE NOCASE, u.id LIMIT ? OFFSET ?`,
  )
    .bind(ask.limit, ask.offset)
    .all<{ id: string; display_name: string; handle: string | null; email: string | null; students: number }>();
  const pg = paged(rows.results, ask);
  return c.json({ coaches: pg.items.map((r) => ({ id: r.id, name: nameOf(r), handle: r.handle, email: r.email, students: r.students })), page: pg.page });
});

// People who asked to be made a life coach. Saying yes is giving the Life coach permission, above.
admin.get('/coaching/asks', async (c) => {
  const ask = pageOf(c);
  const rows = await c.env.DB.prepare(
    `SELECT u.id, u.display_name, u.email, u.handle, p.about, p.asked_at FROM coach_profiles p JOIN users u ON u.id = p.user_id
     WHERE p.asked_at IS NOT NULL AND u.permissions NOT LIKE '%"coach"%' ORDER BY p.asked_at ASC, u.id LIMIT ? OFFSET ?`,
  )
    .bind(ask.limit, ask.offset)
    .all<{ id: string; display_name: string; email: string | null; handle: string | null; about: string; asked_at: string }>();
  const pg = paged(rows.results, ask);
  const asks: AdminCoachAsk[] = pg.items.map((r) => ({ userId: r.id, name: nameOf(r), email: r.email, handle: r.handle, about: r.about, askedAt: r.asked_at }));
  return c.json({ asks, page: pg.page });
});

admin.post('/coaching/asks/:id/decline', async (c) => {
  const db = c.env.DB;
  const row = await db.prepare('SELECT user_id FROM coach_profiles WHERE user_id = ? AND asked_at IS NOT NULL').bind(c.req.param('id')).first<{ user_id: string }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  await db.prepare('UPDATE coach_profiles SET asked_at = NULL WHERE user_id = ?').bind(row.user_id).run();
  await audit(db, actorOf(c), 'coach.ask.decline', 'user', row.user_id);
  await notify(db, row.user_id, 'coach', 'Not a life coach for now', 'The team said no to coaching for now. You can ask again later from Coaching.', '/coaching');
  return c.json({ ok: true });
});

// Link a coach and a student: ask the student (they say yes or no) or, when they agreed outside the app, link them now.
admin.post('/coaching/links', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<{ coachId?: unknown; student?: unknown; mode?: unknown }>().catch(() => ({}) as Record<string, never>);
  const coachRow = typeof body.coachId === 'string' ? await getUser(db, body.coachId) : null;
  if (!coachRow || !can(coachRow, 'coach')) return c.json({ error: 'Pick a life coach.' }, 400);
  const who = typeof body.student === 'string' ? body.student.trim().toLowerCase() : '';
  const student = who
    ? await db.prepare('SELECT * FROM users WHERE id = ? OR LOWER(email) = ? OR handle = ?').bind(who, who, who.replace(/^@/, '')).first<UserRow>()
    : null;
  if (!student) return c.json({ error: 'No account has that email, handle or id.' }, 404);
  const bad = await linkProblem(db, coachRow.id, student.id);
  if (bad) return c.json({ error: bad.error }, bad.status);
  const now = body.mode === 'link';
  const link = await startLink(db, { coachId: coachRow.id, studentId: student.id, askedBy: 'admin', createdBy: actorOf(c), active: now });
  if (!link) return c.json({ error: 'not found' }, 404);
  await audit(db, actorOf(c), now ? 'coach.link' : 'coach.ask', 'coach_link', link.id, '', { coach: coachRow.id, student: student.id });
  await logCoach(db, { linkId: link.id, coachId: coachRow.id, studentId: student.id, actorId: null, action: now ? 'link.admin' : 'link.ask', label: now ? `The team linked ${nameOf(coachRow)} and ${nameOf(student)}` : `The team asked ${nameOf(student)} to work with ${nameOf(coachRow)}` });
  await notify(db, student.id, 'coach', now ? `${nameOf(coachRow)} is your life coach now` : `The team suggests ${nameOf(coachRow)} as your life coach`, now ? 'Pick what they see on your Profile tab, or end it there.' : 'Say yes or no on your Profile tab. Nothing is shared until you say yes.', '/you#coach');
  await notify(db, coachRow.id, 'coach', now ? `${nameOf(student)} is your student now` : `The team asked ${nameOf(student)} to work with you`, now ? 'Open Coaching to see what they share.' : 'You hear back when they answer.', '/coaching');
  const row = await db.prepare(`${COACH_LINK_SELECT} WHERE l.id = ?`).bind(link.id).first<AdminLinkRow>();
  return c.json({ link: row ? toAdminLink(row) : null }, 201);
});

admin.delete('/coaching/links/:id', async (c) => {
  const db = c.env.DB;
  const link = await linkById(db, c.req.param('id'));
  if (!link) return c.json({ error: 'not found' }, 404);
  if (link.status === 'pending' || link.status === 'active') {
    await endLink(db, link, { id: null, name: 'The team' });
    await audit(db, actorOf(c), 'coach.end', 'coach_link', link.id, link.status, 'ended');
  }
  return c.json({ ok: true });
});

admin.post('/users/:id/role', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<{ role?: string }>().catch(() => ({}) as { role?: string });
  if (!isRole(body.role)) return c.json({ error: 'role must be user, sub_admin or admin' }, 400);
  const before = await getUser(db, c.req.param('id'));
  await db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(body.role, c.req.param('id')).run();
  await audit(db, actorOf(c), 'user.role', 'user', c.req.param('id'), before?.role ?? '', body.role);
  const fresh = await loadUser(db, c.req.param('id'));
  if (!fresh) return c.json({ error: 'not found' }, 404);
  return c.json({ user: toAdminUser(fresh) });
});

// ---- feature flags: a global switch, a minimum role, a rollout percentage, and targeted overrides
interface SettingRow { key: string; enabled: number; min_role: string; rollout: number }
interface OverrideRow { id: string; flag_key: string; subject_type: FlagOverride['subjectType']; subject_id: string; enabled: number; expires_at: string | null; reason: string; created_by: string | null; created_at: string }
const toOverride = (r: OverrideRow): FlagOverride => ({ id: r.id, flagKey: r.flag_key, subjectType: r.subject_type, subjectId: r.subject_id, enabled: r.enabled === 1, expiresAt: r.expires_at, reason: r.reason, createdBy: r.created_by ?? '', createdAt: r.created_at });

async function allSettings(db: D1Database): Promise<ModuleSetting[]> {
  const rows = await db.prepare('SELECT * FROM module_settings').all<SettingRow>();
  return MODULES.map((m) => {
    const r = rows.results.find((x) => x.key === m.key);
    return { key: m.key, enabled: r ? r.enabled === 1 : true, minRole: r && isRole(r.min_role) ? r.min_role : m.minRole, rollout: r?.rollout ?? 100 };
  });
}

admin.get('/modules', async (c) => c.json({ settings: await allSettings(c.env.DB) }));

admin.get('/flags', async (c) => {
  const db = c.env.DB;
  const [settings, ovs] = await Promise.all([allSettings(db), db.prepare('SELECT * FROM flag_overrides ORDER BY created_at DESC LIMIT 300').all<OverrideRow>()]);
  return c.json({ settings, overrides: ovs.results.map(toOverride) });
});

async function setFlag(c: Context<AppEnv>) {
  const db = c.env.DB;
  const key = c.req.param('key') ?? '';
  const m = MODULE_BY_KEY[key];
  if (!m) return c.json({ error: 'no such module' }, 404);
  const body = await c.req.json<{ enabled?: boolean; minRole?: string; rollout?: number }>().catch(() => ({}) as { enabled?: boolean; minRole?: string; rollout?: number });
  const prev = await db.prepare('SELECT * FROM module_settings WHERE key = ?').bind(key).first<SettingRow>();
  const enabled = typeof body.enabled === 'boolean' ? body.enabled : prev ? prev.enabled === 1 : true;
  const minRole = isRole(body.minRole) ? body.minRole : prev && isRole(prev.min_role) ? prev.min_role : m.minRole;
  const rollout = num(body.rollout, prev?.rollout ?? 100, 0, 100) ?? 100;
  await db.prepare('INSERT OR REPLACE INTO module_settings (key, enabled, min_role, rollout) VALUES (?, ?, ?, ?)').bind(key, enabled ? 1 : 0, minRole, rollout).run();
  const setting: ModuleSetting = { key, enabled, minRole, rollout };
  await audit(db, actorOf(c), 'flag.set', 'module', key, prev ?? '', setting);
  return c.json({ setting });
}
admin.post('/modules/:key', setFlag);
admin.post('/flags/:key', setFlag);

admin.post('/flags/:key/overrides', async (c) => {
  const db = c.env.DB;
  const key = c.req.param('key');
  if (!MODULE_BY_KEY[key]) return c.json({ error: 'no such module' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const subjectType = oneOf(body.subjectType, ['user', 'role', 'organization'] as const, 'user');
  const subjectId = str(body.subjectId, 80);
  if (!subjectId) return c.json({ error: 'who is this for?' }, 400);
  const id = newId();
  const expiresAt = str(body.expiresAt, 40) || null;
  await db
    .prepare('INSERT INTO flag_overrides (id, flag_key, subject_type, subject_id, enabled, expires_at, reason, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, key, subjectType, subjectId, body.enabled === false ? 0 : 1, expiresAt, str(body.reason, 200), actorOf(c), nowIso())
    .run();
  await audit(db, actorOf(c), 'flag.override', 'module', key, '', { subjectType, subjectId, enabled: body.enabled !== false, expiresAt });
  const row = await db.prepare('SELECT * FROM flag_overrides WHERE id = ?').bind(id).first<OverrideRow>();
  return c.json({ override: row ? toOverride(row) : null }, 201);
});

admin.delete('/flags/overrides/:id', async (c) => {
  const db = c.env.DB;
  const prev = await db.prepare('SELECT * FROM flag_overrides WHERE id = ?').bind(c.req.param('id')).first<OverrideRow>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  await db.prepare('DELETE FROM flag_overrides WHERE id = ?').bind(prev.id).run();
  await audit(db, actorOf(c), 'flag.override.remove', 'module', prev.flag_key, toOverride(prev), '');
  return c.json({ ok: true });
});

// What one person actually sees, after every rule.
admin.get('/flags/preview/:userId', async (c) => {
  const user = await getUser(c.env.DB, c.req.param('userId'));
  if (!user) return c.json({ error: 'not found' }, 404);
  const r = await resolveAccess(c.env.DB, user);
  return c.json({ name: nameOf(user), role: user.role, access: r.access });
});

admin.get('/audit', async (c) => {
  const ask = pageOf(c);
  const rows = await c.env.DB.prepare('SELECT a.*, u.display_name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id ORDER BY a.created_at DESC LIMIT ? OFFSET ?').bind(ask.limit, ask.offset).all<{ id: string; actor_user_id: string | null; actor_name: string | null; action: string; resource_type: string; resource_id: string | null; before_summary: string; after_summary: string; created_at: string }>();
  const pg = paged(rows.results, ask);
  const logs: AuditLog[] = pg.items.map((r) => ({ id: r.id, actorId: r.actor_user_id, actorName: r.actor_name ? nameOf({ display_name: r.actor_name }) : r.actor_user_id ? 'Someone' : 'Admin key', action: r.action, resourceType: r.resource_type, resourceId: r.resource_id, before: r.before_summary, after: r.after_summary, createdAt: r.created_at }));
  return c.json({ page: pg.page, logs });
});

// ---- orders: search, the timeline, a refund
interface AdminOrderRow extends OrderRow { owner_name: string; owner_handle: string | null; buyer_email: string | null; platform_fee_points: number; provider_payment_id: string | null }
const ADMIN_ORDER_SELECT = `${ORDER_SELECT.replace('FROM orders o', ', ow.display_name AS owner_name, ow.handle AS owner_handle, b.email AS buyer_email FROM orders o JOIN users ow ON ow.id = o.owner_id')}`;
const toAdminOrder = (r: AdminOrderRow): AdminOrder => ({ ...toOrder(r), ownerName: nameOf({ display_name: r.owner_name }), ownerHandle: r.owner_handle, buyerEmail: r.buyer_email });

admin.get('/orders', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const status = c.req.query('status') ?? '';
  const where: string[] = [];
  const binds: unknown[] = [];
  if (q) {
    where.push('(o.id LIKE ? OR o.provider_order_id LIKE ? OR o.provider_payment_id LIKE ? OR b.email LIKE ? OR b.display_name LIKE ? OR ow.handle LIKE ? OR p.title LIKE ?)');
    binds.push(`${q}%`, `${q}%`, `${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (status) {
    where.push('o.status = ?');
    binds.push(status);
  }
  const ask = pageOf(c);
  const rows = await c.env.DB.prepare(`${ADMIN_ORDER_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`).bind(...binds, ask.limit, ask.offset).all<AdminOrderRow>();
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, orders: pg.items.map(toAdminOrder) });
});

admin.get('/orders/:id', async (c) => {
  const db = c.env.DB;
  const row = await db.prepare(`${ADMIN_ORDER_SELECT} WHERE o.id = ?`).bind(c.req.param('id')).first<AdminOrderRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const [events, hooks] = await Promise.all([
    db.prepare("SELECT * FROM timeline_events WHERE entity = 'order' AND entity_id = ? ORDER BY created_at").bind(row.id).all<{ id: string; type: string; data_json: string; created_at: string }>(),
    row.provider_order_id ? db.prepare('SELECT id, provider, type, processed_at, error, received_at FROM webhook_events WHERE payload LIKE ? ORDER BY received_at').bind(`%${row.provider_order_id}%`).all<{ id: string; provider: string; type: string; processed_at: string | null; error: string | null; received_at: string }>() : Promise.resolve({ results: [] }),
  ]);
  const timeline: OrderEvent[] = events.results.map((e) => ({ id: e.id, type: e.type, data: e.data_json, createdAt: e.created_at }));
  const webhooks: WebhookEvent[] = hooks.results.map((h) => ({ id: h.id, provider: h.provider, type: h.type, processedAt: h.processed_at, error: h.error, receivedAt: h.received_at }));
  return c.json({ order: toAdminOrder(row), timeline, webhooks });
});

admin.post('/orders/:id/refund', async (c) => {
  const db = c.env.DB;
  const row = await db.prepare(`${ADMIN_ORDER_SELECT} WHERE o.id = ?`).bind(c.req.param('id')).first<AdminOrderRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ reason?: string }>().catch(() => ({}) as { reason?: string });
  const problem = await refundOrder(db, c.env, row, actorOf(c) ?? 'admin-key', str(body.reason, 300) || 'refunded by admin');
  if (problem) return c.json({ error: problem }, 400);
  await audit(db, actorOf(c), 'order.refund', 'order', row.id, row.status, 'refunded');
  const fresh = await db.prepare(`${ADMIN_ORDER_SELECT} WHERE o.id = ?`).bind(row.id).first<AdminOrderRow>();
  return c.json({ order: fresh ? toAdminOrder(fresh) : null });
});

// ---- webhooks: what came in, and a replay
admin.get('/webhooks', async (c) => {
  const ask = pageOf(c);
  const rows = await c.env.DB.prepare('SELECT id, provider, type, processed_at, error, received_at FROM webhook_events ORDER BY received_at DESC LIMIT ? OFFSET ?').bind(ask.limit, ask.offset).all<{ id: string; provider: string; type: string; processed_at: string | null; error: string | null; received_at: string }>();
  const pg = paged(rows.results, ask);
  const webhooks: WebhookEvent[] = pg.items.map((h) => ({ id: h.id, provider: h.provider, type: h.type, processedAt: h.processed_at, error: h.error, receivedAt: h.received_at }));
  return c.json({ page: pg.page, webhooks });
});

admin.post('/webhooks/:id/replay', async (c) => {
  const db = c.env.DB;
  const row = await db.prepare('SELECT * FROM webhook_events WHERE id = ?').bind(c.req.param('id')).first<{ id: string; provider: string; payload: string }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  let outcome = '';
  try {
    const json = JSON.parse(row.payload) as unknown;
    if (row.provider === 'razorpay') outcome = await handlePaymentEvent(db, c.env, providerFor(c.env).parseWebhook(json));
    else {
      const payload = json as { entry?: { changes?: { field?: string; value?: { id?: string; text?: string; media?: { id?: string }; from?: { id?: string; username?: string } } }[] }[] };
      let matched = 0;
      for (const entry of payload.entry ?? []) for (const ch of entry.changes ?? []) if (ch.field === 'comments' && ch.value?.id && ch.value.text) matched += (await handleComment(db, c.env, null, { id: ch.value.id, text: ch.value.text, mediaExternalId: ch.value.media?.id ?? null, fromId: ch.value.from?.id ?? 'unknown', fromHandle: ch.value.from?.username ?? '' })).matched;
      outcome = `${matched} matched`;
    }
  } catch (e) {
    outcome = e instanceof Error ? e.message : 'failed';
  }
  await db.prepare('UPDATE webhook_events SET processed_at = ?, error = ? WHERE id = ?').bind(nowIso(), null, row.id).run();
  await audit(db, actorOf(c), 'webhook.replay', 'webhook', row.id, '', outcome);
  return c.json({ outcome });
});

// ---- KYC queue
admin.get('/kyc', async (c) => {
  const status = c.req.query('status') ?? 'pending';
  const ask = pageOf(c);
  const rows = await c.env.DB.prepare('SELECT k.*, u.display_name, u.email FROM kyc_profiles k JOIN users u ON u.id = k.user_id WHERE k.status = ? ORDER BY k.submitted_at LIMIT ? OFFSET ?').bind(status, ask.limit, ask.offset).all<KycRow & { display_name: string; email: string | null }>();
  const pg = paged(rows.results, ask);
  const kyc: AdminKyc[] = pg.items.map((r) => ({ ...toKyc(r), userId: r.user_id, userName: nameOf(r), email: r.email }));
  return c.json({ page: pg.page, kyc });
});

admin.post('/kyc/:userId', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<{ status?: string; note?: string }>().catch(() => ({}) as { status?: string; note?: string });
  const status = oneOf(body.status, ['approved', 'rejected'] as const, 'rejected');
  const res = await db.prepare("UPDATE kyc_profiles SET status = ?, note = ?, decided_at = ?, decided_by = ? WHERE user_id = ? AND status = 'pending'").bind(status, str(body.note, 300), nowIso(), actorOf(c), c.req.param('userId')).run();
  if (res.meta.changes === 0) return c.json({ error: 'nothing pending for that person' }, 404);
  await logEvent(db, 'kyc', c.req.param('userId'), `kyc.${status}`);
  if (status === 'approved') await track(db, c.req.param('userId'), 'kyc_approved');
  await audit(db, actorOf(c), 'kyc.decide', 'user', c.req.param('userId'), 'pending', status);
  await notify(db, c.req.param('userId'), 'kyc', status === 'approved' ? 'Payout details approved' : 'Payout details need another look', str(body.note, 160), '/shop/customers');
  const u = await db.prepare('SELECT email FROM users WHERE id = ?').bind(c.req.param('userId')).first<{ email: string | null }>();
  await sendEmail(db, c.env, { userId: c.req.param('userId'), to: u?.email, subject: status === 'approved' ? 'Your payout details are approved' : 'Your payout details need another look', body: str(body.note, 500) || (status === 'approved' ? 'Payouts can now be sent to the account you gave.' : 'Please check the details and send them again.') });
  return c.json({ ok: true });
});

// ---- email outbox
admin.get('/outbox', async (c) => {
  const ask = pageOf(c);
  const rows = await c.env.DB.prepare('SELECT id, to_email, subject, status, error, created_at FROM email_outbox ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(ask.limit, ask.offset).all<{ id: string; to_email: string; subject: string; status: OutboxEmail['status']; error: string; created_at: string }>();
  const pg = paged(rows.results, ask);
  const outbox: OutboxEmail[] = pg.items.map((r) => ({ id: r.id, to: r.to_email, subject: r.subject, status: r.status, error: r.error, createdAt: r.created_at }));
  return c.json({ page: pg.page, outbox });
});

// ---- funnels, from our own tables
admin.get('/funnels', async (c) => {
  const db = c.env.DB;
  const one = async (sql: string) => (await db.prepare(sql).first<{ n: number }>())?.n ?? 0;
  const funnels: AdminFunnel[] = [
    {
      name: 'Signup to first sale',
      steps: [
        { label: 'Finished the vibe check', count: await one('SELECT COUNT(*) AS n FROM users WHERE onboarded_at IS NOT NULL') },
        { label: 'Added an email', count: await one('SELECT COUNT(*) AS n FROM users WHERE email IS NOT NULL') },
        { label: 'Published a page', count: await one('SELECT COUNT(*) AS n FROM users WHERE handle IS NOT NULL') },
        { label: 'Has a live product', count: await one("SELECT COUNT(DISTINCT owner_id) AS n FROM products WHERE status = 'live'") },
        { label: 'Made a sale', count: await one("SELECT COUNT(DISTINCT owner_id) AS n FROM orders WHERE status IN ('paid','test')") },
      ],
    },
    {
      name: 'Checkout to paid',
      steps: [
        { label: 'Checkout started', count: await one("SELECT COUNT(*) AS n FROM analytics_events WHERE name = 'checkout_started'") },
        { label: 'Paid', count: await one("SELECT COUNT(*) AS n FROM analytics_events WHERE name = 'payment_succeeded'") },
        { label: 'Failed', count: await one("SELECT COUNT(*) AS n FROM analytics_events WHERE name = 'payment_failed'") },
        { label: 'Refunded', count: await one("SELECT COUNT(*) AS n FROM analytics_events WHERE name = 'refund_issued'") },
      ],
    },
    {
      name: 'Attribution',
      steps: [
        { label: 'Creators with a post', count: await one('SELECT COUNT(DISTINCT owner_id) AS n FROM content_items') },
        { label: 'Links created', count: await one('SELECT COUNT(*) AS n FROM tracked_links') },
        { label: 'Clicks', count: await one('SELECT COUNT(*) AS n FROM link_clicks') },
        { label: 'Attributed sales', count: await one("SELECT COUNT(*) AS n FROM orders WHERE source_link_id IS NOT NULL AND status IN ('paid','test')") },
      ],
    },
    {
      name: 'Circles',
      steps: [
        { label: 'Signed up', count: await one('SELECT COUNT(*) AS n FROM circle_signups') },
        { label: 'Seated', count: await one('SELECT COUNT(*) AS n FROM circle_members') },
        { label: 'Said something', count: await one('SELECT COUNT(DISTINCT user_id) AS n FROM circle_messages') },
        { label: 'Revealed', count: await one('SELECT COUNT(*) AS n FROM circle_members WHERE revealed = 1') },
      ],
    },
    {
      name: 'Payout readiness',
      steps: [
        { label: 'KYC submitted', count: await one("SELECT COUNT(*) AS n FROM kyc_profiles WHERE status != 'none'") },
        { label: 'KYC approved', count: await one("SELECT COUNT(*) AS n FROM kyc_profiles WHERE status = 'approved'") },
      ],
    },
  ];
  return c.json({ funnels });
});

// ---- listings: what the public site shows, created and published from here
admin.get('/listings', async (c) => {
  const type = c.req.query('type');
  const ask = pageOf(c);
  const all = await listingsFor(c.env.DB, { q: c.req.query('q') ?? '', type: (LISTING_TYPES as readonly string[]).includes(type ?? '') ? (type as ListingType) : undefined, includeHidden: true, limit: ask.offset + ask.limit });
  const pg = paged(all.slice(ask.offset), ask);
  return c.json({ page: pg.page, listings: pg.items });
});

admin.post('/listings', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const type = oneOf(body.type, LISTING_TYPES, 'reward');
  const title = str(body.title, 140);
  if (!title) return c.json({ error: 'title required' }, 400);
  const author = await authorFor(c);
  const id = newId();
  const now = nowIso();
  const publish = body.publish !== false;
  const endsAt = str(body.endsAt, 40) || new Date(Date.now() + 30 * 86_400_000).toISOString();
  if (type === 'reward') {
    await db
      .prepare("INSERT INTO bounties (id, created_by, organization_id, title, brief, budget_points, reward_rule, eligibility, platform, starts_at, ends_at, status, version, created_at, brand_name, deliverable, rate_per_thousand, max_payout_points, min_views, featured) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, author, title, str(body.brief, 5000), num(body.budgetPoints, 0, 0) ?? 0, str(body.rewardRule, 1000), str(body.eligibility, 1000), str(body.platform, 60), str(body.startsAt, 40) || now, endsAt, publish ? 'open' : 'closed', now, str(body.brandName, 80), str(body.deliverable, 80, 'Short video') || 'Short video', num(body.ratePerThousand, 0, 0) ?? 0, num(body.maxPayoutPoints, 0, 0) ?? 0, num(body.minViews, 1000, 0) ?? 1000, body.featured === true ? 1 : 0)
      .run();
  } else if (type === 'opportunity') {
    await db
      .prepare('INSERT INTO opportunities (id, organization_id, created_by, title, description, opportunity_type, skills_required, location_mode, location_text, compensation_min, compensation_max, currency, deliverables, deadline, status, eligibility, created_at, published_at, featured) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, author, title, str(body.description, 5000), oneOf(body.opportunityType, OPPORTUNITY_TYPES, 'gig'), JSON.stringify(Array.isArray(body.skillsRequired) ? body.skillsRequired.filter((x): x is string => typeof x === 'string').slice(0, 10) : []), oneOf(body.locationMode, ['remote', 'on_site', 'hybrid'] as const, 'remote'), str(body.locationText, 120), num(body.compensationMin, null, 0), num(body.compensationMax, null, 0), str(body.currency, 3, 'INR').toUpperCase(), str(body.deliverables, 2000), str(body.deadline, 10) || null, publish ? 'published' : 'draft', str(body.eligibility, 1000), now, publish ? now : null, body.featured === true ? 1 : 0)
      .run();
  } else if (type === 'event') {
    const start = new Date(str(body.startsAt, 40) || Date.now() + 7 * 86_400_000);
    if (Number.isNaN(start.getTime())) return c.json({ error: 'a valid start time' }, 400);
    await db
      .prepare('INSERT INTO events (id, title, description, event_type, host_user_id, venue, online_url, timezone, starts_at, ends_at, capacity, price_points, visibility, status, created_at, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, title, str(body.description, 3000), oneOf(body.eventType, EVENT_TYPES, 'meetup'), author, str(body.venue, 200), str(body.onlineUrl, 500) || null, str(body.timezone, 60, 'UTC') || 'UTC', start.toISOString(), new Date(start.getTime() + (num(body.minutes, 120, 15, 7 * 24 * 60) ?? 120) * 60_000).toISOString(), num(body.capacity, null, 1, 100000), num(body.pricePoints, 0, 0) ?? 0, 'public', publish ? 'published' : 'draft', now, body.featured === true ? 1 : 0)
      .run();
  } else if (type === 'program') {
    await db
      .prepare('INSERT INTO programs (id, name, description, price_points, price_cents, currency, delivery_mode, published, outcomes, prerequisites, created_by, created_at, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, title, str(body.description, 5000), num(body.pricePoints, 0, 0) ?? 0, num(body.priceCents, 0, 0) ?? 0, str(body.currency, 3, 'INR').toUpperCase(), oneOf(body.deliveryMode, ['online', 'in_person', 'hybrid'] as const, 'online'), publish ? 1 : 0, str(body.outcomes, 2000), str(body.prerequisites, 1000), author, now, body.featured === true ? 1 : 0)
      .run();
  } else if (type === 'tool') {
    const url = str(body.url, 500);
    if (!/^https?:\/\//.test(url)) return c.json({ error: 'a link to the tool' }, 400);
    await db.prepare('INSERT INTO tools (id, name, category, url, description, affiliate, verified, suggested_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, title, oneOf(body.category, TOOL_CATEGORIES, 'Editing'), url, str(body.description, 500), body.affiliate === true ? 1 : 0, publish ? 1 : 0, author, now).run();
  } else if (type === 'circle') {
    const start = new Date(str(body.startsAt, 40) || Date.now() + 7 * 86_400_000);
    if (Number.isNaN(start.getTime())) return c.json({ error: 'a valid start time' }, 400);
    const city = str(body.city, 80);
    if (!city) return c.json({ error: 'which city?' }, 400);
    await db
      .prepare('INSERT INTO circle_events (id, title, city, area, starts_at, venue_hint, group_size, status, repeat, series_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, title, city, str(body.area, 80), start.toISOString(), str(body.venueHint, 200), num(body.groupSize, 5, 3, 8) ?? 5, publish ? 'open' : 'cancelled', body.repeat === 'weekly' ? 'weekly' : 'none', id, author, now)
      .run();
  } else {
    return c.json({ error: 'campaigns are created by brands in Army, then made public from their page' }, 400);
  }
  await audit(db, actorOf(c), 'listing.create', type, id, '', title);
  const [listing] = await listingsFor(db, { id, type, includeHidden: true, limit: 1 });
  return c.json({ listing: listing ?? null }, 201);
});

// Publish, close or feature any listing.
admin.patch('/listings/:type/:id', async (c) => {
  const db = c.env.DB;
  const type = oneOf(c.req.param('type'), LISTING_TYPES, 'reward');
  const id = c.req.param('id');
  const body = await c.req.json<{ live?: boolean; featured?: boolean }>().catch(() => ({}) as { live?: boolean; featured?: boolean });
  const stmts: D1PreparedStatement[] = [];
  const now = nowIso();
  if (typeof body.live === 'boolean') {
    const live = body.live;
    if (type === 'reward') stmts.push(db.prepare('UPDATE bounties SET status = ? WHERE id = ?').bind(live ? 'open' : 'closed', id));
    if (type === 'opportunity') stmts.push(db.prepare("UPDATE opportunities SET status = ?, published_at = CASE WHEN ? THEN COALESCE(published_at, ?) ELSE published_at END WHERE id = ?").bind(live ? 'published' : 'closed', live ? 1 : 0, now, id));
    if (type === 'event') stmts.push(db.prepare('UPDATE events SET status = ? WHERE id = ?').bind(live ? 'published' : 'cancelled', id));
    if (type === 'program') stmts.push(db.prepare('UPDATE programs SET published = ? WHERE id = ?').bind(live ? 1 : 0, id));
    if (type === 'tool') stmts.push(db.prepare('UPDATE tools SET verified = ? WHERE id = ?').bind(live ? 1 : 0, id));
    if (type === 'campaign') stmts.push(db.prepare('UPDATE campaigns SET public = ? WHERE id = ?').bind(live ? 1 : 0, id));
    if (type === 'circle') stmts.push(db.prepare('UPDATE circle_events SET status = ? WHERE id = ?').bind(live ? 'open' : 'cancelled', id));
  }
  if (typeof body.featured === 'boolean' && type !== 'tool' && type !== 'campaign' && type !== 'circle') {
    const table = { reward: 'bounties', opportunity: 'opportunities', event: 'events', program: 'programs' }[type];
    stmts.push(db.prepare(`UPDATE ${table} SET featured = ? WHERE id = ?`).bind(body.featured ? 1 : 0, id));
  }
  if (stmts.length) await db.batch(stmts);
  await audit(db, actorOf(c), 'listing.update', type, id, '', body);
  const [listing] = await listingsFor(db, { id, type, includeHidden: true, limit: 1 });
  if (!listing) return c.json({ error: 'not found' }, 404);
  return c.json({ listing });
});

const USER_SELECT = `SELECT u.*, (SELECT GROUP_CONCAT(honor_key) FROM honors h WHERE h.user_id = u.id) AS honor_keys,
  (SELECT cp.asked_at FROM coach_profiles cp WHERE cp.user_id = u.id) AS coach_asked_at,
  ca.plan AS ca_plan, ca.plan_until AS ca_plan_until, ca.plan_credits AS ca_plan_credits, ca.extra_credits AS ca_extra_credits
  FROM users u LEFT JOIN credit_accounts ca ON ca.user_id = u.id`;

admin.get('/users', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const ask = pageOf(c);
  const rows = q
    ? await c.env.DB.prepare(`${USER_SELECT} WHERE u.display_name LIKE ? OR u.id LIKE ? OR u.email LIKE ? OR u.handle LIKE ? ORDER BY u.xp DESC LIMIT ? OFFSET ?`)
        .bind(`%${q}%`, `${q}%`, `%${q}%`, `%${q}%`, ask.limit, ask.offset)
        .all<UserListRow>()
    : await c.env.DB.prepare(`${USER_SELECT} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`).bind(ask.limit, ask.offset).all<UserListRow>();
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, users: pg.items.map(toAdminUser) });
});

async function loadUser(db: D1Database, id: string): Promise<UserListRow | null> {
  return db.prepare(`${USER_SELECT} WHERE u.id = ?`).bind(id).first<UserListRow>();
}

// Pro is a plan now: on starts Pro for a period (unless a plan is already running), off ends whatever plan there is.
admin.post('/users/:id/pro', async (c) => {
  const db = c.env.DB;
  const user = await getUser(db, c.req.param('id'));
  if (!user) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ pro?: boolean }>().catch(() => ({}) as { pro?: boolean });
  const pro = body.pro === true;
  const before = await accountOf(db, user.id);
  if (!pro) await setPlan(db, user.id, 'none', 0, actorOf(c));
  else if (!isPaidPlan(before.plan)) await setPlan(db, user.id, 'pro', PLAN_DAYS, actorOf(c));
  await audit(db, actorOf(c), 'user.pro', 'user', user.id, before.plan, pro);
  const fresh = await loadUser(db, user.id);
  return c.json({ user: fresh ? toAdminUser(fresh) : null });
});

// Start a plan (Pro, Pro Max, Ultra) for a number of days, or end it with none. Its credits are granted fresh and
// whatever was left of the last plan's credits expires. Admins only, until payments do this.
admin.post('/users/:id/plan', async (c) => {
  const db = c.env.DB;
  const user = await getUser(db, c.req.param('id'));
  if (!user) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ plan?: unknown; days?: unknown }>().catch(() => ({}) as { plan?: unknown; days?: unknown });
  if (body.plan !== 'none' && !isPaidPlan(body.plan)) return c.json({ error: 'plan must be none, pro, pro_max or ultra' }, 400);
  const days = Math.round(Number(body.days ?? PLAN_DAYS));
  if (!Number.isFinite(days) || days < 1 || days > 366) return c.json({ error: 'days must be from 1 to 366' }, 400);
  const before = await accountOf(db, user.id);
  await setPlan(db, user.id, body.plan, days, actorOf(c));
  await audit(db, actorOf(c), 'user.plan', 'user', user.id, { plan: before.plan, until: before.plan_until }, { plan: body.plan, days });
  const fresh = await loadUser(db, user.id);
  return c.json({ user: fresh ? toAdminUser(fresh) : null });
});

// Add extra credits, which stay until used. Positive whole numbers only; the note says why.
admin.post('/users/:id/credits', async (c) => {
  const db = c.env.DB;
  const user = await getUser(db, c.req.param('id'));
  if (!user) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ credits?: unknown; note?: unknown }>().catch(() => ({}) as { credits?: unknown; note?: unknown });
  const credits = Number(body.credits);
  if (!Number.isInteger(credits) || credits < 1 || credits > MAX_CREDIT_GRANT) return c.json({ error: `credits must be a whole number from 1 to ${MAX_CREDIT_GRANT}` }, 400);
  const note = str(body.note, 200) || 'Added by the team';
  const before = await accountOf(db, user.id);
  await addCredits(db, user.id, credits, 'admin', note, actorOf(c));
  await audit(db, actorOf(c), 'user.credits', 'user', user.id, before.extra_credits, { credits, note });
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
  await audit(db, actorOf(c), 'user.honor', 'user', user.id, '', { honor: honor.key, note });
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
  await audit(db, actorOf(c), 'user.points', 'user', user.id, user.points, { amount, note });
  const fresh = await loadUser(db, user.id);
  return c.json({ user: fresh ? toAdminUser(fresh) : null });
});

// ---- attendee codes: every event with guests, across Party, Run and Circles, recent and upcoming
interface AttendeeRow { app: AttendeeCodeApp; thing_id: string; title: string; host_name: string; starts_at: string; status: string; xp: number | null; code: string | null; claims: number; guests: number }
const ATTENDEE_EVENTS = `WITH every_event AS (
  SELECT 'party' AS app, e.id AS thing_id, e.title, COALESCE(u.display_name, '') AS host_name, e.starts_at, e.status, a.xp AS xp, a.code AS code,
    (SELECT COUNT(*) FROM attendee_claims x WHERE x.app = 'party' AND x.thing_id = e.id) AS claims,
    (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id = e.id AND r.status IN ('registered','attended')) AS guests
  FROM events e LEFT JOIN users u ON u.id = e.host_user_id LEFT JOIN attendee_codes a ON a.app = 'party' AND a.thing_id = e.id
  WHERE e.ends_at >= ?1
  UNION ALL
  SELECT 'run', r.id, r.title, COALESCE(u.display_name, ''), r.starts_at, r.status, r.xp, r.code,
    (SELECT COUNT(*) FROM run_entries x WHERE x.run_id = r.id AND x.status = 'logged'),
    (SELECT COUNT(*) FROM run_members m WHERE m.club_id = r.club_id AND m.status = 'member')
  FROM runs r JOIN run_clubs k ON k.id = r.club_id LEFT JOIN users u ON u.id = k.host_user_id
  WHERE r.ends_at >= ?1
  UNION ALL
  SELECT 'circles', e.id, e.title, COALESCE(u.display_name, ''), e.starts_at, e.status, a.xp, a.code,
    (SELECT COUNT(*) FROM attendee_claims x WHERE x.app = 'circles' AND x.thing_id = e.id),
    (SELECT COUNT(*) FROM circle_members m JOIN circle_groups g ON g.id = m.group_id WHERE g.event_id = e.id)
  FROM circle_events e LEFT JOIN users u ON u.id = e.created_by LEFT JOIN attendee_codes a ON a.app = 'circles' AND a.thing_id = e.id
  WHERE e.starts_at >= ?1
)`;
const toAttendee = (r: AttendeeRow): AdminAttendeeCode => ({ app: r.app, thingId: r.thing_id, title: r.title, hostName: r.host_name || 'Team', startsAt: r.starts_at, status: r.status, xp: r.xp, code: r.code, locked: attendeeXpLocked(r.starts_at), claims: r.claims, guests: r.guests });

// Upcoming and the last week's events, soonest first, with their xp and code. Filter by app and by title.
admin.get('/attendee-codes', async (c) => {
  const ask = pageOf(c);
  const want = c.req.query('app');
  const app = want === 'party' || want === 'run' || want === 'circles' ? want : '';
  const q = (c.req.query('q') ?? '').trim();
  const rows = await c.env.DB.prepare(`${ATTENDEE_EVENTS} SELECT * FROM every_event WHERE (?2 = '' OR app = ?2) AND (?3 = '' OR title LIKE ?4) ORDER BY starts_at ASC, thing_id ASC LIMIT ?5 OFFSET ?6`)
    .bind(new Date(Date.now() - 7 * 86_400_000).toISOString(), app, q, `%${q.replace(/[%_]/g, '')}%`, ask.limit, ask.offset)
    .all<AttendeeRow>();
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, codes: pg.items.map(toAttendee) });
});

// Set any event's xp (before it starts) and code (any time): the same rules a host has, from the admin panel.
admin.put('/attendee-codes/:app/:id', async (c) => {
  const db = c.env.DB;
  const app = c.req.param('app');
  const id = c.req.param('id');
  const body = await c.req.json<{ xp?: unknown; code?: unknown; fresh?: unknown }>().catch(() => ({}) as Record<string, never>);
  let before: unknown = '';
  let after: unknown = '';
  if (app === 'run') {
    const run = await db.prepare('SELECT id, starts_at, xp, code, status FROM runs WHERE id = ?').bind(id).first<{ id: string; starts_at: string; xp: number; code: string; status: string }>();
    if (!run) return c.json({ error: 'not found' }, 404);
    if (run.status === 'cancelled') return c.json({ error: 'This run was cancelled.' }, 400);
    const set = await setRunCode(db, run, body);
    if ('error' in set) return c.json({ error: set.error }, set.status);
    before = { xp: run.xp };
    after = { xp: set.xp, newCode: set.code !== run.code };
  } else if (app === 'party' || app === 'circles') {
    const row = await db.prepare(app === 'party' ? 'SELECT id, starts_at, status FROM events WHERE id = ?' : 'SELECT id, starts_at, status FROM circle_events WHERE id = ?').bind(id).first<{ id: string; starts_at: string; status: string }>();
    if (!row) return c.json({ error: 'not found' }, 404);
    if (row.status === 'cancelled') return c.json({ error: 'This event was cancelled.' }, 400);
    const prev = await db.prepare('SELECT xp, code FROM attendee_codes WHERE app = ? AND thing_id = ?').bind(app, id).first<{ xp: number; code: string }>();
    const set = await setEventCode(db, app, id, row.starts_at, actorOf(c), body);
    if ('error' in set) return c.json({ error: set.error }, set.status);
    before = prev ? { xp: prev.xp } : '';
    after = { xp: set.row.xp, newCode: set.row.code !== prev?.code };
  } else return c.json({ error: 'app must be party, run or circles' }, 400);
  // The same resource names the hosts' own changes use, so one event's history reads as one.
  await audit(db, actorOf(c), 'attendee_code.set', app === 'party' ? 'event' : app === 'circles' ? 'circle' : 'run', id, before, after);
  // The host hears about it: a code they show, or xp they promised, changed under them.
  const hostId =
    app === 'party'
      ? (await db.prepare('SELECT host_user_id AS id FROM events WHERE id = ?').bind(id).first<{ id: string }>())?.id
      : app === 'run'
        ? (await db.prepare('SELECT k.host_user_id AS id FROM runs r JOIN run_clubs k ON k.id = r.club_id WHERE r.id = ?').bind(id).first<{ id: string }>())?.id
        : null;
  if (hostId && hostId !== actorOf(c)) await notify(db, hostId, app === 'run' ? 'run' : 'party', 'The team changed your attendee code', 'Open the event to see the code and the xp before you show it.', app === 'run' ? '/run' : `/party/${id}`);
  // The same row the list shows, whatever its date (the first value is the list's date floor).
  const fresh = await db.prepare(`${ATTENDEE_EVENTS} SELECT * FROM every_event WHERE app = ?2 AND thing_id = ?3`).bind('0000', app, id).first<AttendeeRow>();
  return c.json({ code: fresh ? toAttendee(fresh) : null });
});

interface AdminRedemptionRow extends RedemptionRow {
  user_name: string;
}

admin.get('/redemptions', async (c) => {
  const status = c.req.query('status');
  const where = status ? 'WHERE r.status = ?' : '';
  const ask = pageOf(c);
  const stmt = c.env.DB.prepare(
    `SELECT r.*, u.display_name AS user_name FROM redemptions r JOIN users u ON u.id = r.user_id ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
  );
  const rows = await (status ? stmt.bind(status, ask.limit, ask.offset) : stmt.bind(ask.limit, ask.offset)).all<AdminRedemptionRow>();
  const pg = paged(rows.results, ask);
  const list: AdminRedemption[] = pg.items.map((r) => ({ ...toRedemption(r), userId: r.user_id, userName: r.user_name || 'Anonymous climber' }));
  return c.json({ page: pg.page, redemptions: list });
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
  await audit(db, actorOf(c), 'redemption.status', 'redemption', row.id, row.status, body.status);
  const fresh = await db.prepare('SELECT * FROM redemptions WHERE id = ?').bind(row.id).first<RedemptionRow>();
  return c.json({ redemption: fresh ? toRedemption(fresh) : null });
});
