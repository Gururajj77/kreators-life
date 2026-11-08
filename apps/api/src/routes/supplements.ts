import { Hono } from 'hono';
import {
  MAX_SUPPLEMENTS,
  parseSupplement,
  parseSupplementSettings,
  SUPPLEMENT_SETTINGS_OFF,
  SUPPLEMENT_TIMES,
  supplementDue,
  isSupplementTime,
  weekdayOfDay,
  type Supplement,
  type SupplementRow,
  type SupplementSettings,
  type SupplementsTodayView,
  type SupplementsView,
} from '@kreators/shared/fitness';
import type { AppEnv } from '../env';
import { dayFromDevice, dayInZone, newId, nowIso, shiftDate } from '../db';
import { logDay, supplementOnList } from '../fitness';

/**
 * Supplements in Fitness (2026-11-07; migration 0104), under /fitness/supplements so the module gate refuses all of it while Fitness is
 * off. The person's own list, owner only on every statement. The app never suggests one, gives an amount or checks a mix, and nothing here
 * pays, counts toward a streak or a badge, or is read by Emerging, the brief, the leaderboard, a coach or the assistant. Logs keep no line
 * of it (the `fitness` area is private in logs.ts). Every write is limited under `prefs` (limits.ts).
 */
export const supplements = new Hono<AppEnv>();

interface Row {
  id: string;
  name: string;
  kind: string;
  amount: string;
  time_of_day: string;
  days_json: string;
  position: number;
  paused_at: string | null;
  pauses_json: string;
  created_at: string;
}
const COLS = 'id, name, kind, amount, time_of_day, days_json, position, paused_at, pauses_json, created_at';

function toSupplement(r: Row): Supplement {
  let days: unknown = [];
  try {
    days = JSON.parse(r.days_json);
  } catch {
    days = [];
  }
  // Read back through the one reader, so a row that someone changed by hand still comes out clean.
  const clean = parseSupplement({ name: r.name.slice(0, 40) || 'Supplement', kind: r.kind, amount: r.amount.slice(0, 24), time: r.time_of_day, days: Array.isArray(days) && days.length ? days : [1, 2, 3, 4, 5, 6, 7] });
  const base = typeof clean === 'string' ? { name: r.name || 'Supplement', kind: 'other' as const, amount: '', time: 'morning' as const, days: [1, 2, 3, 4, 5, 6, 7] } : clean;
  return { id: r.id, ...base, position: r.position, paused: r.paused_at !== null, createdAt: r.created_at };
}

async function settingsOf(db: D1Database, userId: string): Promise<SupplementSettings> {
  const r = await db.prepare('SELECT supplements_on, supplements_daily, remind_json FROM fitness_prefs WHERE user_id = ?').bind(userId).first<{ supplements_on: number; supplements_daily: number; remind_json: string }>();
  if (!r) return SUPPLEMENT_SETTINGS_OFF;
  let remind: unknown = {};
  try {
    remind = JSON.parse(r.remind_json || '{}');
  } catch {
    remind = {};
  }
  const s = parseSupplementSettings({ on: r.supplements_on === 1, daily: r.supplements_daily === 1, remind }, SUPPLEMENT_SETTINGS_OFF);
  return typeof s === 'string' ? { on: r.supplements_on === 1, daily: r.supplements_daily === 1, remind: {} } : s;
}

const rowsOf = async (db: D1Database, userId: string) => (await db.prepare(`SELECT ${COLS} FROM supplements WHERE user_id = ? ORDER BY position, created_at LIMIT ?`).bind(userId, MAX_SUPPLEMENTS * 2).all<Row>()).results;
const listOf = async (db: D1Database, userId: string) => (await rowsOf(db, userId)).map(toSupplement);

// The Fitness section: the switches, the list, today's ticks and the last seven days of each (for a doctor's visit).
supplements.get('/', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const day = dayFromDevice(c.req.query('day'));
  const from = shiftDate(day, -6);
  const zone = c.get('user').timezone;
  const [settings, stored, ticks] = await Promise.all([
    settingsOf(db, userId),
    rowsOf(db, userId),
    db.prepare('SELECT supplement_id, day FROM supplement_days WHERE user_id = ? AND day >= ? AND day <= ?').bind(userId, from, day).all<{ supplement_id: string; day: string }>(),
  ]);
  const taken = new Set(ticks.results.map((t) => `${t.supplement_id}|${t.day}`));
  const week = Array.from({ length: 7 }, (_, i) => shiftDate(from, i));
  const rows: SupplementRow[] = stored.map((row) => {
    const s = toSupplement(row);
    const onList = supplementOnList(row, zone);
    const counted = week.filter((d) => onList(d) && s.days.includes(weekdayOfDay(d)));
    return {
      ...s,
      dueToday: supplementDue(s, day),
      takenToday: taken.has(`${s.id}|${day}`),
      week: week.map((d) => taken.has(`${s.id}|${d}`)),
      // A tick from before the day it was added still counts as a day it was on the list.
      dueDays: Math.max(counted.length, week.filter((d) => taken.has(`${s.id}|${d}`)).length),
      takenDays: week.filter((d) => taken.has(`${s.id}|${d}`)).length,
    };
  });
  const res: SupplementsView = { day, settings, items: rows };
  return c.json(res);
});

// Daily's fold: today's items by time of day, only while both switches are on (the gate already holds Fitness).
supplements.get('/today', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const day = dayFromDevice(c.req.query('date') ?? c.req.query('day'));
  const settings = await settingsOf(db, userId);
  const off: SupplementsTodayView = { show: false, day, total: 0, taken: 0, groups: [] };
  if (!settings.on || !settings.daily) return c.json(off);
  const [items, ticks] = await Promise.all([listOf(db, userId), db.prepare('SELECT supplement_id FROM supplement_days WHERE user_id = ? AND day = ?').bind(userId, day).all<{ supplement_id: string }>()]);
  const taken = new Set(ticks.results.map((t) => t.supplement_id));
  const due = items.filter((s) => supplementDue(s, day));
  if (!due.length) return c.json(off);
  const res: SupplementsTodayView = {
    show: true,
    day,
    total: due.length,
    taken: due.filter((s) => taken.has(s.id)).length,
    groups: SUPPLEMENT_TIMES.map((time) => ({ time, items: due.filter((s) => s.time === time).map((s) => ({ id: s.id, name: s.name, amount: s.amount, kind: s.kind, taken: taken.has(s.id) })) })).filter((g) => g.items.length > 0),
  };
  return c.json(res);
});

// The switches: Track supplements (the consent), Show on Daily, and a reminder time per part of the day.
supplements.put('/settings', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const body = await c.req.json<unknown>().catch(() => ({}));
  const next = parseSupplementSettings(body, await settingsOf(db, userId));
  if (typeof next === 'string') return c.json({ error: next }, 400);
  // Show on Daily and reminders go with the main switch: off is off everywhere.
  const s: SupplementSettings = next.on ? next : { ...next, daily: false };
  await db
    .prepare('INSERT INTO fitness_prefs (user_id, supplements_on, supplements_daily, remind_json, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET supplements_on = excluded.supplements_on, supplements_daily = excluded.supplements_daily, remind_json = excluded.remind_json, updated_at = excluded.updated_at')
    .bind(userId, s.on ? 1 : 0, s.daily ? 1 : 0, JSON.stringify(s.remind), nowIso())
    .run();
  return c.json({ settings: s });
});

// Add one, at the end of the list, never past MAX_SUPPLEMENTS (the count is checked inside the insert, so two at once cannot pass it).
supplements.post('/', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const s = parseSupplement(await c.req.json<unknown>().catch(() => ({})));
  if (typeof s === 'string') return c.json({ error: s }, 400);
  const id = newId();
  const now = nowIso();
  const res = await db
    .prepare(
      `INSERT INTO supplements (id, user_id, name, kind, amount, time_of_day, days_json, position, paused_at, created_at, updated_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, COALESCE((SELECT MAX(position) FROM supplements WHERE user_id = ?2), 0) + 1, NULL, ?8, ?8
       WHERE (SELECT COUNT(*) FROM supplements WHERE user_id = ?2) < ?9`,
    )
    .bind(id, userId, s.name, s.kind, s.amount, s.time, JSON.stringify(s.days), now, MAX_SUPPLEMENTS)
    .run();
  if (!res.meta.changes) return c.json({ error: `Your list holds up to ${MAX_SUPPLEMENTS}. Remove one first.` }, 409);
  const row = await db.prepare(`SELECT ${COLS} FROM supplements WHERE id = ? AND user_id = ?`).bind(id, userId).first<Row>();
  return c.json({ supplement: row ? toSupplement(row) : null }, 201);
});

// Mark every one of a part of the day taken (Mark all taken), for today or yesterday. Only the person's own, due that day, not paused.
supplements.post('/day', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const day = logDay(body.date, c.get('user').timezone);
  if (typeof day !== 'string') return c.json(day, 400);
  if (!isSupplementTime(body.time)) return c.json({ error: `pick when: ${SUPPLEMENT_TIMES.join(', ')}` }, 400);
  const time = body.time;
  const due = (await listOf(db, userId)).filter((s) => s.time === time && supplementDue(s, day));
  const now = nowIso();
  if (due.length) await db.batch(due.map((s) => db.prepare('INSERT OR IGNORE INTO supplement_days (supplement_id, user_id, day, taken_at) VALUES (?, ?, ?, ?)').bind(s.id, userId, day, now)));
  return c.json({ ok: true, marked: due.length });
});

// Remove the whole list (taking back the yes): every supplement and every tick. The switches stay as they are.
supplements.delete('/', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  await db.batch([db.prepare('DELETE FROM supplement_days WHERE user_id = ?').bind(userId), db.prepare('DELETE FROM supplements WHERE user_id = ?').bind(userId)]);
  return c.json({ ok: true });
});

async function own(db: D1Database, userId: string, id: string): Promise<Row | null> {
  return db.prepare(`SELECT ${COLS} FROM supplements WHERE id = ? AND user_id = ?`).bind(id, userId).first<Row>();
}

// Change one: its words, kind, when, days, or Pause and Resume (paused keeps its history and leaves Daily and the reminders).
supplements.patch('/:id', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const row = await own(db, userId, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const old = toSupplement(row);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const s = parseSupplement(body, old);
  if (typeof s === 'string') return c.json({ error: s }, 400);
  const paused = body.paused === undefined ? row.paused_at : body.paused === true ? (row.paused_at ?? nowIso()) : null;
  // Coming back keeps the stretch it was away, so those days are never counted as due (`supplementOnList`).
  let pauses = row.pauses_json || '[]';
  if (row.paused_at && paused === null) {
    const zone = c.get('user').timezone;
    let list: unknown[] = [];
    try {
      const v = JSON.parse(pauses) as unknown;
      list = Array.isArray(v) ? v : [];
    } catch {
      list = [];
    }
    pauses = JSON.stringify([...list, [dayInZone(zone, new Date(row.paused_at)), dayInZone(zone)]].slice(-50));
  }
  await db.prepare('UPDATE supplements SET name = ?, kind = ?, amount = ?, time_of_day = ?, days_json = ?, paused_at = ?, pauses_json = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(s.name, s.kind, s.amount, s.time, JSON.stringify(s.days), paused, pauses, nowIso(), row.id, userId).run();
  const after = await own(db, userId, row.id);
  return c.json({ supplement: after ? toSupplement(after) : null });
});

// Move one up or down the list, swapping places with its neighbour.
supplements.post('/:id/move', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const body = await c.req.json<{ dir?: unknown }>().catch(() => ({}) as { dir?: unknown });
  if (body.dir !== 'up' && body.dir !== 'down') return c.json({ error: 'move up or down' }, 400);
  const list = await listOf(db, userId);
  const i = list.findIndex((s) => s.id === c.req.param('id'));
  if (i < 0) return c.json({ error: 'not found' }, 404);
  const j = body.dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return c.json({ ok: true, moved: false });
  const order = [...list];
  [order[i], order[j]] = [order[j]!, order[i]!];
  await db.batch(order.map((s, k) => db.prepare('UPDATE supplements SET position = ? WHERE id = ? AND user_id = ?').bind(k + 1, s.id, userId)));
  return c.json({ ok: true, moved: true });
});

supplements.delete('/:id', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const row = await own(db, userId, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  await db.batch([db.prepare('DELETE FROM supplement_days WHERE supplement_id = ? AND user_id = ?').bind(row.id, userId), db.prepare('DELETE FROM supplements WHERE id = ? AND user_id = ?').bind(row.id, userId)]);
  return c.json({ ok: true });
});

// Tick one taken, or untick it, for today or yesterday. Taking is INSERT OR IGNORE, so two taps make one row; unticking deletes it.
supplements.put('/:id/day', async (c) => {
  const db = c.env.DB;
  const userId = c.get('user').id;
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const day = logDay(body.date, c.get('user').timezone);
  if (typeof day !== 'string') return c.json(day, 400);
  if (typeof body.taken !== 'boolean') return c.json({ error: 'send taken as true or false' }, 400);
  const row = await own(db, userId, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  if (body.taken) await db.prepare('INSERT OR IGNORE INTO supplement_days (supplement_id, user_id, day, taken_at) VALUES (?, ?, ?, ?)').bind(row.id, userId, day, nowIso()).run();
  else await db.prepare('DELETE FROM supplement_days WHERE supplement_id = ? AND user_id = ? AND day = ?').bind(row.id, userId, day).run();
  return c.json({ ok: true, day, taken: body.taken });
});
