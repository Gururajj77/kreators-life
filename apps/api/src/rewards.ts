import { SOCIAL_REWARDS, trustScore, type SocialAward, type SocialRewardKind, type TrustScore } from '@kreators/shared';
import { nowIso } from './db';

/**
 * Pay a social action once, within its daily cap. Xp goes through xp_events and points through
 * points_ledger, both under `social:<kind>`, with the thing it was for as the ref so nothing pays twice.
 */
export async function rewardSocial(db: D1Database, userId: string, kind: SocialRewardKind, ref: string): Promise<SocialAward> {
  const r = SOCIAL_REWARDS[kind];
  const source = `social:${kind}`;
  const now = nowIso();
  const dayStart = `${now.slice(0, 10)}T00:00:00`;
  const none: SocialAward = { xp: 0, points: 0 };
  if (r.xp > 0) {
    const [paid, today] = await Promise.all([
      db.prepare('SELECT 1 FROM xp_events WHERE user_id = ? AND source = ? AND source_id = ?').bind(userId, source, ref).first(),
      db.prepare('SELECT COUNT(*) AS n FROM xp_events WHERE user_id = ? AND source = ? AND created_at >= ?').bind(userId, source, dayStart).first<{ n: number }>(),
    ]);
    if (paid || (today?.n ?? 0) >= r.perDay) return none;
    await db.batch([
      db.prepare('UPDATE users SET xp = xp + ? WHERE id = ?').bind(r.xp, userId),
      db.prepare('INSERT INTO xp_events (user_id, relationship, source, source_id, amount, created_at) VALUES (?, NULL, ?, ?, ?, ?)').bind(userId, source, ref, r.xp, now),
    ]);
    return { xp: r.xp, points: 0 };
  }
  const [paid, today] = await Promise.all([
    db.prepare('SELECT 1 FROM points_ledger WHERE user_id = ? AND reason = ? AND ref = ?').bind(userId, source, ref).first(),
    db.prepare('SELECT COUNT(*) AS n FROM points_ledger WHERE user_id = ? AND reason = ? AND created_at >= ?').bind(userId, source, dayStart).first<{ n: number }>(),
  ]);
  if (paid || (today?.n ?? 0) >= r.perDay) return none;
  await db.batch([
    db.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(r.points, userId),
    db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(userId, r.points, source, ref, now),
  ]);
  return { xp: 0, points: r.points };
}

interface TrustRow { id: string; xp: number; best_streak: number; created_at: string; points_earned: number; sold: number; rating: number | null; honors: number }

/** Trust scores for several people in one query, built only from what each has earned. */
export async function trustForMany(db: D1Database, ids: string[]): Promise<Map<string, TrustScore>> {
  const out = new Map<string, TrustScore>();
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return out;
  const rows = await db
    .prepare(
      `SELECT u.id, u.xp, u.best_streak, u.created_at,
        (SELECT COALESCE(SUM(amount), 0) FROM points_ledger WHERE user_id = u.id AND amount > 0) AS points_earned,
        (SELECT COUNT(*) FROM orders WHERE owner_id = u.id AND status IN ('paid', 'test')) AS sold,
        (SELECT AVG(t.rating) FROM testimonials t JOIN products p ON p.id = t.product_id WHERE p.owner_id = u.id AND t.approved = 1) AS rating,
        (SELECT COUNT(*) FROM honors WHERE user_id = u.id) AS honors
       FROM users u WHERE u.id IN (${unique.map(() => '?').join(',')})`,
    )
    .bind(...unique)
    .all<TrustRow>();
  const now = Date.now();
  for (const r of rows.results) {
    const daysHere = Math.max(0, Math.floor((now - new Date(r.created_at).getTime()) / 86_400_000));
    out.set(r.id, trustScore({ xp: r.xp, pointsEarned: r.points_earned, bestStreak: r.best_streak, daysHere, sold: r.sold, rating: r.rating, honors: r.honors }));
  }
  return out;
}

export async function trustFor(db: D1Database, id: string): Promise<TrustScore> {
  return (await trustForMany(db, [id])).get(id) ?? trustScore({ xp: 0, pointsEarned: 0, bestStreak: 0, daysHere: 0, sold: 0, rating: null, honors: 0 });
}
