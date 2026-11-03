import { Hono, type Context } from 'hono';
import { rewardSocial, trustFor } from '../rewards';
import { money, percentOff, productPayWays, unlockFor } from '@kreators/shared';
import { haveFor } from '../unlocks';
import { pageOf, paged } from '../db';
import { AFFILIATE_SHARE, levelFromXp, type Lesson, type PublicPage } from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { DATE_RE, nameOf, newId, notify, nowIso, parseList, parseSocials, sessionUser, publicOf, getStats, badgeState, publicBadgeKeys, honorKeys, linksOf } from '../db';
import { slotsFor, type AvailabilityOverride } from '@kreators/shared';
import { paymentsConfig, providerFor } from '../payments';
import { logEvent, sendEmail, track } from '../ops';
import { quoteCode, redeem, release, type Quoted } from '../discounts';
import { BOOKING_SELECT, ORDER_SELECT, PRODUCT_SELECT, TESTIMONIAL_SELECT, toBooking, toLesson, toOrder, toProduct, toTestimonial, type BookingRow, type LessonRow, type OrderRow, type ProductRow } from './studio';

/** Public: no session needed. */
export const publicPage = new Hono<AppEnv>();

async function ownerByHandle(db: D1Database, handle: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE handle = ?').bind(handle.toLowerCase()).first<UserRow>();
}

/** A page for someone without a page name, reached from the community feed. Same shape, same privacy. */
async function ownerById(db: D1Database, id: string): Promise<UserRow | null> {
  return db.prepare("SELECT * FROM users WHERE id = ? AND display_name != ''").bind(id).first<UserRow>();
}

/** What the browser needs to know before checkout: whether money is live and with which key. */
publicPage.get('/config', (c) => c.json(paymentsConfig(c.env)));

publicPage.get('/people/:id', async (c) => {
  const owner = await ownerById(c.env.DB, c.req.param('id'));
  if (!owner) return c.json({ error: 'no such person' }, 404);
  return c.json(await pageFor(c, owner));
});

publicPage.get('/:handle', async (c) => {
  const owner = await ownerByHandle(c.env.DB, c.req.param('handle'));
  if (!owner) return c.json({ error: 'no page with that name' }, 404);
  return c.json(await pageFor(c, owner));
});

async function pageFor(c: Context<AppEnv>, owner: UserRow): Promise<PublicPage> {
  const db = c.env.DB;
  const viewer = await sessionUser(c);
  const mine = Boolean(viewer && viewer.id === owner.id);
  const ps = publicOf(owner);
  // A page that is switched off shows nothing to anyone but its owner.
  const open = mine || ps.pagePublic;
  const shows = {
    socials: open && ps.showSocials,
    blocks: open && ps.showBlocks,
    portfolio: open && ps.showPortfolio,
    products: open && ps.showProducts,
    posts: open && ps.showPosts,
    activity: open && ps.showActivity,
    badges: open && ps.showBadges,
  };
  const [products, testimonials, followers, following, portfolio] = await Promise.all([
    db.prepare(`${PRODUCT_SELECT} WHERE p.owner_id = ? AND p.status = 'live' ORDER BY p.sort_order ASC, p.created_at DESC`).bind(owner.id).all<ProductRow>(),
    db.prepare(`${TESTIMONIAL_SELECT} WHERE t.owner_id = ? AND t.approved = 1 ORDER BY t.created_at DESC LIMIT 20`).bind(owner.id).all<Parameters<typeof toTestimonial>[0]>(),
    db.prepare('SELECT COUNT(*) AS n FROM follows WHERE owner_id = ?').bind(owner.id).first<{ n: number }>(),
    viewer ? db.prepare('SELECT 1 FROM follows WHERE owner_id = ? AND follower_id = ?').bind(owner.id, viewer.id).first() : Promise.resolve(null),
    db.prepare("SELECT * FROM portfolio_items WHERE user_id = ? AND visibility = 'public' ORDER BY created_at DESC LIMIT 30").bind(owner.id).all<{ id: string; title: string; description: string; url: string; visibility: 'public' | 'private'; created_at: string }>(),
  ]);
  // None of these depends on another (the page view is only a count), so they go out together.
  const [posts, stats, honors, friend, trust] = await Promise.all([
    shows.posts
      ? db
          .prepare('SELECT p.id, p.category, p.body, p.created_at, (SELECT COUNT(*) FROM community_likes l WHERE l.post_id = p.id) AS likes, (SELECT COUNT(*) FROM community_replies r WHERE r.post_id = p.id AND r.hidden_at IS NULL) AS replies FROM community_posts p WHERE p.user_id = ? AND p.anonymous = 0 AND p.hidden_at IS NULL AND p.product_id IS NULL ORDER BY p.created_at DESC LIMIT 10')
          .bind(owner.id)
          .all<{ id: string; category: string; body: string; created_at: string; likes: number; replies: number }>()
      : Promise.resolve({ results: [] }),
    shows.activity || shows.badges ? getStats(db, owner.id) : Promise.resolve(null),
    shows.badges ? honorKeys(db, owner) : Promise.resolve([] as string[]),
    viewer && viewer.id !== owner.id ? db.prepare('SELECT id, requester_id, status FROM friendships WHERE (requester_id = ?1 AND recipient_id = ?2) OR (requester_id = ?2 AND recipient_id = ?1)').bind(viewer.id, owner.id).first<{ id: string; requester_id: string; status: string }>() : Promise.resolve(null),
    trustFor(db, owner.id),
    !mine && open ? db.prepare("INSERT INTO page_events (owner_id, kind, ref, created_at) VALUES (?, 'view', NULL, ?)").bind(owner.id, nowIso()).run() : Promise.resolve(null),
  ]);
  // Only the badges that are public: the journal, money and focus families never leave their owner. Reading another person's page writes nothing.
  const shownBadges = stats && shows.badges ? publicBadgeKeys((await badgeState(db, owner, { stats, persist: false })).keys) : [];
  const page: PublicPage = {
    id: owner.id,
    handle: owner.handle ?? '',
    name: nameOf(owner),
    friend: !friend ? 'none' : friend.status === 'accepted' ? 'friends' : friend.requester_id === viewer?.id ? 'sent' : 'pending',
    friendRequestId: friend?.id ?? null,
    bio: owner.bio,
    skills: parseList(owner.skills),
    categories: parseList(owner.categories),
    experienceLevel: owner.experience_level,
    availability: owner.availability,
    location: owner.location,
    portfolio: shows.portfolio ? portfolio.results.map((p) => ({ id: p.id, title: p.title, description: p.description, url: p.url, visibility: p.visibility, createdAt: p.created_at })) : [],
    avatarUrl: open ? (owner.avatar_url ?? '') : '',
    socials: shows.socials ? parseSocials(owner.socials_json) : { instagram: '', youtube: '', x: '', website: '' },
    timezone: owner.timezone || 'Asia/Kolkata',
    isPro: owner.is_pro === 1,
    followers: followers?.n ?? 0,
    trust,
    following: Boolean(following),
    products: shows.products ? products.results.map((r) => toProduct(r)) : [],
    testimonials: open ? testimonials.results.map(toTestimonial) : [],
    mine,
    isPrivate: !open,
    shows,
    allowFriendRequests: open && ps.allowFriendRequests,
    allowChats: open && ps.allowChats,
    posts: posts.results.map((p) => ({ id: p.id, category: p.category, body: p.body, likes: p.likes, replies: p.replies, createdAt: p.created_at })),
    activity: stats && shows.activity ? { level: levelFromXp(owner.xp), streak: owner.streak, areasSetUp: stats.relationshipsWithPillars, memberSince: owner.created_at } : null,
    badges: shownBadges,
    honors,
    links: shows.blocks ? linksOf(owner).filter((b) => b.on) : [],
  };
  if (!open) {
    // Only the name and the fact that the page is private.
    return { ...page, bio: '', skills: [], categories: [], experienceLevel: '', availability: '', location: '', portfolio: [], followers: 0 };
  }
  return page;
}

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
  const have = viewer ? await haveFor(db, viewer) : null;
  return c.json({ product: toProduct(row), lessonCount: lessons?.n ?? 0, testimonials: testimonials.results.map(toTestimonial), owned: Boolean(owned) || viewer?.id === row.owner_id, seller: { trust: await trustFor(db, row.owner_id) }, unlock: unlockFor({ minPoints: row.min_points, minXp: row.min_xp, badge: row.badge }, have) });
});

/** Buyer side: needs a session. */
export const store = new Hono<AppEnv>();

/** You have a product if you made it, bought it, or bought a bundle that contains it. */
export async function entitled(db: D1Database, userId: string, productId: string): Promise<boolean> {
  const own = await db.prepare('SELECT 1 FROM products WHERE id = ? AND owner_id = ?').bind(productId, userId).first();
  if (own) return true;
  const direct = await db.prepare("SELECT 1 FROM orders WHERE buyer_id = ? AND product_id = ? AND status IN ('paid','test') AND variant = '' AND (expires_at IS NULL OR expires_at > ?)").bind(userId, productId, nowIso()).first();
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
  // Some things are for people who have earned their way: a points balance, a badge, or both.
  if (product.min_points > 0 || product.min_xp > 0 || product.badge) {
    const gate = unlockFor({ minPoints: product.min_points, minXp: product.min_xp, badge: product.badge }, await haveFor(db, user));
    if (!gate.ok) return c.json({ error: gate.why, unlock: gate }, 403);
  }
  const body = await c.req.json<{ coupon?: string; discountCode?: string; affiliate?: string; pay?: string; points?: number; question?: string; intake?: unknown; replay?: boolean; click?: string; src?: string }>().catch(() => ({}) as Record<string, never>);

  if (typeof body.coupon === 'string' && body.coupon.trim() && typeof body.discountCode === 'string' && body.discountCode.trim()) return c.json({ error: 'Use one code at a time: the creator coupon or the kreators.app code.' }, 400);

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

  // Not every product takes points: one priced in money only is bought with money, never free by sending `pay: 'points'`.
  if (!replay && body.pay !== 'test' && body.pay !== 'money' && !productPayWays({ pricePoints: product.price_points, priceCents: product.price_cents, pwyw: product.pwyw === 1 }).points) {
    return c.json({ error: 'This one is paid for with money, not points.' }, 400);
  }
  let points = replay ? product.replay_points : product.price_points;
  let cents = replay ? 0 : product.price_cents;
  if (product.pwyw === 1 && !replay) {
    const offered = Math.round(Number(body.points));
    if (!Number.isFinite(offered) || offered < product.price_points) return c.json({ error: `pay at least ${product.price_points} points` }, 400);
    points = Math.min(offered, 1_000_000);
  }
  let couponCode: string | null = null;
  let couponId: string | null = null;
  if (typeof body.coupon === 'string' && body.coupon.trim()) {
    const code = body.coupon.trim().toUpperCase();
    const coupon = await db
      .prepare('SELECT * FROM coupons WHERE owner_id = ? AND code = ? AND (product_id IS NULL OR product_id = ?) AND (max_uses IS NULL OR uses < max_uses) AND (expires_at IS NULL OR expires_at > ?)')
      .bind(product.owner_id, code, product.id, nowIso())
      .first<{ id: string; percent_off: number }>();
    if (!coupon) return c.json({ error: 'that coupon does not work here' }, 400);
    // Whole numbers only: the amount off rounds down, the same way a team code does. The use is taken later, once nothing can fail first.
    const bps = Math.round(Number(coupon.percent_off) * 100);
    points -= percentOff(points, bps);
    cents -= percentOff(cents, bps);
    couponCode = code;
    couponId = coupon.id;
  }
  // Money is only asked for when the product has a money price; a product priced in points only is never free through the test path.
  const wantsMoney = (body.pay === 'test' || body.pay === 'money') && cents > 0;
  // A code from the team (not the creator's own coupon above). The price is worked out here from the product's own price, for the way the
  // person chose to pay: money, or points. The platform pays what the code takes off, so the seller is still settled on the list price.
  const listCents = wantsMoney ? cents : 0;
  const listPoints = wantsMoney ? 0 : points;
  let discount: Extract<Quoted, { ok: true }> | null = null;
  if (typeof body.discountCode === 'string' && body.discountCode.trim()) {
    if (couponCode) return c.json({ error: 'Use one code at a time: the creator coupon or the kreators.app code.' }, 400);
    // Pay what you want: the code's percent comes off the product's own minimum, never off the amount typed.
    const pwywPoints = product.pwyw === 1 && !replay && !wantsMoney ? { basePoints: product.price_points } : {};
    const q = await quoteCode(db, user.id, body.discountCode, 'product', product.id, { cents: listCents, points: listPoints, currency: product.currency, ...pwywPoints });
    if (!q.ok) return c.json({ error: q.why }, 400);
    discount = q;
    if (wantsMoney) cents = q.quote.payCents;
    else points = q.quote.payPoints;
  }
  const provider = providerFor(c.env);
  // With provider keys, money orders wait for the provider's webhook; without them the order is recorded and nothing is charged.
  // A money order that a code brought to nothing is a free order: no provider is asked and it is paid at once.
  const live = wantsMoney && provider.name === 'razorpay' && cents > 0;
  const pay = wantsMoney && cents > 0 ? 'test' : 'points';
  const status: 'paid' | 'test' | 'pending' = live ? 'pending' : pay === 'test' ? 'test' : 'paid';
  // What the person pays in points: nothing on the money path, whatever the product also costs in points.
  const owe = pay === 'points' && !wantsMoney ? points : 0;
  await track(db, user.id, 'checkout_started', { productId: product.id, kind: product.kind, points: owe, cents, live });
  if (owe > 0 && user.points < owe) return c.json({ error: `you need ${owe - user.points} more points` }, 400);
  let affiliateCode: string | null = null;
  let affiliate: UserRow | null = null;
  if (typeof body.affiliate === 'string' && body.affiliate.trim()) {
    affiliate = await db.prepare('SELECT * FROM users WHERE referral_code = ?').bind(body.affiliate.trim().toUpperCase()).first<UserRow>();
    if (affiliate && affiliate.id !== user.id && affiliate.id !== product.owner_id) affiliateCode = affiliate.referral_code;
    else affiliate = null;
  }
  const owner = await db.prepare('SELECT fee_bps FROM users WHERE id = ?').bind(product.owner_id).first<{ fee_bps: number }>();
  const feeBps = owner?.fee_bps ?? 500;
  const paidPoints = owe;
  // The seller's side is worked out on the list price, so a code the platform pays for never costs the seller anything.
  const settledPoints = wantsMoney ? 0 : listPoints;
  const fee = Math.round((settledPoints * feeBps) / 10000);
  const share = affiliate ? Math.round(settledPoints * AFFILIATE_SHARE) : 0;
  const src = await attribution(db, c, body, product.owner_id);

  const id = newId();
  const now = nowIso();
  // Take the use of the code first (two guarded statements), and give it back if anything below fails.
  if (discount) {
    const why = await redeem(db, { row: discount.row, userId: user.id, area: 'product', itemId: product.id, ref: id, offCents: discount.quote.offCents, offPoints: discount.quote.offPoints, currency: product.currency });
    if (why) return c.json({ error: why }, 409);
  }
  // The points leave the buyer first, with a guarded update, so two taps at once cannot spend the same points twice.
  if (paidPoints > 0) {
    const debit = await db.prepare('UPDATE users SET points = points - ? WHERE id = ? AND points >= ?').bind(paidPoints, user.id, paidPoints).run();
    if (debit.meta.changes !== 1) {
      if (discount) await release(db, id);
      return c.json({ error: `you need ${paidPoints - user.points} more points` }, 400);
    }
  }
  // The creator's coupon use is taken now, guarded on max_uses, so two buyers cannot both take the last one, and a checkout
  // that stopped earlier never spent one.
  let couponTaken = false;
  const undo = async () => {
    if (paidPoints > 0) await db.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(paidPoints, user.id).run();
    if (discount) await release(db, id);
    if (couponTaken && couponId) await db.prepare('UPDATE coupons SET uses = uses - 1 WHERE id = ? AND uses > 0').bind(couponId).run();
  };
  if (couponId) {
    const took = await db.prepare('UPDATE coupons SET uses = uses + 1 WHERE id = ? AND (max_uses IS NULL OR uses < max_uses) AND (expires_at IS NULL OR expires_at > ?)').bind(couponId, now).run();
    if (took.meta.changes !== 1) {
      await undo();
      return c.json({ error: 'that coupon has just run out' }, 409);
    }
    couponTaken = true;
  }
  let providerOrderId: string | null = null;
  if (live) {
    try {
      providerOrderId = (await provider.createOrder({ amountCents: cents, currency: product.currency, receipt: id, notes: { product: product.title.slice(0, 60) } })).providerOrderId;
    } catch (e) {
      await undo();
      return c.json({ error: e instanceof Error ? e.message : 'the payment provider is not answering' }, 502);
    }
  }
  const expiresAt = product.kind === 'membership' && product.period_months ? new Date(Date.now() + product.period_months * 30 * 86_400_000).toISOString() : null;
  const stmts = [
    db
      .prepare('INSERT INTO orders (id, buyer_id, product_id, owner_id, points, cents, currency, status, coupon_code, affiliate_code, created_at, source_link_id, click_id, platform_fee_points, intake_json, variant, provider, provider_order_id, paid_at, expires_at, list_cents, list_points, discount_code_id, discount_cents, discount_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, user.id, product.id, product.owner_id, paidPoints, pay === 'test' ? cents : 0, product.currency, status, couponCode, affiliateCode, now, src.linkId, src.clickId, fee, JSON.stringify(product.kind === 'dm' && live ? [question] : intake), replay ? 'replay' : '', live ? 'razorpay' : pay === 'test' ? 'test' : 'points', providerOrderId, live ? null : now, expiresAt, discount ? listCents : 0, discount ? listPoints : 0, discount?.row.id ?? null, discount ? discount.quote.offCents : 0, discount ? discount.quote.offPoints : 0),
  ];
  // The buyer's points already left above. The seller is credited on the list price; the difference is what the code took off, paid by the platform.
  if (settledPoints > 0) {
    if (paidPoints > 0) stmts.push(db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(user.id, -paidPoints, 'purchase', id, now));
    stmts.push(
      db.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(settledPoints - share - fee, product.owner_id),
      db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(product.owner_id, settledPoints - share - fee, 'sale', id, now),
    );
    if (affiliate && share > 0) {
      stmts.push(
        db.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(share, affiliate.id),
        db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)').bind(affiliate.id, share, 'affiliate', id, now),
      );
    }
  }
  if (product.kind === 'dm' && !live) {
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
  try {
    await db.batch(stmts);
  } catch (e) {
    await undo();
    throw e;
  }
  await logEvent(db, 'order', id, live ? 'order.pending' : 'order.paid', { points: paidPoints, cents, provider: live ? 'razorpay' : pay, ...(discount ? { code: discount.row.code, offCents: discount.quote.offCents, offPoints: discount.quote.offPoints } : {}) });
  if (!live) {
    await track(db, user.id, 'payment_succeeded', { productId: product.id, method: pay });
    await notify(db, product.owner_id, 'order', `${nameOf(user)} got ${product.title}${replay ? ' (replay)' : ''}`, pay === 'points' ? `${paidPoints} points${src.linkId ? ', via a tracked link' : ''}` : `${money(cents, product.currency)}, test mode`, product.kind === 'dm' ? '/shop/dm' : `/shop/products/${product.id}`);
    if (affiliate) await notify(db, affiliate.id, 'affiliate', 'Your link made a sale', `${product.title}, ${share} points to you`, '/shop/audience');
    await sendEmail(db, c.env, { userId: user.id, to: user.email, subject: `Your receipt: ${product.title}`, body: `You got ${product.title}${pay === 'points' && paidPoints > 0 ? ` for ${paidPoints} points` : ''}${discount ? ` with the code ${discount.row.code}` : ''}. Find it under My purchases.` });
  }
  const row = await db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).bind(id).first<OrderRow>();
  return c.json({ order: row ? toOrder(row) : null, payment: live ? { mode: 'razorpay' as const, keyId: paymentsConfig(c.env).keyId, providerOrderId, amountCents: cents, currency: product.currency } : null }, 201);
});

/** Poll an order while the provider confirms it. */
store.get('/orders/:id', async (c) => {
  const row = await c.env.DB.prepare(`${ORDER_SELECT} WHERE o.id = ? AND o.buyer_id = ?`).bind(c.req.param('id'), c.get('user').id).first<OrderRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.json({ order: toOrder(row) });
});

store.get('/browse', async (c) => {
  const kind = c.req.query('kind');
  const ask = pageOf(c);
  const rows =
    kind === 'session' || kind === 'event'
      ? await c.env.DB.prepare(`${PRODUCT_SELECT} WHERE p.status = 'live' AND p.kind = ? ORDER BY p.starts_at ASC, p.created_at DESC LIMIT ? OFFSET ?`).bind(kind, ask.limit, ask.offset).all<ProductRow>()
      : await c.env.DB.prepare(`${PRODUCT_SELECT} WHERE p.status = 'live' ORDER BY p.created_at DESC LIMIT ? OFFSET ?`).bind(ask.limit, ask.offset).all<ProductRow>();
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, products: pg.items.map((r) => toProduct(r)) });
});

store.get('/library', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const ask = pageOf(c);
  const [ordersAll, bookings] = await Promise.all([
    db.prepare(`${ORDER_SELECT} WHERE o.buyer_id = ? AND o.status IN ('paid','test') ORDER BY o.created_at DESC LIMIT ? OFFSET ?`).bind(user.id, ask.limit, ask.offset).all<OrderRow>(),
    db.prepare(`${BOOKING_SELECT} WHERE k.buyer_id = ? ORDER BY k.starts_at DESC LIMIT 100`).bind(user.id).all<BookingRow>(),
  ]);
  const pg = paged(ordersAll.results, ask);
  const orders = { results: pg.items };
  const ids = orders.results.map((o) => o.product_id);
  const products = ids.length ? await db.prepare(`${PRODUCT_SELECT} WHERE p.id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<ProductRow>() : { results: [] as ProductRow[] };
  return c.json({ page: pg.page, orders: orders.results.map(toOrder), products: products.results.map((r) => toProduct(r)), bookings: bookings.results.map(toBooking) });
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

/** Everything the slot maths needs for one owner and product. */
async function slotContext(db: D1Database, product: ProductRow, date: string) {
  const owner = await db.prepare('SELECT timezone FROM users WHERE id = ?').bind(product.owner_id).first<{ timezone: string }>();
  const zone = owner?.timezone || 'Asia/Kolkata';
  const [rules, overrides, taken] = await Promise.all([
    db.prepare('SELECT weekday, start_min AS startMin, end_min AS endMin FROM availability WHERE owner_id = ?').bind(product.owner_id).all<{ weekday: number; startMin: number; endMin: number }>(),
    db.prepare('SELECT id, date, ranges_json FROM availability_overrides WHERE owner_id = ? AND date = ?').bind(product.owner_id, date).all<{ id: string; date: string; ranges_json: string }>(),
    db.prepare("SELECT starts_at, ends_at FROM bookings WHERE owner_id = ? AND status IN ('requested','confirmed') AND starts_at >= ? AND starts_at <= ?").bind(product.owner_id, `${date}T00:00:00`, `${date}T23:59:59.999Z`).all<{ starts_at: string; ends_at: string }>(),
  ]);
  const ovs: AvailabilityOverride[] = overrides.results.map((o) => {
    try {
      const v = JSON.parse(o.ranges_json || '[]') as { startMin: number; endMin: number }[];
      return { id: o.id, date: o.date, ranges: Array.isArray(v) ? v : [] };
    } catch {
      return { id: o.id, date: o.date, ranges: [] };
    }
  });
  // Bookings that start the day before but spill over still block the morning; widen the busy window by a day either side.
  const spill = await db.prepare("SELECT starts_at, ends_at FROM bookings WHERE owner_id = ? AND status IN ('requested','confirmed') AND starts_at >= ? AND starts_at < ?").bind(product.owner_id, `${new Date(new Date(`${date}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10)}T00:00:00`, `${date}T00:00:00`).all<{ starts_at: string; ends_at: string }>();
  return {
    zone,
    slots: slotsFor({
      date,
      zone,
      rules: rules.results,
      overrides: ovs,
      busy: [...taken.results, ...spill.results].map((t) => ({ startsAt: t.starts_at, endsAt: t.ends_at })),
      durationMin: product.duration_min ?? 30,
      bufferMin: product.buffer_min ?? 0,
      noticeHours: product.notice_hours ?? 2,
      maxDaysAhead: product.max_days_ahead ?? 30,
      now: new Date(),
    }),
  };
}

/** Free slots on a date for a session product, in the owner's zone, honouring overrides, buffers, notice and how far ahead. */
store.get('/:productId/slots', async (c) => {
  const db = c.env.DB;
  const product = await db.prepare(`${PRODUCT_SELECT} WHERE p.id = ? AND p.kind = 'session'`).bind(c.req.param('productId')).first<ProductRow>();
  if (!product) return c.json({ error: 'not found' }, 404);
  const date = c.req.query('date') ?? '';
  if (!DATE_RE.test(date)) return c.json({ error: 'date required' }, 400);
  const ctx = await slotContext(db, product, date);
  return c.json({ slots: ctx.slots, durationMin: product.duration_min ?? 30, zone: ctx.zone });
});

const intakeOf = (product: ProductRow): string[] => {
  try {
    const v = JSON.parse(product.intake_json || '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

store.post('/:productId/book', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const product = await db.prepare(`${PRODUCT_SELECT} WHERE p.id = ? AND p.kind = 'session'`).bind(c.req.param('productId')).first<ProductRow>();
  if (!product) return c.json({ error: 'not found' }, 404);
  if (!(await entitled(db, user.id, product.id))) return c.json({ error: 'get the session first, then book a time' }, 403);
  const body = await c.req.json<{ startsAt?: string; note?: string; intake?: unknown }>().catch(() => ({}) as Record<string, never>);
  const startsAt = typeof body.startsAt === 'string' ? body.startsAt : '';
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) return c.json({ error: 'pick a time in the future' }, 400);
  const questions = intakeOf(product);
  const intake = Array.isArray(body.intake) ? body.intake.map((x) => String(x).trim().slice(0, 500)).slice(0, questions.length) : [];
  if (questions.length > 0 && intake.filter(Boolean).length < questions.length) return c.json({ error: 'answer the questions first' }, 400);
  // The slot must still be one the owner offers right now.
  const owner = await db.prepare('SELECT timezone FROM users WHERE id = ?').bind(product.owner_id).first<{ timezone: string }>();
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: owner?.timezone || 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(start);
  const ctx = await slotContext(db, product, localDate);
  if (!ctx.slots.includes(start.toISOString())) return c.json({ error: 'that time is not open any more; pick another' }, 409);
  const step = product.duration_min ?? 30;
  const end = new Date(start.getTime() + step * 60_000);
  const id = newId();
  try {
    await db.prepare('INSERT INTO bookings (id, product_id, owner_id, buyer_id, order_id, starts_at, ends_at, status, meeting_url, note, intake_json, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, product.id, product.owner_id, user.id, start.toISOString(), end.toISOString(), 'requested', product.meeting_url, typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '', JSON.stringify(intake), nowIso())
      .run();
  } catch {
    // The unique index on live bookings caught a race for the same slot.
    return c.json({ error: 'that time was just taken' }, 409);
  }
  await logEvent(db, 'booking', id, 'booking.requested', { startsAt: start.toISOString() });
  await notify(db, product.owner_id, 'booking', `${nameOf(user)} requested a session`, start.toUTCString(), '/shop/bookings');
  const row = await db.prepare(`${BOOKING_SELECT} WHERE k.id = ?`).bind(id).first<BookingRow>();
  return c.json({ booking: row ? toBooking(row) : null }, 201);
});

// Move a booking to another open slot. The old one frees up only once the new one is taken.
store.post('/bookings/:id/reschedule', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const prev = await db.prepare(`${BOOKING_SELECT} WHERE k.id = ? AND k.buyer_id = ? AND k.status IN ('requested','confirmed')`).bind(c.req.param('id'), user.id).first<BookingRow>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  if (new Date(prev.starts_at).getTime() - Date.now() < 2 * 3600_000) return c.json({ error: 'too close to the start to move it; ask the host instead' }, 400);
  const product = await db.prepare(`${PRODUCT_SELECT} WHERE p.id = ?`).bind(prev.product_id).first<ProductRow>();
  if (!product) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ startsAt?: string }>().catch(() => ({}) as { startsAt?: string });
  const start = new Date(typeof body.startsAt === 'string' ? body.startsAt : '');
  if (Number.isNaN(start.getTime())) return c.json({ error: 'pick a time' }, 400);
  const owner = await db.prepare('SELECT timezone FROM users WHERE id = ?').bind(product.owner_id).first<{ timezone: string }>();
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: owner?.timezone || 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(start);
  const ctx = await slotContext(db, product, localDate);
  if (!ctx.slots.includes(start.toISOString())) return c.json({ error: 'that time is not open; pick another' }, 409);
  const end = new Date(start.getTime() + (product.duration_min ?? 30) * 60_000);
  try {
    await db.prepare("UPDATE bookings SET starts_at = ?, ends_at = ?, status = 'requested' WHERE id = ?").bind(start.toISOString(), end.toISOString(), prev.id).run();
  } catch {
    return c.json({ error: 'that time was just taken' }, 409);
  }
  await logEvent(db, 'booking', prev.id, 'booking.rescheduled', { from: prev.starts_at, to: start.toISOString() });
  await notify(db, prev.owner_id, 'booking', `${nameOf(user)} moved a session`, `${new Date(prev.starts_at).toUTCString()} to ${start.toUTCString()}. Confirm it again.`, '/shop/bookings');
  const row = await db.prepare(`${BOOKING_SELECT} WHERE k.id = ?`).bind(prev.id).first<BookingRow>();
  return c.json({ booking: row ? toBooking(row) : null });
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
    await rewardSocial(db, owner.id, 'follower', user.id);
    await notify(db, owner.id, 'follow', `${nameOf(user)} followed you`, '', '/shop/audience');
  }
  return c.json({ following: !had });
});
