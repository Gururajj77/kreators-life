import { quoteCode, redeem, release, type Quoted } from '../discounts';
import { Hono } from 'hono';
import { ADMIN_GUIDE_COHORT, ADMIN_GUIDE_PROGRAM, formatCount, money, LESSON_BODY_MAX, LESSON_TITLE_MAX, MAX_PROGRAM_INVITES, isProgramVisibility, lessonBodyProblem, programTakesEnrolment, programVisibleTo, type Cohort, type CohortSession, type CourseAssignment, type Enrollment, type LearningItem, type Program, type ProgramInvite, type ProgramVisibility, type Submission } from '@kreators/shared';
import { LESSON_RESOURCE_REPEAT, LESSON_RESOURCES_FULL, MAX_LESSON_RESOURCES, lessonResourceKindOf, lessonResourceLink, parseLessonResources, storedLessonResources } from '@kreators/shared/lessonResources';
import type { AppEnv, UserRow } from '../env';
import { audit, badLink, blockedEither, can, DELETED_NAME, inBatches, liveUser, LINK_PROBLEM, nameOf, newId, notify, nowIso, num, objectBody, oneOf, personBy, str, pageOf, paged, httpUrl, TEN_A_PAGE } from '../db';
import { connectionsCameTrue } from '../invites';

export const school = new Hono<AppEnv>();

interface ProgramRow { id: string; name: string; description: string; price_points: number; price_cents: number; currency: string; delivery_mode: Program['deliveryMode']; published: number; outcomes: string; prerequisites: string; created_by: string | null; created_at: string; sort_position: number | null }
type VisRow = ProgramRow & { vis: ProgramVisibility };

/**
 * A program's state, read the one way (migration 0086). Admin's listings still flip `published` by itself, so `published = 1` is public
 * and a row marked public whose `published` went to 0 reads as a draft; otherwise the stored state.
 */
export const VIS = `(CASE WHEN p.published = 1 THEN 'public' WHEN p.visibility = 'public' THEN 'draft' ELSE p.visibility END)`;
const NOT_FOUND_PERSON = 'We could not find that person.';
/**
 * School's order inside each state (migration 0095): the programs an admin placed first, by position, then the rest newest first. The
 * list groups by state before this, so a page of new drafts never pushes the live ones off the first page.
 */
const PROGRAM_ORDER = 'CASE WHEN p.sort_position IS NULL THEN 1 ELSE 0 END, p.sort_position, p.created_at DESC, p.id';
/**
 * Which programs a School view lists (`?1` is the viewer): every one for an admin's "Every program", else public programs, private
 * ones they were invited to, and the ones they made or manage a cohort of. GET /school and the move read the same rule, so a move
 * swaps a program with the neighbour the person can see.
 */
const viewWhere = (every: boolean) =>
  every
    ? ''
    : `WHERE ${VIS} = 'public' OR p.created_by = ?1 OR EXISTS (SELECT 1 FROM cohorts k WHERE k.program_id = p.id AND k.manager_user_id = ?1)
        OR (${VIS} = 'private' AND EXISTS (SELECT 1 FROM program_invites i WHERE i.program_id = p.id AND i.user_id = ?1))`;
/** The programs of one view in School's order, with their state. */
async function viewOrder(db: D1Database, userId: string, every: boolean) {
  const sql = db.prepare(`SELECT p.id, ${VIS} AS vis FROM programs p ${viewWhere(every)} ORDER BY ${PROGRAM_ORDER}`);
  const rows = await (every ? sql : sql.bind(userId)).all<{ id: string; vis: ProgramVisibility }>();
  return rows.results;
}
/** The first and the last program of each state in one view, so the screen turns off the moves that would have nowhere to go. */
async function orderEndsIn(db: D1Database, userId: string, every: boolean) {
  const first = new Set<string>();
  const last = new Map<ProgramVisibility, string>();
  const seen = new Set<ProgramVisibility>();
  for (const r of await viewOrder(db, userId, every)) {
    if (!seen.has(r.vis)) first.add(r.id);
    seen.add(r.vis);
    last.set(r.vis, r.id);
  }
  return { first, last: new Set(last.values()) };
}
/** The Admin guide is for admins only (migration 0088): it stays private with no one invited, so the card's line stays true. */
const ADMIN_GUIDE_STAYS = 'The Admin guide stays private to admins.';
/** An admin (role admin) sees and changes every program in every state. */
const isAdmin = (user: Pick<UserRow, 'role'>) => user.role === 'admin';

/** Who this person is to one program: whether they made it, manage one of its cohorts or were invited. Null when there is no program. */
export async function accessTo(db: D1Database, user: UserRow, programId: string) {
  const row = await db
    .prepare(
      `SELECT p.*, ${VIS} AS vis,
        EXISTS (SELECT 1 FROM cohorts k WHERE k.program_id = p.id AND k.manager_user_id = ?2) AS manages,
        EXISTS (SELECT 1 FROM program_invites i WHERE i.program_id = p.id AND i.user_id = ?2) AS invited
       FROM programs p WHERE p.id = ?1`,
    )
    .bind(programId, user.id)
    .first<VisRow & { manages: number; invited: number }>();
  if (!row) return null;
  const admin = isAdmin(user);
  const creator = Boolean(row.created_by) && row.created_by === user.id;
  const runs = creator || row.manages === 1;
  const who = { admin, runs, invited: row.invited === 1 };
  return {
    row,
    admin,
    creator,
    visible: programVisibleTo(row.vis, who),
    enrolOpen: programTakesEnrolment(row.vis, who),
    /** Its state, invites and the delete: its creator or an admin. */
    manage: admin || creator,
    /** Its lessons, assignments and cohorts: whoever runs it, an admin, or the team with the cohorts permission on a public program, as before. */
    edit: admin || runs || (can(user, 'cohorts') && row.vis === 'public'),
  };
}

/** Who this person is to one cohort's program: `manager` runs the cohort (sessions, completion), `mentor` may also review hand-ins. */
export async function cohortRole(db: D1Database, user: UserRow, cohortId: string) {
  const k = await db.prepare('SELECT program_id, manager_user_id FROM cohorts WHERE id = ?').bind(cohortId).first<{ program_id: string; manager_user_id: string | null }>();
  if (!k) return null;
  const a = await accessTo(db, user, k.program_id);
  if (!a) return null;
  const manager = a.edit || k.manager_user_id === user.id;
  return { access: a, manager, mentor: manager || (can(user, 'mentor') && a.visible) };
}
interface CohortRow { id: string; program_id: string; program_name: string; name: string; start_at: string; end_at: string; capacity: number; enrolled: number; status: Cohort['status']; manager_user_id: string | null; manager_name: string | null }
const COHORT_SELECT = `SELECT k.*, p.name AS program_name, u.display_name AS manager_name, (SELECT COUNT(*) FROM enrollments e WHERE e.cohort_id = k.id AND e.status != 'withdrawn') AS enrolled FROM cohorts k JOIN programs p ON p.id = k.program_id LEFT JOIN users u ON u.id = k.manager_user_id`;
const toCohort = (r: CohortRow): Cohort => ({ id: r.id, programId: r.program_id, programName: r.program_name, name: r.name, startAt: r.start_at, endAt: r.end_at, capacity: r.capacity, enrolled: r.enrolled, status: r.status, managerId: r.manager_user_id, managerName: r.manager_name ? nameOf({ display_name: r.manager_name }) : 'Unassigned' });

school.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const staff = can(user, 'cohorts');
  const admin = isAdmin(user);
  // An admin can ask for every program from anyone in every state; everyone else (and an admin by default) sees what the one rule
  // allows: public programs, private ones they were invited to, and the ones they made or manage a cohort of.
  const every = admin && c.req.query('view') === 'every';
  const ask = pageOf(c);
  const where = viewWhere(every);
  const [progsAll, cohorts, mine, managed, orderEnds] = await Promise.all([
    // Public programs first, then private, drafts and archived, so a page of new drafts never pushes the live ones off the first page.
    db
      .prepare(
        `SELECT p.*, ${VIS} AS vis, u.display_name AS creator_name, EXISTS (SELECT 1 FROM cohorts k WHERE k.program_id = p.id AND k.manager_user_id = ?1) AS manages
         FROM programs p LEFT JOIN users u ON u.id = p.created_by ${where}
         ORDER BY CASE ${VIS} WHEN 'public' THEN 0 WHEN 'private' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END, ${PROGRAM_ORDER} LIMIT ?2 OFFSET ?3`,
      )
      .bind(user.id, ask.limit, ask.offset)
      .all<VisRow & { creator_name: string | null; manages: number }>(),
    // Only the cohorts of this page's programs (the same view, order and page), never every cohort there is (2026-11-07).
    db
      .prepare(
        `${COHORT_SELECT} WHERE k.status != 'cancelled' AND k.program_id IN (SELECT p.id FROM programs p ${where}
           ORDER BY CASE ${VIS} WHEN 'public' THEN 0 WHEN 'private' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END, ${PROGRAM_ORDER} LIMIT ?2 OFFSET ?3) ORDER BY k.start_at`,
      )
      .bind(user.id, ask.limit, ask.offset)
      .all<CohortRow>(),
    db.prepare(`${COHORT_SELECT} WHERE k.id IN (SELECT cohort_id FROM enrollments WHERE learner_user_id = ? AND status != 'withdrawn')`).bind(user.id).all<CohortRow>(),
    db.prepare(`${COHORT_SELECT} WHERE k.manager_user_id = ?`).bind(user.id).all<CohortRow>(),
    // For an admin, where each program sits inside its state in this view, read from the whole list rather than guessed from the page.
    admin ? orderEndsIn(db, user.id, every) : Promise.resolve(null),
  ]);
  const pg = paged(progsAll.results, ask);
  const progs = { results: pg.items };
  const programs: Program[] = progs.results.map((p) => {
    const mine = Boolean(p.created_by) && p.created_by === user.id;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      pricePoints: p.price_points,
      priceCents: p.price_cents,
      currency: p.currency,
      deliveryMode: p.delivery_mode,
      published: p.vis === 'public',
      visibility: p.vis,
      outcomes: p.outcomes,
      prerequisites: p.prerequisites,
      createdAt: p.created_at,
      cohorts: cohorts.results.filter((k) => k.program_id === p.id).map(toCohort),
      mine,
      canManage: admin || mine,
      canEdit: admin || mine || p.manages === 1 || (staff && p.vis === 'public'),
      canOrder: admin,
      ...(orderEnds ? { orderFirst: orderEnds.first.has(p.id), orderLast: orderEnds.last.has(p.id) } : {}),
      // Only an admin is told who made each program; the team is named "Kreators School" everywhere else.
      createdByName: admin ? (p.creator_name ? nameOf({ display_name: p.creator_name }) : null) : undefined,
    };
  });
  return c.json({ page: pg.page, programs, myCohorts: mine.results.map(toCohort), managed: managed.results.map(toCohort), staff, admin, view: every ? 'every' : 'mine', mentor: can(user, 'mentor') });
});

school.post('/programs', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (!can(user, 'cohorts')) return c.json({ error: 'cohort managers publish programs' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const name = str(body.name, 120);
  if (!name) return c.json({ error: 'name required' }, 400);
  const id = newId();
  // A new program starts as a draft unless it says otherwise (`published: true` from an older client means public).
  const vis: ProgramVisibility = isProgramVisibility(body.visibility) && body.visibility !== 'archived' ? body.visibility : body.published === true ? 'public' : 'draft';
  await db.prepare('INSERT INTO programs (id, name, description, price_points, price_cents, currency, delivery_mode, published, visibility, outcomes, prerequisites, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, name, str(body.description, 5000), num(body.pricePoints, 0, 0) ?? 0, num(body.priceCents, 0, 0) ?? 0, str(body.currency, 3, 'INR').toUpperCase(), oneOf(body.deliveryMode, ['online', 'in_person', 'hybrid'] as const, 'online'), vis === 'public' ? 1 : 0, vis, str(body.outcomes, 2000), str(body.prerequisites, 1000), user.id, nowIso())
    .run();
  await audit(db, user.id, 'program.create', 'program', id, '', name);
  return c.json({ ok: true, id }, 201);
});

school.patch('/programs/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const a = await accessTo(db, user, c.req.param('id'));
  if (!a || !a.visible) return c.json({ error: 'not found' }, 404);
  if (!a.edit) return c.json({ error: 'the people who run this program edit it' }, 403);
  const prev = a.row;
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  // The state: draft, private, public or archived (`published` true or false from an older client means public or draft). Only its
  // creator or an admin changes it, and every change is audited.
  const asked: ProgramVisibility | null = isProgramVisibility(body.visibility) ? body.visibility : typeof body.published === 'boolean' ? (body.published ? 'public' : 'draft') : null;
  if (body.visibility !== undefined && !asked) return c.json({ error: 'pick draft, private, public or archived' }, 400);
  if (asked && asked !== prev.vis && !a.manage) return c.json({ error: 'only the person who made this program, or an admin, changes its state' }, 403);
  if (prev.id === ADMIN_GUIDE_PROGRAM && asked === 'public' && prev.vis !== 'public') return c.json({ error: ADMIN_GUIDE_STAYS }, 400);
  if (body.name !== undefined && !str(body.name, 120)) return c.json({ error: 'Give the program a name.' }, 400);
  const vis = asked ?? prev.vis;
  const name = str(body.name, 120, prev.name) || prev.name;
  const description = str(body.description, 5000, prev.description);
  await db.prepare('UPDATE programs SET name = ?, description = ?, price_points = ?, price_cents = ?, delivery_mode = ?, published = ?, visibility = ?, outcomes = ?, prerequisites = ? WHERE id = ?')
    .bind(name, description, num(body.pricePoints, prev.price_points, 0) ?? prev.price_points, num(body.priceCents, prev.price_cents, 0) ?? prev.price_cents, oneOf(body.deliveryMode, ['online', 'in_person', 'hybrid'] as const, prev.delivery_mode), vis === 'public' ? 1 : 0, vis, str(body.outcomes, 2000, prev.outcomes), str(body.prerequisites, 1000, prev.prerequisites), prev.id)
    .run();
  if (vis !== prev.vis) await audit(db, user.id, 'program.visibility', 'program', prev.id, prev.vis, vis);
  // Its name and words, changed from the card on School: the old name and which parts changed, never the words themselves.
  const changed = [name !== prev.name ? 'name' : '', description !== prev.description ? 'description' : ''].filter(Boolean);
  if (changed.length) await audit(db, user.id, 'program.edit', 'program', prev.id, prev.name, changed.join(', '));
  return c.json({ ok: true, visibility: vis, name, description });
});

// The people invited to a private program: its creator or an admin reads, adds and removes them.
school.get('/programs/:id/invites', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const a = await accessTo(db, user, c.req.param('id'));
  if (!a || !a.visible) return c.json({ error: 'not found' }, 404);
  if (!a.manage) return c.json({ error: 'only the person who made this program, or an admin, sees who is invited' }, 403);
  const ask = pageOf(c, 'inv');
  const rows = await db
    .prepare(`SELECT i.user_id, i.created_at, u.display_name, u.handle FROM program_invites i JOIN users u ON u.id = i.user_id WHERE i.program_id = ? AND ${liveUser('u')} ORDER BY i.created_at DESC LIMIT ? OFFSET ?`)
    .bind(a.row.id, ask.limit, ask.offset)
    .all<{ user_id: string; created_at: string; display_name: string; handle: string | null }>();
  const pg = paged(rows.results, ask);
  const invites: ProgramInvite[] = pg.items.map((r) => ({ userId: r.user_id, name: nameOf(r), handle: r.handle ?? '', invitedAt: r.created_at }));
  return c.json({ page: pg.page, invites });
});

// Invite someone by email, @username or friend code. A block either way, a deleted account and nobody at all get the same words.
school.post('/programs/:id/invites', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const a = await accessTo(db, user, c.req.param('id'));
  if (!a || !a.visible) return c.json({ error: 'not found' }, 404);
  if (!a.manage) return c.json({ error: 'only the person who made this program, or an admin, invites people' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const who = str(body.who, 200);
  if (!who) return c.json({ error: 'type their email, @username or friend code' }, 400);
  const target = await personBy(db, who);
  if (target && target.id === user.id) return c.json({ error: 'That is you. Invite someone else.' }, 400);
  const blocked = target ? await blockedEither(db, user.id, target.id) : false;
  if (!target || target.display_name === DELETED_NAME || blocked) return c.json({ error: NOT_FOUND_PERSON }, 404);
  const r = await inviteToProgram(db, a.row, target, { id: user.id, name: nameOf(user) });
  return c.json(r.body, r.code);
});

/**
 * The one invite to a private program, with two callers: its creator or an admin above, and the team's Connect people in Admin
 * (routes/adminConnect.ts). The caller found the person and checked self, nobody and a block. The note names the price, so a place
 * that costs points or money is never bought for anyone: they see it and enrol themselves.
 */
export async function inviteToProgram(
  db: D1Database,
  program: Pick<ProgramRow, 'id' | 'name' | 'price_points' | 'price_cents' | 'currency'> & { vis: ProgramVisibility },
  target: UserRow,
  by: { id: string | null; name: string },
): Promise<{ code: 201 | 400 | 409; body: { ok?: true; invite?: ProgramInvite; error?: string } }> {
  if (program.vis !== 'private') return { code: 400, body: { error: 'Make it private first. Invites are for private programs.' } };
  if (program.id === ADMIN_GUIDE_PROGRAM) return { code: 400, body: { error: ADMIN_GUIDE_STAYS } };
  const count = await db.prepare('SELECT COUNT(*) AS n FROM program_invites WHERE program_id = ?').bind(program.id).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_PROGRAM_INVITES) return { code: 400, body: { error: `A program can have up to ${MAX_PROGRAM_INVITES} people invited.` } };
  const ins = await db.prepare('INSERT OR IGNORE INTO program_invites (program_id, user_id, invited_by, created_at) VALUES (?, ?, ?, ?)').bind(program.id, target.id, by.id, nowIso()).run();
  if (ins.meta.changes !== 1) return { code: 409, body: { error: 'They are already invited.' } };
  const price = [program.price_points > 0 ? `${formatCount(program.price_points)} points` : '', program.price_cents > 0 ? money(program.price_cents, program.currency) : ''].filter(Boolean).join(' or ');
  await notify(db, target.id, 'school', `${by.name} invited you to ${program.name}`, `It is a private program. Open School to see its cohorts and enrol.${price ? ` A place costs ${price}, paid only if you enrol.` : ''}`, '/school#programs-heading');
  await audit(db, by.id, 'program.invite', 'program', program.id, '', target.id);
  const invite: ProgramInvite = { userId: target.id, name: nameOf(target), handle: target.handle ?? '', invitedAt: nowIso() };
  return { code: 201, body: { ok: true, invite } };
}

/** Take an invite back, the one way: its creator or an admin below, and the team's Withdraw in Connect people. Someone who already enrolled keeps their seat. */
export async function uninviteFromProgram(db: D1Database, programId: string, userId: string, actorId: string | null): Promise<boolean> {
  const del = await db.prepare('DELETE FROM program_invites WHERE program_id = ? AND user_id = ?').bind(programId, userId).run();
  if (del.meta.changes !== 1) return false;
  await audit(db, actorId, 'program.uninvite', 'program', programId, userId, '');
  return true;
}

// Taking an invite back. Someone who already enrolled keeps their seat, as with an archived program.
school.delete('/programs/:id/invites/:userId', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const a = await accessTo(db, user, c.req.param('id'));
  if (!a || !a.visible) return c.json({ error: 'not found' }, 404);
  if (!a.manage) return c.json({ error: 'only the person who made this program, or an admin, removes an invite' }, 403);
  if (!(await uninviteFromProgram(db, a.row.id, c.req.param('userId'), user.id))) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

// School's order (migration 0095): an admin moves a program to the top, or one place up or down among the programs in the same state,
// since School lists by state first. Every program is numbered again from 1 in the new order (idempotent writes, fifty to a round trip).
school.post('/programs/:id/move', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const a = await accessTo(db, user, c.req.param('id'));
  if (!a || !a.visible) return c.json({ error: 'not found' }, 404);
  if (!a.admin) return c.json({ error: 'an admin sets the order of School' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const to = oneOf(body.to, ['first', 'up', 'down', ''] as const, '');
  if (!to) return c.json({ error: 'pick first, up or down' }, 400);
  // The neighbour is the one in the view the admin is looking at ("Open to me" unless they say "every"), so a move never swaps a
  // program with one hidden from them and leaves the list they see as it was. The whole table is still numbered again.
  const every = body.view === 'every';
  const [rows, seen] = await Promise.all([viewOrder(db, user.id, true), every ? Promise.resolve(null) : viewOrder(db, user.id, false)]);
  const ids = rows.map((r) => r.id);
  const at = ids.indexOf(a.row.id);
  const shown = seen ? new Set(seen.map((r) => r.id)) : null;
  const same = rows.map((r, i) => (r.vis === a.row.vis && (!shown || shown.has(r.id)) ? i : -1)).filter((i) => i >= 0);
  const k = same.indexOf(at);
  if (k < 0) return c.json({ error: 'not found' }, 404);
  const other = to === 'up' ? same[k - 1] : to === 'down' ? same[k + 1] : same[0];
  if (other === undefined || other === at) return c.json({ error: to === 'down' ? 'It is already last.' : 'It is already first.' }, 400);
  if (to === 'first') {
    ids.splice(at, 1);
    ids.unshift(a.row.id);
  } else [ids[at], ids[other]] = [ids[other]!, ids[at]!];
  await inBatches(db, ids.map((id, i) => db.prepare('UPDATE programs SET sort_position = ? WHERE id = ?').bind(i + 1, id)));
  await audit(db, user.id, 'program.order', 'program', a.row.id, String(at + 1), to);
  return c.json({ ok: true });
});

// Delete for good: only an archived program, by its creator or an admin. Everything under it goes the way an erase would: its cohorts
// with their enrolments, hand-ins, feedback, sessions, attendance and discussion, its lessons, assignments, pictures and invites. The
// points people spent stay in their ledgers.
school.delete('/programs/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const a = await accessTo(db, user, c.req.param('id'));
  if (!a || !a.visible) return c.json({ error: 'not found' }, 404);
  if (!a.manage) return c.json({ error: 'only the person who made this program, or an admin, deletes it' }, 403);
  if (a.row.vis !== 'archived') return c.json({ error: 'Archive it first. Only an archived program can be deleted.' }, 400);
  const id = a.row.id;
  // Every statement is held to the archived state, not only the last: a program un-archived in another tab (or listed again by Admin)
  // between the check above and this batch keeps everything under it. The program row goes last, so its children are gone first.
  const archived = "SELECT id FROM programs WHERE id = ? AND visibility = 'archived' AND published = 0";
  const inCohorts = `SELECT id FROM cohorts WHERE program_id IN (${archived})`;
  const done = await db.batch([
    db.prepare(`DELETE FROM submission_feedback WHERE submission_id IN (SELECT id FROM submissions WHERE cohort_id IN (${inCohorts}))`).bind(id),
    db.prepare(`DELETE FROM submissions WHERE cohort_id IN (${inCohorts})`).bind(id),
    db.prepare(`DELETE FROM attendance WHERE session_id IN (SELECT id FROM cohort_sessions WHERE cohort_id IN (${inCohorts}))`).bind(id),
    db.prepare(`DELETE FROM cohort_sessions WHERE cohort_id IN (${inCohorts})`).bind(id),
    db.prepare(`DELETE FROM cohort_talk WHERE cohort_id IN (${inCohorts})`).bind(id),
    db.prepare(`DELETE FROM cohort_talk_prefs WHERE cohort_id IN (${inCohorts})`).bind(id),
    db.prepare(`DELETE FROM enrollments WHERE cohort_id IN (${inCohorts})`).bind(id),
    db.prepare(`DELETE FROM cohorts WHERE program_id IN (${archived})`).bind(id),
    db.prepare(`DELETE FROM media_items WHERE (owner_type = 'program' AND owner_id IN (${archived.replace('?', '?1')})) OR (owner_type = 'lesson' AND owner_id IN (SELECT id FROM learning_items WHERE program_id IN (${archived.replace('?', '?1')})))`).bind(id),
    db.prepare(`DELETE FROM learning_items WHERE program_id IN (${archived})`).bind(id),
    db.prepare(`DELETE FROM course_assignments WHERE program_id IN (${archived})`).bind(id),
    db.prepare(`DELETE FROM program_invites WHERE program_id IN (${archived})`).bind(id),
    db.prepare("DELETE FROM programs WHERE id = ? AND visibility = 'archived' AND published = 0").bind(id),
  ]);
  if ((done[done.length - 1]?.meta.changes ?? 0) !== 1) return c.json({ error: 'This program is no longer archived, so nothing was deleted.' }, 409);
  await audit(db, user.id, 'program.delete', 'program', id, a.row.name, '');
  return c.json({ ok: true });
});

school.post('/programs/:id/items', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const a = await accessTo(db, user, c.req.param('id'));
  if (!a || !a.visible) return c.json({ error: 'not found' }, 404);
  if (!a.edit) return c.json({ error: 'the people who run this program add lessons' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const title = str(body.moduleTitle, LESSON_TITLE_MAX);
  if (!title) return c.json({ error: 'title required' }, 400);
  const words = typeof body.body === 'string' ? body.body.trim() : '';
  const problem = lessonBodyProblem(words);
  if (problem) return c.json({ error: problem }, 400);
  const asked = str(body.contentRef, 500);
  const firstLink = lessonResourceLink(asked);
  if (asked && !firstLink) return c.json({ error: LINK_REFUSED }, 400);
  const n = await db.prepare('SELECT COALESCE(MAX(sequence), -1) + 1 AS n FROM learning_items WHERE program_id = ?').bind(a.row.id).first<{ n: number }>();
  const id = newId();
  // A link given with a new lesson is its first resource, of the kind it reads as.
  await db.batch([
    db.prepare('INSERT INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES (?, ?, ?, ?, ?, ?, ?, 1)').bind(id, a.row.id, title, oneOf(body.contentType, ['lesson', 'video', 'reading'] as const, 'lesson'), firstLink || null, words, n?.n ?? 0),
    ...(firstLink ? [db.prepare("INSERT INTO lesson_resources (id, item_id, position, kind, ref, label) VALUES (?, ?, 1, ?, ?, '')").bind(newId(), id, lessonResourceKindOf(firstLink), firstLink)] : []),
  ]);
  await audit(db, user.id, 'lesson.add', 'learning_item', id, a.row.id, title);
  return c.json({ ok: true, id }, 201);
});

const LINK_REFUSED = 'Use an https link (a YouTube or Vimeo video, or a file), or a /resources/ file.';

/** A lesson and whether this person may change it: whoever may edit its program (its creator, a manager of one of its cohorts, an
 * admin, or the team with the cohorts permission on a public program). */
async function lessonFor(db: D1Database, user: UserRow, id: string) {
  const item = await db.prepare('SELECT * FROM learning_items WHERE id = ?').bind(id).first<ItemRow>();
  if (!item) return null;
  const a = await accessTo(db, user, item.program_id);
  return { item, edit: Boolean(a?.edit) };
}

// Change a lesson in place, from its card on the cohort page: its title, kind and words. Each part is optional; what is sent is checked
// the way adding a lesson checks it, and it is one `lesson.edit` line that names the parts changed, never the words. `contentRef` is the
// single link a tab of the older app still sends: it changes the lesson's first link. Its resources have routes of their own below.
school.patch('/items/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const found = await lessonFor(db, user, c.req.param('id'));
  if (!found) return c.json({ error: 'not found' }, 404);
  if (!found.edit) return c.json({ error: 'the people who run this program change its lessons' }, 403);
  const item = found.item;
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  let ref = item.content_ref;
  if (body.contentRef !== undefined) {
    ref = lessonResourceLink(body.contentRef);
    if (!ref) return c.json({ error: LINK_REFUSED }, 400);
  }
  let title = item.module_title;
  if (body.moduleTitle !== undefined) {
    title = str(body.moduleTitle, LESSON_TITLE_MAX);
    if (!title) return c.json({ error: 'Give the lesson a title.' }, 400);
  }
  let words = item.body;
  if (body.body !== undefined) {
    if (typeof body.body !== 'string') return c.json({ error: 'The lesson’s words are text.' }, 400);
    words = body.body.trim();
    const problem = lessonBodyProblem(words);
    if (problem) return c.json({ error: problem }, 400);
  }
  const kind = body.contentType !== undefined ? oneOf(body.contentType, ['lesson', 'video', 'reading'] as const, item.content_type) : item.content_type;
  await db.prepare('UPDATE learning_items SET module_title = ?, content_type = ?, content_ref = ?, body = ? WHERE id = ?').bind(title, kind, ref, words, item.id).run();
  if (ref && ref !== item.content_ref) {
    const first = (await resourcesOf(db, item.id)).find((r) => r.kind !== 'book');
    await db.batch([
      first
        ? db.prepare("UPDATE lesson_resources SET kind = ?, ref = ?, label = '' WHERE id = ?").bind(lessonResourceKindOf(ref), ref, first.id)
        : db.prepare("INSERT INTO lesson_resources (id, item_id, position, kind, ref, label) SELECT ?1, ?2, COALESCE(MAX(position), 0) + 1, ?3, ?4, '' FROM lesson_resources WHERE item_id = ?2").bind(newId(), item.id, lessonResourceKindOf(ref), ref),
      keepFirstLink(db, item.id),
    ]);
    await audit(db, user.id, 'lesson.resource', 'learning_item', item.id, item.content_ref ?? '', ref);
  }
  const changed = [title !== item.module_title ? 'title' : '', kind !== item.content_type ? 'kind' : '', words !== item.body ? 'words' : ''].filter(Boolean);
  if (changed.length) await audit(db, user.id, 'lesson.edit', 'learning_item', item.id, item.module_title, changed.join(', '));
  return c.json({ ok: true, contentRef: ref, moduleTitle: title, contentType: kind, body: words });
});

/** One lesson's resources in their order, as stored. */
const resourcesOf = async (db: D1Database, itemId: string) => (await db.prepare('SELECT id, kind, ref, label FROM lesson_resources WHERE item_id = ? ORDER BY position, id').bind(itemId).all<ResourceRow>()).results;
/** `content_ref` stays a true copy of the lesson's first link (a book has none), in the same batch as the change, so a tab of the older app reads what is there. */
const keepFirstLink = (db: D1Database, itemId: string) => db.prepare("UPDATE learning_items SET content_ref = (SELECT ref FROM lesson_resources WHERE item_id = ?1 AND kind != 'book' ORDER BY position, id LIMIT 1) WHERE id = ?1").bind(itemId);
/** A resource in the audit line: what it is, never more than the person typed. */
const resourceLine = (r: { kind: string; ref: string; label: string }) => `${r.kind}: ${r.ref}${r.label ? ` (${r.label})` : ''}`;

// A lesson's resources, for whoever may edit its program: add one, change one, move one up or down, remove one. Each write is one
// batch with the first-link copy, and one `lesson.resource` line.
school.post('/items/:id/resources', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const found = await lessonFor(db, user, c.req.param('id'));
  if (!found) return c.json({ error: 'not found' }, 404);
  if (!found.edit) return c.json({ error: 'the people who run this program change its lessons' }, 403);
  const { resources, problem } = parseLessonResources([await objectBody(c)]);
  const next = resources[0];
  if (!next) return c.json({ error: problem ?? 'Pick what kind of resource this is.' }, 400);
  const now = await resourcesOf(db, found.item.id);
  if (now.length >= MAX_LESSON_RESOURCES) return c.json({ error: LESSON_RESOURCES_FULL }, 400);
  if (now.some((r) => r.kind === next.kind && r.ref === next.ref)) return c.json({ error: LESSON_RESOURCE_REPEAT }, 400);
  const id = newId();
  // The most a lesson holds and the no-repeat rule are checked again inside the insert, so two taps at once cannot pass them both.
  const [added] = await db.batch([
    db
      .prepare(
        `INSERT INTO lesson_resources (id, item_id, position, kind, ref, label)
         SELECT ?1, ?2, COALESCE(MAX(position), 0) + 1, ?3, ?4, ?5 FROM lesson_resources WHERE item_id = ?2
         HAVING COUNT(*) < ?6 AND COALESCE(SUM(kind = ?3 AND ref = ?4), 0) = 0`,
      )
      .bind(id, found.item.id, next.kind, next.ref, next.label, MAX_LESSON_RESOURCES),
    keepFirstLink(db, found.item.id),
  ]);
  if (added?.meta.changes !== 1) return c.json({ error: LESSON_RESOURCE_REPEAT }, 409);
  await audit(db, user.id, 'lesson.resource', 'learning_item', found.item.id, '', resourceLine(next));
  return c.json({ ok: true, id }, 201);
});

// Change one in place. What is not sent stays as it was; the whole row is read again by the one reader.
school.patch('/items/:id/resources/:resourceId', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const found = await lessonFor(db, user, c.req.param('id'));
  if (!found) return c.json({ error: 'not found' }, 404);
  if (!found.edit) return c.json({ error: 'the people who run this program change its lessons' }, 403);
  const now = await resourcesOf(db, found.item.id);
  const row = now.find((r) => r.id === c.req.param('resourceId'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await objectBody(c);
  const { resources, problem } = parseLessonResources([{ kind: body.kind ?? row.kind, ref: body.ref ?? row.ref, label: body.label ?? row.label }]);
  const next = resources[0];
  if (!next) return c.json({ error: problem ?? 'Pick what kind of resource this is.' }, 400);
  if (now.some((r) => r.id !== row.id && r.kind === next.kind && r.ref === next.ref)) return c.json({ error: LESSON_RESOURCE_REPEAT }, 400);
  await db.batch([db.prepare('UPDATE lesson_resources SET kind = ?, ref = ?, label = ? WHERE id = ? AND item_id = ?').bind(next.kind, next.ref, next.label, row.id, found.item.id), keepFirstLink(db, found.item.id)]);
  await audit(db, user.id, 'lesson.resource', 'learning_item', found.item.id, resourceLine(row), resourceLine(next));
  return c.json({ ok: true });
});

// Move one a place up or down: the list is numbered again from 1 in the new order.
school.post('/items/:id/resources/:resourceId/move', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const found = await lessonFor(db, user, c.req.param('id'));
  if (!found) return c.json({ error: 'not found' }, 404);
  if (!found.edit) return c.json({ error: 'the people who run this program change its lessons' }, 403);
  const now = await resourcesOf(db, found.item.id);
  const at = now.findIndex((r) => r.id === c.req.param('resourceId'));
  if (at < 0) return c.json({ error: 'not found' }, 404);
  const to = oneOf((await objectBody(c)).to, ['up', 'down', ''] as const, '');
  if (!to) return c.json({ error: 'pick up or down' }, 400);
  const other = to === 'up' ? at - 1 : at + 1;
  if (other < 0 || other >= now.length) return c.json({ error: to === 'up' ? 'It is already first.' : 'It is already last.' }, 400);
  const order = now.map((r) => r.id);
  [order[at], order[other]] = [order[other]!, order[at]!];
  await db.batch([...order.map((id, i) => db.prepare('UPDATE lesson_resources SET position = ? WHERE id = ? AND item_id = ?').bind(i + 1, id, found.item.id)), keepFirstLink(db, found.item.id)]);
  await audit(db, user.id, 'lesson.resource', 'learning_item', found.item.id, `${resourceLine(now[at]!)}, place ${at + 1}`, `place ${other + 1}`);
  return c.json({ ok: true });
});

// Remove one (the screen asks for a second tap). A book lesson left with none shows The book again.
school.delete('/items/:id/resources/:resourceId', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const found = await lessonFor(db, user, c.req.param('id'));
  if (!found) return c.json({ error: 'not found' }, 404);
  if (!found.edit) return c.json({ error: 'the people who run this program change its lessons' }, 403);
  const row = (await resourcesOf(db, found.item.id)).find((r) => r.id === c.req.param('resourceId'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const [gone] = await db.batch([db.prepare('DELETE FROM lesson_resources WHERE id = ? AND item_id = ?').bind(row.id, found.item.id), keepFirstLink(db, found.item.id)]);
  if (gone?.meta.changes !== 1) return c.json({ error: 'not found' }, 404);
  await audit(db, user.id, 'lesson.resource', 'learning_item', found.item.id, resourceLine(row), '');
  return c.json({ ok: true });
});

// Move a lesson one place up or down. The two lessons trade places and the numbers they held, so the gaps a builder left (the guides
// number their files 01, 02, 05) stay; lessons that share a number are numbered again from 1.
school.post('/items/:id/move', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const found = await lessonFor(db, user, c.req.param('id'));
  if (!found) return c.json({ error: 'not found' }, 404);
  if (!found.edit) return c.json({ error: 'the people who run this program change its lessons' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const to = oneOf(body.to, ['up', 'down', ''] as const, '');
  if (!to) return c.json({ error: 'pick up or down' }, 400);
  const rows = (await db.prepare('SELECT id, sequence FROM learning_items WHERE program_id = ? ORDER BY sequence, id').bind(found.item.program_id).all<{ id: string; sequence: number }>()).results;
  const at = rows.findIndex((r) => r.id === found.item.id);
  const other = to === 'up' ? at - 1 : at + 1;
  if (at < 0 || other < 0 || other >= rows.length) return c.json({ error: to === 'up' ? 'It is already the first lesson.' : 'It is already the last lesson.' }, 400);
  const numbers = rows.map((r) => r.sequence);
  const distinct = new Set(numbers).size === numbers.length;
  const order = rows.map((r) => r.id);
  [order[at], order[other]] = [order[other]!, order[at]!];
  const next = order.map((id, i) => ({ id, sequence: distinct ? numbers[i]! : i + 1 }));
  const writes = next.filter((n) => rows.find((r) => r.id === n.id)?.sequence !== n.sequence);
  await inBatches(db, writes.map((n) => db.prepare('UPDATE learning_items SET sequence = ? WHERE id = ?').bind(n.sequence, n.id)));
  await audit(db, user.id, 'lesson.order', 'learning_item', found.item.id, String(at + 1), String(other + 1));
  return c.json({ ok: true });
});

// Remove a lesson (the screen asks first in a sheet with a red yes). Its pictures and videos go with it; hand-ins belong to
// assignments, not lessons, so nothing a learner sent is touched.
school.delete('/items/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const found = await lessonFor(db, user, c.req.param('id'));
  if (!found) return c.json({ error: 'not found' }, 404);
  if (!found.edit) return c.json({ error: 'the people who run this program change its lessons' }, 403);
  const done = await db.batch([
    db.prepare("DELETE FROM media_items WHERE owner_type = 'lesson' AND owner_id = ?").bind(found.item.id),
    db.prepare('DELETE FROM learning_items WHERE id = ?').bind(found.item.id),
  ]);
  if ((done[1]?.meta.changes ?? 0) !== 1) return c.json({ error: 'not found' }, 404);
  await audit(db, user.id, 'lesson.delete', 'learning_item', found.item.id, found.item.module_title, '');
  return c.json({ ok: true });
});

school.post('/programs/:id/assignments', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const a = await accessTo(db, user, c.req.param('id'));
  if (!a || !a.visible) return c.json({ error: 'not found' }, 404);
  if (!a.edit) return c.json({ error: 'the people who run this program add assignments' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const title = str(body.title, 140);
  if (!title) return c.json({ error: 'title required' }, 400);
  const n = await db.prepare('SELECT COALESCE(MAX(sequence), -1) + 1 AS n FROM course_assignments WHERE program_id = ?').bind(c.req.param('id')).first<{ n: number }>();
  await db.prepare('INSERT INTO course_assignments (id, program_id, title, instructions, rubric, due_days, sequence) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId(), c.req.param('id'), title, str(body.instructions, 5000), str(body.rubric, 2000), num(body.dueDays, 7, 1, 365) ?? 7, n?.n ?? 0).run();
  return c.json({ ok: true }, 201);
});

school.post('/programs/:id/cohorts', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const a = await accessTo(db, user, c.req.param('id'));
  if (!a || !a.visible) return c.json({ error: 'not found' }, 404);
  if (!a.edit) return c.json({ error: 'the people who run this program open cohorts' }, 403);
  if (a.row.vis === 'archived') return c.json({ error: 'This program is archived. Change its state before opening a cohort.' }, 400);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const name = str(body.name, 80);
  const startAt = str(body.startAt, 40);
  const endAt = str(body.endAt, 40);
  if (!name || !startAt || !endAt) return c.json({ error: 'name, start and end' }, 400);
  const id = newId();
  await db.prepare("INSERT INTO cohorts (id, program_id, name, start_at, end_at, capacity, status, manager_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, 'upcoming', ?, ?)").bind(id, c.req.param('id'), name, startAt, endAt, num(body.capacity, 50, 1, 1000) ?? 50, user.id, nowIso()).run();
  return c.json({ ok: true, id }, 201);
});

/**
 * Who may name a cohort's manager (2026-11-10, the founder: "the team can change a cohort's manager"): an admin on any program, and staff
 * holding Cohorts on a public one, the same reach Cohorts has over a program's lessons and cohorts (accessTo's `edit`). The Admin guide
 * stays with admins: its manager would open it to someone who is not one.
 */
export const mayNameManager = (user: UserRow, vis: ProgramVisibility, cohortId: string) =>
  cohortId !== ADMIN_GUIDE_COHORT && (isAdmin(user) || (user.role === 'sub_admin' && can(user, 'cohorts') && vis === 'public'));

type Named = { code: 200; from: string | null; cohort: string } | { code: 400 | 403 | 404 | 409; error: string };

/**
 * Name who runs a cohort, or nobody. One action, two callers: PATCH /school/cohorts/:id/manager on the cohort page and Admin (or Manage),
 * Connect people. A manager today is whoever opened the cohort (someone who runs the program), so the one named is staff, an admin, or a
 * creator with a full account (an email and setup done), never a deleted member or an account kept only on a device. A block either way with the
 * program's creator reads as nobody. Guarded on the manager it read, so two changes at once make one; the new and the old are told.
 */
export async function setCohortManager(db: D1Database, actor: UserRow | null, cohortId: string, person: UserRow | null, from?: string | null): Promise<Named> {
  const k = await db
    .prepare(`SELECT k.id, k.name, k.manager_user_id, p.name AS program, p.created_by, ${VIS} AS vis FROM cohorts k JOIN programs p ON p.id = k.program_id WHERE k.id = ?`)
    .bind(cohortId)
    .first<{ id: string; name: string; manager_user_id: string | null; program: string; created_by: string | null; vis: ProgramVisibility }>();
  if (!k) return { code: 404, error: 'not found' };
  if (actor && !mayNameManager(actor, k.vis, k.id)) return { code: 403, error: 'Admins, and staff with Cohorts on a public program, name a cohort’s manager.' };
  if (!actor && k.id === ADMIN_GUIDE_COHORT) return { code: 403, error: 'The Admin guide stays with admins.' };
  if (from !== undefined && from !== k.manager_user_id) return { code: 409, error: 'Someone changed it a moment ago. Read it again.' };
  if (person) {
    if (person.display_name === DELETED_NAME) return { code: 404, error: NOT_FOUND_PERSON };
    // Staff and admins always may; a creator needs a full account. A device-only account could vanish with its device.
    if (person.role === 'user' && (!person.email || !person.onboarded_at)) return { code: 400, error: 'They need a full account first: an email and setup done.' };
    if (k.created_by && k.created_by !== person.id && (await blockedEither(db, k.created_by, person.id))) return { code: 404, error: NOT_FOUND_PERSON };
    if (k.manager_user_id === person.id) return { code: 409, error: 'They run this cohort already.' };
  } else if (!k.manager_user_id) return { code: 409, error: 'Nobody runs this cohort now.' };
  const res = await db.prepare('UPDATE cohorts SET manager_user_id = ? WHERE id = ? AND manager_user_id IS ?').bind(person?.id ?? null, k.id, k.manager_user_id).run();
  if (!res.meta.changes) return { code: 409, error: 'Someone changed it a moment ago. Read it again.' };
  const where = `${k.program}, ${k.name}`;
  // note-link: /school/:id
  if (person) await notify(db, person.id, 'school', `You run ${where} now`, 'The team named you its manager: sessions, hand-ins and completion are yours.', `/school/${k.id}`);
  // note-link: /school/:id
  if (k.manager_user_id) await notify(db, k.manager_user_id, 'school', `You no longer run ${where}`, person ? `The team named ${nameOf(person)} instead.` : 'The team took the manager off for now.', `/school/${k.id}`);
  await audit(db, actor?.id ?? null, 'cohort.manager', 'cohort', k.id, k.manager_user_id ?? '', person?.id ?? '');
  return { code: 200, from: k.manager_user_id, cohort: where };
}

school.patch('/cohorts/:id/manager', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await objectBody(c);
  if (typeof body.userId !== 'string' || !body.userId.trim()) return c.json({ error: 'Pick who runs it.' }, 400);
  const person = await db.prepare('SELECT * FROM users WHERE id = ?').bind(body.userId.trim()).first<UserRow>();
  if (!person) return c.json({ error: NOT_FOUND_PERSON }, 404);
  // `from`, when sent, is the manager the page showed (null for none): a change someone else made since answers 409 instead of
  // being written over (2026-11-10, the break-it check: two staff on the same page each wrote, one after the other).
  const from = body.from === undefined ? undefined : typeof body.from === 'string' ? body.from : null;
  const r = await setCohortManager(db, user, c.req.param('id'), person, from);
  if (r.code !== 200) return c.json({ error: r.error }, r.code);
  return c.json({ ok: true, managerId: person.id, managerName: nameOf(person) });
});

// Enrol: capacity is checked and the seat taken in one statement.
school.post('/cohorts/:id/enroll', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const k = await db.prepare(`${COHORT_SELECT} WHERE k.id = ?`).bind(c.req.param('id')).first<CohortRow & { price_points?: number }>();
  if (!k) return c.json({ error: 'not found' }, 404);
  // Enrolling needs a program the person can see (public, or private and invited, or one they run) that is not archived.
  const a = await accessTo(db, user, k.program_id);
  if (!a || !a.visible) return c.json({ error: 'not found' }, 404);
  if (!a.enrolOpen) return c.json({ error: 'This program is archived, so it takes no one new.' }, 400);
  const prog = a.row;
  if (k.status === 'finished' || k.status === 'cancelled') return c.json({ error: 'this cohort is closed' }, 400);
  const body = await c.req.json<{ pay?: string; discountCode?: string }>().catch(() => ({}) as { pay?: string; discountCode?: string });
  // Test mode is for a program with a money price; a program priced in points always takes the points.
  const pay = body.pay === 'test' && prog.price_cents > 0 && prog.price_points === 0 ? 'test' : prog.price_points > 0 ? 'points' : 'free';
  // A code from the team: the price is worked out here from the program's own price, for the way the person pays. The platform pays what it takes off.
  let discount: Extract<Quoted, { ok: true }> | null = null;
  let owe = pay === 'points' ? prog.price_points : 0;
  let payment: string = pay === 'points' ? 'paid' : pay;
  if (typeof body.discountCode === 'string' && body.discountCode.trim()) {
    if (pay === 'free') return c.json({ error: 'This program costs nothing, so there is nothing to take off.' }, 400);
    const q = await quoteCode(db, user.id, body.discountCode, 'program', k.program_id, pay === 'points' ? { cents: 0, points: prog.price_points, currency: prog.currency } : { cents: prog.price_cents, points: 0, currency: prog.currency });
    if (!q.ok) return c.json({ error: q.why }, 400);
    discount = q;
    if (pay === 'points') owe = q.quote.payPoints;
    else if (q.quote.payCents === 0) payment = 'free';
  }
  if (owe > 0 && user.points < owe) return c.json({ error: `you need ${owe - user.points} more points` }, 400);
  const id = newId();
  const now = nowIso();
  if (discount) {
    const why = await redeem(db, { row: discount.row, userId: user.id, area: 'program', itemId: k.program_id, ref: id, offCents: discount.quote.offCents, offPoints: discount.quote.offPoints, currency: prog.currency });
    if (why) return c.json({ error: why }, 409);
  }
  // The points leave first, with a guarded update, so two taps at once cannot spend the same points twice.
  if (owe > 0) {
    const debit = await db.prepare('UPDATE users SET points = points - ? WHERE id = ? AND points >= ?').bind(owe, user.id, owe).run();
    if (debit.meta.changes !== 1) {
      if (discount) await release(db, id);
      return c.json({ error: `you need ${owe - user.points} more points` }, 400);
    }
  }
  // One statement takes the seat: it only inserts while a seat is free and the learner is not already in.
  const ins = await db
    .prepare(
      `INSERT INTO enrollments (id, cohort_id, learner_user_id, status, payment_status, enrolled_at, completed_at)
       SELECT ?1, ?2, ?3, 'enrolled', ?4, ?5, NULL
       WHERE (SELECT COUNT(*) FROM enrollments WHERE cohort_id = ?2 AND status != 'withdrawn') < (SELECT capacity FROM cohorts WHERE id = ?2)
         AND NOT EXISTS (SELECT 1 FROM enrollments WHERE cohort_id = ?2 AND learner_user_id = ?3)`,
    )
    .bind(id, k.id, user.id, payment, now)
    .run();
  if (ins.meta.changes !== 1) {
    if (owe > 0) await db.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(owe, user.id).run();
    if (discount) await release(db, id);
    return c.json({ error: 'full, or you are already in' }, 409);
  }
  if (owe > 0) await db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(user.id, -owe, 'enrollment', id, now).run();
  if (k.manager_user_id) await notify(db, k.manager_user_id, 'school', `${nameOf(user)} joined ${k.name}`, '', `/school/${k.id}`);
  // A program invite the team made (Admin, Connect people) came true when they joined a cohort of it.
  await connectionsCameTrue(db, 'program', { refId: k.program_id, userId: user.id });
  return c.json({ ok: true, id }, 201);
});

interface ItemRow { id: string; program_id: string; module_title: string; content_type: LearningItem['contentType']; content_ref: string | null; body: string; sequence: number; published: number }
interface ResourceRow { id: string; kind: string; ref: string; label: string }
interface AssignRow { id: string; program_id: string; title: string; instructions: string; rubric: string; due_days: number; sequence: number }
interface SubRow { id: string; assignment_id: string; cohort_id: string; learner_user_id: string; learner_name: string; url: string | null; text: string; status: Submission['status']; submitted_at: string }
interface FbRow { id: string; submission_id: string; reviewer_name: string; comment: string; grade: string | null; created_at: string }
interface SessionRow { id: string; cohort_id: string; title: string; starts_at: string; ends_at: string; online_url: string | null }

school.get('/cohorts/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const k = await db.prepare(`${COHORT_SELECT} WHERE k.id = ?`).bind(c.req.param('id')).first<CohortRow>();
  if (!k) return c.json({ error: 'not found' }, 404);
  // People enrolled keep their cohort whatever the program's state; the rest need to run it, or to mentor a program they can see.
  const role = await cohortRole(db, user, k.id);
  const manager = role?.manager ?? false;
  const mentor = role?.mentor ?? false;
  const enrolled = await db.prepare('SELECT 1 FROM enrollments WHERE cohort_id = ? AND learner_user_id = ? AND status != \'withdrawn\'').bind(k.id, user.id).first();
  if (!enrolled && !mentor) return role?.access.visible ? c.json({ error: 'you are not in this cohort' }, 403) : c.json({ error: 'not found' }, 404);
  // Learners, for whoever runs it, a page at a time (prefix `l`, ten by default, 2026-11-07): a cohort open all year can hold thousands.
  // Each row's progress is counted in the same statement, so a page never reads every hand-in to work it out.
  const lAsk = pageOf(c, 'l', TEN_A_PAGE);
  const [items, resourceRows, assigns, subs, fbs, sessions, att, enrolls, learnerCount] = await Promise.all([
    db.prepare('SELECT * FROM learning_items WHERE program_id = ? AND published = 1 ORDER BY sequence').bind(k.program_id).all<ItemRow>(),
    db.prepare('SELECT r.item_id, r.id, r.kind, r.ref, r.label FROM lesson_resources r JOIN learning_items i ON i.id = r.item_id WHERE i.program_id = ? AND i.published = 1 ORDER BY r.item_id, r.position, r.id').bind(k.program_id).all<ResourceRow & { item_id: string }>(),
    db.prepare('SELECT * FROM course_assignments WHERE program_id = ? ORDER BY sequence').bind(k.program_id).all<AssignRow>(),
    mentor
      ? db.prepare('SELECT s.*, u.display_name AS learner_name FROM submissions s JOIN users u ON u.id = s.learner_user_id WHERE s.cohort_id = ? ORDER BY s.submitted_at DESC').bind(k.id).all<SubRow>()
      : db.prepare('SELECT s.*, u.display_name AS learner_name FROM submissions s JOIN users u ON u.id = s.learner_user_id WHERE s.cohort_id = ? AND s.learner_user_id = ?').bind(k.id, user.id).all<SubRow>(),
    // A learner reads only the feedback on their own hand-ins and their own attendance; the whole cohort's is for whoever runs it.
    mentor
      ? db.prepare('SELECT f.*, u.display_name AS reviewer_name FROM submission_feedback f JOIN users u ON u.id = f.reviewer_user_id WHERE f.submission_id IN (SELECT id FROM submissions WHERE cohort_id = ?) ORDER BY f.created_at').bind(k.id).all<FbRow>()
      : db.prepare('SELECT f.*, u.display_name AS reviewer_name FROM submission_feedback f JOIN users u ON u.id = f.reviewer_user_id WHERE f.submission_id IN (SELECT id FROM submissions WHERE cohort_id = ? AND learner_user_id = ?) ORDER BY f.created_at').bind(k.id, user.id).all<FbRow>(),
    db.prepare('SELECT * FROM cohort_sessions WHERE cohort_id = ? ORDER BY starts_at').bind(k.id).all<SessionRow>(),
    db
      .prepare(`SELECT a.session_id, a.user_id, a.status, u.display_name FROM attendance a JOIN users u ON u.id = a.user_id WHERE a.session_id IN (SELECT id FROM cohort_sessions WHERE cohort_id = ?)${mentor ? '' : ' AND a.user_id = ?'}`)
      .bind(...(mentor ? [k.id] : [k.id, user.id]))
      .all<{ session_id: string; user_id: string; status: string; display_name: string }>(),
    mentor
      ? db
          .prepare(
            `SELECT e.*, u.display_name AS learner_name,
               (SELECT COUNT(*) FROM submissions s WHERE s.cohort_id = e.cohort_id AND s.learner_user_id = e.learner_user_id AND s.status = 'approved') AS approved,
               (SELECT COUNT(*) FROM attendance a JOIN cohort_sessions cs ON cs.id = a.session_id WHERE cs.cohort_id = e.cohort_id AND a.user_id = e.learner_user_id) AS attended
             FROM enrollments e JOIN users u ON u.id = e.learner_user_id WHERE e.cohort_id = ? AND e.status != 'withdrawn' ORDER BY e.enrolled_at, e.id LIMIT ? OFFSET ?`,
          )
          .bind(k.id, lAsk.limit, lAsk.offset)
          .all<{ id: string; cohort_id: string; learner_user_id: string; learner_name: string; status: Enrollment['status']; payment_status: Enrollment['paymentStatus']; enrolled_at: string; completed_at: string | null; approved: number; attended: number }>()
      : Promise.resolve({ results: [] }),
    mentor ? db.prepare("SELECT COUNT(*) AS n FROM enrollments WHERE cohort_id = ? AND status != 'withdrawn'").bind(k.id).first<{ n: number }>() : Promise.resolve(null),
  ]);
  const learners = paged(enrolls.results, lAsk);
  const resourcesByItem = new Map<string, ResourceRow[]>();
  for (const r of resourceRows.results) resourcesByItem.set(r.item_id, [...(resourcesByItem.get(r.item_id) ?? []), r]);
  const visibleSubs = subs.results.filter((s) => mentor || s.learner_user_id === user.id);
  const submissions: Submission[] = visibleSubs.map((s) => ({ id: s.id, assignmentId: s.assignment_id, cohortId: s.cohort_id, learnerId: s.learner_user_id, learnerName: nameOf({ display_name: s.learner_name }), url: s.url, text: s.text, status: s.status, submittedAt: s.submitted_at, feedback: fbs.results.filter((f) => f.submission_id === s.id).map((f) => ({ id: f.id, reviewerName: nameOf({ display_name: f.reviewer_name }), comment: f.comment, grade: f.grade, createdAt: f.created_at })) }));
  const sess: CohortSession[] = sessions.results.map((s) => ({ id: s.id, cohortId: s.cohort_id, title: s.title, startsAt: s.starts_at, endsAt: s.ends_at, onlineUrl: s.online_url, attended: att.results.some((a) => a.session_id === s.id && a.user_id === user.id), attendance: mentor ? att.results.filter((a) => a.session_id === s.id).map((a) => ({ userId: a.user_id, name: nameOf(a), status: a.status })) : undefined }));
  const progressFor = (learnerId: string) => ({
    assignmentsApproved: subs.results.filter((s) => s.learner_user_id === learnerId && s.status === 'approved').length,
    assignmentsTotal: assigns.results.length,
    sessionsAttended: att.results.filter((a) => a.user_id === learnerId).length,
    sessionsTotal: sessions.results.length,
  });
  const enrollments: Enrollment[] = learners.items.map((e) => ({ id: e.id, cohortId: e.cohort_id, learnerId: e.learner_user_id, learnerName: nameOf({ display_name: e.learner_name }), status: e.status, paymentStatus: e.payment_status, enrolledAt: e.enrolled_at, completedAt: e.completed_at, progress: { assignmentsApproved: e.approved, assignmentsTotal: assigns.results.length, sessionsAttended: e.attended, sessionsTotal: sessions.results.length } }));
  const me = await db.prepare('SELECT * FROM enrollments WHERE cohort_id = ? AND learner_user_id = ?').bind(k.id, user.id).first<{ status: Enrollment['status']; completed_at: string | null }>();
  return c.json({
    cohort: toCohort(k),
    items: items.results.map((i): LearningItem => ({ id: i.id, programId: i.program_id, moduleTitle: i.module_title, contentType: i.content_type, contentRef: i.content_ref, resources: storedLessonResources(resourcesByItem.get(i.id) ?? []), body: i.body, sequence: i.sequence, published: i.published === 1 })),
    assignments: assigns.results.map((a): CourseAssignment => ({ id: a.id, programId: a.program_id, title: a.title, instructions: a.instructions, rubric: a.rubric, dueDays: a.due_days, sequence: a.sequence })),
    submissions,
    sessions: sess,
    enrollments,
    learnersPage: mentor ? learners.page : null,
    learnerCount: learnerCount?.n ?? 0,
    manager,
    mentor,
    // The team's control on the page: who may name its manager (mayNameManager), read with the same rule the route checks.
    canSetManager: role ? mayNameManager(user, role.access.row.vis, k.id) : false,
    myProgress: enrolled ? progressFor(user.id) : null,
    myStatus: me?.status ?? null,
  });
});

school.post('/assignments/:id/submit', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  if (badLink(body.url)) return c.json({ error: LINK_PROBLEM }, 400);
  const cohortId = str(body.cohortId, 64);
  const a = await db.prepare('SELECT a.*, k.manager_user_id FROM course_assignments a JOIN cohorts k ON k.program_id = a.program_id WHERE a.id = ? AND k.id = ?').bind(c.req.param('id'), cohortId).first<AssignRow & { manager_user_id: string | null }>();
  if (!a) return c.json({ error: 'not found' }, 404);
  const enrolled = await db.prepare("SELECT 1 FROM enrollments WHERE cohort_id = ? AND learner_user_id = ? AND status = 'enrolled'").bind(cohortId, user.id).first();
  if (!enrolled) return c.json({ error: 'you are not in this cohort' }, 403);
  const url = httpUrl(body.url) || null;
  const text = str(body.text, 5000);
  if (!url && !text) return c.json({ error: 'a link or some text' }, 400);
  const now = nowIso();
  await db.prepare("INSERT INTO submissions (id, assignment_id, cohort_id, learner_user_id, url, text, status, submitted_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?, ?) ON CONFLICT(assignment_id, cohort_id, learner_user_id) DO UPDATE SET url = excluded.url, text = excluded.text, status = 'submitted', updated_at = excluded.updated_at")
    .bind(newId(), a.id, cohortId, user.id, url, text, now, now)
    .run();
  if (a.manager_user_id) await notify(db, a.manager_user_id, 'school', `${nameOf(user)} submitted ${a.title}`, '', `/school/${cohortId}`);
  return c.json({ ok: true }, 201);
});

school.post('/submissions/:id/feedback', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const s = await db.prepare('SELECT s.*, a.title FROM submissions s JOIN course_assignments a ON a.id = s.assignment_id WHERE s.id = ?').bind(c.req.param('id')).first<SubRow & { title: string }>();
  if (!s) return c.json({ error: 'not found' }, 404);
  if (!(await cohortRole(db, user, s.cohort_id))?.mentor) return c.json({ error: 'mentors and cohort managers give feedback' }, 403);
  if (s.learner_user_id === user.id) return c.json({ error: 'someone else reviews your own hand-in' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const comment = str(body.comment, 3000);
  const status = oneOf(body.status, ['approved', 'changes'] as const, 'changes');
  if (!comment) return c.json({ error: 'say something useful' }, 400);
  await db.batch([
    db.prepare('INSERT INTO submission_feedback (id, submission_id, reviewer_user_id, comment, grade, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId(), s.id, user.id, comment, str(body.grade, 20) || null, nowIso()),
    db.prepare('UPDATE submissions SET status = ?, updated_at = ? WHERE id = ?').bind(status, nowIso(), s.id),
  ]);
  await notify(db, s.learner_user_id, 'school', `${status === 'approved' ? 'Approved' : 'Feedback on'}: ${s.title}`, comment.slice(0, 160), `/school/${s.cohort_id}`);
  return c.json({ ok: true });
});

school.post('/cohorts/:id/sessions', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (!(await cohortRole(db, user, c.req.param('id')))?.manager) return c.json({ error: 'the cohort manager schedules sessions' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const title = str(body.title, 120);
  const startsAt = str(body.startsAt, 40);
  if (!title || !startsAt) return c.json({ error: 'title and a start time' }, 400);
  const start = new Date(startsAt);
  await db.prepare('INSERT INTO cohort_sessions (id, cohort_id, title, starts_at, ends_at, online_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId(), c.req.param('id'), title, start.toISOString(), new Date(start.getTime() + (num(body.minutes, 60, 15, 600) ?? 60) * 60_000).toISOString(), httpUrl(body.onlineUrl, 500) || null, nowIso()).run();
  return c.json({ ok: true }, 201);
});

// Learners check themselves in while the session is live; managers can mark anyone.
school.post('/sessions/:id/attendance', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const s = await db.prepare('SELECT * FROM cohort_sessions WHERE id = ?').bind(c.req.param('id')).first<SessionRow>();
  if (!s) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ userId?: string }>().catch(() => ({}) as { userId?: string });
  const manager = (await cohortRole(db, user, s.cohort_id))?.manager ?? false;
  const target = manager && typeof body.userId === 'string' ? body.userId : user.id;
  if (!manager) {
    const open = Date.now() >= new Date(s.starts_at).getTime() - 15 * 60_000 && Date.now() <= new Date(s.ends_at).getTime() + 60 * 60_000;
    if (!open) return c.json({ error: 'check-in opens fifteen minutes before the session' }, 400);
    const enrolled = await db.prepare("SELECT 1 FROM enrollments WHERE cohort_id = ? AND learner_user_id = ? AND status = 'enrolled'").bind(s.cohort_id, user.id).first();
    if (!enrolled) return c.json({ error: 'you are not in this cohort' }, 403);
  }
  await db.prepare("INSERT OR IGNORE INTO attendance (session_id, user_id, status, checked_in_at) VALUES (?, ?, 'present', ?)").bind(s.id, target, nowIso()).run();
  return c.json({ ok: true });
});

// Completion is a decision against the criteria, not a timer running out.
school.post('/enrollments/:id/complete', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const e = await db.prepare('SELECT e.*, k.program_id FROM enrollments e JOIN cohorts k ON k.id = e.cohort_id WHERE e.id = ?').bind(c.req.param('id')).first<{ id: string; cohort_id: string; learner_user_id: string; program_id: string }>();
  if (!e) return c.json({ error: 'not found' }, 404);
  if (!(await cohortRole(db, user, e.cohort_id))?.manager) return c.json({ error: 'the cohort manager marks completion' }, 403);
  const [total, approved] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS n FROM course_assignments WHERE program_id = ?').bind(e.program_id).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM submissions WHERE cohort_id = ? AND learner_user_id = ? AND status = 'approved'").bind(e.cohort_id, e.learner_user_id).first<{ n: number }>(),
  ]);
  if ((approved?.n ?? 0) < (total?.n ?? 0)) return c.json({ error: `${(total?.n ?? 0) - (approved?.n ?? 0)} assignments still need approval` }, 400);
  await db.prepare("UPDATE enrollments SET status = 'completed', completed_at = ? WHERE id = ?").bind(nowIso(), e.id).run();
  await audit(db, user.id, 'enrollment.complete', 'enrollment', e.id, '', e.learner_user_id);
  await notify(db, e.learner_user_id, 'school', 'You completed the program', 'Work has opportunities that fit what you just learned.', '/work');
  return c.json({ ok: true });
});
