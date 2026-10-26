import { Hono } from 'hono';
import type { Cohort, CohortSession, CourseAssignment, Enrollment, LearningItem, Program, Submission } from '@kreators/shared';
import type { AppEnv } from '../env';
import { audit, can, nameOf, newId, notify, nowIso, num, oneOf, str, pageOf, paged } from '../db';

export const school = new Hono<AppEnv>();

interface ProgramRow { id: string; name: string; description: string; price_points: number; price_cents: number; currency: string; delivery_mode: Program['deliveryMode']; published: number; outcomes: string; prerequisites: string; created_at: string }
interface CohortRow { id: string; program_id: string; program_name: string; name: string; start_at: string; end_at: string; capacity: number; enrolled: number; status: Cohort['status']; manager_user_id: string | null; manager_name: string | null }
const COHORT_SELECT = `SELECT k.*, p.name AS program_name, u.display_name AS manager_name, (SELECT COUNT(*) FROM enrollments e WHERE e.cohort_id = k.id AND e.status != 'withdrawn') AS enrolled FROM cohorts k JOIN programs p ON p.id = k.program_id LEFT JOIN users u ON u.id = k.manager_user_id`;
const toCohort = (r: CohortRow): Cohort => ({ id: r.id, programId: r.program_id, programName: r.program_name, name: r.name, startAt: r.start_at, endAt: r.end_at, capacity: r.capacity, enrolled: r.enrolled, status: r.status, managerId: r.manager_user_id, managerName: r.manager_name ? nameOf({ display_name: r.manager_name }) : 'Unassigned' });

async function isManager(db: D1Database, userId: string, cohortId: string): Promise<boolean> {
  return Boolean(await db.prepare('SELECT 1 FROM cohorts WHERE id = ? AND manager_user_id = ?').bind(cohortId, userId).first());
}

school.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const staff = can(user, 'cohorts');
  const ask = pageOf(c);
  const [progsAll, cohorts, mine, managed] = await Promise.all([
    db.prepare(staff ? 'SELECT * FROM programs ORDER BY created_at DESC LIMIT ? OFFSET ?' : 'SELECT * FROM programs WHERE published = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(ask.limit, ask.offset).all<ProgramRow>(),
    db.prepare(`${COHORT_SELECT} WHERE k.status != 'cancelled' ORDER BY k.start_at`).all<CohortRow>(),
    db.prepare(`${COHORT_SELECT} WHERE k.id IN (SELECT cohort_id FROM enrollments WHERE learner_user_id = ? AND status != 'withdrawn')`).bind(user.id).all<CohortRow>(),
    db.prepare(`${COHORT_SELECT} WHERE k.manager_user_id = ?`).bind(user.id).all<CohortRow>(),
  ]);
  const pg = paged(progsAll.results, ask);
  const progs = { results: pg.items };
  const programs: Program[] = progs.results.map((p) => ({ id: p.id, name: p.name, description: p.description, pricePoints: p.price_points, priceCents: p.price_cents, currency: p.currency, deliveryMode: p.delivery_mode, published: p.published === 1, outcomes: p.outcomes, prerequisites: p.prerequisites, createdAt: p.created_at, cohorts: cohorts.results.filter((k) => k.program_id === p.id).map(toCohort) }));
  return c.json({ page: pg.page, programs, myCohorts: mine.results.map(toCohort), managed: managed.results.map(toCohort), staff, mentor: can(user, 'mentor') });
});

school.post('/programs', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (!can(user, 'cohorts')) return c.json({ error: 'cohort managers publish programs' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const name = str(body.name, 120);
  if (!name) return c.json({ error: 'name required' }, 400);
  const id = newId();
  await db.prepare('INSERT INTO programs (id, name, description, price_points, price_cents, currency, delivery_mode, published, outcomes, prerequisites, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, name, str(body.description, 5000), num(body.pricePoints, 0, 0) ?? 0, num(body.priceCents, 0, 0) ?? 0, str(body.currency, 3, 'INR').toUpperCase(), oneOf(body.deliveryMode, ['online', 'in_person', 'hybrid'] as const, 'online'), body.published === true ? 1 : 0, str(body.outcomes, 2000), str(body.prerequisites, 1000), user.id, nowIso())
    .run();
  await audit(db, user.id, 'program.create', 'program', id, '', name);
  return c.json({ ok: true, id }, 201);
});

school.patch('/programs/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (!can(user, 'cohorts')) return c.json({ error: 'cohort managers edit programs' }, 403);
  const prev = await db.prepare('SELECT * FROM programs WHERE id = ?').bind(c.req.param('id')).first<ProgramRow>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  await db.prepare('UPDATE programs SET name = ?, description = ?, price_points = ?, price_cents = ?, delivery_mode = ?, published = ?, outcomes = ?, prerequisites = ? WHERE id = ?')
    .bind(str(body.name, 120, prev.name) || prev.name, str(body.description, 5000, prev.description), num(body.pricePoints, prev.price_points, 0) ?? prev.price_points, num(body.priceCents, prev.price_cents, 0) ?? prev.price_cents, oneOf(body.deliveryMode, ['online', 'in_person', 'hybrid'] as const, prev.delivery_mode), typeof body.published === 'boolean' ? (body.published ? 1 : 0) : prev.published, str(body.outcomes, 2000, prev.outcomes), str(body.prerequisites, 1000, prev.prerequisites), prev.id)
    .run();
  return c.json({ ok: true });
});

school.post('/programs/:id/items', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (!can(user, 'cohorts')) return c.json({ error: 'cohort managers add lessons' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const title = str(body.moduleTitle, 140);
  if (!title) return c.json({ error: 'title required' }, 400);
  const n = await db.prepare('SELECT COALESCE(MAX(sequence), -1) + 1 AS n FROM learning_items WHERE program_id = ?').bind(c.req.param('id')).first<{ n: number }>();
  await db.prepare('INSERT INTO learning_items (id, program_id, module_title, content_type, content_ref, body, sequence, published) VALUES (?, ?, ?, ?, ?, ?, ?, 1)').bind(newId(), c.req.param('id'), title, oneOf(body.contentType, ['lesson', 'video', 'reading'] as const, 'lesson'), str(body.contentRef, 500) || null, str(body.body, 20000), n?.n ?? 0).run();
  return c.json({ ok: true }, 201);
});

school.post('/programs/:id/assignments', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (!can(user, 'cohorts')) return c.json({ error: 'cohort managers add assignments' }, 403);
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
  if (!can(user, 'cohorts')) return c.json({ error: 'cohort managers open cohorts' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const name = str(body.name, 80);
  const startAt = str(body.startAt, 40);
  const endAt = str(body.endAt, 40);
  if (!name || !startAt || !endAt) return c.json({ error: 'name, start and end' }, 400);
  const id = newId();
  await db.prepare("INSERT INTO cohorts (id, program_id, name, start_at, end_at, capacity, status, manager_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, 'upcoming', ?, ?)").bind(id, c.req.param('id'), name, startAt, endAt, num(body.capacity, 50, 1, 1000) ?? 50, user.id, nowIso()).run();
  return c.json({ ok: true, id }, 201);
});

// Enrol: capacity is checked and the seat taken in one statement.
school.post('/cohorts/:id/enroll', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const k = await db.prepare(`${COHORT_SELECT} WHERE k.id = ?`).bind(c.req.param('id')).first<CohortRow & { price_points?: number }>();
  if (!k) return c.json({ error: 'not found' }, 404);
  const prog = await db.prepare('SELECT price_points, price_cents, published FROM programs WHERE id = ?').bind(k.program_id).first<{ price_points: number; price_cents: number; published: number }>();
  if (!prog || prog.published !== 1) return c.json({ error: 'this program is not open' }, 400);
  if (k.status === 'finished' || k.status === 'cancelled') return c.json({ error: 'this cohort is closed' }, 400);
  const body = await c.req.json<{ pay?: string }>().catch(() => ({}) as { pay?: string });
  const pay = body.pay === 'test' ? 'test' : prog.price_points > 0 ? 'points' : 'free';
  if (pay === 'points' && user.points < prog.price_points) return c.json({ error: `you need ${prog.price_points - user.points} more points` }, 400);
  const id = newId();
  const now = nowIso();
  // One statement takes the seat: it only inserts while a seat is free and the learner is not already in.
  const ins = await db
    .prepare(
      `INSERT INTO enrollments (id, cohort_id, learner_user_id, status, payment_status, enrolled_at, completed_at)
       SELECT ?1, ?2, ?3, 'enrolled', ?4, ?5, NULL
       WHERE (SELECT COUNT(*) FROM enrollments WHERE cohort_id = ?2 AND status != 'withdrawn') < (SELECT capacity FROM cohorts WHERE id = ?2)
         AND NOT EXISTS (SELECT 1 FROM enrollments WHERE cohort_id = ?2 AND learner_user_id = ?3)`,
    )
    .bind(id, k.id, user.id, pay === 'points' ? 'paid' : pay, now)
    .run();
  if (ins.meta.changes !== 1) return c.json({ error: 'full, or you are already in' }, 409);
  if (pay === 'points') {
    await db.batch([
      db.prepare('UPDATE users SET points = points - ? WHERE id = ?').bind(prog.price_points, user.id),
      db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(user.id, -prog.price_points, 'enrollment', id, now),
    ]);
  }
  if (k.manager_user_id) await notify(db, k.manager_user_id, 'school', `${nameOf(user)} joined ${k.name}`, '', `/school/${k.id}`);
  return c.json({ ok: true, id }, 201);
});

interface ItemRow { id: string; program_id: string; module_title: string; content_type: LearningItem['contentType']; content_ref: string | null; body: string; sequence: number; published: number }
interface AssignRow { id: string; program_id: string; title: string; instructions: string; rubric: string; due_days: number; sequence: number }
interface SubRow { id: string; assignment_id: string; cohort_id: string; learner_user_id: string; learner_name: string; url: string | null; text: string; status: Submission['status']; submitted_at: string }
interface FbRow { id: string; submission_id: string; reviewer_name: string; comment: string; grade: string | null; created_at: string }
interface SessionRow { id: string; cohort_id: string; title: string; starts_at: string; ends_at: string; online_url: string | null }

school.get('/cohorts/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const k = await db.prepare(`${COHORT_SELECT} WHERE k.id = ?`).bind(c.req.param('id')).first<CohortRow>();
  if (!k) return c.json({ error: 'not found' }, 404);
  const manager = can(user, 'cohorts') || (await isManager(db, user.id, k.id));
  const mentor = manager || can(user, 'mentor');
  const enrolled = await db.prepare('SELECT 1 FROM enrollments WHERE cohort_id = ? AND learner_user_id = ? AND status != \'withdrawn\'').bind(k.id, user.id).first();
  if (!enrolled && !mentor) return c.json({ error: 'you are not in this cohort' }, 403);
  const [items, assigns, subs, fbs, sessions, att, enrolls] = await Promise.all([
    db.prepare('SELECT * FROM learning_items WHERE program_id = ? AND published = 1 ORDER BY sequence').bind(k.program_id).all<ItemRow>(),
    db.prepare('SELECT * FROM course_assignments WHERE program_id = ? ORDER BY sequence').bind(k.program_id).all<AssignRow>(),
    mentor
      ? db.prepare('SELECT s.*, u.display_name AS learner_name FROM submissions s JOIN users u ON u.id = s.learner_user_id WHERE s.cohort_id = ? ORDER BY s.submitted_at DESC').bind(k.id).all<SubRow>()
      : db.prepare('SELECT s.*, u.display_name AS learner_name FROM submissions s JOIN users u ON u.id = s.learner_user_id WHERE s.cohort_id = ? AND s.learner_user_id = ?').bind(k.id, user.id).all<SubRow>(),
    db.prepare('SELECT f.*, u.display_name AS reviewer_name FROM submission_feedback f JOIN users u ON u.id = f.reviewer_user_id WHERE f.submission_id IN (SELECT id FROM submissions WHERE cohort_id = ?) ORDER BY f.created_at').bind(k.id).all<FbRow>(),
    db.prepare('SELECT * FROM cohort_sessions WHERE cohort_id = ? ORDER BY starts_at').bind(k.id).all<SessionRow>(),
    db.prepare('SELECT a.session_id, a.user_id, a.status, u.display_name FROM attendance a JOIN users u ON u.id = a.user_id WHERE a.session_id IN (SELECT id FROM cohort_sessions WHERE cohort_id = ?)').bind(k.id).all<{ session_id: string; user_id: string; status: string; display_name: string }>(),
    mentor ? db.prepare("SELECT e.*, u.display_name AS learner_name FROM enrollments e JOIN users u ON u.id = e.learner_user_id WHERE e.cohort_id = ? AND e.status != 'withdrawn'").bind(k.id).all<{ id: string; cohort_id: string; learner_user_id: string; learner_name: string; status: Enrollment['status']; payment_status: Enrollment['paymentStatus']; enrolled_at: string; completed_at: string | null }>() : Promise.resolve({ results: [] }),
  ]);
  const visibleSubs = subs.results.filter((s) => mentor || s.learner_user_id === user.id);
  const submissions: Submission[] = visibleSubs.map((s) => ({ id: s.id, assignmentId: s.assignment_id, cohortId: s.cohort_id, learnerId: s.learner_user_id, learnerName: nameOf({ display_name: s.learner_name }), url: s.url, text: s.text, status: s.status, submittedAt: s.submitted_at, feedback: fbs.results.filter((f) => f.submission_id === s.id).map((f) => ({ id: f.id, reviewerName: nameOf({ display_name: f.reviewer_name }), comment: f.comment, grade: f.grade, createdAt: f.created_at })) }));
  const sess: CohortSession[] = sessions.results.map((s) => ({ id: s.id, cohortId: s.cohort_id, title: s.title, startsAt: s.starts_at, endsAt: s.ends_at, onlineUrl: s.online_url, attended: att.results.some((a) => a.session_id === s.id && a.user_id === user.id), attendance: mentor ? att.results.filter((a) => a.session_id === s.id).map((a) => ({ userId: a.user_id, name: nameOf(a), status: a.status })) : undefined }));
  const progressFor = (learnerId: string) => ({
    assignmentsApproved: subs.results.filter((s) => s.learner_user_id === learnerId && s.status === 'approved').length,
    assignmentsTotal: assigns.results.length,
    sessionsAttended: att.results.filter((a) => a.user_id === learnerId).length,
    sessionsTotal: sessions.results.length,
  });
  const enrollments: Enrollment[] = enrolls.results.map((e) => ({ id: e.id, cohortId: e.cohort_id, learnerId: e.learner_user_id, learnerName: nameOf({ display_name: e.learner_name }), status: e.status, paymentStatus: e.payment_status, enrolledAt: e.enrolled_at, completedAt: e.completed_at, progress: progressFor(e.learner_user_id) }));
  const me = await db.prepare('SELECT * FROM enrollments WHERE cohort_id = ? AND learner_user_id = ?').bind(k.id, user.id).first<{ status: Enrollment['status']; completed_at: string | null }>();
  return c.json({
    cohort: toCohort(k),
    items: items.results.map((i): LearningItem => ({ id: i.id, programId: i.program_id, moduleTitle: i.module_title, contentType: i.content_type, contentRef: i.content_ref, body: i.body, sequence: i.sequence, published: i.published === 1 })),
    assignments: assigns.results.map((a): CourseAssignment => ({ id: a.id, programId: a.program_id, title: a.title, instructions: a.instructions, rubric: a.rubric, dueDays: a.due_days, sequence: a.sequence })),
    submissions,
    sessions: sess,
    enrollments,
    manager,
    mentor,
    myProgress: enrolled ? progressFor(user.id) : null,
    myStatus: me?.status ?? null,
  });
});

school.post('/assignments/:id/submit', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const cohortId = str(body.cohortId, 64);
  const a = await db.prepare('SELECT a.*, k.manager_user_id FROM course_assignments a JOIN cohorts k ON k.program_id = a.program_id WHERE a.id = ? AND k.id = ?').bind(c.req.param('id'), cohortId).first<AssignRow & { manager_user_id: string | null }>();
  if (!a) return c.json({ error: 'not found' }, 404);
  const enrolled = await db.prepare("SELECT 1 FROM enrollments WHERE cohort_id = ? AND learner_user_id = ? AND status = 'enrolled'").bind(cohortId, user.id).first();
  if (!enrolled) return c.json({ error: 'you are not in this cohort' }, 403);
  const url = str(body.url, 500) || null;
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
  if (!can(user, 'mentor') && !can(user, 'cohorts') && !(await isManager(db, user.id, s.cohort_id))) return c.json({ error: 'mentors and cohort managers give feedback' }, 403);
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
  if (!can(user, 'cohorts') && !(await isManager(db, user.id, c.req.param('id')))) return c.json({ error: 'the cohort manager schedules sessions' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const title = str(body.title, 120);
  const startsAt = str(body.startsAt, 40);
  if (!title || !startsAt) return c.json({ error: 'title and a start time' }, 400);
  const start = new Date(startsAt);
  await db.prepare('INSERT INTO cohort_sessions (id, cohort_id, title, starts_at, ends_at, online_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId(), c.req.param('id'), title, start.toISOString(), new Date(start.getTime() + (num(body.minutes, 60, 15, 600) ?? 60) * 60_000).toISOString(), str(body.onlineUrl, 500) || null, nowIso()).run();
  return c.json({ ok: true }, 201);
});

// Learners check themselves in while the session is live; managers can mark anyone.
school.post('/sessions/:id/attendance', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const s = await db.prepare('SELECT * FROM cohort_sessions WHERE id = ?').bind(c.req.param('id')).first<SessionRow>();
  if (!s) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ userId?: string }>().catch(() => ({}) as { userId?: string });
  const manager = can(user, 'cohorts') || (await isManager(db, user.id, s.cohort_id));
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
  if (!can(user, 'cohorts') && !(await isManager(db, user.id, e.cohort_id))) return c.json({ error: 'the cohort manager marks completion' }, 403);
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
