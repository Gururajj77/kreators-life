import { Hono } from 'hono';
import {
  DEFAULT_ZONE,
  discoverProfile,
  INSIGHT_WINDOW_DAYS,
  insightsForEvery,
  insightsForPlace,
  isInsightApp,
  isRelationshipKey,
  overrideTemplateId,
  periodFor,
  periodShift,
  type InsightFacts,
  type DiscoverResult,
  type InsightReviewFact,
  type InsightsResponse,
  type PeriodKind,
  type PeriodNumbers,
  type RelationshipKey,
  type TemplateSlot,
  zonedToUtc,
} from '@kreators/shared';
import type { AppEnv } from '../env';
import { resolveAccess } from '../access';
import { currencyOf, DATE_RE, dayFromDevice, shiftDate } from '../db';
import { numbersFor } from './reviews';
import { accountDay, toDayTemplate, toTimeBlock, type DayTemplateRow, type TimeBlockRow } from '../timeBlocks';

/**
 * Emerging (2026-11-04): patterns from what the person already logs, read across their own apps. Core, owner only, read
 * only, nothing stored. Every statement binds the session's id. A signal is computed only while every app it reads is on,
 * and the reads for an app that is off are never sent. The journal is read by when an entry was written, never a word;
 * wellbeing by kind, day and number, never a note or an extra. The rules are `insightsFor` in shared.
 *
 * One answer for every place (2026-11-05): with no `app` it is the person's whole list, each pillar's own balance line included, and
 * the screens pick their share with `insightsForPlace` from one cached query per device day. `app` (and `rel`) still narrow it the
 * old way, for a client that has not reloaded. Limit `insights` per person (limits.ts).
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
    // The newest ticks when there are more than the cap (shared orders them again); the cap keeps the weeks closest to today.
    db
      .prepare("SELECT id, title, relationship, parent_id, completed_at, (repeat_json IS NOT NULL OR spawned_from IS NOT NULL) AS repeats, habit, time_block_id FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ? ORDER BY completed_at DESC LIMIT 3000")
      .bind(uid, fromTs),
    // Past the cap, the open tasks touched most recently; handed over in the order they were made (rowid), the order the unordered
    // read always gave, so the open task a habit card picks (`mates[0]`, `habitOf`) never changes between two made in one batch.
    db
      .prepare("SELECT * FROM (SELECT rowid AS rid, id, title, relationship, parent_id, (repeat_json IS NOT NULL) AS repeats, habit, COALESCE(do_date, due_date) AS open_day FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'active' ORDER BY updated_at DESC, id LIMIT 1000) ORDER BY rid")
      .bind(uid),
    db.prepare("SELECT id, relationship FROM nodes WHERE user_id = ? AND kind = 'project' AND status = 'active' ORDER BY updated_at DESC, id LIMIT 500").bind(uid),
    db.prepare("SELECT relationship, SUM(amount) AS xp FROM xp_events WHERE user_id = ? AND created_at >= ? AND relationship IS NOT NULL GROUP BY relationship").bind(uid, from30Utc),
    db.prepare("SELECT DISTINCT source_id AS day FROM xp_events WHERE user_id = ? AND source = 'checkin' AND source_id >= ?").bind(uid, from),
    db.prepare("SELECT MIN(source_id) AS first FROM xp_events WHERE user_id = ? AND source = 'checkin'").bind(uid),
    db.prepare('SELECT day, SUM(minutes) AS minutes FROM focus_rounds WHERE user_id = ? AND day >= ? GROUP BY day').bind(uid, from),
    db.prepare('SELECT day, SUM(ml) AS ml FROM water_logs WHERE user_id = ? AND day >= ? GROUP BY day').bind(uid, from),
    db.prepare('SELECT water_goal_ml FROM reminder_prefs WHERE user_id = ?').bind(uid),
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
  // Discover's switches and its latest result ride in the same batch (they were two more round trips after it).
  if (on('discover')) {
    add('discoverSettings', db.prepare('SELECT steps FROM discover_settings WHERE user_id = ?').bind(uid));
    add('discoverResult', db.prepare('SELECT result_json, created_at FROM discover_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(uid));
  }
  // Time blocks (core): the blocks, the day templates and their slots, the weekly pattern and the date changes in the window, for the
  // block line (how many of a block's tasks were ticked inside it) and Your kinds of day (each day's template; the account's first day
  // bounds it). Names and minutes only.
  add('tbBlocks', db.prepare('SELECT * FROM time_blocks WHERE user_id = ? ORDER BY sort ASC, created_at ASC').bind(uid));
  add('tbTemplates', db.prepare('SELECT * FROM day_templates WHERE user_id = ? ORDER BY sort ASC, created_at ASC').bind(uid));
  add('tbSlots', db.prepare('SELECT template_id, block_id, start_min, end_min FROM day_template_slots WHERE user_id = ?').bind(uid));
  add('tbPattern', db.prepare('SELECT weekday, template_id FROM week_patterns WHERE user_id = ?').bind(uid));
  add('tbDays', db.prepare('SELECT day, kind, template_id FROM day_types WHERE user_id = ? AND day >= ?').bind(uid, from));
  if (on('reviews')) add('review', db.prepare('SELECT kind, period_start, period_end, snapshot_json FROM reviews WHERE user_id = ? AND period_end < ? ORDER BY period_end DESC, updated_at DESC LIMIT 1').bind(uid, today));

  const res = await db.batch(stmts);
  const rows = <T>(i: number | undefined): T[] => (i === undefined ? [] : ((res[i]?.results ?? []) as T[]));
  const row = <T>(i: number | undefined): T | null => rows<T>(i)[0] ?? null;

  const habitOf = (v: number | null) => (v === null || v === undefined ? null : v === 1);
  const done = rows<{ id: string; title: string; relationship: RelationshipKey; parent_id: string | null; completed_at: string; repeats: number; habit: number | null; time_block_id: string | null }>(0)
    .filter((r) => r.completed_at && isRelationshipKey(r.relationship))
    .map((r) => ({ id: r.id, title: r.title, relationship: r.relationship, parentId: r.parent_id, completedAt: r.completed_at, repeats: r.repeats === 1, habit: habitOf(r.habit), timeBlockId: r.time_block_id }));
  // The person's days as their time blocks make them (the same reading as loadBlocking in timeBlocks.ts).
  const tbSlotsBy = new Map<string, TemplateSlot[]>();
  for (const r of rows<{ template_id: string; block_id: string; start_min: number; end_min: number }>(extra.tbSlots)) tbSlotsBy.set(r.template_id, [...(tbSlotsBy.get(r.template_id) ?? []), { blockId: r.block_id, start: r.start_min, end: r.end_min }]);
  const tbTemplates = rows<DayTemplateRow>(extra.tbTemplates).map((r) => toDayTemplate(r, tbSlotsBy.get(r.id) ?? []));
  const tbIds = new Set(tbTemplates.map((t) => t.id));
  const tbPattern: (string | null)[] = [null, null, null, null, null, null, null];
  for (const r of rows<{ weekday: number; template_id: string }>(extra.tbPattern)) if (r.weekday >= 1 && r.weekday <= 7 && tbIds.has(r.template_id)) tbPattern[r.weekday - 1] = r.template_id;
  const tbOverrides: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const r of rows<{ day: string; kind: string; template_id: string | null }>(extra.tbDays)) {
    const id = overrideTemplateId(r, tbTemplates);
    if (id) tbOverrides[r.day] = id;
  }
  const tbBlocks = rows<TimeBlockRow>(extra.tbBlocks).map(toTimeBlock);
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

  // The one read that has to wait for the batch: the period after the last review, so far. It is started first and Discover is read
  // while it runs.
  let reviewPending: Promise<InsightReviewFact> | null = null;
  const rv = row<{ kind: PeriodKind; period_start: string; period_end: string; snapshot_json: string }>(extra.review);
  if (rv) {
    const snap = json<{ now?: PeriodNumbers } | null>(rv.snapshot_json, null);
    const p = periodFor(rv.kind, rv.period_start);
    const next = periodShift(p, 1);
    if (snap?.now) {
      const then = snap.now;
      if (next.start <= today) {
        const upTo = next.end < today ? next.end : today;
        reviewPending = numbersFor(db, uid, { kind: next.kind, start: next.start, end: upTo }).then((since) => ({ kind: rv.kind, start: rv.period_start, end: rv.period_end, then, since, sinceStart: next.start, sinceEnd: next.end, ended: next.end < today }));
      }
    }
  }

  // The same reading as `settingsOf` (steps on unless switched off) and `latestProfile` in routes/discover.ts.
  const dset = row<{ steps: number }>(extra.discoverSettings);
  const dres = row<{ result_json: string; created_at: string }>(extra.discoverResult);
  const dparsed = dres ? json<DiscoverResult | null>(dres.result_json, null) : null;
  const dprofile = dres && dparsed ? discoverProfile(dparsed, dres.created_at) : null;
  const discover = on('discover') && dprofile ? { growth: dprofile.growth, steps: dset ? dset.steps === 1 : true } : null;

  const review: InsightReviewFact | null = reviewPending ? await reviewPending : null;

  // Kept and slipped per day, from the same marks the good and bad habits read (one statement fewer).
  const marks = rows<{ item_id: string; day: string; status: string }>(extra.ntdMarks);
  const perDay = new Map<string, { day: string; slipped: number; kept: number }>();
  for (const m of marks) {
    const d = perDay.get(m.day) ?? { day: m.day, slipped: 0, kept: 0 };
    if (m.status === 'slipped') d.slipped += 1;
    else if (m.status === 'kept') d.kept += 1;
    perDay.set(m.day, d);
  }

  const facts: InsightFacts = {
    today,
    zone,
    currency,
    apps,
    rel: null,
    done,
    open,
    projects,
    xp30,
    focusPillars: json<RelationshipKey[]>(row<{ focus_json: string }>(10)?.focus_json, []).filter(isRelationshipKey),
    checkins: rows<{ day: string }>(4).map((r) => r.day),
    firstCheckin: row<{ first: string | null }>(5)?.first ?? null,
    wellbeing: rows<{ kind: string; date: string; value: number }>(extra.wellbeing),
    focus: rows<{ day: string; minutes: number }>(6),
    notToDo: [...perDay.values()],
    notToDoItems: rows<{ id: string; title: string; relationship: string | null }>(extra.ntdItems).map((r) => ({ id: r.id, title: r.title, relationship: r.relationship && isRelationshipKey(r.relationship) ? r.relationship : null })),
    notToDoMarks: marks
      .filter((r) => r.status === 'kept' || r.status === 'slipped')
      .map((r) => ({ itemId: r.item_id, day: r.day, status: r.status as 'kept' | 'slipped' })),
    water: rows<{ day: string; ml: number }>(7),
    waterGoal: row<{ water_goal_ml: number }>(8)?.water_goal_ml ?? null,
    dayTypes: rows<{ day: string; kind: string }>(extra.tbDays).map((r) => ({ day: r.day, kind: r.kind })),
    routine: rows<{ day: string; done: number }>(9).map((r) => ({ day: r.day, done: r.done === 1 })),
    journalAt: rows<{ created_at: string }>(extra.journal).map((r) => r.created_at),
    expenses: rows<{ date: string; cents: number }>(extra.money),
    review,
    discover,
    agencyDue: rows<{ day: string }>(extra.agency).map((r) => r.day),
    ...(tbBlocks.length && tbTemplates.length ? { timeBlocks: { blocks: tbBlocks, templates: tbTemplates, defaultId: tbTemplates.find((t) => t.isDefault)?.id ?? tbTemplates[0]!.id, pattern: tbPattern, overrides: tbOverrides, since: accountDay(user) } } : {}),
  };
  const all = insightsForEvery(facts);
  const body: InsightsResponse = { day: today, insights: app ? insightsForPlace(all, app, rel) : all };
  return c.json(body);
});

export default insights;
