import { Hono } from 'hono';
import {
  MAX_REVIEW_FLAGGED,
  type Priority,
  type ReviewFlagged,
  MAX_REVIEW_SCHEDULES,
  nextOnOrAfter,
  occurrencesBetween,
  parseRepeat,
  repeatLabel,
  REVIEW_REMINDER_TIME,
  REVIEW_SCHEDULE_NAME_MAX,
  type ReviewCalendarDay,
  type ReviewCalendarResponse,
  type ReviewSchedule,
  builtInTemplateFor,
  reviewNameFor,
  projectPace,
  RELATIONSHIPS,
  REVIEW_LAYER,
  REVIEW_LAYER_PER_PILLAR,
  type ReviewLayer,
  type ReviewLayerItem,
  type ReviewLayerKind,
  MAX_REVIEW_TEMPLATES,
  parseReviewPrompts,
  PERIOD_KINDS,
  periodDays,
  periodFor,
  periodShift,
  REVIEW_ANSWER_MAX,
  REVIEW_HIGHLIGHT_MAX,
  REVIEW_NAME_MAX,
  type Period,
  type PeriodKind,
  type PeriodNumbers,
  type RelationshipKey,
  type Review,
  type ReviewListItem,
  type ReviewSummary,
  type ReviewTemplate,
  type ReviewsResponse,
  type Page,
  monthShift,
  DEFAULT_ZONE,
  localStamp,
  isoWeekday,
  zonedToUtc,
  builtInTemplates,
  type ReviewTemplatesResponse,
} from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { DATE_RE, dayFromDevice, dayInZone, newId, nowIso, pageOf, paged, personDay, shiftDate, str } from '../db';
import { supplementOnList } from '../fitness';
import { resolveAccess } from '../access';
import { kindsBetween, loadBlocking, type Blocking } from '../timeBlocks';

/** Reviews: the numbers for a period from every app, and the review a person writes about it. */
export const reviews = new Hono<AppEnv>();

const today = () => new Date().toISOString().slice(0, 10);
const kindOf = (v: string | undefined): PeriodKind | null => (v && (PERIOD_KINDS as readonly string[]).includes(v) ? (v as PeriodKind) : null);
const dateOf = (v: string | undefined) => (v && DATE_RE.test(v) ? v : today());
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const round1 = (v: number) => Math.round(v * 10) / 10;

interface TemplateRow { id: string; user_id: string; kind: PeriodKind; name: string; prompts_json: string; created_at: string; updated_at: string }
export interface ReviewRow { id: string; user_id: string; kind: PeriodKind; period_start: string; period_end: string; template_id: string | null; template_name: string; prompts_json: string; answers_json: string; rating: number | null; highlight: string; snapshot_json: string; created_at: string; updated_at: string }

function strings(raw: string): string[] {
  try {
    const v = JSON.parse(raw || '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
const toTemplate = (r: TemplateRow): ReviewTemplate => ({ id: r.id, kind: r.kind, name: r.name, prompts: strings(r.prompts_json), builtIn: false, createdAt: r.created_at });
export function toReview(r: ReviewRow): Review {
  let snapshot: ReviewSummary | null = null;
  try {
    const v = JSON.parse(r.snapshot_json || '{}') as ReviewSummary;
    snapshot = v && typeof v === 'object' && 'now' in v ? v : null;
  } catch {
    snapshot = null;
  }
  return { id: r.id, kind: r.kind, start: r.period_start, end: r.period_end, templateId: r.template_id, templateName: r.template_name, prompts: strings(r.prompts_json), answers: strings(r.answers_json), rating: r.rating, highlight: r.highlight, snapshot, createdAt: r.created_at, updatedAt: r.updated_at };
}

/**
 * Who a period's numbers are for, read once per summary: their zone and their own today (`dayInZone`), when they joined (for the kinds of
 * day), and which apps are on for them (`resolveAccess`, the same rule as the module gate), so a part whose app is off is never read.
 */
export interface NumbersContext {
  zone: string;
  localToday: string;
  createdAt: string | null;
  timezone: string | null;
  on: (key: string) => boolean;
  /** The one read of the person's day templates for a summary's two periods. */
  blocking?: Promise<Blocking>;
}
export async function numbersContext(db: D1Database, userId: string): Promise<NumbersContext> {
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();
  const zone = user?.timezone || DEFAULT_ZONE;
  const access = user ? (await resolveAccess(db, user)).access : {};
  return { zone, localToday: dayInZone(zone), createdAt: user?.created_at ?? null, timezone: user?.timezone ?? null, on: (k) => Boolean(access[k]?.on) };
}

/**
 * A period's window in UTC stamps, from the person's own midnight to the midnight after its last day (`zonedToUtc`, the one zone
 * conversion; a zone the runtime does not know falls back to UTC midnights). `localDay` groups a stamp column by the person's own day in
 * SQL, by the zone's offset at the period's start (a clock change inside the period moves a stamp near midnight by an hour at most).
 */
export function periodWindow(p: Period, zone: string): { fromTs: string; toTs: string; localDay: (col: string) => string } {
  const at = (day: string) => {
    try {
      return zonedToUtc(day, 0, zone).toISOString();
    } catch {
      return `${day}T00:00:00.000Z`;
    }
  };
  const fromTs = at(p.start);
  const toTs = at(shiftDate(p.end, 1));
  const offset = Math.round((Date.parse(`${p.start}T00:00:00.000Z`) - Date.parse(fromTs)) / 60_000);
  return { fromTs, toTs, localDay: (col) => `substr(datetime(${col}, '${offset >= 0 ? '+' : ''}${offset} minutes'), 1, 10)` };
}

/** The months a period touches, as YYYY-MM, up to the person's own month (a budget is never checked against a month still to come). */
function monthsOf(p: Period, localToday: string): string[] {
  const last = (p.end < localToday ? p.end : localToday).slice(0, 7);
  const out: string[] = [];
  for (let m = p.start.slice(0, 7); m <= last && out.length < 13; m = monthShift(m, 1)) out.push(m);
  return out;
}

/**
 * Everything that happened in one period, pulled from each app's own table: the one read every review and every "By period" block builds
 * on (and the later life dashboard by period). Any period kind, the day included: `numbersFor(db, userId, periodFor(kind, day))`. Owner
 * only: every statement filters by the user. Stamps are read in the person's own zone (`periodWindow`). Journal and wellbeing stay with the
 * owner; money is summed only in the person's own currency. The fuller parts of 2026-11-07 (water, focus, the task and routine extras, the
 * money extras) are read only while their app is on (water, tasks and the routine are core), and supplements only when `supplements` is asked for (GET
 * /reviews and its snapshot) and Track supplements is on: never for the dashboards, Emerging, a coach, the assistant or the brief. Pass a
 * `ctx` from `numbersContext` when reading two periods for one person, so the user row and the module switches are read once.
 */
export async function numbersFor(db: D1Database, userId: string, p: Period, opts: { ctx?: NumbersContext; supplements?: boolean } = {}): Promise<PeriodNumbers> {
  const ctx = opts.ctx ?? (await numbersContext(db, userId));
  const from = p.start;
  const to = p.end;
  const { fromTs, toTs, localDay } = periodWindow(p, ctx.zone);
  // "At the period's end": its last midnight once it is over, and now while it is still going.
  const over = to < ctx.localToday;
  const endTs = over ? toTs : nowIso();
  const dueBefore = over ? shiftDate(to, 1) : ctx.localToday;
  const cur = "(SELECT COALESCE(NULLIF(currency, ''), 'INR') FROM users WHERE id = ?1)";
  const focusOn = ctx.on('mindful');
  const moneyOn = ctx.on('finance');
  const suppOn = Boolean(opts.supplements) && ctx.on('fitness');
  // Kinds of day (2026-11-06): the period's days up to the person's own today, each with the template set for it or given by the week.
  const kindsRead = (async () => {
    const upTo = to < ctx.localToday ? to : ctx.localToday;
    if (upTo < from) return { kindDays: 0, kinds: [] };
    const days = periodDays({ ...p, start: from, end: upTo });
    const { kinds, colors } = await kindsBetween(db, { id: userId, created_at: ctx.createdAt, timezone: ctx.timezone }, from, upTo, { read: ctx.blocking ?? loadBlocking(db, userId, days, { slots: false }) });
    return { kindDays: kinds.tally.reduce((s, t) => s + t.days, 0), kinds: kinds.tally.slice(0, 3).map((t) => ({ name: t.name, days: t.days, color: colors[t.templateId] ?? null })) };
  })();
  const none = Promise.resolve(null);
  const [daily, xp, ntd, wb, journal, fin, shop, school, work, people, kindsNow, water, focus, dues, budgets, spend, goals, supp] = await Promise.all([
    db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM xp_events WHERE user_id = ?1 AND source = 'checkin' AND source_id >= ?2 AND source_id <= ?3) AS checkins,
          (SELECT COUNT(*) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'done' AND completed_at >= ?4 AND completed_at < ?5) AS tasks,
          (SELECT COUNT(*) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'done' AND completed_at >= ?4 AND completed_at < ?5 AND COALESCE(habit, CASE WHEN repeat_json IS NOT NULL THEN 1 ELSE 0 END) = 1) AS habits,
          (SELECT COUNT(*) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'done' AND completed_at >= ?4 AND completed_at < ?5 AND priority IN (0, 1)) AS top,
          (SELECT COUNT(*) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'active' AND due_date IS NOT NULL AND due_date < ?6 AND created_at < ?7)
            + (SELECT COUNT(*) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'done' AND completed_at >= ?7 AND due_date IS NOT NULL AND due_date < ?6 AND created_at < ?7) AS overdue,
          (SELECT COUNT(*) FROM routine_days WHERE user_id = ?1 AND day >= ?2 AND day <= ?3 AND done = 1) AS routine,
          (SELECT COUNT(*) FROM spark_completions WHERE user_id = ?1 AND date >= ?2 AND date <= ?3) AS acts`,
      )
      .bind(userId, from, to, fromTs, toTs, dueBefore, endTs)
      .first<{ checkins: number; tasks: number; habits: number; top: number; overdue: number; routine: number; acts: number }>(),
    db.prepare(`SELECT COALESCE(SUM(amount), 0) AS xp, COUNT(DISTINCT ${localDay('created_at')}) AS days FROM xp_events WHERE user_id = ? AND created_at >= ? AND created_at < ?`).bind(userId, fromTs, toTs).first<{ xp: number; days: number }>(),
    db
      .prepare("SELECT SUM(CASE WHEN status = 'kept' THEN 1 ELSE 0 END) AS kept, SUM(CASE WHEN status = 'slipped' THEN 1 ELSE 0 END) AS slipped FROM not_to_do_days WHERE user_id = ? AND day >= ? AND day <= ?")
      .bind(userId, from, to)
      .first<{ kept: number | null; slipped: number | null }>(),
    // A fasting day's eating check-in (value 0) has no score, so it is left out of the eating average.
    db.prepare("SELECT kind, COUNT(*) AS n, COUNT(DISTINCT date) AS days, SUM(value) AS total FROM wellbeing_logs WHERE user_id = ? AND date >= ? AND date <= ? AND NOT (kind = 'eat' AND value < 1) GROUP BY kind").bind(userId, from, to).all<{ kind: string; n: number; days: number; total: number }>(),
    // Gratitude for the day (migration 0102) is counted by day, never read: how many days in the period have lines written.
    db
      .prepare('SELECT COUNT(*) AS n, AVG(emotion) AS mood, (SELECT COUNT(*) FROM gratitude_days WHERE user_id = ?1 AND day >= ?4 AND day <= ?5) AS grat FROM journal_entries WHERE user_id = ?1 AND created_at >= ?2 AND created_at < ?3')
      .bind(userId, fromTs, toTs, from, to)
      .first<{ n: number; mood: number | null; grat: number }>(),
    db.prepare(`SELECT kind, COALESCE(SUM(amount_cents), 0) AS cents FROM finance_transactions WHERE user_id = ?1 AND date >= ?2 AND date <= ?3 AND currency = ${cur} GROUP BY kind`).bind(userId, from, to).all<{ kind: string; cents: number }>(),
    db
      .prepare("SELECT COUNT(*) AS n, COALESCE(SUM(cents), 0) AS cents, COALESCE(SUM(points), 0) AS points FROM orders WHERE owner_id = ? AND status IN ('paid', 'test') AND created_at >= ? AND created_at < ?")
      .bind(userId, fromTs, toTs)
      .first<{ n: number; cents: number; points: number }>(),
    db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM lesson_progress WHERE user_id = ?1 AND completed_at >= ?2 AND completed_at < ?3) AS lessons,
                (SELECT COUNT(*) FROM enrollments WHERE learner_user_id = ?1 AND completed_at >= ?2 AND completed_at < ?3) AS programs`,
      )
      .bind(userId, fromTs, toTs)
      .first<{ lessons: number; programs: number }>(),
    db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM applications WHERE creator_user_id = ?1 AND submitted_at >= ?2 AND submitted_at < ?3) AS applications,
                (SELECT COUNT(*) FROM applications WHERE creator_user_id = ?1 AND decision_at >= ?2 AND decision_at < ?3) AS decisions`,
      )
      .bind(userId, fromTs, toTs)
      .first<{ applications: number; decisions: number }>(),
    db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM event_registrations WHERE user_id = ?1 AND registered_at >= ?2 AND registered_at < ?3) AS events,
                (SELECT COUNT(*) FROM community_posts WHERE user_id = ?1 AND created_at >= ?2 AND created_at < ?3) AS posts,
                (SELECT COUNT(*) FROM circle_signups WHERE user_id = ?1 AND created_at >= ?2 AND created_at < ?3) AS circles,
                (SELECT COUNT(*) FROM run_entries WHERE user_id = ?1 AND status = 'logged' AND logged_at >= ?2 AND logged_at < ?3) AS runs,
                (SELECT COALESCE(SUM(metres), 0) FROM run_entries WHERE user_id = ?1 AND status = 'logged' AND logged_at >= ?2 AND logged_at < ?3) AS run_metres`,
      )
      .bind(userId, fromTs, toTs)
      .first<{ events: number; posts: number; circles: number; runs: number; run_metres: number }>(),
    kindsRead,
    // Water (core, pays nothing): the days with water logged, their total, and the days the goal (as set now) was met.
    db
      .prepare(
        `SELECT COUNT(*) AS days, COALESCE(SUM(ml), 0) AS total,
           SUM(CASE WHEN ml >= COALESCE((SELECT water_goal_ml FROM reminder_prefs WHERE user_id = ?1), 2000) THEN 1 ELSE 0 END) AS met
         FROM (SELECT SUM(ml) AS ml FROM water_logs WHERE user_id = ?1 AND day >= ?2 AND day <= ?3 GROUP BY day HAVING SUM(ml) > 0)`,
      )
      .bind(userId, from, to)
      .first<{ days: number; total: number; met: number | null }>(),
    // Focus (Mindfulness): sessions on the period's days; AVG leaves an unrated session (quality NULL) out, never counts it as a zero.
    focusOn ? db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(minutes), 0) AS min, AVG(quality) AS quality FROM focus_rounds WHERE user_id = ? AND day >= ? AND day <= ?').bind(userId, from, to).first<{ n: number; min: number; quality: number | null }>() : none,
    // Finance (each only while it is on): dues still open at the period's end, owed to you and by you, in the person's own currency.
    moneyOn
      ? db
          .prepare(
            `SELECT COALESCE(SUM(CASE WHEN direction = 'owed' THEN amount_cents END), 0) AS owed, COALESCE(SUM(CASE WHEN direction = 'owe' THEN amount_cents END), 0) AS owe
             FROM finance_dues WHERE user_id = ?1 AND currency = ${cur} AND created_at < ?2 AND (status = 'open' OR (settled_at IS NOT NULL AND settled_at >= ?2))`,
          )
          .bind(userId, endTs)
          .first<{ owed: number; owe: number }>()
      : none,
    moneyOn ? db.prepare('SELECT category, monthly_cents FROM finance_budgets WHERE user_id = ? AND monthly_cents > 0').bind(userId).all<{ category: string; monthly_cents: number }>() : none,
    // Each month's spending by category, from the first of the period's first month to its end, for the budgets.
    moneyOn
      ? db
          .prepare(`SELECT substr(date, 1, 7) AS m, category, SUM(amount_cents) AS cents FROM finance_transactions WHERE user_id = ?1 AND kind = 'expense' AND currency = ${cur} AND date >= ?2 AND date <= ?3 GROUP BY m, category`)
          .bind(userId, `${from.slice(0, 7)}-01`, to)
          .all<{ m: string; category: string; cents: number }>()
      : none,
    // Savings goals as they stand today: the app keeps no dated record of each amount put in, so only a period that holds today has them.
    moneyOn && !over && from <= ctx.localToday
      ? db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(saved_cents), 0) AS saved, COALESCE(SUM(target_cents), 0) AS target, SUM(CASE WHEN saved_cents >= target_cents THEN 1 ELSE 0 END) AS reached FROM finance_goals WHERE user_id = ? AND kind = 'save'").bind(userId).first<{ n: number; saved: number; target: number; reached: number | null }>()
      : none,
    // Supplements: only Reviews' own read, only while Track supplements is on. The list (twelve at most) and the ticks; counts only.
    suppOn
      ? db
          .batch([
            db.prepare('SELECT supplements_on FROM fitness_prefs WHERE user_id = ?').bind(userId),
            db.prepare('SELECT id, days_json, created_at, paused_at, pauses_json FROM supplements WHERE user_id = ? LIMIT 50').bind(userId),
            db.prepare('SELECT supplement_id, day FROM supplement_days WHERE user_id = ? AND day >= ? AND day <= ?').bind(userId, from, to),
          ])
          .then((r) => r as unknown as [D1Result<{ supplements_on: number }>, D1Result<{ id: string; days_json: string; created_at: string; paused_at: string | null; pauses_json: string }>, D1Result<{ supplement_id: string; day: string }>])
      : none,
  ]);
  const log = (kind: string) => wb.results.find((w) => w.kind === kind);
  const avgOf = (kind: string) => {
    const l = log(kind);
    return l && l.n > 0 ? round1(l.total / l.n) : null;
  };
  const sumOf = (kind: string) => Math.round(n(log(kind)?.total));
  const out: PeriodNumbers = {
    days: periodDays(p).length,
    checkins: n(daily?.checkins),
    tasksDone: n(daily?.tasks),
    smallActs: n(daily?.acts),
    xp: n(xp?.xp),
    activeDays: n(xp?.days),
    notToDoKept: n(ntd?.kept),
    notToDoSlipped: n(ntd?.slipped),
    moodAvg: avgOf('mood'),
    sleepAvg: avgOf('sleep'),
    stressAvg: avgOf('stress'),
    mindfulMin: sumOf('mindful'),
    moveMin: sumOf('move'),
    // Days moved (2026-11-07): distinct days with a movement log, counted, never what or how far.
    moveDays: n(log('move')?.days),
    eatAvg: avgOf('eat'),
    journalEntries: n(journal?.n),
    journalMoodAvg: journal?.mood === null || journal?.mood === undefined ? null : round1(journal.mood),
    gratitudeDays: n(journal?.grat),
    incomeCents: n(fin.results.find((f) => f.kind === 'income')?.cents),
    expenseCents: n(fin.results.find((f) => f.kind === 'expense')?.cents),
    orders: n(shop?.n),
    salesCents: n(shop?.cents),
    salesPoints: n(shop?.points),
    lessonsDone: n(school?.lessons),
    programsDone: n(school?.programs),
    applications: n(work?.applications),
    decisions: n(work?.decisions),
    events: n(people?.events),
    posts: n(people?.posts),
    circles: n(people?.circles),
    runs: n(people?.runs),
    runMetres: n(people?.run_metres),
    kindDays: kindsNow.kindDays,
    kinds: kindsNow.kinds,
    // Water and the task extras are core, so always read.
    waterDays: n(water?.days),
    waterAvgMl: n(water?.days) > 0 ? Math.round(n(water?.total) / n(water?.days)) : null,
    waterGoalDays: n(water?.met),
    habitTicks: n(daily?.habits),
    topPriorityDone: n(daily?.top),
    overdueAtEnd: n(daily?.overdue),
    routineDays: n(daily?.routine),
  };
  if (focus) {
    out.focusMin = n(focus.min);
    out.focusSessions = n(focus.n);
    out.focusQualityAvg = focus.quality === null || focus.quality === undefined ? null : round1(focus.quality);
  }
  if (dues) {
    out.owedToYouCents = n(dues.owed);
    out.youOweCents = n(dues.owe);
  }
  if (budgets && spend) {
    // Each budget against each month the period touches, that month's spending from its first day to the period's end.
    const spent = new Map(spend.results.map((r) => [`${r.m}|${r.category}`, n(r.cents)]));
    let checks = 0;
    let overBudget = 0;
    for (const m of monthsOf(p, ctx.localToday)) {
      for (const b of budgets.results) {
        checks += 1;
        if ((spent.get(`${m}|${b.category}`) ?? 0) > b.monthly_cents) overBudget += 1;
      }
    }
    out.budgetChecks = checks;
    out.budgetsOver = overBudget;
  }
  if (goals && n(goals.n) > 0) {
    out.goalSavedCents = n(goals.saved);
    out.goalTargetCents = n(goals.target);
    out.goalsReached = n(goals.reached);
    out.goalsCount = n(goals.n);
  }
  if (supp && supp[0].results[0]?.supplements_on === 1) {
    // Due: each day of the period up to today on one of its weekdays, from the day it was added, and not after it was paused. A tick
    // from a day it was not due on still counts as a day it was on the list, as Fitness's own week does.
    const upTo = to < ctx.localToday ? to : ctx.localToday;
    const taken = new Map<string, number>();
    for (const t of supp[2].results) taken.set(t.supplement_id, (taken.get(t.supplement_id) ?? 0) + 1);
    let due = 0;
    let took = 0;
    for (const s of supp[1].results) {
      let days: number[] = [];
      try {
        const v = JSON.parse(s.days_json || '[]') as unknown;
        days = Array.isArray(v) ? v.filter((d): d is number => typeof d === 'number') : [];
      } catch {
        days = [];
      }
      const onList = supplementOnList(s, ctx.zone);
      let mine = 0;
      for (let d = from; d <= upTo; d = shiftDate(d, 1)) if (onList(d) && days.includes(isoWeekday(d))) mine += 1;
      const t = taken.get(s.id) ?? 0;
      due += Math.max(mine, t);
      took += t;
    }
    out.suppTaken = took;
    out.suppDue = due;
  }
  return out;
}

/** Just the zone and the person's own today, for the reads that need no module switches (the cron's reminder, the layer). */
async function zoneOf(db: D1Database, userId: string): Promise<Pick<NumbersContext, 'zone' | 'localToday'>> {
  const u = await db.prepare('SELECT timezone FROM users WHERE id = ?').bind(userId).first<{ timezone: string | null }>();
  const zone = u?.timezone || DEFAULT_ZONE;
  return { zone, localToday: dayInZone(zone) };
}

/** The tasks brought to a review: ticked in the period, or still open and planned in it, and open ones with no day while the period is the current one. */
export async function flaggedFor(db: D1Database, userId: string, p: Period, ctx?: Pick<NumbersContext, 'zone' | 'localToday'>): Promise<ReviewFlagged[]> {
  const who = ctx ?? (await zoneOf(db, userId));
  const { fromTs, toTs } = periodWindow(p, who.zone);
  const today = who.localToday;
  const current = p.start <= today && today <= p.end;
  const rows = await db
    .prepare(
      `SELECT id, title, relationship, status, completed_at, do_date, due_date, priority FROM nodes INDEXED BY idx_nodes_for_review
       WHERE user_id = ?1 AND kind = 'task' AND for_review = 1 AND (
         (status = 'done' AND completed_at >= ?2 AND completed_at < ?3)
         OR (status = 'active' AND COALESCE(do_date, due_date) >= ?4 AND COALESCE(do_date, due_date) <= ?5)
         OR (?6 = 1 AND status = 'active' AND do_date IS NULL AND due_date IS NULL))
       ORDER BY CASE status WHEN 'done' THEN 0 ELSE 1 END, COALESCE(completed_at, do_date, due_date, '9999') LIMIT ?7`,
    )
    .bind(userId, fromTs, toTs, p.start, p.end, current ? 1 : 0, MAX_REVIEW_FLAGGED)
    .all<{ id: string; title: string; relationship: RelationshipKey; status: 'done' | 'active'; completed_at: string | null; do_date: string | null; due_date: string | null; priority: number | null }>();
  return rows.results.map((r) => ({ id: r.id, title: r.title, relationship: r.relationship, status: r.status === 'done' ? 'done' : 'open', day: r.status === 'done' ? (r.completed_at ? (localStamp(r.completed_at, who.zone)?.day ?? r.completed_at.slice(0, 10)) : null) : (r.do_date ?? r.due_date), priority: (r.priority as Priority | null) ?? null }));
}

interface LayerNodeRow { id: string; kind: ReviewLayerKind; parent_id: string | null; relationship: RelationshipKey; title: string; status: string; due_date: string | null; created_at: string; completed_at: string | null }
interface LayerTaskRow { pid: string; done_in: number | null; done_by: number | null; total_by: number | null; open: number | null }
/** The most nodes above the task a review's layer reads: far more than anyone keeps, so the read stays bounded. */
const LAYER_NODES_MAX = 2000;
/** The most tasks a day's layer reads (ticked that day, open on it, or late), far more than a day holds. */
const LAYER_DAY_TASKS_MAX = 500;
/** The layer under each one, counted as `below` (projects under a goal outcome, and so on). */
const LAYER_BELOW: Record<ReviewLayerKind, ReviewLayerKind | null> = { pillar: 'principle', principle: 'value_goal', value_goal: 'outcome', outcome: 'project', project: null, task: null };

/**
 * A day's layer (2026-11-07): the tasks, the pyramid's sixth layer, pillar by pillar. Those ticked on the day (in the person's zone), and
 * those open on it as it ended: its do date (else its due date) that day or before, so a late one shows too, made before the day ended and
 * not ticked by then. Each says which project it holds up. Ticked first, then the open ones, the late ones marked. Owner only.
 */
async function dayLayerFor(db: D1Database, userId: string, p: Period, zone: string): Promise<ReviewLayer> {
  const { fromTs, toTs } = periodWindow(p, zone);
  const rows = await db
    .prepare(
      `SELECT t.id, t.title, t.relationship, t.status, t.completed_at, COALESCE(t.do_date, t.due_date) AS open_day, pr.title AS under
       FROM nodes t LEFT JOIN nodes pr ON pr.id = t.parent_id AND pr.user_id = t.user_id
       WHERE t.user_id = ?1 AND t.kind = 'task' AND t.status != 'archived' AND (
         (t.status = 'done' AND t.completed_at >= ?2 AND t.completed_at < ?3)
         OR (t.created_at < ?3 AND COALESCE(t.do_date, t.due_date) <= ?4 AND (t.status = 'active' OR (t.status = 'done' AND t.completed_at >= ?3))))
       ORDER BY CASE WHEN t.status = 'done' AND t.completed_at < ?3 THEN 0 ELSE 1 END, COALESCE(t.do_date, t.due_date) DESC, t.created_at
       LIMIT ?5`,
    )
    .bind(userId, fromTs, toTs, p.start, LAYER_DAY_TASKS_MAX)
    .all<{ id: string; title: string; relationship: RelationshipKey; status: string; completed_at: string | null; open_day: string | null; under: string | null }>();
  const items = rows.results.map((r): ReviewLayerItem => {
    const done = r.status === 'done' && r.completed_at !== null && r.completed_at >= fromTs && r.completed_at < toTs;
    return { id: r.id, title: r.title, relationship: r.relationship, status: done ? 'done' : 'active', under: r.under, done: done ? 1 : 0, open: done ? 0 : 1, below: 0, pace: null, late: !done && r.open_day !== null && r.open_day < p.start };
  });
  return {
    kind: 'task',
    pillars: RELATIONSHIPS.map((rel) => {
      const mine = items.filter((i) => i.relationship === rel.key);
      return { relationship: rel.key, items: mine.slice(0, REVIEW_LAYER_PER_PILLAR), total: mine.length };
    }),
  };
}

/**
 * Reviews by layer (2026-11-07): the person's own items of the layer this kind of review walks (a week the projects, a month the goal
 * outcomes, a quarter the value goals, half a year the guiding principles, a year the foundations), grouped by pillar in their order. Each
 * has the tasks under it ticked in the period and still open as it ended (its projects' tasks, added up the pyramid), and a week's project
 * its pace as the period ended. Those still going as it ended (active now, or done since) and those done inside it; none made after it ended. Owner only: every read filters by the user.
 */
export async function layerFor(db: D1Database, userId: string, p: Period, ctx?: Pick<NumbersContext, 'zone' | 'localToday'>): Promise<ReviewLayer> {
  const who = ctx ?? (await zoneOf(db, userId));
  const kind = REVIEW_LAYER[p.kind];
  if (kind === 'task') return dayLayerFor(db, userId, p, who.zone);
  const { fromTs, toTs } = periodWindow(p, who.zone);
  const [nodes, tasks] = await Promise.all([
    db
      .prepare("SELECT id, kind, parent_id, relationship, title, status, due_date, created_at, completed_at FROM nodes WHERE user_id = ? AND kind IN ('pillar', 'principle', 'value_goal', 'outcome', 'project') AND status != 'archived' ORDER BY sort_order ASC, created_at ASC LIMIT ?")
      .bind(userId, LAYER_NODES_MAX)
      .all<LayerNodeRow>(),
    db
      .prepare(
        `SELECT parent_id AS pid,
           SUM(CASE WHEN status = 'done' AND completed_at >= ?2 AND completed_at < ?3 THEN 1 ELSE 0 END) AS done_in,
           SUM(CASE WHEN status = 'done' AND completed_at < ?3 THEN 1 ELSE 0 END) AS done_by,
           SUM(CASE WHEN created_at < ?3 THEN 1 ELSE 0 END) AS total_by,
           SUM(CASE WHEN created_at < ?3 AND (status = 'active' OR (status = 'done' AND completed_at >= ?3)) THEN 1 ELSE 0 END) AS open
         FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status != 'archived' AND parent_id IS NOT NULL GROUP BY parent_id`,
      )
      .bind(userId, fromTs, toTs)
      .all<LayerTaskRow>(),
  ]);
  const byId = new Map(nodes.results.map((r) => [r.id, r]));
  const counts = new Map(tasks.results.map((t) => [t.pid, t]));
  // Each project's tasks are added to the item of the walked layer above it; the layer under each item is counted beside.
  const sums = new Map<string, { done: number; open: number }>();
  const below = new Map<string, number>();
  const step = LAYER_BELOW[kind];
  for (const r of nodes.results) {
    const t = r.kind === 'project' ? counts.get(r.id) : undefined;
    if (t) {
      let at: LayerNodeRow | undefined = r;
      for (let i = 0; at && at.kind !== kind && i < 5; i += 1) at = at.parent_id ? byId.get(at.parent_id) : undefined;
      if (at?.kind === kind) {
        const s = sums.get(at.id) ?? { done: 0, open: 0 };
        s.done += n(t.done_in);
        s.open += n(t.open);
        sums.set(at.id, s);
      }
    }
    if (step && r.kind === step && r.status === 'active' && r.parent_id) below.set(r.parent_id, (below.get(r.parent_id) ?? 0) + 1);
  }
  const asOf = p.end < who.localToday ? p.end : who.localToday;
  // As the period ended: an item made before its end that was still going then (active now, or done since) or done inside it.
  const doneBy = (r: LayerNodeRow) => r.status === 'done' && r.completed_at !== null && r.completed_at < toTs;
  const shown = nodes.results.filter((r) => r.kind === kind && r.created_at < toTs && (r.status === 'active' || (r.status === 'done' && r.completed_at !== null && r.completed_at >= fromTs)));
  const toItem = (r: LayerNodeRow): ReviewLayerItem => {
    const s = sums.get(r.id) ?? { done: 0, open: 0 };
    const parent = r.parent_id ? byId.get(r.parent_id) : undefined;
    let pace: ReviewLayerItem['pace'] = null;
    if (kind === 'project' && !doneBy(r)) {
      const t = counts.get(r.id);
      const pp = projectPace(r.created_at.slice(0, 10), r.due_date, n(t?.done_by), n(t?.total_by), asOf);
      pace = pp.status === 'none' ? null : { status: pp.status, label: pp.label, line: pp.line };
    }
    return { id: r.id, title: r.title, relationship: r.relationship, status: doneBy(r) ? 'done' : 'active', under: kind === 'pillar' ? null : (parent?.title ?? null), done: s.done, open: s.open, below: below.get(r.id) ?? 0, pace };
  };
  const pillars = RELATIONSHIPS.map((rel) => {
    // Most ticked first; ties keep the pyramid's own order.
    const mine = shown.filter((r) => r.relationship === rel.key).map(toItem).sort((a, b) => b.done - a.done);
    return { relationship: rel.key, items: mine.slice(0, REVIEW_LAYER_PER_PILLAR), total: mine.length };
  });
  return { kind, pillars };
}

/**
 * One period's summary: its numbers beside the period before, xp and ticked tasks by day, xp by pillar, the tasks brought to it. `layer`
 * adds the walked layer of the person's pyramids (the Reviews screen and a saved snapshot ask for it); `supplements` adds the supplement
 * count, for Reviews' own read only (see numbersFor).
 */
export async function summaryFor(db: D1Database, userId: string, p: Period, opts: { layer?: boolean; supplements?: boolean } = {}): Promise<ReviewSummary> {
  const previous = periodShift(p, -1);
  const ctx = await numbersContext(db, userId);
  // Both periods' kinds of day from one read: every date of the two, without slots.
  ctx.blocking = loadBlocking(db, userId, [...periodDays(previous), ...periodDays(p)], { slots: false });
  const { fromTs, toTs, localDay } = periodWindow(p, ctx.zone);
  const [now, before, xpByDay, tasksByDay, byArea, cur, flagged, layer] = await Promise.all([
    numbersFor(db, userId, p, { ctx, supplements: opts.supplements }),
    numbersFor(db, userId, previous, { ctx, supplements: opts.supplements }),
    db.prepare(`SELECT ${localDay('created_at')} AS d, SUM(amount) AS xp FROM xp_events WHERE user_id = ? AND created_at >= ? AND created_at < ? GROUP BY d`).bind(userId, fromTs, toTs).all<{ d: string; xp: number }>(),
    db.prepare(`SELECT ${localDay('completed_at')} AS d, COUNT(*) AS n FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ? AND completed_at < ? GROUP BY d`).bind(userId, fromTs, toTs).all<{ d: string; n: number }>(),
    db.prepare('SELECT relationship, SUM(amount) AS xp FROM xp_events WHERE user_id = ? AND relationship IS NOT NULL AND created_at >= ? AND created_at < ? GROUP BY relationship').bind(userId, fromTs, toTs).all<{ relationship: RelationshipKey; xp: number }>(),
    // The period's money is summed in the person's own currency only (numbersFor), so it is labelled with that one.
    db.prepare("SELECT COALESCE(NULLIF(currency, ''), 'INR') AS currency FROM users WHERE id = ?").bind(userId).first<{ currency: string }>(),
    flaggedFor(db, userId, p, ctx),
    opts.layer ? layerFor(db, userId, p, ctx) : Promise.resolve(null),
  ]);
  const xpMap = new Map(xpByDay.results.map((r) => [r.d, r.xp]));
  const taskMap = new Map(tasksByDay.results.map((r) => [r.d, r.n]));
  const xpByArea: Partial<Record<RelationshipKey, number>> = {};
  for (const r of byArea.results) xpByArea[r.relationship] = r.xp;
  return { period: p, previous, now, before, series: periodDays(p).map((d) => ({ date: d, xp: xpMap.get(d) ?? 0, tasks: taskMap.get(d) ?? 0 })), xpByArea, currency: cur?.currency ?? 'INR', flagged, ...(layer ? { layer } : {}) };
}

/** The built-in template for the period (the half's part picked by which half it is), then the person's own for its kind. */
async function templatesFor(db: D1Database, userId: string, p: Period): Promise<ReviewTemplate[]> {
  const rows = await db.prepare('SELECT * FROM review_templates WHERE user_id = ? AND kind = ? ORDER BY created_at ASC').bind(userId, p.kind).all<TemplateRow>();
  return [builtInTemplateFor(p), ...rows.results.map(toTemplate)];
}

// The dashboards' period panels ask for the numbers only; `layer=1` adds the walked layer of the person's pyramids. Never the supplement
// count: that is Reviews' own (GET /reviews).
reviews.get('/summary', async (c) => {
  const kind = kindOf(c.req.query('kind')) ?? 'week';
  return c.json(await summaryFor(c.env.DB, c.get('user').id, periodFor(kind, dateOf(c.req.query('date'))), { layer: c.req.query('layer') === '1' }));
});

reviews.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const kind = kindOf(c.req.query('kind')) ?? 'week';
  const period = periodFor(kind, dateOf(c.req.query('date')));
  // Saved reviews come a page at a time (prefix `r`), so an older one is never out of reach; the daily ones in a list of their own
  // (prefix `rd`), so a year of days never buries the weeks and months.
  const rAsk = pageOf(c, 'r');
  const dAsk = pageOf(c, 'rd');
  type ListRow = Pick<ReviewRow, 'id' | 'kind' | 'period_start' | 'period_end' | 'rating' | 'highlight' | 'updated_at'>;
  const [summary, row, templates, recent, days] = await Promise.all([
    // Reviews' own read is the one place the supplement count is asked for (shown to the owner under The numbers).
    summaryFor(db, user.id, period, { layer: true, supplements: true }),
    db.prepare('SELECT * FROM reviews WHERE user_id = ? AND kind = ? AND period_start = ?').bind(user.id, kind, period.start).first<ReviewRow>(),
    templatesFor(db, user.id, period),
    db.prepare("SELECT id, kind, period_start, period_end, rating, highlight, updated_at FROM reviews WHERE user_id = ? AND kind != 'day' ORDER BY period_start DESC, updated_at DESC LIMIT ? OFFSET ?").bind(user.id, rAsk.limit, rAsk.offset).all<ListRow>(),
    db.prepare("SELECT id, kind, period_start, period_end, rating, highlight, updated_at FROM reviews WHERE user_id = ? AND kind = 'day' ORDER BY period_start DESC LIMIT ? OFFSET ?").bind(user.id, dAsk.limit, dAsk.offset).all<ListRow>(),
  ]);
  const recentPg = paged(recent.results, rAsk);
  const daysPg = paged(days.results, dAsk);
  const item = (r: ListRow): ReviewListItem => ({ id: r.id, kind: r.kind, start: r.period_start, end: r.period_end, rating: r.rating, highlight: r.highlight, updatedAt: r.updated_at });
  const res: ReviewsResponse & { recentPage: Page; recentDaysPage: Page } = {
    period,
    summary,
    review: row ? toReview(row) : null,
    templates,
    recentPage: recentPg.page,
    recent: recentPg.items.map(item),
    recentDays: daysPg.items.map(item),
    recentDaysPage: daysPg.page,
  };
  return c.json(res);
});

// Every period's built-in questions with their why lines (the half's two parts each), and the person's own templates of every kind, for
// the Templates list on Reviews. Read only: a built-in set is copied into the person's own with POST /reviews/templates.
reviews.get('/templates', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM review_templates WHERE user_id = ? ORDER BY created_at ASC LIMIT ?').bind(c.get('user').id, MAX_REVIEW_TEMPLATES * 2).all<TemplateRow>();
  const res: ReviewTemplatesResponse = { builtIn: builtInTemplates(), mine: rows.results.map(toTemplate) };
  return c.json(res);
});

// Write or rewrite the review for a period. The prompts and the numbers are copied in, so later changes never rewrite it.
reviews.put('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  type PutBody = { kind?: string; date?: string; templateId?: string | null; answers?: unknown; rating?: unknown; highlight?: unknown };
  const body = await c.req.json<PutBody>().catch(() => ({}) as PutBody);
  const kind = kindOf(body.kind);
  if (!kind) return c.json({ error: 'kind must be day, week, month, quarter, half or year' }, 400);
  if (!body.date || !DATE_RE.test(body.date)) return c.json({ error: 'date must be YYYY-MM-DD' }, 400);
  const period = periodFor(kind, body.date);
  // Not started yet: after the person's own today (the device's `?day=` within a day of their zone's, else the zone's), so a daily
  // review is never written for tomorrow.
  if (period.start > personDay(c.req.query('day'), user.timezone)) return c.json({ error: 'That period has not started yet.' }, 400);
  const [templates, saved] = await Promise.all([
    templatesFor(db, user.id, period),
    db.prepare('SELECT template_id, template_name, prompts_json FROM reviews WHERE user_id = ? AND kind = ? AND period_start = ?').bind(user.id, kind, period.start).first<Pick<ReviewRow, 'template_id' | 'template_name' | 'prompts_json'>>(),
  ]);
  const template = templates.find((t) => t.id === (body.templateId ?? `builtin:${kind}`));
  if (!template) return c.json({ error: 'no such template' }, 404);
  // Saved again from the same template, a review keeps the questions it was written with, so a template that changed since (the built-in
  // ones by layer, 2026-11-07) never moves an answer under another question. The screen shows those same saved questions.
  const kept = saved && (saved.template_id ?? `builtin:${kind}`) === template.id ? strings(saved.prompts_json) : [];
  const prompts = kept.length > 0 ? kept : template.prompts;
  const templateName = kept.length > 0 && saved?.template_name ? saved.template_name : template.name;
  const given = Array.isArray(body.answers) ? body.answers : [];
  const answers = prompts.map((_, i) => (typeof given[i] === 'string' ? (given[i] as string).trim().slice(0, REVIEW_ANSWER_MAX) : ''));
  const rating = typeof body.rating === 'number' && body.rating >= 1 && body.rating <= 5 ? Math.round(body.rating) : null;
  const highlight = typeof body.highlight === 'string' ? body.highlight.trim().slice(0, REVIEW_HIGHLIGHT_MAX) : '';
  // The snapshot keeps the numbers and the walked layer's items as they are now, so a later change never rewrites the review. It is the
  // owner's, like the screen it was read from (a coach gets a saved review without its snapshot), so the supplement count rides in it.
  const snapshot = await summaryFor(db, user.id, period, { layer: true, supplements: true });
  const now = nowIso();
  const id = newId();
  await db
    .prepare(
      `INSERT INTO reviews (id, user_id, kind, period_start, period_end, template_id, template_name, prompts_json, answers_json, rating, highlight, snapshot_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, kind, period_start) DO UPDATE SET template_id = excluded.template_id, template_name = excluded.template_name, prompts_json = excluded.prompts_json,
         answers_json = excluded.answers_json, rating = excluded.rating, highlight = excluded.highlight, snapshot_json = excluded.snapshot_json, updated_at = excluded.updated_at`,
    )
    .bind(id, user.id, kind, period.start, period.end, template.builtIn ? null : template.id, templateName, JSON.stringify(prompts), JSON.stringify(answers), rating, highlight, JSON.stringify(snapshot), now, now)
    .run();
  const row = await db.prepare('SELECT * FROM reviews WHERE user_id = ? AND kind = ? AND period_start = ?').bind(user.id, kind, period.start).first<ReviewRow>();
  return c.json({ review: row ? toReview(row) : null });
});

reviews.post('/templates', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  type TplBody = { kind?: string; name?: unknown; prompts?: unknown };
  const body = await c.req.json<TplBody>().catch(() => ({}) as TplBody);
  const kind = kindOf(body.kind);
  if (!kind) return c.json({ error: 'kind must be day, week, month, quarter, half or year' }, 400);
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, REVIEW_NAME_MAX) : '';
  const prompts = parseReviewPrompts(body.prompts);
  if (!name) return c.json({ error: 'Give the template a name.' }, 400);
  if (prompts.length === 0) return c.json({ error: 'Add at least one question.' }, 400);
  const count = await db.prepare('SELECT COUNT(*) AS n FROM review_templates WHERE user_id = ?').bind(user.id).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_REVIEW_TEMPLATES) return c.json({ error: `${MAX_REVIEW_TEMPLATES} templates is plenty. Remove one to add another.` }, 400);
  const id = newId();
  const now = nowIso();
  await db.prepare('INSERT INTO review_templates (id, user_id, kind, name, prompts_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, user.id, kind, name, JSON.stringify(prompts), now, now).run();
  const template: ReviewTemplate = { id, kind, name, prompts, builtIn: false, createdAt: now };
  return c.json({ template }, 201);
});

reviews.patch('/templates/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT * FROM review_templates WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first<TemplateRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ name?: unknown; prompts?: unknown }>().catch(() => ({}) as { name?: unknown; prompts?: unknown });
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, REVIEW_NAME_MAX) : row.name;
  const prompts = body.prompts === undefined ? strings(row.prompts_json) : parseReviewPrompts(body.prompts);
  if (!name) return c.json({ error: 'Give the template a name.' }, 400);
  if (prompts.length === 0) return c.json({ error: 'Add at least one question.' }, 400);
  const now = nowIso();
  await db.prepare('UPDATE review_templates SET name = ?, prompts_json = ?, updated_at = ? WHERE id = ?').bind(name, JSON.stringify(prompts), now, row.id).run();
  return c.json({ template: toTemplate({ ...row, name, prompts_json: JSON.stringify(prompts), updated_at: now }) });
});

reviews.delete('/templates/:id', async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM review_templates WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  if (!r.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

// ---- the review calendar: reminders on chosen days, and the reviews already written

interface ScheduleRow { id: string; kind: PeriodKind; name: string; anchor: string; time: string; repeat_json: string | null; enabled: number; next_on: string | null }
const TIME_OK = /^([01]\d|2[0-3]):[0-5]\d$/;
const toSchedule = (r: ScheduleRow): ReviewSchedule => {
  const repeat = parseRepeat(r.repeat_json);
  return { id: r.id, kind: r.kind, name: r.name, anchor: r.anchor, time: r.time, repeat, enabled: r.enabled === 1, nextOn: r.next_on, label: repeat ? repeatLabel(repeat, r.anchor) : 'Once' };
};

// One month for the calendar: every reminder that falls in it, and every review written for a period that touches it.
reviews.get('/schedule', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const monthQ = c.req.query('month');
  const month = monthQ && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthQ) ? monthQ : dayFromDevice(c.req.query('day')).slice(0, 7);
  const from = `${month}-01`;
  const to = shiftDate(`${monthShift(month, 1)}-01`, -1);
  const [rows, written] = await Promise.all([
    db.prepare('SELECT id, kind, name, anchor, time, repeat_json, enabled, next_on FROM review_schedules WHERE user_id = ? ORDER BY created_at LIMIT ?').bind(user.id, MAX_REVIEW_SCHEDULES).all<ScheduleRow>(),
    db.prepare('SELECT kind, period_start, period_end, template_name FROM reviews WHERE user_id = ? AND period_end >= ? AND period_end <= ?').bind(user.id, from, to).all<{ kind: PeriodKind; period_start: string; period_end: string; template_name: string }>(),
  ]);
  const days: Record<string, ReviewCalendarDay> = {};
  const at = (d: string) => (days[d] ??= { scheduled: [], written: [] });
  const schedules = rows.results.map(toSchedule);
  for (const sc of schedules) {
    if (!sc.enabled) continue;
    for (const d of occurrencesBetween(sc.anchor, sc.repeat, from, to)) at(d).scheduled.push({ id: sc.id, kind: sc.kind, time: sc.time, name: sc.name });
  }
  // The name it was saved under (a half saved before the two parts keeps "Half-year review"), else the period's own.
  for (const w of written.results) at(w.period_end).written.push({ kind: w.kind, start: w.period_start, end: w.period_end, name: w.template_name || reviewNameFor({ kind: w.kind, start: w.period_start }) });
  const body: ReviewCalendarResponse = { month, schedules, days };
  return c.json(body);
});

function scheduleFields(body: Record<string, unknown>, prev?: ScheduleRow) {
  const kind = kindOf(typeof body.kind === 'string' ? body.kind : prev?.kind) ?? 'week';
  // A real day on the calendar: 2026-11-31 has the right shape but is not one.
  const realDay = (v: unknown): v is string => typeof v === 'string' && DATE_RE.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
  const anchor = realDay(body.anchor) ? body.anchor : (prev?.anchor ?? '');
  const time = typeof body.time === 'string' && TIME_OK.test(body.time) ? body.time : (prev?.time ?? REVIEW_REMINDER_TIME);
  const repeat = 'repeat' in body ? parseRepeat(body.repeat) : parseRepeat(prev?.repeat_json ?? null);
  return { kind, anchor, time, repeat, name: str(body.name, REVIEW_SCHEDULE_NAME_MAX, prev?.name ?? ''), enabled: 'enabled' in body ? body.enabled !== false : (prev ? prev.enabled === 1 : true) };
}

reviews.post('/schedule', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const f = scheduleFields(body);
  if (!f.anchor) return c.json({ error: 'pick a day' }, 400);
  if (body.repeat && !f.repeat) return c.json({ error: 'That is not a way to repeat.' }, 400);
  const n = await db.prepare('SELECT COUNT(*) AS n FROM review_schedules WHERE user_id = ?').bind(user.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= MAX_REVIEW_SCHEDULES) return c.json({ error: `up to ${MAX_REVIEW_SCHEDULES} scheduled reviews` }, 400);
  const id = newId();
  await db
    .prepare('INSERT INTO review_schedules (id, user_id, kind, name, anchor, time, repeat_json, enabled, next_on, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, user.id, f.kind, f.name, f.anchor, f.time, f.repeat ? JSON.stringify(f.repeat) : null, f.enabled ? 1 : 0, nextOnOrAfter(f.anchor, f.repeat, dayFromDevice(c.req.query('day'))), nowIso())
    .run();
  return c.json({ id }, 201);
});

reviews.patch('/schedule/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const prev = await db.prepare('SELECT id, kind, name, anchor, time, repeat_json, enabled, next_on FROM review_schedules WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first<ScheduleRow>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const f = scheduleFields(body, prev);
  if (body.repeat && !f.repeat) return c.json({ error: 'That is not a way to repeat.' }, 400);
  await db
    .prepare('UPDATE review_schedules SET kind = ?, name = ?, anchor = ?, time = ?, repeat_json = ?, enabled = ?, next_on = ? WHERE id = ? AND user_id = ?')
    .bind(f.kind, f.name, f.anchor, f.time, f.repeat ? JSON.stringify(f.repeat) : null, f.enabled ? 1 : 0, nextOnOrAfter(f.anchor, f.repeat, dayFromDevice(c.req.query('day'))), prev.id, user.id)
    .run();
  return c.json({ ok: true });
});

reviews.delete('/schedule/:id', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM review_schedules WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  if (!res.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

reviews.get('/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM reviews WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).first<ReviewRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.json({ review: toReview(row) });
});

reviews.delete('/:id', async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM reviews WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  if (!r.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});
