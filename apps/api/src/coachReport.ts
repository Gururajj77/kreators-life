import { coachPatternsFrom, coachPeriodNumbers, coachSuggestions } from '@kreators/shared/coachReport';
import { insightsFor } from '@kreators/shared/insights';
import {
  DEFAULT_ZONE,
  INSIGHT_WINDOW_DAYS,
  isRelationshipKey,
  KINDS,
  parseCoachShare,
  periodFor,
  projectPace,
  RELATIONSHIPS,
  zonedToUtc,
  type CoachPatternsAnswer,
  type CoachPeriodNumbers,
  type CoachPillarRow,
  type CoachReport,
  type InsightFacts,
  type Period,
  type PeriodKind,
  type RelationshipKey,
} from '@kreators/shared';
import type { UserRow } from './env';
import { resolveAccess } from './access';
import { localDay, trackerDays, type LinkRow } from './coaching';
import { shiftDate, streakNow } from './db';
import { numbersContext, numbersFor, summaryFor } from './routes/reviews';

/**
 * A life coach's report on one student (2026-11-07): the picked period's numbers, charts' series, pillars and pace, and the patterns and
 * suggestions. Every read is decided by the link's share, read fresh by the caller on every request (`myStudent` in routes/coach.ts), and
 * what comes out has passed the allow-lists in shared `coachReport.ts`: `COACH_PERIOD_FIELDS` for a period's numbers, `COACH_PATTERN_KEYS`
 * and `coachPatternsFrom` for patterns. `numbersFor` reads a person's whole period on the server (the journal and money among them), which
 * is why nothing of it is ever passed along whole. Stored nowhere.
 */

interface NodeLite {
  id: string;
  kind: CoachPillarRow['layers'][number]['kind'];
  parent_id: string | null;
  relationship: RelationshipKey;
  title: string;
  status: 'active' | 'done' | 'archived';
  due_date: string | null;
  created_at: string;
}

/** Each pillar's layers (how many made, how many done) and each project's pace. Pillars only. */
async function pillarRows(db: D1Database, id: string, today: string): Promise<CoachPillarRow[]> {
  const [scores, nodes] = await Promise.all([
    db.prepare('SELECT relationship, xp FROM relationship_scores WHERE user_id = ?').bind(id).all<{ relationship: RelationshipKey; xp: number }>(),
    db.prepare("SELECT id, kind, parent_id, relationship, title, status, due_date, created_at FROM nodes WHERE user_id = ? AND status != 'archived' ORDER BY sort_order ASC, created_at ASC LIMIT 2000").bind(id).all<NodeLite>(),
  ]);
  return RELATIONSHIPS.map((r): CoachPillarRow => {
    const mine = nodes.results.filter((n) => n.relationship === r.key);
    const tasksOf = (projectId: string) => mine.filter((t) => t.kind === 'task' && t.parent_id === projectId);
    return {
      key: r.key,
      xp: scores.results.find((s) => s.relationship === r.key)?.xp ?? 0,
      layers: KINDS.map((kind) => {
        const here = mine.filter((n) => n.kind === kind);
        return { kind, total: here.length, done: here.filter((n) => n.status === 'done').length };
      }),
      projects: mine
        .filter((n) => n.kind === 'project')
        .map((p) => {
          const tasks = tasksOf(p.id);
          const done = tasks.filter((t) => t.status === 'done').length;
          return { id: p.id, title: p.title, status: p.status, dueDate: p.due_date, done, total: tasks.length, pace: projectPace(p.created_at, p.due_date, done, tasks.length, today) };
        })
        .sort((a, b) => Number(a.status !== 'active') - Number(b.status !== 'active')),
    };
  });
}

/** The routine's last seven days ending on the student's today, and what the contract asks. Routine only. */
async function routineWeek(db: D1Database, id: string, today: string): Promise<{ days: (boolean | null)[]; kept: number; minDays: number | null }> {
  const from = shiftDate(today, -6);
  const [days, contract] = await Promise.all([
    db.prepare('SELECT day, done FROM routine_days WHERE user_id = ? AND day >= ? AND day <= ?').bind(id, from, today).all<{ day: string; done: number }>(),
    db.prepare('SELECT min_days FROM contracts WHERE user_id = ? ORDER BY signed_at DESC LIMIT 1').bind(id).first<{ min_days: number }>(),
  ]);
  const byDay = new Map(days.results.map((d) => [d.day, d.done === 1]));
  const week = Array.from({ length: 7 }, (_, i) => byDay.get(shiftDate(from, i)) ?? null);
  return { days: week, kept: week.filter(Boolean).length, minDays: contract?.min_days ?? null };
}

/** The report for the period the coach picked, ending no later than the student's own today. */
export async function coachReport(db: D1Database, link: LinkRow, student: UserRow, kind: PeriodKind, date: string | undefined): Promise<CoachReport> {
  const share = parseCoachShare(link.share_json);
  const today = localDay(student.timezone);
  const p = periodFor(kind, date && date <= today ? date : today);
  const previous: Period = periodFor(kind, shiftDate(p.start, -1));
  const blank: CoachPeriodNumbers = { days: 0 };
  // Only for parts that are shared: with none of them on there is nothing to read at all.
  const summary = share.daily || share.pillars || share.routine || share.reflection ? await summaryFor(db, student.id, p) : null;
  const [pillars, routine] = await Promise.all([share.pillars ? pillarRows(db, student.id, today) : null, share.routine ? routineWeek(db, student.id, today) : null]);
  return {
    period: p,
    previous,
    date: today,
    now: summary ? coachPeriodNumbers(summary.now, share) : blank,
    before: summary ? coachPeriodNumbers(summary.before, share) : blank,
    streak: share.daily ? { current: streakNow(student.streak, student.last_checkin, today), best: student.best_streak, checkedIn: student.last_checkin === today } : null,
    series: share.daily && summary ? summary.series.map((s) => ({ date: s.date, tasks: s.tasks, xp: s.xp })) : null,
    xpByPillar: share.pillars && summary ? RELATIONSHIPS.map((r) => ({ key: r.key, xp: Math.max(0, summary.xpByArea[r.key] ?? 0) })) : null,
    pillars,
    routine,
  };
}

/**
 * The facts the Emerging rules read for a coach: only what is shared, and the reads for anything else are never sent. Never the journal,
 * gratitude, money, Discover, water, focus, time blocks, reviews' numbers, Agency or any note: those fields stay empty, so no rule can
 * reach them. Wellbeing rows carry the kind, the day and the number (a fasting day left out), and only for apps that are on for the
 * student, the same as their own Emerging.
 */
async function factsFor(db: D1Database, student: UserRow, share: ReturnType<typeof parseCoachShare>, today: string): Promise<InsightFacts> {
  const uid = student.id;
  const zone = student.timezone || DEFAULT_ZONE;
  const from = shiftDate(today, -(INSIGHT_WINDOW_DAYS - 1));
  const fromTs = zonedToUtc(from, 0, zone).toISOString();
  const from30Utc = zonedToUtc(shiftDate(today, -29), 0, zone).toISOString();
  const { access } = await resolveAccess(db, student);
  const on = (k: string) => Boolean(access[k]?.on);
  const apps = share.reflection ? ['mood', 'sleep', 'stress', 'mindful', 'fitness', 'run'].filter(on) : [];
  const kinds = share.reflection ? [...['mood', 'sleep', 'stress', 'mindful'].filter(on), ...(on('fitness') || on('run') ? ['move'] : []), ...(on('fitness') ? ['eat'] : [])] : [];
  const tasks = share.daily || share.pillars;
  const read = async <T>(yes: boolean, s: () => D1PreparedStatement): Promise<T[]> => (yes ? (await s().all<T>()).results : []);
  const [done, open, projects, xp, checkins, first, wellbeing, items, marks, routine, focus] = await Promise.all([
    read<{ id: string; title: string; relationship: RelationshipKey; parent_id: string | null; completed_at: string; repeats: number; habit: number | null }>(tasks, () =>
      db.prepare("SELECT id, title, relationship, parent_id, completed_at, (repeat_json IS NOT NULL OR spawned_from IS NOT NULL) AS repeats, habit FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ? ORDER BY completed_at DESC LIMIT 3000").bind(uid, fromTs),
    ),
    read<{ id: string; title: string; relationship: RelationshipKey; parent_id: string | null; repeats: number; habit: number | null; open_day: string | null }>(tasks, () =>
      db.prepare("SELECT * FROM (SELECT rowid AS rid, id, title, relationship, parent_id, (repeat_json IS NOT NULL) AS repeats, habit, COALESCE(do_date, due_date) AS open_day FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'active' ORDER BY updated_at DESC, id LIMIT 1000) ORDER BY rid").bind(uid),
    ),
    read<{ id: string; relationship: RelationshipKey }>(tasks, () => db.prepare("SELECT id, relationship FROM nodes WHERE user_id = ? AND kind = 'project' AND status = 'active' ORDER BY updated_at DESC, id LIMIT 500").bind(uid)),
    read<{ relationship: RelationshipKey; xp: number }>(share.pillars, () => db.prepare('SELECT relationship, SUM(amount) AS xp FROM xp_events WHERE user_id = ? AND created_at >= ? AND relationship IS NOT NULL GROUP BY relationship').bind(uid, from30Utc)),
    read<{ day: string }>(share.daily, () => db.prepare("SELECT DISTINCT source_id AS day FROM xp_events WHERE user_id = ? AND source = 'checkin' AND source_id >= ?").bind(uid, from)),
    read<{ first: string | null }>(share.daily, () => db.prepare("SELECT MIN(source_id) AS first FROM xp_events WHERE user_id = ? AND source = 'checkin'").bind(uid)),
    read<{ kind: string; date: string; value: number }>(kinds.length > 0, () => db.prepare(`SELECT kind, date, value FROM wellbeing_logs WHERE user_id = ? AND date >= ? AND kind IN (${kinds.map(() => '?').join(', ')}) AND NOT (kind = 'eat' AND value < 1)`).bind(uid, from, ...kinds)),
    read<{ id: string; title: string; relationship: string | null }>(share.daily, () => db.prepare('SELECT id, title, relationship FROM not_to_do WHERE user_id = ? ORDER BY created_at LIMIT 50').bind(uid)),
    read<{ item_id: string; day: string; status: string }>(share.daily, () => db.prepare('SELECT item_id, day, status FROM not_to_do_days WHERE user_id = ? AND day >= ?').bind(uid, from)),
    read<{ day: string; done: number }>(share.routine, () => db.prepare('SELECT day, done FROM routine_days WHERE user_id = ? AND day >= ?').bind(uid, from)),
    read<{ focus_json: string }>(share.lifeMap, () => db.prepare('SELECT focus_json FROM assessments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(uid)),
  ]);
  const habitOf = (v: number | null) => (v === null || v === undefined ? null : v === 1);
  const doneFacts = done.filter((r) => r.completed_at && isRelationshipKey(r.relationship)).map((r) => ({ id: r.id, title: r.title, relationship: r.relationship, parentId: r.parent_id, completedAt: r.completed_at, repeats: r.repeats === 1, habit: habitOf(r.habit), timeBlockId: null }));
  const ticks30 = new Map<RelationshipKey, number>();
  for (const t of doneFacts) if (t.completedAt >= from30Utc) ticks30.set(t.relationship, (ticks30.get(t.relationship) ?? 0) + 1);
  const rels = new Set<RelationshipKey>([...xp.map((r) => r.relationship).filter(isRelationshipKey), ...(share.pillars ? ticks30.keys() : [])]);
  const perDay = new Map<string, { day: string; slipped: number; kept: number }>();
  for (const m of marks) {
    const d = perDay.get(m.day) ?? { day: m.day, slipped: 0, kept: 0 };
    if (m.status === 'slipped') d.slipped += 1;
    else if (m.status === 'kept') d.kept += 1;
    perDay.set(m.day, d);
  }
  let focusPillars: RelationshipKey[] = [];
  try {
    focusPillars = focus[0] ? (JSON.parse(focus[0].focus_json) as RelationshipKey[]).filter(isRelationshipKey) : [];
  } catch {
    focusPillars = [];
  }
  return {
    today,
    zone,
    currency: 'INR',
    apps,
    rel: null,
    done: doneFacts,
    open: open.filter((r) => isRelationshipKey(r.relationship)).map((r) => ({ id: r.id, title: r.title, relationship: r.relationship, parentId: r.parent_id, repeats: r.repeats === 1, habit: habitOf(r.habit), openDay: r.open_day })),
    projects: projects.filter((r) => isRelationshipKey(r.relationship)),
    xp30: [...rels].map((k) => ({ relationship: k, xp: Math.max(0, xp.find((r) => r.relationship === k)?.xp ?? 0), ticks: ticks30.get(k) ?? 0 })),
    focusPillars,
    checkins: checkins.map((r) => r.day),
    firstCheckin: first[0]?.first ?? null,
    wellbeing,
    focus: [],
    notToDo: [...perDay.values()],
    notToDoItems: items.map((r) => ({ id: r.id, title: r.title, relationship: r.relationship && isRelationshipKey(r.relationship) ? r.relationship : null })),
    notToDoMarks: marks.filter((r) => r.status === 'kept' || r.status === 'slipped').map((r) => ({ itemId: r.item_id, day: r.day, status: r.status as 'kept' | 'slipped' })),
    water: [],
    waterGoal: null,
    dayTypes: [],
    routine: routine.map((r) => ({ day: r.day, done: r.done === 1 })),
    journalAt: [],
    gratitudeDays: [],
    expenses: [],
    review: null,
    discover: null,
    agencyDue: [],
  };
}

const WEEK_MS = 7 * 86_400_000;

/**
 * Patterns (with the Patterns part on) and the suggestions. A suggestion from a number the student shares follows that number's own part; one
 * from a pattern needs Patterns too. The rolling seven days (today back) and the seven before are read so an early Monday never reads
 * as a bad week.
 */
export async function coachPatterns(db: D1Database, link: LinkRow, student: UserRow): Promise<CoachPatternsAnswer> {
  const share = parseCoachShare(link.share_json);
  const today = localDay(student.timezone);
  const id = student.id;
  const list = share.patterns ? insightsFor(await factsFor(db, student, share, today)) : [];
  const { patterns, forming } = coachPatternsFrom(list, share);

  const ctx = share.daily || share.routine || share.reflection ? await numbersContext(db, id) : null;
  const seven: Period = { kind: 'week', start: shiftDate(today, -6), end: today };
  const prior: Period = { kind: 'week', start: shiftDate(today, -13), end: shiftDate(today, -7) };
  const blank: CoachPeriodNumbers = { days: 7 };
  const [now, before, tracked, pillars, routine, last] = await Promise.all([
    ctx ? numbersFor(db, id, seven, { ctx }).then((n) => coachPeriodNumbers(n, share)) : blank,
    ctx ? numbersFor(db, id, prior, { ctx }).then((n) => coachPeriodNumbers(n, share)) : blank,
    share.reflection ? trackerDays(db, id, Array.from({ length: 30 }, (_, i) => shiftDate(today, i - 29))) : null,
    share.pillars ? pillarRows(db, id, today) : null,
    share.routine ? routineWeek(db, id, today) : null,
    share.reflection && ctx?.on('reviews') ? db.prepare("SELECT MAX(period_end) AS end FROM reviews WHERE user_id = ? AND kind != 'day'").bind(id).first<{ end: string | null }>() : null,
  ]);
  const projects = pillars ? pillars.flatMap((r) => r.projects.filter((p) => p.status === 'active').map((p) => ({ id: p.id, title: p.title, relationship: r.key, pace: p.pace.status }))) : null;
  const suggestions = coachSuggestions({
    share,
    today,
    days: tracked?.days ?? null,
    now,
    before,
    streak: share.daily ? streakNow(student.streak, student.last_checkin, today) : null,
    lastCheckin: share.daily ? student.last_checkin : null,
    projects,
    routine: routine ? { kept: routine.kept, minDays: routine.minDays } : null,
    lastReview: last === null ? null : { on: true, end: last.end },
    patterns,
  });
  const asked = link.patterns_asked_at;
  const again = asked ? Date.parse(asked) + WEEK_MS : 0;
  return { on: share.patterns, patterns, forming, suggestions, askedAt: asked, askAgainFrom: again > Date.now() ? new Date(again).toISOString().slice(0, 10) : null };
}
