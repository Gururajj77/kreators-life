import { Hono } from 'hono';
import { addDays, daysBetween, DONE_PAGE_SIZE, DONE_PAGE_SIZES, isNodeKind, isRelationshipKey, lifeAreaProblem, nextOccurrence, openKindProblem, parentKind, parseLifeArea, parseOpenKind, parsePriority, parseRepeat, taskReadyAt, WAIT, XP, type CompleteResponse, type DoneTasksResponse, type RippleEvent } from '@kreators/shared';
import type { AppEnv } from '../env';
import { TIME_RE } from '@kreators/shared';
import { ancestorsOf, DATE_RE, diffBadges, getNode, newId, nowIso, pageOf, paged, readyFromNow, toNode, type NodeRow, taskGate, readyAtFor, withSubtasks, badgeState, getUser, keptStats, statsAfterTick, storeStats } from '../db';
import { dateNearToday, personDay, shiftDate } from '../db';
import { hiddenUntilFor, parseTaskHide, taskHideProblem } from '@kreators/shared';
import { blockFromBody, dayPlan, loadBlocking } from '../timeBlocks';
import { blockDayMinutes, parsePlaceDay, type BreakdownResponse, type PlaceDayResponse } from '@kreators/shared';
import { breakdownTask, parseBreakdown } from '@kreators/shared/contentDays';
import { afterInviteActive, inviteActiveStmts } from '../invites';
import { dayBounds } from './today';

/** Whether a request names a block, by id or by name. */
const namesBlock = (b: NodeBody): boolean => (b.timeBlockId !== undefined) || (b.timeBlock !== undefined);

export const nodes = new Hono<AppEnv>();

nodes.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const relationship = c.req.query('relationship');
  const kind = c.req.query('kind');
  const clauses = ['user_id = ?', "status != 'archived'"];
  const binds: unknown[] = [user.id];
  if (relationship) {
    if (!isRelationshipKey(relationship)) return c.json({ error: 'bad relationship' }, 400);
    clauses.push('relationship = ?');
    binds.push(relationship);
  }
  if (kind) {
    if (!isNodeKind(kind)) return c.json({ error: 'bad kind' }, 400);
    clauses.push('kind = ?');
    binds.push(kind);
  }
  // The tick gate and the rows do not depend on each other: read together.
  const [gate, rows] = await Promise.all([
    taskGate(db, user.id),
    db
      .prepare(`SELECT * FROM nodes WHERE ${clauses.join(' AND ')} ORDER BY sort_order ASC, created_at ASC`)
      .bind(...binds)
      .all<NodeRow>(),
  ]);
  return c.json({ nodes: await withSubtasks(db, user.id, rows.results.map((r) => toNode(r, gate))) });
});

// A pillar's done tasks, a page at a time (2026-11-07, the founder: "this can pile up with time"): newest first, 10, 25 or 50 a page,
// ten by default (prefix `dn`), with the true count. Owner only. GET / still carries every node, so a project's counts and pace stay true.
nodes.get('/done', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const relationship = c.req.query('relationship');
  if (!isRelationshipKey(relationship)) return c.json({ error: 'bad relationship' }, 400);
  const ask = pageOf(c, 'dn', { sizes: DONE_PAGE_SIZES, fallback: DONE_PAGE_SIZE });
  const [gate, rows, total] = await Promise.all([
    taskGate(db, user.id),
    db
      .prepare("SELECT * FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND relationship = ? ORDER BY completed_at DESC, id ASC LIMIT ? OFFSET ?")
      .bind(user.id, relationship, ask.limit, ask.offset)
      .all<NodeRow>(),
    db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND relationship = ?").bind(user.id, relationship).first<{ n: number }>(),
  ]);
  const { items, page } = paged(rows.results, ask);
  const res: DoneTasksResponse = { tasks: await withSubtasks(db, user.id, items.map((r) => toNode(r, gate))), page, total: total?.n ?? 0 };
  return c.json(res);
});

// One layer, the person's own. A screen that has only an id (Plan my week picks a task by name) reads it here to fill its form.
nodes.get('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const [row, gate] = await Promise.all([getNode(db, user.id, c.req.param('id')), taskGate(db, user.id)]);
  if (!row) return c.json({ error: 'not found' }, 404);
  const [node] = await withSubtasks(db, user.id, [toNode(row, gate)]);
  return c.json({ node });
});

/** What a layer is made from, as sent: checked here, whoever sends it. */
export interface NodeBody {
  kind?: unknown;
  parentId?: unknown;
  relationship?: unknown;
  title?: unknown;
  note?: unknown;
  dueDate?: unknown;
  doDate?: unknown;
  repeat?: unknown;
  priority?: unknown;
  remind?: unknown;
  forReview?: unknown;
  /** "Count it as a habit": true or false is the person's pick, null goes back to the old rule (a repeating task is one). */
  habit?: unknown;
  /** The area of life: a key or name, or null (or "none") for none. An unknown value is refused (`lifeAreaProblem`). */
  lifeArea?: unknown;
  /** The time block picked for it: one of the person's own block ids, or null, '' or 'none' to clear it (then it falls in the block its time sits in). */
  timeBlockId?: unknown;
  /** The same by name (the assistant sends names; screens send ids). 'none' clears it. */
  timeBlock?: unknown;
  /** Open business (migration 0120): 'unfinished', 'unresolved', 'undecided', or null (or "none") for none. Anything else is refused. */
  openKind?: unknown;
  /**
   * Hidden tasks (migration 0137): 'tomorrow' (Until tomorrow), 'always' (Until I unhide it), or null (or "none", "show") to show it again.
   * Read only by PATCH /nodes/:id, the person's own tap; a coach's edit never carries it.
   */
  hide?: unknown;
  /** The person's today from their device, for Until tomorrow (checked by `personDay`: a day further than one from their zone's is not taken). */
  today?: unknown;
  dueTime?: unknown;
  estimateMin?: unknown;
  status?: unknown;
}
type Refused = { error: string; status: 400 | 404 };

/** `habit` from a request: true 1, false 0, anything else null (the old rule). */
const habitValue = (v: unknown): 0 | 1 | null => (v === true ? 1 : v === false ? 0 : null);

/** The do date is the day it will be done, the due date is the day it has to be done before: the first cannot come after the second. */
export const DATES_PROBLEM = 'Do it on or before the day it is due.';

/**
 * Add a layer to someone's pyramid. The one rule for it: the person's own tap, and a life coach adding a task to a
 * student's pyramid (`addedBy` is the coach), so a coach's task waits, pays and ticks exactly like the student's own.
 */
export async function createNode(db: D1Database, ownerId: string, body: NodeBody, addedBy: string | null = null): Promise<{ row: NodeRow } | Refused> {
  if (!isNodeKind(body.kind)) return { error: 'bad kind', status: 400 };
  if (!isRelationshipKey(body.relationship)) return { error: 'bad relationship', status: 400 };
  const kind = body.kind;
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 140) : '';
  if (!title) return { error: 'title required', status: 400 };
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
  const dueDate = typeof body.dueDate === 'string' && DATE_RE.test(body.dueDate) ? body.dueDate : null;
  const dueTime = kind === 'task' && typeof body.dueTime === 'string' && TIME_RE.test(body.dueTime) ? body.dueTime : null;
  const estimateMin = kind === 'task' && Number.isFinite(Number(body.estimateMin)) && Number(body.estimateMin) > 0 ? Math.min(600, Math.round(Number(body.estimateMin))) : null;

  const expectedParent = parentKind(kind);
  let parentId: string | null = null;
  if (expectedParent) {
    if (typeof body.parentId !== 'string') return { error: `a ${expectedParent} is required first`, status: 400 };
    const parent = await getNode(db, ownerId, body.parentId);
    if (!parent || parent.kind !== expectedParent || parent.relationship !== body.relationship) return { error: 'parent does not fit this layer', status: 400 };
    parentId = parent.id;
  }

  // A task can also carry a do date and a rule for coming back. A rule needs a day to count from. All of it is checked before anything is written, so a refused task leaves nothing behind.
  const doDate = kind === 'task' && typeof body.doDate === 'string' && DATE_RE.test(body.doDate) ? body.doDate : null;
  const repeat = kind === 'task' ? parseRepeat(body.repeat) : null;
  if (doDate && dueDate && doDate > dueDate) return { error: DATES_PROBLEM, status: 400 };
  if (repeat && !doDate && !dueDate) return { error: 'Pick a do date or a due date for it to repeat from.', status: 400 };
  const areaProblem = kind === 'task' ? lifeAreaProblem(body.lifeArea) : null;
  if (areaProblem) return { error: areaProblem, status: 400 };
  const openProblem = kind === 'task' ? openKindProblem(body.openKind) : null;
  if (openProblem) return { error: openProblem, status: 400 };
  // The block it sits in: the person's own, checked before anything is written.
  let timeBlockId: string | null = null;
  if (kind === 'task' && namesBlock(body)) {
    const picked = await blockFromBody(db, ownerId, body);
    if (picked && 'error' in picked) return { error: picked.error, status: 400 };
    timeBlockId = picked?.id ?? null;
  }

  const now = nowIso();
  const id = newId();
  const sortRow = await db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM nodes WHERE user_id = ? AND kind = ? AND relationship = ?')
    .bind(ownerId, kind, body.relationship)
    .first<{ next: number }>();
  await db
    .prepare(
      `INSERT INTO nodes (id, user_id, kind, parent_id, relationship, title, note, status, xp, due_date, completed_at, ready_at, sort_order, created_at, updated_at, due_time, estimate_min, added_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, ownerId, kind, parentId, body.relationship, title, note, dueDate, kind === 'task' ? readyFromNow() : null, sortRow?.next ?? 0, now, now, dueTime, estimateMin, addedBy)
    .run();
  const priority = kind === 'task' ? parsePriority(body.priority) : null;
  const remind = kind === 'task' && body.remind === true ? 1 : 0;
  const forReview = kind === 'task' && body.forReview === true ? 1 : 0;
  const habit = kind === 'task' ? habitValue(body.habit) : null;
  const lifeArea = kind === 'task' ? parseLifeArea(body.lifeArea) : null;
  const openKind = kind === 'task' ? parseOpenKind(body.openKind) : null;
  if (doDate || repeat || priority !== null || remind || forReview || habit !== null || lifeArea || timeBlockId || openKind) await db.prepare('UPDATE nodes SET do_date = ?, repeat_json = ?, priority = ?, remind = ?, for_review = ?, habit = ?, life_area = ?, time_block_id = ?, open_kind = ? WHERE id = ?').bind(doDate, repeat ? JSON.stringify(repeat) : null, priority, remind, forReview, habit, lifeArea, timeBlockId, openKind, id).run();
  const row = await getNode(db, ownerId, id);
  return row ? { row } : { error: 'not found', status: 404 };
}

/**
 * Change a layer's words, date and plan, or archive it and bring it back. The one rule, for the person and for a
 * life coach changing a task (who never sends a status). Returns the row as it is now.
 */
export async function editNode(db: D1Database, row: NodeRow, body: NodeBody, own: { hideDay?: string } = {}): Promise<NodeRow> {
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 140) : row.title;
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : row.note;
  const dueDate = body.dueDate === null ? null : typeof body.dueDate === 'string' && DATE_RE.test(body.dueDate) ? body.dueDate : row.due_date;
  // Time and length are planning aids: changing them never restarts the wait.
  const dueTime = body.dueTime === null ? null : typeof body.dueTime === 'string' && TIME_RE.test(body.dueTime) ? body.dueTime : row.due_time;
  const estimateMin = body.estimateMin === null ? null : Number.isFinite(Number(body.estimateMin)) && Number(body.estimateMin) > 0 ? Math.min(600, Math.round(Number(body.estimateMin))) : row.estimate_min;
  // Done and active only change through complete and uncomplete, which move xp.
  // Here a node can only be archived, or brought back from the archive.
  const status =
    body.status === 'archived' && row.status === 'active' ? 'archived' : body.status === 'active' && row.status === 'archived' ? 'active' : row.status;
  // Renaming a task makes it a different task, so its wait starts again.
  const readyAt = row.kind === 'task' && title !== row.title ? readyFromNow() : row.ready_at;
  // Letting a task go ends its hide too (2026-11-12), so one brought back from Let go is on Daily again, never waiting unseen under Hidden tasks.
  const letGo = status === 'archived' && row.status === 'active' ? 1 : 0;
  await db
    .prepare('UPDATE nodes SET title = ?, note = ?, due_date = ?, status = ?, ready_at = ?, updated_at = ?, due_time = ?, estimate_min = ?, hidden_until = CASE WHEN ? = 1 THEN NULL ELSE hidden_until END WHERE id = ?')
    .bind(title, note, dueDate, status, readyAt, nowIso(), dueTime, estimateMin, letGo, row.id)
    .run();
  if (row.kind === 'task' && ('doDate' in body || 'repeat' in body)) {
    const doDate = body.doDate === null ? null : typeof body.doDate === 'string' && DATE_RE.test(body.doDate) ? body.doDate : (row.do_date ?? null);
    let repeat = 'repeat' in body ? (body.repeat === null ? null : (parseRepeat(body.repeat) ?? parseRepeat(row.repeat_json))) : parseRepeat(row.repeat_json);
    // A rule with no day to count from is no rule.
    if (!doDate && !dueDate) repeat = null;
    await db.prepare('UPDATE nodes SET do_date = ?, repeat_json = ? WHERE id = ?').bind(doDate, repeat ? JSON.stringify(repeat) : null, row.id).run();
  }
  if (row.kind === 'task' && ('priority' in body || 'remind' in body)) {
    const priority = 'priority' in body ? parsePriority(body.priority) : parsePriority(row.priority);
    // Remember is a tag. With a day it also sends an inbox note on that day; without one it waits in the To remember list on Daily.
    const remind = 'remind' in body ? body.remind === true : (row.remind ?? 0) === 1;
    await db.prepare('UPDATE nodes SET priority = ?, remind = ? WHERE id = ?').bind(priority, remind ? 1 : 0, row.id).run();
  }
  // For review is a flag: the review for the period lists the task, and a tap puts it into an answer.
  if (row.kind === 'task' && 'forReview' in body) await db.prepare('UPDATE nodes SET for_review = ? WHERE id = ?').bind(body.forReview === true ? 1 : 0, row.id).run();
  // Count it as a habit: the person's own pick, or null to go back to the old rule.
  if (row.kind === 'task' && 'habit' in body) await db.prepare('UPDATE nodes SET habit = ? WHERE id = ?').bind(habitValue(body.habit), row.id).run();
  // The area of life: a tag and a filter, never a change to what a tick pays. A value the route did not check is left alone.
  if (row.kind === 'task' && 'lifeArea' in body && !lifeAreaProblem(body.lifeArea)) await db.prepare('UPDATE nodes SET life_area = ? WHERE id = ?').bind(parseLifeArea(body.lifeArea), row.id).run();
  // Open business: a tag and a filter, like the area. Ending one is the ordinary action (a day, a tick, or the archive to let it go).
  if (row.kind === 'task' && 'openKind' in body && !openKindProblem(body.openKind)) await db.prepare('UPDATE nodes SET open_kind = ? WHERE id = ?').bind(parseOpenKind(body.openKind), row.id).run();
  // The time block: the person's own (the task's owner, so a coach can only pick the student's), or cleared. A value that is not theirs is left alone.
  if (row.kind === 'task' && namesBlock(body)) {
    const picked = await blockFromBody(db, row.user_id, body);
    if (picked && !('error' in picked)) await db.prepare('UPDATE nodes SET time_block_id = ? WHERE id = ? AND user_id = ?').bind(picked.id, row.id, row.user_id).run();
  }
  // Hide it (2026-11-12): only the person's own PATCH passes their day (`own.hideDay`), so a coach's edit never hides or shows a task.
  // Until tomorrow writes that day as the last hidden one; Until I unhide it writes HIDDEN_ALWAYS; showing it clears the column.
  if (row.kind === 'task' && own.hideDay && 'hide' in body && !taskHideProblem(body.hide)) {
    await db.prepare('UPDATE nodes SET hidden_until = ? WHERE id = ? AND user_id = ?').bind(hiddenUntilFor(parseTaskHide(body.hide), own.hideDay), row.id, row.user_id).run();
  }
  return (await getNode(db, row.user_id, row.id)) ?? row;
}

/**
 * A repeating task that was just ticked makes the next one: same place in the pyramid, same words, the rule carried on, the dates moved to
 * the next day the rule falls on after today (or after its own day, if that is later). The do date and due date keep the same gap. Only
 * one next task is ever made from one tick, and it remembers where it came from.
 */
async function spawnNext(db: D1Database, row: NodeRow, today: string): Promise<NodeRow | null> {
  const rule = parseRepeat(row.repeat_json);
  if (!rule || row.kind !== 'task') return null;
  const base = row.do_date ?? row.due_date;
  if (!base) return null;
  const after = base > today ? base : today;
  const next = nextOccurrence(rule, base, after);
  if (!next) return null;
  const made = await db.prepare('SELECT 1 AS x FROM nodes WHERE spawned_from = ? AND user_id = ?').bind(row.id, row.user_id).first();
  if (made) return null;
  // A month or year rule remembers the day it started on, so a short month's clamp is not kept for good.
  const carried = rule.kind === 'monthly' || rule.kind === 'yearly' ? JSON.stringify({ ...rule, anchor: rule.anchor ?? base }) : row.repeat_json;
  const gap = row.do_date && row.due_date ? daysBetween(row.do_date, row.due_date) : 0;
  const doDate = row.do_date ? next : null;
  const dueDate = row.due_date ? (row.do_date ? addDays(next, gap) : next) : null;
  const id = newId();
  const now = nowIso();
  const sortRow = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM nodes WHERE user_id = ? AND kind = ? AND relationship = ?').bind(row.user_id, 'task', row.relationship).first<{ next: number }>();
  await db
    .prepare(
      `INSERT INTO nodes (id, user_id, kind, parent_id, relationship, title, note, status, xp, due_date, completed_at, ready_at, sort_order, created_at, updated_at, due_time, estimate_min, added_by, do_date, repeat_json, spawned_from, priority, remind, for_review, habit, life_area, time_block_id, open_kind)
       VALUES (?, ?, 'task', ?, ?, ?, ?, 'active', 0, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, row.user_id, row.parent_id, row.relationship, row.title, row.note, dueDate, readyFromNow(), sortRow?.next ?? 0, now, now, row.due_time, row.estimate_min, row.added_by ?? null, doDate, carried, row.id, row.priority ?? null, row.remind ?? 0, row.for_review ?? 0, row.habit ?? null, row.life_area ?? null, row.time_block_id ?? null, row.open_kind ?? null)
    .run();
  // The checklist comes back too, all unticked.
  await db
    .prepare('INSERT INTO subtasks (id, user_id, task_id, title, done_at, sort_order, created_at) SELECT lower(hex(randomblob(16))), user_id, ?, title, NULL, sort_order, ? FROM subtasks WHERE task_id = ? AND user_id = ?')
    .bind(id, now, row.id, row.user_id)
    .run();
  return getNode(db, row.user_id, id);
}

/**
 * Place my day (2026-11-12, the founder): saves the plan Daily shows (`autoPlace` in `@kreators/shared/blockHints`, worked out on the
 * screen from GET /today) in one request, each task's start written as its `dueTime` and nothing else (never `ready_at`, so no wait
 * starts again). Owner only, limit `prefs`. Guarded per row in the one UPDATE: still the person's open task, still with no time and no
 * block, still on that day, and not one that repeats (a time would carry to every next one, so the plan never places it); a task another
 * tab or a tap changed since is left alone and answered `changed`, one that is no longer an open task of the person's `gone`. One round
 * trip: the read (as things stood) and the write go in one batch, one transaction. The read looks each sent id up by its key (at most 60),
 * the write goes through the day index, so neither visits the person's other tasks.
 */
nodes.post('/place', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const ask = parsePlaceDay(await c.req.json().catch(() => null));
  if ('problem' in ask) return c.json({ error: ask.problem }, 400);
  const items = JSON.stringify(ask.items);
  const ids = JSON.stringify(ask.items.map((i) => i.id));
  const [open, saved] = await db.batch([
    db.prepare("SELECT n.id FROM json_each(?2) j CROSS JOIN nodes n ON n.id = j.value WHERE n.user_id = ?1 AND n.kind = 'task' AND n.status = 'active'").bind(user.id, ids),
    db
      .prepare(
        `UPDATE nodes INDEXED BY idx_nodes_user_open_day SET due_time = (SELECT json_extract(j.value, '$.dueTime') FROM json_each(?3) j WHERE json_extract(j.value, '$.id') = nodes.id), updated_at = ?4
         WHERE user_id = ?1 AND COALESCE(do_date, due_date) = ?2 AND kind = 'task' AND status = 'active' AND id IN (SELECT json_extract(value, '$.id') FROM json_each(?3))
           AND due_time IS NULL AND time_block_id IS NULL AND repeat_json IS NULL AND (hidden_until IS NULL OR hidden_until < ?2)
         RETURNING id`,
      )
      .bind(user.id, ask.date, items, nowIso()),
  ]);
  const there = new Set((open!.results as { id: string }[]).map((r) => r.id));
  const done = new Set((saved!.results as { id: string }[]).map((r) => r.id));
  const res: PlaceDayResponse = {
    saved: done.size,
    skipped: ask.items.filter((i) => !done.has(i.id)).map((i) => ({ id: i.id, reason: there.has(i.id) ? 'changed' : 'gone' })),
  };
  return c.json(res);
});

/**
 * A content day's "Add to my tasks" (2026-11-12, the founder): ONE task in the block, its list's steps as the task's subtasks, for that day,
 * under one of the person's own active projects in the block's pillar. The same rules as `createNode` (a task under a project of the same
 * pillar, a title of 140 at most, the wait from now, the person's own block), plus `origin` `breakdown:<template>:<block>` so Daily says
 * "Added" instead of offering it twice. The list must be that day's: the day's template is the content day, and the block has a slot in it.
 * A second one for the same day and list (any state but let go) is refused, 409, with the task already there. Limit `create`. It pays like
 * any task when ticked, nothing more. About three round trips: the reads together, the writes in one batch, the subtask count.
 */
nodes.post('/breakdown', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const ask = parseBreakdown(await c.req.json().catch(() => null));
  if ('problem' in ask) return c.json({ error: ask.problem }, 400);
  const origin = `breakdown:${ask.templateSeed}:${ask.blockSeed}`;
  // The same list for the same day, open or ticked (never one let go), read the way GET /today reads it: open ones through the day index,
  // ticked ones through the done index since the day before began (a task cannot be ticked before its do date). Never every task.
  const since = dayBounds(shiftDate(ask.date, -1), user.timezone)[0];
  const SAME_OPEN = "SELECT * FROM nodes INDEXED BY idx_nodes_user_open_day WHERE user_id = ?1 AND kind = 'task' AND status = 'active' AND COALESCE(do_date, due_date) = ?3 AND do_date = ?3 AND origin = ?2";
  const SAME_DONE = "SELECT * FROM nodes WHERE user_id = ?1 AND kind = 'task' AND status = 'done' AND completed_at >= ?4 AND do_date = ?3 AND origin = ?2";
  const already = (): Promise<NodeRow | null> => db.prepare(`${SAME_OPEN} UNION ALL ${SAME_DONE} LIMIT 1`).bind(user.id, origin, ask.date, since).first<NodeRow>();
  const [blocking, project, existing, gate] = await Promise.all([loadBlocking(db, user.id, [ask.date]), getNode(db, user.id, ask.projectId), already(), taskGate(db, user.id)]);
  const answerExisting = async (row: NodeRow) => {
    const [node] = await withSubtasks(db, user.id, [toNode(row, gate)]);
    const res: BreakdownResponse & { error: string } = { error: 'You already added this list for that day.', node: node!, existed: true };
    return c.json(res, 409);
  };
  if (existing) return answerExisting(existing);
  const day = dayPlan(blocking, ask.date);
  if (day.template.seed !== ask.templateSeed) return c.json({ error: 'That day is not that kind of day any more. Open Daily again.' }, 400);
  const block = blocking.blocks.find((b) => b.seed === ask.blockSeed);
  const minutes = block ? blockDayMinutes(block.id, day.slots) : 0;
  if (!block || minutes <= 0) return c.json({ error: 'That block is not on this day any more. Open Daily again.' }, 400);
  if (!project || project.kind !== 'project' || project.status !== 'active') return c.json({ error: 'Pick one of your open projects.' }, 400);
  if (block.pillar && project.relationship !== block.pillar) return c.json({ error: 'Pick a project in the same pillar as the block.' }, 400);
  const task = breakdownTask(ask, { id: block.id, area: block.area, minutes });
  if (!task) return c.json({ error: 'That block has no list of steps.' }, 400);

  const id = newId();
  const now = nowIso();
  // One batch, one transaction: the task (only while no other tab has just made the same one), then its steps (only while the task is there).
  await db.batch([
    db
      .prepare(
        `INSERT INTO nodes (id, user_id, kind, parent_id, relationship, title, note, status, xp, due_date, completed_at, ready_at, sort_order, created_at, updated_at, due_time, estimate_min, added_by, do_date, life_area, time_block_id, origin)
         SELECT ?1, ?2, 'task', ?3, ?4, ?5, '', 'active', 0, NULL, NULL, ?6, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM nodes WHERE user_id = ?2 AND kind = 'task' AND relationship = ?4), ?7, ?7, NULL, ?8, NULL, ?9, ?10, ?11, ?12
         WHERE NOT EXISTS (SELECT 1 FROM nodes INDEXED BY idx_nodes_user_open_day WHERE user_id = ?2 AND kind = 'task' AND status = 'active' AND COALESCE(do_date, due_date) = ?9 AND do_date = ?9 AND origin = ?12)
           AND NOT EXISTS (SELECT 1 FROM nodes WHERE user_id = ?2 AND kind = 'task' AND status = 'done' AND completed_at >= ?13 AND do_date = ?9 AND origin = ?12)`,
      )
      .bind(id, user.id, project.id, project.relationship, task.title, readyFromNow(), now, task.estimateMin, task.doDate, task.lifeArea, task.timeBlockId, task.origin, since),
    db
      .prepare(
        `INSERT INTO subtasks (id, user_id, task_id, title, done_at, sort_order, created_at)
         SELECT lower(hex(randomblob(16))), ?1, ?2, value, NULL, CAST(key AS INTEGER), ?3 FROM json_each(?4) WHERE EXISTS (SELECT 1 FROM nodes WHERE id = ?2 AND user_id = ?1)`,
      )
      .bind(user.id, id, now, JSON.stringify(task.subtasks.slice(0, MAX_SUBTASKS))),
  ]);
  const row = await getNode(db, user.id, id);
  if (!row) {
    const other = await already();
    return other ? answerExisting(other) : c.json({ error: 'not found' }, 404);
  }
  const [node] = await withSubtasks(db, user.id, [toNode(row, gate)]);
  const res: BreakdownResponse = { node: node! };
  return c.json(res, 201);
});

nodes.post('/', async (c) => {
  const body = await c.req.json<NodeBody>().catch(() => ({}) as NodeBody);
  const made = await createNode(c.env.DB, c.get('user').id, body);
  if ('error' in made) return c.json({ error: made.error }, made.status);
  return c.json({ node: toNode(made.row) }, 201);
});

nodes.patch('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await getNode(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<NodeBody>().catch(() => ({}) as NodeBody);
  if (row.kind === 'task') {
    const doNext = body.doDate === null ? null : typeof body.doDate === 'string' && DATE_RE.test(body.doDate) ? body.doDate : (row.do_date ?? null);
    const dueNext = body.dueDate === null ? null : typeof body.dueDate === 'string' && DATE_RE.test(body.dueDate) ? body.dueDate : row.due_date;
    if (doNext && dueNext && doNext > dueNext) return c.json({ error: DATES_PROBLEM }, 400);
    if (body.repeat && !parseRepeat(body.repeat)) return c.json({ error: 'That is not a way to repeat.' }, 400);
    if (body.priority !== undefined && body.priority !== null && parsePriority(body.priority) === null) return c.json({ error: 'A priority is P0, P1, P2 or P3.' }, 400);
    if (body.repeat && !doNext && !dueNext) return c.json({ error: 'Pick a do date or a due date for it to repeat from.' }, 400);
    if ('lifeArea' in body) {
      const areaProblem = lifeAreaProblem(body.lifeArea);
      if (areaProblem) return c.json({ error: areaProblem }, 400);
    }
    if ('openKind' in body) {
      const openProblem = openKindProblem(body.openKind);
      if (openProblem) return c.json({ error: openProblem }, 400);
    }
    // Hidden tasks: a known choice, and only an open task is hidden (showing one again works whatever its state).
    if ('hide' in body) {
      const hideProblem = taskHideProblem(body.hide);
      if (hideProblem) return c.json({ error: hideProblem }, 400);
      if (parseTaskHide(body.hide) && row.status !== 'active') return c.json({ error: 'Only an open task can be hidden.' }, 400);
    }
    if (namesBlock(body)) {
      const picked = await blockFromBody(db, user.id, body);
      if (picked && 'error' in picked) return c.json({ error: picked.error }, 400);
    }
    // Moving a task to another project (and with it, maybe another pillar): only an open task, and only under one of the person's own
    // active projects. The task takes that project's pillar. A ticked task stays where its xp was earned.
    if (body.parentId !== undefined && body.parentId !== row.parent_id) {
      if (row.status !== 'active') return c.json({ error: 'Only an open task can move to another project.' }, 400);
      const to = typeof body.parentId === 'string' ? await getNode(db, user.id, body.parentId) : null;
      if (!to || to.kind !== 'project' || to.status !== 'active') return c.json({ error: 'Pick one of your open projects.' }, 400);
      await db.prepare('UPDATE nodes SET parent_id = ?, relationship = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(to.id, to.relationship, nowIso(), row.id, user.id).run();
    }
  }
  const moved = (await getNode(db, user.id, row.id)) ?? row;
  // The person's own day, for Until tomorrow: their device's when it is within a day of their zone's today, else their zone's.
  const hideDay = personDay(typeof body.today === 'string' ? body.today : null, user.timezone);
  return c.json({ node: toNode(await editNode(db, moved, body, { hideDay })) });
});

/** A task's checklist. Owner only; it pays nothing and never blocks ticking the task. */
export const MAX_SUBTASKS = 20;

nodes.get('/:id/subtasks', async (c) => {
  const user = c.get('user');
  const row = await getNode(c.env.DB, user.id, c.req.param('id'));
  if (!row || row.kind !== 'task') return c.json({ error: 'not found' }, 404);
  const list = await c.env.DB.prepare('SELECT id, title, done_at, sort_order FROM subtasks WHERE task_id = ? AND user_id = ? ORDER BY sort_order ASC, created_at ASC').bind(row.id, user.id).all<{ id: string; title: string; done_at: string | null; sort_order: number }>();
  return c.json({ subtasks: list.results.map((s) => ({ id: s.id, title: s.title, done: s.done_at !== null })) });
});

nodes.post('/:id/subtasks', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await getNode(db, user.id, c.req.param('id'));
  if (!row || row.kind !== 'task') return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ title?: unknown }>().catch(() => ({}) as { title?: unknown });
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 140) : '';
  if (!title) return c.json({ error: 'title required' }, 400);
  const have = await db.prepare('SELECT COUNT(*) AS n, COALESCE(MAX(sort_order), -1) + 1 AS next FROM subtasks WHERE task_id = ? AND user_id = ?').bind(row.id, user.id).first<{ n: number; next: number }>();
  if ((have?.n ?? 0) >= MAX_SUBTASKS) return c.json({ error: `A task holds up to ${MAX_SUBTASKS} subtasks.` }, 400);
  const id = newId();
  await db.prepare('INSERT INTO subtasks (id, user_id, task_id, title, done_at, sort_order, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?)').bind(id, user.id, row.id, title, have?.next ?? 0, nowIso()).run();
  return c.json({ subtask: { id, title, done: false } }, 201);
});

nodes.patch('/subtasks/:sid', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const cur = await db.prepare('SELECT id, title, done_at FROM subtasks WHERE id = ? AND user_id = ?').bind(c.req.param('sid'), user.id).first<{ id: string; title: string; done_at: string | null }>();
  if (!cur) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ title?: unknown; done?: unknown }>().catch(() => ({}) as { title?: unknown; done?: unknown });
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 140) : cur.title;
  const doneAt = typeof body.done === 'boolean' ? (body.done ? (cur.done_at ?? nowIso()) : null) : cur.done_at;
  await db.prepare('UPDATE subtasks SET title = ?, done_at = ? WHERE id = ? AND user_id = ?').bind(title, doneAt, cur.id, user.id).run();
  return c.json({ subtask: { id: cur.id, title, done: doneAt !== null } });
});

nodes.delete('/subtasks/:sid', async (c) => {
  await c.env.DB.prepare('DELETE FROM subtasks WHERE id = ? AND user_id = ?').bind(c.req.param('sid'), c.get('user').id).run();
  return c.json({ ok: true });
});

nodes.delete('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await getNode(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  // All tables' Delete forever sends ?archived=1: the delete itself then takes only a task still let go, so one brought back in another tab
  // between the table's check and this call is never deleted (2026-11-13).
  const onlyArchived = c.req.query('archived') === '1' ? 1 : 0;
  const done = await db
    .prepare(
      `WITH RECURSIVE tree(id) AS (
         SELECT id FROM nodes WHERE id = ?1 AND user_id = ?2 AND (?3 = 0 OR status = 'archived')
         UNION ALL
         SELECT n.id FROM nodes n JOIN tree t ON n.parent_id = t.id
       )
       DELETE FROM nodes WHERE id IN (SELECT id FROM tree)`,
    )
    .bind(row.id, user.id, onlyArchived)
    .run();
  if (onlyArchived && !(done.meta.changes ?? 0)) return c.json({ error: 'It is not in your archive any more.' }, 409);
  return c.json({ ok: true });
});

// Completing a task sends XP up the whole ladder. The response lists every
// rung that moved so the app can animate the ripple.
nodes.post('/:id/complete', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await getNode(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.kind !== 'task') return c.json({ error: 'only tasks can be completed' }, 400);
  // A second tap on a task that is already done is not an error worth showing.
  if (row.status === 'done') return c.json({ error: 'already done', node: toNode(row) }, 409);
  if (row.status !== 'active') return c.json({ error: 'task is not active' }, 400);
  // A task with a date is for that day: it cannot be ticked before it arrives.
  const body = await c.req.json<{ date?: string }>().catch(() => ({}) as { date?: string });
  // The app sends the person's own date. Without one, the server's UTC day gets a day of slack, since a person east of UTC is already on tomorrow.
  const sent = Boolean(body.date && dateNearToday(body.date));
  const today = sent ? body.date! : shiftDate(new Date().toISOString().slice(0, 10), 1);
  // Only the do date holds a task back: the due date is a deadline, and finishing early is fine.
  if (row.do_date && row.do_date > today) return c.json({ error: `Planned for ${row.do_date}. Tick it on the day.`, dueDate: row.do_date }, 400);

  // Wait time: the first few ticks are free; after that a task has to exist for a while and sit a
  // gap after the previous tick, so writing and ticking in the same breath, or ticking back to back, earns nothing.
  // The gate, today's paid-task count and the badges before the tick are three independent reads: together they cost one wait.
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [gate, rewarded, keptBefore] = await Promise.all([
    taskGate(db, user.id),
    db
      .prepare(
        `SELECT COUNT(DISTINCT e.source_id) AS n FROM xp_events e JOIN nodes n ON n.id = e.source_id
       WHERE e.user_id = ? AND e.source = 'task' AND e.created_at >= ? AND n.status = 'done'`,
      )
      .bind(user.id, since)
      .first<{ n: number }>(),
    keptStats(db, user),
  ]);
  const before = (await badgeState(db, user, { stats: keptBefore })).keys;
  const leftMs = new Date(readyAtFor(row, gate)).getTime() - Date.now();
  if (leftMs > 0) {
    const wait = Math.max(1, Math.ceil(leftMs / 60_000));
    const why = gate.lastDoneAt && new Date(gate.lastDoneAt).getTime() + WAIT.gapMinutes * 60_000 > new Date(taskReadyAt(row.created_at, row.ready_at)).getTime() ? 'One at a time: give it a breath after the last tick.' : 'Do it first, then tick it.';
    return c.json({ error: `Ready in ${wait} ${wait === 1 ? 'minute' : 'minutes'}. ${why}`, readyInMinutes: wait }, 429);
  }

  // Daily cap: only a handful of tasks per rolling day pay xp. A task counts
  // once however often it is ticked, and stops counting if it is unticked.
  const capped = (rewarded?.n ?? 0) >= WAIT.dailyRewardedTasks;

  const now = nowIso();

  // Claim the task. Only one request can move it from active to done, so two
  // taps arriving together never pay twice.
  const claim = await db
    .prepare("UPDATE nodes SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND status = 'active'")
    .bind(now, now, row.id, user.id)
    .run();
  if (claim.meta.changes !== 1) {
    const fresh = await getNode(db, user.id, row.id);
    return c.json({ error: 'already done', node: fresh ? toNode(fresh) : null }, 409);
  }

  // A repeating task makes its next one now, so a project that held only this task does not clear.
  const nextTask = await spawnNext(db, row, today);
  const ancestors = await ancestorsOf(db, user.id, row);
  const ripple: RippleEvent[] = [];
  let total = 0;

  // A day of use for someone who joined with an invite code (a task ticked): on the third, the referral pays its maker (invites.ts). It rides
  // in the batch the tick sends anyway, after the claim above, so it costs no round trip but the one on the day it pays.
  const invite = inviteActiveStmts(db, user);
  let inviteDone: D1Result[] = [];
  if (capped) {
    const done = await db.batch([
      db.prepare('INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, ?, ?, ?, 0, ?)').bind(user.id, row.relationship, 'task_capped', row.id, now),
      ...invite,
    ]);
    inviteDone = done.slice(-invite.length);
  } else {
    ripple.push({ id: row.id, kind: 'task', title: row.title, amount: XP.task });
    const stmts = [db.prepare('UPDATE nodes SET xp = xp + ? WHERE id = ?').bind(XP.task, row.id)];
    for (const a of ancestors) {
      if (a.kind === 'task') continue;
      const amount = XP.ripple[a.kind];
      stmts.push(db.prepare('UPDATE nodes SET xp = xp + ?, updated_at = ? WHERE id = ?').bind(amount, now, a.id));
      ripple.push({ id: a.id, kind: a.kind, title: a.title, amount });
    }
    stmts.push(
      db.prepare('UPDATE relationship_scores SET xp = xp + ? WHERE user_id = ? AND relationship = ?').bind(XP.task, user.id, row.relationship),
      db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').bind(XP.task, user.id),
      db
        .prepare('INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(user.id, row.relationship, 'task', row.id, XP.task, now),
      ...invite,
    );
    const done = await db.batch(stmts);
    inviteDone = done.slice(-invite.length);
    total = XP.task;
  }
  await afterInviteActive(db, inviteDone);

  // Clear the project if this was its last open task. The check and the
  // change are one statement, so two last ticks can only clear it once.
  let projectCleared: NodeRow | null = null;
  const project = ancestors.find((a) => a.kind === 'project');
  if (project) {
    const cleared = await db
      .prepare(
        `UPDATE nodes SET status = 'done', completed_at = ?, updated_at = ?
         WHERE id = ? AND status = 'active'
           AND NOT EXISTS (SELECT 1 FROM nodes t WHERE t.parent_id = ? AND t.kind = 'task' AND t.status = 'active')`,
      )
      .bind(now, now, project.id, project.id)
      .run();
    if (cleared.meta.changes === 1) {
      projectCleared = { ...project, status: 'done', completed_at: now };
      // The clear bonus is paid only on a rewarded tick, and booked against the
      // project so undoing it later takes back exactly what was paid.
      if (!capped) {
        await db.batch([
          db.prepare('UPDATE nodes SET xp = xp + ? WHERE id = ?').bind(XP.projectClear, project.id),
          db.prepare('UPDATE relationship_scores SET xp = xp + ? WHERE user_id = ? AND relationship = ?').bind(XP.projectClear, user.id, row.relationship),
          db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').bind(XP.projectClear, user.id),
          db
            .prepare('INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(user.id, row.relationship, 'project_clear', project.id, XP.projectClear, now),
        ]);
        total += XP.projectClear;
        projectCleared.xp = project.xp + XP.projectClear;
      }
    }
  }

  // Only the counts a tick moves change here, so the badges after it cost one small read and not every row the person has (`statsAfterTick`).
  const [ticked, nowUser, fresh] = await Promise.all([statsAfterTick(db, keptBefore, { userId: user.id, taskId: row.id, relationship: row.relationship, projectCleared: Boolean(projectCleared) }), getUser(db, user.id), getNode(db, user.id, row.id)]);
  const after = (await badgeState(db, nowUser ?? user, { stats: ticked })).keys;
  await storeStats(db, user.id, ticked);
  const res: CompleteResponse = {
    node: toNode(fresh ?? row),
    ripple,
    projectCleared: projectCleared ? toNode(projectCleared) : null,
    totalXp: total,
    newBadges: diffBadges(before, after),
    capped,
    next: nextTask ? toNode(nextTask) : null,
  };
  return c.json(res);
});

nodes.post('/:id/uncomplete', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await getNode(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.kind !== 'task') return c.json({ error: 'only tasks can be unticked' }, 400);
  if (row.status === 'active') return c.json({ error: 'already not done', node: toNode(row) }, 409);
  if (row.status !== 'done') return c.json({ error: 'task is archived' }, 400);

  const now = nowIso();
  const claim = await db
    .prepare("UPDATE nodes SET status = 'active', completed_at = NULL, updated_at = ? WHERE id = ? AND user_id = ? AND status = 'done'")
    .bind(now, row.id, user.id)
    .run();
  if (claim.meta.changes !== 1) {
    const fresh = await getNode(db, user.id, row.id);
    return c.json({ error: 'already not done', node: fresh ? toNode(fresh) : null }, 409);
  }

  // Un-ticking a repeating task takes back the next one it made, as long as nobody has touched it.
  // An untick lowers a count, so the kept ones are read again next time.
  await db.prepare('UPDATE users SET stats_at = NULL WHERE id = ?').bind(user.id).run();
  await db.prepare("DELETE FROM nodes WHERE spawned_from = ? AND user_id = ? AND status = 'active' AND xp = 0").bind(row.id, user.id).run();
  const ancestors = await ancestorsOf(db, user.id, row);

  // Take back the task's xp only if its last tick actually paid. A tick past
  // the daily limit paid nothing, so undoing it takes nothing.
  const last = await db
    .prepare("SELECT source FROM xp_events WHERE user_id = ? AND source_id = ? AND source IN ('task', 'task_capped', 'task_undo') ORDER BY id DESC LIMIT 1")
    .bind(user.id, row.id)
    .first<{ source: string }>();
  const paid = last?.source === 'task';
  const stmts = [];
  if (paid) {
    stmts.push(db.prepare('UPDATE nodes SET xp = MAX(0, xp - ?) WHERE id = ?').bind(XP.task, row.id));
    for (const a of ancestors) {
      if (a.kind === 'task') continue;
      stmts.push(db.prepare('UPDATE nodes SET xp = MAX(0, xp - ?), updated_at = ? WHERE id = ?').bind(XP.ripple[a.kind], now, a.id));
    }
    stmts.push(
      db.prepare('UPDATE relationship_scores SET xp = MAX(0, xp - ?) WHERE user_id = ? AND relationship = ?').bind(XP.task, user.id, row.relationship),
      db.prepare('UPDATE users SET xp = MAX(0, xp - ?) WHERE id = ?').bind(XP.task, user.id),
    );
  }
  stmts.push(
    db
      .prepare('INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(user.id, row.relationship, 'task_undo', row.id, paid ? -XP.task : 0, now),
  );
  await db.batch(stmts);

  // The project is open again. Take back whatever clear bonus it is still holding.
  const project = ancestors.find((a) => a.kind === 'project');
  if (project) {
    const reopened = await db
      .prepare("UPDATE nodes SET status = 'active', completed_at = NULL, updated_at = ? WHERE id = ? AND status = 'done'")
      .bind(now, project.id)
      .run();
    if (reopened.meta.changes === 1) {
      const held = await db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS n FROM xp_events WHERE user_id = ? AND source_id = ? AND source IN ('project_clear', 'project_reopen')")
        .bind(user.id, project.id)
        .first<{ n: number }>();
      const bonus = held?.n ?? 0;
      if (bonus > 0) {
        await db.batch([
          db.prepare('UPDATE nodes SET xp = MAX(0, xp - ?) WHERE id = ?').bind(bonus, project.id),
          db.prepare('UPDATE relationship_scores SET xp = MAX(0, xp - ?) WHERE user_id = ? AND relationship = ?').bind(bonus, user.id, row.relationship),
          db.prepare('UPDATE users SET xp = MAX(0, xp - ?) WHERE id = ?').bind(bonus, user.id),
          db
            .prepare('INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(user.id, row.relationship, 'project_reopen', project.id, -bonus, now),
        ]);
      }
    }
  }

  const fresh = await getNode(db, user.id, row.id);
  return c.json({ node: fresh ? toNode(fresh) : null });
});
