import { Hono } from 'hono';
import { CARD_GAME_BY_KEY, REWARD_BY_KEY, REWARDS, unlockFor, type Redemption, type RewardsResponse } from '@kreators/shared';
import { haveFor } from '../unlocks';
import type { AppEnv } from '../env';
import { getUser, newId, nowIso, parseModules } from '../db';

export const rewards = new Hono<AppEnv>();

export interface RedemptionRow {
  id: string;
  user_id: string;
  reward_key: string;
  points: number;
  status: Redemption['status'];
  note: string;
  created_at: string;
  updated_at: string;
}

export function toRedemption(r: RedemptionRow): Redemption {
  return { id: r.id, rewardKey: r.reward_key, points: r.points, status: r.status, note: r.note, createdAt: r.created_at };
}

rewards.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const rows = await db
    .prepare('SELECT * FROM redemptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
    .bind(user.id)
    .all<RedemptionRow>();
  const owned = await db.prepare('SELECT game_key FROM card_unlocks WHERE user_id = ?').bind(user.id).all<{ game_key: string }>();
  const res: RewardsResponse = { points: user.points, games: owned.results.map((r) => r.game_key), rewards: [...REWARDS], redemptions: rows.results.map(toRedemption) };
  return c.json(res);
});

// Reserve a reward. Points leave the balance now; the thing itself ships later.
rewards.post('/:key/redeem', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const reward = REWARD_BY_KEY[c.req.param('key')];
  if (!reward) return c.json({ error: 'no such reward' }, 404);
  if (reward.game && (await db.prepare('SELECT 1 AS x FROM card_unlocks WHERE user_id = ? AND game_key = ?').bind(user.id, reward.game).first())) return c.json({ error: 'you already have this game' }, 409);
  // A game can ask for more than points: an xp floor and a badge. A super admin is never locked out.
  if (reward.game && CARD_GAME_BY_KEY[reward.game]) {
    const g = CARD_GAME_BY_KEY[reward.game]!;
    const gate = unlockFor({ minPoints: 0, minXp: g.minXp, badge: g.badge ?? '' }, await haveFor(db, user));
    if (!gate.ok) return c.json({ error: gate.why, unlock: gate }, 403);
  }
  if (user.points < reward.cost) return c.json({ error: `you need ${reward.cost - user.points} more points` }, 400);

  const now = nowIso();
  const id = newId();
  // A card game is not posted to anyone: it opens in the app for good, right away. It also switches the Games app on.
  if (reward.kind === 'unlock' && reward.game) {
    const mine = parseModules(user.modules);
    mine.cards = true;
    await db.batch([
      db
        .prepare('INSERT INTO redemptions (id, user_id, reward_key, points, status, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, user.id, reward.key, reward.cost, 'fulfilled', 'Unlocked', now, now),
      db.prepare('UPDATE users SET points = points - ?, modules = ? WHERE id = ? AND points >= ?').bind(reward.cost, JSON.stringify(mine), user.id, reward.cost),
      db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(user.id, -reward.cost, 'redeem', id, now),
      db.prepare('INSERT INTO card_unlocks (user_id, game_key, redemption_id, unlocked_at) VALUES (?, ?, ?, ?)').bind(user.id, reward.game, id, now),
    ]);
    const fresh = await getUser(db, user.id);
    const row = await db.prepare('SELECT * FROM redemptions WHERE id = ?').bind(id).first<RedemptionRow>();
    return c.json({ redemption: row ? toRedemption(row) : null, points: fresh?.points ?? user.points, game: reward.game }, 201);
  }
  await db.batch([
    db
      .prepare('INSERT INTO redemptions (id, user_id, reward_key, points, status, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, user.id, reward.key, reward.cost, 'reserved', '', now, now),
    db.prepare('UPDATE users SET points = points - ? WHERE id = ? AND points >= ?').bind(reward.cost, user.id, reward.cost),
    db
      .prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(user.id, -reward.cost, 'redeem', id, now),
  ]);
  const fresh = await getUser(db, user.id);
  const row = await db.prepare('SELECT * FROM redemptions WHERE id = ?').bind(id).first<RedemptionRow>();
  return c.json({ redemption: row ? toRedemption(row) : null, points: fresh?.points ?? user.points }, 201);
});

rewards.post('/redemptions/:id/cancel', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db
    .prepare('SELECT * FROM redemptions WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), user.id)
    .first<RedemptionRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.status !== 'reserved') return c.json({ error: 'only reserved rewards can be cancelled' }, 400);
  const now = nowIso();
  await db.batch([
    db.prepare("UPDATE redemptions SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(now, row.id),
    db.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(row.points, user.id),
    db
      .prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(user.id, row.points, 'refund', row.id, now),
  ]);
  const fresh = await getUser(db, user.id);
  return c.json({ ok: true, points: fresh?.points ?? user.points });
});
