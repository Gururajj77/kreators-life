import { CONSENT_FIRST_COUNTRIES, DATE_PREFS_DEFAULT, DEFAULT_PAGE_SIZE, formatCount, formatStamp, money, type PublicEvent } from '@kreators/shared';
import { breadcrumbLd, escapeHtml, eventLd, faqLd, itemListLd, jsonForHtml, metaForPath, organizationLd, SITE_ANSWER, SITE_FAQ, siteUrl, webAppLd, websiteLd, type SiteEvent } from '@kreators/shared/siteMeta';
import type { Context } from 'hono';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { liveUser, newId, nowIso } from '../db';
import { handleComment } from './growth';
import { hmacHex, providerFor } from '../payments';
import { release } from '../discounts';
import { logEvent, safeEqual, sendEmail, sha as sha256Hex, track } from '../ops';
import { ORDER_SELECT, type OrderRow } from './studio';
import { nameOf, notify } from '../db';
import type { Env } from '../env';
import { sitemapXml, type SitemapEntry } from '../sitemap';
import { businessFrom } from './legal';
import { PUBLIC_EVENT_BY_ID, PUBLIC_EVENT_SELECT, toPublicEvent, UPCOMING_PUBLIC_ORDER, UPCOMING_PUBLIC_WHERE, type PublicEventRow } from './eventsPublic';
import { handleCallPayment } from '../liveCall';
import { connectionsCameTrue } from '../invites';

/** Tracked redirects at /go/:code. The click is written after the redirect is sent. */
export const go = new Hono<AppEnv>();

/** The salted hash a click keeps instead of an address: SHA-256 as hex, its first 32 characters. */
const sha = async (text: string): Promise<string> => (await sha256Hex(text)).slice(0, 32);

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
  // The cookie is the one thing here that is not strictly needed, so it follows the person's choice. Where a yes is needed first (India, the EU,
  // the rest of the EEA, the UK, Switzerland) it waits for one; elsewhere it is set unless they said no. Global Privacy Control wins over
  // everything, an earlier yes included (2026-11-05, the founder): a browser that sends it never gets the cookie.
  const chosen = /(?:^|;\s*)kc_attr=(0|1)/.exec(c.req.header('Cookie') ?? '')?.[1];
  const waitsForYes = CONSENT_FIRST_COUNTRIES.includes((c.req.header('CF-IPCountry') ?? '').toUpperCase());
  const gpc = c.req.header('Sec-GPC') === '1';
  const allowed = !gpc && (chosen === '1' || (chosen === undefined && !waitsForYes));
  if (allowed) c.header('Set-Cookie', `kl_click=${clickId}; Max-Age=${30 * 86400}; Path=/; SameSite=Lax`);
  return c.redirect(`${target}?src=${encodeURIComponent(c.req.param('code'))}&click=${clickId}`, 302);
});

/** Partner links from the Store and Tools. The tap is counted after the redirect is sent. */
go.get('/out/:kind/:id', async (c) => {
  const db = c.env.DB;
  const kind = c.req.param('kind');
  const id = c.req.param('id');
  const row =
    kind === 'item'
      ? await db.prepare("SELECT url FROM store_items WHERE id = ? AND status = 'live'").bind(id).first<{ url: string }>()
      : kind === 'tool'
        ? await db.prepare('SELECT url FROM tools WHERE id = ? AND verified = 1').bind(id).first<{ url: string }>()
        : null;
  if (!row || !/^https?:\/\//.test(row.url)) return c.redirect('/store', 302);
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? '';
  const salt = c.env.CLICK_SALT ?? 'kreators-local';
  const write = (async () => {
    await db
      .prepare('INSERT INTO outbound_clicks (id, kind, target_id, ip_hash, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(newId(), kind, id, ip ? await sha(`${salt}:${ip}`) : null, (c.req.header('User-Agent') ?? '').slice(0, 200), nowIso())
      .run();
  })().catch((e: unknown) => console.error('outbound click not written', e));
  c.executionCtx.waitUntil(write);
  return c.redirect(row.url, 302);
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// The pages the Worker writes the head of (docs/aeo-kit.md, part 8): the site home, the events list and each public event. The shell is the
// built index.html; its head gets the page's own title, description, canonical and share tags, its JSON-LD, and a <noscript> summary after
// div#root, so a crawler that runs no script still reads what the page says. Words come from @kreators/shared/siteMeta; anything a person
// typed enters only through escapeHtml (HTML) or jsonForHtml (JSON-LD). Every address is on the production origin (siteUrl(PUBLIC_URL)).
// The stable pages (/features, /pricing, the policies) are written at build time and never reach the Worker.
// ---------------------------------------------------------------------------------------------------------------------------------------

/** What one page's head says. `summaryHtml` is already escaped; nothing else is inserted as HTML. */
interface Head {
  title: string;
  /** og:title when it should say more than the tab's title (an event's whole name); else the title. */
  ogTitle?: string;
  description: string;
  url: string;
  image: string;
  jsonLd: readonly unknown[];
  summaryHtml: string;
  noindex?: boolean;
}

/** The shell (index.html), asked for plainly so a browser's own validators never turn a page with a new head into a 304. */
async function shell(c: Context<AppEnv>): Promise<Response | null> {
  if (!c.env.ASSETS) return null;
  return c.env.ASSETS.fetch(new Request(new URL('/', c.req.url).toString(), { method: 'GET', headers: { Accept: 'text/html' } }));
}

const isHtml = (res: Response) => res.ok && (res.headers.get('Content-Type') ?? '').includes('text/html');

/** True on a host that is not the production one (workers.dev, a preview), when PUBLIC_URL names one. Those pages say noindex. */
function offProductionHost(c: Context<AppEnv>): boolean {
  const pub = (c.env.PUBLIC_URL ?? '').trim();
  if (!pub) return false;
  try {
    return new URL(pub).host !== new URL(c.req.url).host;
  } catch {
    return false;
  }
}

/** The shell with the page's head. Old share and SEO tags are taken out and written again, every value escaped by us. */
function withHead(c: Context<AppEnv>, page: Response, head: Head): Response {
  const origin = siteUrl(c.env.PUBLIC_URL);
  const defaultImage = `${origin}/og.png`;
  const meta = (attr: 'name' | 'property', key: string, value: string) => `<meta ${attr}="${key}" content="${escapeHtml(value)}">`;
  const tags = [
    meta('name', 'description', head.description),
    meta('property', 'og:title', head.ogTitle ?? head.title),
    meta('property', 'og:description', head.description),
    meta('property', 'og:url', head.url),
    meta('property', 'og:image', head.image),
    ...(head.image === defaultImage ? [meta('property', 'og:image:width', '1200'), meta('property', 'og:image:height', '630')] : []),
    `<link rel="canonical" href="${escapeHtml(head.url)}">`,
    ...(head.noindex ? ['<meta name="robots" content="noindex">'] : []),
    ...head.jsonLd.map((block) => `<script type="application/ld+json">${jsonForHtml(block)}</script>`),
  ].join('');
  const drop = {
    element: (el: Element) => {
      el.remove();
    },
  };
  const rewritten = new HTMLRewriter()
    .on('title', {
      element: (el) => {
        el.setInnerContent(head.title);
      },
    })
    .on('meta[name="description"]', drop)
    .on('meta[property^="og:title"]', drop)
    .on('meta[property^="og:description"]', drop)
    .on('meta[property="og:url"]', drop)
    .on('meta[property^="og:image"]', drop)
    .on('link[rel="canonical"]', drop)
    .on('meta[name="robots"]', drop)
    .on('script[type="application/ld+json"]', drop)
    .on('head', {
      element: (el) => {
        el.append(tags, { html: true });
      },
    })
    .on('div#root', {
      element: (el) => {
        el.after(`<noscript>${head.summaryHtml}</noscript>`, { html: true });
      },
    })
    .transform(page);
  const out = new Response(rewritten.body, rewritten);
  // The body changed, so the shell's validator and length no longer describe it.
  out.headers.delete('ETag');
  out.headers.delete('Content-Length');
  out.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  if (offProductionHost(c)) out.headers.set('X-Robots-Tag', 'noindex');
  return out;
}

const p = (text: string) => `<p>${escapeHtml(text)}</p>`;

/** The site home: its own words, who runs it (only what the Worker variables say), the app, the fair questions. No D1 read. */
go.get('/', async (c) => {
  const page = await shell(c);
  if (!page) return c.text('not found', 404);
  if (!isHtml(page)) return page;
  const origin = siteUrl(c.env.PUBLIC_URL);
  const m = metaForPath('/');
  if (!m) return page;
  const b = businessFrom(c.env);
  const business = { name: b.name, email: b.email, address: b.address, registration: b.registration, vat: b.vat, grievanceName: b.grievanceName, grievanceEmail: b.grievanceEmail, grievancePhone: b.grievancePhone };
  const summary = [
    `<h1>${escapeHtml(m.h1)}</h1>`,
    p(m.opening ?? SITE_ANSWER.paragraph),
    '<h2>Fair questions</h2>',
    ...SITE_FAQ.map((f) => `<h3>${escapeHtml(f.q)}</h3>${p(f.a)}`),
  ].join('');
  return withHead(c, page, {
    title: m.title,
    description: m.description,
    url: `${origin}/`,
    image: `${origin}/og.png`,
    jsonLd: [organizationLd(origin, business), websiteLd(origin), webAppLd(origin), faqLd(SITE_FAQ)],
    summaryHtml: summary,
  });
});

/** "7 Nov 26, 4:17am (Asia/Kolkata)": an event's start in its own zone, the way the app writes a moment. */
const whenOf = (e: PublicEvent) => `${formatStamp(e.startsAt, DATE_PREFS_DEFAULT, e.timezone)} (${e.timezone})`;
const eventPath = (id: string) => `/events/${encodeURIComponent(id)}`;

/** The first page of upcoming public events, kept in the edge cache for a minute (one D1 round trip when it is not there). */
async function seoEventList(c: Context<AppEnv>): Promise<PublicEvent[]> {
  return cached(c, 'https://cache.internal/seo/events', SEO_EVENT_SECONDS, async () => {
    const rows = await c.env.DB.prepare(`${PUBLIC_EVENT_SELECT} WHERE ${UPCOMING_PUBLIC_WHERE} ORDER BY ${UPCOMING_PUBLIC_ORDER} LIMIT ?`).bind(nowIso(), DEFAULT_PAGE_SIZE).all<PublicEventRow>();
    return rows.results.map(toPublicEvent);
  });
}

/**
 * The page's head when the database could not be read (past a daily limit every query fails until it resets): the shell still loads, so
 * the app shows its own plain error line, and the answer is a 503 with Retry-After, which a crawler reads as "come back later", never as
 * the page being gone or empty. Nothing is cached.
 */
function readFailed(c: Context<AppEnv>, page: Response, head: Head, err: unknown): Response {
  console.error('page head: database read failed', err instanceof Error ? `${err.name}: ${err.message}` : String(err));
  const out = withHead(c, page, head);
  const res = new Response(out.body, { status: 503, headers: out.headers });
  res.headers.set('Retry-After', '3600');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

/** The events list: its words and the first page of upcoming public events as an ItemList. At most one D1 round trip. */
go.get('/events', async (c) => {
  const page = await shell(c);
  if (!page) return c.text('not found', 404);
  if (!isHtml(page)) return page;
  const origin = siteUrl(c.env.PUBLIC_URL);
  const m = metaForPath('/events');
  if (!m) return page;
  const trail = breadcrumbLd(origin, [{ name: 'kreators.app', path: '/' }, { name: m.h1, path: '/events' }]);
  let events: PublicEvent[];
  try {
    events = await seoEventList(c);
  } catch (err) {
    const summaryHtml = `<h1>${escapeHtml(m.h1)}</h1>${m.opening ? p(m.opening) : ''}${p('The list of events could not be read just now. Try again in a little while.')}`;
    return readFailed(c, page, { title: m.title, description: m.description, url: `${origin}/events`, image: `${origin}/og.png`, jsonLd: [trail], summaryHtml }, err);
  }
  const items = events.map((e) => ({ name: e.title, path: eventPath(e.id) }));
  const summary = [
    `<h1>${escapeHtml(m.h1)}</h1>`,
    ...(m.opening ? [p(m.opening)] : []),
    events.length
      ? `<ul>${events.map((e) => `<li><a href="${escapeHtml(eventPath(e.id))}">${escapeHtml(e.title)}</a>: ${escapeHtml(whenOf(e))}, ${escapeHtml(e.online ? 'online' : e.venue || 'place to be set')}</li>`).join('')}</ul>`
      : p('No public events are coming up right now.'),
  ].join('');
  const jsonLd: unknown[] = [trail];
  if (items.length) jsonLd.push({ ...(itemListLd(origin, items) as Record<string, unknown>), name: 'Upcoming events on kreators.app' });
  return withHead(c, page, { title: m.title, description: m.description, url: `${origin}/events`, image: `${origin}/og.png`, jsonLd, summaryHtml: summary });
});

/** One event as the landing page's head needs it, or null when a visitor may not see it. Kept in the edge cache, never the HTML. */
interface SeoEvent {
  event: PublicEvent;
  /** The cover: the first picture or GIF, as the page's MediaCover picks it; null for none or a video. */
  image: string | null;
}
/**
 * How long the edge keeps an event's head and the list: a minute, so a host who deletes their account or an event taken down stops showing
 * here soon after, with nothing to purge (deleteAccount wipes the words in D1; this copy simply runs out).
 */
const SEO_EVENT_SECONDS = 60;
/** A head's title is at most this long, "<the event, cut at a word> | kreators.app", like every other page's. */
const TITLE_MAX = 60;
const TITLE_TAIL = ' | kreators.app';
const EVENT_DESCRIPTION_MAX = 160;

/** Cut a text near `max` characters at a word. */
function cutWords(s: string, max: number): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max - 1);
  const space = head.lastIndexOf(' ');
  return `${(space > max * 0.6 ? head.slice(0, space) : head).replace(/[\s,;:.]+$/, '')}…`;
}

/** The event and its cover: one D1 round trip (both reads go out together through batchedReads). */
async function readSeoEvent(db: D1Database, id: string): Promise<SeoEvent | null> {
  const [row, cover] = await Promise.all([
    db.prepare(`${PUBLIC_EVENT_SELECT} WHERE ${PUBLIC_EVENT_BY_ID}`).bind(id).first<PublicEventRow>(),
    // The same items mediaForListings reads for an event, in its order; the first that is not a video is the cover.
    db.prepare("SELECT url FROM media_items WHERE owner_id = ? AND owner_type = 'event' AND kind != 'video' ORDER BY position, created_at LIMIT 1").bind(id).first<{ url: string }>(),
  ]);
  if (!row) return null;
  return { event: toPublicEvent(row), image: cover?.url ?? null };
}

/** The edge cache, where there is one (none in tests or on workers.dev, where every read simply goes to D1). */
const edgeCache = (): Cache | undefined => (globalThis as { caches?: { default?: Cache } }).caches?.default;

/** A value kept in the edge cache under a made-up key for `seconds`; read from `load` when it is not there. A failed load is never kept. */
async function cached<T>(c: Context<AppEnv>, url: string, seconds: number, load: () => Promise<T>): Promise<T> {
  const store = edgeCache();
  const key = new Request(url);
  if (store) {
    const hit = await store.match(key).catch(() => undefined);
    if (hit) {
      const kept = (await hit.json().catch(() => undefined)) as { value: T } | undefined;
      if (kept && 'value' in kept) return kept.value;
    }
  }
  const value = await load();
  if (store) {
    const put = store.put(key, new Response(JSON.stringify({ value }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${seconds}` } })).catch(() => undefined);
    try {
      c.executionCtx.waitUntil(put);
    } catch {
      // No execution context (a test): the put still runs on its own.
    }
  }
  return value;
}

async function seoEvent(c: Context<AppEnv>, id: string): Promise<SeoEvent | null> {
  // A missing event is kept too, so a crawler asking for one again and again reads D1 once a minute at most.
  return cached(c, `https://cache.internal/seo/event/${encodeURIComponent(id)}`, SEO_EVENT_SECONDS, () => readSeoEvent(c.env.DB, id));
}

/** One public event's landing page: its title, words, cover and Event block. A private, Club-only or missing one is the shell with noindex. */
go.get('/events/:id', async (c) => {
  const page = await shell(c);
  if (!page) return c.text('not found', 404);
  if (!isHtml(page)) return page;
  const origin = siteUrl(c.env.PUBLIC_URL);
  const id = c.req.param('id').slice(0, 128);
  const url = `${origin}${eventPath(id)}`;
  let found: SeoEvent | null;
  try {
    found = await seoEvent(c, id);
  } catch (err) {
    const summaryHtml = `<h1>An event on kreators.app</h1>${p('This event could not be read just now. Try again in a little while.')}<p><a href="/events">See the events you can join</a></p>`;
    return readFailed(c, page, { title: 'An event on kreators.app', description: 'An event on kreators.app. It could not be read just now; try again in a little while, or see the events you can join.', url, image: `${origin}/og.png`, jsonLd: [], summaryHtml }, err);
  }
  if (!found) {
    return withHead(c, page, {
      title: 'Event not found | kreators.app',
      description: 'This event is not open here. See the events you can join on kreators.app.',
      url,
      image: `${origin}/og.png`,
      jsonLd: [],
      summaryHtml: `<h1>Not open here</h1>${p('This event is not open here.')}<p><a href="/events">See the events you can join</a></p>`,
      noindex: true,
    });
  }
  const e = found.event;
  const image = found.image ? (found.image.startsWith('/') ? `${origin}${found.image}` : found.image) : null;
  const site: SiteEvent = { id: e.id, title: e.title, description: e.description, startsAt: e.startsAt, endsAt: e.endsAt, online: e.online, venue: e.venue, hostName: e.hostName, status: e.status, pricePoints: e.pricePoints, seatsLeft: e.seatsLeft, image };
  const words = cutWords(e.description, EVENT_DESCRIPTION_MAX);
  const where = e.online ? 'Online' : e.venue || 'Place to be set';
  const summary = [
    `<h1>${escapeHtml(e.title)}</h1>`,
    `<p><time datetime="${escapeHtml(e.startsAt)}">${escapeHtml(whenOf(e))}</time>. ${escapeHtml(where)}.</p>`,
    ...(e.status === 'cancelled' ? [p('This event was cancelled.')] : []),
    ...(e.description.trim() ? [p(e.description)] : []),
    ...(e.hostName ? [p(`Hosted by ${e.hostName}.`)] : []),
    p(e.pricePoints === 0 ? 'Free to join.' : `A ticket is ${formatCount(e.pricePoints)} points.`),
    ...(e.seatsLeft !== null ? [p(e.seatsLeft > 0 ? `${formatCount(e.seatsLeft)} seats left.` : 'No seats left.')] : []),
  ].join('');
  const trail = breadcrumbLd(origin, [{ name: 'kreators.app', path: '/' }, { name: 'Events', path: '/events' }, { name: e.title, path: eventPath(e.id) }]);
  // An event in person with no place typed has no location, which an Event result needs; rather than make one up, the block is left out.
  const located = e.online || e.venue.trim() !== '';
  return withHead(c, page, {
    // The title is held to TITLE_MAX like every other page's; og:title and the Event block keep the whole name.
    title: `${cutWords(e.title, TITLE_MAX - TITLE_TAIL.length)}${TITLE_TAIL}`,
    ogTitle: `${e.title}${TITLE_TAIL}`,
    description: words || `${cutWords(e.title, 120)}: an event on kreators.app. ${where}.`,
    url,
    image: image ?? `${origin}/og.png`,
    jsonLd: located ? [eventLd(origin, site), trail] : [trail],
    summaryHtml: summary,
  });
});

/**
 * The public sitemap, one `<urlset>` on the production origin: the stable pages, each upcoming public event (with the day it was made as its
 * lastmod, since an event keeps no day of its last change), and each live member's switched-on public page that has a live product. Both reads
 * go out together: one D1 round trip.
 */
go.get('/sitemap.xml', async (c) => {
  const db = c.env.DB;
  const origin = siteUrl(c.env.PUBLIC_URL);
  const [events, handles] = await Promise.all([
    db.prepare(`SELECT e.id, e.created_at FROM events e WHERE ${UPCOMING_PUBLIC_WHERE} ORDER BY e.starts_at, e.id LIMIT 1000`).bind(nowIso()).all<{ id: string; created_at: string }>(),
    db
      .prepare(
        `SELECT DISTINCT u.handle FROM users u JOIN products p ON p.owner_id = u.id
         WHERE u.handle IS NOT NULL AND p.status = 'live' AND ${liveUser('u')}
           AND COALESCE(CASE WHEN json_valid(u.public_json) THEN json_extract(u.public_json, '$.pagePublic') END, 1) != 0
         ORDER BY u.handle LIMIT 5000`,
      )
      .all<{ handle: string }>(),
  ]);
  const live: SitemapEntry[] = [
    ...events.results.map((e) => ({ path: eventPath(e.id), lastmod: e.created_at })),
    ...handles.results.map((h) => ({ path: `/u/${encodeURIComponent(h.handle)}` })),
  ];
  const headers: Record<string, string> = { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' };
  if (offProductionHost(c)) headers['X-Robots-Tag'] = 'noindex';
  return c.body(sitemapXml(origin, live), 200, headers);
});

/** Meta and payment webhooks. Mounted at /api/webhooks. */
export const webhooks = new Hono<AppEnv>();

/** Apply one provider event to the order it names. Used by the webhook and by the admin's replay. */
export async function handlePaymentEvent(db: D1Database, env: Env, parsed: { type: string; providerOrderId: string | null; providerPaymentId: string | null; amountCents: number | null }): Promise<string> {
  if (!parsed.providerOrderId && !parsed.providerPaymentId) return 'no order on this event';
  const o = parsed.providerOrderId
    ? await db.prepare(`${ORDER_SELECT} WHERE o.provider_order_id = ?`).bind(parsed.providerOrderId).first<OrderRow & { owner_id: string; intake_json: string }>()
    : await db.prepare(`${ORDER_SELECT} WHERE o.provider_payment_id = ?`).bind(parsed.providerPaymentId).first<OrderRow & { owner_id: string; intake_json: string }>();
  if (!o) return (await handleCallPayment(db, parsed)) ?? 'no order matches';
  const now = new Date().toISOString();
  if (parsed.type === 'payment.captured' || parsed.type === 'order.paid') {
    // A payment can be captured after the cron gave up on the order (a slow UPI or bank approval) or after a failed first try on
    // the same provider order. The money was taken, so the order is still fulfilled.
    if (o.status !== 'pending' && o.status !== 'expired' && o.status !== 'failed') return o.status === 'paid' ? 'already paid' : `capture on an order that is ${o.status}`;
    if (parsed.amountCents !== null && parsed.amountCents !== o.cents) return `amount mismatch: ${parsed.amountCents} vs ${o.cents}`;
    // The status moves first, on its own, and only the event that moved it fulfils: payment.captured and order.paid for the
    // same payment arrive under two event ids, often at once, and must make one DM request, one notice and one receipt.
    const moved = await db
      .prepare("UPDATE orders SET status = 'paid', provider_payment_id = ?, paid_at = ? WHERE id = ? AND status = ?")
      .bind(parsed.providerPaymentId, now, o.id, o.status)
      .run();
    if (moved.meta.changes !== 1) return 'already paid';
    const late = o.status !== 'pending';
    if (late) {
      // The code's use was given back when the order died; the buyer paid the price with the code, so the use is taken again.
      const back = await db.prepare('UPDATE discount_redemptions SET released_at = NULL WHERE ref = ? AND released_at IS NOT NULL').bind(o.id).run();
      if (back.meta.changes > 0) await db.prepare('UPDATE discount_codes SET used_count = used_count + 1 WHERE id = (SELECT code_id FROM discount_redemptions WHERE ref = ? LIMIT 1)').bind(o.id).run();
    }
    if (o.product_kind === 'dm') {
      let question = '';
      try {
        question = String((JSON.parse(o.intake_json || '[]') as unknown[])[0] ?? '');
      } catch {
        question = '';
      }
      const days = await db.prepare('SELECT response_days FROM products WHERE id = ?').bind(o.product_id).first<{ response_days: number | null }>();
      await db
        .prepare("INSERT INTO dm_requests (id, product_id, order_id, owner_id, buyer_id, question, answer, status, due_at, answered_at, created_at) SELECT ?, ?, ?, ?, ?, ?, '', 'open', ?, NULL, ? WHERE NOT EXISTS (SELECT 1 FROM dm_requests WHERE order_id = ?3)")
        .bind(crypto.randomUUID(), o.product_id, o.id, o.owner_id, o.buyer_id, question, new Date(Date.now() + (days?.response_days ?? 3) * 86_400_000).toISOString(), now)
        .run();
    }
    await logEvent(db, 'order', o.id, 'payment.captured', { paymentId: parsed.providerPaymentId, cents: parsed.amountCents, ...(late ? { late: o.status } : {}) });
    await track(db, o.buyer_id, 'payment_succeeded', { productId: o.product_id, method: 'razorpay' });
    await notify(db, o.owner_id, 'order', `${nameOf({ display_name: o.buyer_name })} got ${o.product_title}`, money(o.cents, o.currency), `/shop/products/${o.product_id}`);
    await notify(db, o.buyer_id, 'order', `Paid: ${o.product_title}`, 'It is in My purchases now.', '/library');
    if (o.product_kind === 'course') await connectionsCameTrue(db, 'product', { refId: o.product_id, userId: o.buyer_id });
    const buyer = await db.prepare('SELECT email FROM users WHERE id = ?').bind(o.buyer_id).first<{ email: string | null }>();
    await sendEmail(db, env, { userId: o.buyer_id, to: buyer?.email, subject: `Your receipt: ${o.product_title}`, body: `Paid ${money(o.cents, o.currency)}. Find it under My purchases.` });
    return 'paid';
  }
  if (parsed.type === 'payment.failed') {
    if (o.status !== 'pending') return `already ${o.status}`;
    const failed = await db.prepare("UPDATE orders SET status = 'failed' WHERE id = ? AND status = 'pending'").bind(o.id).run();
    // A discount code's use is given back when the payment did not go through.
    if (failed.meta.changes === 1) await release(db, o.id);
    await logEvent(db, 'order', o.id, 'payment.failed');
    await track(db, o.buyer_id, 'payment_failed', { productId: o.product_id });
    return 'failed';
  }
  if (parsed.type === 'refund.processed') {
    if (o.status === 'refunded') return 'already refunded';
    const refunded = await db.prepare("UPDATE orders SET status = 'refunded', refunded_at = ? WHERE id = ? AND status != 'refunded'").bind(now, o.id).run();
    if (refunded.meta.changes !== 1) return 'already refunded';
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

webhooks.post('/meta', async (c) => {
  const db = c.env.DB;
  if (!c.env.META_APP_SECRET) return c.json({ error: 'Meta is not configured on this deployment' }, 503);
  const raw = await c.req.text();
  const given = (c.req.header('X-Hub-Signature-256') ?? '').replace('sha256=', '');
  const expected = await hmacHex(c.env.META_APP_SECRET, raw);
  if (!given || !safeEqual(given, expected)) return c.json({ error: 'bad signature' }, 401);
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
