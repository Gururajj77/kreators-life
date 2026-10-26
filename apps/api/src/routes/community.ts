import { Hono } from 'hono';
import { FEED_FILTERS, FEED_SORTS, POST_CATEGORIES, roleRank, type CommunityPost, type CommunityReply, type FeedFilter, type FeedSort } from '@kreators/shared';
import type { AppEnv } from '../env';
import { nameOf, newId, notify, nowIso, oneOf, requireRole, pageOf, paged } from '../db';
import { rewardSocial } from '../rewards';

export const community = new Hono<AppEnv>();

interface PostRow {
  id: string;
  user_id: string;
  author_name: string;
  author_handle: string | null;
  author_pro: number;
  category: string;
  body: string;
  product_id: string | null;
  hidden_at: string | null;
  created_at: string;
  likes: number;
  liked: number;
  replies: number;
  author_following: number;
  author_followers: number;
}

const POST_SELECT = `SELECT p.*, u.display_name AS author_name, u.handle AS author_handle, u.is_pro AS author_pro,
  (SELECT COUNT(*) FROM community_likes l WHERE l.post_id = p.id) AS likes,
  (SELECT COUNT(*) FROM community_likes l WHERE l.post_id = p.id AND l.user_id = ?1) AS liked,
  (SELECT COUNT(*) FROM community_replies r WHERE r.post_id = p.id AND r.hidden_at IS NULL) AS replies,
  (SELECT COUNT(*) FROM follows f WHERE f.owner_id = p.user_id AND f.follower_id = ?1) AS author_following,
  (SELECT COUNT(*) FROM follows f WHERE f.owner_id = p.user_id) AS author_followers
  FROM community_posts p JOIN users u ON u.id = p.user_id`;

const toPost = (r: PostRow): CommunityPost => ({
  id: r.id,
  authorId: r.user_id,
  authorName: nameOf({ display_name: r.author_name }),
  authorHandle: r.author_handle,
  authorPro: r.author_pro === 1,
  authorFollowing: r.author_following > 0,
  authorFollowers: r.author_followers,
  category: r.category,
  body: r.body,
  productId: r.product_id,
  likes: r.likes,
  liked: r.liked > 0,
  replies: r.replies,
  hidden: Boolean(r.hidden_at),
  createdAt: r.created_at,
});

community.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const category = (c.req.query('category') ?? '').trim();
  const productId = (c.req.query('product') ?? '').trim();
  const showHidden = c.req.query('all') === '1' && roleRank(user.role) >= roleRank('sub_admin');
  const sort: FeedSort = oneOf(c.req.query('sort'), FEED_SORTS, 'recent');
  const filter: FeedFilter = oneOf(c.req.query('filter'), FEED_FILTERS, 'all');
  const clauses: string[] = [];
  const binds: unknown[] = [user.id];
  if (!showHidden) clauses.push('p.hidden_at IS NULL');
  if (filter === 'following') clauses.push('p.user_id IN (SELECT owner_id FROM follows WHERE follower_id = ?1)');
  if (filter === 'mine') clauses.push('p.user_id = ?1');
  if (category) {
    clauses.push('p.category = ?');
    binds.push(category);
  }
  if (productId) {
    // Members-only feed: the owner, or anyone who bought the membership.
    const ok = await db
      .prepare(`SELECT 1 FROM products WHERE id = ? AND (owner_id = ? OR EXISTS (SELECT 1 FROM orders o WHERE o.product_id = products.id AND o.buyer_id = ? AND o.status IN ('paid','test')))`)
      .bind(productId, user.id, user.id)
      .first();
    if (!ok) return c.json({ error: 'members only' }, 403);
    clauses.push('p.product_id = ?');
    binds.push(productId);
  } else {
    clauses.push('p.product_id IS NULL');
  }
  const order = sort === 'popular' ? 'likes DESC, replies DESC, p.created_at DESC' : sort === 'talked' ? 'replies DESC, likes DESC, p.created_at DESC' : 'p.created_at DESC';
  const ask = pageOf(c);
  const rows = await db.prepare(`${POST_SELECT} WHERE ${clauses.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...binds, ask.limit, ask.offset).all<PostRow>();
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, posts: pg.items.map(toPost), categories: POST_CATEGORIES, sort, filter });
});

community.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ category?: string; body?: string; productId?: string | null }>().catch(() => ({}) as Record<string, never>);
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 2000) : '';
  if (!text) return c.json({ error: 'write something first' }, 400);
  const category = (POST_CATEGORIES as readonly string[]).includes(body.category ?? '') ? body.category! : 'Stories';
  let productId: string | null = null;
  if (typeof body.productId === 'string' && body.productId) {
    const ok = await db
      .prepare(`SELECT 1 FROM products WHERE id = ? AND kind = 'membership' AND (owner_id = ? OR EXISTS (SELECT 1 FROM orders o WHERE o.product_id = products.id AND o.buyer_id = ? AND o.status IN ('paid','test') AND (o.expires_at IS NULL OR o.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now'))))`)
      .bind(body.productId, user.id, user.id)
      .first();
    if (!ok) return c.json({ error: 'members only' }, 403);
    productId = body.productId;
  }
  const id = newId();
  await db.prepare('INSERT INTO community_posts (id, user_id, category, body, product_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, user.id, category, text, productId, nowIso()).run();
  const awarded = await rewardSocial(db, user.id, 'post', id);
  const row = await db.prepare(`${POST_SELECT} WHERE p.id = ?2`).bind(user.id, id).first<PostRow>();
  return c.json({ post: row ? toPost(row) : null, awarded }, 201);
});

community.post('/:id/like', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = c.req.param('id');
  const post = await db.prepare('SELECT id, user_id FROM community_posts WHERE id = ? AND hidden_at IS NULL').bind(id).first<{ id: string; user_id: string }>();
  if (!post) return c.json({ error: 'not found' }, 404);
  const had = await db.prepare('SELECT 1 FROM community_likes WHERE post_id = ? AND user_id = ?').bind(id, user.id).first();
  let awarded = { xp: 0, points: 0 };
  if (had) await db.prepare('DELETE FROM community_likes WHERE post_id = ? AND user_id = ?').bind(id, user.id).run();
  else {
    await db.prepare('INSERT INTO community_likes (post_id, user_id, created_at) VALUES (?, ?, ?)').bind(id, user.id, nowIso()).run();
    // The liker earns a little xp; the author earns a point. Each once per post, each capped by the day.
    awarded = await rewardSocial(db, user.id, 'like', id);
    if (post.user_id !== user.id) await rewardSocial(db, post.user_id, 'liked', `${id}:${user.id}`);
  }
  const row = await db.prepare(`${POST_SELECT} WHERE p.id = ?2`).bind(user.id, id).first<PostRow>();
  return c.json({ post: row ? toPost(row) : null, awarded });
});

interface ReplyRow {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
}
const toReply = (r: ReplyRow): CommunityReply => ({ id: r.id, postId: r.post_id, authorId: r.user_id, authorName: nameOf({ display_name: r.author_name }), body: r.body, createdAt: r.created_at });

community.get('/:id/replies', async (c) => {
  const ask = pageOf(c);
  const rows = await c.env.DB.prepare('SELECT r.*, u.display_name AS author_name FROM community_replies r JOIN users u ON u.id = r.user_id WHERE r.post_id = ? AND r.hidden_at IS NULL ORDER BY r.created_at ASC LIMIT ? OFFSET ?')
    .bind(c.req.param('id'), ask.limit, ask.offset)
    .all<ReplyRow>();
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, replies: pg.items.map(toReply) });
});

community.post('/:id/replies', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const post = await db.prepare('SELECT id, user_id, body FROM community_posts WHERE id = ? AND hidden_at IS NULL').bind(c.req.param('id')).first<{ id: string; user_id: string; body: string }>();
  if (!post) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ body?: string }>().catch(() => ({}) as { body?: string });
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 1000) : '';
  if (!text) return c.json({ error: 'write something first' }, 400);
  const id = newId();
  await db.prepare('INSERT INTO community_replies (id, post_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, post.id, user.id, text, nowIso()).run();
  if (post.user_id !== user.id) await notify(db, post.user_id, 'reply', `${nameOf(user)} replied to your post`, text.slice(0, 120), `/community?post=${post.id}`);
  const awarded = await rewardSocial(db, user.id, 'reply', id);
  const row = await db.prepare('SELECT r.*, u.display_name AS author_name FROM community_replies r JOIN users u ON u.id = r.user_id WHERE r.id = ?').bind(id).first<ReplyRow>();
  return c.json({ reply: row ? toReply(row) : null, awarded }, 201);
});

community.delete('/:id', async (c) => {
  const user = c.get('user');
  const res = await c.env.DB.prepare('DELETE FROM community_posts WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).run();
  if (res.meta.changes === 0) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

// Follow a person from their post. The same follows table as the public page; a new follower pays the followed person two points.
community.post('/follow/:userId', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const other = await db.prepare('SELECT id FROM users WHERE id = ?').bind(c.req.param('userId')).first<{ id: string }>();
  if (!other) return c.json({ error: 'not found' }, 404);
  if (other.id === user.id) return c.json({ error: 'that is you' }, 400);
  const had = await db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND owner_id = ?').bind(user.id, other.id).first();
  let awarded = { xp: 0, points: 0 };
  if (had) await db.prepare('DELETE FROM follows WHERE follower_id = ? AND owner_id = ?').bind(user.id, other.id).run();
  else {
    await db.prepare('INSERT INTO follows (follower_id, owner_id, created_at) VALUES (?, ?, ?)').bind(user.id, other.id, nowIso()).run();
    awarded = await rewardSocial(db, other.id, 'follower', user.id);
    await notify(db, other.id, 'follow', `${nameOf(user)} followed you`, '', '/community');
  }
  const n = await db.prepare('SELECT COUNT(*) AS n FROM follows WHERE owner_id = ?').bind(other.id).first<{ n: number }>();
  return c.json({ following: !had, followers: n?.n ?? 0, awarded });
});

// Moderation, for guides and admins.
export const moderate = new Hono<AppEnv>();
moderate.use('*', requireRole('sub_admin'));

moderate.post('/posts/:id', async (c) => {
  const db = c.env.DB;
  const mod = c.get('user');
  const body = await c.req.json<{ hidden?: boolean; reason?: string }>().catch(() => ({}) as { hidden?: boolean; reason?: string });
  const post = await db.prepare('SELECT id, user_id FROM community_posts WHERE id = ?').bind(c.req.param('id')).first<{ id: string; user_id: string }>();
  if (!post) return c.json({ error: 'not found' }, 404);
  const hide = body.hidden !== false;
  await db.prepare('UPDATE community_posts SET hidden_at = ?, hidden_by = ? WHERE id = ?').bind(hide ? nowIso() : null, hide ? mod.id : null, post.id).run();
  if (hide) await notify(db, post.user_id, 'moderation', 'A post of yours was hidden', typeof body.reason === 'string' ? body.reason.slice(0, 200) : 'A guide hid it from the community.', null);
  const row = await db.prepare(`${POST_SELECT} WHERE p.id = ?2`).bind(mod.id, post.id).first<PostRow>();
  return c.json({ post: row ? toPost(row) : null });
});

moderate.post('/replies/:id', async (c) => {
  const body = await c.req.json<{ hidden?: boolean }>().catch(() => ({}) as { hidden?: boolean });
  await c.env.DB.prepare('UPDATE community_replies SET hidden_at = ? WHERE id = ?').bind(body.hidden === false ? null : nowIso(), c.req.param('id')).run();
  return c.json({ ok: true });
});
