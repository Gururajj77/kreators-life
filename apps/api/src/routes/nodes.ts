import { Hono } from 'hono';
import { isNodeKind, isRelationshipKey, parentKind, WAIT, XP, type CompleteResponse, type RippleEvent } from '@kreators/shared';
import type { AppEnv } from '../env';
import { ancestorsOf, badgesNow, DATE_RE, diffBadges, getNode, newId, nowIso, toNode, type NodeRow } from '../db';

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
    .json<{ kind?: string; parentId?: string | null; relationship?: string; title?: string; note?: string; dueDate?: string | null }>()
    .catch(() => ({}) as Record<string, never>);

  if (!isNodeKind(body.kind)) return c.json({ error: 'bad kind' }, 400);
  if (!isRelationshipKey(body.relationship)) return c.json({ error: 'bad relationship' }, 400);
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 140) : '';
  if (!title) return c.json({ error: 'title required' }, 400);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
  const dueDate = typeof body.dueDate === 'string' && DATE_RE.test(body.dueDate) ? body.dueDate : null;

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
      `INSERT INTO nodes (id, user_id, kind, parent_id, relationship, title, note, status, xp, due_date, completed_at, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, NULL, ?, ?, ?)`,
    )
    .bind(id, user.id, body.kind, parentId, body.relationship, title, note, dueDate, sortRow?.next ?? 0, now, now)
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
    .json<{ title?: string; note?: string; dueDate?: string | null; status?: string }>()
    .catch(() => ({}) as Record<string, never>);
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 140) : row.title;
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : row.note;
  const dueDate = body.dueDate === null ? null : typeof body.dueDate === 'string' && DATE_RE.test(body.dueDate) ? body.dueDate : row.due_date;
  const status = body.status === 'archived' || body.status === 'active' ? body.status : row.status;
  await db
    .prepare('UPDATE nodes SET title = ?, note = ?, due_date = ?, status = ?, updated_at = ? WHERE id = ?')
    .bind(title, note, dueDate, status, nowIso(), row.id)
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
  if (row.status !== 'active') return c.json({ error: 'task is not active' }, 400);

  // Wait time: a task has to exist for a while before it can be ticked, so
  // writing something down and ticking it in the same breath earns nothing.
  const ageMs = Date.now() - new Date(row.updated_at).getTime();
  const minMs = WAIT.taskMinAgeMinutes * 60_000;
  if (ageMs < minMs) {
    const wait = Math.max(1, Math.ceil((minMs - ageMs) / 60_000));
    return c.json(
      { error: `Give it ${wait} more ${wait === 1 ? 'minute' : 'minutes'}. A task needs ${WAIT.taskMinAgeMinutes} minutes between being written and being ticked.`, readyInMinutes: wait },
      429,
    );
  }

  // Daily cap: only a handful of completions per rolling day pay xp.
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const rewarded = await db
    .prepare("SELECT COUNT(*) AS n FROM xp_events WHERE user_id = ? AND source = 'task' AND created_at >= ?")
    .bind(user.id, since)
    .first<{ n: number }>();
  const capped = (rewarded?.n ?? 0) >= WAIT.dailyRewardedTasks;

  const before = await badgesNow(db, user.id);
  const now = nowIso();
  const ancestors = await ancestorsOf(db, user.id, row);

  if (capped) {
    const stmts = [db.prepare("UPDATE nodes SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?").bind(now, now, row.id)];
    let projectCleared: NodeRow | null = null;
    const project = ancestors.find((a) => a.kind === 'project');
    if (project && project.status === 'active') {
      const open = await db
        .prepare("SELECT COUNT(*) AS n FROM nodes WHERE parent_id = ? AND kind = 'task' AND status = 'active' AND id != ?")
        .bind(project.id, row.id)
        .first<{ n: number }>();
      if ((open?.n ?? 0) === 0) {
        stmts.push(db.prepare("UPDATE nodes SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?").bind(now, now, project.id));
        projectCleared = { ...project, status: 'done', completed_at: now };
      }
    }
    stmts.push(
      db
        .prepare('INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, ?, ?, ?, 0, ?)')
        .bind(user.id, row.relationship, 'task_capped', row.id, now),
    );
    await db.batch(stmts);
    const fresh = await getNode(db, user.id, row.id);
    const res: CompleteResponse = {
      node: toNode(fresh ?? row),
      ripple: [],
      projectCleared: projectCleared ? toNode(projectCleared) : null,
      totalXp: 0,
      newBadges: [],
      capped: true,
    };
    return c.json(res);
  }

  const ripple: RippleEvent[] = [{ id: row.id, kind: 'task', title: row.title, amount: XP.task }];
  const stmts = [
    db.prepare("UPDATE nodes SET status = 'done', completed_at = ?, xp = xp + ?, updated_at = ? WHERE id = ?").bind(now, XP.task, now, row.id),
  ];
  for (const a of ancestors) {
    if (a.kind === 'task') continue;
    const amount = XP.ripple[a.kind];
    stmts.push(db.prepare('UPDATE nodes SET xp = xp + ?, updated_at = ? WHERE id = ?').bind(amount, now, a.id));
    ripple.push({ id: a.id, kind: a.kind, title: a.title, amount });
  }

  let total = XP.task;
  let projectCleared: NodeRow | null = null;
  const project = ancestors.find((a) => a.kind === 'project');
  if (project && project.status === 'active') {
    const open = await db
      .prepare("SELECT COUNT(*) AS n FROM nodes WHERE parent_id = ? AND kind = 'task' AND status = 'active' AND id != ?")
      .bind(project.id, row.id)
      .first<{ n: number }>();
    if ((open?.n ?? 0) === 0) {
      stmts.push(
        db.prepare("UPDATE nodes SET status = 'done', completed_at = ?, xp = xp + ?, updated_at = ? WHERE id = ?").bind(now, XP.projectClear, now, project.id),
      );
      total += XP.projectClear;
      projectCleared = { ...project, status: 'done', completed_at: now, xp: project.xp + XP.projectClear };
    }
  }

  stmts.push(
    db.prepare('UPDATE relationship_scores SET xp = xp + ? WHERE user_id = ? AND relationship = ?').bind(total, user.id, row.relationship),
    db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').bind(total, user.id),
    db
      .prepare('INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(user.id, row.relationship, 'task', row.id, total, now),
  );
  await db.batch(stmts);

  const after = await badgesNow(db, user.id);
  const fresh = await getNode(db, user.id, row.id);
  const res: CompleteResponse = {
    node: toNode(fresh ?? row),
    ripple,
    projectCleared: projectCleared ? toNode(projectCleared) : null,
    totalXp: total,
    newBadges: diffBadges(before, after),
    capped: false,
  };
  return c.json(res);
});

nodes.post('/:id/uncomplete', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await getNode(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.kind !== 'task' || row.status !== 'done') return c.json({ error: 'task is not done' }, 400);

  const now = nowIso();
  const ancestors = await ancestorsOf(db, user.id, row);

  // A completion that hit the daily cap paid nothing, so undoing it takes nothing back.
  const last = await db
    .prepare("SELECT source FROM xp_events WHERE user_id = ? AND source_id = ? AND source IN ('task', 'task_capped', 'task_undo') ORDER BY id DESC LIMIT 1")
    .bind(user.id, row.id)
    .first<{ source: string }>();
  if (last?.source !== 'task') {
    const stmts = [db.prepare("UPDATE nodes SET status = 'active', completed_at = NULL, updated_at = ? WHERE id = ?").bind(now, row.id)];
    const project = ancestors.find((a) => a.kind === 'project');
    if (project && project.status === 'done') {
      stmts.push(db.prepare("UPDATE nodes SET status = 'active', completed_at = NULL, updated_at = ? WHERE id = ?").bind(now, project.id));
    }
    stmts.push(
      db
        .prepare('INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, ?, ?, ?, 0, ?)')
        .bind(user.id, row.relationship, 'task_undo', row.id, now),
    );
    await db.batch(stmts);
    const fresh = await getNode(db, user.id, row.id);
    return c.json({ node: fresh ? toNode(fresh) : null });
  }

  const stmts = [
    db.prepare("UPDATE nodes SET status = 'active', completed_at = NULL, xp = MAX(0, xp - ?), updated_at = ? WHERE id = ?").bind(XP.task, now, row.id),
  ];
  let total = XP.task;
  for (const a of ancestors) {
    if (a.kind === 'task') continue;
    stmts.push(db.prepare('UPDATE nodes SET xp = MAX(0, xp - ?), updated_at = ? WHERE id = ?').bind(XP.ripple[a.kind], now, a.id));
    if (a.kind === 'project' && a.status === 'done') {
      stmts.push(
        db.prepare("UPDATE nodes SET status = 'active', completed_at = NULL, xp = MAX(0, xp - ?), updated_at = ? WHERE id = ?").bind(XP.projectClear, now, a.id),
      );
      total += XP.projectClear;
    }
  }
  stmts.push(
    db.prepare('UPDATE relationship_scores SET xp = MAX(0, xp - ?) WHERE user_id = ? AND relationship = ?').bind(total, user.id, row.relationship),
    db.prepare('UPDATE users SET xp = MAX(0, xp - ?) WHERE id = ?').bind(total, user.id),
    db
      .prepare('INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(user.id, row.relationship, 'task_undo', row.id, -total, now),
  );
  await db.batch(stmts);
  const fresh = await getNode(db, user.id, row.id);
  return c.json({ node: fresh ? toNode(fresh) : null });
});
