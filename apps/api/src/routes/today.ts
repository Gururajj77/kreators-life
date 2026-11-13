import { Hono, type Context } from 'hono';
import { DAILY_GROUPED_MAX, dayTypeOf, slotIndexOfTask, slotOrder, PLAN_DEFAULT_MINUTES, startingTemplateFor, weekDates, type DayPlan, type DayTypeResponse, MONTH_RE, MONTH_TASKS_MAX, monthShift, repeatLabel, type MonthProject, type MonthTask, type TodayMonthResponse, PLAN_DAY_MINUTES, planWeek, type PlanTask, MAX_NOT_TO_DO, NOT_TO_DO_TITLE_MAX, notToDoStreak, notToDoWeek, POINTS, RELATIONSHIPS, sparkFor, XP, zonedToUtc, type CheckinResponse, type NotToDo, type NotToDoStatus, type RelationshipKey, TODAY_AGENCY_MAX, type TodayAgency, type TodayEvent, type TodayResponse, type TodayWaitingResponse, parseLifeArea, isTaskSort, isOpenFilter, DONE_PAGE_SIZE, DONE_PAGE_SIZES, OPEN_KINDS, type DoneTasksResponse, isTaskTab, TASK_TAB_CMP, TASK_TAB_PAGE_SIZES, TASK_TAB_PAGE_SIZE, taskTabSort, type TaskTab, type TodayTabResponse, HIDDEN_PAGE_PREFIX, taskHiddenOn, type HiddenTasksResponse } from '@kreators/shared';
import { breakdownOfOrigin } from '@kreators/shared/contentDays';
import type { AppEnv } from '../env';
import { resolveAccess } from '../access';
import { DATE_RE, dateNearToday, dayInZone, getUser, newId, noteStmt, nowIso, pageOf, paged, shiftDate, streakNow, TEN_A_PAGE, toNode, type NodeRow, taskGate, withSubtasks } from '../db';
import { dayPlan, kindsBetween, loadBlocking } from '../timeBlocks';
import { afterInviteActive, inviteActiveStmts } from '../invites';
import { blockFilterSql, isBlockId, readTaskCut, tagsNeedBlocks } from '../taskCut';

export const today = new Hono<AppEnv>();

/** The day a request asks about: the device's when it is a real calendar day, else the person's own today in their zone (never the
 *  server's UTC day, so a hidden task's "until tomorrow" and every day count agree with GET /today/hidden). */
function dateParam(v: string | undefined, zone: string | null | undefined): string {
  return v && DATE_RE.test(v) ? v : dayInZone(zone);
}

/** Where the person's day starts and ends, in UTC, from their zone (the app's default zone when none is set). */
export function dayBounds(date: string, zone: string): [string, string] {
  try {
    return [zonedToUtc(date, 0, zone || 'Asia/Kolkata').toISOString(), zonedToUtc(shiftDate(date, 1), 0, zone || 'Asia/Kolkata').toISOString()];
  } catch {
    return [`${date}T00:00:00.000Z`, `${shiftDate(date, 1)}T00:00:00.000Z`];
  }
}

export async function weakestRelationship(db: D1Database, userId: string): Promise<RelationshipKey> {
  const row = await db
    .prepare('SELECT relationship FROM relationship_scores WHERE user_id = ? ORDER BY score ASC, xp ASC, relationship ASC LIMIT 1')
    .bind(userId)
    .first<{ relationship: RelationshipKey }>();
  return row?.relationship ?? 'self';
}

interface NotToDoRow {
  id: string;
  user_id: string;
  title: string;
  relationship: string | null;
  streak: number;
  best_streak: number;
  created_at: string;
}
type DayMap = Record<string, NotToDoStatus | undefined>;

function toNotToDo(row: NotToDoRow, days: DayMap, date: string): NotToDo {
  const streak = notToDoStreak(days, date);
  return {
    id: row.id,
    title: row.title,
    relationship: (row.relationship as RelationshipKey | null) ?? null,
    streak,
    bestStreak: Math.max(row.best_streak, streak),
    today: days[date] ?? null,
    week: notToDoWeek(days, date),
    createdAt: row.created_at,
  };
}

/** Every item with its streak counted live for `date`, from enough days back to re-count the longest stored run. */
export async function notToDoList(db: D1Database, userId: string, date: string): Promise<NotToDo[]> {
  const rows = await db.prepare('SELECT * FROM not_to_do WHERE user_id = ? ORDER BY created_at ASC').bind(userId).all<NotToDoRow>();
  if (rows.results.length === 0) return [];
  const reach = Math.max(8, ...rows.results.map((r) => r.streak + 2));
  const days = await db
    .prepare('SELECT item_id, day, status FROM not_to_do_days WHERE user_id = ? AND day >= ? AND day <= ?')
    .bind(userId, shiftDate(date, -reach), date)
    .all<{ item_id: string; day: string; status: NotToDoStatus }>();
  const byItem = new Map<string, DayMap>();
  for (const d of days.results) {
    const m = byItem.get(d.item_id) ?? {};
    m[d.day] = d.status;
    byItem.set(d.item_id, m);
  }
  return rows.results.map((r) => toNotToDo(r, byItem.get(r.id) ?? {}, date));
}

/**
 * What the person signed up for that starts on their day: Party events they are registered for, runs of clubs they belong to and circle
 * tables they are seated at. A title, a time and a link only; the person's own rows, by the session's id.
 */
export async function eventsOnDay(db: D1Database, userId: string, dayStart: string, dayEnd: string): Promise<TodayEvent[]> {
  const rows = await db
    .prepare(
      `SELECT kind, title, starts_at, path FROM (
         SELECT 'event' AS kind, e.title, e.starts_at, '/party/' || e.id AS path FROM events e JOIN event_registrations r ON r.event_id = e.id
           WHERE r.user_id = ?1 AND r.status IN ('registered', 'attended') AND e.status = 'published' AND e.starts_at >= ?2 AND e.starts_at < ?3
         UNION ALL SELECT 'circle', e.title, e.starts_at, '/circles/' || g.id FROM circle_events e JOIN circle_groups g ON g.event_id = e.id JOIN circle_members m ON m.group_id = g.id
           WHERE m.user_id = ?1 AND e.status != 'cancelled' AND e.starts_at >= ?2 AND e.starts_at < ?3
         UNION ALL SELECT 'run', r.title, r.starts_at, '/run/clubs/' || r.club_id FROM runs r JOIN run_members m ON m.club_id = r.club_id AND m.status = 'member' AND m.user_id = ?1
           WHERE r.status IN ('published', 'done') AND r.starts_at >= ?2 AND r.starts_at < ?3
       ) ORDER BY starts_at LIMIT 10`,
    )
    .bind(userId, dayStart, dayEnd)
    .all<{ kind: TodayEvent['kind']; title: string; starts_at: string; path: string }>();
  return rows.results.map((r) => ({ kind: r.kind, title: r.title, at: r.starts_at, path: r.path }));
}

/**
 * Agency work waiting on the person on their day: pieces due that day or before and not yet approved, the changes clients asked for that
 * are still in making, retainers a client chose that wait to be confirmed, and sent invoices due that day or before. Owner only (every
 * query filters by the session's id), bounded to TODAY_AGENCY_MAX rows a list, titles, numbers and client names only: never a note,
 * a fee or what a client wrote.
 */
export async function agencyToday(db: D1Database, userId: string, date: string): Promise<TodayAgency> {
  const fortnight = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const [due, dueTotal, changes, retainers, invoices] = await Promise.all([
    db
      .prepare(
        `SELECT i.id, i.title, i.client_id, i.due_date, k.name AS client FROM agency_items i JOIN agency_clients k ON k.id = i.client_id AND k.user_id = i.user_id
         WHERE i.user_id = ? AND i.stage NOT IN ('approved', 'published') AND i.due_date IS NOT NULL AND i.due_date <= ? AND k.status != 'ended'
         ORDER BY i.due_date ASC, i.created_at ASC LIMIT ?`,
      )
      .bind(userId, date, TODAY_AGENCY_MAX)
      .all<{ id: string; title: string; client_id: string; due_date: string; client: string }>(),
    db
      .prepare("SELECT COUNT(*) AS n FROM agency_items i JOIN agency_clients k ON k.id = i.client_id AND k.user_id = i.user_id WHERE i.user_id = ? AND i.stage NOT IN ('approved', 'published') AND i.due_date IS NOT NULL AND i.due_date <= ? AND k.status != 'ended'")
      .bind(userId, date)
      .first<{ n: number }>(),
    db
      .prepare(
        "SELECT COUNT(DISTINCT i.id) AS n, COUNT(DISTINCT i.client_id) AS clients, MIN(i.client_id) AS client_id FROM agency_notes n JOIN agency_items i ON i.id = n.item_id AND i.user_id = n.user_id WHERE n.user_id = ? AND n.kind = 'change' AND n.created_at >= ? AND i.stage = 'making'",
      )
      .bind(userId, fortnight)
      .first<{ n: number; clients: number; client_id: string | null }>(),
    db
      .prepare("SELECT r.id, r.client_id, r.months, k.name AS client FROM agency_retainers r JOIN agency_clients k ON k.id = r.client_id AND k.user_id = r.user_id WHERE r.user_id = ? AND r.status = 'chosen' ORDER BY r.chosen_at ASC LIMIT ?")
      .bind(userId, TODAY_AGENCY_MAX)
      .all<{ id: string; client_id: string; months: number | null; client: string }>(),
    db
      .prepare(
        `SELECT i.id, i.number, i.agency_client_id, i.due_date, i.total_cents, i.currency, COALESCE(k.name, i.client_name) AS client FROM invoices i
         LEFT JOIN agency_clients k ON k.id = i.agency_client_id AND k.user_id = i.user_id
         WHERE i.user_id = ? AND i.status = 'sent' AND i.agency_client_id IS NOT NULL AND i.due_date IS NOT NULL AND i.due_date <= ?
         ORDER BY i.due_date ASC LIMIT ?`,
      )
      .bind(userId, date, TODAY_AGENCY_MAX)
      .all<{ id: string; number: string; agency_client_id: string | null; due_date: string; total_cents: number; currency: string; client: string }>(),
  ]);
  return {
    due: due.results.map((r) => ({ id: r.id, title: r.title, clientId: r.client_id, client: r.client, due: r.due_date, late: r.due_date < date })),
    dueTotal: dueTotal?.n ?? due.results.length,
    changeAsks: changes?.n ?? 0,
    changeClientId: changes && changes.clients === 1 ? changes.client_id : null,
    retainerToConfirm: retainers.results.map((r) => ({ id: r.id, clientId: r.client_id, client: r.client, months: r.months })),
    invoicesDue: invoices.results.map((r) => ({ id: r.id, number: r.number, clientId: r.agency_client_id, client: r.client, due: r.due_date, late: r.due_date < date, cents: r.total_cents, currency: r.currency })),
  };
}

/**
 * Whether the By context order applies to a day: a date someone changed, or a weekday whose pattern gives it a template other than the
 * default. A plain day (the default template) sorts by day, as before day templates.
 */
export const contextApplies = (plan: DayPlan, defaultId: string): boolean => plan.from === 'date' || (plan.from === 'week' && plan.template.id !== defaultId);

// The `?block=` cut (Daily's screen no longer sends it: its Block filter was taken out on 2026-11-06, and a block now comes back only as a
// tapped tag, `?tags=block:<id>`) and every other Area and tag cut live in taskCut.ts (2026-11-13).

/**
 * Daily's open tasks: every open task whose day (do date, else due date) has come, late ones included. `cut` is the Area and block cuts,
 * written from fixed keys only. ?1 is the person, ?2 their day. `cmp` compares the task's day with ?2: `<=` (the day and before, the old
 * cut, kept for the assistant and older tabs), or a tab's own from TASK_TAB_CMP (`=` Today, `<` Past due, `>` Upcoming): fixed strings, never typed.
 */
type DayCmp = '<=' | '=' | '<' | '>';
/**
 * Hidden tasks (2026-11-12, migration 0137): shown on the day `day` names unless hidden through it. Every Daily read but GET /today/hidden
 * adds it, so a hidden task leaves the tabs, their counts, the six, the waiting list, Not scheduled yet, To remember, Your day and the time
 * plan (a hidden timed task holds no time: Place my day and Move it may use its time while it is hidden). `day` is a bound parameter, never text.
 */
const shownOn = (prefix: string, day: string) => ` AND (${prefix}hidden_until IS NULL OR ${prefix}hidden_until < ${day})`;
const openTasksWhere = (cut: string, cmp: DayCmp = '<=') =>
  `n.user_id = ?1 AND n.kind = 'task' AND n.status = 'active' AND COALESCE(n.do_date, n.due_date) IS NOT NULL AND COALESCE(n.do_date, n.due_date) ${cmp} ?2${shownOn('n.', '?2')}${cut}`;
/**
 * The cut the main list and "N more waiting" read under (2026-11-12, Daily's tabs): `?tab=today` is the day alone; with no tab the day and
 * before it. The Bottlenecks view (`?open=`) stands apart: it lists all open business whose day has come, whatever tab is picked.
 */
function listCut(c: { req: { query: (k: string) => string | undefined } }, open: string | null): { tab: TaskTab | null; cmp: DayCmp } {
  const ask = c.req.query('tab');
  const tab = !open && isTaskTab(ask) ? ask : null;
  return { tab, cmp: tab ? TASK_TAB_CMP[tab] : '<=' };
}
/** A task's open business as a rank, the order `openRank` gives in shared: none 0, then Unfinished, Unresolved, Undecided. */
const OPEN_RANK_SQL = `CASE n.open_kind WHEN 'unfinished' THEN 1 WHEN 'unresolved' THEN 2 WHEN 'undecided' THEN 3 ELSE 0 END`;
/** The open-business cut (`?open=`, Daily's Unfinished business view) as SQL: any of the three kinds, or one. The value is read only
 *  through `isOpenFilter`, so it is one of four fixed words, written into the query as text. */
const openFilterSql = (open: string | null, col: string): string => (open === 'any' ? ` AND ${col} IN (${OPEN_KINDS.map((k) => `'${k}'`).join(', ')})` : open ? ` AND ${col} = '${open}'` : '');
/** The same cut as an expression, for a count that also counts what it leaves out (the tabs' counts). */
const openFilterExpr = (open: string | null, col: string): string => (open === 'any' ? `${col} IN (${OPEN_KINDS.map((k) => `'${k}'`).join(', ')})` : open ? `${col} = '${open}'` : '1');

/**
 * Which come first, the same order as the sort the person picked (`sortTasks`), so the six shown are the top six of it: ?3 = 0 by day;
 * ?3 = 1 by priority, then the lead pillar ?4 and its second ?5 (empty for Priority, so only the priority counts); ?3 = 2 by due date (none
 * last), then priority. With no sort picked, a plain day is by day and a day whose template was picked by context, so a P0 is never left out
 * behind a P2. The six shown and the rest under "N more waiting" (GET /today/waiting) read the same order, so the rest start where the six end.
 */
const OPEN_TASKS_ORDER = `ORDER BY CASE WHEN ?3 = 1 AND ?4 != '' THEN ${OPEN_RANK_SQL} ELSE 0 END ASC,
         CASE WHEN ?3 = 2 THEN COALESCE(n.due_date, '9999-99-99') ELSE '' END ASC,
         CASE WHEN ?3 = 0 THEN 0 ELSE COALESCE(n.priority, 4) END ASC,
         CASE WHEN ?3 = 0 THEN 0 WHEN n.relationship = ?4 THEN 0 WHEN n.relationship = ?5 THEN 1 ELSE 2 END ASC,
         COALESCE(n.do_date, n.due_date) ASC, CASE WHEN n.due_time IS NULL THEN 1 ELSE 0 END, n.due_time ASC, n.created_at ASC`;

/**
 * ?3, ?4 and ?5 for OPEN_TASKS_ORDER. `sort` is read only through `isTaskSort`, so nothing typed reaches the SQL; the grouped views (By time
 * block, By area) read by priority and the boxes sort them.
 */
function openOrderArgs(sortAsk: string | undefined, grouped: boolean, useContext: number, day: DayPlan): [number, string, string] {
  const ctx: [number, string, string] = [1, day.template.lead, day.template.second ?? ''];
  if (grouped) return [1, '', ''];
  const sort = isTaskSort(sortAsk) ? sortAsk : null;
  if (sort === 'priority') return [1, '', ''];
  if (sort === 'due') return [2, '', ''];
  if (sort === 'context') return ctx;
  if (sort === 'day') return [0, '', ''];
  return useContext ? ctx : [0, '', ''];
}

today.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const date = dateParam(c.req.query('date'), user.timezone);
  // Daily's Area filter (2026-11-06) and the tags a person tapped on a task (2026-11-13, `?tags=`): the six shown, their count, the tabs'
  // counts and the not scheduled list cut by both (taskCut.ts, read once the blocks are in), from fixed keys only, never a typed value.
  // The open-business cut (2026-11-07, Daily's Unfinished business view): any of the three kinds, or one, cut like the area.
  const openAsk = c.req.query('open');
  const open = isOpenFilter(openAsk) ? openAsk : null;
  const openSql = (col: string) => openFilterSql(open, col);

  // The day's plan (its day template, the kind of day): read first, since the six shown and the `?block=` cut depend on it.
  const grouped = c.req.query('group') === '1';
  const blockAsk = c.req.query('block');
  const blocking = await loadBlocking(db, user.id, [date]);
  const day = dayPlan(blocking, date);
  const block = blockAsk === 'none' ? 'none' : blockAsk && isBlockId(blockAsk) && blocking.blocks.some((b) => b.id === blockAsk) ? blockAsk : null;
  if (blockAsk && !block) return c.json({ error: 'pick one of your time blocks' }, 400);
  const blockSql = (prefix: string) => blockFilterSql(block, day.slots, prefix);
  const taskCut = readTaskCut((k) => c.req.query(k), { blocks: blocking.blocks, slots: day.slots });
  const area = taskCut.area;
  // The Area and tag cuts under a table prefix ('n.' or ''); fixed keys and the person's own block ids, written as text.
  const cutSql = taskCut.sql;
  const useContext = contextApplies(day, blocking.defaultId) ? 1 : 0;
  const shownMax = grouped ? DAILY_GROUPED_MAX : 6;
  const order = openOrderArgs(c.req.query('sort'), grouped, useContext, day);
  // Daily's tabs (2026-11-12): `?tab=today` cuts the six, their count and "N more waiting" to the tasks whose day is the day itself.
  const { tab, cmp } = listCut(c, open);
  const openWhere = openTasksWhere(`${cutSql('n.')}${openSql('n.open_kind')}${blockSql('n.')}`, cmp);
  const dayOf = 'COALESCE(n.do_date, n.due_date)';

  // None of these reads waits on another, so they run together: one round trip of waiting instead of a dozen.
  const [dayStart, dayEnd] = dayBounds(date, user.timezone);
  const [due, openCount, loose, plan, back, backTotal, doneToday, recent, gate, relationship, sparkDone, notToDo, events, access, areasUsedRow, slotRows, , made] = await Promise.all([
    // Which six are shown: by day on a plain day; on a day whose template was picked (a date change, or a weekday of the pattern that is not
    // the default) by context, the same order as `sortTasks` 'context' (priority, then the template's lead pillar, then its second), so a P0
    // is never left out behind a P2. Grouped (`?group=1`): up to DAILY_GROUPED_MAX by priority, then day, and the boxes sort them.
    db
      .prepare(`SELECT n.* FROM nodes n WHERE ${openWhere} ${OPEN_TASKS_ORDER} LIMIT ?6`)
      .bind(user.id, date, ...order, shownMax + 1)
      .all<NodeRow>(),
    // The true count of what waits (2026-11-06): every open task the list's cut holds, under the same cuts, and how many open tasks are late
    // (their day is before this one, the rule Plan my week counts), so the heading says "6 of 14 waiting, 2 late" instead of stopping at six.
    // The three tabs' counts ride in the same read (2026-11-12), under the Area cut only: the day, before it, after it. It walks the
    // person's open dated tasks once, through the day index (INDEXED BY: the dated range, so the undated backlog is never visited).
    db
      .prepare(
        `SELECT COALESCE(SUM(CASE WHEN ${openFilterExpr(open, 'n.open_kind')} AND ${dayOf} ${cmp} ?2 THEN 1 ELSE 0 END), 0) AS n,
        COALESCE(SUM(CASE WHEN ${openFilterExpr(open, 'n.open_kind')} AND ${dayOf} < ?2 THEN 1 ELSE 0 END), 0) AS late,
        COALESCE(SUM(CASE WHEN ${dayOf} = ?2 THEN 1 ELSE 0 END), 0) AS today_n,
        COALESCE(SUM(CASE WHEN ${dayOf} < ?2 THEN 1 ELSE 0 END), 0) AS past_n,
        COALESCE(SUM(CASE WHEN ${dayOf} > ?2 THEN 1 ELSE 0 END), 0) AS up_n
       FROM nodes n INDEXED BY idx_nodes_user_open_day WHERE n.user_id = ?1 AND n.kind = 'task' AND n.status = 'active' AND ${dayOf} > ''${shownOn('n.', '?2')}${cutSql('n.')}${blockSql('n.')}`,
      )
      .bind(user.id, date)
      .first<{ n: number; late: number; today_n: number; past_n: number; up_n: number }>(),
    // "Your day": every open task that opens on the day with no block and no time, whatever the six shown or the Area cut, so its line names
    // each one (the room in each block is counted the same way, below). The count is over all of them; up to 50 are listed, in the order
    // Place my day takes them (`autoPlaceOrder` in shared: P0, P1, none, P2, P3, then the due date, none last, a pillar's own first, the
    // longest, the id), so the plan always holds the 50 that matter most to it.
    db
      .prepare(
        `SELECT n.*, COUNT(*) OVER () AS loose_total FROM nodes n INDEXED BY idx_nodes_user_open_day
       WHERE n.user_id = ?1 AND n.kind = 'task' AND n.status = 'active' AND COALESCE(n.do_date, n.due_date) = ?2 AND n.time_block_id IS NULL AND n.due_time IS NULL${shownOn('n.', '?2')}
       ORDER BY CASE WHEN n.priority IS NULL THEN 2 WHEN n.priority <= 1 THEN n.priority ELSE n.priority + 1 END ASC, COALESCE(n.due_date, '9999-99-99') ASC,
         CASE WHEN n.origin = 'build' THEN 0 ELSE 1 END ASC, COALESCE(n.estimate_min, ?3) DESC, n.id ASC LIMIT 50`,
      )
      .bind(user.id, date, PLAN_DEFAULT_MINUTES)
      .all<NodeRow & { loose_total: number }>(),
    // The day's time plan counts every timed task due today, not just the six shown.
    db
      .prepare(
        `SELECT
        (SELECT COALESCE(SUM(estimate_min), 0) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'active' AND COALESCE(do_date, due_date) <= ?2 AND estimate_min IS NOT NULL${shownOn('', '?2')}) AS planned,
        (SELECT COALESCE(SUM(estimate_min), 0) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'done' AND completed_at >= ?3 AND completed_at < ?4 AND estimate_min IS NOT NULL) AS done,
        (SELECT COUNT(*) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'active' AND COALESCE(do_date, due_date) <= ?2 AND due_time IS NOT NULL${shownOn('', '?2')}) AS timed`,
      )
      .bind(user.id, date, date, shiftDate(date, 1))
      .first<{ planned: number; done: number; timed: number }>(),
    // The main list is only what has a day that has come. A task with no date at all (no do date and no due date) waits in the not scheduled list below it until either is picked.
    db
      .prepare(
        `SELECT * FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'active' AND do_date IS NULL AND due_date IS NULL${shownOn('', '?2')}${cutSql('')}${openSql('open_kind')}${blockSql('')}
       ORDER BY remind DESC, created_at DESC LIMIT 60`,
      )
      .bind(user.id, date)
      .all<NodeRow>(),
    db
      .prepare(`SELECT COUNT(*) AS n FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'active' AND do_date IS NULL AND due_date IS NULL${shownOn('', '?2')}${cutSql('')}${openSql('open_kind')}${blockSql('')}`)
      .bind(user.id, date)
      .first<{ n: number }>(),
    // What was ticked today stays in sight under the tasks still waiting, so a tick can be seen and undone: the first page, ten, with the
    // true count beside it (2026-11-07); the next pages come from GET /today/done.
    db
      .prepare("SELECT *, COUNT(*) OVER () AS done_total FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ? AND completed_at < ? ORDER BY completed_at DESC, id ASC LIMIT ?")
      .bind(user.id, dayStart, dayEnd, DONE_PAGE_SIZE)
      .all<NodeRow & { done_total: number }>(),
    db
      .prepare("SELECT COUNT(*) AS n FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ?")
      .bind(user.id, new Date(Date.now() - 86_400_000).toISOString())
      .first<{ n: number }>(),
    taskGate(db, user.id),
    weakestRelationship(db, user.id),
    db
      .prepare('SELECT relationship FROM spark_completions WHERE user_id = ? AND date = ?')
      .bind(user.id, date)
      .first<{ relationship: RelationshipKey }>(),
    notToDoList(db, user.id, date),
    eventsOnDay(db, user.id, dayStart, dayEnd),
    resolveAccess(db, user).then((r) => r.access),
    // Whether any of the person's open tasks carries an area, so Daily shows the Area filter only once it means something; how many
    // tasks were let go (archived, 2026-11-07), so the Unfinished business view offers its Let go list only when there is one; and how
    // many are hidden on the day (2026-11-12), for the Hidden tasks fold, through the small hidden index (migration 0138), whole.
    db
      .prepare(
        `SELECT EXISTS (SELECT 1 FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'active' AND life_area IS NOT NULL) AS one,
        (SELECT COUNT(*) FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'archived') AS let_go,
        (SELECT COUNT(*) FROM nodes INDEXED BY idx_nodes_user_hidden WHERE user_id = ?1 AND kind = 'task' AND status = 'active' AND hidden_until IS NOT NULL AND hidden_until >= ?2) AS hidden`,
      )
      .bind(user.id, date)
      .first<{ one: number; let_go: number; hidden: number }>(),
    // Every open task that opens on the day and has a block or a time, summed by block and time, so "Your day" counts a slot's room from
    // all of them, never from the six shown or the Area filter's cut.
    db
      .prepare(
        `SELECT time_block_id, due_time, SUM(COALESCE(estimate_min, ?3)) AS min FROM nodes
       WHERE user_id = ?1 AND kind = 'task' AND status = 'active' AND COALESCE(do_date, due_date) = ?2 AND (time_block_id IS NOT NULL OR due_time IS NOT NULL)${shownOn('', '?2')}
       GROUP BY time_block_id, due_time LIMIT 2000`,
      )
      .bind(user.id, date, PLAN_DEFAULT_MINUTES)
      .all<{ time_block_id: string | null; due_time: string | null; min: number }>(),
    // A gentle nudge in the inbox, once a day, when a reminder time is set and the day's check-in has not happened yet. Looked up
    // by its own id and the cron's check-in note (`sendReminders`), never by kind: your own reminders, tasks and focus are reminders too.
    (async () => {
      if (user.reminder_time && user.last_checkin !== date) {
        const already = await db.prepare('SELECT 1 FROM notifications WHERE user_id = ? AND id IN (?, ?)').bind(user.id, `daily-${user.id}-${date}`, `checkin-${user.id}-${date}`).first();
        if (!already) await noteStmt(db, { id: `daily-${user.id}-${date}`, userId: user.id, kind: 'reminder', title: 'Your daily three are waiting', body: 'Check in, do your small act, tick a task.', link: '/today' }, 'once').run();
      }
    })(),
    // Content days (2026-11-12): the tasks "Add to my tasks" made for this day, open or ticked (never one let go), so Daily says "Added"
    // instead of offering the list again. Two narrow reads: open ones through the day index, ticked ones through the done index since the
    // day before began (a task cannot be ticked before its do date), never every task.
    db
      .prepare(
        `SELECT id, origin FROM nodes INDEXED BY idx_nodes_user_open_day WHERE user_id = ?1 AND kind = 'task' AND status = 'active' AND COALESCE(do_date, due_date) = ?2 AND do_date = ?2 AND origin LIKE 'breakdown:%'
       UNION ALL SELECT id, origin FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'done' AND completed_at >= ?3 AND do_date = ?2 AND origin LIKE 'breakdown:%'
       LIMIT 40`,
      )
      .bind(user.id, date, dayBounds(shiftDate(date, -1), user.timezone)[0])
      .all<{ id: string; origin: string }>(),
  ]);
  const tasksMore = due.results.length > shownMax;
  const tasks = due.results.slice(0, shownMax);
  const ordered = slotOrder(day.slots);
  const slotPlannedMin = ordered.map(() => 0);
  for (const r of slotRows.results) {
    const i = slotIndexOfTask({ timeBlockId: r.time_block_id, dueTime: r.due_time }, ordered);
    if (i !== null && i >= 0) slotPlannedMin[i] = (slotPlannedMin[i] ?? 0) + Number(r.min);
  }

  // The three lists share one subtask count query (the lists never hold the same task twice).
  const shown = await withSubtasks(db, user.id, [...tasks, ...back.results, ...doneToday.results].map((t) => toNode(t, gate)));
  const res: TodayResponse = {
    date,
    checkedIn: user.last_checkin === date,
    streak: streakNow(user.streak, user.last_checkin, date),
    tasks: shown.slice(0, tasks.length),
    backlog: shown.slice(tasks.length, tasks.length + back.results.length),
    backlogTotal: backTotal?.n ?? 0,
    tasksTotal: Math.max(tasks.length, Number(openCount?.n ?? 0)),
    tasksLate: Number(openCount?.late ?? 0),
    area: area ?? null,
    tags: taskCut.key,
    areasUsed: Boolean(areasUsedRow?.one),
    done: shown.slice(tasks.length + back.results.length),
    doneTotal: Number(doneToday.results[0]?.done_total ?? 0),
    open,
    letGoTotal: Number(areasUsedRow?.let_go ?? 0),
    hiddenTotal: Number(areasUsedRow?.hidden ?? 0),
    doneRecently: recent?.n ?? 0,
    timePlan: { plannedMin: plan?.planned ?? 0, doneMin: plan?.done ?? 0, timed: plan?.timed ?? 0 },
    spark: {
      relationship: sparkDone?.relationship ?? relationship,
      text: sparkFor(sparkDone?.relationship ?? relationship, date),
      done: Boolean(sparkDone),
    },
    notToDo,
    events,
    day: { ...day, slotPlannedMin, contextual: useContext === 1 },
    block,
    looseTasks: loose.results.map((t) => toNode(t, gate)),
    looseTotal: Number(loose.results[0]?.loose_total ?? 0),
    timedSpans: slotRows.results.flatMap((r) => (r.due_time ? [{ dueTime: r.due_time, min: Number(r.min) }] : [])),
    tab,
    todayTotal: Number(openCount?.today_n ?? 0),
    pastDueTotal: Number(openCount?.past_n ?? 0),
    upcomingTotal: Number(openCount?.up_n ?? 0),
    breakdowns: made.results.flatMap((r) => {
      const from = breakdownOfOrigin(r.origin);
      return from ? [{ ...from, nodeId: r.id }] : [];
    }),
  };
  if (grouped) res.tasksMore = tasksMore;
  // Agency's work for the day is read only while Agency is on for the person; with it off the field is absent.
  if (access.agency?.on === true) res.agency = await agencyToday(db, user.id, date);
  return c.json(res);
});

// The rest of Daily's open tasks, past the ones GET /today shows (the six, or DAILY_GROUPED_MAX with `group=1`), in the same order and
// under the same Area cut, a page at a time, for the "N more waiting" fold. Owner only; reads the same tables and writes nothing.
today.get('/waiting', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const date = dateParam(c.req.query('date'), user.timezone);
  const openAsk = c.req.query('open');
  const open = isOpenFilter(openAsk) ? openAsk : null;
  // Follows GET /today's tab (2026-11-12): `?tab=today` reads past the six of the day alone.
  const { cmp } = listCut(c, open);
  const grouped = c.req.query('group') === '1';
  const blocking = await loadBlocking(db, user.id, [date]);
  const day = dayPlan(blocking, date);
  const useContext = contextApplies(day, blocking.defaultId) ? 1 : 0;
  const order = openOrderArgs(c.req.query('sort'), grouped, useContext, day);
  // The Area and tag cuts (taskCut.ts), the same as GET /today's.
  const cut = readTaskCut((k) => c.req.query(k), { blocks: blocking.blocks, slots: day.slots }).sql('n.') + openFilterSql(open, 'n.open_kind');
  const ask = pageOf(c, 'w');
  const skip = (grouped ? DAILY_GROUPED_MAX : 6) + ask.offset;
  const rows = await db
    .prepare(`SELECT n.* FROM nodes n WHERE ${openTasksWhere(cut, cmp)} ${OPEN_TASKS_ORDER} LIMIT ?6 OFFSET ?7`)
    .bind(user.id, date, ...order, ask.limit, skip)
    .all<NodeRow>();
  const { items, page } = paged(rows.results, ask);
  const gate = await taskGate(db, user.id);
  const res: TodayWaitingResponse = { tasks: await withSubtasks(db, user.id, items.map((t) => toNode(t, gate))), page };
  return c.json(res);
});

/**
 * Daily's Past due and Upcoming tabs (2026-11-12, the founder): the open tasks whose day (do date, else due date) is before the person's day,
 * or after it, a page at a time (10, 25 or 50, ten by default; prefixes `pd` and `uc`), with the true count, under Daily's Area cut. Owner only;
 * writes nothing. Both read through idx_nodes_user_open_day (migration 0133), a range on the person's open tasks by day, so a page never visits
 * every task. Past due sorts by `taskTabSort` (day, oldest first, else priority or due date, the six's own order); Upcoming is by day,
 * soonest first, then time and priority. An Upcoming task's tick stays locked until its day (`POST /nodes/:id/complete`).
 */
async function tabList(c: Context<AppEnv>, tab: Exclude<TaskTab, 'today'>) {
  const db = c.env.DB;
  const user = c.get('user');
  // A day sent that is not on the calendar is refused in words (the house rule for a typed or sent day), never read as today.
  const asked = c.req.query('date');
  if (asked !== undefined && !DATE_RE.test(asked)) return c.json({ error: 'That is not a real day.' }, 400);
  // No day sent: the person's own today in their zone, never the server's UTC date (still yesterday in India until 05:30).
  const date = asked ?? dayInZone(user.timezone);
  // The Area and tag cuts (taskCut.ts). A block tag needs the person's blocks: read only then, one more round trip, nothing otherwise.
  const blocking = tagsNeedBlocks(c.req.query('tags')) ? await loadBlocking(db, user.id, [date]) : null;
  const cut = readTaskCut((k) => c.req.query(k), blocking ? { blocks: blocking.blocks, slots: dayPlan(blocking, date).slots } : null).sql('n.');
  const where = `n.user_id = ?1 AND n.kind = 'task' AND n.status = 'active' AND COALESCE(n.do_date, n.due_date) ${TASK_TAB_CMP[tab]} ?2${shownOn('n.', '?2')}${cut}`;
  const from = 'FROM nodes n INDEXED BY idx_nodes_user_open_day';
  const ask = pageOf(c, tab === 'pastdue' ? 'pd' : 'uc', { sizes: TASK_TAB_PAGE_SIZES, fallback: TASK_TAB_PAGE_SIZE });
  // Past due by priority or due date takes the six's order (OPEN_TASKS_ORDER with ?3 priority 1 or due 2 and no lead pillar). By day, oldest
  // first, and Upcoming, soonest first, lead with the indexed day itself, so the index gives the order and a page stops at its LIMIT instead
  // of sorting every past due task (a CASE first would sort them all for each page).
  const sort = taskTabSort(tab, c.req.query('sort'));
  // Both start with the day, then the time (none last); Upcoming then puts the higher priority first inside a time, as it always did.
  const byDay = `ORDER BY COALESCE(n.do_date, n.due_date) ASC, CASE WHEN n.due_time IS NULL THEN 1 ELSE 0 END, n.due_time ASC,${tab === 'upcoming' ? ' COALESCE(n.priority, 4) ASC,' : ''} n.created_at ASC LIMIT ?3 OFFSET ?4`;
  const list =
    tab === 'pastdue' && sort !== 'day'
      ? db.prepare(`SELECT n.* ${from} WHERE ${where} ${OPEN_TASKS_ORDER} LIMIT ?6 OFFSET ?7`).bind(user.id, date, sort === 'priority' ? 1 : 2, '', '', ask.limit, ask.offset)
      : db.prepare(`SELECT n.* ${from} WHERE ${where} ${byDay}`).bind(user.id, date, ask.limit, ask.offset);
  const [gate, rows, total] = await Promise.all([taskGate(db, user.id), list.all<NodeRow>(), db.prepare(`SELECT COUNT(*) AS n ${from} WHERE ${where}`).bind(user.id, date).first<{ n: number }>()]);
  const { items, page } = paged(rows.results, ask);
  const res: TodayTabResponse = { tab, tasks: await withSubtasks(db, user.id, items.map((t) => toNode(t, gate))), page, total: total?.n ?? 0 };
  return c.json(res);
}
today.get('/past-due', (c) => tabList(c, 'pastdue'));
today.get('/upcoming', (c) => tabList(c, 'upcoming'));

// Done today, a page at a time (2026-11-07, the founder: "this can pile up with time"): the tasks ticked on the person's day in their zone,
// newest first, 10, 25 or 50 a page, ten by default (prefix `d`), and how many in all. GET /today carries the first page; this reads the rest.
today.get('/done', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const date = dateParam(c.req.query('date'), user.timezone);
  const [dayStart, dayEnd] = dayBounds(date, user.timezone);
  const ask = pageOf(c, 'd', { sizes: DONE_PAGE_SIZES, fallback: DONE_PAGE_SIZE });
  // Daily's Area filter and its Unfinished business view cut this list too, so the count beside it is the count of what the pages hold (2026-11-07, four-check).
  // Both keys come from fixed lists (parseLifeArea, isOpenFilter), so they are written into the query as text, never a typed value.
  // The tags a person tapped (2026-11-13) cut it the same way (taskCut.ts); a block tag reads the person's blocks first, only then.
  const openAsk = c.req.query('open');
  const blocking = tagsNeedBlocks(c.req.query('tags')) ? await loadBlocking(db, user.id, [date]) : null;
  const cut = readTaskCut((k) => c.req.query(k), blocking ? { blocks: blocking.blocks, slots: dayPlan(blocking, date).slots } : null).sql('') + openFilterSql(isOpenFilter(openAsk) ? openAsk : null, 'open_kind');
  const [gate, rows, total] = await Promise.all([
    taskGate(db, user.id),
    db
      .prepare(`SELECT * FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ? AND completed_at < ?${cut} ORDER BY completed_at DESC, id ASC LIMIT ? OFFSET ?`)
      .bind(user.id, dayStart, dayEnd, ask.limit, ask.offset)
      .all<NodeRow>(),
    db.prepare(`SELECT COUNT(*) AS n FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ? AND completed_at < ?${cut}`).bind(user.id, dayStart, dayEnd).first<{ n: number }>(),
  ]);
  const { items, page } = paged(rows.results, ask);
  const res: DoneTasksResponse = { tasks: await withSubtasks(db, user.id, items.map((t) => toNode(t, gate))), page, total: total?.n ?? 0 };
  return c.json(res);
});

// What was let go (2026-11-07, Close the unfinished): the person's archived tasks, newest first, a page at a time (prefix `lg`, 10, 25 or 50),
// with how many in all, so the Unfinished business view can bring one back through the ordinary PATCH /nodes/:id. Owner only; writes nothing.
today.get('/let-go', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const ask = pageOf(c, 'lg', { sizes: DONE_PAGE_SIZES, fallback: DONE_PAGE_SIZE });
  const [gate, rows, total] = await Promise.all([
    taskGate(db, user.id),
    db.prepare("SELECT * FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'archived' ORDER BY updated_at DESC, id ASC LIMIT ? OFFSET ?").bind(user.id, ask.limit, ask.offset).all<NodeRow>(),
    db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'archived'").bind(user.id).first<{ n: number }>(),
  ]);
  const { items, page } = paged(rows.results, ask);
  const res: DoneTasksResponse = { tasks: await withSubtasks(db, user.id, items.map((t) => toNode(t, gate))), page, total: total?.n ?? 0 };
  return c.json(res);
});

/**
 * Hidden tasks (2026-11-12, the founder): the person's open tasks hidden on their day, dated or not, a page at a time (prefix `hd`, 10, 25
 * or 50, ten by default), Until tomorrow first and then Until I unhide it, with how many in all. Whole: Daily's Area cut and Bottlenecks
 * view never cut it. Owner only; writes nothing. Both reads go through idx_nodes_user_hidden (migration 0138), which holds only open tasks
 * that carry a hide, so a page never visits the person's other tasks. A day sent that is not on the calendar is refused; with none, the
 * person's own today in their zone. A tick from here pays and counts like any task's (POST /nodes/:id/complete, the do-date lock kept).
 */
today.get('/hidden', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const asked = c.req.query('date');
  if (asked !== undefined && !DATE_RE.test(asked)) return c.json({ error: 'That is not a real day.' }, 400);
  const date = asked ?? dayInZone(user.timezone);
  const ask = pageOf(c, HIDDEN_PAGE_PREFIX, TEN_A_PAGE);
  const where = "user_id = ?1 AND kind = 'task' AND status = 'active' AND hidden_until IS NOT NULL AND hidden_until >= ?2";
  const [gate, rows, total] = await Promise.all([
    taskGate(db, user.id),
    db.prepare(`SELECT * FROM nodes INDEXED BY idx_nodes_user_hidden WHERE ${where} ORDER BY hidden_until ASC, rowid ASC LIMIT ?3 OFFSET ?4`).bind(user.id, date, ask.limit, ask.offset).all<NodeRow>(),
    db.prepare(`SELECT COUNT(*) AS n FROM nodes INDEXED BY idx_nodes_user_hidden WHERE ${where}`).bind(user.id, date).first<{ n: number }>(),
  ]);
  const { items, page } = paged(rows.results, ask);
  const res: HiddenTasksResponse = { tasks: await withSubtasks(db, user.id, items.map((t) => toNode(t, gate))), page, total: total?.n ?? 0 };
  return c.json(res);
});

// The week ahead, planned from the open tasks: a suggested day for each task that has none, how strong the plan is, and a few plain notes.
// It writes nothing. The screen keeps what the person keeps, one task at a time, through the ordinary edit.
today.get('/week-plan', async (c) => {
  const user = c.get('user');
  const date = dateParam(c.req.query('date'), user.timezone);
  const hours = Math.max(1, Math.min(12, Math.round(Number(c.req.query('hours')) || PLAN_DAY_MINUTES / 60)));
  const db = c.env.DB;
  const dates = weekDates(date).slice(0, 7);
  const [rows, blocking] = await Promise.all([
    db
      .prepare(`SELECT id, title, relationship, estimate_min, priority, do_date, due_date, origin, time_block_id, life_area, due_time FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'active'${shownOn('', '?2')} ORDER BY created_at LIMIT 600`)
      .bind(user.id, date)
      .all<{ id: string; title: string; relationship: RelationshipKey; estimate_min: number | null; priority: number | null; do_date: string | null; due_date: string | null; origin: string | null; time_block_id: string | null; life_area: string | null; due_time: string | null }>(),
    loadBlocking(db, user.id, dates),
  ]);
  const tasks: PlanTask[] = rows.results.map((r) => ({
    id: r.id,
    title: r.title,
    relationship: r.relationship,
    estimateMin: r.estimate_min,
    priority: (r.priority as PlanTask['priority']) ?? null,
    doDate: r.do_date,
    dueDate: r.due_date,
    fromPillar: r.origin === 'build',
    timeBlockId: r.time_block_id,
    lifeArea: parseLifeArea(r.life_area),
    dueTime: r.due_time,
  }));
  const plans = dates.map((d) => dayPlan(blocking, d));
  const plan = planWeek(date, tasks, hours * 60, { days: plans.map((p) => ({ date: p.date, slots: slotOrder(p.slots), templateId: p.template.id, templateName: p.template.name })), blocks: blocking.blocks });
  return c.json({ plan, blocks: blocking.blocks });
});

// The month calendar on Daily: every task whose day (do date, else due date) falls in the month, ticked ones included, and the projects a new task can go under.
// Bounded: at most MONTH_TASKS_MAX tasks (one extra row is read so `more` is true); the person's own, filtered by the session user.
today.get('/month', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const month = c.req.query('month') ?? '';
  if (!MONTH_RE.test(month)) return c.json({ error: 'month must be a real month like 2026-11' }, 400);
  const dayAsked = c.req.query('day');
  if (dayAsked !== undefined && !DATE_RE.test(dayAsked)) return c.json({ error: 'day must be a real day like 2026-11-02' }, 400);
  const start = `${month}-01`;
  const end = `${monthShift(month, 1)}-01`;
  const [gate, rows, projects, kindRead] = await Promise.all([
    taskGate(db, user.id),
    db
      .prepare(
        `SELECT * FROM nodes WHERE user_id = ? AND kind = 'task' AND status IN ('active', 'done')
         AND COALESCE(do_date, due_date) >= ? AND COALESCE(do_date, due_date) < ?
         ORDER BY COALESCE(do_date, due_date) ASC, CASE WHEN due_time IS NULL THEN 1 ELSE 0 END, due_time ASC, CASE WHEN priority IS NULL THEN 1 ELSE 0 END, priority ASC, created_at ASC LIMIT ?`,
      )
      .bind(user.id, start, end, MONTH_TASKS_MAX + 1)
      .all<NodeRow>(),
    db
      .prepare("SELECT id, title, relationship FROM nodes WHERE user_id = ? AND kind = 'project' AND status = 'active' ORDER BY relationship ASC, sort_order ASC, created_at ASC LIMIT 100")
      .bind(user.id)
      .all<MonthProject>(),
    // Kinds of day (2026-11-06): each day's template, set for the date or given by the week (the default has none), for the marks.
    kindsBetween(db, user, start, shiftDate(end, -1)),
  ]);
  const more = rows.results.length > MONTH_TASKS_MAX;
  // The day the hidden marks are read on: the device's day the screen sent, else the person's own in their zone.
  const asOf = dayAsked ?? dayInZone(user.timezone);
  const tasks: MonthTask[] = rows.results.slice(0, MONTH_TASKS_MAX).map((r) => {
    const n = toNode(r, gate);
    const day = n.doDate ?? n.dueDate ?? start;
    return {
      id: n.id,
      title: n.title,
      relationship: n.relationship,
      doDate: n.doDate,
      dueDate: n.dueDate,
      day,
      status: n.status === 'done' ? 'done' : 'active',
      priority: n.priority,
      lifeArea: n.lifeArea,
      openKind: n.openKind ?? null,
      // Hidden on the screen's day (2026-11-12): still on the calendar, with a quiet mark; a ticked one keeps no mark.
      ...(n.status === 'active' && taskHiddenOn(n.hiddenUntil, asOf) ? { hidden: true } : {}),
      time: n.dueTime,
      estimateMin: n.estimateMin,
      repeat: n.repeat ? repeatLabel(n.repeat, day) : null,
      readyAt: n.readyAt,
      completedAt: n.completedAt,
    };
  });
  const kb = kindRead.blocking;
  const kinds: TodayMonthResponse['kinds'] = { days: kindRead.kinds.days, templates: kb.templates.map((t) => ({ id: t.id, name: t.name, color: kindRead.colors[t.id] ?? null })), defaultId: kb.defaultId, pattern: kb.pattern };
  const res: TodayMonthResponse = { month, today: dayAsked ?? dateParam(undefined, user.timezone), tasks, more, projects: projects.results, kinds };
  return c.json(res);
});

today.post('/checkin', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ date?: string }>().catch(() => ({}) as { date?: string });
  const date = dateParam(body.date, user.timezone);
  if (!dateNearToday(date)) return c.json({ error: 'That date is not today. Check-ins only count on the day itself.' }, 400);
  if (user.last_checkin && date < user.last_checkin) return c.json({ error: 'You already checked in for a later day.' }, 400);

  if (user.last_checkin === date) {
    const res: CheckinResponse = { streak: user.streak, bestStreak: user.best_streak, awarded: 0, points: 0, streakBonus: 0, alreadyCheckedIn: true };
    return c.json(res);
  }
  const streak = user.last_checkin === shiftDate(date, -1) ? user.streak + 1 : 1;
  const best = Math.max(streak, user.best_streak);
  const now = nowIso();
  const streakBonus = streak % POINTS.streakBonusEvery === 0 ? POINTS.streakBonus : 0;
  const points = POINTS.checkin + streakBonus;
  const stmts = [
    db
      .prepare('UPDATE users SET streak = ?, best_streak = ?, last_checkin = ?, xp = xp + ?, points = points + ? WHERE id = ?')
      .bind(streak, best, date, XP.checkin, points, user.id),
    db
      .prepare('INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, NULL, ?, ?, ?, ?)')
      .bind(user.id, 'checkin', date, XP.checkin, now),
    db
      .prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(user.id, POINTS.checkin, 'checkin', date, now),
  ];
  if (streakBonus > 0) {
    stmts.push(
      db
        .prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(user.id, streakBonus, 'streak_bonus', String(streak), now),
    );
  }
  // A day of use for someone who joined with an invite code: on the third, the referral pays its maker (invites.ts). In the same batch,
  // after the check-in it counts, so it costs no round trip but the one on the day it pays; it finds nothing for anyone whose code is
  // settled or who had none.
  const invite = inviteActiveStmts(db, user);
  const done = await db.batch([...stmts, ...invite]);
  await afterInviteActive(db, done.slice(-invite.length));
  const res: CheckinResponse = { streak, bestStreak: best, awarded: XP.checkin, points, streakBonus, alreadyCheckedIn: false };
  return c.json(res);
});

today.post('/spark', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ date?: string }>().catch(() => ({}) as { date?: string });
  const date = dateParam(body.date, user.timezone);
  if (!dateNearToday(date)) return c.json({ error: 'That date is not today. Sparks only count on the day itself.' }, 400);
  const existing = await db
    .prepare('SELECT relationship FROM spark_completions WHERE user_id = ? AND date = ?')
    .bind(user.id, date)
    .first<{ relationship: RelationshipKey }>();
  if (existing) return c.json({ awarded: 0, relationship: existing.relationship, alreadyDone: true });

  const relationship = await weakestRelationship(db, user.id);
  const now = nowIso();
  await db.batch([
    db.prepare('INSERT INTO spark_completions (user_id, date, relationship, created_at) VALUES (?, ?, ?, ?)').bind(user.id, date, relationship, now),
    db.prepare('UPDATE relationship_scores SET xp = xp + ? WHERE user_id = ? AND relationship = ?').bind(XP.spark, user.id, relationship),
    db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').bind(XP.spark, user.id),
    db
      .prepare('INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(user.id, relationship, 'spark', date, XP.spark, now),
  ]);
  const fresh = await getUser(db, user.id);
  return c.json({ awarded: XP.spark, relationship, alreadyDone: false, xp: fresh?.xp ?? user.xp });
});

// The not-to-do list: things to stay away from. Each item keeps its own streak of kept days.
today.post('/not-to-do', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ title?: unknown; relationship?: unknown }>().catch(() => ({}) as { title?: unknown; relationship?: unknown });
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, NOT_TO_DO_TITLE_MAX) : '';
  if (!title) return c.json({ error: 'Say what you are staying away from.' }, 400);
  const relationship = typeof body.relationship === 'string' && RELATIONSHIPS.some((r) => r.key === body.relationship) ? (body.relationship as RelationshipKey) : null;
  const count = await db.prepare('SELECT COUNT(*) AS n FROM not_to_do WHERE user_id = ?').bind(user.id).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_NOT_TO_DO) return c.json({ error: `${MAX_NOT_TO_DO} is plenty. Remove one to add another.` }, 400);
  const id = newId();
  const now = nowIso();
  await db.prepare('INSERT INTO not_to_do (id, user_id, title, relationship, streak, best_streak, created_at) VALUES (?, ?, ?, ?, 0, 0, ?)').bind(id, user.id, title, relationship, now).run();
  const item: NotToDo = { id, title, relationship, streak: 0, bestStreak: 0, today: null, week: [null, null, null, null, null, null, null], createdAt: now };
  return c.json({ item }, 201);
});

// Mark a day: kept, slipped, or nothing (an unticked box). Today or yesterday only.
today.post('/not-to-do/:id/day', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT * FROM not_to_do WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first<NotToDoRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ date?: string; today?: string; status?: unknown }>().catch(() => ({}) as { date?: string; today?: string; status?: unknown });
  const date = dateParam(body.date, user.timezone);
  if (!dateNearToday(date)) return c.json({ error: 'Only today or yesterday can be marked.' }, 400);
  // The streak is counted as of the person's today, which is the marked day or the day after it.
  const today = body.today && DATE_RE.test(body.today) && body.today >= date && dateNearToday(body.today) ? body.today : date;
  const status: NotToDoStatus | null | undefined = body.status === 'kept' || body.status === 'slipped' ? body.status : body.status === null || body.status === undefined ? null : undefined;
  if (status === undefined) return c.json({ error: 'status must be kept, slipped or null' }, 400);
  const now = nowIso();
  const stmts = status
    ? [db.prepare('INSERT INTO not_to_do_days (item_id, user_id, day, status, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(item_id, day) DO UPDATE SET status = excluded.status').bind(row.id, user.id, date, status, now)]
    : [db.prepare('DELETE FROM not_to_do_days WHERE item_id = ? AND day = ?').bind(row.id, date)];
  // A kept day pays once, however many times the box is ticked and unticked, and is never clawed back.
  let awarded = 0;
  if (status === 'kept') {
    const paid = await db.prepare("SELECT 1 FROM xp_events WHERE user_id = ? AND source = 'not_to_do' AND source_id = ?").bind(user.id, `${row.id}:${date}`).first();
    if (!paid) {
      awarded = XP.notToDo;
      stmts.push(db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').bind(awarded, user.id));
      if (row.relationship) stmts.push(db.prepare('UPDATE relationship_scores SET xp = xp + ? WHERE user_id = ? AND relationship = ?').bind(awarded, user.id, row.relationship));
      stmts.push(
        db
          .prepare('INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(user.id, row.relationship, 'not_to_do', `${row.id}:${date}`, awarded, now),
      );
    }
  }
  await db.batch(stmts);
  const all = await db.prepare('SELECT day, status FROM not_to_do_days WHERE item_id = ? ORDER BY day DESC LIMIT 2000').bind(row.id).all<{ day: string; status: NotToDoStatus }>();
  const days: DayMap = {};
  for (const d of all.results) days[d.day] = d.status;
  const streak = notToDoStreak(days, today);
  const best = Math.max(row.best_streak, streak);
  await db.prepare('UPDATE not_to_do SET streak = ?, best_streak = ? WHERE id = ?').bind(streak, best, row.id).run();
  return c.json({ item: toNotToDo({ ...row, streak, best_streak: best }, days, today), awarded });
});

today.delete('/not-to-do/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const r = await db.prepare('DELETE FROM not_to_do WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).run();
  if (!r.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

// What kind of day it is (DAY_TYPES in shared): one row per person per day, owner only. It only changes how Daily sorts tasks.
// The day comes from the device: `today` is the person's own today (near the server's), and `date` is that day or the next.
function dayTypeDay(date: unknown, today: unknown): string | null {
  if (typeof date !== 'string' || !DATE_RE.test(date)) return null;
  const own = typeof today === 'string' && DATE_RE.test(today) && dateNearToday(today) ? today : null;
  if (!own) return dateNearToday(date) ? date : null;
  return date === own || date === shiftDate(own, 1) ? date : null;
}

// The kind of day is now a day template (docs/time-blocks.md); these two routes keep working for the old picker and the assistant.
// GET answers the template's old kind (null for a template made from none) and its id; PUT takes a kind, which maps to the person's
// template made from it, or a templateId. Both write the same day_types row as PUT /time-blocks/days.
today.get('/day-type', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const date = dayTypeDay(c.req.query('date'), c.req.query('today'));
  if (!date) return c.json({ error: 'Pick today or tomorrow.' }, 400);
  const blocking = await loadBlocking(db, user.id, [date]);
  const templateId = blocking.overrides[date] ?? null;
  const tpl = templateId ? blocking.templates.find((t) => t.id === templateId) : null;
  const body: DayTypeResponse = { date, kind: tpl?.sourceKind ?? null, templateId };
  return c.json(body);
});

today.put('/day-type', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ date?: unknown; today?: unknown; kind?: unknown; templateId?: unknown }>().catch(() => ({}) as { date?: unknown; today?: unknown; kind?: unknown; templateId?: unknown });
  const date = dayTypeDay(body.date, body.today);
  if (!date) return c.json({ error: 'Pick today or tomorrow.' }, 400);
  const asksTemplate = body.templateId !== undefined;
  const clear = asksTemplate ? body.templateId === null || body.templateId === '' : body.kind === null || body.kind === undefined || body.kind === '';
  if (clear) {
    await db.prepare('DELETE FROM day_types WHERE user_id = ? AND day = ?').bind(user.id, date).run();
    const cleared: DayTypeResponse = { date, kind: null, templateId: null };
    return c.json(cleared);
  }
  const blocking = await loadBlocking(db, user.id, [date]);
  let tpl;
  if (asksTemplate) {
    tpl = typeof body.templateId === 'string' ? blocking.templates.find((t) => t.id === body.templateId) : undefined;
    if (!tpl) return c.json({ error: 'not found' }, 404);
  } else {
    const kind = dayTypeOf(body.kind);
    if (!kind) return c.json({ error: 'That is not a kind of day we know.' }, 400);
    // The person's template made from that kind: the starting one (by its seed), else any with that kind.
    const seed = startingTemplateFor(kind.key).seed;
    tpl = blocking.templates.find((t) => t.seed === seed && t.sourceKind === kind.key) ?? blocking.templates.find((t) => t.sourceKind === kind.key);
    if (!tpl) return c.json({ error: 'That kind of day was removed; pick a day template.' }, 404);
  }
  await db
    .prepare('INSERT INTO day_types (user_id, day, kind, created_at, template_id) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, day) DO UPDATE SET kind = excluded.kind, template_id = excluded.template_id')
    .bind(user.id, date, tpl.sourceKind ?? 'template', nowIso(), tpl.id)
    .run();
  const saved: DayTypeResponse = { date, kind: tpl.sourceKind, templateId: tpl.id };
  return c.json(saved);
});
