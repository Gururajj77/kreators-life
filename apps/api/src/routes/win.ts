import { Hono } from 'hono';
import { bountyPayout, detectPlatform, type Bounty, type BountySubmission, type SocialMetric } from '@kreators/shared';
import type { AppEnv } from '../env';
import { audit, can, nameOf, newId, notify, nowIso, num, oneOf, str } from '../db';
import { fetchMetrics } from '../social';

/** Win: content rewards. A brand funds a pool; creators post videos; verified views turn into points. */
export const win = new Hono<AppEnv>();

interface BRow {
  id: string; organization_name: string | null; brand_name: string; title: string; brief: string; deliverable: string; budget_points: number; rate_per_thousand: number; max_payout_points: number; min_views: number; reward_rule: string; eligibility: string; platform: string; starts_at: string; ends_at: string; status: Bounty['status']; featured: number; version: number; created_at: string; submissions: number; paid_points: number;
}
const SELECT = `SELECT b.*, o.name AS organization_name,
  (SELECT COUNT(*) FROM bounty_submissions s WHERE s.bounty_id = b.id) AS submissions,
  (SELECT COALESCE(SUM(payout_points), 0) FROM bounty_submissions s WHERE s.bounty_id = b.id AND s.status = 'paid') AS paid_points
  FROM bounties b LEFT JOIN organizations o ON o.id = b.organization_id`;
interface SRow { id: string; bounty_id: string; bounty_title: string; user_id: string; user_name: string; url: string; platform: string; status: BountySubmission['status']; latest_views: number; latest_engagement: number; evidence_views: number | null; evidence_note: string; payout_points: number; reviewer_id: string | null; dispute_note: string; created_at: string; updated_at: string; rate_per_thousand: number; max_payout_points: number; min_views: number }
const S_SELECT = 'SELECT s.*, u.display_name AS user_name, b.title AS bounty_title, b.rate_per_thousand, b.max_payout_points, b.min_views FROM bounty_submissions s JOIN users u ON u.id = s.user_id JOIN bounties b ON b.id = s.bounty_id';
interface MRow { id: string; submission_id: string; views: number; likes: number; comments: number; shares: number; source: SocialMetric['source']; note: string; fetched_at: string }
const toMetric = (m: MRow): SocialMetric => ({ id: m.id, views: m.views, likes: m.likes, comments: m.comments, shares: m.shares, source: m.source, note: m.note, fetchedAt: m.fetched_at });
const rule = (r: Pick<SRow, 'rate_per_thousand' | 'max_payout_points' | 'min_views'>) => ({ ratePerThousand: r.rate_per_thousand, maxPayoutPoints: r.max_payout_points, minViews: r.min_views });
const toS = (r: SRow, metrics: MRow[] = []): BountySubmission => ({
  id: r.id, bountyId: r.bounty_id, bountyTitle: r.bounty_title, userId: r.user_id, userName: nameOf({ display_name: r.user_name }), url: r.url, platform: detectPlatform(r.url), status: r.status, latestViews: r.latest_views, latestEngagement: r.latest_engagement,
  evidenceViews: r.evidence_views, evidenceNote: r.evidence_note, payoutPoints: r.payout_points, estimatedPoints: bountyPayout(r.evidence_views ?? r.latest_views, rule(r)), disputeNote: r.dispute_note, metrics: metrics.filter((m) => m.submission_id === r.id).map(toMetric), createdAt: r.created_at, updatedAt: r.updated_at,
});
const toB = (r: BRow, mine: BountySubmission | null): Bounty => ({
  id: r.id, organizationName: r.organization_name ?? 'Kreators', brandName: r.brand_name || r.organization_name || 'Kreators', title: r.title, brief: r.brief, deliverable: r.deliverable, budgetPoints: r.budget_points, ratePerThousand: r.rate_per_thousand, maxPayoutPoints: r.max_payout_points, minViews: r.min_views, rewardRule: r.reward_rule, eligibility: r.eligibility, platform: r.platform,
  startsAt: r.starts_at, endsAt: r.ends_at, status: r.status, featured: r.featured === 1, version: r.version, submissions: r.submissions, paidPoints: r.paid_points, mine, createdAt: r.created_at,
});

async function metricsFor(db: D1Database, submissionIds: string[]): Promise<MRow[]> {
  if (submissionIds.length === 0) return [];
  const rows = await db.prepare(`SELECT * FROM social_metrics WHERE submission_id IN (${submissionIds.map(() => '?').join(',')}) ORDER BY fetched_at`).bind(...submissionIds).all<MRow>();
  return rows.results;
}

win.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const reviewer = can(user, 'review');
  const finance = can(user, 'finance');
  const [bs, mine, queue] = await Promise.all([
    db.prepare(`${SELECT} WHERE b.status = 'open' OR b.id IN (SELECT bounty_id FROM bounty_submissions WHERE user_id = ?) ORDER BY b.featured DESC, b.ends_at LIMIT 100`).bind(user.id).all<BRow>(),
    db.prepare(`${S_SELECT} WHERE s.user_id = ? ORDER BY s.created_at DESC`).bind(user.id).all<SRow>(),
    reviewer || finance ? db.prepare(`${S_SELECT} WHERE s.status IN ('submitted','verified','disputed') ORDER BY s.created_at`).all<SRow>() : Promise.resolve({ results: [] as SRow[] }),
  ]);
  const metrics = await metricsFor(db, [...mine.results, ...queue.results].map((s) => s.id));
  const byB = new Map(mine.results.map((s) => [s.bounty_id, toS(s, metrics)]));
  const earned = mine.results.filter((s) => s.status === 'paid').reduce((a, s) => a + s.payout_points, 0);
  return c.json({ bounties: bs.results.map((b) => toB(b, byB.get(b.id) ?? null)), mine: mine.results.map((s) => toS(s, metrics)), queue: queue.results.map((s) => toS(s, metrics)), earned, reviewer, finance, canCreate: reviewer || can(user, 'talent') });
});

win.get('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const b = await db.prepare(`${SELECT} WHERE b.id = ?`).bind(c.req.param('id')).first<BRow>();
  if (!b) return c.json({ error: 'not found' }, 404);
  const mine = await db.prepare(`${S_SELECT} WHERE s.bounty_id = ? AND s.user_id = ?`).bind(b.id, user.id).first<SRow>();
  const metrics = await metricsFor(db, mine ? [mine.id] : []);
  const staff = can(user, 'review') || can(user, 'finance');
  const all = staff ? await db.prepare(`${S_SELECT} WHERE s.bounty_id = ? ORDER BY s.latest_views DESC`).bind(b.id).all<SRow>() : { results: [] as SRow[] };
  const allMetrics = staff ? await metricsFor(db, all.results.map((s) => s.id)) : [];
  // The leaderboard of this reward shows names and views only, never payouts.
  const board = await db.prepare('SELECT u.display_name, s.latest_views, s.status FROM bounty_submissions s JOIN users u ON u.id = s.user_id WHERE s.bounty_id = ? AND s.status != \'rejected\' ORDER BY s.latest_views DESC LIMIT 10').bind(b.id).all<{ display_name: string; latest_views: number; status: string }>();
  return c.json({ bounty: toB(b, mine ? toS(mine, metrics) : null), submissions: all.results.map((s) => toS(s, allMetrics)), board: board.results.map((r) => ({ name: nameOf(r), views: r.latest_views, status: r.status })) });
});

// Staff launch a reward. Brands launch through Army or the admin's listings page.
win.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (!can(user, 'review') && !can(user, 'talent')) return c.json({ error: 'staff launch content rewards' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const title = str(body.title, 120);
  if (!title) return c.json({ error: 'title required' }, 400);
  const id = newId();
  const now = nowIso();
  await db
    .prepare("INSERT INTO bounties (id, created_by, organization_id, title, brief, budget_points, reward_rule, eligibility, platform, starts_at, ends_at, status, version, created_at, brand_name, deliverable, rate_per_thousand, max_payout_points, min_views, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 1, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, user.id, str(body.organizationId, 64) || null, title, str(body.brief, 5000), num(body.budgetPoints, 0, 0) ?? 0, str(body.rewardRule, 1000), str(body.eligibility, 1000), str(body.platform, 60), str(body.startsAt, 40) || now, str(body.endsAt, 40) || new Date(Date.now() + 30 * 86_400_000).toISOString(), now, str(body.brandName, 80), str(body.deliverable, 80, 'Short video') || 'Short video', num(body.ratePerThousand, 0, 0) ?? 0, num(body.maxPayoutPoints, 0, 0) ?? 0, num(body.minViews, 1000, 0) ?? 1000, body.featured === true ? 1 : 0)
    .run();
  await audit(db, user.id, 'bounty.create', 'bounty', id, '', title);
  return c.json({ ok: true, id }, 201);
});

// Submit the public link to your video. One per person per reward; resubmitting replaces the link.
win.post('/:id/submit', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const b = await db.prepare(`${SELECT} WHERE b.id = ? AND b.status = 'open'`).bind(c.req.param('id')).first<BRow>();
  if (!b) return c.json({ error: 'this reward is not open' }, 404);
  if (new Date(b.ends_at).getTime() < Date.now()) return c.json({ error: 'the window has closed' }, 400);
  const body = await c.req.json<{ url?: string }>().catch(() => ({}) as { url?: string });
  const url = str(body.url, 500);
  if (!/^https?:\/\//.test(url)) return c.json({ error: 'a public link to your post' }, 400);
  const platform = detectPlatform(url);
  if (b.platform && b.platform.toLowerCase() !== 'any' && !b.platform.toLowerCase().includes(platform)) return c.json({ error: `this reward wants ${b.platform} posts` }, 400);
  const now = nowIso();
  await db
    .prepare("INSERT INTO bounty_submissions (id, bounty_id, user_id, url, platform, status, latest_views, latest_engagement, evidence_views, evidence_note, payout_points, reviewer_id, dispute_note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'submitted', 0, 0, NULL, '', 0, NULL, '', ?, ?) ON CONFLICT(bounty_id, user_id) DO UPDATE SET url = excluded.url, platform = excluded.platform, status = 'submitted', updated_at = excluded.updated_at")
    .bind(newId(), b.id, user.id, url, platform, now, now)
    .run();
  const s = await db.prepare(`${S_SELECT} WHERE s.bounty_id = ? AND s.user_id = ?`).bind(b.id, user.id).first<SRow>();
  // Try to read the numbers right away where the platform allows it.
  if (s) await recordAuto(db, c.env, s);
  const fresh = await db.prepare(`${S_SELECT} WHERE s.id = ?`).bind(s?.id ?? '').first<SRow>();
  return c.json({ submission: fresh ? toS(fresh, await metricsFor(db, [fresh.id])) : null }, 201);
});

async function recordAuto(db: D1Database, env: { YOUTUBE_API_KEY?: string }, s: SRow): Promise<{ ok: boolean; why: string }> {
  const r = await fetchMetrics(s.url, env);
  if (!r.reading) return { ok: false, why: r.why };
  await record(db, s.id, r.reading, 'auto', r.why, null);
  return { ok: true, why: r.why };
}

async function record(db: D1Database, submissionId: string, m: { views: number; likes: number; comments: number; shares: number }, source: SocialMetric['source'], note: string, by: string | null) {
  const now = nowIso();
  await db.batch([
    db.prepare('INSERT INTO social_metrics (id, submission_id, views, likes, comments, shares, source, note, recorded_by, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(newId(), submissionId, m.views, m.likes, m.comments, m.shares, source, note, by, now),
    db.prepare('UPDATE bounty_submissions SET latest_views = ?, latest_engagement = ?, updated_at = ? WHERE id = ?').bind(m.views, m.likes + m.comments + m.shares, now, submissionId),
  ]);
}

// Refresh or report the numbers. Auto where possible; otherwise the creator reports and a reviewer confirms.
win.post('/submissions/:id/metrics', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const s = await db.prepare(`${S_SELECT} WHERE s.id = ?`).bind(c.req.param('id')).first<SRow>();
  if (!s) return c.json({ error: 'not found' }, 404);
  const staff = can(user, 'review');
  if (s.user_id !== user.id && !staff) return c.json({ error: 'not your submission' }, 403);
  if (s.status === 'paid') return c.json({ error: 'already paid' }, 400);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const views = num(body.views, null, 0);
  let why = '';
  if (views === null) {
    const r = await recordAuto(db, c.env, s);
    if (!r.ok) return c.json({ error: r.why }, 400);
    why = r.why;
  } else {
    const last = await db.prepare('SELECT MAX(fetched_at) AS t FROM social_metrics WHERE submission_id = ? AND source = ?').bind(s.id, staff ? 'staff' : 'manual').first<{ t: string | null }>();
    if (!staff && last?.t && Date.now() - new Date(last.t).getTime() < 6 * 3600_000) return c.json({ error: 'you can report new numbers every six hours' }, 429);
    await record(db, s.id, { views, likes: num(body.likes, 0, 0) ?? 0, comments: num(body.comments, 0, 0) ?? 0, shares: num(body.shares, 0, 0) ?? 0 }, staff ? 'staff' : 'manual', str(body.note, 500), user.id);
    if (staff) await db.prepare('UPDATE bounty_submissions SET evidence_views = ?, reviewer_id = ? WHERE id = ?').bind(views, user.id, s.id).run();
    why = staff ? 'confirmed by a reviewer' : 'reported, waiting for a reviewer to confirm';
  }
  const fresh = await db.prepare(`${S_SELECT} WHERE s.id = ?`).bind(s.id).first<SRow>();
  return c.json({ submission: fresh ? toS(fresh, await metricsFor(db, [fresh.id])) : null, why });
});

// Verification first, then a finance payout. Nothing is automatic, and nothing exceeds the pool.
win.post('/submissions/:id/review', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const s = await db.prepare(`${S_SELECT} WHERE s.id = ?`).bind(c.req.param('id')).first<SRow>();
  if (!s) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const status = oneOf(body.status, ['verified', 'rejected', 'paid'] as const, 'verified');
  if (status === 'paid') {
    if (!can(user, 'finance')) return c.json({ error: 'finance pays out' }, 403);
    if (s.status !== 'verified') return c.json({ error: 'verify it first' }, 400);
    const b = await db.prepare(`${SELECT} WHERE b.id = ?`).bind(s.bounty_id).first<BRow>();
    if (!b) return c.json({ error: 'not found' }, 404);
    const suggested = s.payout_points > 0 ? s.payout_points : bountyPayout(s.evidence_views ?? 0, rule(s));
    const points = num(body.payoutPoints, suggested, 0) ?? suggested;
    if (points <= 0) return c.json({ error: 'nothing to pay at these numbers' }, 400);
    const left = b.budget_points > 0 ? b.budget_points - b.paid_points : Number.MAX_SAFE_INTEGER;
    if (points > left) return c.json({ error: `only ${Math.max(0, left)} points are left in this pool` }, 400);
    const now = nowIso();
    await db.batch([
      db.prepare("UPDATE bounty_submissions SET status = 'paid', payout_points = ?, reviewer_id = ?, updated_at = ? WHERE id = ? AND status = 'verified'").bind(points, user.id, now, s.id),
      db.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(points, s.user_id),
      db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(s.user_id, points, 'bounty', s.id, now),
    ]);
    if (b.budget_points > 0 && b.paid_points + points >= b.budget_points) await db.prepare("UPDATE bounties SET status = 'paid' WHERE id = ?").bind(b.id).run();
    await audit(db, user.id, 'bounty.payout', 'bounty_submission', s.id, s.payout_points, points);
    await notify(db, s.user_id, 'win', `Paid: ${s.bounty_title}`, `${points} points for ${s.evidence_views ?? s.latest_views} verified views`, '/win');
    return c.json({ ok: true, points });
  }
  if (!can(user, 'review')) return c.json({ error: 'reviewers verify submissions' }, 403);
  const evidenceViews = num(body.evidenceViews, s.evidence_views ?? s.latest_views, 0);
  const payout = status === 'verified' ? (num(body.payoutPoints, null, 0) ?? bountyPayout(evidenceViews ?? 0, rule(s))) : 0;
  await db.prepare('UPDATE bounty_submissions SET status = ?, evidence_views = ?, evidence_note = ?, payout_points = ?, reviewer_id = ?, updated_at = ? WHERE id = ?')
    .bind(status, evidenceViews, str(body.evidenceNote, 1000, s.evidence_note), payout, user.id, nowIso(), s.id)
    .run();
  if (evidenceViews !== null && evidenceViews !== s.latest_views) await record(db, s.id, { views: evidenceViews, likes: 0, comments: 0, shares: 0 }, 'staff', 'confirmed during review', user.id);
  await audit(db, user.id, 'bounty.review', 'bounty_submission', s.id, s.status, status);
  await notify(db, s.user_id, 'win', `${s.bounty_title}: ${status}`, status === 'verified' ? `${payout} points queued for payout` : str(body.evidenceNote, 160), '/win');
  return c.json({ ok: true });
});

win.post('/submissions/:id/dispute', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ note?: string }>().catch(() => ({}) as { note?: string });
  const res = await db.prepare("UPDATE bounty_submissions SET status = 'disputed', dispute_note = ?, updated_at = ? WHERE id = ? AND user_id = ? AND status = 'rejected'").bind(str(body.note, 1000), nowIso(), c.req.param('id'), user.id).run();
  if (res.meta.changes === 0) return c.json({ error: 'only a rejected submission of yours can be disputed' }, 400);
  return c.json({ ok: true });
});

// Brands make a campaign public so it shows on the site. Staff and the owning brand can.
win.post('/campaigns/:id/public', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const camp = await db.prepare('SELECT id, organization_id FROM campaigns WHERE id = ?').bind(c.req.param('id')).first<{ id: string; organization_id: string }>();
  if (!camp) return c.json({ error: 'not found' }, 404);
  const member = await db.prepare("SELECT 1 FROM organization_members WHERE organization_id = ? AND user_id = ? AND status = 'active'").bind(camp.organization_id, user.id).first();
  if (!member && !can(user, 'talent')) return c.json({ error: 'not your organization' }, 403);
  const body = await c.req.json<{ public?: boolean }>().catch(() => ({}) as { public?: boolean });
  await db.prepare('UPDATE campaigns SET public = ? WHERE id = ?').bind(body.public === false ? 0 : 1, camp.id).run();
  return c.json({ ok: true });
});
