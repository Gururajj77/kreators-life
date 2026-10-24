import { Hono } from 'hono';
import { RELATIONSHIPS } from '@kreators/shared';
import type { AppEnv } from '../env';
import { newId, nowIso } from '../db';

/**
 * Local only: fill the signed-in person's own account with two weeks of believable activity so
 * every chart has something to draw. Refused unless DEMO_SEED is set in .dev.vars, and never
 * touches another account. Running it again replaces the demo rows rather than stacking them.
 */
export const demo = new Hono<AppEnv>();

const TAG = 'demo';
const MOOD_WAVE = [3, 2, 4, 3, 5, 4, 3, 2, 3, 4, 4, 5, 3, 4];
const SLEEP_WAVE = [6.5, 7, 5.5, 8, 7.5, 6, 7, 6.5, 7.5, 8, 6, 7, 7.5, 6.8];
const STRESS_WAVE = [2, 4, 3, 1, 2, 3, 4, 2, 2, 1, 3, 2, 1, 2];
const TASK_TITLES = ['Reply to the brand brief', 'Edit the reel', 'Call home', 'Walk without the phone', 'Plan the week', 'Write the hook', 'Thank one person', 'Ten minutes of nothing', 'Send the invoice', 'Film the intro', 'Read for twenty minutes', 'Water, stretch, sit', 'Draft the pitch', 'Sleep by eleven'];

demo.post('/seed', async (c) => {
  if (!c.env.DEMO_SEED) return c.json({ error: 'not here' }, 404);
  const db = c.env.DB;
  const user = c.get('user');
  // The person's local date, so "today" on the seed matches "today" on their screen. The Worker itself runs in UTC.
  const body = await c.req.json<{ date?: string }>().catch(() => ({}) as { date?: string });
  const today = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? new Date(`${body.date}T12:00:00`) : new Date();
  const day = (back: number) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const at = (back: number, hour: number) => `${day(back)}T${String(hour).padStart(2, '0')}:${String((back * 7) % 60).padStart(2, '0')}:00.000Z`;

  // Clear what an earlier run left, so the numbers stay the same size.
  await db.batch([
    db.prepare("DELETE FROM spark_completions WHERE user_id = ? AND created_at IN (SELECT created_at FROM xp_events WHERE user_id = ? AND source = 'spark' AND source_id = ?)").bind(user.id, user.id, TAG),
    db.prepare("DELETE FROM xp_events WHERE user_id = ? AND source_id = ?").bind(user.id, TAG),
    db.prepare("DELETE FROM nodes WHERE user_id = ? AND note = ?").bind(user.id, TAG),
    db.prepare("DELETE FROM wellbeing_logs WHERE user_id = ? AND extra LIKE '%\"demo\":true%'").bind(user.id),
    db.prepare("DELETE FROM journal_entries WHERE user_id = ? AND stressors = ?").bind(user.id, `["${TAG}"]`),
    db.prepare("DELETE FROM finance_transactions WHERE user_id = ? AND ref = ?").bind(user.id, TAG),
    db.prepare("DELETE FROM finance_goals WHERE user_id = ? AND title LIKE 'Demo:%'").bind(user.id),
    db.prepare("DELETE FROM orders WHERE owner_id = ? AND variant = ?").bind(user.id, TAG),
    db.prepare("DELETE FROM products WHERE owner_id = ? AND description = ?").bind(user.id, TAG),
  ]);

  const stmts: D1PreparedStatement[] = [];
  let totalXp = 0;
  const rels = RELATIONSHIPS.map((r) => r.key);

  // Fourteen days of the daily three: a check-in most days, a spark most days, one or two tasks.
  for (let back = 13; back >= 0; back -= 1) {
    const rel = rels[back % rels.length]!;
    const skip = back === 9 || back === 4; // two missed days, so the line has a dip
    if (skip) continue;
    stmts.push(db.prepare("INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, NULL, 'checkin', ?, 10, ?)").bind(user.id, TAG, at(back, 8)));
    totalXp += 10;
    if (back % 3 !== 1) {
      stmts.push(db.prepare("INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, ?, 'spark', ?, 15, ?)").bind(user.id, rel, TAG, at(back, 9)));
      stmts.push(db.prepare("INSERT OR IGNORE INTO spark_completions (user_id, date, relationship, created_at) VALUES (?, ?, ?, ?)").bind(user.id, day(back), rel, at(back, 9)));
      totalXp += 15;
    }
    const tasks = back % 4 === 0 ? 2 : 1;
    for (let t = 0; t < tasks; t += 1) {
      const id = newId();
      stmts.push(
        db
          .prepare("INSERT INTO nodes (id, user_id, kind, parent_id, relationship, title, note, status, xp, due_date, completed_at, sort_order, created_at, updated_at) VALUES (?, ?, 'task', NULL, ?, ?, ?, 'done', 20, ?, ?, 0, ?, ?)")
          .bind(id, user.id, rel, TASK_TITLES[(back + t) % TASK_TITLES.length], TAG, day(back), at(back, 18 + t), at(back, 7), at(back, 18 + t)),
      );
      stmts.push(db.prepare("INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, ?, 'task', ?, 20, ?)").bind(user.id, rel, TAG, at(back, 18 + t)));
      stmts.push(db.prepare("INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, ?, 'done', ?, 12, ?)").bind(user.id, rel, TAG, at(back, 18 + t)));
      totalXp += 32;
    }
  }

  // Trackers: mood, sleep and stress every day, mindful minutes on alternate days, a walk twice a week.
  for (let back = 13; back >= 0; back -= 1) {
    const i = 13 - back;
    stmts.push(db.prepare("INSERT INTO wellbeing_logs (id, user_id, kind, date, value, extra, note, created_at) VALUES (?, ?, 'mood', ?, ?, '{\"demo\":true}', '', ?)").bind(newId(), user.id, day(back), MOOD_WAVE[i], at(back, 21)));
    stmts.push(db.prepare("INSERT INTO wellbeing_logs (id, user_id, kind, date, value, extra, note, created_at) VALUES (?, ?, 'sleep', ?, ?, ?, '', ?)").bind(newId(), user.id, day(back), SLEEP_WAVE[i], JSON.stringify({ quality: 2 + (i % 3), demo: true }), at(back, 8)));
    stmts.push(db.prepare("INSERT INTO wellbeing_logs (id, user_id, kind, date, value, extra, note, created_at) VALUES (?, ?, 'stress', ?, ?, ?, '', ?)").bind(newId(), user.id, day(back), STRESS_WAVE[i], JSON.stringify({ stressors: STRESS_WAVE[i]! >= 3 ? ['Work', 'Money'] : ['Work'], demo: true }), at(back, 20)));
    if (i % 2 === 0) stmts.push(db.prepare("INSERT INTO wellbeing_logs (id, user_id, kind, date, value, extra, note, created_at) VALUES (?, ?, 'mindful', ?, ?, '{\"kind\":\"breathe\",\"demo\":true}', '', ?)").bind(newId(), user.id, day(back), 3 + (i % 4) * 2, at(back, 7)));
    if (i % 3 === 0) stmts.push(db.prepare("INSERT INTO wellbeing_logs (id, user_id, kind, date, value, extra, note, created_at) VALUES (?, ?, 'move', ?, ?, '{\"demo\":true}', '', ?)").bind(newId(), user.id, day(back), 30 + (i % 2) * 15, at(back, 17)));
  }

  // Journal: five entries across the fortnight.
  const entries: [number, string, string, number, number][] = [
    [12, 'Slow start', 'Did not want to film. Filmed anyway. The second take was the one.', 3, 3],
    [9, 'Heavy', 'Invoice still unpaid. Wrote the chaser and closed the laptop.', 2, 4],
    [6, 'Good day', 'Shot the whole batch before lunch and walked after.', 4, 2],
    [3, 'Quiet', 'Called home. Nothing big, which was the point.', 4, 1],
    [1, 'Nearly there', 'The reel is cut. Sleep first, post tomorrow.', 5, 2],
  ];
  for (const [back, title, body, emotion, stress] of entries) {
    stmts.push(db.prepare('INSERT INTO journal_entries (id, user_id, title, body, emotion, stress, stressors, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(newId(), user.id, title, body, emotion, stress, `["${TAG}"]`, at(back, 22), at(back, 22)));
  }

  // Finance: six months of in and out, and an earn goal.
  const months = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (5 - k), 5);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const income = [1800000, 2400000, 2100000, 3200000, 2800000, 3500000];
  const spend = [620000, 710000, 540000, 890000, 760000, 799900];
  months.forEach((m, k) => {
    stmts.push(db.prepare("INSERT INTO finance_transactions (id, user_id, kind, amount_cents, currency, category, counterparty, note, date, source, ref, splits_json, created_at) VALUES (?, ?, 'income', ?, 'INR', 'Brand deal', 'Deskly', 'Demo', ?, 'manual', ?, '[]', ?)").bind(newId(), user.id, Math.round(income[k]! * 0.7), `${m}-05`, TAG, nowIso()));
    stmts.push(db.prepare("INSERT INTO finance_transactions (id, user_id, kind, amount_cents, currency, category, counterparty, note, date, source, ref, splits_json, created_at) VALUES (?, ?, 'income', ?, 'INR', 'Sessions', 'Various', 'Demo', ?, 'manual', ?, '[]', ?)").bind(newId(), user.id, Math.round(income[k]! * 0.3), `${m}-18`, TAG, nowIso()));
    stmts.push(db.prepare("INSERT INTO finance_transactions (id, user_id, kind, amount_cents, currency, category, counterparty, note, date, source, ref, splits_json, created_at) VALUES (?, ?, 'expense', ?, 'INR', 'Software', 'Adobe', 'Demo', ?, 'manual', ?, '[]', ?)").bind(newId(), user.id, Math.round(spend[k]! * 0.4), `${m}-02`, TAG, nowIso()));
    stmts.push(db.prepare("INSERT INTO finance_transactions (id, user_id, kind, amount_cents, currency, category, counterparty, note, date, source, ref, splits_json, created_at) VALUES (?, ?, 'expense', ?, 'INR', 'Team', 'Editor Raj', 'Demo', ?, 'manual', ?, '[]', ?)").bind(newId(), user.id, Math.round(spend[k]! * 0.6), `${m}-20`, TAG, nowIso()));
  });
  stmts.push(db.prepare("INSERT INTO finance_goals (id, user_id, title, kind, target_cents, saved_cents, start_date, deadline, created_at) VALUES (?, ?, 'Demo: a lakh this quarter', 'earn', 10000000, 0, ?, NULL, ?)").bind(newId(), user.id, day(60), nowIso()));

  // Shop: one live download with orders spread over the fortnight.
  const productId = newId();
  stmts.push(db.prepare("INSERT INTO products (id, owner_id, kind, title, description, price_points, price_cents, currency, status, cover, sort_order, created_at, updated_at) VALUES (?, ?, 'digital', 'Demo preset pack', ?, 40, 0, 'INR', 'live', '🎞️', 99, ?, ?)").bind(productId, user.id, TAG, at(13, 10), at(13, 10)));
  const orderDays = [12, 11, 11, 9, 8, 8, 8, 6, 5, 3, 3, 2, 1, 1, 0];
  for (const back of orderDays) {
    stmts.push(db.prepare("INSERT INTO orders (id, buyer_id, product_id, owner_id, points, cents, currency, status, variant, created_at) VALUES (?, ?, ?, ?, 40, 0, 'INR', 'test', ?, ?)").bind(newId(), user.id, productId, user.id, TAG, at(back, 12)));
  }

  stmts.push(db.prepare('UPDATE users SET xp = xp + ?, streak = CASE WHEN streak < 3 THEN 3 ELSE streak END WHERE id = ?').bind(totalXp, user.id));
  // D1 batches are capped; send in slices.
  for (let i = 0; i < stmts.length; i += 40) await db.batch(stmts.slice(i, i + 40));
  return c.json({ ok: true, xp: totalXp, rows: stmts.length });
});
