import { Hono } from 'hono';
import {
  DEFAULT_ZONE,
  INSIGHT_WINDOW_DAYS,
  insightsFor,
  insightsForApp,
  isInsightApp,
  isRelationshipKey,
  periodFor,
  periodShift,
  type InsightFacts,
  type InsightReviewFact,
  type InsightsResponse,
  type PeriodKind,
  type PeriodNumbers,
  type RelationshipKey,
  zonedToUtc,
} from '@kreators/shared';
import type { AppEnv } from '../env';
import { resolveAccess } from '../access';
import { currencyOf, DATE_RE, dayFromDevice, shiftDate } from '../db';
import { latestProfile, settingsOf } from './discover';
import { numbersFor } from './reviews';

/**
 * Emerging (2026-11-04): patterns from what the person already logs, read across their own apps. Core, owner only, read
 * only, nothing stored. Every statement binds the session's id. A signal is computed only while every app it reads is on,
 * and the reads for an app that is off are never sent. The journal is read by when an entry was written, never a word;
 * wellbeing by kind, day and number, never a note or an extra. The rules are `insightsFor` in shared.
 */
const insights = new Hono<AppEnv>();

const json = <T>(raw: string | null | undefined, fallback: T): T => {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

insights.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const dayRaw = c.req.query('day');
  if (dayRaw && !DATE_RE.test(dayRaw)) return c.json({ error: 'day must be a real day, YYYY-MM-DD' }, 400);
  const appRaw = c.req.query('app');
  if (appRaw && !isInsightApp(appRaw)) return c.json({ error: 'unknown app' }, 400);
  const relRaw = c.req.query('rel');
  if (relRaw && !isRelationshipKey(relRaw)) return c.json({ error: 'unknown pillar' }, 400);
  const app = appRaw && isInsightApp(appRaw) ? appRaw : null;
  const rel: RelationshipKey | null = relRaw && isRelationshipKey(relRaw) ? relRaw : null;

  const today = dayFromDevice(dayRaw);
  const zone = user.timezone || DEFAULT_ZONE;
  const currency = currencyOf(user);
  const from = shiftDate(today, -(INSIGHT_WINDOW_DAYS - 1));
  // The window starts at the person's own midnight, through the one zone conversion (zonedToUtc).
  const fromTs = zonedToUtc(from, 0, zone).toISOString();
  const from30 = shiftDate(today, -29);
  const from30Utc = zonedToUtc(from30, 0, zone).toISOString();

  const { access } = await resolveAccess(db, user);
  const on = (k: string) => Boolean(access[k]?.on);
  const apps = Object.entries(access)
    .filter(([, a]) => a.on)
    .map(([k]) => k);
  const wellbeingKinds = ['mood', 'sleep', 'stress', 'mindful'].filter(on);
  const uid = user.id;

  // One round trip for everything core; the reads for apps that are on ride in the same batch.
  const stmts: D1PreparedStatement[] = [
    db
      .prepare("SELECT id, title, relationship, parent_id, completed_at, (repeat_json IS NOT NULL OR spawned_from IS NOT NULL) AS repeats, habit FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ? ORDER BY completed_at LIMIT 3000")
      .bind(uid, fromTs),
    db.prepare("SELECT id, title, relationship, parent_id, (repeat_json IS NOT NULL) AS repeats, habit, COALESCE(do_date, due_date) AS open_day FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'active' LIMIT 1000").bind(uid),
    db.prepare("SELECT id, relationship FROM nodes WHERE user_id = ? AND kind = 'project' AND status = 'active' LIMIT 500").bind(uid),
    db.prepare("SELECT relationship, SUM(amount) AS xp FROM xp_events WHERE user_id = ? AND created_at >= ? AND relationship IS NOT NULL GROUP BY relationship").bind(uid, from30Utc),
    db.prepare("SELECT DISTINCT source_id AS day FROM xp_events WHERE user_id = ? AND source = 'checkin' AND source_id >= ?").bind(uid, from),
    db.prepare("SELECT MIN(source_id) AS first FROM xp_events WHERE user_id = ? AND source = 'checkin'").bind(uid),
    db.prepare('SELECT day, SUM(minutes) AS minutes FROM focus_rounds WHERE user_id = ? AND day >= ? GROUP BY day').bind(uid, from),
    db.prepare("SELECT day, SUM(status = 'slipped') AS slipped, SUM(status = 'kept') AS kept FROM not_to_do_days WHERE user_id = ? AND day >= ? GROUP BY day").bind(uid, from),
    db.prepare('SELECT day, SUM(ml) AS ml FROM water_logs WHERE user_id = ? AND day >= ? GROUP BY day').bind(uid, from),
    db.prepare('SELECT water_goal_ml FROM reminder_prefs WHERE user_id = ?').bind(uid),
    db.prepare('SELECT day, kind FROM day_types WHERE user_id = ? AND day >= ?').bind(uid, from),
    db.prepare('SELECT day, done FROM routine_days WHERE user_id = ? AND day >= ?').bind(uid, from),
    db.prepare('SELECT focus_json FROM assessments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(uid),
  ];
  const extra: Record<string, number> = {};
  const add = (name: string, s: D1PreparedStatement) => {
    extra[name] = stmts.length;
    stmts.push(s);
  };
  // Never `note`, never `extra`: the kind, the day and the number.
  // Good and bad habits: the not to do list and each item's marks (kept or slipped), by day.
  add('ntdItems', db.prepare('SELECT id, title, relationship FROM not_to_do WHERE user_id = ? ORDER BY created_at LIMIT 50').bind(uid));
  add('ntdMarks', db.prepare('SELECT item_id, day, status FROM not_to_do_days WHERE user_id = ? AND day >= ?').bind(uid, from));
  if (wellbeingKinds.length) add('wellbeing', db.prepare(`SELECT kind, date, value FROM wellbeing_logs WHERE user_id = ? AND date >= ? AND kind IN (${wellbeingKinds.map(() => '?').join(', ')})`).bind(uid, from, ...wellbeingKinds));
  // Only when an entry was written.
  if (on('journal')) add('journal', db.prepare('SELECT created_at FROM journal_entries WHERE user_id = ? AND created_at >= ?').bind(uid, fromTs));
  // Spending in the person's own currency only; other currencies are never added in.
  if (on('finance')) add('money', db.prepare("SELECT date, SUM(amount_cents) AS cents FROM finance_transactions WHERE user_id = ? AND kind = 'expense' AND currency = ? AND date >= ? GROUP BY date").bind(uid, currency, from));
  if (on('agency')) add('agency', db.prepare('SELECT DISTINCT due_date AS day FROM agency_items WHERE user_id = ? AND due_date >= ? AND due_date <= ?').bind(uid, from, today));
  if (on('reviews')) add('review', db.prepare('SELECT kind, period_start, period_end, snapshot_json FROM reviews WHERE user_id = ? AND period_end < ? ORDER BY period_end DESC, updated_at DESC LIMIT 1').bind(uid, today));

  const res = await db.batch(stmts);
  const rows = <T>(i: number | undefined): T[] => (i === undefined ? [] : ((res[i]?.results ?? []) as T[]));
  const row = <T>(i: number | undefined): T | null => rows<T>(i)[0] ?? null;

  const habitOf = (v: number | null) => (v === null || v === undefined ? null : v === 1);
  const done = rows<{ id: string; title: string; relationship: RelationshipKey; parent_id: string | null; completed_at: string; repeats: number; habit: number | null }>(0)
    .filter((r) => r.completed_at && isRelationshipKey(r.relationship))
    .map((r) => ({ id: r.id, title: r.title, relationship: r.relationship, parentId: r.parent_id, completedAt: r.completed_at, repeats: r.repeats === 1, habit: habitOf(r.habit) }));
  const open = rows<{ id: string; title: string; relationship: RelationshipKey; parent_id: string | null; repeats: number; habit: number | null; open_day: string | null }>(1)
    .filter((r) => isRelationshipKey(r.relationship))
    .map((r) => ({ id: r.id, title: r.title, relationship: r.relationship, parentId: r.parent_id, repeats: r.repeats === 1, habit: habitOf(r.habit), openDay: r.open_day }));
  const projects = rows<{ id: string; relationship: RelationshipKey }>(2).filter((r) => isRelationshipKey(r.relationship));
  // Ticks per pillar from the tasks that are still ticked (an untick takes its tick back), xp from the ledger.
  const ticks30 = new Map<RelationshipKey, number>();
  for (const t of done) if (t.completedAt >= from30Utc) ticks30.set(t.relationship, (ticks30.get(t.relationship) ?? 0) + 1);
  const xpRows = rows<{ relationship: RelationshipKey; xp: number }>(3).filter((r) => isRelationshipKey(r.relationship));
  const rels = new Set<RelationshipKey>([...xpRows.map((r) => r.relationship), ...ticks30.keys()]);
  const xp30 = [...rels].map((k) => ({ relationship: k, xp: Math.max(0, xpRows.find((r) => r.relationship === k)?.xp ?? 0), ticks: ticks30.get(k) ?? 0 }));

  const discover = on('discover') ? await (async () => {
    const [settings, profile] = await Promise.all([settingsOf(db, uid), latestProfile(db, uid)]);
    return profile ? { growth: profile.growth, steps: settings.steps } : null;
  })() : null;

  let review: InsightReviewFact | null = null;
  const rv = row<{ kind: PeriodKind; period_start: string; period_end: string; snapshot_json: string }>(extra.review);
  if (rv) {
    const snap = json<{ now?: PeriodNumbers } | null>(rv.snapshot_json, null);
    const p = periodFor(rv.kind, rv.period_start);
    const next = periodShift(p, 1);
    if (snap?.now && next.start <= today) {
      const upTo = next.end < today ? next.end : today;
      const since = await numbersFor(db, uid, { kind: next.kind, start: next.start, end: upTo });
      review = { kind: rv.kind, start: rv.period_start, end: rv.period_end, then: snap.now, since, sinceStart: next.start, sinceEnd: next.end, ended: next.end < today };
    }
  }

  const facts: InsightFacts = {
    today,
    zone,
    currency,
    apps,
    rel,
    done,
    open,
    projects,
    xp30,
    focusPillars: json<RelationshipKey[]>(row<{ focus_json: string }>(12)?.focus_json, []).filter(isRelationshipKey),
    checkins: rows<{ day: string }>(4).map((r) => r.day),
    firstCheckin: row<{ first: string | null }>(5)?.first ?? null,
    wellbeing: rows<{ kind: string; date: string; value: number }>(extra.wellbeing),
    focus: rows<{ day: string; minutes: number }>(6),
    notToDo: rows<{ day: string; slipped: number; kept: number }>(7),
    notToDoItems: rows<{ id: string; title: string; relationship: string | null }>(extra.ntdItems).map((r) => ({ id: r.id, title: r.title, relationship: r.relationship && isRelationshipKey(r.relationship) ? r.relationship : null })),
    notToDoMarks: rows<{ item_id: string; day: string; status: string }>(extra.ntdMarks)
      .filter((r) => r.status === 'kept' || r.status === 'slipped')
      .map((r) => ({ itemId: r.item_id, day: r.day, status: r.status as 'kept' | 'slipped' })),
    water: rows<{ day: string; ml: number }>(8),
    waterGoal: row<{ water_goal_ml: number }>(9)?.water_goal_ml ?? null,
    dayTypes: rows<{ day: string; kind: string }>(10),
    routine: rows<{ day: string; done: number }>(11).map((r) => ({ day: r.day, done: r.done === 1 })),
    journalAt: rows<{ created_at: string }>(extra.journal).map((r) => r.created_at),
    expenses: rows<{ date: string; cents: number }>(extra.money),
    review,
    discover,
    agencyDue: rows<{ day: string }>(extra.agency).map((r) => r.day),
  };
  const all = insightsFor(facts);
  const body: InsightsResponse = { day: today, insights: insightsForApp(all, app, rel) };
  return c.json(body);
});

export default insights;
