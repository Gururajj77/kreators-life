import { Hono } from 'hono';
import { addDays, daysBetween, isNodeKind, isRelationshipKey, nextOccurrence, parentKind, parsePriority, parseRepeat, taskReadyAt, WAIT, XP, type CompleteResponse, type RippleEvent } from '@kreators/shared';
import type { AppEnv } from '../env';
import { TIME_RE } from '@kreators/shared';
import { ancestorsOf, badgesNow, DATE_RE, diffBadges, getNode, newId, nowIso, readyFromNow, toNode, type NodeRow, taskGate, readyAtFor, withSubtasks } from '../db';
import { dateNearToday, shiftDate } from '../db';

export const nodes = new Hono<AppEnv>();

nodes.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const relationship = c.req.query('relationship');
  const kind = c.req.query('kind');
  const gate = await taskGate(db, user.id);
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
  const rows = await db
    .prepare(`SELECT * FROM nodes WHERE ${clauses.join(' AND ')} ORDER BY sort_order ASC, created_at ASC`)
    .bind(...binds)
    .all<NodeRow>();
  return c.json({ nodes: await withSubtasks(db, user.id, rows.results.map((r) => toNode(r, gate))) });
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
  dueTime?: unknown;
  estimateMin?: unknown;
  status?: unknown;
}
type Refused = { error: string; status: 400 | 404 };

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
  // A task can also carry a do date and a rule for coming back. A rule needs a day to count from.
  const doDate = kind === 'task' && typeof body.doDate === 'string' && DATE_RE.test(body.doDate) ? body.doDate : null;
  const repeat = kind === 'task' ? parseRepeat(body.repeat) : null;
  if (doDate && dueDate && doDate > dueDate) return { error: DATES_PROBLEM, status: 400 };
  if (repeat && !doDate && !dueDate) return { error: 'Pick a do date or a due date for it to repeat from.', status: 400 };
  const priority = kind === 'task' ? parsePriority(body.priority) : null;
  const remind = kind === 'task' && body.remind === true && (doDate || dueDate) ? 1 : 0;
  if (doDate || repeat || priority !== null || remind) await db.prepare('UPDATE nodes SET do_date = ?, repeat_json = ?, priority = ?, remind = ? WHERE id = ?').bind(doDate, repeat ? JSON.stringify(repeat) : null, priority, remind, id).run();
  const row = await getNode(db, ownerId, id);
  return row ? { row } : { error: 'not found', status: 404 };
}

/**
 * Change a layer's words, date and plan, or archive it and bring it back. The one rule, for the person and for a
 * life coach changing a task (who never sends a status). Returns the row as it is now.
 */
export async function editNode(db: D1Database, row: NodeRow, body: NodeBody): Promise<NodeRow> {
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
  await db
    .prepare('UPDATE nodes SET title = ?, note = ?, due_date = ?, status = ?, ready_at = ?, updated_at = ?, due_time = ?, estimate_min = ? WHERE id = ?')
    .bind(title, note, dueDate, status, readyAt, nowIso(), dueTime, estimateMin, row.id)
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
    const fresh = await getNode(db, row.user_id, row.id);
    // A reminder needs a day to go off on.
    const remind = 'remind' in body ? body.remind === true : (row.remind ?? 0) === 1;
    const day = fresh ? (fresh.do_date ?? fresh.due_date) : null;
    await db.prepare('UPDATE nodes SET priority = ?, remind = ? WHERE id = ?').bind(priority, remind && day ? 1 : 0, row.id).run();
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
  const gap = row.do_date && row.due_date ? daysBetween(row.do_date, row.due_date) : 0;
  const doDate = row.do_date ? next : null;
  const dueDate = row.due_date ? (row.do_date ? addDays(next, gap) : next) : null;
  const id = newId();
  const now = nowIso();
  const sortRow = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM nodes WHERE user_id = ? AND kind = ? AND relationship = ?').bind(row.user_id, 'task', row.relationship).first<{ next: number }>();
  await db
    .prepare(
      `INSERT INTO nodes (id, user_id, kind, parent_id, relationship, title, note, status, xp, due_date, completed_at, ready_at, sort_order, created_at, updated_at, due_time, estimate_min, added_by, do_date, repeat_json, spawned_from, priority, remind)
       VALUES (?, ?, 'task', ?, ?, ?, ?, 'active', 0, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, row.user_id, row.parent_id, row.relationship, row.title, row.note, dueDate, readyFromNow(), sortRow?.next ?? 0, now, now, row.due_time, row.estimate_min, row.added_by ?? null, doDate, row.repeat_json, row.id, row.priority ?? null, row.remind ?? 0)
    .run();
  // The checklist comes back too, all unticked.
  await db
    .prepare('INSERT INTO subtasks (id, user_id, task_id, title, done_at, sort_order, created_at) SELECT lower(hex(randomblob(16))), user_id, ?, title, NULL, sort_order, ? FROM subtasks WHERE task_id = ? AND user_id = ?')
    .bind(id, now, row.id, row.user_id)
    .run();
  return getNode(db, row.user_id, id);
}

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
    if (body.remind === true && !doNext && !dueNext) return c.json({ error: 'Pick a do date or a due date to be reminded on.' }, 400);
    if (body.priority !== undefined && body.priority !== null && parsePriority(body.priority) === null) return c.json({ error: 'A priority is P0, P1, P2 or P3.' }, 400);
    if (body.repeat && !doNext && !dueNext) return c.json({ error: 'Pick a do date or a due date for it to repeat from.' }, 400);
  }
  return c.json({ node: toNode(await editNode(db, row, body)) });
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
  await db
    .prepare(
      `WITH RECURSIVE tree(id) AS (
         SELECT id FROM nodes WHERE id = ?1 AND user_id = ?2
         UNION ALL
         SELECT n.id FROM nodes n JOIN tree t ON n.parent_id = t.id
       )
       DELETE FROM nodes WHERE id IN (SELECT id FROM tree)`,
    )
    .bind(row.id, user.id)
    .run();
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
  const gate = await taskGate(db, user.id);
  const leftMs = new Date(readyAtFor(row, gate)).getTime() - Date.now();
  if (leftMs > 0) {
    const wait = Math.max(1, Math.ceil(leftMs / 60_000));
    const why = gate.lastDoneAt && new Date(gate.lastDoneAt).getTime() + WAIT.gapMinutes * 60_000 > new Date(taskReadyAt(row.created_at, row.ready_at)).getTime() ? 'One at a time: give it a breath after the last tick.' : 'Do it first, then tick it.';
    return c.json({ error: `Ready in ${wait} ${wait === 1 ? 'minute' : 'minutes'}. ${why}`, readyInMinutes: wait }, 429);
  }

  // Daily cap: only a handful of tasks per rolling day pay xp. A task counts
  // once however often it is ticked, and stops counting if it is unticked.
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const rewarded = await db
    .prepare(
      `SELECT COUNT(DISTINCT e.source_id) AS n FROM xp_events e JOIN nodes n ON n.id = e.source_id
       WHERE e.user_id = ? AND e.source = 'task' AND e.created_at >= ? AND n.status = 'done'`,
    )
    .bind(user.id, since)
    .first<{ n: number }>();
  const capped = (rewarded?.n ?? 0) >= WAIT.dailyRewardedTasks;

  const before = await badgesNow(db, user.id);
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

  if (capped) {
    await db
      .prepare('INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, ?, ?, ?, 0, ?)')
      .bind(user.id, row.relationship, 'task_capped', row.id, now)
      .run();
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
    );
    await db.batch(stmts);
    total = XP.task;
  }

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

  const after = await badgesNow(db, user.id);
  const fresh = await getNode(db, user.id, row.id);
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
