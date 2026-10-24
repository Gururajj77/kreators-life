import { Hono } from 'hono';
import { APPLICATION_STATUSES, OPPORTUNITY_TYPES, type Application, type Opportunity } from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { audit, can, nameOf, newId, notify, nowIso, num, oneOf, orgIdsOf, orgRole, parseList, str } from '../db';

export const work = new Hono<AppEnv>();

interface OppRow {
  id: string; organization_id: string | null; organization_name: string | null; created_by: string; title: string; description: string; opportunity_type: Opportunity['opportunityType']; skills_required: string; location_mode: Opportunity['locationMode']; location_text: string;
  compensation_min: number | null; compensation_max: number | null; currency: string; deliverables: string; deadline: string | null; status: Opportunity['status']; eligibility: string; created_at: string; published_at: string | null; applications: number;
}
const SELECT = `SELECT o.*, org.name AS organization_name, (SELECT COUNT(*) FROM applications a WHERE a.opportunity_id = o.id AND a.status != 'withdrawn') AS applications FROM opportunities o LEFT JOIN organizations org ON org.id = o.organization_id`;
interface AppRow { id: string; opportunity_id: string; opportunity_title: string; creator_user_id: string; creator_name: string; creator_handle: string | null; cover_note: string; portfolio_snapshot: string; status: Application['status']; submitted_at: string; updated_at: string }
const APP_SELECT = `SELECT a.*, u.display_name AS creator_name, u.handle AS creator_handle, o.title AS opportunity_title FROM applications a JOIN users u ON u.id = a.creator_user_id JOIN opportunities o ON o.id = a.opportunity_id`;
const toApp = (r: AppRow): Application => ({ id: r.id, opportunityId: r.opportunity_id, opportunityTitle: r.opportunity_title, creatorId: r.creator_user_id, creatorName: nameOf({ display_name: r.creator_name }), creatorHandle: r.creator_handle, coverNote: r.cover_note, portfolioSnapshot: r.portfolio_snapshot, status: r.status, submittedAt: r.submitted_at, updatedAt: r.updated_at });
const toOpp = (r: OppRow, mine: Application | null): Opportunity => ({
  id: r.id, organizationId: r.organization_id, organizationName: r.organization_name ?? 'Kreators', createdBy: r.created_by, title: r.title, description: r.description, opportunityType: r.opportunity_type, skillsRequired: parseList(r.skills_required), locationMode: r.location_mode, locationText: r.location_text,
  compensationMin: r.compensation_min, compensationMax: r.compensation_max, currency: r.currency, deliverables: r.deliverables, deadline: r.deadline, status: r.status, eligibility: r.eligibility, createdAt: r.created_at, publishedAt: r.published_at, applications: r.applications, myApplication: mine,
});

async function owns(db: D1Database, user: UserRow, o: OppRow): Promise<boolean> {
  if (can(user, 'talent') || o.created_by === user.id) return true;
  return Boolean(o.organization_id && (await orgRole(db, o.organization_id, user.id)));
}

work.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const orgIds = await orgIdsOf(db, user.id);
  const [published, mine, drafts] = await Promise.all([
    db.prepare(`${SELECT} WHERE o.status = 'published' AND (o.deadline IS NULL OR o.deadline >= ?) ORDER BY o.published_at DESC LIMIT 100`).bind(new Date().toISOString().slice(0, 10)).all<OppRow>(),
    db.prepare(`${APP_SELECT} WHERE a.creator_user_id = ? ORDER BY a.updated_at DESC`).bind(user.id).all<AppRow>(),
    can(user, 'talent')
      ? db.prepare(`${SELECT} WHERE o.status != 'published' ORDER BY o.created_at DESC LIMIT 100`).all<OppRow>()
      : db.prepare(`${SELECT} WHERE o.status != 'published' AND (o.created_by = ? OR o.organization_id IN (${orgIds.length ? orgIds.map(() => '?').join(',') : "''"})) ORDER BY o.created_at DESC`).bind(user.id, ...orgIds).all<OppRow>(),
  ]);
  const byOpp = new Map(mine.results.map((a) => [a.opportunity_id, toApp(a)]));
  return c.json({ opportunities: published.results.map((o) => toOpp(o, byOpp.get(o.id) ?? null)), applications: mine.results.map(toApp), drafts: drafts.results.map((o) => toOpp(o, null)), canPost: can(user, 'talent') || orgIds.length > 0 });
});

work.post('/opportunities', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const organizationId = str(body.organizationId, 64) || null;
  if (organizationId && !(await orgRole(db, organizationId, user.id)) && !can(user, 'talent')) return c.json({ error: 'not your organization' }, 403);
  if (!organizationId && !can(user, 'talent')) return c.json({ error: 'post from a brand you belong to' }, 403);
  const title = str(body.title, 120);
  if (!title) return c.json({ error: 'title required' }, 400);
  const id = newId();
  const skills = Array.isArray(body.skillsRequired) ? body.skillsRequired.filter((x): x is string => typeof x === 'string').slice(0, 10) : [];
  await db
    .prepare('INSERT INTO opportunities (id, organization_id, created_by, title, description, opportunity_type, skills_required, location_mode, location_text, compensation_min, compensation_max, currency, deliverables, deadline, status, eligibility, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, organizationId, user.id, title, str(body.description, 5000), oneOf(body.opportunityType, OPPORTUNITY_TYPES, 'gig'), JSON.stringify(skills), oneOf(body.locationMode, ['remote', 'on_site', 'hybrid'] as const, 'remote'), str(body.locationText, 120), num(body.compensationMin, null, 0), num(body.compensationMax, null, 0), str(body.currency, 3, 'INR').toUpperCase(), str(body.deliverables, 2000), str(body.deadline, 10) || null, 'draft', str(body.eligibility, 1000), nowIso())
    .run();
  return c.json({ ok: true, id }, 201);
});

work.get('/opportunities/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare(`${SELECT} WHERE o.id = ?`).bind(c.req.param('id')).first<OppRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const owner = await owns(db, user, row);
  if (row.status !== 'published' && !owner) return c.json({ error: 'not found' }, 404);
  const mine = await db.prepare(`${APP_SELECT} WHERE a.opportunity_id = ? AND a.creator_user_id = ?`).bind(row.id, user.id).first<AppRow>();
  const apps = owner ? await db.prepare(`${APP_SELECT} WHERE a.opportunity_id = ? ORDER BY a.submitted_at DESC`).bind(row.id).all<AppRow>() : { results: [] as AppRow[] };
  return c.json({ opportunity: toOpp(row, mine ? toApp(mine) : null), applications: apps.results.map(toApp), owner });
});

work.patch('/opportunities/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const prev = await db.prepare(`${SELECT} WHERE o.id = ?`).bind(c.req.param('id')).first<OppRow>();
  if (!prev || !(await owns(db, user, prev))) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ status?: string }>().catch(() => ({}) as { status?: string });
  const status = oneOf(body.status, ['draft', 'published', 'closed'] as const, prev.status);
  const now = nowIso();
  await db.prepare('UPDATE opportunities SET status = ?, published_at = CASE WHEN ? = \'published\' THEN COALESCE(published_at, ?) ELSE published_at END, closed_at = CASE WHEN ? = \'closed\' THEN ? ELSE NULL END WHERE id = ?').bind(status, status, now, status, now, prev.id).run();
  await audit(db, user.id, 'opportunity.status', 'opportunity', prev.id, prev.status, status);
  return c.json({ ok: true });
});

// One application per person per opportunity, with the portfolio frozen at the time.
work.post('/opportunities/:id/apply', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare(`${SELECT} WHERE o.id = ? AND o.status = 'published'`).bind(c.req.param('id')).first<OppRow>();
  if (!row) return c.json({ error: 'this opportunity is not open' }, 404);
  if (row.deadline && row.deadline < new Date().toISOString().slice(0, 10)) return c.json({ error: 'the deadline has passed' }, 400);
  if (row.created_by === user.id) return c.json({ error: 'that is your own listing' }, 400);
  const body = await c.req.json<{ coverNote?: string }>().catch(() => ({}) as { coverNote?: string });
  const portfolio = await db.prepare("SELECT title, url FROM portfolio_items WHERE user_id = ? AND visibility = 'public' ORDER BY created_at DESC LIMIT 5").bind(user.id).all<{ title: string; url: string }>();
  const snapshot = [...parseList(user.skills), ...portfolio.results.map((p) => `${p.title}: ${p.url}`)].join('\n');
  const id = newId();
  const now = nowIso();
  try {
    await db.batch([
      db.prepare("INSERT INTO applications (id, opportunity_id, creator_user_id, cover_note, portfolio_snapshot, status, submitted_at, updated_at) VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?)").bind(id, row.id, user.id, str(body.coverNote, 2000), snapshot, now, now),
      db.prepare("INSERT INTO application_events (id, application_id, actor_user_id, event_type, note, created_at) VALUES (?, ?, ?, 'submitted', '', ?)").bind(newId(), id, user.id, now),
    ]);
  } catch {
    return c.json({ error: 'you already applied' }, 409);
  }
  await notify(db, row.created_by, 'work', `${nameOf(user)} applied to ${row.title}`, str(body.coverNote, 160), `/work/${row.id}`);
  const a = await db.prepare(`${APP_SELECT} WHERE a.id = ?`).bind(id).first<AppRow>();
  return c.json({ application: a ? toApp(a) : null }, 201);
});

work.post('/applications/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const a = await db.prepare(`${APP_SELECT} WHERE a.id = ?`).bind(c.req.param('id')).first<AppRow>();
  if (!a) return c.json({ error: 'not found' }, 404);
  const opp = await db.prepare(`${SELECT} WHERE o.id = ?`).bind(a.opportunity_id).first<OppRow>();
  if (!opp) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ status?: string; note?: string }>().catch(() => ({}) as { status?: string; note?: string });
  const next = oneOf(body.status, APPLICATION_STATUSES, a.status);
  const isCreator = a.creator_user_id === user.id;
  if (isCreator && next !== 'withdrawn') return c.json({ error: 'you can withdraw, the other steps are the reviewer\'s' }, 403);
  if (!isCreator && !(await owns(db, user, opp))) return c.json({ error: 'you do not review this listing' }, 403);
  const now = nowIso();
  await db.batch([
    db.prepare('UPDATE applications SET status = ?, updated_at = ?, decision_at = CASE WHEN ? IN (\'selected\',\'rejected\') THEN ? ELSE decision_at END WHERE id = ?').bind(next, now, next, now, a.id),
    db.prepare('INSERT INTO application_events (id, application_id, actor_user_id, event_type, note, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId(), a.id, user.id, next, str(body.note, 500), now),
  ]);
  if (!isCreator) await notify(db, a.creator_user_id, 'work', `${a.opportunity_title}: ${next}`, str(body.note, 160), `/work/${a.opportunity_id}`);
  return c.json({ ok: true });
});
