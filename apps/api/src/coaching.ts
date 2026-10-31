import {
  badgeRoleOf,
  COACH_SHARE_META,
  COACH_SHARE_PARTS,
  parseCoachShare,
  periodFor,
  type CoachLink,
  type CoachLogAction,
  type CoachLogEntry,
  type CoachNote,
  type CoachPerson,
  type CoachRosterRow,
  type CoachShare,
  type CoachStudentView,
  type CoachTrackerDay,
  type RelationshipKey,
  type Role,
} from '@kreators/shared';
import type { Context } from 'hono';
import type { AppEnv, UserRow } from './env';
import { can, nameOf, newId, notify, nowIso, pageOf, paged, parseList, shiftDate, taskGate, toNode, type NodeRow } from './db';
import { toReview, type ReviewRow } from './routes/reviews';
import { latest } from './routes/session';
import { dayBounds, notToDoList } from './routes/today';
import { summaryFor as wellbeingSummary } from './routes/wellbeing';

/**
 * Life coaches: the one set of rules for links between a coach and a student, the change log, and what a coach may
 * read. A coach reads a student only through an active link they are on, holding the Life coach permission at that
 * moment, and only the parts the student shares on that link; every read checks all three again, so ending a link,
 * switching a part off or taking the permission away cuts the view at once. The journal is never read here, nor any
 * tracker note, money, or the Companion.
 */

export const isCoach = (user: UserRow) => can(user, 'coach');

interface PersonRow {
  id: string;
  display_name: string;
  handle: string | null;
  role: Role;
  permissions: string;
}
export const toPerson = (r: PersonRow): CoachPerson => ({ id: r.id, name: nameOf(r), handle: r.handle, badge: badgeRoleOf({ role: r.role, permissions: parseList(r.permissions) }) });

export interface LinkRow {
  id: string;
  coach_id: string;
  student_id: string;
  status: CoachLink['status'];
  asked_by: CoachLink['askedBy'];
  created_by: string | null;
  share_json: string;
  created_at: string;
  answered_at: string | null;
  ended_at: string | null;
  ended_by: string | null;
  c_name: string;
  c_handle: string | null;
  c_role: Role;
  c_permissions: string;
  s_name: string;
  s_handle: string | null;
  s_role: Role;
  s_permissions: string;
  s_streak: number;
  s_last_checkin: string | null;
  s_timezone: string;
}
export const LINK = `SELECT l.*, c.display_name AS c_name, c.handle AS c_handle, c.role AS c_role, c.permissions AS c_permissions,
  s.display_name AS s_name, s.handle AS s_handle, s.role AS s_role, s.permissions AS s_permissions, s.streak AS s_streak, s.last_checkin AS s_last_checkin, s.timezone AS s_timezone
  FROM coach_links l JOIN users c ON c.id = l.coach_id JOIN users s ON s.id = l.student_id`;
export const toLink = (r: LinkRow): CoachLink => ({
  id: r.id,
  coach: toPerson({ id: r.coach_id, display_name: r.c_name, handle: r.c_handle, role: r.c_role, permissions: r.c_permissions }),
  student: toPerson({ id: r.student_id, display_name: r.s_name, handle: r.s_handle, role: r.s_role, permissions: r.s_permissions }),
  status: r.status,
  askedBy: r.asked_by,
  share: parseCoachShare(r.share_json),
  createdAt: r.created_at,
  answeredAt: r.answered_at,
  endedAt: r.ended_at,
});

export const linkById = (db: D1Database, id: string) => db.prepare(`${LINK} WHERE l.id = ?`).bind(id).first<LinkRow>();
/** The one active link between this coach and this student, or null. */
export const activeLink = (db: D1Database, coachId: string, studentId: string) => db.prepare(`${LINK} WHERE l.coach_id = ? AND l.student_id = ? AND l.status = 'active'`).bind(coachId, studentId).first<LinkRow>();

/** A person's own today, from their zone: the day a coach reads them for. */
export function localDay(zone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: zone || 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** One line of the change log. Both sides read it; the label is plain words about the change, never journal text. */
export async function logCoach(
  db: D1Database,
  e: { linkId: string | null; coachId: string; studentId: string; actorId: string | null; action: CoachLogAction; label: string; targetId?: string | null; before?: unknown; after?: unknown },
): Promise<void> {
  const text = (v: unknown) => (v === undefined || v === '' ? '' : JSON.stringify(v).slice(0, 2000));
  await db
    .prepare('INSERT INTO coach_log (id, link_id, coach_id, student_id, actor_id, action, label, target_id, before_json, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(newId(), e.linkId, e.coachId, e.studentId, e.actorId, e.action, e.label.slice(0, 300), e.targetId ?? null, text(e.before), text(e.after), nowIso())
    .run();
}

interface LogRow { id: string; action: CoachLogAction; label: string; created_at: string; actor_name: string | null; coach_name: string; student_name: string }
const LOG = `SELECT g.id, g.action, g.label, g.created_at, a.display_name AS actor_name, c.display_name AS coach_name, s.display_name AS student_name
  FROM coach_log g LEFT JOIN users a ON a.id = g.actor_id JOIN users c ON c.id = g.coach_id JOIN users s ON s.id = g.student_id`;
const toLog = (r: LogRow): CoachLogEntry => ({ id: r.id, action: r.action, label: r.label, actorName: r.actor_name === null ? 'The team' : nameOf({ display_name: r.actor_name }), coachName: nameOf({ display_name: r.coach_name }), studentName: nameOf({ display_name: r.student_name }), createdAt: r.created_at });

/** The change log, newest first, a page at a time: one pair's, or everything one person was part of, either side. */
export async function logPage(db: D1Database, where: { coachId: string; studentId: string } | { anyone: string }, c: Context<AppEnv>, prefix: string) {
  const ask = pageOf(c, prefix);
  const rows =
    'anyone' in where
      ? await db.prepare(`${LOG} WHERE g.student_id = ?1 OR g.coach_id = ?1 ORDER BY g.created_at DESC, g.id DESC LIMIT ?2 OFFSET ?3`).bind(where.anyone, ask.limit, ask.offset).all<LogRow>()
      : await db.prepare(`${LOG} WHERE g.coach_id = ? AND g.student_id = ? ORDER BY g.created_at DESC, g.id DESC LIMIT ? OFFSET ?`).bind(where.coachId, where.studentId, ask.limit, ask.offset).all<LogRow>();
  const pg = paged(rows.results, ask);
  return { log: pg.items.map(toLog), logPage: pg.page };
}

interface NoteRow { id: string; link_id: string; coach_id: string; body: string; created_at: string; coach_name: string }
const NOTE = 'SELECT n.id, n.link_id, n.coach_id, n.body, n.created_at, u.display_name AS coach_name FROM coach_notes n JOIN users u ON u.id = n.coach_id';
const toNote = (r: NoteRow, viewer: string): CoachNote => ({ id: r.id, linkId: r.link_id, coachName: nameOf({ display_name: r.coach_name }), body: r.body, mine: r.coach_id === viewer, createdAt: r.created_at });

/** Notes, newest first, a page at a time: one coach's to one student, or every coach's to one student. */
export async function notePage(db: D1Database, where: { coachId?: string; studentId: string }, viewer: string, c: Context<AppEnv>, prefix: string) {
  const ask = pageOf(c, prefix);
  const rows = where.coachId
    ? await db.prepare(`${NOTE} WHERE n.coach_id = ? AND n.student_id = ? ORDER BY n.created_at DESC, n.id DESC LIMIT ? OFFSET ?`).bind(where.coachId, where.studentId, ask.limit, ask.offset).all<NoteRow>()
    : await db.prepare(`${NOTE} WHERE n.student_id = ? ORDER BY n.created_at DESC, n.id DESC LIMIT ? OFFSET ?`).bind(where.studentId, ask.limit, ask.offset).all<NoteRow>();
  const pg = paged(rows.results, ask);
  return { notes: pg.items.map((r) => toNote(r, viewer)), notesPage: pg.page };
}

/** "Started sharing Reflection", "Stopped sharing Life map answers and Routine and contract". */
export function shareChange(before: CoachShare, after: CoachShare): string {
  const on = COACH_SHARE_PARTS.filter((k) => !before[k] && after[k]).map((k) => COACH_SHARE_META[k].name);
  const off = COACH_SHARE_PARTS.filter((k) => before[k] && !after[k]).map((k) => COACH_SHARE_META[k].name);
  const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
  return [on.length ? `started sharing ${list(on)}` : '', off.length ? `stopped sharing ${list(off)}` : ''].filter(Boolean).join('; ');
}

/** End a link, from either side or the team: the status, the log, and a note to whoever did not end it. */
export async function endLink(db: D1Database, link: LinkRow, actor: { id: string | null; name: string }): Promise<void> {
  const now = nowIso();
  await db.prepare("UPDATE coach_links SET status = 'ended', ended_at = ?, ended_by = ? WHERE id = ? AND status IN ('pending','active')").bind(now, actor.id, link.id).run();
  const waiting = link.status === 'pending';
  await logCoach(db, { linkId: link.id, coachId: link.coach_id, studentId: link.student_id, actorId: actor.id, action: 'link.end', label: waiting ? `${actor.name} took back the ask` : `${actor.name} ended the coaching` });
  const coachName = nameOf({ display_name: link.c_name });
  const studentName = nameOf({ display_name: link.s_name });
  if (actor.id !== link.coach_id) await notify(db, link.coach_id, 'coach', waiting ? `${studentName}: the ask was taken back` : `Coaching with ${studentName} has ended`, waiting ? '' : 'You no longer see their progress. The change log keeps what happened.', '/coaching');
  if (actor.id !== link.student_id) await notify(db, link.student_id, 'coach', waiting ? `${coachName}: the ask was taken back` : `Coaching with ${coachName} has ended`, waiting ? '' : `${coachName} no longer sees your progress.`, '/you#coach');
}

/** The admins to tell when someone asks to be made a life coach. */
export async function tellAdmins(db: D1Database, title: string, body: string): Promise<void> {
  const admins = await db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 20").all<{ id: string }>();
  for (const a of admins.results) await notify(db, a.id, 'team', title, body, '/admin?tab=coaches');
}

/**
 * Ask the team to be made a life coach: from Coaching, or from the setup chat when someone says they are one. The
 * admins hear about it once; asking again while it waits only updates the line about their coaching.
 */
export async function askToCoach(db: D1Database, user: UserRow, about: string): Promise<'asked' | 'waiting'> {
  const before = await db.prepare('SELECT about, asked_at FROM coach_profiles WHERE user_id = ?').bind(user.id).first<{ about: string; asked_at: string | null }>();
  const line = about || before?.about || '';
  const now = nowIso();
  await db
    .prepare('INSERT INTO coach_profiles (user_id, about, open, asked_at, updated_at) VALUES (?, ?, 1, ?, ?) ON CONFLICT(user_id) DO UPDATE SET about = excluded.about, asked_at = COALESCE(coach_profiles.asked_at, excluded.asked_at), updated_at = excluded.updated_at')
    .bind(user.id, line, now, now)
    .run();
  if (before?.asked_at) return 'waiting';
  await tellAdmins(db, `${nameOf(user)} asked to be a life coach`, line || 'No line about their coaching yet.');
  return 'asked';
}

/**
 * One student on a coach's roster: the streak and last check-in when Daily is shared, this week's routine days, the
 * contract and whether last week came in under it when the routine is shared, and the focus when the life map is.
 */
export async function rosterRow(db: D1Database, r: LinkRow): Promise<CoachRosterRow> {
  const share = parseCoachShare(r.share_json);
  const date = localDay(r.s_timezone);
  let week: (boolean | null)[] | null = null;
  let contractDays: number | null = null;
  let redWeek: boolean | null = null;
  if (share.routine) {
    const lastWeek = periodFor('week', shiftDate(periodFor('week', date).start, -1));
    const [days, contract] = await Promise.all([
      db.prepare('SELECT day, done FROM routine_days WHERE user_id = ? AND day >= ? AND day <= ?').bind(r.student_id, lastWeek.start, date).all<{ day: string; done: number }>(),
      db.prepare('SELECT min_days, signed_at FROM contracts WHERE user_id = ? ORDER BY signed_at DESC LIMIT 1').bind(r.student_id).first<{ min_days: number; signed_at: string }>(),
    ]);
    const byDay = new Map(days.results.map((d) => [d.day, d.done === 1]));
    week = Array.from({ length: 7 }, (_, i) => shiftDate(date, i - 6)).map((d) => byDay.get(d) ?? null);
    contractDays = contract?.min_days ?? null;
    // A red week: the contract was signed before last week ended, and last week kept fewer days than it asks for.
    if (contract && contract.signed_at.slice(0, 10) <= lastWeek.end) {
      const kept = days.results.filter((d) => d.done === 1 && d.day >= lastWeek.start && d.day <= lastWeek.end).length;
      redWeek = kept < contract.min_days;
    }
  }
  let focus: RelationshipKey[] | null = null;
  if (share.lifeMap) {
    const a = await db.prepare("SELECT focus_json FROM assessments WHERE user_id = ? AND kind = 'onboard' ORDER BY created_at DESC LIMIT 1").bind(r.student_id).first<{ focus_json: string }>();
    try {
      focus = a ? (JSON.parse(a.focus_json) as RelationshipKey[]) : [];
    } catch {
      focus = [];
    }
  }
  return {
    linkId: r.id,
    student: toLink(r).student,
    since: r.answered_at ?? r.created_at,
    share,
    streak: share.daily ? r.s_streak : null,
    lastCheckin: share.daily ? r.s_last_checkin : null,
    week,
    contractDays,
    redWeek,
    focus,
  };
}

/**
 * What a coach sees of one student, part by part, each only when the student shares it, read for the student's
 * own today. Lists inside it (reviews, notes, the change log) come a page at a time.
 */
export async function studentView(db: D1Database, link: LinkRow, student: UserRow, viewer: UserRow, c: Context<AppEnv>): Promise<CoachStudentView> {
  const share = parseCoachShare(link.share_json);
  const date = localDay(student.timezone);
  const id = student.id;
  const from = shiftDate(date, -29);
  const days30 = Array.from({ length: 30 }, (_, i) => shiftDate(from, i));

  let daily: CoachStudentView['daily'] = null;
  if (share.daily) {
    const [dayStart, dayEnd] = dayBounds(date, student.timezone);
    const gate = await taskGate(db, id);
    const [checkins, ticks, due, done, act, ntd] = await Promise.all([
      db.prepare("SELECT source_id AS d FROM xp_events WHERE user_id = ? AND source = 'checkin' AND source_id >= ? AND source_id <= ?").bind(id, from, date).all<{ d: string }>(),
      db.prepare("SELECT substr(completed_at, 1, 10) AS d, COUNT(*) AS n FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ? GROUP BY d").bind(id, `${from}T00:00:00`).all<{ d: string; n: number }>(),
      db.prepare("SELECT * FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'active' AND COALESCE(do_date, due_date) IS NOT NULL AND COALESCE(do_date, due_date) <= ? ORDER BY COALESCE(do_date, due_date) ASC, CASE WHEN due_time IS NULL THEN 1 ELSE 0 END, due_time ASC LIMIT 20").bind(id, date).all<NodeRow>(),
      db.prepare("SELECT * FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ? AND completed_at < ? ORDER BY completed_at DESC LIMIT 20").bind(id, dayStart, dayEnd).all<NodeRow>(),
      db.prepare('SELECT relationship FROM spark_completions WHERE user_id = ? AND date = ?').bind(id, date).first<{ relationship: RelationshipKey }>(),
      notToDoList(db, id, date),
    ]);
    const perDay = new Map(ticks.results.map((t) => [t.d, t.n]));
    daily = {
      streak: student.streak,
      bestStreak: student.best_streak,
      lastCheckin: student.last_checkin,
      checkedIn: student.last_checkin === date,
      xp: student.xp,
      checkins: [...new Set(checkins.results.map((r) => r.d))].sort(),
      tasksByDay: days30.map((d) => perDay.get(d) ?? 0),
      tasks: due.results.map((t) => toNode(t, gate)),
      done: done.results.map((t) => toNode(t, gate)),
      smallAct: { relationship: act?.relationship ?? null, done: Boolean(act) },
      notToDo: ntd,
    };
  }

  let pillars: CoachStudentView['pillars'] = null;
  if (share.pillars) {
    const gate = await taskGate(db, id);
    const [scores, nodes] = await Promise.all([
      db.prepare('SELECT relationship, xp FROM relationship_scores WHERE user_id = ?').bind(id).all<{ relationship: RelationshipKey; xp: number }>(),
      // A pyramid is a short tree, read whole: no person has more than a few hundred layers.
      db.prepare("SELECT * FROM nodes WHERE user_id = ? AND status != 'archived' ORDER BY sort_order ASC, created_at ASC LIMIT 500").bind(id).all<NodeRow>(),
    ]);
    pillars = { relationships: scores.results.map((s) => ({ key: s.relationship, xp: s.xp })), nodes: nodes.results.map((n) => toNode(n, gate)) };
  }

  let routine: CoachStudentView['routine'] = null;
  let lifeMap: CoachStudentView['lifeMap'] = null;
  if (share.routine || share.lifeMap) {
    const s = await latest(db, id, date);
    // Practices (the mantra, the breathing, the page to read) stay with the student, and so does the signed name.
    if (share.routine) {
      const contract = s.contract ? { minDays: s.contract.minDays, checkinTime: s.contract.checkinTime, penalty: s.contract.penalty, nextWeekly: s.contract.nextWeekly, nextMonthly: s.contract.nextMonthly, signedAt: s.contract.signedAt } : null;
      routine = { general: s.routine?.general ?? [], exceptional: s.routine?.exceptional ?? [], contract, today: s.today, week: s.week };
    }
    if (share.lifeMap && s.assessment) {
      const a = s.assessment;
      lifeMap = { placements: a.placements, fears: a.fears, insecurities: a.insecurities, scores: a.scores, realDay: a.realDay, focus: a.focus, createdAt: a.createdAt };
    }
  }

  let reflection: CoachStudentView['reflection'] = null;
  if (share.reflection) {
    const ask = pageOf(c, 'rev');
    const [wellbeing, logs, rows] = await Promise.all([
      wellbeingSummary(db, id, date, student.streak),
      // The numbers only: the note column is never read for a coach.
      db.prepare('SELECT date, kind, value FROM wellbeing_logs WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC, created_at ASC').bind(id, from, date).all<{ date: string; kind: string; value: number }>(),
      db.prepare('SELECT * FROM reviews WHERE user_id = ? ORDER BY period_start DESC, updated_at DESC LIMIT ? OFFSET ?').bind(id, ask.limit, ask.offset).all<ReviewRow>(),
    ]);
    const tracker = (date: string): CoachTrackerDay => {
      const of = (kind: string) => logs.results.filter((l) => l.date === date && l.kind === kind);
      return {
        date,
        mood: of('mood').at(-1)?.value ?? null,
        sleep: of('sleep').at(-1)?.value ?? null,
        stress: of('stress').at(-1)?.value ?? null,
        mindful: of('mindful').reduce((a, l) => a + l.value, 0),
        move: of('move').reduce((a, l) => a + l.value, 0),
      };
    };
    const pg = paged(rows.results, ask);
    // A saved review keeps a snapshot of every app's numbers, journal and money among them: a coach gets the words, not the snapshot.
    reflection = { wellbeing, days: days30.map(tracker), reviews: pg.items.map((r) => ({ ...toReview(r), snapshot: null })), reviewsPage: pg.page };
  }

  return {
    link: toLink(link),
    date,
    daily,
    pillars,
    routine,
    lifeMap,
    reflection,
    ...(await notePage(db, { coachId: link.coach_id, studentId: id }, viewer.id, c, 'note')),
    ...(await logPage(db, { coachId: link.coach_id, studentId: id }, c, 'log')),
  };
}
