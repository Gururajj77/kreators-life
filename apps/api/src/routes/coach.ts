import { Hono } from 'hono';
import { COACH_ABOUT_MAX, COACH_ASK_AGAIN_DAYS, COACH_NOTE_MAX, COACH_SHARE_PARTS, MAX_COACH_ASKS, MAX_COACHES, parentKind, parseCoachShare, type CoachDirectoryEntry, type CoachHub, type CoachLinkStatus, type CoachProfile, type MyCoachResponse } from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { getNode, nameOf, newId, notify, nowIso, pageOf, paged, str, toNode } from '../db';
import { activeLink, askToCoach, endLink, isCoach, LINK, linkById, logCoach, logPage, notePage, rosterRow, shareChange, studentView, toLink, toPerson, type LinkRow } from '../coaching';
import { createNode, editNode, type NodeBody } from './nodes';

/**
 * Coaching, the coach's side: the roster, the directory, asking someone to be a student, and what a coach does for
 * a student (look, leave notes, add and change tasks). Gated by the Coaching module.
 */
export const coach = new Hono<AppEnv>();

/**
 * Coaching, the student's side, under /me/coach: answering an ask (either side answers here), what a student shares,
 * ending a link, the notes and the change log. Core and always open, so nobody is ever stuck with a coach.
 */
export const myCoach = new Hono<AppEnv>();

const DAY = 86_400_000;

interface ProfileRow { about: string; open: number; asked_at: string | null }
async function profileOf(db: D1Database, userId: string): Promise<CoachProfile> {
  const p = await db.prepare('SELECT about, open, asked_at FROM coach_profiles WHERE user_id = ?').bind(userId).first<ProfileRow>();
  return { about: p?.about ?? '', open: p ? p.open === 1 : true, askedAt: p?.asked_at ?? null };
}

/** Why a new link between these two cannot start, or null. The same checks for every way a link starts. */
export async function linkProblem(db: D1Database, coachId: string, studentId: string): Promise<{ error: string; status: 400 | 409 } | null> {
  if (coachId === studentId) return { error: 'A coach cannot coach themselves.', status: 400 };
  const open = await db.prepare("SELECT status FROM coach_links WHERE coach_id = ? AND student_id = ? AND status IN ('pending','active')").bind(coachId, studentId).first<{ status: CoachLinkStatus }>();
  if (open) return { error: open.status === 'active' ? 'They already work together.' : 'There is already an ask waiting between them.', status: 409 };
  const no = await db.prepare("SELECT answered_at FROM coach_links WHERE coach_id = ? AND student_id = ? AND status = 'declined' AND answered_at >= ? ORDER BY answered_at DESC LIMIT 1").bind(coachId, studentId, new Date(Date.now() - COACH_ASK_AGAIN_DAYS * DAY).toISOString()).first<{ answered_at: string }>();
  if (no) return { error: `That ask got a no on ${no.answered_at.slice(0, 10)}. It can be asked again from ${new Date(Date.parse(no.answered_at) + COACH_ASK_AGAIN_DAYS * DAY).toISOString().slice(0, 10)}.`, status: 409 };
  const full = await db.prepare("SELECT COUNT(*) AS n FROM coach_links WHERE student_id = ? AND status IN ('pending','active')").bind(studentId).first<{ n: number }>();
  if ((full?.n ?? 0) >= MAX_COACHES) return { error: `A student has at most ${MAX_COACHES} coaches or asks at once.`, status: 409 };
  return null;
}

/** Start a link: asked (it waits for the other side) or, from the team only, active at once. */
export async function startLink(db: D1Database, a: { coachId: string; studentId: string; askedBy: 'coach' | 'student' | 'admin'; createdBy: string | null; active: boolean }): Promise<LinkRow | null> {
  const id = newId();
  const now = nowIso();
  await db
    .prepare("INSERT INTO coach_links (id, coach_id, student_id, status, asked_by, created_by, share_json, created_at, answered_at) VALUES (?, ?, ?, ?, ?, ?, '{}', ?, ?)")
    .bind(id, a.coachId, a.studentId, a.active ? 'active' : 'pending', a.askedBy, a.createdBy, now, a.active ? now : null)
    .run();
  return linkById(db, id);
}

/** Someone by their email or their @handle. */
async function personBy(db: D1Database, who: string): Promise<UserRow | null> {
  const q = who.trim().toLowerCase();
  if (!q) return null;
  return q.includes('@') && !q.startsWith('@') ? db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').bind(q).first<UserRow>() : db.prepare('SELECT * FROM users WHERE handle = ?').bind(q.replace(/^@/, '')).first<UserRow>();
}

// ---- the coach's side

coach.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const profile = await profileOf(db, user.id);
  const none = { page: 1, size: pageOf(c).size, more: false };
  if (!isCoach(user)) {
    const res: CoachHub = { coach: false, profile, counts: { students: 0, asks: 0, sent: 0 }, students: [], studentsPage: none, asks: [], asksPage: none, sent: [], sentPage: none };
    return c.json(res);
  }
  const s = pageOf(c, 's');
  const a = pageOf(c, 'a');
  const o = pageOf(c, 'o');
  const [rows, asks, sent, counts] = await Promise.all([
    db.prepare(`${LINK} WHERE l.coach_id = ? AND l.status = 'active' ORDER BY s.display_name COLLATE NOCASE, l.id LIMIT ? OFFSET ?`).bind(user.id, s.limit, s.offset).all<LinkRow>(),
    db.prepare(`${LINK} WHERE l.coach_id = ? AND l.status = 'pending' AND l.asked_by = 'student' ORDER BY l.created_at DESC LIMIT ? OFFSET ?`).bind(user.id, a.limit, a.offset).all<LinkRow>(),
    db.prepare(`${LINK} WHERE l.coach_id = ? AND l.status = 'pending' AND l.asked_by != 'student' ORDER BY l.created_at DESC LIMIT ? OFFSET ?`).bind(user.id, o.limit, o.offset).all<LinkRow>(),
    db
      .prepare(
        `SELECT SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS students,
          SUM(CASE WHEN status = 'pending' AND asked_by = 'student' THEN 1 ELSE 0 END) AS asks,
          SUM(CASE WHEN status = 'pending' AND asked_by != 'student' THEN 1 ELSE 0 END) AS sent
         FROM coach_links WHERE coach_id = ?`,
      )
      .bind(user.id)
      .first<{ students: number | null; asks: number | null; sent: number | null }>(),
  ]);
  const students = paged(rows.results, s);
  const asked = paged(asks.results, a);
  const out = paged(sent.results, o);
  const res: CoachHub = {
    coach: true,
    profile,
    counts: { students: counts?.students ?? 0, asks: counts?.asks ?? 0, sent: counts?.sent ?? 0 },
    students: await Promise.all(students.items.map((r) => rosterRow(db, r))),
    studentsPage: students.page,
    asks: asked.items.map(toLink),
    asksPage: asked.page,
    sent: out.items.map(toLink),
    sentPage: out.page,
  };
  return c.json(res);
});

// A coach's line for the directory and whether they take new students. Anyone can keep one: it goes with an ask.
coach.put('/profile', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ about?: unknown; open?: unknown }>().catch(() => ({}) as Record<string, never>);
  const before = await profileOf(db, user.id);
  const about = typeof body.about === 'string' ? str(body.about, COACH_ABOUT_MAX) : before.about;
  const open = typeof body.open === 'boolean' ? body.open : before.open;
  await db
    .prepare('INSERT INTO coach_profiles (user_id, about, open, asked_at, updated_at) VALUES (?, ?, ?, NULL, ?) ON CONFLICT(user_id) DO UPDATE SET about = excluded.about, open = excluded.open, updated_at = excluded.updated_at')
    .bind(user.id, about, open ? 1 : 0, nowIso())
    .run();
  return c.json({ profile: await profileOf(db, user.id) });
});

// Ask the team to be made a life coach. Once per wait: asking again while it waits changes nothing.
coach.post('/apply', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (isCoach(user)) return c.json({ error: 'You are a life coach already.' }, 409);
  const body = await c.req.json<{ about?: unknown }>().catch(() => ({}) as { about?: unknown });
  await askToCoach(db, user, str(body.about, COACH_ABOUT_MAX));
  return c.json({ profile: await profileOf(db, user.id) }, 201);
});

// Life coaches taking new students, a page at a time, with where the viewer stands with each.
coach.get('/directory', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const ask = pageOf(c, 'dir');
  const rows = await db
    .prepare(
      `SELECT u.id, u.display_name, u.handle, u.role, u.permissions, COALESCE(p.about, '') AS about,
        (SELECT COUNT(*) FROM coach_links x WHERE x.coach_id = u.id AND x.status = 'active') AS students,
        (SELECT y.status FROM coach_links y WHERE y.coach_id = u.id AND y.student_id = ?1 AND y.status IN ('pending','active')) AS mine
       FROM users u LEFT JOIN coach_profiles p ON p.user_id = u.id
       WHERE u.permissions LIKE '%"coach"%' AND COALESCE(p.open, 1) = 1 AND u.id != ?1
       ORDER BY u.display_name COLLATE NOCASE, u.id LIMIT ?2 OFFSET ?3`,
    )
    .bind(user.id, ask.limit, ask.offset)
    .all<{ id: string; display_name: string; handle: string | null; role: UserRow['role']; permissions: string; about: string; students: number; mine: CoachLinkStatus | null }>();
  const pg = paged(rows.results, ask);
  const coaches: CoachDirectoryEntry[] = pg.items.map((r) => ({ coach: toPerson(r), about: r.about, students: r.students, mine: r.mine }));
  return c.json({ coaches, page: pg.page });
});

// A coach asks someone, by email or @handle, to be their student. Nothing is shared until they say yes.
coach.post('/requests', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (!isCoach(user)) return c.json({ error: 'Only a life coach can ask someone to be their student.' }, 403);
  const body = await c.req.json<{ who?: unknown }>().catch(() => ({}) as { who?: unknown });
  const student = await personBy(db, typeof body.who === 'string' ? body.who : '');
  if (!student) return c.json({ error: 'No account has that email or handle.' }, 404);
  const waiting = await db.prepare("SELECT COUNT(*) AS n FROM coach_links WHERE coach_id = ? AND status = 'pending' AND asked_by = 'coach'").bind(user.id).first<{ n: number }>();
  if ((waiting?.n ?? 0) >= MAX_COACH_ASKS) return c.json({ error: `You have ${MAX_COACH_ASKS} asks waiting. Wait for answers, or take some back.` }, 429);
  const bad = await linkProblem(db, user.id, student.id);
  if (bad) return c.json({ error: bad.error }, bad.status);
  const link = await startLink(db, { coachId: user.id, studentId: student.id, askedBy: 'coach', createdBy: user.id, active: false });
  if (!link) return c.json({ error: 'not found' }, 404);
  await logCoach(db, { linkId: link.id, coachId: user.id, studentId: student.id, actorId: user.id, action: 'link.ask', label: `${nameOf(user)} asked to coach ${nameOf(student)}` });
  await notify(db, student.id, 'coach', `${nameOf(user)} would like to be your life coach`, 'Say yes or no on your Profile tab. Nothing is shared until you say yes, and you pick what they see.', '/you#coach');
  return c.json({ link: toLink(link) }, 201);
});

// A student asks a coach from the directory. The coach says yes or no.
coach.post('/ask/:coachId', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const target = await db.prepare('SELECT * FROM users WHERE id = ?').bind(c.req.param('coachId')).first<UserRow>();
  if (!target || !isCoach(target)) return c.json({ error: 'There is no life coach by that name.' }, 404);
  if (!(await profileOf(db, target.id)).open) return c.json({ error: 'This coach is not taking new students right now.' }, 409);
  const bad = await linkProblem(db, target.id, user.id);
  if (bad) return c.json({ error: bad.error }, bad.status);
  const link = await startLink(db, { coachId: target.id, studentId: user.id, askedBy: 'student', createdBy: user.id, active: false });
  if (!link) return c.json({ error: 'not found' }, 404);
  await logCoach(db, { linkId: link.id, coachId: target.id, studentId: user.id, actorId: user.id, action: 'link.ask', label: `${nameOf(user)} asked ${nameOf(target)} to be their life coach` });
  await notify(db, target.id, 'coach', `${nameOf(user)} asked you to be their life coach`, 'Say yes or no under Coaching.', '/coaching');
  return c.json({ link: toLink(link) }, 201);
});

/** The coach, holding the permission, on an active link with this student; or why not. */
async function myStudent(db: D1Database, user: UserRow, studentId: string): Promise<{ link: LinkRow } | { error: string; status: 403 | 404 }> {
  if (!isCoach(user)) return { error: 'Only a life coach sees a student.', status: 403 };
  const link = await activeLink(db, user.id, studentId);
  return link ? { link } : { error: 'Not your student.', status: 404 };
}

coach.get('/students/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const found = await myStudent(db, user, c.req.param('id'));
  if ('error' in found) return c.json({ error: found.error }, found.status);
  const student = await db.prepare('SELECT * FROM users WHERE id = ?').bind(found.link.student_id).first<UserRow>();
  if (!student) return c.json({ error: 'not found' }, 404);
  return c.json(await studentView(db, found.link, student, user, c));
});

// A note for the student. They read every one, in Coaching and their inbox.
coach.post('/students/:id/notes', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const found = await myStudent(db, user, c.req.param('id'));
  if ('error' in found) return c.json({ error: found.error }, found.status);
  const body = await c.req.json<{ body?: unknown }>().catch(() => ({}) as { body?: unknown });
  const text = str(body.body, COACH_NOTE_MAX);
  if (!text) return c.json({ error: 'Write the note first.' }, 400);
  const { link } = found;
  const id = newId();
  await db.prepare('INSERT INTO coach_notes (id, link_id, coach_id, student_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, link.id, user.id, link.student_id, text, nowIso()).run();
  await logCoach(db, { linkId: link.id, coachId: user.id, studentId: link.student_id, actorId: user.id, action: 'note.add', label: `${nameOf(user)} left a note`, targetId: id });
  await notify(db, link.student_id, 'coach', `A note from ${nameOf(user)}, your life coach`, text.length > 140 ? `${text.slice(0, 137)}...` : text, '/coaching');
  return c.json({ ok: true, id }, 201);
});

coach.delete('/students/:id/notes/:noteId', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const found = await myStudent(db, user, c.req.param('id'));
  if ('error' in found) return c.json({ error: found.error }, found.status);
  const note = await db.prepare('SELECT id, created_at FROM coach_notes WHERE id = ? AND coach_id = ? AND student_id = ?').bind(c.req.param('noteId'), user.id, found.link.student_id).first<{ id: string; created_at: string }>();
  if (!note) return c.json({ error: 'not found' }, 404);
  await db.prepare('DELETE FROM coach_notes WHERE id = ?').bind(note.id).run();
  await logCoach(db, { linkId: found.link.id, coachId: user.id, studentId: found.link.student_id, actorId: user.id, action: 'note.remove', label: `${nameOf(user)} took back a note from ${note.created_at.slice(0, 10)}`, targetId: note.id });
  return c.json({ ok: true });
});

/** The coach may write in a student's pyramid only while the student shares their pillars. */
async function writable(db: D1Database, user: UserRow, studentId: string) {
  const found = await myStudent(db, user, studentId);
  if ('error' in found) return found;
  if (!parseCoachShare(found.link.share_json).pillars) return { error: 'They do not share their pillars with you, so their tasks are theirs alone.', status: 403 as const };
  return found;
}

// A task in the student's pyramid, under one of their projects. It waits, pays and ticks like their own; only they tick it.
coach.post('/students/:id/tasks', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const found = await writable(db, user, c.req.param('id'));
  if ('error' in found) return c.json({ error: found.error }, found.status);
  const { link } = found;
  const body = await c.req.json<NodeBody>().catch(() => ({}) as NodeBody);
  const parent = typeof body.parentId === 'string' ? await getNode(db, link.student_id, body.parentId) : null;
  if (!parent || parent.kind !== parentKind('task')) return c.json({ error: 'Pick one of their projects for the task.' }, 400);
  const made = await createNode(db, link.student_id, { kind: 'task', relationship: parent.relationship, parentId: parent.id, title: body.title, note: body.note, dueDate: body.dueDate, dueTime: body.dueTime, estimateMin: body.estimateMin }, user.id);
  if ('error' in made) return c.json({ error: made.error }, made.status);
  const t = made.row;
  await logCoach(db, { linkId: link.id, coachId: user.id, studentId: link.student_id, actorId: user.id, action: 'task.add', label: `${nameOf(user)} added the task “${t.title}” under “${parent.title}”${t.due_date ? `, for ${t.due_date}` : ''}`, targetId: t.id, after: { title: t.title, dueDate: t.due_date, dueTime: t.due_time, estimateMin: t.estimate_min } });
  await notify(db, link.student_id, 'coach', `${nameOf(user)} added a task: ${t.title}`, 'It is in your pyramid, marked From your coach. Only you tick it.', `/realm/${t.relationship}`);
  return c.json({ node: toNode(t) }, 201);
});

// Change an open task's words, date or plan. Never its status: ticking stays with the student, and so does removing.
coach.patch('/students/:id/tasks/:taskId', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const found = await writable(db, user, c.req.param('id'));
  if ('error' in found) return c.json({ error: found.error }, found.status);
  const { link } = found;
  const row = await getNode(db, link.student_id, c.req.param('taskId'));
  if (!row || row.kind !== 'task') return c.json({ error: 'not found' }, 404);
  if (row.status !== 'active') return c.json({ error: 'Only open tasks can be changed.' }, 400);
  const body = await c.req.json<NodeBody>().catch(() => ({}) as NodeBody);
  const fresh = await editNode(db, row, { title: body.title, note: body.note, dueDate: body.dueDate, dueTime: body.dueTime, estimateMin: body.estimateMin });
  const changes = [
    fresh.title !== row.title ? `the title to “${fresh.title}”` : '',
    fresh.due_date !== row.due_date ? (fresh.due_date ? `the date to ${fresh.due_date}` : 'cleared the date') : '',
    fresh.due_time !== row.due_time ? (fresh.due_time ? `the time to ${fresh.due_time}` : 'cleared the time') : '',
    fresh.estimate_min !== row.estimate_min ? (fresh.estimate_min ? `the length to ${fresh.estimate_min} min` : 'cleared the length') : '',
    fresh.note !== row.note ? 'the note' : '',
  ].filter(Boolean);
  if (changes.length) {
    await logCoach(db, {
      linkId: link.id,
      coachId: user.id,
      studentId: link.student_id,
      actorId: user.id,
      action: 'task.edit',
      label: `${nameOf(user)} changed the task “${row.title}”: ${changes.join(', ')}`,
      targetId: row.id,
      before: { title: row.title, dueDate: row.due_date, dueTime: row.due_time, estimateMin: row.estimate_min },
      after: { title: fresh.title, dueDate: fresh.due_date, dueTime: fresh.due_time, estimateMin: fresh.estimate_min },
    });
    await notify(db, link.student_id, 'coach', `${nameOf(user)} changed a task: ${fresh.title}`, `Changed ${changes.join(', ')}.`, `/realm/${fresh.relationship}`);
  }
  return c.json({ node: toNode(fresh) });
});

// ---- the student's side, and answers from either side

myCoach.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const ask = pageOf(c, 'coach');
  // Active first, then asks waiting, newest first. Ended and declined ones live in the change log.
  const rows = await db.prepare(`${LINK} WHERE l.student_id = ? AND l.status IN ('active','pending') ORDER BY CASE l.status WHEN 'active' THEN 0 ELSE 1 END, l.created_at DESC LIMIT ? OFFSET ?`).bind(user.id, ask.limit, ask.offset).all<LinkRow>();
  const pg = paged(rows.results, ask);
  const res: MyCoachResponse & { linksPage: typeof pg.page } = { links: pg.items.map(toLink), linksPage: pg.page, ...(await notePage(db, { studentId: user.id }, user.id, c, 'note')) };
  return c.json(res);
});

// Everything that involves the person, as a student or as a coach: their own change log.
myCoach.get('/log', async (c) => c.json(await logPage(c.env.DB, { anyone: c.get('user').id }, c, 'log')));

// Answer an ask. The side that was asked answers: the student for a coach's or the team's ask, the coach for a student's.
myCoach.post('/links/:id/answer', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const link = await linkById(db, c.req.param('id'));
  if (!link || link.status !== 'pending') return c.json({ error: 'That ask is not waiting any more.' }, 404);
  const answerer = link.asked_by === 'student' ? link.coach_id : link.student_id;
  if (answerer !== user.id) return c.json({ error: 'The other side answers this one.' }, 403);
  if (link.asked_by === 'student' && !isCoach(user)) return c.json({ error: 'Only a life coach takes on a student.' }, 403);
  const body = await c.req.json<{ yes?: unknown }>().catch(() => ({}) as { yes?: unknown });
  const yes = body.yes === true;
  if (yes) {
    const full = await db.prepare("SELECT COUNT(*) AS n FROM coach_links WHERE student_id = ? AND status = 'active'").bind(link.student_id).first<{ n: number }>();
    if ((full?.n ?? 0) >= MAX_COACHES) return c.json({ error: `A student has at most ${MAX_COACHES} coaches at once.` }, 409);
  }
  const done = await db.prepare("UPDATE coach_links SET status = ?, answered_at = ? WHERE id = ? AND status = 'pending'").bind(yes ? 'active' : 'declined', nowIso(), link.id).run();
  if ((done.meta.changes ?? 0) === 0) return c.json({ error: 'That ask is not waiting any more.' }, 409);
  const coachName = nameOf({ display_name: link.c_name });
  const studentName = nameOf({ display_name: link.s_name });
  await logCoach(db, { linkId: link.id, coachId: link.coach_id, studentId: link.student_id, actorId: user.id, action: yes ? 'link.yes' : 'link.no', label: `${nameOf(user)} said ${yes ? 'yes' : 'no'}` });
  const other = user.id === link.coach_id ? link.student_id : link.coach_id;
  if (other === link.coach_id) await notify(db, other, 'coach', yes ? `${studentName} said yes to coaching` : `${studentName} said no to coaching`, yes ? 'Open Coaching to see what they share.' : '', '/coaching');
  else await notify(db, other, 'coach', yes ? `${coachName} is your life coach now` : `${coachName} said no to coaching`, yes ? 'Pick what they see on your Profile tab, any time.' : '', yes ? '/you#coach' : '/coaching');
  const fresh = await linkById(db, link.id);
  return c.json({ link: fresh ? toLink(fresh) : null });
});

// End a link, or take back an ask, from either side.
myCoach.delete('/links/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const link = await linkById(db, c.req.param('id'));
  if (!link || (link.coach_id !== user.id && link.student_id !== user.id)) return c.json({ error: 'not found' }, 404);
  if (link.status !== 'pending' && link.status !== 'active') return c.json({ ok: true });
  await endLink(db, link, { id: user.id, name: nameOf(user) });
  return c.json({ ok: true });
});

// What the student shares with one coach. Each part is the student's own switch; a coach reads it fresh every time.
myCoach.patch('/links/:id/share', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const link = await linkById(db, c.req.param('id'));
  if (!link || link.student_id !== user.id) return c.json({ error: 'not found' }, 404);
  if (link.status !== 'pending' && link.status !== 'active') return c.json({ error: 'This coaching has ended.' }, 400);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const before = parseCoachShare(link.share_json);
  const after = { ...before };
  for (const k of COACH_SHARE_PARTS) if (typeof body[k] === 'boolean') after[k] = body[k] as boolean;
  const said = shareChange(before, after);
  if (said) {
    await db.prepare('UPDATE coach_links SET share_json = ? WHERE id = ?').bind(JSON.stringify(after), link.id).run();
    await logCoach(db, { linkId: link.id, coachId: link.coach_id, studentId: link.student_id, actorId: user.id, action: 'share.change', label: `${nameOf(user)} ${said}`, before, after });
  }
  const fresh = await linkById(db, link.id);
  return c.json({ link: fresh ? toLink(fresh) : null });
});
