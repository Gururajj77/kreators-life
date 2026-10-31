import { Hono } from 'hono';
import { FOCUS_MAX_MINUTES, FOCUS_VIEWS, isFocusView, weekStart, wellbeingLabel, type FocusBucket, type FocusResponse, type FocusTask, type FocusView, type LogKind, type RelationshipKey, type WellbeingLog, type WellbeingSummary } from '@kreators/shared';
import type { AppEnv } from '../env';
import { DATE_RE, dateNearToday, newId, nowIso, shiftDate } from '../db';

export const wellbeing = new Hono<AppEnv>();

const KINDS: LogKind[] = ['mood', 'sleep', 'stress', 'mindful', 'move'];
const isKind = (v: string): v is LogKind => (KINDS as string[]).includes(v);

interface Row {
  id: string;
  kind: LogKind;
  date: string;
  value: number;
  extra: string;
  note: string;
  created_at: string;
}

function toLog(r: Row): WellbeingLog {
  let extra: Record<string, unknown> = {};
  try {
    extra = JSON.parse(r.extra || '{}') as Record<string, unknown>;
  } catch {
    extra = {};
  }
  return { id: r.id, kind: r.kind, date: r.date, value: r.value, extra, note: r.note, createdAt: r.created_at };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export async function summaryFor(db: D1Database, userId: string, today: string, streak: number): Promise<WellbeingSummary> {
  const from = shiftDate(today, -6);
  const rows = await db
    .prepare('SELECT * FROM wellbeing_logs WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC, created_at ASC')
    .bind(userId, from, today)
    .all<Row>();
  const logs = rows.results.map(toLog);
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(from, i));
  const week = days.map((date) => {
    const mood = logs.filter((l) => l.kind === 'mood' && l.date === date).at(-1)?.value ?? null;
    const sleep = logs.filter((l) => l.kind === 'sleep' && l.date === date).at(-1)?.value ?? null;
    const stress = logs.filter((l) => l.kind === 'stress' && l.date === date).at(-1)?.value ?? null;
    const mindful = logs.filter((l) => l.kind === 'mindful' && l.date === date).reduce((a, l) => a + l.value, 0);
    return { date, mood, sleep, stress, mindful };
  });
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const moodAvg = avg(week.map((d) => d.mood));
  const sleepAvg = avg(week.map((d) => d.sleep));
  const stressAvg = avg(week.map((d) => d.stress));
  const mindfulTotal = week.reduce((a, d) => a + d.mindful, 0);

  // Each part scores 0 to 100; missing parts fall back to the middle so a
  // new account starts "Steady" rather than "Needs care".
  const moodScore = moodAvg === null ? 50 : ((moodAvg - 1) / 4) * 100;
  const sleepScore = sleepAvg === null ? 50 : (clamp(sleepAvg, 4, 8) - 4) * 25;
  const stressScore = stressAvg === null ? 50 : ((5 - stressAvg) / 4) * 100;
  const mindfulScore = clamp(mindfulTotal, 0, 60) / 0.6;
  const streakScore = clamp(streak, 0, 7) / 0.07;
  const score = Math.round(moodScore * 0.35 + sleepScore * 0.25 + stressScore * 0.2 + mindfulScore * 0.1 + streakScore * 0.1);

  const latest = (kind: LogKind) => logs.filter((l) => l.kind === kind).at(-1)?.value ?? null;
  const count7 = (kind: LogKind) => logs.filter((l) => l.kind === kind).length;
  return {
    score,
    label: wellbeingLabel(score),
    parts: [
      { kind: 'mood', latest: latest('mood'), avg7: moodAvg, count7: count7('mood') },
      { kind: 'sleep', latest: latest('sleep'), avg7: sleepAvg, count7: count7('sleep') },
      { kind: 'stress', latest: latest('stress'), avg7: stressAvg, count7: count7('stress') },
      { kind: 'mindful', latest: mindfulTotal, avg7: mindfulTotal / 7, count7: count7('mindful') },
    ],
    week,
  };
}

// ---- Focus rounds. Registered first so "focus" is never read as a kind of log.

/** The tasks a round can be pointed at: the person's own, still to do, the nearest due first. */
wellbeing.get('/focus/tasks', async (c) => {
  const rows = await c.env.DB.prepare("SELECT id, title, relationship, COALESCE(do_date, due_date) AS due_date FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'active' ORDER BY COALESCE(do_date, due_date) IS NULL, COALESCE(do_date, due_date) ASC, created_at DESC LIMIT 60").bind(c.get('user').id).all<{ id: string; title: string; relationship: RelationshipKey; due_date: string | null }>();
  const tasks: FocusTask[] = rows.results.map((r) => ({ id: r.id, title: r.title, relationship: r.relationship, dueDate: r.due_date }));
  return c.json({ tasks });
});

// A finished focus round. The task is looked up here, never taken from the client, and has to be the person's own.
wellbeing.post('/focus', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ minutes?: number; nodeId?: string; date?: string }>().catch(() => ({}) as { minutes?: number; nodeId?: string; date?: string });
  const minutes = Math.round(Number(body.minutes));
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > FOCUS_MAX_MINUTES) return c.json({ error: `a round is 1 to ${FOCUS_MAX_MINUTES} minutes` }, 400);
  const date = typeof body.date === 'string' && DATE_RE.test(body.date) ? body.date : new Date().toISOString().slice(0, 10);
  if (!dateNearToday(date)) return c.json({ error: 'a round counts for today or yesterday' }, 400);
  let nodeId: string | null = null;
  let title = '';
  if (typeof body.nodeId === 'string' && body.nodeId) {
    const node = await db.prepare("SELECT id, title FROM nodes WHERE id = ? AND user_id = ? AND kind = 'task'").bind(body.nodeId, user.id).first<{ id: string; title: string }>();
    if (!node) return c.json({ error: 'that task is not yours' }, 404);
    nodeId = node.id;
    title = node.title.slice(0, 120);
  }
  const id = newId();
  await db.prepare('INSERT INTO focus_rounds (id, user_id, node_id, title, minutes, day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, user.id, nodeId, title, minutes, date, nowIso()).run();
  return c.json({ ok: true, id }, 201);
});

// The dashboard: minutes, rounds and tasks ticked by day, week or month, and where the time went.
wellbeing.get('/focus', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const viewRaw = c.req.query('view');
  const view: FocusView = isFocusView(viewRaw) ? viewRaw : 'day';
  const dateQ = c.req.query('date');
  const today = typeof dateQ === 'string' && DATE_RE.test(dateQ) ? dateQ : new Date().toISOString().slice(0, 10);
  const spec = FOCUS_VIEWS.find((v) => v.key === view)!;
  // Each bucket starts on a day: the day itself, the Monday, or the first of the month. Newest last.
  const startOf = (d: string): string => (view === 'day' ? d : view === 'week' ? weekStart(d) : `${d.slice(0, 7)}-01`);
  const stepBack = (key: string, n: number): string => {
    if (view === 'day') return shiftDate(key, -n);
    if (view === 'week') return shiftDate(key, -7 * n);
    const [y, m] = key.split('-').map(Number) as [number, number];
    const d = new Date(Date.UTC(y, m - 1 - n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
  };
  const keys = Array.from({ length: spec.count * 2 }, (_, i) => stepBack(startOf(today), spec.count * 2 - 1 - i));
  const prevKeys = keys.slice(0, spec.count);
  const nowKeys = keys.slice(spec.count);
  const from = keys[0]!;
  const [rounds, done] = await Promise.all([
    db.prepare('SELECT node_id, title, minutes, day FROM focus_rounds WHERE user_id = ? AND day >= ? AND day <= ?').bind(user.id, from, today).all<{ node_id: string | null; title: string; minutes: number; day: string }>(),
    db.prepare("SELECT substr(completed_at, 1, 10) AS day FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ?").bind(user.id, from).all<{ day: string }>(),
  ]);
  const label = (key: string) =>
    view === 'day'
      ? new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).slice(0, 2) + ' ' + key.slice(8)
      : view === 'week'
        ? `${new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`
        : new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const into = new Map(keys.map((k) => [k, { key: k, label: label(k), minutes: 0, rounds: 0, tasksDone: 0 } as FocusBucket]));
  for (const r of rounds.results) {
    const b = into.get(startOf(r.day));
    if (b) {
      b.minutes += r.minutes;
      b.rounds += 1;
    }
  }
  for (const r of done.results) {
    const b = into.get(startOf(r.day));
    if (b) b.tasksDone += 1;
  }
  const buckets = nowKeys.map((k) => into.get(k)!);
  const sum = (ks: string[], f: (b: FocusBucket) => number) => ks.reduce((n, k) => n + f(into.get(k)!), 0);
  const nowSet = new Set(nowKeys);
  const byTask = new Map<string, { nodeId: string | null; title: string; minutes: number; rounds: number }>();
  for (const r of rounds.results) {
    if (!nowSet.has(startOf(r.day))) continue;
    const key = r.node_id ?? '';
    const t = byTask.get(key) ?? { nodeId: r.node_id, title: r.title || 'No task picked', minutes: 0, rounds: 0 };
    t.minutes += r.minutes;
    t.rounds += 1;
    byTask.set(key, t);
  }
  const minutes = sum(nowKeys, (b) => b.minutes);
  const before = sum(prevKeys, (b) => b.minutes);
  const top = [...buckets].sort((a, b) => b.minutes - a.minutes)[0];
  const unit = view === 'day' ? 'two weeks' : view === 'week' ? 'eight weeks' : 'six months';
  const res: FocusResponse = {
    view,
    buckets,
    totals: { minutes, rounds: sum(nowKeys, (b) => b.rounds), tasksDone: sum(nowKeys, (b) => b.tasksDone), activeBuckets: buckets.filter((b) => b.minutes > 0).length },
    tasks: [...byTask.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 8),
    best: top && top.minutes > 0 ? { key: top.key, label: top.label, minutes: top.minutes } : null,
    trend: before === 0 && minutes === 0 ? 'No focus rounds yet. Start one above.' : before === 0 ? `A first stretch: ${minutes} minutes of focus in these ${unit}.` : minutes >= before ? `${minutes - before} minutes more than the ${unit} before.` : `${before - minutes} minutes fewer than the ${unit} before.`,
  };
  return c.json(res);
});

wellbeing.get('/summary', async (c) => {
  const user = c.get('user');
  const today = c.req.query('date') && DATE_RE.test(c.req.query('date')!) ? c.req.query('date')! : new Date().toISOString().slice(0, 10);
  return c.json(await summaryFor(c.env.DB, user.id, today, user.streak));
});

wellbeing.get('/:kind', async (c) => {
  const kind = c.req.param('kind');
  if (!isKind(kind)) return c.json({ error: 'unknown log' }, 404);
  const days = Math.min(365, Math.max(1, Number(c.req.query('days') ?? 30)));
  const from = shiftDate(new Date().toISOString().slice(0, 10), -days);
  const rows = await c.env.DB.prepare('SELECT * FROM wellbeing_logs WHERE user_id = ? AND kind = ? AND date >= ? ORDER BY date DESC, created_at DESC LIMIT 400')
    .bind(c.get('user').id, kind, from)
    .all<Row>();
  return c.json({ logs: rows.results.map(toLog) });
});

wellbeing.post('/:kind', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const kind = c.req.param('kind');
  if (!isKind(kind)) return c.json({ error: 'unknown log' }, 404);
  const body = await c.req.json<{ date?: string; value?: number; extra?: Record<string, unknown>; note?: string }>().catch(() => ({}) as Record<string, never>);
  const date = typeof body.date === 'string' && DATE_RE.test(body.date) ? body.date : new Date().toISOString().slice(0, 10);
  if (date > shiftDate(new Date().toISOString().slice(0, 10), 1)) return c.json({ error: 'pick a day that is not in the future' }, 400);
  const raw = Number(body.value);
  if (!Number.isFinite(raw)) return c.json({ error: 'value required' }, 400);
  const value =
    kind === 'sleep' ? clamp(Math.round(raw * 2) / 2, 0, 14) : kind === 'mindful' || kind === 'move' ? clamp(Math.round(raw), 1, 600) : clamp(Math.round(raw), 1, 5);
  const extra = body.extra && typeof body.extra === 'object' ? body.extra : {};
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
  const now = nowIso();
  const id = newId();
  if (kind === 'mindful' || kind === 'move') {
    await db
      .prepare('INSERT INTO wellbeing_logs (id, user_id, kind, date, value, extra, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, user.id, kind, date, value, JSON.stringify(extra), note, now)
      .run();
  } else {
    // One entry per day for mood, sleep and stress: logging again replaces it.
    await db.batch([
      db.prepare('DELETE FROM wellbeing_logs WHERE user_id = ? AND kind = ? AND date = ?').bind(user.id, kind, date),
      db
        .prepare('INSERT INTO wellbeing_logs (id, user_id, kind, date, value, extra, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, user.id, kind, date, value, JSON.stringify(extra), note, now),
    ]);
  }
  const row = await db.prepare('SELECT * FROM wellbeing_logs WHERE id = ?').bind(id).first<Row>();
  return c.json({ log: row ? toLog(row) : null, summary: await summaryFor(db, user.id, date, user.streak) }, 201);
});

wellbeing.delete('/:kind/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM wellbeing_logs WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});
