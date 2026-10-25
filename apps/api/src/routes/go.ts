import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { newId, nowIso } from '../db';
import { handleComment } from './growth';
import { providerFor } from '../payments';
import { logEvent, sendEmail, track } from '../ops';
import { ORDER_SELECT, type OrderRow } from './studio';
import { nameOf, notify } from '../db';
import type { Env } from '../env';
import { FEATURE_KEYS } from '../sitemap';

/** Tracked redirects at /go/:code. The click is written after the redirect is sent. */
export const go = new Hono<AppEnv>();

async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

go.get('/go/:code', async (c) => {
  const db = c.env.DB;
  const link = await db.prepare('SELECT l.id, l.owner_id, l.product_id, u.handle FROM tracked_links l JOIN users u ON u.id = l.owner_id WHERE l.code = ?').bind(c.req.param('code').toLowerCase()).first<{ id: string; owner_id: string; product_id: string | null; handle: string | null }>();
  if (!link) return c.redirect('/explore', 302);
  const clickId = newId();
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? '';
  const salt = c.env.CLICK_SALT ?? 'kreators-local';
  const write = (async () => {
    await db
      .prepare('INSERT INTO link_clicks (id, link_id, owner_id, ip_hash, user_agent, referrer, country, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(clickId, link.id, link.owner_id, ip ? await sha(`${salt}:${ip}`) : null, (c.req.header('User-Agent') ?? '').slice(0, 200), (c.req.header('Referer') ?? '').slice(0, 200), c.req.header('CF-IPCountry') ?? null, nowIso())
      .run();
  })();
  c.executionCtx.waitUntil(write);
  const target = link.product_id ? `/p/${link.product_id}` : link.handle ? `/u/${link.handle}` : '/explore';
  c.header('Set-Cookie', `kl_click=${clickId}; Max-Age=${30 * 86400}; Path=/; SameSite=Lax`);
  return c.redirect(`${target}?src=${encodeURIComponent(c.req.param('code'))}&click=${clickId}`, 302);
});

/** The public sitemap: site pages, feature pages and every published creator page. */
go.get('/sitemap.xml', async (c) => {
  const origin = new URL(c.req.url).origin;
  const handles = await c.env.DB.prepare("SELECT DISTINCT u.handle FROM users u JOIN products p ON p.owner_id = u.id WHERE u.handle IS NOT NULL AND p.status = 'live' LIMIT 5000").all<{ handle: string }>();
  const urls = ['/', '/explore', '/terms', '/privacy', '/refunds', '/contact', '/pricing', ...FEATURE_KEYS.map((k) => `/features/${k}`), ...handles.results.map((h) => `/u/${h.handle}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${origin}${u}</loc></url>`).join('\n')}\n</urlset>`;
  return c.body(xml, 200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
});

/** The site home. Link previews need an absolute share-image URL, and the origin is only known here. */
go.get('/', async (c) => {
  if (!c.env.ASSETS) return c.text('not found', 404);
  const page = await c.env.ASSETS.fetch(c.req.raw);
  if (!page.ok || !(page.headers.get('Content-Type') ?? '').includes('text/html')) return page;
  const origin = new URL(c.req.url).origin;
  const absolute = {
    element(el: Element) {
      const value = el.getAttribute('content') ?? '';
      if (value.startsWith('/')) el.setAttribute('content', origin + value);
    },
  };
  return new HTMLRewriter().on('meta[property="og:image"]', absolute).on('meta[property="og:url"]', absolute).transform(page);
});

/** Meta and payment webhooks. Mounted at /api/webhooks. */
export const webhooks = new Hono<AppEnv>();

/** Apply one provider event to the order it names. Used by the webhook and by the admin's replay. */
export async function handlePaymentEvent(db: D1Database, env: Env, parsed: { type: string; providerOrderId: string | null; providerPaymentId: string | null; amountCents: number | null }): Promise<string> {
  if (!parsed.providerOrderId && !parsed.providerPaymentId) return 'no order on this event';
  const o = parsed.providerOrderId
    ? await db.prepare(`${ORDER_SELECT} WHERE o.provider_order_id = ?`).bind(parsed.providerOrderId).first<OrderRow & { owner_id: string; intake_json: string }>()
    : await db.prepare(`${ORDER_SELECT} WHERE o.provider_payment_id = ?`).bind(parsed.providerPaymentId).first<OrderRow & { owner_id: string; intake_json: string }>();
  if (!o) return 'no order matches';
  const now = new Date().toISOString();
  if (parsed.type === 'payment.captured' || parsed.type === 'order.paid') {
    if (o.status !== 'pending') return `already ${o.status}`;
    if (parsed.amountCents !== null && parsed.amountCents !== o.cents) return `amount mismatch: ${parsed.amountCents} vs ${o.cents}`;
    const stmts = [db.prepare("UPDATE orders SET status = 'paid', provider_payment_id = ?, paid_at = ? WHERE id = ? AND status = 'pending'").bind(parsed.providerPaymentId, now, o.id)];
    if (o.product_kind === 'dm') {
      let question = '';
      try {
        question = String((JSON.parse(o.intake_json || '[]') as unknown[])[0] ?? '');
      } catch {
        question = '';
      }
      const days = await db.prepare('SELECT response_days FROM products WHERE id = ?').bind(o.product_id).first<{ response_days: number | null }>();
      stmts.push(db.prepare("INSERT INTO dm_requests (id, product_id, order_id, owner_id, buyer_id, question, answer, status, due_at, answered_at, created_at) VALUES (?, ?, ?, ?, ?, ?, '', 'open', ?, NULL, ?)").bind(crypto.randomUUID(), o.product_id, o.id, o.owner_id, o.buyer_id, question, new Date(Date.now() + (days?.response_days ?? 3) * 86_400_000).toISOString(), now));
    }
    await db.batch(stmts);
    await logEvent(db, 'order', o.id, 'payment.captured', { paymentId: parsed.providerPaymentId, cents: parsed.amountCents });
    await track(db, o.buyer_id, 'payment_succeeded', { productId: o.product_id, method: 'razorpay' });
    await notify(db, o.owner_id, 'order', `${nameOf({ display_name: o.buyer_name })} got ${o.product_title}`, `${(o.cents / 100).toFixed(2)} ${o.currency}`, `/shop/products/${o.product_id}`);
    await notify(db, o.buyer_id, 'order', `Paid: ${o.product_title}`, 'It is in My purchases now.', '/library');
    const buyer = await db.prepare('SELECT email FROM users WHERE id = ?').bind(o.buyer_id).first<{ email: string | null }>();
    await sendEmail(db, env, { userId: o.buyer_id, to: buyer?.email, subject: `Your receipt: ${o.product_title}`, body: `Paid ${(o.cents / 100).toFixed(2)} ${o.currency}. Find it under My purchases.` });
    return 'paid';
  }
  if (parsed.type === 'payment.failed') {
    if (o.status !== 'pending') return `already ${o.status}`;
    await db.prepare("UPDATE orders SET status = 'failed' WHERE id = ?").bind(o.id).run();
    await logEvent(db, 'order', o.id, 'payment.failed');
    await track(db, o.buyer_id, 'payment_failed', { productId: o.product_id });
    return 'failed';
  }
  if (parsed.type === 'refund.processed') {
    if (o.status === 'refunded') return 'already refunded';
    await db.prepare("UPDATE orders SET status = 'refunded', refunded_at = ? WHERE id = ?").bind(now, o.id).run();
    await logEvent(db, 'order', o.id, 'refund.processed');
    return 'refunded';
  }
  return `ignored ${parsed.type}`;
}

webhooks.post('/razorpay', async (c) => {
  const db = c.env.DB;
  const provider = providerFor(c.env);
  if (provider.name !== 'razorpay') return c.json({ error: 'payments are in test mode on this deployment' }, 503);
  const raw = await c.req.text();
  if (!(await provider.verifyWebhook(raw, c.req.header('X-Razorpay-Signature') ?? ''))) return c.json({ error: 'bad signature' }, 401);
  let json: unknown = {};
  try {
    json = JSON.parse(raw);
  } catch {
    return c.json({ error: 'bad json' }, 400);
  }
  const eventId = c.req.header('x-razorpay-event-id') ?? (await hmacHex('evt', raw)).slice(0, 40);
  const parsed = provider.parseWebhook(json);
  const ins = await db.prepare('INSERT OR IGNORE INTO webhook_events (id, provider, type, payload, processed_at, error, received_at) VALUES (?, ?, ?, ?, NULL, NULL, ?)').bind(eventId, 'razorpay', parsed.type, raw.slice(0, 20000), nowIso()).run();
  if (ins.meta.changes === 0) return c.json({ ok: true, duplicate: true });
  const work = (async () => {
    let error: string | null = null;
    try {
      const outcome = await handlePaymentEvent(db, c.env, parsed);
      if (!['paid', 'failed', 'refunded'].includes(outcome) && !outcome.startsWith('ignored') && !outcome.startsWith('already')) error = outcome;
    } catch (e) {
      error = e instanceof Error ? e.message : 'failed';
    }
    await db.prepare('UPDATE webhook_events SET processed_at = ?, error = ? WHERE id = ?').bind(nowIso(), error, eventId).run();
  })();
  c.executionCtx.waitUntil(work);
  return c.json({ ok: true });
});

webhooks.get('/meta', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge') ?? '';
  if (mode === 'subscribe' && c.env.META_VERIFY_TOKEN && token === c.env.META_VERIFY_TOKEN) return c.text(challenge, 200);
  return c.text('forbidden', 403);
});

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

webhooks.post('/meta', async (c) => {
  const db = c.env.DB;
  if (!c.env.META_APP_SECRET) return c.json({ error: 'Meta is not configured on this deployment' }, 503);
  const raw = await c.req.text();
  const given = (c.req.header('X-Hub-Signature-256') ?? '').replace('sha256=', '');
  const expected = await hmacHex(c.env.META_APP_SECRET, raw);
  if (!given || given.length !== expected.length || given !== expected) return c.json({ error: 'bad signature' }, 401);
  let payload: { entry?: { id?: string; changes?: { field?: string; value?: { id?: string; text?: string; media?: { id?: string; media_product_type?: string }; from?: { id?: string; username?: string } } }[] }[] } = {};
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    return c.json({ error: 'bad json' }, 400);
  }
  const eventId = await hmacHex(c.env.META_APP_SECRET, `evt:${raw}`);
  const ins = await db.prepare('INSERT OR IGNORE INTO webhook_events (id, provider, type, payload, processed_at, error, received_at) VALUES (?, ?, ?, ?, NULL, NULL, ?)').bind(eventId.slice(0, 40), 'meta', 'comments', raw.slice(0, 20000), nowIso()).run();
  if (ins.meta.changes === 0) return c.json({ ok: true, duplicate: true });
  const work = (async () => {
    let error: string | null = null;
    try {
      for (const entry of payload.entry ?? []) {
        for (const ch of entry.changes ?? []) {
          if (ch.field !== 'comments' || !ch.value?.id || !ch.value.text) continue;
          await handleComment(db, c.env, null, { id: ch.value.id, text: ch.value.text, mediaExternalId: ch.value.media?.id ?? null, fromId: ch.value.from?.id ?? 'unknown', fromHandle: ch.value.from?.username ?? '' });
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'failed';
    }
    await db.prepare('UPDATE webhook_events SET processed_at = ?, error = ? WHERE id = ?').bind(nowIso(), error, eventId.slice(0, 40)).run();
  })();
  c.executionCtx.waitUntil(work);
  return c.json({ ok: true });
});
