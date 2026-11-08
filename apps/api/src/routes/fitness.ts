import { Hono } from 'hono';
import { MONTH_RE } from '@kreators/shared';
import type { FitnessMonth, FitnessResponse, MovesPage } from '@kreators/shared/fitness';
import type { AppEnv } from '../env';
import { dayFromDevice, pageOf, paged, shiftDate } from '../db';
import { supplements } from './supplements';
import { editMoveFrom, LOG_COLS, logMoveFrom, removeMoveFrom, saveEatFrom, saveProteinGoal, toEat, toMove, type LogRow } from '../fitness';

/**
 * Fitness (`fitness`, Reflection, off on a new account; 2026-11-07): movement and a daily eating check-in, owner only like every tracker.
 * Its own prefix, so the module gate refuses it when the team switches Fitness off. Never read by brands, staff, the leaderboard, Club or
 * a badge; a coach sees the numbers only under the student's Reflection switch (coaching.ts), never a note. Nothing here pays.
 */
export const fitness = new Hono<AppEnv>();

/** Thirty-five days: the hero's seven, the thirty-day lines, and a little before them. */
const WINDOW_DAYS = 35;
/** The most rows one window or one month answers with; past it `more` is true and the screen says so. */
const WINDOW_ROWS = 600;

fitness.get('/', async (c) => {
  const userId = c.get('user').id;
  const day = dayFromDevice(c.req.query('day'));
  const from = shiftDate(day, -(WINDOW_DAYS - 1));
  // One round trip: the window's rows and the protein goal.
  const [rows, prefs] = (await c.env.DB.batch([
    c.env.DB.prepare(`SELECT ${LOG_COLS} FROM wellbeing_logs WHERE user_id = ? AND kind IN ('move', 'eat') AND date >= ? AND date <= ? ORDER BY date DESC, created_at DESC LIMIT ?`).bind(userId, from, day, WINDOW_ROWS + 1),
    c.env.DB.prepare('SELECT protein_goal_g FROM fitness_prefs WHERE user_id = ?').bind(userId),
  ])) as [D1Result<LogRow>, D1Result<{ protein_goal_g: number | null }>];
  const kept = rows.results.slice(0, WINDOW_ROWS);
  const moves = kept.filter((r) => r.kind === 'move').map(toMove);
  const weekFrom = shiftDate(day, -6);
  const res: FitnessResponse = {
    day,
    from,
    moves,
    eats: kept.filter((r) => r.kind === 'eat').map(toEat),
    weekMinutes: moves.filter((m) => m.date >= weekFrom).reduce((a, m) => a + m.minutes, 0),
    proteinGoal: prefs.results[0]?.protein_goal_g ?? null,
    more: rows.results.length > WINDOW_ROWS,
  };
  return c.json(res);
});

// One month for the calendar: every day's movement and eating.
fitness.get('/month', async (c) => {
  const month = c.req.query('month') ?? '';
  if (!MONTH_RE.test(month)) return c.json({ error: 'pick a month as YYYY-MM' }, 400);
  const rows = await c.env.DB.prepare(`SELECT ${LOG_COLS} FROM wellbeing_logs WHERE user_id = ? AND kind IN ('move', 'eat') AND date >= ? AND date <= ? ORDER BY date DESC, created_at DESC LIMIT ?`)
    .bind(c.get('user').id, `${month}-01`, `${month}-31`, WINDOW_ROWS + 1)
    .all<LogRow>();
  const kept = rows.results.slice(0, WINDOW_ROWS);
  const res: FitnessMonth = { month, moves: kept.filter((r) => r.kind === 'move').map(toMove), eats: kept.filter((r) => r.kind === 'eat').map(toEat), more: rows.results.length > WINDOW_ROWS };
  return c.json(res);
});

// Every movement log, newest first, a page at a time (prefix m).
fitness.get('/moves', async (c) => {
  const ask = pageOf(c, 'm');
  const rows = await c.env.DB.prepare(`SELECT ${LOG_COLS} FROM wellbeing_logs WHERE user_id = ? AND kind = 'move' ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`)
    .bind(c.get('user').id, ask.limit, ask.offset)
    .all<LogRow>();
  const pg = paged(rows.results, ask);
  const res: MovesPage = { moves: pg.items.map(toMove), page: pg.page };
  return c.json(res);
});

fitness.post('/move', (c) => logMoveFrom(c));
fitness.patch('/move/:id', (c) => editMoveFrom(c));
fitness.delete('/move/:id', (c) => removeMoveFrom(c));

fitness.put('/eat', (c) => saveEatFrom(c));
// The protein goal (2026-11-07): the goal alone, never the weight.
fitness.put('/protein-goal', (c) => saveProteinGoal(c));
// Supplements (2026-11-07): the person's own list, under the same prefix and gate.
fitness.route('/supplements', supplements);
fitness.delete('/eat/:id', async (c) => {
  const res = await c.env.DB.prepare("DELETE FROM wellbeing_logs WHERE id = ? AND user_id = ? AND kind = 'eat'").bind(c.req.param('id'), c.get('user').id).run();
  if (res.meta.changes === 0) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});
