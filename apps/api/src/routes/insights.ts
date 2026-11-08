import { Hono } from 'hono';
import {
  BUDGET_OVER_MONTHS,
  DEFAULT_ZONE,
  discoverProfile,
  INSIGHT_WINDOW_DAYS,
  insightsForPlace,
  isInsightApp,
  isRelationshipKey,
  overrideTemplateId,
  monthShift,
  PERIOD_KINDS,
  periodFor,
  periodShift,
  type InsightFacts,
  type DiscoverResult,
  type InsightReviewFact,
  type InsightsResponse,
  type Period,
  type PeriodKind,
  type PeriodNumbers,
  type RelationshipKey,
  type TemplateSlot,
  zonedToUtc,
} from '@kreators/shared';
import { insightsForEvery } from '@kreators/shared/insights';
import { DASH_ROLLING_DAYS, dashChartStart, lifeDashboardFrom, type DashReads, type LifeDashboard } from '@kreators/shared/lifeDashboard';
import type { AppEnv } from '../env';
import { resolveAccess } from '../access';
import { currencyOf, DATE_RE, dayFromDevice, personDay, shiftDate } from '../db';
import { layerFor, numbersContext, numbersFor, periodWindow } from './reviews';
import { accountDay, startingSet, toDayTemplate, toTimeBlock, type DayTemplateRow, type TimeBlockRow } from '../timeBlocks';

/**
 * Emerging (2026-11-04): patterns from what the person already logs, read across their own apps. Core, owner only, read
 * only, nothing stored. Every statement binds the session's id. A signal is computed only while every app it reads is on,
 * and the reads for an app that is off are never sent. The journal is read by when an entry was written, never a word;
 * wellbeing by kind, day and number, never a note or an extra (Fitness's movement and eating too); gratitude by which days have it, never
 * a line. The rules are `insightsFor` in shared.
 *
 * One answer for every place (2026-11-05): with no `app` it is the person's whole list, each pillar's own balance line included, and
 * the screens pick their share with `insightsForPlace` from one cached query per device day. `app` (and `rel`) still narrow it the
 * old way, for a client that has not reloaded. Limit `insights` per person (limits.ts).
 *
 * A period (2026-11-07, `kind` and `start`): the patterns are worked out over its days and each card names it; a future one is refused. With
 * none, the rolling windows, as before. GET /insights/dashboard is that period's numbers for "Your life, this week": the five areas of life
 * and the seven pillars, each part only while its app is on (`lifeDashboardFrom`), built on `numbersFor`, never the supplement count.
 */
const insights = new Hono<AppEnv>();

const json = <T>(raw: string | null | undefined, fallback: T): T => {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

/** The period asked for: none (null), a real one, or why it cannot be read. A day inside it names it; one still to come is refused. */
function askedPeriod(kindRaw: string | undefined, startRaw: string | undefined, today: string): Period | null | { problem: string } {
  if (!kindRaw && !startRaw) return null;
  if (!kindRaw || !(PERIOD_KINDS as readonly string[]).includes(kindRaw)) return { problem: 'kind must be day, week, month, quarter, half or year' };
  if (!startRaw || !DATE_RE.test(startRaw)) return { problem: 'start must be a real day, YYYY-MM-DD' };
  const p = periodFor(kindRaw as PeriodKind, startRaw);
  return p.start > today ? { problem: 'That period has not started yet.' } : p;
}
const isProblem = (v: Period | null | { problem: string }): v is { problem: string } => v !== null && 'problem' in v;

insights.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const dayRaw = c.req.query('day');
  if (dayRaw && !DATE_RE.test(dayRaw)) return c.json({ error: 'day must be a real day, YYYY-MM-DD' }, 400);
  const asked = askedPeriod(c.req.query('kind'), c.req.query('start'), personDay(dayRaw, user.timezone));
  if (isProblem(asked)) return c.json({ error: asked.problem }, 400);
  const win = asked;
  const appRaw = c.req.query('app');
  if (appRaw && !isInsightApp(appRaw)) return c.json({ error: 'unknown app' }, 400);
  const relRaw = c.req.query('rel');
  if (relRaw && !isRelationshipKey(relRaw)) return c.json({ error: 'unknown pillar' }, 400);
  const app = appRaw && isInsightApp(appRaw) ? appRaw : null;
  const rel: RelationshipKey | null = relRaw && isRelationshipKey(relRaw) ? relRaw : null;

  const today = dayFromDevice(dayRaw);
  const zone = user.timezone || DEFAULT_ZONE;
  const currency = currencyOf(user);
  // With a period picked the reads are its days; with none, up to twelve weeks. The last day is open-ended then, so nothing changes.
  const from = win ? win.start : shiftDate(today, -(INSIGHT_WINDOW_DAYS - 1));
  const to = win ? win.end : '9999-12-31';
  // Sleep is logged the morning after, so the night after the period's last day is read too.
  const toLogs = win ? shiftDate(win.end, 1) : to;
  // The window starts at the person's own midnight, through the one zone conversion (zonedToUtc).
  const fromTs = zonedToUtc(from, 0, zone).toISOString();
  const toTs = win ? zonedToUtc(shiftDate(win.end, 1), 0, zone).toISOString() : '9999';
  const from30 = shiftDate(today, -29);
  const from30Utc = win ? fromTs : zonedToUtc(from30, 0, zone).toISOString();
  const lastDay = to < today ? to : today;

  const { access } = await resolveAccess(db, user);
  const on = (k: string) => Boolean(access[k]?.on);
  const apps = Object.entries(access)
    .filter(([, a]) => a.on)
    .map(([k]) => k);
  // Fitness (2026-11-07): movement while Fitness or Kreators Run is on (both write it), the eating check-in while Fitness is on. Its value
  // only (minutes, and how well the person ate 1 to 5; a fasting day, 0, is left out), never the extra or the note. Supplements are
  // never read here.
  const wellbeingKinds = [...['mood', 'sleep', 'stress', 'mindful'].filter(on), ...(on('fitness') || on('run') ? ['move'] : []), ...(on('fitness') ? ['eat'] : [])];
  const uid = user.id;

  // One round trip for everything core; the reads for apps that are on ride in the same batch.
  const stmts: D1PreparedStatement[] = [
    // The newest ticks when there are more than the cap (shared orders them again); the cap keeps the weeks closest to today.
    db
      .prepare("SELECT id, title, relationship, parent_id, completed_at, (repeat_json IS NOT NULL OR spawned_from IS NOT NULL) AS repeats, habit, time_block_id FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ? AND completed_at < ? ORDER BY completed_at DESC LIMIT 3000")
      .bind(uid, fromTs, toTs),
    // Past the cap, the open tasks touched most recently; handed over in the order they were made (rowid), the order the unordered
    // read always gave, so the open task a habit card picks (`mates[0]`, `habitOf`) never changes between two made in one batch.
    db
      .prepare("SELECT * FROM (SELECT rowid AS rid, id, title, relationship, parent_id, (repeat_json IS NOT NULL) AS repeats, habit, COALESCE(do_date, due_date) AS open_day FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'active' ORDER BY updated_at DESC, id LIMIT 1000) ORDER BY rid")
      .bind(uid),
    db.prepare("SELECT id, relationship FROM nodes WHERE user_id = ? AND kind = 'project' AND status = 'active' ORDER BY updated_at DESC, id LIMIT 500").bind(uid),
    db.prepare("SELECT relationship, SUM(amount) AS xp FROM xp_events WHERE user_id = ? AND created_at >= ? AND created_at < ? AND relationship IS NOT NULL GROUP BY relationship").bind(uid, from30Utc, toTs),
    db.prepare("SELECT DISTINCT source_id AS day FROM xp_events WHERE user_id = ? AND source = 'checkin' AND source_id >= ? AND source_id <= ?").bind(uid, from, to),
    db.prepare("SELECT MIN(source_id) AS first FROM xp_events WHERE user_id = ? AND source = 'checkin'").bind(uid),
    db.prepare('SELECT day, SUM(minutes) AS minutes FROM focus_rounds WHERE user_id = ? AND day >= ? AND day <= ? GROUP BY day').bind(uid, from, to),
    db.prepare('SELECT day, SUM(ml) AS ml FROM water_logs WHERE user_id = ? AND day >= ? AND day <= ? GROUP BY day').bind(uid, from, to),
    db.prepare('SELECT water_goal_ml FROM reminder_prefs WHERE user_id = ?').bind(uid),
    db.prepare('SELECT day, done FROM routine_days WHERE user_id = ? AND day >= ? AND day <= ?').bind(uid, from, to),
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
  add('ntdMarks', db.prepare('SELECT item_id, day, status FROM not_to_do_days WHERE user_id = ? AND day >= ? AND day <= ?').bind(uid, from, to));
  if (wellbeingKinds.length) add('wellbeing', db.prepare(`SELECT kind, date, value FROM wellbeing_logs WHERE user_id = ? AND date >= ? AND date <= ? AND kind IN (${wellbeingKinds.map(() => '?').join(', ')}) AND NOT (kind = 'eat' AND value < 1)`).bind(uid, from, toLogs, ...wellbeingKinds));
  // Only when an entry was written.
  if (on('journal')) add('journal', db.prepare('SELECT created_at FROM journal_entries WHERE user_id = ? AND created_at >= ? AND created_at < ?').bind(uid, fromTs, toTs));
  // Gratitude for the day (migration 0102): only which of the person's own days have it, never a line.
  if (on('journal')) add('gratitude', db.prepare('SELECT day FROM gratitude_days WHERE user_id = ? AND day >= ? AND day <= ?').bind(uid, from, to));
  // Spending in the person's own currency only; other currencies are never added in.
  if (on('finance')) add('money', db.prepare("SELECT date, SUM(amount_cents) AS cents FROM finance_transactions WHERE user_id = ? AND kind = 'expense' AND currency = ? AND date >= ? AND date <= ? GROUP BY date").bind(uid, currency, from, to));
  // Budgets (2026-11-07): each one, and each month's spending by category up to the last day read, in the person's own currency only.
  if (on('finance')) {
    add('budgets', db.prepare('SELECT category, monthly_cents FROM finance_budgets WHERE user_id = ? AND monthly_cents > 0').bind(uid));
    const spendFrom = win ? `${win.start.slice(0, 7)}-01` : `${monthShift(today.slice(0, 7), -BUDGET_OVER_MONTHS)}-01`;
    add('budgetSpend', db.prepare("SELECT substr(date, 1, 7) AS month, category, SUM(amount_cents) AS cents FROM finance_transactions WHERE user_id = ? AND kind = 'expense' AND currency = ? AND date >= ? AND date <= ? GROUP BY month, category").bind(uid, currency, spendFrom, lastDay));
  }
  if (on('agency')) add('agency', db.prepare('SELECT DISTINCT due_date AS day FROM agency_items WHERE user_id = ? AND due_date >= ? AND due_date <= ?').bind(uid, from, lastDay));
  // Discover's switches and its latest result ride in the same batch (they were two more round trips after it).
  if (on('discover')) {
    add('discoverSettings', db.prepare('SELECT steps FROM discover_settings WHERE user_id = ?').bind(uid));
    add('discoverResult', db.prepare('SELECT result_json, created_at FROM discover_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(uid));
  }
  // Time blocks (core): the blocks, the day templates and their slots, the weekly pattern and the date changes in the window, for the
  // block line (how many of a block's tasks were ticked inside it) and Your kinds of day (each day's template; the account's first day
  // bounds it). Names and minutes only.
  // Someone who has changed none of it has no rows to read: the starting set comes from code (`startingSet`).
  if (user.time_blocks_seeded_at) {
    add('tbBlocks', db.prepare('SELECT * FROM time_blocks WHERE user_id = ? ORDER BY sort ASC, created_at ASC').bind(uid));
    add('tbTemplates', db.prepare('SELECT * FROM day_templates WHERE user_id = ? ORDER BY sort ASC, created_at ASC').bind(uid));
    add('tbSlots', db.prepare('SELECT template_id, block_id, start_min, end_min FROM day_template_slots WHERE user_id = ?').bind(uid));
  }
  add('tbPattern', db.prepare('SELECT weekday, template_id FROM week_patterns WHERE user_id = ?').bind(uid));
  add('tbDays', db.prepare('SELECT day, kind, template_id FROM day_types WHERE user_id = ? AND day >= ? AND day <= ?').bind(uid, from, to));
  // "Since your last review" looks back from the last week or longer one: a daily review (2026-11-07) would make it one day against the next.
  if (on('reviews') && !win) add('review', db.prepare("SELECT kind, period_start, period_end, snapshot_json FROM reviews WHERE user_id = ? AND period_end < ? AND kind != 'day' ORDER BY period_end DESC, updated_at DESC LIMIT 1").bind(uid, today));

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
  const tbStart = user.time_blocks_seeded_at ? null : startingSet(uid);
  const tbTemplates = tbStart?.templates ?? rows<DayTemplateRow>(extra.tbTemplates).map((r) => toDayTemplate(r, tbSlotsBy.get(r.id) ?? []));
  const tbIds = new Set(tbTemplates.map((t) => t.id));
  const tbPattern: (string | null)[] = [null, null, null, null, null, null, null];
  for (const r of rows<{ weekday: number; template_id: string }>(extra.tbPattern)) if (r.weekday >= 1 && r.weekday <= 7 && tbIds.has(r.template_id)) tbPattern[r.weekday - 1] = r.template_id;
  const tbOverrides: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const r of rows<{ day: string; kind: string; template_id: string | null }>(extra.tbDays)) {
    const id = overrideTemplateId(r, tbTemplates);
    if (id) tbOverrides[r.day] = id;
  }
  const tbBlocks = tbStart?.blocks ?? rows<TimeBlockRow>(extra.tbBlocks).map(toTimeBlock);
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
      // A saved review's snapshot holds the owner's supplement count (shown only in Reviews' The numbers); Emerging never takes it.
      const { suppTaken: _taken, suppDue: _due, ...then } = snap.now;
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
    ...(win ? { window: win } : {}),
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
    gratitudeDays: rows<{ day: string }>(extra.gratitude).map((r) => r.day),
    expenses: rows<{ date: string; cents: number }>(extra.money),
    ...(on('finance') ? { budgets: rows<{ category: string; monthly_cents: number }>(extra.budgets).map((r) => ({ category: r.category, monthlyCents: r.monthly_cents })), budgetSpend: rows<{ month: string; category: string; cents: number }>(extra.budgetSpend) } : {}),
    review,
    discover,
    agencyDue: rows<{ day: string }>(extra.agency).map((r) => r.day),
    ...(tbBlocks.length && tbTemplates.length ? { timeBlocks: { blocks: tbBlocks, templates: tbTemplates, defaultId: tbTemplates.find((t) => t.isDefault)?.id ?? tbTemplates[0]!.id, pattern: tbPattern, overrides: tbOverrides, since: accountDay(user) } } : {}),
  };
  const all = insightsForEvery(facts);
  const body: InsightsResponse = { day: today, insights: app ? insightsForPlace(all, app, rel) : all, ...(win ? { window: win } : {}) };
  return c.json(body);
});

/**
 * "Your life, this week": one period's numbers, a day being the daily report, with no period the last eight weeks beside the eight before.
 * While a period runs it is set beside the same number of days of the one before, so three days are never set against a whole week. Built on
 * `numbersFor` for every number and `layerFor` for the layer the period walks; only the small charts' daily series are read here. Core, owner
 * only: every statement binds the session's id. Numbers and days only: never a note, an extra or a line written, and never the supplement count.
 */
insights.get('/dashboard', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const dayRaw = c.req.query('day');
  if (dayRaw && !DATE_RE.test(dayRaw)) return c.json({ error: 'day must be a real day, YYYY-MM-DD' }, 400);
  const today = personDay(dayRaw, user.timezone);
  const picked = askedPeriod(c.req.query('kind'), c.req.query('start'), today);
  if (isProblem(picked)) return c.json({ error: picked.problem }, 400);
  // The numbers' own period: the one picked, or the rolling eight weeks read as if they were one.
  const p: Period = picked ?? { kind: 'week', start: shiftDate(today, -(DASH_ROLLING_DAYS - 1)), end: today };
  const prev: Period = picked ? periodShift(p, -1) : { kind: 'week', start: shiftDate(p.start, -DASH_ROLLING_DAYS), end: shiftDate(p.start, -1) };
  const lastSeen = p.end < today ? p.end : today;
  const seen = Math.round((Date.parse(`${lastSeen}T00:00:00Z`) - Date.parse(`${p.start}T00:00:00Z`)) / 86_400_000) + 1;
  // Only a period still running is cut to the days it has had. A closed one sits beside the whole one before, whatever their lengths: September against all of August.
  const prevEnd = p.end >= today ? shiftDate(prev.start, seen - 1) : prev.end;
  const before: Period = { ...prev, end: prevEnd < prev.end ? prevEnd : prev.end };

  const uid = user.id;
  const ctx = await numbersContext(db, uid);
  const currency = currencyOf(user);
  const chartFrom = picked ? dashChartStart(picked) : p.start;
  const chart = periodWindow({ kind: p.kind, start: chartFrom, end: p.end }, ctx.zone);
  const was = periodWindow(before, ctx.zone);
  const kinds = [...['mood', 'sleep', 'stress', 'mindful'].filter(ctx.on), ...(ctx.on('fitness') || ctx.on('run') ? ['move'] : []), ...(ctx.on('fitness') ? ['eat'] : [])];

  const stmts: D1PreparedStatement[] = [
    db.prepare('SELECT day, SUM(ml) AS ml FROM water_logs WHERE user_id = ? AND day >= ? AND day <= ? GROUP BY day').bind(uid, chartFrom, p.end),
    db.prepare('SELECT date AS day FROM spark_completions WHERE user_id = ? AND date >= ? AND date <= ? GROUP BY date').bind(uid, chartFrom, p.end),
    db.prepare('SELECT day FROM routine_days WHERE user_id = ? AND day >= ? AND day <= ? AND done = 1').bind(uid, chartFrom, p.end),
    db.prepare(`SELECT relationship, ${chart.localDay('created_at')} AS day, SUM(amount) AS xp FROM xp_events WHERE user_id = ? AND relationship IS NOT NULL AND created_at >= ? AND created_at < ? GROUP BY relationship, day`).bind(uid, chart.fromTs, chart.toTs),
    db.prepare(`SELECT relationship, ${chart.localDay('completed_at')} AS day, COUNT(*) AS n FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ? AND completed_at < ? GROUP BY relationship, day`).bind(uid, chart.fromTs, chart.toTs),
    db.prepare('SELECT relationship, SUM(amount) AS xp FROM xp_events WHERE user_id = ? AND relationship IS NOT NULL AND created_at >= ? AND created_at < ? GROUP BY relationship').bind(uid, was.fromTs, was.toTs),
  ];
  const at: Record<string, number> = {};
  const add = (name: string, s: D1PreparedStatement) => {
    at[name] = stmts.length;
    stmts.push(s);
  };
  // The kind, the day and the number: never a note, never an extra. A fasting day's eating check-in has no score, so it is left out.
  if (kinds.length) add('wellbeing', db.prepare(`SELECT kind, date, SUM(value) AS total, COUNT(*) AS n FROM wellbeing_logs WHERE user_id = ? AND date >= ? AND date <= ? AND kind IN (${kinds.map(() => '?').join(', ')}) AND NOT (kind = 'eat' AND value < 1) GROUP BY kind, date`).bind(uid, chartFrom, p.end, ...kinds));
  if (ctx.on('mindful')) {
    add('focus', db.prepare('SELECT day, SUM(minutes) AS minutes FROM focus_rounds WHERE user_id = ? AND day >= ? AND day <= ? GROUP BY day').bind(uid, chartFrom, p.end));
    // Mindful minutes no focus round wrote: a breath, or a log of the person's own (found by the round's `log_id`, never by the log's extra).
    const outside = 'NOT EXISTS (SELECT 1 FROM focus_rounds f WHERE f.user_id = w.user_id AND f.log_id = w.id)';
    add('stillness', db.prepare(`SELECT w.date AS date, SUM(w.value) AS minutes FROM wellbeing_logs w WHERE w.user_id = ? AND w.kind = 'mindful' AND w.date >= ? AND w.date <= ? AND ${outside} GROUP BY w.date`).bind(uid, chartFrom, p.end));
    add('stillnessBefore', db.prepare(`SELECT COALESCE(SUM(w.value), 0) AS minutes FROM wellbeing_logs w WHERE w.user_id = ? AND w.kind = 'mindful' AND w.date >= ? AND w.date <= ? AND ${outside}`).bind(uid, before.start, before.end));
  }
  if (ctx.on('journal')) {
    // When an entry was written, and which days have gratitude: never a word of either.
    add('journal', db.prepare(`SELECT ${chart.localDay('created_at')} AS day, COUNT(*) AS n FROM journal_entries WHERE user_id = ? AND created_at >= ? AND created_at < ? GROUP BY day`).bind(uid, chart.fromTs, chart.toTs));
    add('gratitude', db.prepare('SELECT day FROM gratitude_days WHERE user_id = ? AND day >= ? AND day <= ?').bind(uid, chartFrom, p.end));
  }
  if (ctx.on('finance')) {
    add('money', db.prepare('SELECT date, kind, SUM(amount_cents) AS cents FROM finance_transactions WHERE user_id = ? AND currency = ? AND date >= ? AND date <= ? GROUP BY date, kind').bind(uid, currency, chartFrom, p.end));
    add('otherMoney', db.prepare('SELECT DISTINCT currency FROM finance_transactions WHERE user_id = ? AND currency != ? AND date >= ? AND date <= ? LIMIT 6').bind(uid, currency, p.start, p.end));
  }
  const [res, now, was2, layer] = await Promise.all([db.batch(stmts), numbersFor(db, uid, p, { ctx }), numbersFor(db, uid, before, { ctx }), layerFor(db, uid, p, ctx)]);
  const rows = <T>(i: number | undefined): T[] => (i === undefined ? [] : ((res[i]?.results ?? []) as T[]));
  const isRel = <T extends { relationship: string }>(list: T[]) => list.filter((r) => isRelationshipKey(r.relationship)) as (T & { relationship: RelationshipKey })[];
  const reads: DashReads = {
    water: rows<{ day: string; ml: number }>(0),
    acts: rows<{ day: string }>(1).map((r) => r.day),
    routine: rows<{ day: string }>(2).map((r) => r.day),
    xp: isRel(rows<{ relationship: string; day: string; xp: number }>(3)),
    ticks: isRel(rows<{ relationship: string; day: string; n: number }>(4)),
    xpBefore: isRel(rows<{ relationship: string; xp: number }>(5)),
    wellbeing: rows<{ kind: string; date: string; total: number; n: number }>(at.wellbeing),
    focus: rows<{ day: string; minutes: number }>(at.focus),
    stillness: rows<{ date: string; minutes: number }>(at.stillness),
    stillnessBefore: rows<{ minutes: number }>(at.stillnessBefore)[0]?.minutes ?? 0,
    journal: rows<{ day: string; n: number }>(at.journal),
    gratitude: rows<{ day: string }>(at.gratitude).map((r) => r.day),
    money: rows<{ date: string; kind: string; cents: number }>(at.money),
    otherCurrencies: rows<{ currency: string }>(at.otherMoney).map((r) => r.currency),
  };
  const body: LifeDashboard = lifeDashboardFrom({ picked, span: { start: p.start, end: p.end }, today, currency, on: ctx.on, now, before: was2, layer, reads });
  return c.json(body);
});

export default insights;
