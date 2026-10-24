import type { Env } from './env';
import { nowIso } from './db';
import { runSequences } from './routes/growth';
import { runRecurring } from './routes/finance';
import { matchDueCircles } from './routes/circles';
import { fetchMetrics } from './social';

/** Every fifteen minutes: sequence messages, then fresh numbers for posts and reward submissions where a platform lets us read them. */
export async function runScheduled(env: Env): Promise<{ sequences: number; recurring: number; circles: number; content: number; submissions: number }> {
  const db = env.DB;
  const sequences = await runSequences(db);
  const recurring = await runRecurring(db);
  const circles = await matchDueCircles(db);
  // Money orders nobody paid for within half an hour are closed so the product is buyable again.
  await db.prepare("UPDATE orders SET status = 'expired' WHERE status = 'pending' AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 minutes')").run();
  let content = 0;
  const stale = await db.prepare("SELECT id, url FROM content_items WHERE platform = 'youtube' AND (synced_at IS NULL OR synced_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-6 hours')) LIMIT 20").all<{ id: string; url: string }>();
  for (const item of stale.results) {
    const r = await fetchMetrics(item.url, env);
    if (!r.reading) break;
    await db.prepare('UPDATE content_items SET views = ?, likes = ?, comments = ?, synced_at = ? WHERE id = ?').bind(r.reading.views, r.reading.likes, r.reading.comments, nowIso(), item.id).run();
    content += 1;
  }
  let submissions = 0;
  const subs = await db
    .prepare("SELECT s.id, s.url FROM bounty_submissions s WHERE s.platform = 'youtube' AND s.status IN ('submitted','verified') AND NOT EXISTS (SELECT 1 FROM social_metrics m WHERE m.submission_id = s.id AND m.source = 'auto' AND m.fetched_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-6 hours')) LIMIT 20")
    .all<{ id: string; url: string }>();
  for (const s of subs.results) {
    const r = await fetchMetrics(s.url, env);
    if (!r.reading) break;
    const now = nowIso();
    await db.batch([
      db.prepare('INSERT INTO social_metrics (id, submission_id, views, likes, comments, shares, source, note, recorded_by, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)').bind(crypto.randomUUID(), s.id, r.reading.views, r.reading.likes, r.reading.comments, 0, 'auto', r.why, now),
      db.prepare('UPDATE bounty_submissions SET latest_views = ?, latest_engagement = ?, updated_at = ? WHERE id = ?').bind(r.reading.views, r.reading.likes + r.reading.comments, now, s.id),
    ]);
    submissions += 1;
  }
  return { sequences, recurring, circles, content, submissions };
}
