import { Hono } from 'hono';
import { AFFILIATE_SHARE, type Lesson, type PublicPage } from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { DATE_RE, nameOf, newId, notify, nowIso, parseList, sessionUser } from '../db';
import { BOOKING_SELECT, ORDER_SELECT, PRODUCT_SELECT, TESTIMONIAL_SELECT, toBooking, toLesson, toOrder, toProduct, toTestimonial, type BookingRow, type LessonRow, type OrderRow, type ProductRow } from './studio';

/** Public: no session needed. */
export const publicPage = new Hono<AppEnv>();

async function ownerByHandle(db: D1Database, handle: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE handle = ?').bind(handle.toLowerCase()).first<UserRow>();
}

publicPage.get('/:handle', async (c) => {
  const db = c.env.DB;
  const owner = await ownerByHandle(db, c.req.param('handle'));
  if (!owner) return c.json({ error: 'no page with that name' }, 404);
  const viewer = await sessionUser(c);
  const [products, testimonials, followers, following, portfolio] = await Promise.all([
    db.prepare(`${PRODUCT_SELECT} WHERE p.owner_id = ? AND p.status = 'live' ORDER BY p.sort_order ASC, p.created_at DESC`).bind(owner.id).all<ProductRow>(),
    db.prepare(`${TESTIMONIAL_SELECT} WHERE t.owner_id = ? AND t.approved = 1 ORDER BY t.created_at DESC LIMIT 20`).bind(owner.id).all<Parameters<typeof toTestimonial>[0]>(),
    db.prepare('SELECT COUNT(*) AS n FROM follows WHERE owner_id = ?').bind(owner.id).first<{ n: number }>(),
    viewer ? db.prepare('SELECT 1 FROM follows WHERE owner_id = ? AND follower_id = ?').bind(owner.id, viewer.id).first() : Promise.resolve(null),
    db.prepare("SELECT * FROM portfolio_items WHERE user_id = ? AND visibility = 'public' ORDER BY created_at DESC LIMIT 30").bind(owner.id).all<{ id: string; title: string; description: string; url: string; visibility: 'public' | 'private'; created_at: string }>(),
  ]);
  if (!viewer || viewer.id !== owner.id) {
    await db.prepare("INSERT INTO page_events (owner_id, kind, ref, created_at) VALUES (?, 'view', NULL, ?)").bind(owner.id, nowIso()).run();
  }
  const page: PublicPage = {
    handle: owner.handle ?? '',
    name: nameOf(owner),
    bio: owner.bio,
    skills: parseList(owner.skills),
    categories: parseList(owner.categories),
    experienceLevel: owner.experience_level,
    availability: owner.availability,
    location: owner.location,
    portfolio: portfolio.results.map((p) => ({ id: p.id, title: p.title, description: p.description, url: p.url, visibility: p.visibility, createdAt: p.created_at })),
    isPro: owner.is_pro === 1,
    followers: followers?.n ?? 0,
    following: Boolean(following),
    products: products.results.map((r) => toProduct(r)),
    testimonials: testimonials.results.map(toTestimonial),
  };
  return c.json(page);
});

publicPage.post('/:handle/click', async (c) => {
  const db = c.env.DB;
  const owner = await ownerByHandle(db, c.req.param('handle'));
  if (!owner) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ ref?: string }>().catch(() => ({}) as { ref?: string });
  await db.prepare("INSERT INTO page_events (owner_id, kind, ref, created_at) VALUES (?, 'click', ?, ?)").bind(owner.id, typeof body.ref === 'string' ? body.ref.slice(0, 80) : null, nowIso()).run();
  return c.json({ ok: true });
});

publicPage.post('/:handle/lead', async (c) => {
  const db = c.env.DB;
  const owner = await ownerByHandle(db, c.req.param('handle'));
  if (!owner) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ name?: string; email?: string; message?: string }>().catch(() => ({}) as Record<string, never>);
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 120) : '';
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'a name and a real email, please' }, 400);
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : '';
  await db.prepare('INSERT INTO leads (id, owner_id, name, email, message, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId(), owner.id, name, email, message, 'page', nowIso()).run();
  await notify(db, owner.id, 'lead', `New lead: ${name}`, message || email, '/shop/audience');
  return c.json({ ok: true }, 201);
});

publicPage.get('/products/:id', async (c) => {
  const db = c.env.DB;
  const row = await db.prepare(`${PRODUCT_SELECT} WHERE p.id = ? AND p.status = 'live'`).bind(c.req.param('id')).first<ProductRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const [lessons, testimonials] = await Promise.all([
    db.prepare('SELECT COUNT(*) AS n FROM lessons WHERE product_id = ?').bind(row.id).first<{ n: number }>(),
    db.prepare(`${TESTIMONIAL_SELECT} WHERE t.product_id = ? AND t.approved = 1 ORDER BY t.created_at DESC LIMIT 20`).bind(row.id).all<Parameters<typeof toTestimonial>[0]>(),
  ]);
  const viewer = await sessionUser(c);
  const owned = viewer ? await db.prepare("SELECT 1 FROM orders WHERE buyer_id = ? AND product_id = ? AND status IN ('paid','test')").bind(viewer.id, row.id).first() : null;
  return c.json({ product: toProduct(row), lessonCount: lessons?.n ?? 0, testimonials: testimonials.results.map(toTestimonial), owned: Boolean(owned) || viewer?.id === row.owner_id });
});

/** Buyer side: needs a session. */
export const store = new Hono<AppEnv>();

/** You have a product if you made it, bought it, or bought a bundle that contains it. */
export async function entitled(db: D1Database, userId: string, productId: string): Promise<boolean> {
  const own = await db.prepare('SELECT 1 FROM products WHERE id = ? AND owner_id = ?').bind(productId, userId).first();
  if (own) return true;
  const direct = await db.prepare("SELECT 1 FROM orders WHERE buyer_id = ? AND product_id = ? AND status IN ('paid','test') AND variant = ''").bind(userId, productId).first();
  if (direct) return true;
  return Boolean(await db.prepare("SELECT 1 FROM orders o JOIN products b ON b.id = o.product_id WHERE o.buyer_id = ? AND o.status IN ('paid','test') AND b.kind = 'bundle' AND b.bundle_json LIKE ?").bind(userId, `%"${productId}"%`).first());
}

/** Which tracked link a purchase came through: the click id from the body or cookie, else a link code from the URL. */
async function attribution(db: D1Database, c: { req: { header: (k: string) => string | undefined } }, body: { click?: string; src?: string }, ownerId: string): Promise<{ linkId: string | null; clickId: string | null }> {
  const cookie = c.req.header('Cookie') ?? '';
  const fromCookie = /(?:^|;\s*)kl_click=([^;]+)/.exec(cookie)?.[1] ?? null;
  const clickId = typeof body.click === 'string' && body.click ? body.click.slice(0, 64) : fromCookie;
  if (clickId) {
    const k = await db.prepare('SELECT link_id FROM link_clicks WHERE id = ? AND owner_id = ?').bind(clickId, ownerId).first<{ link_id: string }>();
    if (k) return { linkId: k.link_id, clickId };
  }
  if (typeof body.src === 'string' && body.src) {
    const l = await db.prepare('SELECT id FROM tracked_links WHERE code = ? AND owner_id = ?').bind(body.src.toLowerCase().slice(0, 20), ownerId).first<{ id: string }>();
    if (l) return { linkId: l.id, clickId: null };
  }
  return { linkId: null, clickId: null };
}

store.post('/:productId/checkout', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const product = await db.prepare(`${PRODUCT_SELECT} WHERE p.id = ? AND p.status = 'live'`).bind(c.req.param('productId')).first<ProductRow>();
  if (!product) return c.json({ error: 'not found' }, 404);
  if (product.owner_id === user.id) return c.json({ error: 'that is your own product' }, 400);
  const body = await c.req.json<{ coupon?: string; affiliate?: string; pay?: string; points?: number; question?: string; intake?: unknown; replay?: boolean; click?: string; src?: string }>().catch(() => ({}) as Record<string, never>);

  // Replays: an event recording sold to people who missed the event.
  const replay = body.replay === true && product.kind === 'event';
  if (replay) {
    if (!product.replay_url || product.replay_points <= 0) return c.json({ error: 'no replay is for sale' }, 400);
    if (product.starts_at && new Date(product.starts_at).getTime() > Date.now()) return c.json({ error: 'the event has not happened yet' }, 400);
    const has = await db.prepare("SELECT 1 FROM orders WHERE buyer_id = ? AND product_id = ? AND status IN ('paid','test') AND variant = 'replay'").bind(user.id, product.id).first();
    if (has || (await entitled(db, user.id, product.id))) return c.json({ error: 'you already have this' }, 409);
  } else {
    // Payment links and priority DMs can be bought again; everything else once.
    if (product.kind !== 'payment' && product.kind !== 'dm' && (await entitled(db, user.id, product.id))) return c.json({ error: 'you already have this' }, 409);
    if (product.capacity !== null && product.sold >= product.capacity) return c.json({ error: 'sold out' }, 409);
  }
  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 2000) : '';
  if (product.kind === 'dm' && !question) return c.json({ error: 'write your question first' }, 400);
  const intakeQs = (() => {
    try {
      const v = JSON.parse(product.intake_json || '[]') as unknown;
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  })();
  const intake = Array.isArray(body.intake) ? body.intake.map((x) => String(x).trim().slice(0, 500)).slice(0, intakeQs.length) : [];
  if (product.kind !== 'session' && intakeQs.length > 0 && intake.filter(Boolean).length < intakeQs.length) return c.json({ error: 'answer the questions first' }, 400);

  let points = replay ? product.replay_points : product.price_points;
  let cents = replay ? 0 : product.price_cents;
  if (product.pwyw === 1 && !replay) {
    const offered = Math.round(Number(body.points));
    if (!Number.isFinite(offered) || offered < product.price_points) return c.json({ error: `pay at least ${product.price_points} points` }, 400);
    points = Math.min(offered, 1_000_000);
  }
  let couponCode: string | null = null;
  if (typeof body.coupon === 'string' && body.coupon.trim()) {
    const code = body.coupon.trim().toUpperCase();
    const coupon = await db
      .prepare('SELECT * FROM coupons WHERE owner_id = ? AND code = ? AND (product_id IS NULL OR product_id = ?) AND (max_uses IS NULL OR uses < max_uses) AND (expires_at IS NULL OR expires_at > ?)')
      .bind(product.owner_id, code, product.id, nowIso())
      .first<{ id: string; percent_off: number }>();
    if (!coupon) return c.json({ error: 'that coupon does not work here' }, 400);
    points = Math.round(points * (1 - coupon.percent_off / 100));
    cents = Math.round(cents * (1 - coupon.percent_off / 100));
    couponCode = code;
    await db.prepare('UPDATE coupons SET uses = uses + 1 WHERE id = ?').bind(coupon.id).run();
  }
  const pay = body.pay === 'test' ? 'test' : 'points';
  // Money checkout stays in test mode until a payment provider is connected:
  // the order is recorded, nothing is charged.
  const status: 'paid' | 'test' = pay === 'test' ? 'test' : 'paid';
  if (pay === 'points' && user.points < points) return c.json({ error: `you need ${points - user.points} more points` }, 400);
  let affiliateCode: string | null = null;
  let affiliate: UserRow | null = null;
  if (typeof body.affiliate === 'string' && body.affiliate.trim()) {
    affiliate = await db.prepare('SELECT * FROM users WHERE referral_code = ?').bind(body.affiliate.trim().toUpperCase()).first<UserRow>();
    if (affiliate && affiliate.id !== user.id && affiliate.id !== product.owner_id) affiliateCode = affiliate.referral_code;
    else affiliate = null;
  }
  const owner = await db.prepare('SELECT fee_bps FROM users WHERE id = ?').bind(product.owner_id).first<{ fee_bps: number }>();
  const feeBps = owner?.fee_bps ?? 500;
  const paidPoints = pay === 'points' ? points : 0;
  const fee = Math.round((paidPoints * feeBps) / 10000);
  const share = affiliate ? Math.round(paidPoints * AFFILIATE_SHARE) : 0;
  const src = await attribution(db, c, body, product.owner_id);

  const id = newId();
  const now = nowIso();
  const stmts = [
    db
      .prepare('INSERT INTO orders (id, buyer_id, product_id, owner_id, points, cents, currency, status, coupon_code, affiliate_code, created_at, source_link_id, click_id, platform_fee_points, intake_json, variant) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, user.id, product.id, product.owner_id, paidPoints, pay === 'test' ? cents : 0, product.currency, status, couponCode, affiliateCode, now, src.linkId, src.clickId, fee, JSON.stringify(intake), replay ? 'replay' : ''),
  ];
  if (paidPoints > 0) {
    stmts.push(
      db.prepare('UPDATE users SET points = points - ? WHERE id = ? AND points >= ?').bind(paidPoints, user.id, paidPoints),
      db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(user.id, -paidPoints, 'purchase', id, now),
      db.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(paidPoints - share - fee, product.owner_id),
      db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(product.owner_id, paidPoints - share - fee, 'sale', id, now),
    );
    if (affiliate && share > 0) {
      stmts.push(
        db.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(share, affiliate.id),
        db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(affiliate.id, share, 'affiliate', id, now),
      );
    }
  }
  if (product.kind === 'dm') {
    stmts.push(
      db
        .prepare("INSERT INTO dm_requests (id, product_id, order_id, owner_id, buyer_id, question, answer, status, due_at, answered_at, created_at) VALUES (?, ?, ?, ?, ?, ?, '', 'open', ?, NULL, ?)")
        .bind(newId(), product.id, id, product.owner_id, user.id, question, new Date(Date.now() + (product.response_days ?? 3) * 86_400_000).toISOString(), now),
    );
  }
  // A free download that is a lead magnet captures the buyer as a lead.
  if (product.lead_magnet === 1 && paidPoints === 0 && cents === 0) {
    stmts.push(db.prepare('INSERT INTO leads (id, owner_id, name, email, message, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId(), product.owner_id, nameOf(user), user.email ?? '', `Got ${product.title}`, 'lead_magnet', now));
  }
  await db.batch(stmts);
  await notify(db, product.owner_id, 'order', `${nameOf(user)} got ${product.title}${replay ? ' (replay)' : ''}`, pay === 'points' ? `${points} points${src.linkId ? ', via a tracked link' : ''}` : `${(cents / 100).toFixed(2)} ${product.currency}, test mode`, product.kind === 'dm' ? '/shop/dm' : `/shop/products/${product.id}`);
  if (affiliate) await notify(db, affiliate.id, 'affiliate', 'Your link made a sale', `${product.title}, ${share} points to you`, '/shop/audience');
  const row = await db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).bind(id).first<OrderRow>();
  return c.json({ order: row ? toOrder(row) : null }, 201);
});

store.get('/browse', async (c) => {
  const kind = c.req.query('kind');
  const rows =
    kind === 'session' || kind === 'event'
      ? await c.env.DB.prepare(`${PRODUCT_SELECT} WHERE p.status = 'live' AND p.kind = ? ORDER BY p.starts_at ASC, p.created_at DESC LIMIT 100`).bind(kind).all<ProductRow>()
      : await c.env.DB.prepare(`${PRODUCT_SELECT} WHERE p.status = 'live' ORDER BY p.created_at DESC LIMIT 100`).all<ProductRow>();
  return c.json({ products: rows.results.map((r) => toProduct(r)) });
});

store.get('/library', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const [orders, bookings] = await Promise.all([
    db.prepare(`${ORDER_SELECT} WHERE o.buyer_id = ? AND o.status IN ('paid','test') ORDER BY o.created_at DESC LIMIT 200`).bind(user.id).all<OrderRow>(),
    db.prepare(`${BOOKING_SELECT} WHERE k.buyer_id = ? ORDER BY k.starts_at DESC LIMIT 100`).bind(user.id).all<BookingRow>(),
  ]);
  const ids = orders.results.map((o) => o.product_id);
  const products = ids.length ? await db.prepare(`${PRODUCT_SELECT} WHERE p.id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<ProductRow>() : { results: [] as ProductRow[] };
  return c.json({ orders: orders.results.map(toOrder), products: products.results.map((r) => toProduct(r)), bookings: bookings.results.map(toBooking) });
});

store.get('/products/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).bind(c.req.param('id')).first<ProductRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const replayOnly = row.kind === 'event' && Boolean(await db.prepare("SELECT 1 FROM orders WHERE buyer_id = ? AND product_id = ? AND status IN ('paid','test') AND variant = 'replay'").bind(user.id, row.id).first());
  if (!replayOnly && !(await entitled(db, user.id, row.id))) return c.json({ error: 'you do not have this yet' }, 403);
  const order = await db.prepare("SELECT created_at FROM orders WHERE buyer_id = ? AND product_id = ? AND status IN ('paid','test') ORDER BY created_at ASC LIMIT 1").bind(user.id, row.id).first<{ created_at: string }>();
  const since = order ? new Date(order.created_at).getTime() : 0;
  const [lessons, done, attempts, cert] = await Promise.all([
    db.prepare('SELECT * FROM lessons WHERE product_id = ? ORDER BY sort_order ASC, created_at ASC').bind(row.id).all<LessonRow>(),
    db.prepare('SELECT lesson_id, completed_at FROM lesson_progress WHERE user_id = ?').bind(user.id).all<{ lesson_id: string; completed_at: string }>(),
    db.prepare('SELECT lesson_id, score, passed FROM quiz_attempts WHERE user_id = ?').bind(user.id).all<{ lesson_id: string; score: number; passed: number }>(),
    db.prepare('SELECT code FROM certificates WHERE user_id = ? AND product_id = ?').bind(user.id, row.id).first<{ code: string }>(),
  ]);
  const doneBy = new Map(done.results.map((d) => [d.lesson_id, d.completed_at]));
  const tried = new Map(attempts.results.map((a) => [a.lesson_id, a]));
  const list: Lesson[] = lessons.results.map((l) => {
    const unlockAt = since + l.drip_days * 86_400_000;
    const unlocked = row.owner_id === user.id || Date.now() >= unlockAt;
    const t = tried.get(l.id);
    return { ...toLesson(l, row.owner_id === user.id), unlocked, unlocksOn: unlocked ? null : new Date(unlockAt).toISOString(), completedAt: doneBy.get(l.id) ?? null, body: unlocked ? l.body : '', videoUrl: unlocked ? l.video_url : null, quizScore: t?.score ?? null, quizPassed: t?.passed === 1 };
  });
  // A replay is yours if you bought the ticket or bought the replay itself.
  const replayBought = await db.prepare("SELECT 1 FROM orders WHERE buyer_id = ? AND product_id = ? AND status IN ('paid','test') AND variant = 'replay'").bind(user.id, row.id).first();
  const product = toProduct(row, true);
  if (row.kind === 'event' && !replayBought && !(await entitled(db, user.id, row.id))) product.replayUrl = null;
  return c.json({ product, lessons: list, certificateCode: cert?.code ?? null });
});

store.post('/lessons/:id/complete', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const lesson = await db.prepare('SELECT product_id FROM lessons WHERE id = ?').bind(c.req.param('id')).first<{ product_id: string }>();
  if (!lesson || !(await entitled(db, user.id, lesson.product_id))) return c.json({ error: 'not found' }, 404);
  await db.prepare('INSERT OR IGNORE INTO lesson_progress (user_id, lesson_id, completed_at) VALUES (?, ?, ?)').bind(user.id, c.req.param('id'), nowIso()).run();
  return c.json({ ok: true });
});

/** Free slots on a date for a session product, from the owner's availability. */
store.get('/:productId/slots', async (c) => {
  const db = c.env.DB;
  const product = await db.prepare(`${PRODUCT_SELECT} WHERE p.id = ? AND p.kind = 'session'`).bind(c.req.param('productId')).first<ProductRow>();
  if (!product) return c.json({ error: 'not found' }, 404);
  const date = c.req.query('date') ?? '';
  if (!DATE_RE.test(date)) return c.json({ error: 'date required' }, 400);
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const step = product.duration_min ?? 30;
  const [avail, taken] = await Promise.all([
    db.prepare('SELECT start_min, end_min FROM availability WHERE owner_id = ? AND weekday = ?').bind(product.owner_id, weekday).all<{ start_min: number; end_min: number }>(),
    db.prepare("SELECT starts_at FROM bookings WHERE owner_id = ? AND status IN ('requested','confirmed') AND starts_at LIKE ?").bind(product.owner_id, `${date}%`).all<{ starts_at: string }>(),
  ]);
  const busy = new Set(taken.results.map((t) => t.starts_at));
  const slots: string[] = [];
  for (const a of avail.results) {
    for (let m = a.start_min; m + step <= a.end_min; m += step) {
      const iso = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), Math.floor(m / 60), m % 60)).toISOString();
      if (!busy.has(iso) && new Date(iso).getTime() > Date.now()) slots.push(iso);
    }
  }
  return c.json({ slots, durationMin: step });
});

store.post('/:productId/book', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const product = await db.prepare(`${PRODUCT_SELECT} WHERE p.id = ? AND p.kind = 'session'`).bind(c.req.param('productId')).first<ProductRow>();
  if (!product) return c.json({ error: 'not found' }, 404);
  if (!(await entitled(db, user.id, product.id))) return c.json({ error: 'get the session first, then book a time' }, 403);
  const body = await c.req.json<{ startsAt?: string; note?: string; intake?: unknown }>().catch(() => ({}) as Record<string, never>);
  const startsAt = typeof body.startsAt === 'string' ? body.startsAt : '';
  const questions = (() => {
    try {
      const v = JSON.parse(product.intake_json || '[]') as unknown;
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  })();
  const intake = Array.isArray(body.intake) ? body.intake.map((x) => String(x).trim().slice(0, 500)).slice(0, questions.length) : [];
  if (questions.length > 0 && intake.filter(Boolean).length < questions.length) return c.json({ error: 'answer the questions first' }, 400);
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) return c.json({ error: 'pick a time in the future' }, 400);
  const step = product.duration_min ?? 30;
  const end = new Date(start.getTime() + step * 60_000);
  const clash = await db.prepare("SELECT 1 FROM bookings WHERE owner_id = ? AND status IN ('requested','confirmed') AND starts_at = ?").bind(product.owner_id, start.toISOString()).first();
  if (clash) return c.json({ error: 'that time was just taken' }, 409);
  const id = newId();
  try {
    await db.prepare('INSERT INTO bookings (id, product_id, owner_id, buyer_id, order_id, starts_at, ends_at, status, meeting_url, note, intake_json, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, product.id, product.owner_id, user.id, start.toISOString(), end.toISOString(), 'requested', product.meeting_url, typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '', JSON.stringify(intake), nowIso())
      .run();
  } catch {
    // The unique index on live bookings caught a race for the same slot.
    return c.json({ error: 'that time was just taken' }, 409);
  }
  await notify(db, product.owner_id, 'booking', `${nameOf(user)} requested a session`, start.toUTCString(), '/shop/bookings');
  const row = await db.prepare(`${BOOKING_SELECT} WHERE k.id = ?`).bind(id).first<BookingRow>();
  return c.json({ booking: row ? toBooking(row) : null }, 201);
});

store.post('/bookings/:id/cancel', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const prev = await db.prepare(`${BOOKING_SELECT} WHERE k.id = ? AND k.buyer_id = ?`).bind(c.req.param('id'), user.id).first<BookingRow>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  await db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").bind(prev.id).run();
  await notify(db, prev.owner_id, 'booking', `${nameOf(user)} cancelled a session`, new Date(prev.starts_at).toUTCString(), '/shop/bookings');
  return c.json({ ok: true });
});

store.post('/:productId/review', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const product = await db.prepare('SELECT id, owner_id FROM products WHERE id = ?').bind(c.req.param('productId')).first<{ id: string; owner_id: string }>();
  if (!product) return c.json({ error: 'not found' }, 404);
  if (product.owner_id === user.id || !(await entitled(db, user.id, product.id))) return c.json({ error: 'only buyers can review' }, 403);
  const body = await c.req.json<{ rating?: number; body?: string }>().catch(() => ({}) as Record<string, never>);
  const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating))));
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 600) : '';
  if (!Number.isFinite(rating) || !text) return c.json({ error: 'a rating and a few words' }, 400);
  await db.prepare('INSERT OR REPLACE INTO testimonials (id, product_id, owner_id, author_id, rating, body, approved, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)').bind(newId(), product.id, product.owner_id, user.id, rating, text, nowIso()).run();
  await notify(db, product.owner_id, 'review', `${nameOf(user)} left a review`, text.slice(0, 120), '/shop/testimonials');
  return c.json({ ok: true }, 201);
});

store.post('/follow/:handle', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const owner = await ownerByHandle(db, c.req.param('handle'));
  if (!owner) return c.json({ error: 'not found' }, 404);
  if (owner.id === user.id) return c.json({ error: 'that is you' }, 400);
  const had = await db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND owner_id = ?').bind(user.id, owner.id).first();
  if (had) await db.prepare('DELETE FROM follows WHERE follower_id = ? AND owner_id = ?').bind(user.id, owner.id).run();
  else {
    await db.prepare('INSERT INTO follows (follower_id, owner_id, created_at) VALUES (?, ?, ?)').bind(user.id, owner.id, nowIso()).run();
    await notify(db, owner.id, 'follow', `${nameOf(user)} followed you`, '', '/shop/audience');
  }
  return c.json({ following: !had });
});
