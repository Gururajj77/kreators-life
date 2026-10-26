import { Hono } from 'hono';
import { CAMPAIGN_STATUSES, type Campaign, type CampaignAssignment, type CampaignEvent, type Deliverable, type DeliverableVersion } from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { audit, can, nameOf, newId, notify, nowIso, num, oneOf, orgIdsOf, orgRole, str, pageOf, paged } from '../db';

export const army = new Hono<AppEnv>();

interface CampaignRow {
  id: string; organization_id: string; organization_name: string; owner_user_id: string | null; owner_name: string | null; name: string; brief: string; budget_amount: number; currency: string;
  start_date: string | null; due_date: string | null; status: Campaign['status']; usage_rights: string; exclusivity_terms: string; brand_restrictions: string; created_at: string; updated_at: string; deliverable_count: number; assignment_count: number;
}
const SELECT = `SELECT c.*, o.name AS organization_name, u.display_name AS owner_name,
  (SELECT COUNT(*) FROM campaign_deliverables d WHERE d.campaign_id = c.id) AS deliverable_count,
  (SELECT COUNT(*) FROM campaign_assignments a WHERE a.campaign_id = c.id) AS assignment_count
  FROM campaigns c JOIN organizations o ON o.id = c.organization_id LEFT JOIN users u ON u.id = c.owner_user_id`;
const toCampaign = (r: CampaignRow): Campaign => ({
  id: r.id, organizationId: r.organization_id, organizationName: r.organization_name, ownerId: r.owner_user_id, ownerName: r.owner_name ? nameOf({ display_name: r.owner_name }) : 'Unassigned', name: r.name, brief: r.brief, budgetAmount: r.budget_amount, currency: r.currency,
  startDate: r.start_date, dueDate: r.due_date, status: r.status, usageRights: r.usage_rights, exclusivityTerms: r.exclusivity_terms, brandRestrictions: r.brand_restrictions, createdAt: r.created_at, updatedAt: r.updated_at, deliverableCount: r.deliverable_count, assignmentCount: r.assignment_count,
});

type Who = 'staff' | 'brand' | 'creator' | null;
async function whoFor(db: D1Database, user: UserRow, campaign: { id: string; organization_id: string }): Promise<Who> {
  if (can(user, 'talent')) return 'staff';
  if (await orgRole(db, campaign.organization_id, user.id)) return 'brand';
  const a = await db.prepare("SELECT 1 FROM campaign_assignments WHERE campaign_id = ? AND creator_user_id = ? AND status IN ('offered','accepted','done')").bind(campaign.id, user.id).first();
  return a ? 'creator' : null;
}

async function logEvent(db: D1Database, campaignId: string, actorId: string | null, eventType: string, note = '') {
  await db.prepare('INSERT INTO campaign_events (id, campaign_id, actor_user_id, event_type, note, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId(), campaignId, actorId, eventType, note, nowIso()).run();
}

// Everything I can see: my brands' campaigns, campaigns I am assigned to, and all of them for talent staff.
army.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const orgIds = await orgIdsOf(db, user.id);
  const ask = pageOf(c);
  const rows = can(user, 'talent')
    ? await db.prepare(`${SELECT} ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`).bind(ask.limit, ask.offset).all<CampaignRow>()
    : await db
        .prepare(`${SELECT} WHERE c.organization_id IN (${orgIds.length ? orgIds.map(() => '?').join(',') : "''"}) OR c.id IN (SELECT campaign_id FROM campaign_assignments WHERE creator_user_id = ?) ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`)
        .bind(...orgIds, user.id, ask.limit, ask.offset)
        .all<CampaignRow>();
  const mine = await db.prepare('SELECT a.*, u.display_name AS creator_name FROM campaign_assignments a JOIN users u ON u.id = a.creator_user_id WHERE a.creator_user_id = ? ORDER BY a.created_at DESC').bind(user.id).all<AssignmentRow>();
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, campaigns: pg.items.map(toCampaign), assignments: mine.results.map(toAssignment), staff: can(user, 'talent') });
});

army.post('/campaigns', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const organizationId = str(body.organizationId, 64);
  if (!organizationId) return c.json({ error: 'which brand?' }, 400);
  if (!(await orgRole(db, organizationId, user.id)) && !can(user, 'talent')) return c.json({ error: 'not your organization' }, 403);
  const name = str(body.name, 120);
  if (!name) return c.json({ error: 'name required' }, 400);
  const id = newId();
  const now = nowIso();
  await db
    .prepare('INSERT INTO campaigns (id, organization_id, owner_user_id, name, brief, budget_amount, currency, start_date, due_date, status, usage_rights, exclusivity_terms, brand_restrictions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, organizationId, can(user, 'talent') ? user.id : null, name, str(body.brief, 5000), num(body.budgetAmount, 0, 0) ?? 0, str(body.currency, 3, 'INR').toUpperCase(), str(body.startDate, 10) || null, str(body.dueDate, 10) || null, can(user, 'talent') ? 'brief' : 'lead', str(body.usageRights, 1000), str(body.exclusivityTerms, 1000), str(body.brandRestrictions, 1000), now, now)
    .run();
  await logEvent(db, id, user.id, 'created', can(user, 'talent') ? 'Brief created by staff' : 'Lead submitted by brand');
  const row = await db.prepare(`${SELECT} WHERE c.id = ?`).bind(id).first<CampaignRow>();
  return c.json({ campaign: row ? toCampaign(row) : null }, 201);
});

interface DeliverableRow { id: string; campaign_id: string; title: string; format: string; platform: string; due_at: string | null; status: Deliverable['status']; approved_at: string | null; final_url: string | null }
interface VersionRow { id: string; deliverable_id: string; version_number: number; url: string; note: string; submitted_by: string; submitted_by_name: string; submitted_at: string; review_status: DeliverableVersion['reviewStatus'] }
interface FeedbackRow { id: string; deliverable_version_id: string; author_name: string; comment: string; created_at: string }
interface AssignmentRow { id: string; campaign_id: string; creator_user_id: string; creator_name: string; role: string; fee_amount: number; currency: string; status: CampaignAssignment['status']; terms_accepted_at: string | null }
const toAssignment = (r: AssignmentRow): CampaignAssignment => ({ id: r.id, campaignId: r.campaign_id, creatorId: r.creator_user_id, creatorName: nameOf({ display_name: r.creator_name }), role: r.role, feeAmount: r.fee_amount, currency: r.currency, status: r.status, termsAcceptedAt: r.terms_accepted_at });

army.get('/campaigns/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare(`${SELECT} WHERE c.id = ?`).bind(c.req.param('id')).first<CampaignRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const who = await whoFor(db, user, row);
  if (!who) return c.json({ error: 'you do not have access to that' }, 403);
  const [dels, vers, fbs, asg, evs] = await Promise.all([
    db.prepare('SELECT * FROM campaign_deliverables WHERE campaign_id = ? ORDER BY created_at').bind(row.id).all<DeliverableRow>(),
    db.prepare('SELECT v.*, u.display_name AS submitted_by_name FROM deliverable_versions v JOIN users u ON u.id = v.submitted_by WHERE v.deliverable_id IN (SELECT id FROM campaign_deliverables WHERE campaign_id = ?) ORDER BY v.version_number').bind(row.id).all<VersionRow>(),
    db.prepare('SELECT f.*, u.display_name AS author_name FROM feedback_items f JOIN users u ON u.id = f.author_user_id WHERE f.deliverable_version_id IN (SELECT v.id FROM deliverable_versions v JOIN campaign_deliverables d ON d.id = v.deliverable_id WHERE d.campaign_id = ?) ORDER BY f.created_at').bind(row.id).all<FeedbackRow>(),
    db.prepare('SELECT a.*, u.display_name AS creator_name FROM campaign_assignments a JOIN users u ON u.id = a.creator_user_id WHERE a.campaign_id = ?').bind(row.id).all<AssignmentRow>(),
    db.prepare('SELECT e.*, u.display_name AS actor_name FROM campaign_events e LEFT JOIN users u ON u.id = e.actor_user_id WHERE e.campaign_id = ? ORDER BY e.created_at DESC LIMIT 100').bind(row.id).all<{ id: string; actor_name: string | null; event_type: string; note: string; created_at: string }>(),
  ]);
  const deliverables: Deliverable[] = dels.results.map((d) => ({
    id: d.id, campaignId: d.campaign_id, title: d.title, format: d.format, platform: d.platform, dueAt: d.due_at, status: d.status, approvedAt: d.approved_at, finalUrl: d.final_url,
    versions: vers.results.filter((v) => v.deliverable_id === d.id).map((v) => ({ id: v.id, deliverableId: v.deliverable_id, versionNumber: v.version_number, url: v.url, note: v.note, submittedBy: v.submitted_by, submittedByName: nameOf({ display_name: v.submitted_by_name }), submittedAt: v.submitted_at, reviewStatus: v.review_status, feedback: fbs.results.filter((f) => f.deliverable_version_id === v.id).map((f) => ({ id: f.id, authorName: nameOf({ display_name: f.author_name }), comment: f.comment, createdAt: f.created_at })) })),
  }));
  // Creators see the brief and their own assignment, not the budget or other creators' fees.
  const campaign = toCampaign(row);
  const assignments = asg.results.map(toAssignment).filter((a) => who !== 'creator' || a.creatorId === user.id);
  if (who === 'creator') campaign.budgetAmount = 0;
  const events: CampaignEvent[] = evs.results.map((e) => ({ id: e.id, actorName: e.actor_name ? nameOf({ display_name: e.actor_name }) : 'System', eventType: e.event_type, note: e.note, createdAt: e.created_at }));
  return c.json({ campaign, deliverables, assignments, events, who });
});

army.patch('/campaigns/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const prev = await db.prepare(`${SELECT} WHERE c.id = ?`).bind(c.req.param('id')).first<CampaignRow>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  const who = await whoFor(db, user, prev);
  if (who !== 'staff' && who !== 'brand') return c.json({ error: 'you do not have access to that' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  // Brands can approve the shortlist or cancel; staff drive every other step.
  let status = prev.status;
  if (typeof body.status === 'string' && (CAMPAIGN_STATUSES as readonly string[]).includes(body.status)) {
    const next = body.status as Campaign['status'];
    if (who === 'brand' && !((prev.status === 'shortlist' && next === 'approved') || next === 'cancelled')) return c.json({ error: 'the brand can approve the shortlist or cancel; staff move the other steps' }, 403);
    if (next === 'production' && prev.deliverable_count === 0) return c.json({ error: 'add at least one deliverable before production' }, 400);
    if (next === 'production' && (!prev.brief || prev.budget_amount <= 0 || !prev.due_date)) return c.json({ error: 'brief, budget and due date are needed before production' }, 400);
    status = next;
  }
  await db
    .prepare('UPDATE campaigns SET name = ?, brief = ?, budget_amount = ?, currency = ?, start_date = ?, due_date = ?, status = ?, usage_rights = ?, exclusivity_terms = ?, brand_restrictions = ?, owner_user_id = ?, updated_at = ? WHERE id = ?')
    .bind(str(body.name, 120, prev.name) || prev.name, str(body.brief, 5000, prev.brief), who === 'staff' ? (num(body.budgetAmount, prev.budget_amount, 0) ?? prev.budget_amount) : prev.budget_amount, str(body.currency, 3, prev.currency).toUpperCase(), 'startDate' in body ? str(body.startDate, 10) || null : prev.start_date, 'dueDate' in body ? str(body.dueDate, 10) || null : prev.due_date, status, str(body.usageRights, 1000, prev.usage_rights), str(body.exclusivityTerms, 1000, prev.exclusivity_terms), str(body.brandRestrictions, 1000, prev.brand_restrictions), who === 'staff' && typeof body.ownerId === 'string' ? body.ownerId : prev.owner_user_id, nowIso(), prev.id)
    .run();
  if (status !== prev.status) {
    await logEvent(db, prev.id, user.id, 'status', `${prev.status} to ${status}`);
    await audit(db, user.id, 'campaign.status', 'campaign', prev.id, prev.status, status);
    const members = await db.prepare("SELECT user_id FROM organization_members WHERE organization_id = ? AND status = 'active'").bind(prev.organization_id).all<{ user_id: string }>();
    for (const m of members.results) if (m.user_id !== user.id) await notify(db, m.user_id, 'campaign', `${prev.name}: ${status.replace('_', ' ')}`, '', `/army/${prev.id}`);
  }
  const row = await db.prepare(`${SELECT} WHERE c.id = ?`).bind(prev.id).first<CampaignRow>();
  return c.json({ campaign: row ? toCampaign(row) : null });
});

army.post('/campaigns/:id/deliverables', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const camp = await db.prepare('SELECT id, organization_id FROM campaigns WHERE id = ?').bind(c.req.param('id')).first<{ id: string; organization_id: string }>();
  if (!camp) return c.json({ error: 'not found' }, 404);
  const who = await whoFor(db, user, camp);
  if (who !== 'staff' && who !== 'brand') return c.json({ error: 'you do not have access to that' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const title = str(body.title, 140);
  if (!title) return c.json({ error: 'title required' }, 400);
  const id = newId();
  await db.prepare('INSERT INTO campaign_deliverables (id, campaign_id, title, format, platform, due_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, camp.id, title, str(body.format, 60), str(body.platform, 60), str(body.dueAt, 40) || null, 'open', nowIso()).run();
  await logEvent(db, camp.id, user.id, 'deliverable', `Added "${title}"`);
  return c.json({ ok: true, id }, 201);
});

// Staff assign creators; creators accept or decline their offer.
army.post('/campaigns/:id/assignments', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const camp = await db.prepare('SELECT id, name, organization_id FROM campaigns WHERE id = ?').bind(c.req.param('id')).first<{ id: string; name: string; organization_id: string }>();
  if (!camp) return c.json({ error: 'not found' }, 404);
  if (!can(user, 'talent')) return c.json({ error: 'talent staff assign creators' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const q = str(body.creator, 120).toLowerCase();
  const creator = await db.prepare('SELECT id FROM users WHERE email = ? OR handle = ? OR id = ?').bind(q, q, q).first<{ id: string }>();
  if (!creator) return c.json({ error: 'no creator with that email, page name or id' }, 404);
  const id = newId();
  await db.prepare("INSERT OR REPLACE INTO campaign_assignments (id, campaign_id, creator_user_id, role, fee_amount, currency, status, terms_accepted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, 'offered', NULL, ?)").bind(id, camp.id, creator.id, str(body.role, 60, 'creator') || 'creator', num(body.feeAmount, 0, 0) ?? 0, str(body.currency, 3, 'INR').toUpperCase(), nowIso()).run();
  await logEvent(db, camp.id, user.id, 'assignment', 'Creator offered a role');
  await notify(db, creator.id, 'campaign', `You were offered a role on ${camp.name}`, 'Open Army to accept the terms.', `/army/${camp.id}`);
  return c.json({ ok: true, id }, 201);
});

army.post('/assignments/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const a = await db.prepare('SELECT a.*, c.name AS campaign_name, c.owner_user_id FROM campaign_assignments a JOIN campaigns c ON c.id = a.campaign_id WHERE a.id = ?').bind(c.req.param('id')).first<AssignmentRow & { campaign_name: string; owner_user_id: string | null }>();
  if (!a) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ status?: string }>().catch(() => ({}) as { status?: string });
  const next = oneOf(body.status, ['accepted', 'declined', 'done'] as const, 'accepted');
  if (next === 'done') {
    if (!can(user, 'talent')) return c.json({ error: 'staff mark work done' }, 403);
  } else if (a.creator_user_id !== user.id) return c.json({ error: 'not your offer' }, 403);
  await db.prepare('UPDATE campaign_assignments SET status = ?, terms_accepted_at = COALESCE(terms_accepted_at, ?) WHERE id = ?').bind(next, next === 'accepted' ? nowIso() : null, a.id).run();
  await logEvent(db, a.campaign_id, user.id, 'assignment', `${nameOf({ display_name: a.creator_name })} ${next}`);
  if (a.owner_user_id && next !== 'done') await notify(db, a.owner_user_id, 'campaign', `${nameOf({ display_name: a.creator_name })} ${next} the offer on ${a.campaign_name}`, '', `/army/${a.campaign_id}`);
  return c.json({ ok: true });
});

// Assigned creators upload versions; brand or staff review them.
army.post('/deliverables/:id/versions', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const d = await db.prepare('SELECT d.*, c.organization_id, c.owner_user_id FROM campaign_deliverables d JOIN campaigns c ON c.id = d.campaign_id WHERE d.id = ?').bind(c.req.param('id')).first<DeliverableRow & { organization_id: string; owner_user_id: string | null }>();
  if (!d) return c.json({ error: 'not found' }, 404);
  const who = await whoFor(db, user, { id: d.campaign_id, organization_id: d.organization_id });
  if (who !== 'creator' && who !== 'staff') return c.json({ error: 'assigned creators upload work' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const url = str(body.url, 500);
  if (!url) return c.json({ error: 'a link to the work' }, 400);
  const n = await db.prepare('SELECT COALESCE(MAX(version_number), 0) + 1 AS n FROM deliverable_versions WHERE deliverable_id = ?').bind(d.id).first<{ n: number }>();
  const id = newId();
  await db.batch([
    db.prepare("INSERT INTO deliverable_versions (id, deliverable_id, version_number, url, note, submitted_by, submitted_at, review_status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')").bind(id, d.id, n?.n ?? 1, url, str(body.note, 1000), user.id, nowIso()),
    db.prepare("UPDATE campaign_deliverables SET status = 'submitted' WHERE id = ?").bind(d.id),
  ]);
  await logEvent(db, d.campaign_id, user.id, 'version', `Version ${n?.n ?? 1} of "${d.title}" uploaded`);
  if (d.owner_user_id) await notify(db, d.owner_user_id, 'campaign', `New version of ${d.title}`, '', `/army/${d.campaign_id}`);
  return c.json({ ok: true, id }, 201);
});

army.post('/versions/:id/review', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const v = await db.prepare('SELECT v.*, d.campaign_id, d.title, c.organization_id FROM deliverable_versions v JOIN campaign_deliverables d ON d.id = v.deliverable_id JOIN campaigns c ON c.id = d.campaign_id WHERE v.id = ?').bind(c.req.param('id')).first<VersionRow & { campaign_id: string; title: string; organization_id: string }>();
  if (!v) return c.json({ error: 'not found' }, 404);
  const who = await whoFor(db, user, { id: v.campaign_id, organization_id: v.organization_id });
  if (who !== 'staff' && who !== 'brand') return c.json({ error: 'the brand or staff review work' }, 403);
  const body = await c.req.json<{ status?: string; comment?: string }>().catch(() => ({}) as { status?: string; comment?: string });
  const status = oneOf(body.status, ['approved', 'changes'] as const, 'changes');
  const comment = str(body.comment, 2000);
  const now = nowIso();
  const stmts = [db.prepare('UPDATE deliverable_versions SET review_status = ? WHERE id = ?').bind(status, v.id)];
  if (comment) stmts.push(db.prepare("INSERT INTO feedback_items (id, deliverable_version_id, author_user_id, comment, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)").bind(newId(), v.id, user.id, comment, now));
  stmts.push(status === 'approved' ? db.prepare("UPDATE campaign_deliverables SET status = 'approved', approved_at = ?, final_url = ? WHERE id = ?").bind(now, v.url, v.deliverable_id) : db.prepare("UPDATE campaign_deliverables SET status = 'changes' WHERE id = ?").bind(v.deliverable_id));
  await db.batch(stmts);
  await logEvent(db, v.campaign_id, user.id, status === 'approved' ? 'approved' : 'changes', `Version ${v.version_number} of "${v.title}"${comment ? `: ${comment.slice(0, 80)}` : ''}`);
  await notify(db, v.submitted_by, 'campaign', status === 'approved' ? `${v.title} approved` : `Changes requested on ${v.title}`, comment.slice(0, 160), `/army/${v.campaign_id}`);
  return c.json({ ok: true });
});
