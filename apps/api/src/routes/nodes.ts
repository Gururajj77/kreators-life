import { Hono } from 'hono';
import { isNodeKind, isRelationshipKey, parentKind, taskReadyAt, WAIT, XP, type CompleteResponse, type RippleEvent } from '@kreators/shared';
import type { AppEnv } from '../env';
import { TIME_RE } from '@kreators/shared';
import { ancestorsOf, badgesNow, DATE_RE, diffBadges, getNode, newId, nowIso, readyFromNow, toNode, type NodeRow } from '../db';

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
  const rows = await db
    .prepare(`SELECT * FROM nodes WHERE ${clauses.join(' AND ')} ORDER BY sort_order ASC, created_at ASC`)
    .bind(...binds)
    .all<NodeRow>();
  return c.json({ nodes: rows.results.map(toNode) });
});

nodes.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req
    .json<{ kind?: string; parentId?: string | null; relationship?: string; title?: string; note?: string; dueDate?: string | null; dueTime?: string | null; estimateMin?: number | null }>()
    .catch(() => ({}) as Record<string, never>);

  if (!isNodeKind(body.kind)) return c.json({ error: 'bad kind' }, 400);
  if (!isRelationshipKey(body.relationship)) return c.json({ error: 'bad relationship' }, 400);
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 140) : '';
  if (!title) return c.json({ error: 'title required' }, 400);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
  const dueDate = typeof body.dueDate === 'string' && DATE_RE.test(body.dueDate) ? body.dueDate : null;
  const dueTime = body.kind === 'task' && typeof body.dueTime === 'string' && TIME_RE.test(body.dueTime) ? body.dueTime : null;
  const estimateMin = body.kind === 'task' && Number.isFinite(Number(body.estimateMin)) && Number(body.estimateMin) > 0 ? Math.min(600, Math.round(Number(body.estimateMin))) : null;

  const expectedParent = parentKind(body.kind);
  let parentId: string | null = null;
  if (expectedParent) {
    if (typeof body.parentId !== 'string') return c.json({ error: `a ${expectedParent} is required first` }, 400);
    const parent = await getNode(db, user.id, body.parentId);
    if (!parent || parent.kind !== expectedParent || parent.relationship !== body.relationship) {
      return c.json({ error: 'parent does not fit this rung' }, 400);
    }
    parentId = parent.id;
  }

  const now = nowIso();
  const id = newId();
  const sortRow = await db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM nodes WHERE user_id = ? AND kind = ? AND relationship = ?')
    .bind(user.id, body.kind, body.relationship)
    .first<{ next: number }>();
  await db
    .prepare(
      `INSERT INTO nodes (id, user_id, kind, parent_id, relationship, title, note, status, xp, due_date, completed_at, ready_at, sort_order, created_at, updated_at, due_time, estimate_min)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, NULL, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, user.id, body.kind, parentId, body.relationship, title, note, dueDate, body.kind === 'task' ? readyFromNow() : null, sortRow?.next ?? 0, now, now, dueTime, estimateMin)
    .run();
  const row = await getNode(db, user.id, id);
  return c.json({ node: row ? toNode(row) : null }, 201);
});

nodes.patch('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await getNode(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req
    .json<{ title?: string; note?: string; dueDate?: string | null; status?: string; dueTime?: string | null; estimateMin?: number | null }>()
    .catch(() => ({}) as Record<string, never>);
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
  const fresh = await getNode(db, user.id, row.id);
  return c.json({ node: fresh ? toNode(fresh) : null });
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

  // Wait time: a task has to exist for a while before it can be ticked, so
  // writing something down and ticking it in the same breath earns nothing.
  const leftMs = new Date(taskReadyAt(row.created_at, row.ready_at)).getTime() - Date.now();
  if (leftMs > 0) {
    const wait = Math.max(1, Math.ceil(leftMs / 60_000));
    return c.json(
      { error: `Ready in ${wait} ${wait === 1 ? 'minute' : 'minutes'}. Do it first, then tick it.`, readyInMinutes: wait },
      429,
    );
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
