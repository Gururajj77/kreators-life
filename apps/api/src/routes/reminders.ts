import { Hono } from 'hono';
import { MAX_CUSTOM_REMINDERS, parseWeekdays, REMINDER_TIME, REMINDER_TITLE_MAX, WATER_DAY_MAX, WATER_GLASS_MAX, WATER_GLASS_MIN, WATER_GOAL_MAX, WATER_GOAL_MIN, type CustomReminder, type RemindersResponse, type WaterState } from '@kreators/shared';
import type { AppEnv } from '../env';
import { DATE_RE, dateNearToday, newId, nowIso, shiftDate, str } from '../db';

/**
 * Water and the person's own reminders. Owner-only: nothing here reaches anyone else, and it is in the export and
 * goes with the account. The day always comes from the device, like a task's tick, and only today or yesterday counts.
 */
export const reminders = new Hono<AppEnv>();

interface PrefsRow { water_goal_ml: number; water_glass_ml: number }
interface CustomRow { id: string; title: string; time: string; days_json: string; enabled: number }

const toCustom = (r: CustomRow): CustomReminder => ({ id: r.id, title: r.title, time: r.time, days: parseWeekdays(JSON.parse(r.days_json || '[]')), enabled: r.enabled === 1 });

/** The person's preferences, made with their defaults the first time they are read. */
async function prefsFor(db: D1Database, userId: string): Promise<PrefsRow> {
  await db.prepare('INSERT OR IGNORE INTO reminder_prefs (user_id, updated_at) VALUES (?, ?)').bind(userId, nowIso()).run();
  return (await db.prepare('SELECT water_goal_ml, water_glass_ml FROM reminder_prefs WHERE user_id = ?').bind(userId).first<PrefsRow>())!;
}

/**
 * Water reminders are gone (2026-11-07), so nothing reads these fixed words. A tab left open across that deploy still draws its reminder
 * switch and hours from them and would break on a missing one; it reads "off". Safe to take out with the next deploy after that one.
 */
const OPEN_OLD_TAB = { on: false, everyMin: 120, from: '09:00', to: '21:00' };

async function waterFor(db: D1Database, userId: string, day: string): Promise<WaterState> {
  const p = await prefsFor(db, userId);
  const rows = await db.prepare('SELECT day, SUM(ml) AS ml FROM water_logs WHERE user_id = ? AND day >= ? AND day <= ? GROUP BY day').bind(userId, shiftDate(day, -6), day).all<{ day: string; ml: number }>();
  const by = new Map(rows.results.map((r) => [r.day, r.ml]));
  const ml = by.get(day) ?? 0;
  return {
    ...OPEN_OLD_TAB,
    day,
    ml,
    goalMl: p.water_goal_ml,
    glassMl: p.water_glass_ml,
    glasses: Math.floor(ml / p.water_glass_ml),
    goalGlasses: Math.ceil(p.water_goal_ml / p.water_glass_ml),
    week: Array.from({ length: 7 }, (_, i) => {
      const d = shiftDate(day, i - 6);
      return { day: d, ml: by.get(d) ?? 0 };
    }),
  };
}

const dayOf = (v: unknown): string | null => (typeof v === 'string' && DATE_RE.test(v) && dateNearToday(v) ? v : null);

async function all(db: D1Database, userId: string, day: string): Promise<RemindersResponse> {
  const rows = await db.prepare('SELECT id, title, time, days_json, enabled FROM custom_reminders WHERE user_id = ? ORDER BY time, created_at').bind(userId).all<CustomRow>();
  // Tasks from Daily tagged Remember, the dated ones first; one hidden on the day (2026-11-12) stays out, as on Daily.
  const tasks = await db
    .prepare("SELECT id, title, COALESCE(do_date, due_date) AS day, due_time FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'active' AND remind = 1 AND (hidden_until IS NULL OR hidden_until < ?) ORDER BY COALESCE(do_date, due_date) IS NULL, COALESCE(do_date, due_date), created_at LIMIT 20")
    .bind(userId, day)
    .all<{ id: string; title: string; day: string | null; due_time: string | null }>();
  return { water: await waterFor(db, userId, day), custom: rows.results.map(toCustom), tasks: tasks.results.map((t) => ({ id: t.id, title: t.title, day: t.day, time: t.due_time })) };
}

reminders.get('/', async (c) => {
  const day = dayOf(c.req.query('day'));
  if (!day) return c.json({ error: 'send day as today or yesterday' }, 400);
  return c.json(await all(c.env.DB, c.get('user').id, day));
});

// A glass, or any amount. The tap says how much; the default is the person's own glass.
reminders.post('/water', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ day?: string; ml?: number }>().catch(() => ({}) as { day?: string; ml?: number });
  const day = dayOf(body.day);
  if (!day) return c.json({ error: 'send day as today or yesterday' }, 400);
  const p = await prefsFor(db, user.id);
  const ml = body.ml === undefined ? p.water_glass_ml : Math.round(Number(body.ml));
  if (!Number.isFinite(ml) || ml < WATER_GLASS_MIN || ml > WATER_GLASS_MAX) return c.json({ error: `Between ${WATER_GLASS_MIN} and ${WATER_GLASS_MAX} ml at a time.` }, 400);
  const so = await db.prepare('SELECT COALESCE(SUM(ml), 0) AS ml FROM water_logs WHERE user_id = ? AND day = ?').bind(user.id, day).first<{ ml: number }>();
  if ((so?.ml ?? 0) + ml > WATER_DAY_MAX) return c.json({ error: 'That is more water than a day can hold. Undo the last one if it was a slip.' }, 400);
  await db.prepare('INSERT INTO water_logs (id, user_id, day, ml, created_at) VALUES (?, ?, ?, ?, ?)').bind(newId(), user.id, day, ml, nowIso()).run();
  return c.json({ water: await waterFor(db, user.id, day) }, 201);
});

// Take the last one back, for a tap that slipped.
reminders.delete('/water', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const day = dayOf(c.req.query('day'));
  if (!day) return c.json({ error: 'send day as today or yesterday' }, 400);
  await db.prepare('DELETE FROM water_logs WHERE id = (SELECT id FROM water_logs WHERE user_id = ? AND day = ? ORDER BY created_at DESC LIMIT 1)').bind(user.id, day).run();
  return c.json({ water: await waterFor(db, user.id, day) });
});

reminders.put('/water/settings', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const day = dayOf(body.day);
  if (!day) return c.json({ error: 'send day as today or yesterday' }, 400);
  const p = await prefsFor(db, user.id);
  const goal = body.goalMl === undefined ? p.water_goal_ml : Math.round(Number(body.goalMl));
  const glass = body.glassMl === undefined ? p.water_glass_ml : Math.round(Number(body.glassMl));
  // Only the goal and the glass. An old tab may still send on, everyMin, from and to; they are ignored, never refused.
  if (!(goal >= WATER_GOAL_MIN && goal <= WATER_GOAL_MAX)) return c.json({ error: `A daily goal is ${WATER_GOAL_MIN} to ${WATER_GOAL_MAX} ml.` }, 400);
  if (!(glass >= WATER_GLASS_MIN && glass <= WATER_GLASS_MAX)) return c.json({ error: `A glass is ${WATER_GLASS_MIN} to ${WATER_GLASS_MAX} ml.` }, 400);
  await db.prepare('UPDATE reminder_prefs SET water_goal_ml = ?, water_glass_ml = ?, updated_at = ? WHERE user_id = ?').bind(goal, glass, nowIso(), user.id).run();
  return c.json({ water: await waterFor(db, user.id, day) });
});

// The person's own reminders: a line, a time and the days it runs.
function customFrom(body: Record<string, unknown>): { title: string; time: string; days: number[] } | string {
  const title = str(body.title, REMINDER_TITLE_MAX);
  const time = str(body.time, 5);
  const days = body.days === undefined ? [1, 2, 3, 4, 5, 6, 7] : parseWeekdays(body.days);
  if (!title) return 'Say what to remind you of.';
  if (!REMINDER_TIME.test(time)) return 'Pick a time, like 18:30.';
  if (days.length === 0) return 'Pick at least one day.';
  return { title, time, days };
}

reminders.post('/custom', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const made = customFrom(await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>));
  if (typeof made === 'string') return c.json({ error: made }, 400);
  const n = await db.prepare('SELECT COUNT(*) AS n FROM custom_reminders WHERE user_id = ?').bind(user.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= MAX_CUSTOM_REMINDERS) return c.json({ error: `That is ${MAX_CUSTOM_REMINDERS} reminders already. Remove one first.` }, 400);
  const id = newId();
  await db.prepare('INSERT INTO custom_reminders (id, user_id, title, time, days_json, enabled, last_sent_day, created_at) VALUES (?, ?, ?, ?, ?, 1, NULL, ?)').bind(id, user.id, made.title, made.time, JSON.stringify(made.days), nowIso()).run();
  const row = await db.prepare('SELECT id, title, time, days_json, enabled FROM custom_reminders WHERE id = ?').bind(id).first<CustomRow>();
  return c.json({ reminder: row ? toCustom(row) : null }, 201);
});

reminders.patch('/custom/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT id, title, time, days_json, enabled FROM custom_reminders WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first<CustomRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const cur = toCustom(row);
  const next = customFrom({ title: body.title ?? cur.title, time: body.time ?? cur.time, days: body.days ?? cur.days });
  if (typeof next === 'string') return c.json({ error: next }, 400);
  await db
    .prepare('UPDATE custom_reminders SET title = ?, time = ?, days_json = ?, enabled = ?, last_sent_day = NULL WHERE id = ?')
    .bind(next.title, next.time, JSON.stringify(next.days), body.enabled === undefined ? row.enabled : body.enabled === false ? 0 : 1, row.id)
    .run();
  const fresh = await db.prepare('SELECT id, title, time, days_json, enabled FROM custom_reminders WHERE id = ?').bind(row.id).first<CustomRow>();
  return c.json({ reminder: fresh ? toCustom(fresh) : null });
});

reminders.delete('/custom/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM custom_reminders WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});
