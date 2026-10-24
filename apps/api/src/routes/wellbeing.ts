import { Hono } from 'hono';
import { wellbeingLabel, type LogKind, type WellbeingLog, type WellbeingSummary } from '@kreators/shared';
import type { AppEnv } from '../env';
import { DATE_RE, newId, nowIso, shiftDate } from '../db';

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
