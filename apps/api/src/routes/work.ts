import { Hono } from 'hono';
import { APPLICATION_STATUSES, OPPORTUNITY_TYPES, type Application, type Opportunity } from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { audit, can, DATE_RE, isClubMember, nameOf, newId, notify, nowIso, num, oneOf, orgIdsOf, orgRole, parseList, str, pageOf, paged, TEN_A_PAGE } from '../db';

export const work = new Hono<AppEnv>();
/** The states an applicant can no longer withdraw from, as Work's own page hides Withdraw for them (All tables reads the same list). */
export const WITHDRAW_SHUT: readonly string[] = ['withdrawn', 'rejected', 'completed', 'selected'];

interface OppRow {
  id: string; organization_id: string | null; organization_name: string | null; created_by: string; title: string; description: string; opportunity_type: Opportunity['opportunityType']; skills_required: string; location_mode: Opportunity['locationMode']; location_text: string;
  compensation_min: number | null; compensation_max: number | null; currency: string; deliverables: string; deadline: string | null; status: Opportunity['status']; eligibility: string; club_only: number; created_at: string; published_at: string | null; applications: number;
}
const SELECT = `SELECT o.*, org.name AS organization_name, (SELECT COUNT(*) FROM applications a WHERE a.opportunity_id = o.id AND a.status != 'withdrawn') AS applications FROM opportunities o LEFT JOIN organizations org ON org.id = o.organization_id`;
interface AppRow { id: string; opportunity_id: string; opportunity_title: string; creator_user_id: string; creator_name: string; creator_handle: string | null; cover_note: string; portfolio_snapshot: string; status: Application['status']; submitted_at: string; updated_at: string }
const APP_SELECT = `SELECT a.*, u.display_name AS creator_name, u.handle AS creator_handle, o.title AS opportunity_title FROM applications a JOIN users u ON u.id = a.creator_user_id JOIN opportunities o ON o.id = a.opportunity_id`;
const toApp = (r: AppRow): Application => ({ id: r.id, opportunityId: r.opportunity_id, opportunityTitle: r.opportunity_title, creatorId: r.creator_user_id, creatorName: nameOf({ display_name: r.creator_name }), creatorHandle: r.creator_handle, coverNote: r.cover_note, portfolioSnapshot: r.portfolio_snapshot, status: r.status, submittedAt: r.submitted_at, updatedAt: r.updated_at });
const toOpp = (r: OppRow, mine: Application | null): Opportunity => ({
  id: r.id, organizationId: r.organization_id, organizationName: r.organization_name ?? 'Kreators', createdBy: r.created_by, title: r.title, description: r.description, opportunityType: r.opportunity_type, skillsRequired: parseList(r.skills_required), locationMode: r.location_mode, locationText: r.location_text,
  compensationMin: r.compensation_min, compensationMax: r.compensation_max, currency: r.currency, deliverables: r.deliverables, deadline: r.deadline, status: r.status, eligibility: r.eligibility, clubOnly: r.club_only === 1, createdAt: r.created_at, publishedAt: r.published_at, applications: r.applications, myApplication: mine,
});

async function owns(db: D1Database, user: UserRow, o: OppRow): Promise<boolean> {
  if (can(user, 'talent') || o.created_by === user.id) return true;
  return Boolean(o.organization_id && (await orgRole(db, o.organization_id, user.id)));
}

work.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const ask = pageOf(c);
  const draftAsk = pageOf(c, 'd');
  // Your applications are a page at a time (prefix `ap`, ten by default, 2026-11-07); the cards on this page still carry yours.
  const apAsk = pageOf(c, 'ap', TEN_A_PAGE);
  const [orgIds, member] = await Promise.all([orgIdsOf(db, user.id), isClubMember(db, user.id)]);
  const day = new Date().toISOString().slice(0, 10);
  const [published, mineRows, onPage, drafts] = await Promise.all([
    // Club-only listings are the Club's first look: only members see them.
    db.prepare(`${SELECT} WHERE o.status = 'published' AND (o.deadline IS NULL OR o.deadline >= ?) AND (o.club_only = 0 OR ? = 1) ORDER BY o.published_at DESC LIMIT ? OFFSET ?`).bind(day, member ? 1 : 0, ask.limit, ask.offset).all<OppRow>(),
    db.prepare(`${APP_SELECT} WHERE a.creator_user_id = ? ORDER BY a.updated_at DESC, a.id LIMIT ? OFFSET ?`).bind(user.id, apAsk.limit, apAsk.offset).all<AppRow>(),
    db
      .prepare(`${APP_SELECT} WHERE a.creator_user_id = ?1 AND a.opportunity_id IN (SELECT o.id FROM opportunities o WHERE o.status = 'published' AND (o.deadline IS NULL OR o.deadline >= ?2) AND (o.club_only = 0 OR ?3 = 1) ORDER BY o.published_at DESC LIMIT ?4 OFFSET ?5)`)
      .bind(user.id, day, member ? 1 : 0, ask.limit, ask.offset)
      .all<AppRow>(),
    can(user, 'talent')
      ? db.prepare(`${SELECT} WHERE o.status != 'published' ORDER BY o.created_at DESC LIMIT ? OFFSET ?`).bind(draftAsk.limit, draftAsk.offset).all<OppRow>()
      : db.prepare(`${SELECT} WHERE o.status != 'published' AND (o.created_by = ? OR o.organization_id IN (${orgIds.length ? orgIds.map(() => '?').join(',') : "''"})) ORDER BY o.created_at DESC LIMIT ? OFFSET ?`).bind(user.id, ...orgIds, draftAsk.limit, draftAsk.offset).all<OppRow>(),
  ]);
  const mine = paged(mineRows.results, apAsk);
  const byOpp = new Map(onPage.results.map((a) => [a.opportunity_id, toApp(a)]));
  const pg = paged(published.results, ask);
  const dpg = paged(drafts.results, draftAsk);
  return c.json({ page: pg.page, opportunities: pg.items.map((o) => toOpp(o, byOpp.get(o.id) ?? null)), applications: mine.items.map(toApp), applicationsPage: mine.page, draftPage: dpg.page, drafts: dpg.items.map((o) => toOpp(o, null)), canPost: can(user, 'talent') || orgIds.length > 0 });
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
    .prepare('INSERT INTO opportunities (id, organization_id, created_by, title, description, opportunity_type, skills_required, location_mode, location_text, compensation_min, compensation_max, currency, deliverables, deadline, status, eligibility, club_only, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, organizationId, user.id, title, str(body.description, 5000), oneOf(body.opportunityType, OPPORTUNITY_TYPES, 'gig'), JSON.stringify(skills), oneOf(body.locationMode, ['remote', 'on_site', 'hybrid'] as const, 'remote'), str(body.locationText, 120), num(body.compensationMin, null, 0), num(body.compensationMax, null, 0), str(body.currency, 3, 'INR').toUpperCase(), str(body.deliverables, 2000), str(body.deadline, 10) || null, 'draft', str(body.eligibility, 1000), body.clubOnly === true ? 1 : 0, nowIso())
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
  if (row.club_only === 1 && !owner && !(await isClubMember(db, user.id))) return c.json({ error: 'Club members only. Apply under Club for the first look.' }, 403);
  const mine = await db.prepare(`${APP_SELECT} WHERE a.opportunity_id = ? AND a.creator_user_id = ?`).bind(row.id, user.id).first<AppRow>();
  const ask = pageOf(c);
  const apps = owner ? await db.prepare(`${APP_SELECT} WHERE a.opportunity_id = ? ORDER BY a.submitted_at DESC LIMIT ? OFFSET ?`).bind(row.id, ask.limit, ask.offset).all<AppRow>() : { results: [] as AppRow[] };
  const pg = paged(apps.results, ask);
  return c.json({ opportunity: toOpp(row, mine ? toApp(mine) : null), page: pg.page, applications: pg.items.map(toApp), owner });
});

/**
 * A listing's state and Club only, as Work's own buttons send them, and (2026-11-14, from All tables) its words: the title, about it, who can
 * apply, the place and the apply-by day, each only when sent and read by the create route's own limits. What to deliver changes only while
 * nobody has applied, so nobody's application answers a brief that moved (409 in words). A day sent is a real calendar day or nothing. The
 * words are only for whoever posted it: talent staff and the brand's team keep the state and Club moves they always had (the review of 2026-11-14).
 */
work.patch('/opportunities/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const prev = await db.prepare(`${SELECT} WHERE o.id = ?`).bind(c.req.param('id')).first<OppRow>();
  if (!prev || !(await owns(db, user, prev))) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const status = oneOf(body.status, ['draft', 'published', 'closed'] as const, prev.status);
  const clubOnly = typeof body.clubOnly === 'boolean' ? (body.clubOnly ? 1 : 0) : prev.club_only;
  const wordKeys = ['title', 'description', 'deliverables', 'eligibility', 'locationText', 'deadline'];
  if (wordKeys.some((k) => k in body) && prev.created_by !== user.id) return c.json({ error: 'Only whoever posted it changes its words.' }, 403);
  if ('title' in body && !str(body.title, 120)) return c.json({ error: 'Give the listing a title.' }, 400);
  if ('deadline' in body && body.deadline !== null && body.deadline !== '' && !(typeof body.deadline === 'string' && DATE_RE.test(body.deadline))) return c.json({ error: 'Pick a real day to apply by.' }, 400);
  if ('deliverables' in body && str(body.deliverables, 2000) !== prev.deliverables && prev.applications > 0) return c.json({ error: 'People applied to it already, so what to deliver stays as they read it.' }, 409);
  const words = {
    title: 'title' in body ? str(body.title, 120) : prev.title,
    description: 'description' in body ? str(body.description, 5000) : prev.description,
    deliverables: 'deliverables' in body ? str(body.deliverables, 2000) : prev.deliverables,
    eligibility: 'eligibility' in body ? str(body.eligibility, 1000) : prev.eligibility,
    location_text: 'locationText' in body ? str(body.locationText, 120) : prev.location_text,
    deadline: 'deadline' in body ? (typeof body.deadline === 'string' && body.deadline ? body.deadline : null) : prev.deadline,
  };
  const now = nowIso();
  await db
    .prepare('UPDATE opportunities SET status = ?, club_only = ?, title = ?, description = ?, deliverables = ?, eligibility = ?, location_text = ?, deadline = ?, published_at = CASE WHEN ? = \'published\' THEN COALESCE(published_at, ?) ELSE published_at END, closed_at = CASE WHEN ? = \'closed\' THEN COALESCE(CASE WHEN status = \'closed\' THEN closed_at END, ?) ELSE NULL END WHERE id = ?')
    .bind(status, clubOnly, words.title, words.description, words.deliverables, words.eligibility, words.location_text, words.deadline, status, now, status, now, prev.id)
    .run();
  if (status !== prev.status) await audit(db, user.id, 'opportunity.status', 'opportunity', prev.id, prev.status, status);
  const changed = (Object.keys(words) as (keyof typeof words)[]).filter((k) => (words[k] ?? '') !== (prev[k] ?? ''));
  if (changed.length) await audit(db, user.id, 'opportunity.edit', 'opportunity', prev.id, prev.title, changed.join(', '));
  return c.json({ ok: true });
});

/**
 * Delete a listing that was never published (2026-11-14, from All tables): a draft nobody saw or applied to, by whoever posted it (never talent
 * staff or the brand's team, the review of 2026-11-14), in one guarded statement; its pictures go with it. Anything published once stays (close
 * it instead), so no application loses its listing.
 */
work.delete('/opportunities/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const prev = await db.prepare(`${SELECT} WHERE o.id = ?`).bind(c.req.param('id')).first<OppRow>();
  if (!prev || !(await owns(db, user, prev))) return c.json({ error: 'not found' }, 404);
  if (prev.created_by !== user.id) return c.json({ error: 'Only whoever posted it deletes it.' }, 403);
  const [, gone] = await db.batch([
    db.prepare("DELETE FROM media_items WHERE owner_type = 'opportunity' AND owner_id = ?1 AND EXISTS (SELECT 1 FROM opportunities o WHERE o.id = ?1 AND o.status = 'draft' AND o.published_at IS NULL AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.opportunity_id = o.id))").bind(prev.id),
    db.prepare("DELETE FROM opportunities WHERE id = ?1 AND status = 'draft' AND published_at IS NULL AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.opportunity_id = ?1)").bind(prev.id),
  ]);
  if (!gone?.meta.changes) return c.json({ error: 'It was published once, so it stays. Close it instead.' }, 409);
  await audit(db, user.id, 'opportunity.delete', 'opportunity', prev.id, prev.title, '');
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
  if (row.club_only === 1 && !(await isClubMember(db, user.id))) return c.json({ error: 'Club members only. Apply under Club for the first look.' }, 403);
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
  // What Work's own buttons offer (2026-11-14, guarded for All tables): the applicant withdraws only while it is still being looked at, and
  // the listing's team moves only one the applicant has not withdrawn and nobody has completed, never into the applicant's own Withdrawn.
  if (isCreator && WITHDRAW_SHUT.includes(a.status)) return c.json({ error: a.status === 'withdrawn' ? 'You withdrew it already.' : 'It was decided already, so it stays.' }, 409);
  if (!isCreator && (a.status === 'withdrawn' || a.status === 'completed')) return c.json({ error: a.status === 'withdrawn' ? 'They withdrew it, so it stays.' : 'It is completed, so it stays.' }, 409);
  if (!isCreator && (next === 'withdrawn' || next === 'draft')) return c.json({ error: 'That step is the applicant’s own.' }, 400);
  if (next === a.status) return c.json({ ok: true });
  const now = nowIso();
  // Guarded on the state that was read, with the step written only when the move landed, so two taps (or a table's second send) move it once.
  const [moved] = await db.batch([
    db.prepare('UPDATE applications SET status = ?, updated_at = ?, decision_at = CASE WHEN ? IN (\'selected\',\'rejected\') THEN ? ELSE decision_at END WHERE id = ? AND status = ?').bind(next, now, next, now, a.id, a.status),
    db.prepare('INSERT INTO application_events (id, application_id, actor_user_id, event_type, note, created_at) SELECT ?, ?, ?, ?, ?, ? WHERE changes() = 1').bind(newId(), a.id, user.id, next, str(body.note, 500), now),
  ]);
  if (!moved?.meta.changes) return c.json({ error: 'It moved a moment ago. Read it again.' }, 409);
  if (!isCreator) await notify(db, a.creator_user_id, 'work', `${a.opportunity_title}: ${next}`, str(body.note, 160), `/work/${a.opportunity_id}`);
  return c.json({ ok: true });
});
