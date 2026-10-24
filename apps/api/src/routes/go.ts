import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { newId, nowIso } from '../db';
import { handleComment } from './growth';

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

/** Meta webhooks for comment triggers. Mounted at /api/webhooks. */
export const webhooks = new Hono<AppEnv>();

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
