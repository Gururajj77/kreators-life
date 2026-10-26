import { Hono } from 'hono';
import { CONTENT_KINDS, LINK_SOURCES, detectPlatform, type ContentItem, type Customer, type DmAutomation, type DmRequest, type DmSend, type Funnel, type FunnelStep, type PayoutSummary, type Sequence, type TrackedLink } from '@kreators/shared';
import type { AppEnv, Env } from '../env';
import { nameOf, newId, notify, nowIso, num, oneOf, parseList, randomCode, str, pageOf, paged } from '../db';
import { fetchMetrics } from '../social';
import { providerFor } from '../payments';
import { logEvent, sendEmail, track } from '../ops';
import { ORDER_SELECT, toOrder, type OrderRow } from './studio';

/** The creator's growth tools: tracked links, content attribution, Auto-DM, funnels, sequences, customers, refunds and payouts. Mounted at /studio. */
export const growth = new Hono<AppEnv>();

// ---- tracked links
interface LinkRow { id: string; code: string; product_id: string | null; product_title: string | null; source_type: TrackedLink['sourceType']; content_item_id: string | null; automation_id: string | null; label: string; created_at: string; clicks: number; checkouts: number; sales: number; revenue: number }
const LINK_SELECT = `SELECT l.*, p.title AS product_title,
  (SELECT COUNT(*) FROM link_clicks k WHERE k.link_id = l.id) AS clicks,
  (SELECT COUNT(*) FROM orders o WHERE o.source_link_id = l.id) AS checkouts,
  (SELECT COUNT(*) FROM orders o WHERE o.source_link_id = l.id AND o.status IN ('paid','test')) AS sales,
  (SELECT COALESCE(SUM(points),0) FROM orders o WHERE o.source_link_id = l.id AND o.status IN ('paid','test')) AS revenue
  FROM tracked_links l LEFT JOIN products p ON p.id = l.product_id`;
const toLink = (r: LinkRow): TrackedLink => ({ id: r.id, code: r.code, productId: r.product_id, productTitle: r.product_title, sourceType: r.source_type, contentItemId: r.content_item_id, automationId: r.automation_id, label: r.label, clicks: r.clicks, checkouts: r.checkouts, sales: r.sales, revenuePoints: r.revenue, createdAt: r.created_at });

growth.get('/links', async (c) => {
  const ask = pageOf(c);
  const rows = await c.env.DB.prepare(`${LINK_SELECT} WHERE l.owner_id = ? ORDER BY l.created_at DESC LIMIT ? OFFSET ?`).bind(c.get('user').id, ask.limit, ask.offset).all<LinkRow>();
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, links: pg.items.map(toLink) });
});

async function createLink(db: D1Database, ownerId: string, body: { productId?: string | null; sourceType?: string; contentItemId?: string | null; automationId?: string | null; label?: string }): Promise<LinkRow | null> {
  const productId = str(body.productId, 64) || null;
  if (productId) {
    const own = await db.prepare('SELECT 1 FROM products WHERE id = ? AND owner_id = ?').bind(productId, ownerId).first();
    if (!own) return null;
  }
  const id = newId();
  let code = randomCode(6).toLowerCase();
  for (let i = 0; i < 5; i += 1) {
    const taken = await db.prepare('SELECT 1 FROM tracked_links WHERE code = ?').bind(code).first();
    if (!taken) break;
    code = randomCode(6).toLowerCase();
  }
  await db
    .prepare('INSERT INTO tracked_links (id, owner_id, code, product_id, source_type, content_item_id, automation_id, label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, ownerId, code, productId, oneOf(body.sourceType, LINK_SOURCES, 'other'), str(body.contentItemId, 64) || null, str(body.automationId, 64) || null, str(body.label, 80), nowIso())
    .run();
  return db.prepare(`${LINK_SELECT} WHERE l.id = ?`).bind(id).first<LinkRow>();
}

growth.post('/links', async (c) => {
  const body = await c.req.json<Record<string, string | null>>().catch(() => ({}) as Record<string, string | null>);
  const row = await createLink(c.env.DB, c.get('user').id, body);
  if (!row) return c.json({ error: 'that product is not yours' }, 400);
  await track(c.env.DB, c.get('user').id, 'link_created', { sourceType: row.source_type });
  return c.json({ link: toLink(row) }, 201);
});

growth.delete('/links/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM tracked_links WHERE id = ? AND owner_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});

// ---- content items: your posts, with views and what they sold
interface ContentRow { id: string; platform: ContentItem['platform']; kind: ContentItem['kind']; url: string; caption: string; posted_at: string | null; views: number; likes: number; comments: number; synced_at: string | null; created_at: string; links: number; clicks: number; sales: number; revenue: number }
const CONTENT_SELECT = `SELECT ci.*,
  (SELECT COUNT(*) FROM tracked_links l WHERE l.content_item_id = ci.id) AS links,
  (SELECT COUNT(*) FROM link_clicks k JOIN tracked_links l ON l.id = k.link_id WHERE l.content_item_id = ci.id) AS clicks,
  (SELECT COUNT(*) FROM orders o JOIN tracked_links l ON l.id = o.source_link_id WHERE l.content_item_id = ci.id AND o.status IN ('paid','test')) AS sales,
  (SELECT COALESCE(SUM(o.points),0) FROM orders o JOIN tracked_links l ON l.id = o.source_link_id WHERE l.content_item_id = ci.id AND o.status IN ('paid','test')) AS revenue
  FROM content_items ci`;
const toContent = (r: ContentRow): ContentItem => ({ id: r.id, platform: r.platform, kind: r.kind, url: r.url, caption: r.caption, postedAt: r.posted_at, views: r.views, likes: r.likes, comments: r.comments, syncedAt: r.synced_at, links: r.links, clicks: r.clicks, sales: r.sales, revenuePoints: r.revenue, rpm: r.views > 0 ? Math.round((r.revenue / r.views) * 1000 * 10) / 10 : null, createdAt: r.created_at });

growth.get('/content', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const sort = c.req.query('sort') === 'views' ? 'ci.views DESC' : c.req.query('sort') === 'recent' ? 'ci.created_at DESC' : 'revenue DESC, clicks DESC';
  const ask = pageOf(c);
  const rows = await db.prepare(`${CONTENT_SELECT} WHERE ci.owner_id = ? ORDER BY ${sort} LIMIT ? OFFSET ?`).bind(user.id, ask.limit, ask.offset).all<ContentRow>();
  const pg = paged(rows.results, ask);
  const direct = await db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(points),0) AS points FROM orders WHERE owner_id = ? AND status IN ('paid','test') AND source_link_id IS NULL").bind(user.id).first<{ n: number; points: number }>();
  return c.json({ page: pg.page, items: pg.items.map(toContent), direct: { sales: direct?.n ?? 0, revenuePoints: direct?.points ?? 0 } });
});

growth.post('/content', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const url = str(body.url, 500);
  if (!/^https?:\/\//.test(url)) return c.json({ error: 'the public link to the post' }, 400);
  const id = newId();
  const platform = detectPlatform(url);
  const now = nowIso();
  try {
    await db
      .prepare('INSERT INTO content_items (id, owner_id, platform, external_id, kind, url, caption, thumbnail_url, posted_at, views, likes, comments, synced_at, created_at) VALUES (?, ?, ?, NULL, ?, ?, ?, NULL, ?, ?, ?, ?, NULL, ?)')
      .bind(id, user.id, platform, oneOf(body.kind, CONTENT_KINDS, platform === 'youtube' ? 'video' : 'post'), url, str(body.caption, 300), str(body.postedAt, 40) || null, num(body.views, 0, 0) ?? 0, num(body.likes, 0, 0) ?? 0, num(body.comments, 0, 0) ?? 0, now)
      .run();
  } catch {
    return c.json({ error: 'you already added that post' }, 409);
  }
  // Read the numbers from the platform where that is possible.
  const r = await fetchMetrics(url, c.env);
  if (r.reading) await db.prepare('UPDATE content_items SET views = ?, likes = ?, comments = ?, synced_at = ? WHERE id = ?').bind(r.reading.views, r.reading.likes, r.reading.comments, now, id).run();
  // Every post gets a tracked link to your page straight away.
  if (body.withLink !== false) await createLink(db, user.id, { productId: str(body.productId, 64) || null, sourceType: 'content', contentItemId: id, label: str(body.caption, 80) || 'Post link' });
  const row = await db.prepare(`${CONTENT_SELECT} WHERE ci.id = ?`).bind(id).first<ContentRow>();
  return c.json({ item: row ? toContent(row) : null, why: r.why }, 201);
});

growth.post('/content/:id/refresh', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const item = await db.prepare('SELECT * FROM content_items WHERE id = ? AND owner_id = ?').bind(c.req.param('id'), user.id).first<ContentRow>();
  if (!item) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const views = num(body.views, null, 0);
  let why: string;
  if (views === null) {
    const r = await fetchMetrics(item.url, c.env);
    if (!r.reading) return c.json({ error: r.why }, 400);
    await db.prepare('UPDATE content_items SET views = ?, likes = ?, comments = ?, synced_at = ? WHERE id = ?').bind(r.reading.views, r.reading.likes, r.reading.comments, nowIso(), item.id).run();
    why = r.why;
  } else {
    await db.prepare('UPDATE content_items SET views = ?, likes = ?, comments = ?, synced_at = ? WHERE id = ?').bind(views, num(body.likes, item.likes, 0) ?? item.likes, num(body.comments, item.comments, 0) ?? item.comments, nowIso(), item.id).run();
    why = 'saved what you typed';
  }
  const row = await db.prepare(`${CONTENT_SELECT} WHERE ci.id = ?`).bind(item.id).first<ContentRow>();
  return c.json({ item: row ? toContent(row) : null, why });
});

growth.delete('/content/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM content_items WHERE id = ? AND owner_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});

// ---- Auto-DM automations
interface AutoRow { id: string; content_item_id: string | null; content_caption: string | null; keywords_json: string; dm_message: string; public_replies_json: string; link_id: string; link_code: string; product_title: string | null; active: number; created_at: string; matched: number; sent: number; queued: number; failed: number; clicks: number; sales: number; revenue: number }
const AUTO_SELECT = `SELECT a.*, ci.caption AS content_caption, l.code AS link_code, p.title AS product_title,
  (SELECT COUNT(*) FROM dm_sends s WHERE s.automation_id = a.id) AS matched,
  (SELECT COUNT(*) FROM dm_sends s WHERE s.automation_id = a.id AND s.status = 'sent') AS sent,
  (SELECT COUNT(*) FROM dm_sends s WHERE s.automation_id = a.id AND s.status = 'queued') AS queued,
  (SELECT COUNT(*) FROM dm_sends s WHERE s.automation_id = a.id AND s.status = 'failed') AS failed,
  (SELECT COUNT(*) FROM link_clicks k WHERE k.link_id = a.link_id) AS clicks,
  (SELECT COUNT(*) FROM orders o WHERE o.source_link_id = a.link_id AND o.status IN ('paid','test')) AS sales,
  (SELECT COALESCE(SUM(points),0) FROM orders o WHERE o.source_link_id = a.link_id AND o.status IN ('paid','test')) AS revenue
  FROM dm_automations a JOIN tracked_links l ON l.id = a.link_id LEFT JOIN content_items ci ON ci.id = a.content_item_id LEFT JOIN products p ON p.id = l.product_id`;
const toAuto = (r: AutoRow): DmAutomation => ({ id: r.id, contentItemId: r.content_item_id, contentCaption: r.content_caption, keywords: parseList(r.keywords_json), dmMessage: r.dm_message, publicReplies: parseList(r.public_replies_json), linkId: r.link_id, linkCode: r.link_code, productTitle: r.product_title, active: r.active === 1, matched: r.matched, sent: r.sent, queued: r.queued, failed: r.failed, clicks: r.clicks, sales: r.sales, revenuePoints: r.revenue, createdAt: r.created_at });
interface SendRow { id: string; automation_id: string; recipient_handle: string; status: DmSend['status']; error: string; created_at: string }
const toSend = (r: SendRow): DmSend => ({ id: r.id, automationId: r.automation_id, recipientHandle: r.recipient_handle, status: r.status, error: r.error, createdAt: r.created_at });

growth.get('/automations', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const [rows, sends] = await Promise.all([
    db.prepare(`${AUTO_SELECT} WHERE a.owner_id = ? ORDER BY a.created_at DESC`).bind(user.id).all<AutoRow>(),
    db.prepare('SELECT s.* FROM dm_sends s JOIN dm_automations a ON a.id = s.automation_id WHERE a.owner_id = ? ORDER BY s.created_at DESC LIMIT 100').bind(user.id).all<SendRow>(),
  ]);
  return c.json({ automations: rows.results.map(toAuto), sends: sends.results.map(toSend), metaConnected: Boolean(c.env.META_ACCESS_TOKEN) });
});

growth.post('/automations', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const keywords = (Array.isArray(body.keywords) ? body.keywords : String(body.keywords ?? '').split(',')).map((k) => String(k).trim().toLowerCase()).filter(Boolean).slice(0, 10);
  const dmMessage = str(body.dmMessage, 900);
  if (keywords.length === 0 || !dmMessage) return c.json({ error: 'at least one keyword and the message to send' }, 400);
  const contentItemId = str(body.contentItemId, 64) || null;
  if (contentItemId && !(await db.prepare('SELECT 1 FROM content_items WHERE id = ? AND owner_id = ?').bind(contentItemId, user.id).first())) return c.json({ error: 'that post is not yours' }, 400);
  const id = newId();
  const link = await createLink(db, user.id, { productId: str(body.productId, 64) || null, sourceType: 'automation', contentItemId, automationId: id, label: `Auto-DM ${keywords[0]}` });
  if (!link) return c.json({ error: 'that product is not yours' }, 400);
  const replies = Array.isArray(body.publicReplies) ? body.publicReplies.filter((x): x is string => typeof x === 'string').map((x) => x.trim().slice(0, 200)).filter(Boolean).slice(0, 5) : [];
  await db.prepare('INSERT INTO dm_automations (id, owner_id, content_item_id, keywords_json, dm_message, public_replies_json, link_id, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)').bind(id, user.id, contentItemId, JSON.stringify(keywords), dmMessage, JSON.stringify(replies), link.id, nowIso()).run();
  await track(db, user.id, 'automation_created');
  const row = await db.prepare(`${AUTO_SELECT} WHERE a.id = ?`).bind(id).first<AutoRow>();
  return c.json({ automation: row ? toAuto(row) : null }, 201);
});

growth.patch('/automations/:id', async (c) => {
  const body = await c.req.json<{ active?: boolean }>().catch(() => ({}) as { active?: boolean });
  await c.env.DB.prepare('UPDATE dm_automations SET active = ? WHERE id = ? AND owner_id = ?').bind(body.active === false ? 0 : 1, c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});

growth.delete('/automations/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM dm_automations WHERE id = ? AND owner_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});

/** Run an incoming comment against a creator's automations. Used by the Meta webhook and by the simulator. */
export async function handleComment(db: D1Database, env: Env, ownerId: string | null, comment: { id: string; text: string; mediaUrl?: string | null; mediaExternalId?: string | null; fromId: string; fromHandle: string }): Promise<{ matched: number }> {
  const text = comment.text.toLowerCase();
  const rows = ownerId
    ? await db.prepare(`${AUTO_SELECT} WHERE a.owner_id = ? AND a.active = 1`).bind(ownerId).all<AutoRow>()
    : await db.prepare(`${AUTO_SELECT} WHERE a.active = 1 AND (ci.external_id = ? OR ci.url = ?)`).bind(comment.mediaExternalId ?? '', comment.mediaUrl ?? '').all<AutoRow>();
  let matched = 0;
  for (const a of rows.results) {
    if (a.content_item_id && comment.mediaUrl && ownerId) {
      const item = await db.prepare('SELECT url, external_id FROM content_items WHERE id = ?').bind(a.content_item_id).first<{ url: string; external_id: string | null }>();
      if (item && item.url !== comment.mediaUrl && item.external_id !== comment.mediaExternalId) continue;
    }
    const words = parseList(a.keywords_json);
    if (!words.some((w) => text.includes(w))) continue;
    matched += 1;
    const link = `/go/${a.link_code}`;
    let status: DmSend['status'] = 'queued';
    let error = '';
    if (env.META_ACCESS_TOKEN && comment.id && !comment.id.startsWith('sim_')) {
      // A private reply to the comment, which is what Meta allows for comment triggers.
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(comment.id)}/private_replies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `${a.dm_message}\n${link}`, access_token: env.META_ACCESS_TOKEN }),
        });
        if (res.ok) status = 'sent';
        else {
          status = 'failed';
          error = `Meta answered ${res.status}`;
        }
      } catch {
        status = 'failed';
        error = 'could not reach Meta';
      }
    } else if (!env.META_ACCESS_TOKEN) error = 'no Meta token on the server; send it by hand';
    try {
      await db
        .prepare('INSERT INTO dm_sends (id, automation_id, external_comment_id, recipient_external_id, recipient_handle, status, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(newId(), a.id, comment.id, comment.fromId, comment.fromHandle, status, error, nowIso())
        .run();
    } catch {
      // Already handled this comment, or already messaged this person for this automation.
    }
  }
  return { matched };
}

growth.post('/automations/:id/simulate', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const a = await db.prepare('SELECT id FROM dm_automations WHERE id = ? AND owner_id = ?').bind(c.req.param('id'), user.id).first();
  if (!a) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ comment?: string; handle?: string }>().catch(() => ({}) as Record<string, never>);
  const handle = str(body.handle, 40) || 'test_viewer';
  const r = await handleComment(db, c.env, user.id, { id: `sim_${newId()}`, text: str(body.comment, 300), fromId: `sim_${handle}`, fromHandle: handle });
  return c.json(r);
});

// ---- funnels: a chain of steps, each with how many people reached it
interface FunnelRow { id: string; name: string; steps_json: string; created_at: string }

async function stepCount(db: D1Database, ownerId: string, step: FunnelStep): Promise<number> {
  const one = async (sql: string, ...binds: unknown[]) => (await db.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0;
  switch (step.kind) {
    case 'content':
      return one('SELECT views AS n FROM content_items WHERE id = ? AND owner_id = ?', step.ref, ownerId);
    case 'automation':
      return one('SELECT COUNT(*) AS n FROM dm_sends s JOIN dm_automations a ON a.id = s.automation_id WHERE a.id = ? AND a.owner_id = ?', step.ref, ownerId);
    case 'link':
      return one('SELECT COUNT(*) AS n FROM link_clicks k JOIN tracked_links l ON l.id = k.link_id WHERE l.id = ? AND l.owner_id = ?', step.ref, ownerId);
    case 'lead':
      return one('SELECT COUNT(*) AS n FROM leads WHERE owner_id = ?', ownerId);
    case 'product':
      return one("SELECT COUNT(*) AS n FROM orders WHERE product_id = ? AND owner_id = ? AND status IN ('paid','test')", step.ref, ownerId);
    case 'broadcast':
      return one('SELECT sent AS n FROM broadcasts WHERE id = ? AND owner_id = ?', step.ref, ownerId);
    default:
      return 0;
  }
}

async function toFunnel(db: D1Database, ownerId: string, r: FunnelRow): Promise<Funnel> {
  let steps: FunnelStep[] = [];
  try {
    const v = JSON.parse(r.steps_json) as unknown;
    if (Array.isArray(v)) steps = v.filter((x): x is FunnelStep => Boolean(x && typeof x === 'object' && 'kind' in x && 'ref' in x));
  } catch {
    steps = [];
  }
  const withCounts = await Promise.all(steps.map(async (s) => ({ ...s, count: await stepCount(db, ownerId, s) })));
  return { id: r.id, name: r.name, steps: withCounts, createdAt: r.created_at };
}

growth.get('/funnels', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const rows = await db.prepare('SELECT * FROM funnels WHERE owner_id = ? ORDER BY created_at DESC').bind(user.id).all<FunnelRow>();
  const funnels = await Promise.all(rows.results.map((r) => toFunnel(db, user.id, r)));
  return c.json({ funnels });
});

growth.post('/funnels', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ name?: string; steps?: unknown }>().catch(() => ({}) as Record<string, never>);
  const name = str(body.name, 80);
  const steps = Array.isArray(body.steps) ? body.steps.filter((s): s is FunnelStep => Boolean(s && typeof s === 'object' && 'kind' in s && 'ref' in s)).slice(0, 8).map((s) => ({ kind: s.kind, ref: String(s.ref).slice(0, 64), label: String(s.label ?? '').slice(0, 80) })) : [];
  if (!name || steps.length < 2) return c.json({ error: 'a name and at least two steps' }, 400);
  const id = newId();
  await db.prepare('INSERT INTO funnels (id, owner_id, name, steps_json, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, user.id, name, JSON.stringify(steps), nowIso()).run();
  const row = await db.prepare('SELECT * FROM funnels WHERE id = ?').bind(id).first<FunnelRow>();
  return c.json({ funnel: row ? await toFunnel(db, user.id, row) : null }, 201);
});

growth.delete('/funnels/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM funnels WHERE id = ? AND owner_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});

// ---- post-purchase sequences
interface SeqRow { id: string; product_id: string | null; product_title: string | null; delay_days: number; title: string; body: string; active: number; created_at: string; sent: number }
const SEQ_SELECT = 'SELECT q.*, p.title AS product_title, (SELECT COUNT(*) FROM sequence_sends s WHERE s.sequence_id = q.id) AS sent FROM sequences q LEFT JOIN products p ON p.id = q.product_id';
const toSeq = (r: SeqRow): Sequence => ({ id: r.id, productId: r.product_id, productTitle: r.product_title, delayDays: r.delay_days, title: r.title, body: r.body, active: r.active === 1, sent: r.sent, createdAt: r.created_at });

growth.get('/sequences', async (c) => {
  const rows = await c.env.DB.prepare(`${SEQ_SELECT} WHERE q.owner_id = ? ORDER BY q.delay_days`).bind(c.get('user').id).all<SeqRow>();
  return c.json({ sequences: rows.results.map(toSeq) });
});

growth.post('/sequences', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const title = str(body.title, 120);
  const text = str(body.body, 2000);
  if (!title || !text) return c.json({ error: 'a title and a message' }, 400);
  const productId = str(body.productId, 64) || null;
  if (productId && !(await db.prepare('SELECT 1 FROM products WHERE id = ? AND owner_id = ?').bind(productId, user.id).first())) return c.json({ error: 'that product is not yours' }, 400);
  const id = newId();
  await db.prepare('INSERT INTO sequences (id, owner_id, product_id, delay_days, title, body, active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)').bind(id, user.id, productId, num(body.delayDays, 1, 0, 365) ?? 1, title, text, nowIso()).run();
  const row = await db.prepare(`${SEQ_SELECT} WHERE q.id = ?`).bind(id).first<SeqRow>();
  return c.json({ sequence: row ? toSeq(row) : null }, 201);
});

growth.patch('/sequences/:id', async (c) => {
  const body = await c.req.json<{ active?: boolean }>().catch(() => ({}) as { active?: boolean });
  await c.env.DB.prepare('UPDATE sequences SET active = ? WHERE id = ? AND owner_id = ?').bind(body.active === false ? 0 : 1, c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});

growth.delete('/sequences/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM sequences WHERE id = ? AND owner_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});

/** Deliver every due sequence message. Called by the cron. */
export async function runSequences(db: D1Database): Promise<number> {
  const due = await db
    .prepare(
      `SELECT q.id AS sequence_id, q.title, q.body, q.owner_id, o.id AS order_id, o.buyer_id, u.display_name AS owner_name, u.handle
       FROM sequences q JOIN orders o ON o.owner_id = q.owner_id AND (q.product_id IS NULL OR q.product_id = o.product_id) AND o.status IN ('paid','test')
       JOIN users u ON u.id = q.owner_id
       WHERE q.active = 1 AND o.created_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-' || q.delay_days || ' days')
         AND NOT EXISTS (SELECT 1 FROM sequence_sends s WHERE s.sequence_id = q.id AND s.order_id = o.id)
       LIMIT 200`,
    )
    .all<{ sequence_id: string; title: string; body: string; owner_id: string; order_id: string; buyer_id: string; owner_name: string; handle: string | null }>();
  for (const d of due.results) {
    await db.batch([
      db.prepare('INSERT OR IGNORE INTO sequence_sends (sequence_id, order_id, sent_at) VALUES (?, ?, ?)').bind(d.sequence_id, d.order_id, nowIso()),
      db.prepare('INSERT INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)').bind(newId(), d.buyer_id, 'sequence', `${nameOf({ display_name: d.owner_name })}: ${d.title}`, d.body.slice(0, 300), d.handle ? `/u/${d.handle}` : '/library', nowIso()),
    ]);
  }
  return due.results.length;
}

// ---- customers, refunds, payouts, priority DMs
growth.get('/customers', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const rows = await db
    .prepare(
      `SELECT u.id, u.display_name, u.handle, u.email, COUNT(o.id) AS orders, COALESCE(SUM(o.points),0) AS points, COALESCE(SUM(o.cents),0) AS cents, MIN(o.created_at) AS first_at, MAX(o.created_at) AS last_at,
         (SELECT COALESCE(l.label, l.code) FROM orders o2 LEFT JOIN tracked_links l ON l.id = o2.source_link_id WHERE o2.buyer_id = u.id AND o2.owner_id = ?1 ORDER BY o2.created_at LIMIT 1) AS source
       FROM orders o JOIN users u ON u.id = o.buyer_id WHERE o.owner_id = ?1 AND o.status IN ('paid','test') GROUP BY u.id ORDER BY last_at DESC LIMIT 500`,
    )
    .bind(user.id)
    .all<{ id: string; display_name: string; handle: string | null; email: string | null; orders: number; points: number; cents: number; first_at: string; last_at: string; source: string | null }>();
  const customers: Customer[] = rows.results.map((r) => ({ userId: r.id, name: nameOf(r), handle: r.handle, email: r.email, orders: r.orders, points: r.points, cents: r.cents, firstAt: r.first_at, lastAt: r.last_at, source: r.source ?? 'profile direct' }));
  if (c.req.query('format') === 'csv') {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = ['name,handle,email,orders,points,cents,first_purchase,last_purchase,source', ...customers.map((x) => [x.name, x.handle, x.email, x.orders, x.points, x.cents, x.firstAt, x.lastAt, x.source].map(esc).join(','))].join('\n');
    return c.body(csv, 200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="customers.csv"' });
  }
  return c.json({ customers });
});

/** Full refund. Points go back to the buyer and come out of the seller and any affiliate; money goes back through the provider. */
export async function refundOrder(db: D1Database, env: Env, o: OrderRow & { platform_fee_points: number; provider_payment_id?: string | null }, actorId: string, reason: string): Promise<string | null> {
  if (o.status === 'refunded') return 'already refunded';
  if (o.status === 'pending' || o.status === 'failed' || o.status === 'expired') return 'nothing was paid on this order';
  const now = nowIso();
  if (o.provider === 'razorpay' && o.cents > 0) {
    if (!o.provider_payment_id) return 'no payment id on this order yet';
    try {
      await providerFor(env).refund(o.provider_payment_id, o.cents);
    } catch (e) {
      return e instanceof Error ? e.message : 'the provider refused the refund';
    }
  }
  const stmts = [db.prepare("UPDATE orders SET status = 'refunded', refunded_at = ?, refund_reason = ? WHERE id = ? AND status != 'refunded'").bind(now, reason, o.id)];
  if (o.points > 0) {
    const affiliate = o.affiliate_code ? await db.prepare('SELECT id FROM users WHERE referral_code = ?').bind(o.affiliate_code).first<{ id: string }>() : null;
    const share = affiliate ? Math.round(o.points * 0.2) : 0;
    const sellerGot = o.points - share - (o.platform_fee_points ?? 0);
    stmts.push(
      db.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(o.points, o.buyer_id),
      db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(o.buyer_id, o.points, 'refund', o.id, now),
      db.prepare('UPDATE users SET points = MAX(0, points - ?) WHERE id = ?').bind(sellerGot, o.owner_id),
      db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(o.owner_id, -sellerGot, 'refund_out', o.id, now),
    );
    if (affiliate && share > 0) {
      stmts.push(
        db.prepare('UPDATE users SET points = MAX(0, points - ?) WHERE id = ?').bind(share, affiliate.id),
        db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(affiliate.id, -share, 'refund_out', o.id, now),
      );
    }
  }
  stmts.push(db.prepare("UPDATE bookings SET status = 'cancelled' WHERE order_id = ? OR (product_id = ? AND buyer_id = ? AND status IN ('requested','confirmed'))").bind(o.id, o.product_id, o.buyer_id));
  stmts.push(db.prepare("UPDATE dm_requests SET status = 'refunded' WHERE order_id = ?").bind(o.id));
  await db.batch(stmts);
  await logEvent(db, 'order', o.id, 'order.refunded', { by: actorId, reason });
  await track(db, actorId, 'refund_issued', { points: o.points, cents: o.cents, reason });
  await notify(db, o.buyer_id, 'refund', `Refunded: ${o.product_title}`, o.points > 0 ? `${o.points} points are back in your balance.` : o.cents > 0 && o.provider === 'razorpay' ? 'The money is on its way back to the card or account you paid with.' : 'Your test-mode order was reversed.', '/library');
  const buyer = await db.prepare('SELECT email FROM users WHERE id = ?').bind(o.buyer_id).first<{ email: string | null }>();
  await sendEmail(db, env, { userId: o.buyer_id, to: buyer?.email, subject: `Refunded: ${o.product_title}`, body: reason ? `Reason: ${reason}` : 'Your order was refunded in full.' });
  return null;
}

growth.post('/orders/:id/refund', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const o = await db.prepare(`${ORDER_SELECT} WHERE o.id = ? AND o.owner_id = ?`).bind(c.req.param('id'), user.id).first<OrderRow & { platform_fee_points: number; provider_payment_id: string | null; owner_id: string }>();
  if (!o) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ reason?: string }>().catch(() => ({}) as { reason?: string });
  const problem = await refundOrder(db, c.env, o, user.id, str(body.reason, 300));
  if (problem) return c.json({ error: problem }, 400);
  const fresh = await db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).bind(o.id).first<OrderRow>();
  return c.json({ order: fresh ? toOrder(fresh) : null });
});

growth.get('/payouts', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const rows = await db.prepare(`${ORDER_SELECT} WHERE o.owner_id = ? ORDER BY o.created_at DESC LIMIT 300`).bind(user.id).all<OrderRow & { platform_fee_points: number }>();
  const summary: PayoutSummary = { feeBps: user.fee_bps ?? 500, grossPoints: 0, feePoints: 0, affiliatePoints: 0, netPoints: 0, refundedPoints: 0, testCents: 0, rows: [] };
  for (const r of rows.results) {
    const affiliate = r.affiliate_code ? Math.round(r.points * 0.2) : 0;
    const fee = r.platform_fee_points ?? 0;
    const net = r.points - affiliate - fee;
    if (r.status === 'refunded') summary.refundedPoints += r.points;
    else {
      summary.grossPoints += r.points;
      summary.feePoints += fee;
      summary.affiliatePoints += affiliate;
      summary.netPoints += net;
      summary.testCents += r.cents;
    }
    summary.rows.push({ orderId: r.id, productTitle: r.product_title, buyerName: nameOf({ display_name: r.buyer_name }), points: r.points, fee, affiliate, net, status: r.status, createdAt: r.created_at });
  }
  return c.json(summary);
});

interface DmReqRow { id: string; product_id: string; product_title: string; owner_name: string; buyer_name: string; question: string; answer: string; status: DmRequest['status']; due_at: string; answered_at: string | null; created_at: string }
export const DM_SELECT = 'SELECT d.*, p.title AS product_title, ow.display_name AS owner_name, b.display_name AS buyer_name FROM dm_requests d JOIN products p ON p.id = d.product_id JOIN users ow ON ow.id = d.owner_id JOIN users b ON b.id = d.buyer_id';
export const toDmRequest = (r: DmReqRow): DmRequest => ({ id: r.id, productId: r.product_id, productTitle: r.product_title, ownerName: nameOf({ display_name: r.owner_name }), buyerName: nameOf({ display_name: r.buyer_name }), question: r.question, answer: r.answer, status: r.status, dueAt: r.due_at, answeredAt: r.answered_at, createdAt: r.created_at });

growth.get('/dm', async (c) => {
  const rows = await c.env.DB.prepare(`${DM_SELECT} WHERE d.owner_id = ? ORDER BY CASE d.status WHEN 'open' THEN 0 ELSE 1 END, d.due_at`).bind(c.get('user').id).all<DmReqRow>();
  return c.json({ requests: rows.results.map(toDmRequest) });
});

growth.post('/dm/:id/answer', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const r = await db.prepare(`${DM_SELECT} WHERE d.id = ? AND d.owner_id = ?`).bind(c.req.param('id'), user.id).first<DmReqRow & { buyer_id: string }>();
  if (!r) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ answer?: string }>().catch(() => ({}) as { answer?: string });
  const answer = str(body.answer, 4000);
  if (!answer) return c.json({ error: 'write the answer' }, 400);
  await db.prepare("UPDATE dm_requests SET answer = ?, status = 'answered', answered_at = ? WHERE id = ?").bind(answer, nowIso(), r.id).run();
  await notify(db, r.buyer_id, 'dm', `${nameOf(user)} answered your question`, answer.slice(0, 160), '/library');
  return c.json({ ok: true });
});
