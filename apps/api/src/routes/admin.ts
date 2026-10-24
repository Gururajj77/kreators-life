import { Hono } from 'hono';
import { EVENT_TYPES, HONOR_BY_KEY, isRole, LISTING_TYPES, MODULE_BY_KEY, MODULES, OPPORTUNITY_TYPES, PERMISSIONS, TOOL_CATEGORIES, type AdminRedemption, type AdminUser, type AuditLog, type FlagOverride, type Listing, type ListingType, type ModuleSetting, type Permission } from '@kreators/shared';
import { resolveAccess } from '../access';
import { listingsFor } from './explore';
import { ORDER_SELECT, toOrder, type OrderRow } from './studio';
import { refundOrder } from './growth';
import { handlePaymentEvent } from './go';
import { handleComment } from './growth';
import { providerFor } from '../payments';
import { toKyc, type KycRow } from './kyc';
import { logEvent, sendEmail, track } from '../ops';
import { notify } from '../db';
import type { AdminFunnel, AdminKyc, AdminOrder, OrderEvent, OutboxEmail, WebhookEvent } from '@kreators/shared';
import type { Context } from 'hono';
import type { AppEnv, UserRow } from '../env';
import { audit, getUser, nameOf, newId, nowIso, num, oneOf, parseList, sessionUser, str } from '../db';
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
}

function toAdminUser(r: UserListRow): AdminUser {
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
  const fresh = await loadUser(db, prev.id);
  return c.json({ user: fresh ? toAdminUser(fresh) : null });
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
  const rows = await c.env.DB.prepare('SELECT a.*, u.display_name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id ORDER BY a.created_at DESC LIMIT 200').all<{ id: string; actor_user_id: string | null; actor_name: string | null; action: string; resource_type: string; resource_id: string | null; before_summary: string; after_summary: string; created_at: string }>();
  const logs: AuditLog[] = rows.results.map((r) => ({ id: r.id, actorId: r.actor_user_id, actorName: r.actor_name ? nameOf({ display_name: r.actor_name }) : r.actor_user_id ? 'Someone' : 'Admin key', action: r.action, resourceType: r.resource_type, resourceId: r.resource_id, before: r.before_summary, after: r.after_summary, createdAt: r.created_at }));
  return c.json({ logs });
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
  const rows = await c.env.DB.prepare(`${ADMIN_ORDER_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY o.created_at DESC LIMIT 100`).bind(...binds).all<AdminOrderRow>();
  return c.json({ orders: rows.results.map(toAdminOrder) });
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
  const rows = await c.env.DB.prepare('SELECT id, provider, type, processed_at, error, received_at FROM webhook_events ORDER BY received_at DESC LIMIT 100').all<{ id: string; provider: string; type: string; processed_at: string | null; error: string | null; received_at: string }>();
  const webhooks: WebhookEvent[] = rows.results.map((h) => ({ id: h.id, provider: h.provider, type: h.type, processedAt: h.processed_at, error: h.error, receivedAt: h.received_at }));
  return c.json({ webhooks });
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
  const rows = await c.env.DB.prepare('SELECT k.*, u.display_name, u.email FROM kyc_profiles k JOIN users u ON u.id = k.user_id WHERE k.status = ? ORDER BY k.submitted_at LIMIT 200').bind(status).all<KycRow & { display_name: string; email: string | null }>();
  const kyc: AdminKyc[] = rows.results.map((r) => ({ ...toKyc(r), userId: r.user_id, userName: nameOf(r), email: r.email }));
  return c.json({ kyc });
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
  const rows = await c.env.DB.prepare('SELECT id, to_email, subject, status, error, created_at FROM email_outbox ORDER BY created_at DESC LIMIT 200').all<{ id: string; to_email: string; subject: string; status: OutboxEmail['status']; error: string; created_at: string }>();
  const outbox: OutboxEmail[] = rows.results.map((r) => ({ id: r.id, to: r.to_email, subject: r.subject, status: r.status, error: r.error, createdAt: r.created_at }));
  return c.json({ outbox });
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
  const listings = await listingsFor(c.env.DB, { q: c.req.query('q') ?? '', type: (LISTING_TYPES as readonly string[]).includes(type ?? '') ? (type as ListingType) : undefined, includeHidden: true, limit: 200 });
  return c.json({ listings });
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
      .prepare('INSERT INTO circle_events (id, title, city, area, starts_at, venue_hint, group_size, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, title, city, str(body.area, 80), start.toISOString(), str(body.venueHint, 200), num(body.groupSize, 5, 3, 8) ?? 5, publish ? 'open' : 'cancelled', author, now)
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

const USER_SELECT = `SELECT u.*, (SELECT GROUP_CONCAT(honor_key) FROM honors h WHERE h.user_id = u.id) AS honor_keys FROM users u`;

admin.get('/users', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const rows = q
    ? await c.env.DB.prepare(`${USER_SELECT} WHERE u.display_name LIKE ? OR u.id LIKE ? OR u.email LIKE ? OR u.handle LIKE ? ORDER BY u.xp DESC LIMIT 50`)
        .bind(`%${q}%`, `${q}%`, `%${q}%`, `%${q}%`)
        .all<UserListRow>()
    : await c.env.DB.prepare(`${USER_SELECT} ORDER BY u.created_at DESC LIMIT 50`).all<UserListRow>();
  return c.json({ users: rows.results.map(toAdminUser) });
});

async function loadUser(db: D1Database, id: string): Promise<UserListRow | null> {
  return db.prepare(`${USER_SELECT} WHERE u.id = ?`).bind(id).first<UserListRow>();
}

admin.post('/users/:id/pro', async (c) => {
  const db = c.env.DB;
  const user = await getUser(db, c.req.param('id'));
  if (!user) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ pro?: boolean }>().catch(() => ({}) as { pro?: boolean });
  const pro = body.pro === true;
  const now = nowIso();
  await db.batch([
    db.prepare('UPDATE users SET is_pro = ? WHERE id = ?').bind(pro ? 1 : 0, user.id),
    pro
      ? db.prepare("INSERT OR IGNORE INTO honors (user_id, honor_key, note, awarded_at) VALUES (?, 'pro', 'Pro membership', ?)").bind(user.id, now)
      : db.prepare("DELETE FROM honors WHERE user_id = ? AND honor_key = 'pro'").bind(user.id),
  ]);
  await audit(db, actorOf(c), 'user.pro', 'user', user.id, user.is_pro === 1, pro);
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

interface AdminRedemptionRow extends RedemptionRow {
  user_name: string;
}

admin.get('/redemptions', async (c) => {
  const status = c.req.query('status');
  const where = status ? 'WHERE r.status = ?' : '';
  const stmt = c.env.DB.prepare(
    `SELECT r.*, u.display_name AS user_name FROM redemptions r JOIN users u ON u.id = r.user_id ${where} ORDER BY r.created_at DESC LIMIT 100`,
  );
  const rows = await (status ? stmt.bind(status) : stmt).all<AdminRedemptionRow>();
  const list: AdminRedemption[] = rows.results.map((r) => ({ ...toRedemption(r), userId: r.user_id, userName: r.user_name || 'Anonymous climber' }));
  return c.json({ redemptions: list });
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
