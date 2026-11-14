import { Hono } from 'hono';
import { FOCUS_MAX_MINUTES, LOCALE, FOCUS_VIEWS, isFocusMode, isFocusView, type FocusRoundRow, weekStart, wellbeingLabel, type FocusBucket, type FocusResponse, type FocusTask, type FocusView, type LogKind, type RelationshipKey, type WellbeingLog, type WellbeingSummary, parseFocusSettings } from '@kreators/shared';
import type { AppEnv } from '../env';
import { DATE_RE, dateNearOwnDay, dateNearToday, GONE_NOW, likeFit, newId, nowIso, pageOf, paged, shiftDate, streakNow, TEN_A_PAGE } from '../db';
import { parseMove } from '@kreators/shared/fitness';
import { moveExtra } from '../fitness';

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
// The timer settings a person chose, kept on their account so every device has them. Owner only.
wellbeing.get('/focus-settings', async (c) => {
  const row = await c.env.DB.prepare('SELECT settings_json FROM focus_prefs WHERE user_id = ?').bind(c.get('user').id).first<{ settings_json: string }>();
  return c.json({ settings: row ? parseFocusSettings(row.settings_json) : null });
});

wellbeing.put('/focus-settings', async (c) => {
  const body = await c.req.json<{ settings?: unknown }>().catch(() => ({}) as { settings?: unknown });
  const settings = parseFocusSettings(body.settings);
  await c.env.DB.prepare('INSERT INTO focus_prefs (user_id, settings_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at')
    .bind(c.get('user').id, JSON.stringify(settings), nowIso())
    .run();
  return c.json({ settings });
});

wellbeing.get('/focus/tasks', async (c) => {
  const userId = c.get('user').id;
  // ?recent=1: up to five open tasks the person focused on, the latest session first, for the top of the task sheet.
  if (c.req.query('recent') === '1') {
    const recent = await c.env.DB.prepare(
      `SELECT n.id, n.title, n.relationship, COALESCE(n.do_date, n.due_date) AS due_date, n.remind, MAX(f.created_at) AS last
       FROM focus_rounds f JOIN nodes n ON n.id = f.node_id AND n.user_id = f.user_id
       WHERE f.user_id = ? AND n.kind = 'task' AND n.status = 'active'
       GROUP BY n.id ORDER BY last DESC LIMIT 5`,
    )
      .bind(userId)
      .all<{ id: string; title: string; relationship: RelationshipKey; due_date: string | null; remind: number | null }>();
    return c.json({ tasks: recent.results.map((r) => ({ id: r.id, title: r.title, relationship: r.relationship, dueDate: r.due_date, remind: (r.remind ?? 0) === 1 }) satisfies FocusTask) });
  }
  // With ?q= it finds open tasks by name, so a person with many tasks can still pick any one (Plan my week uses it); without it, the nearest sixty.
  const q = (c.req.query('q') ?? '').trim().replace(/[%_]/g, '').slice(0, 60);
  const rows = await c.env.DB.prepare(`SELECT id, title, relationship, COALESCE(do_date, due_date) AS due_date, remind FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'active'${q ? ' AND title LIKE ?' : ''} ORDER BY COALESCE(do_date, due_date) IS NULL, COALESCE(do_date, due_date) ASC, created_at DESC LIMIT ${q ? 12 : 60}`).bind(...[userId, ...(q ? [`%${likeFit(q)}%`] : [])]).all<{ id: string; title: string; relationship: RelationshipKey; due_date: string | null; remind: number | null }>();
  const tasks: FocusTask[] = rows.results.map((r) => ({ id: r.id, title: r.title, relationship: r.relationship, dueDate: r.due_date, remind: (r.remind ?? 0) === 1 }));
  return c.json({ tasks });
});

interface RoundRow {
  id: string;
  minutes: number;
  title: string;
  node_id: string | null;
  quality: number | null;
  mode: string | null;
  day: string;
  created_at: string;
  log_id: string | null;
}
const toRound = (r: RoundRow): FocusRoundRow => ({ id: r.id, minutes: r.minutes, title: r.title, nodeId: r.node_id, quality: r.quality, mode: isFocusMode(r.mode) ? r.mode : null, day: r.day, createdAt: r.created_at, mindful: r.log_id !== null });

// The day's finished sessions, newest first, for the list under the timer. Owner only; the day comes from the device.
wellbeing.get('/focus/today', async (c) => {
  const date = c.req.query('date');
  if (typeof date !== 'string' || !DATE_RE.test(date)) return c.json({ error: 'pick a real day' }, 400);
  const rows = await c.env.DB.prepare('SELECT id, minutes, title, node_id, quality, mode, day, created_at, log_id FROM focus_rounds WHERE user_id = ? AND day = ? ORDER BY created_at DESC LIMIT 100').bind(c.get('user').id, date).all<RoundRow>();
  return c.json({ rounds: rows.results.map(toRound) });
});

/** A task a round points at: looked up here, never taken from the client, and only the person's own. Undefined when none was asked for. */
async function ownTask(db: D1Database, userId: string, nodeId: unknown): Promise<{ id: string; title: string } | null | undefined | 'missing'> {
  if (nodeId === undefined) return undefined;
  if (nodeId === null || nodeId === '') return null;
  if (typeof nodeId !== 'string') return 'missing';
  const node = await db.prepare("SELECT id, title FROM nodes WHERE id = ? AND user_id = ? AND kind = 'task'").bind(nodeId, userId).first<{ id: string; title: string }>();
  return node ? { id: node.id, title: node.title.slice(0, 120) } : 'missing';
}
const REF_RE = /^[A-Za-z0-9:-]{1,64}$/;

// A finished focus round, or one added afterwards (a day of today or yesterday). With `mindful` it also counts as mindful minutes: the
// log is written in the same batch and its id kept on the round, so changing or deleting the round keeps the two in step. A `clientRef`
// (the browser's name for the part that ended) makes the same part arriving twice, from a duplicated tab, one round and one log.
wellbeing.post('/focus', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ minutes?: number; nodeId?: string; date?: string; clientRef?: unknown; mode?: unknown; mindful?: unknown }>().catch(() => ({}) as { minutes?: number; nodeId?: string; date?: string; clientRef?: unknown; mode?: unknown; mindful?: unknown });
  const minutes = Math.round(Number(body.minutes));
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > FOCUS_MAX_MINUTES) return c.json({ error: `a round is 1 to ${FOCUS_MAX_MINUTES} minutes` }, 400);
  const date = typeof body.date === 'string' && DATE_RE.test(body.date) ? body.date : new Date().toISOString().slice(0, 10);
  if (!dateNearToday(date)) return c.json({ error: 'a round counts for today or yesterday' }, 400);
  if (body.clientRef !== undefined && (typeof body.clientRef !== 'string' || !REF_RE.test(body.clientRef))) return c.json({ error: 'clientRef is up to 64 letters, digits, colons or dashes' }, 400);
  const ref = typeof body.clientRef === 'string' ? body.clientRef : null;
  const task = await ownTask(db, user.id, body.nodeId || undefined);
  if (task === 'missing') return c.json({ error: 'that task is not yours' }, 404);
  const id = newId();
  const now = nowIso();
  const logId = body.mindful === true ? newId() : null;
  const stmts = [
    db.prepare('INSERT OR IGNORE INTO focus_rounds (id, user_id, node_id, title, minutes, day, created_at, mode, log_id, client_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, user.id, task?.id ?? null, task?.title ?? '', minutes, date, now, isFocusMode(body.mode) ? body.mode : null, logId, ref),
  ];
  // Only when the round above was written: a duplicate leaves no second log behind.
  if (logId) stmts.push(db.prepare("INSERT INTO wellbeing_logs (id, user_id, kind, date, value, extra, note, created_at) SELECT ?, ?, 'mindful', ?, ?, ?, '', ? WHERE EXISTS (SELECT 1 FROM focus_rounds WHERE id = ? AND user_id = ?)").bind(logId, user.id, date, minutes, JSON.stringify({ kind: 'focus' }), now, id, user.id));
  const [made] = await db.batch(stmts);
  if (!made?.meta.changes) {
    const prev = ref ? await db.prepare('SELECT id FROM focus_rounds WHERE user_id = ? AND client_ref = ?').bind(user.id, ref).first<{ id: string }>() : null;
    return c.json({ ok: true, id: prev?.id ?? null, duplicate: true, logged: false });
  }
  return c.json({ ok: true, id, duplicate: false, logged: logId !== null }, 201);
});

// Change a round: how it felt (one to five, or null to take it back), its length, or its task (null for none). Only the person's own
// round, and it pays nothing. A round that counted as mindful minutes changes its log with it.
wellbeing.patch('/focus/:id', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const body = await c.req.json<{ quality?: unknown; minutes?: unknown; nodeId?: unknown }>().catch(() => ({}) as { quality?: unknown; minutes?: unknown; nodeId?: unknown });
  const round = await db.prepare('SELECT id, log_id FROM focus_rounds WHERE id = ? AND user_id = ?').bind(c.req.param('id'), userId).first<{ id: string; log_id: string | null }>();
  if (!round) return c.json({ error: 'not found' }, 404);
  const sets: string[] = [];
  const args: unknown[] = [];
  const stmts: D1PreparedStatement[] = [];
  if (body.quality !== undefined) {
    const q = body.quality === null ? null : Math.round(Number(body.quality));
    if (q !== null && (!Number.isFinite(q) || q < 1 || q > 5)) return c.json({ error: 'a rating is 1 to 5' }, 400);
    sets.push('quality = ?');
    args.push(q);
  }
  if (body.minutes !== undefined) {
    const m = Math.round(Number(body.minutes));
    if (!Number.isFinite(m) || m < 1 || m > FOCUS_MAX_MINUTES) return c.json({ error: `a round is 1 to ${FOCUS_MAX_MINUTES} minutes` }, 400);
    sets.push('minutes = ?');
    args.push(m);
    if (round.log_id) stmts.push(db.prepare("UPDATE wellbeing_logs SET value = ? WHERE id = ? AND user_id = ? AND kind = 'mindful'").bind(m, round.log_id, userId));
  }
  if (body.nodeId !== undefined) {
    const task = await ownTask(db, userId, body.nodeId);
    if (task === 'missing') return c.json({ error: 'that task is not yours' }, 404);
    sets.push('node_id = ?', 'title = ?');
    args.push(task?.id ?? null, task?.title ?? '');
  }
  if (sets.length === 0) return c.json({ error: 'nothing to change' }, 400);
  await db.batch([db.prepare(`UPDATE focus_rounds SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).bind(...args, round.id, userId), ...stmts]);
  return c.json({ ok: true });
});

/** How a mindful log was made, as Mindfulness keeps it in `extra.kind`: a break or a breath from the panel, or none for one logged by hand. */
const MINDFUL_FROM: Readonly<Record<string, string>> = Object.assign(Object.create(null) as Record<string, string>, { break: 'break', breathe: 'breathe' });

// Change a mindful-minutes log (All tables, 2026-11-14, the founder: edit as well as delete): its minutes, and how it was made (`kind`: a
// break, a breath, or null for one logged by hand). A log a focus round wrote keeps the round in step: its minutes change with the round's in
// one batch, and it stays a focus round's (its kind is never changed here; Focus sessions is where the round lives). Owner only; pays nothing.
wellbeing.patch('/mindful/:id', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const id = c.req.param('id');
  const body = await c.req.json<{ minutes?: unknown; kind?: unknown }>().catch(() => ({}) as { minutes?: unknown; kind?: unknown });
  const [log, owned] = await Promise.all([
    db.prepare("SELECT id, extra FROM wellbeing_logs WHERE id = ? AND user_id = ? AND kind = 'mindful'").bind(id, userId).first<{ id: string; extra: string }>(),
    db.prepare('SELECT 1 AS x FROM focus_rounds WHERE log_id = ? AND user_id = ?').bind(id, userId).first(),
  ]);
  if (!log) return c.json({ error: 'not found' }, 404);
  const roundSays = 'A focus round’s minutes stay a focus round’s. Change its minutes here, or the round under Focus sessions.';
  if (body.kind !== undefined && owned) return c.json({ error: roundSays }, 400);
  const stmts: D1PreparedStatement[] = [];
  if (body.minutes !== undefined) {
    const m = typeof body.minutes === 'number' ? Math.round(body.minutes) : Number.NaN;
    if (!Number.isFinite(m) || m < 1 || m > FOCUS_MAX_MINUTES) return c.json({ error: `Mindful minutes are 1 to ${FOCUS_MAX_MINUTES} at a time.` }, 400);
    stmts.push(db.prepare("UPDATE wellbeing_logs SET value = ? WHERE id = ? AND user_id = ? AND kind = 'mindful'").bind(m, log.id, userId));
    // The round that wrote it, if any, moves with it (the same pair PATCH /focus/:id keeps from the other side).
    stmts.push(db.prepare('UPDATE focus_rounds SET minutes = ? WHERE log_id = ? AND user_id = ?').bind(m, log.id, userId));
  }
  if (body.kind !== undefined) {
    if (body.kind === 'focus') return c.json({ error: 'Only a focus round counts as one. Add a session in Mindfulness.' }, 400);
    const kind = body.kind === null ? null : typeof body.kind === 'string' ? (MINDFUL_FROM[body.kind] ?? '') : '';
    if (kind === '') return c.json({ error: 'Pick a break, a breath, or logged by hand.' }, 400);
    let extra: Record<string, unknown> = {};
    try {
      const v = JSON.parse(log.extra || '{}') as unknown;
      if (v && typeof v === 'object' && !Array.isArray(v)) extra = v as Record<string, unknown>;
    } catch {
      extra = {};
    }
    const next = { ...extra };
    if (kind === null) delete next.kind;
    else next.kind = kind;
    // Guarded on what was read and on no round owning it, inside the statement: a round's log stays a focus round's.
    stmts.push(
      db
        .prepare("UPDATE wellbeing_logs SET extra = ? WHERE id = ? AND user_id = ? AND kind = 'mindful' AND extra IS ? AND NOT EXISTS (SELECT 1 FROM focus_rounds f WHERE f.log_id = wellbeing_logs.id AND f.user_id = ?)")
        .bind(JSON.stringify(next), log.id, userId, log.extra, userId),
    );
  }
  if (stmts.length === 0) return c.json({ error: 'nothing to change' }, 400);
  const done = await db.batch(stmts);
  // A kind that did not land: a round took the log, or another tab changed it, between the read and the write.
  if (body.kind !== undefined && !done[done.length - 1]!.meta.changes) return c.json({ error: 'changed' }, 409);
  if (body.minutes !== undefined && !done[0]!.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

// Delete a round, and its mindful-minutes log when it had one. Only the person's own.
wellbeing.delete('/focus/:id', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const round = await db.prepare('SELECT id, log_id FROM focus_rounds WHERE id = ? AND user_id = ?').bind(c.req.param('id'), userId).first<{ id: string; log_id: string | null }>();
  if (!round) return c.json({ error: 'not found' }, 404);
  const [gone] = await db.batch([
    db.prepare('DELETE FROM focus_rounds WHERE id = ? AND user_id = ?').bind(round.id, userId),
    ...(round.log_id ? [db.prepare('DELETE FROM wellbeing_logs WHERE id = ? AND user_id = ?').bind(round.log_id, userId)] : []),
  ]);
  // Another tab, or a second send, took it between the read above and here: said, never a quiet yes, so All tables counts it once.
  if (!gone?.meta.changes) return c.json({ error: GONE_NOW }, 409);
  return c.json({ ok: true });
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
    // Each task's own time estimate rides along (the person's own tasks only), so the bars can say "45 of 60 min planned".
    db.prepare('SELECT f.node_id, f.title, f.minutes, f.day, f.quality, n.estimate_min AS planned FROM focus_rounds f LEFT JOIN nodes n ON n.id = f.node_id AND n.user_id = f.user_id WHERE f.user_id = ? AND f.day >= ? AND f.day <= ?').bind(user.id, from, today).all<{ node_id: string | null; title: string; minutes: number; day: string; quality: number | null; planned: number | null }>(),
    db.prepare("SELECT substr(completed_at, 1, 10) AS day FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ?").bind(user.id, from).all<{ day: string }>(),
  ]);
  const label = (key: string) =>
    view === 'day'
      ? new Date(`${key}T00:00:00Z`).toLocaleDateString(LOCALE, { weekday: 'short', timeZone: 'UTC' }).slice(0, 2) + ' ' + key.slice(8)
      : view === 'week'
        ? `${new Date(`${key}T00:00:00Z`).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' })}`
        : new Date(`${key}T00:00:00Z`).toLocaleDateString(LOCALE, { month: 'short', timeZone: 'UTC' });
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
  const byTask = new Map<string, { nodeId: string | null; title: string; minutes: number; rounds: number; planned: number | null }>();
  const perDay = new Map<string, number>();
  for (const r of rounds.results) {
    if (!nowSet.has(startOf(r.day))) continue;
    perDay.set(r.day, (perDay.get(r.day) ?? 0) + r.minutes);
    const key = r.node_id ?? '';
    const t = byTask.get(key) ?? { nodeId: r.node_id, title: r.title || 'No task picked', minutes: 0, rounds: 0, planned: r.node_id && r.planned && r.planned > 0 ? r.planned : null };
    t.minutes += r.minutes;
    t.rounds += 1;
    byTask.set(key, t);
  }
  // The average of the ratings given in this stretch. Rounds nobody rated are left out, not counted as zero.
  let ratedSum = 0;
  let ratedCount = 0;
  for (const r of rounds.results) {
    if (r.quality !== null && nowSet.has(startOf(r.day))) {
      ratedSum += r.quality;
      ratedCount += 1;
    }
  }
  const minutes = sum(nowKeys, (b) => b.minutes);
  const before = sum(prevKeys, (b) => b.minutes);
  const top = [...buckets].sort((a, b) => b.minutes - a.minutes)[0];
  const unit = view === 'day' ? 'two weeks' : view === 'week' ? 'eight weeks' : 'six months';
  const res: FocusResponse = {
    view,
    buckets,
    totals: { minutes, rounds: sum(nowKeys, (b) => b.rounds), tasksDone: sum(nowKeys, (b) => b.tasksDone), activeBuckets: buckets.filter((b) => b.minutes > 0).length, quality: ratedCount > 0 ? Math.round((ratedSum / ratedCount) * 10) / 10 : null, rated: ratedCount },
    tasks: [...byTask.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 8),
    best: top && top.minutes > 0 ? { key: top.key, label: top.label, minutes: top.minutes } : null,
    // Every day from the first day of this stretch to today, so a goal can be counted day by day whatever the view.
    dayMinutes: Array.from({ length: Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${nowKeys[0]}T00:00:00Z`)) / 86_400_000) + 1) }, (_, i) => perDay.get(shiftDate(nowKeys[0]!, i)) ?? 0),
    trend: before === 0 && minutes === 0 ? 'No focus rounds yet. Start one above.' : before === 0 ? `A first stretch: ${minutes} minutes of focus in these ${unit}.` : minutes >= before ? `${minutes - before} minutes more than the ${unit} before.` : `${before - minutes} minutes fewer than the ${unit} before.`,
  };
  return c.json(res);
});

wellbeing.get('/summary', async (c) => {
  const user = c.get('user');
  const today = c.req.query('date') && DATE_RE.test(c.req.query('date')!) ? c.req.query('date')! : new Date().toISOString().slice(0, 10);
  return c.json(await summaryFor(c.env.DB, user.id, today, streakNow(user.streak, user.last_checkin, today)));
});

wellbeing.get('/:kind', async (c) => {
  const kind = c.req.param('kind');
  if (!isKind(kind)) return c.json({ error: 'unknown log' }, 404);
  // A list a person scrolls (Mindful's Sessions, 2026-11-07): every log of the kind, newest first, a page at a time (prefix `s`, ten by default).
  // Without `list=1` the answer is the window the charts and the assistant read, as before.
  if (c.req.query('list') === '1') {
    const ask = pageOf(c, 's', TEN_A_PAGE);
    const rows = await c.env.DB.prepare('SELECT * FROM wellbeing_logs WHERE user_id = ? AND kind = ? ORDER BY date DESC, created_at DESC, id LIMIT ? OFFSET ?').bind(c.get('user').id, kind, ask.limit, ask.offset).all<Row>();
    const pg = paged(rows.results, ask);
    return c.json({ logs: pg.items.map(toLog), page: pg.page });
  }
  const days = Math.min(365, Math.max(1, Math.round(Number(c.req.query('days') ?? 30)) || 30));
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
  let extra: Record<string, unknown> = body.extra && typeof body.extra === 'object' ? body.extra : {};
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
  // Movement (Life's quick log, the assistant) is Fitness's own log: today or yesterday, and only what Fitness's one reader keeps beside the minutes.
  if (kind === 'move') {
    if (!dateNearOwnDay(date, user.timezone)) return c.json({ error: 'You can log today or yesterday.' }, 400);
    const m = parseMove({ ...extra, minutes: value, note });
    if (typeof m === 'string') return c.json({ error: m }, 400);
    extra = JSON.parse(moveExtra(m)) as Record<string, unknown>;
  }
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
  return c.json({ log: row ? toLog(row) : null, summary: await summaryFor(db, user.id, date, streakNow(user.streak, user.last_checkin, date)) }, 201);
});

// The kind in the path is part of the address: a sleep id under /mood/ deletes nothing and says so. Mindful minutes a focus round wrote go
// with the round's mark in the same batch (2026-11-14): the round stays, no longer counted as mindful minutes, so it never points at a log
// that is gone (`focus_rounds.log_id`).
wellbeing.delete('/:kind/:id', async (c) => {
  const db = c.env.DB;
  const kind = c.req.param('kind');
  if (!isKind(kind)) return c.json({ error: 'unknown log' }, 404);
  const id = c.req.param('id');
  const userId = c.get('user').id;
  const del = db.prepare('DELETE FROM wellbeing_logs WHERE id = ? AND user_id = ? AND kind = ?').bind(id, userId, kind);
  const res = kind === 'mindful' ? (await db.batch([db.prepare('UPDATE focus_rounds SET log_id = NULL WHERE log_id = ? AND user_id = ?').bind(id, userId), del]))[1]! : await del.run();
  if (res.meta.changes === 0) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});
