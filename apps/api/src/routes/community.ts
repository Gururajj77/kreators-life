import { Hono, type Context } from 'hono';
import { canMute, communityRankOf, FEED_FILTERS, MAX_REPLY_DEPTH, threadOrder, FEED_SORTS, isReaction, MAX_PINNED, mentionsIn, POST_CATEGORIES, roleRank, type CommunityPost, type CommunityReply, type FeedFilter, type FeedSort, type ReactionCounts, type ReactionKind } from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { anonAlias, audit, nameOf, newId, notify, nowIso, oneOf, parseList, requireRole, pageOf, paged } from '../db';
import { rewardSocial } from '../rewards';

export const community = new Hono<AppEnv>();

interface PostRow {
  id: string;
  user_id: string;
  author_name: string;
  author_handle: string | null;
  author_pro: number;
  anonymous: number;
  author_role: UserRow['role'];
  author_perms: string;
  category: string;
  body: string;
  product_id: string | null;
  hidden_at: string | null;
  pinned_at: string | null;
  held_at: string | null;
  created_at: string;
  likes: number;
  liked: number;
  reaction_json: string | null;
  my_reaction: string | null;
  following_post: number;
  replies: number;
  author_following: number;
  author_followers: number;
}

// ?1 is always the viewer.
const POST_SELECT = `SELECT p.*, u.display_name AS author_name, u.handle AS author_handle, u.is_pro AS author_pro, u.role AS author_role, u.permissions AS author_perms,
  (SELECT COUNT(*) FROM community_likes l WHERE l.post_id = p.id) AS likes,
  (SELECT COUNT(*) FROM community_likes l WHERE l.post_id = p.id AND l.user_id = ?1) AS liked,
  (SELECT json_group_object(kind, n) FROM (SELECT l.kind, COUNT(*) AS n FROM community_likes l WHERE l.post_id = p.id GROUP BY l.kind)) AS reaction_json,
  (SELECT l.kind FROM community_likes l WHERE l.post_id = p.id AND l.user_id = ?1) AS my_reaction,
  (SELECT COUNT(*) FROM community_post_follows f WHERE f.post_id = p.id AND f.user_id = ?1) AS following_post,
  (SELECT COUNT(*) FROM community_replies r WHERE r.post_id = p.id AND r.hidden_at IS NULL) AS replies,
  (SELECT COUNT(*) FROM follows f WHERE f.owner_id = p.user_id AND f.follower_id = ?1) AS author_following,
  (SELECT COUNT(*) FROM follows f WHERE f.owner_id = p.user_id) AS author_followers
  FROM community_posts p JOIN users u ON u.id = p.user_id`;

/** Reaction counts from the database's own grouping, keeping only the six known kinds. */
function countsOf(raw: string | null): ReactionCounts {
  const out: ReactionCounts = {};
  try {
    for (const [k, n] of Object.entries(JSON.parse(raw || '{}') as Record<string, number>)) if (isReaction(k) && n > 0) out[k] = n;
  } catch {
    // An empty or odd value reads as no reactions.
  }
  return out;
}
const reactionOf = (v: string | null): ReactionKind | null => (isReaction(v) ? v : null);

const toPost = (r: PostRow): CommunityPost => ({
  id: r.id,
  authorId: r.user_id,
  authorName: nameOf({ display_name: r.author_name }),
  authorHandle: r.author_handle,
  anonymous: r.anonymous === 1,
  mine: false,
  authorRank: communityRankOf({ role: r.author_role, permissions: parseList(r.author_perms) }),
  authorPro: r.author_pro === 1,
  authorFollowing: r.author_following > 0,
  authorFollowers: r.author_followers,
  category: r.category,
  body: r.body,
  productId: r.product_id,
  likes: r.likes,
  liked: r.liked > 0,
  reactions: countsOf(r.reaction_json),
  myReaction: reactionOf(r.my_reaction),
  replies: r.replies,
  hidden: Boolean(r.hidden_at),
  pinned: Boolean(r.pinned_at),
  held: Boolean(r.held_at),
  followingPost: r.following_post > 0,
  createdAt: r.created_at,
});

/**
 * Every post that leaves the server goes through here. A post written anonymously carries a made-up name that is the
 * same all through its thread, and nothing that points at the person: no id (staff keep it, for reports), no handle,
 * no follower count, no Pro mark, no rank. `mine` is how the writer finds their own.
 */
async function presentPosts(c: Context<AppEnv>, rows: PostRow[]): Promise<CommunityPost[]> {
  const viewer = c.get('user');
  const staff = roleRank(viewer.role) >= roleRank('sub_admin');
  return Promise.all(
    rows.map(async (r) => {
      const p = toPost(r);
      const mine = r.user_id === viewer.id;
      if (r.anonymous !== 1) return { ...p, mine };
      return { ...p, mine, authorId: staff || mine ? r.user_id : '', authorName: await anonAlias(c.env, r.user_id, r.id), authorHandle: null, authorRank: 'member' as const, authorPro: false, authorFollowing: false, authorFollowers: 0 };
    }),
  );
}
const presentPost = async (c: Context<AppEnv>, row: PostRow | null) => (row ? ((await presentPosts(c, [row]))[0] ?? null) : null);

const isGuide = (user: UserRow) => roleRank(user.role) >= roleRank('sub_admin');
/** Whether guides hold a new member's first post until they say okay. Off until a guide switches it on. */
export async function holdsFirstPosts(db: D1Database): Promise<boolean> {
  const row = await db.prepare("SELECT value FROM community_settings WHERE key = 'hold_first_posts'").first<{ value: string }>();
  return row?.value === '1';
}

/**
 * Tell the people a post or reply mentions by @handle, at most MAX_MENTIONS of them, never the writer and never
 * across a block either way. Returns who was told, so a follower who was also mentioned is not told twice.
 */
async function tellMentioned(db: D1Database, writer: UserRow, text: string, postId: string, label = nameOf(writer)): Promise<Set<string>> {
  const told = new Set<string>();
  const handles = mentionsIn(text);
  if (handles.length === 0) return told;
  const rows = await db
    .prepare(
      `SELECT id FROM users u WHERE u.handle IN (${handles.map(() => '?').join(',')}) AND u.id != ?
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = u.id AND b.blocked_id = ?) OR (b.blocker_id = ? AND b.blocked_id = u.id))`,
    )
    .bind(...handles, writer.id, writer.id, writer.id)
    .all<{ id: string }>();
  for (const r of rows.results) {
    await notify(db, r.id, 'mention', `${label} mentioned you`, text.slice(0, 120), `/community?post=${postId}`);
    told.add(r.id);
  }
  return told;
}

const follow = (db: D1Database, postId: string, userId: string) => db.prepare('INSERT OR IGNORE INTO community_post_follows (post_id, user_id, created_at) VALUES (?, ?, ?)').bind(postId, userId, nowIso()).run();

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
  // Nobody sees a post by someone they blocked, or by someone who blocked them. Staff reading the hidden view still see everything.
  if (!showHidden) clauses.push('NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ?1 AND b.blocked_id = p.user_id) OR (b.blocker_id = p.user_id AND b.blocked_id = ?1))');
  // A held first post shows to its author until a guide says okay; guides find it under the waiting list.
  clauses.push('(p.held_at IS NULL OR p.user_id = ?1)');
  // An anonymous post never shows under Following: that would say who wrote it.
  if (filter === 'following') clauses.push('p.anonymous = 0 AND p.user_id IN (SELECT owner_id FROM follows WHERE follower_id = ?1)');
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
  const by = sort === 'popular' ? 'likes DESC, replies DESC, p.created_at DESC' : sort === 'talked' ? 'replies DESC, likes DESC, p.created_at DESC' : 'p.created_at DESC';
  // Inside one category, its pinned posts come first whatever the sort.
  const order = category ? `(p.pinned_at IS NOT NULL) DESC, p.pinned_at DESC, ${by}` : by;
  const ask = pageOf(c);
  const rows = await db.prepare(`${POST_SELECT} WHERE ${clauses.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...binds, ask.limit, ask.offset).all<PostRow>();
  const pg = paged(rows.results, ask);
  const muted = Boolean(await db.prepare('SELECT 1 FROM community_mutes WHERE user_id = ?').bind(user.id).first());
  return c.json({ page: pg.page, posts: await presentPosts(c, pg.items), categories: POST_CATEGORIES, sort, filter, muted });
});

community.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (await db.prepare('SELECT 1 FROM community_mutes WHERE user_id = ?').bind(user.id).first()) return c.json({ error: 'You are muted in Community for now. A guide or admin can lift it.' }, 403);
  const body = await c.req.json<{ category?: string; body?: string; productId?: string | null; anonymous?: boolean }>().catch(() => ({}) as Record<string, never>);
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
  // With holding on, a new member's first post waits for a guide. It pays and tells the people it mentions once it is up.
  const held = !isGuide(user) && (await holdsFirstPosts(db)) && !(await db.prepare('SELECT 1 FROM community_posts WHERE user_id = ? AND held_at IS NULL LIMIT 1').bind(user.id).first());
  const now = nowIso();
  const anonymous = body.anonymous === true;
  await db.prepare('INSERT INTO community_posts (id, user_id, category, body, product_id, created_at, held_at, anonymous) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, user.id, category, text, productId, now, held ? now : null, anonymous ? 1 : 0).run();
  await follow(db, id, user.id);
  const awarded = held ? { xp: 0, points: 0 } : await rewardSocial(db, user.id, 'post', id);
  if (!held) await tellMentioned(db, user, text, id, anonymous ? await anonAlias(c.env, user.id, id) : nameOf(user));
  const row = await db.prepare(`${POST_SELECT} WHERE p.id = ?2`).bind(user.id, id).first<PostRow>();
  return c.json({ post: await presentPost(c, row), awarded, held }, 201);
});

// React to a post: six kinds. The first reaction is the like that pays (the reacter a little xp, the author a point,
// each once per post); changing it pays nothing more, and the same reaction again takes it back.
community.post('/:id/like', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = c.req.param('id');
  const post = await db.prepare('SELECT id, user_id FROM community_posts WHERE id = ? AND hidden_at IS NULL AND held_at IS NULL').bind(id).first<{ id: string; user_id: string }>();
  if (!post) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ kind?: unknown }>().catch(() => ({}) as { kind?: unknown });
  const kind = isReaction(body.kind) ? body.kind : null;
  const had = await db.prepare('SELECT kind FROM community_likes WHERE post_id = ? AND user_id = ?').bind(id, user.id).first<{ kind: string }>();
  let awarded = { xp: 0, points: 0 };
  if (had && (!kind || kind === had.kind)) await db.prepare('DELETE FROM community_likes WHERE post_id = ? AND user_id = ?').bind(id, user.id).run();
  else if (had && kind) await db.prepare('UPDATE community_likes SET kind = ? WHERE post_id = ? AND user_id = ?').bind(kind, id, user.id).run();
  else {
    await db.prepare('INSERT INTO community_likes (post_id, user_id, created_at, kind) VALUES (?, ?, ?, ?)').bind(id, user.id, nowIso(), kind ?? 'like').run();
    awarded = await rewardSocial(db, user.id, 'like', id);
    if (post.user_id !== user.id) await rewardSocial(db, post.user_id, 'liked', `${id}:${user.id}`);
  }
  const row = await db.prepare(`${POST_SELECT} WHERE p.id = ?2`).bind(user.id, id).first<PostRow>();
  return c.json({ post: await presentPost(c, row), awarded });
});

// Follow a post, or stop: new replies land in the inbox under Following.
community.post('/:id/follow-post', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const post = await db.prepare('SELECT id FROM community_posts WHERE id = ? AND hidden_at IS NULL').bind(c.req.param('id')).first<{ id: string }>();
  if (!post) return c.json({ error: 'not found' }, 404);
  const had = await db.prepare('SELECT 1 FROM community_post_follows WHERE post_id = ? AND user_id = ?').bind(post.id, user.id).first();
  if (had) await db.prepare('DELETE FROM community_post_follows WHERE post_id = ? AND user_id = ?').bind(post.id, user.id).run();
  else await follow(db, post.id, user.id);
  return c.json({ following: !had });
});

interface ReplyRow {
  id: string;
  post_id: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
  anonymous: number;
  parent_id: string | null;
  depth: number;
  reaction_json: string | null;
  my_reaction: string | null;
}
// ?1 is the viewer.
const REPLY_SELECT = `SELECT r.*, u.display_name AS author_name,
  (SELECT json_group_object(kind, n) FROM (SELECT x.kind, COUNT(*) AS n FROM community_reply_reactions x WHERE x.reply_id = r.id GROUP BY x.kind)) AS reaction_json,
  (SELECT x.kind FROM community_reply_reactions x WHERE x.reply_id = r.id AND x.user_id = ?1) AS my_reaction
  FROM community_replies r JOIN users u ON u.id = r.user_id`;

/** A reply as it leaves the server: anonymous ones carry the made-up name for this post and no id (staff keep it, for reports). */
async function presentReplies(c: Context<AppEnv>, rows: ReplyRow[]): Promise<CommunityReply[]> {
  const viewer = c.get('user');
  const staff = roleRank(viewer.role) >= roleRank('sub_admin');
  return Promise.all(
    rows.map(async (r): Promise<CommunityReply> => {
      const mine = r.user_id === viewer.id;
      const anon = r.anonymous === 1;
      return {
        id: r.id,
        postId: r.post_id,
        authorId: anon && !staff && !mine ? '' : r.user_id,
        authorName: anon ? await anonAlias(c.env, r.user_id, r.post_id) : nameOf({ display_name: r.author_name }),
        anonymous: anon,
        mine,
        parentId: r.parent_id,
        depth: r.depth,
        body: r.body,
        reactions: countsOf(r.reaction_json),
        myReaction: reactionOf(r.my_reaction),
        createdAt: r.created_at,
      };
    }),
  );
}

// The replies to a post, in reading order: each one under what it answers. Hidden ones and anyone blocked either way are left out.
community.get('/:id/replies', async (c) => {
  const ask = pageOf(c);
  const rows = await c.env.DB.prepare(`${REPLY_SELECT} WHERE r.post_id = ?2 AND r.hidden_at IS NULL AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ?1 AND b.blocked_id = r.user_id) OR (b.blocker_id = r.user_id AND b.blocked_id = ?1)) ORDER BY r.created_at ASC LIMIT 500`)
    .bind(c.get('user').id, c.req.param('id'))
    .all<ReplyRow>();
  const ordered = threadOrder(await presentReplies(c, rows.results)).slice(ask.offset, ask.offset + ask.limit);
  const pg = paged(ordered, ask);
  return c.json({ page: pg.page, replies: pg.items });
});

community.post('/:id/replies', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const post = await db.prepare('SELECT id, user_id, body, anonymous FROM community_posts WHERE id = ? AND hidden_at IS NULL AND held_at IS NULL').bind(c.req.param('id')).first<{ id: string; user_id: string; body: string; anonymous: number }>();
  if (!post) return c.json({ error: 'not found' }, 404);
  if (await db.prepare('SELECT 1 FROM community_mutes WHERE user_id = ?').bind(user.id).first()) return c.json({ error: 'You are muted in Community for now. A guide or admin can lift it.' }, 403);
  const body = await c.req.json<{ body?: string; anonymous?: boolean; parentId?: string | null }>().catch(() => ({}) as { body?: string; anonymous?: boolean; parentId?: string | null });
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 1000) : '';
  if (!text) return c.json({ error: 'write something first' }, 400);
  // An answer to a reply sits under it. Past the deepest level it lands beside the one it answers, so a long argument stays readable.
  let parent: { id: string; user_id: string; parent_id: string | null; depth: number; anonymous: number } | null = null;
  if (typeof body.parentId === 'string' && body.parentId) {
    parent = await db.prepare('SELECT id, user_id, parent_id, depth, anonymous FROM community_replies WHERE id = ? AND post_id = ? AND hidden_at IS NULL').bind(body.parentId, post.id).first();
    if (!parent) return c.json({ error: 'that reply is gone' }, 404);
  }
  const atBottom = parent !== null && parent.depth >= MAX_REPLY_DEPTH;
  const parentId = parent ? (atBottom ? parent.parent_id : parent.id) : null;
  const depth = parent ? Math.min(parent.depth + 1, MAX_REPLY_DEPTH) : 0;
  const anonymous = body.anonymous === true;
  const id = newId();
  await db.prepare('INSERT INTO community_replies (id, post_id, user_id, body, created_at, anonymous, parent_id, depth) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, post.id, user.id, text, nowIso(), anonymous ? 1 : 0, parentId, depth).run();
  // Whoever is named in a notice is the made-up name when the writer chose one, never the real name.
  const label = anonymous ? await anonAlias(c.env, user.id, post.id) : nameOf(user);
  if (post.user_id !== user.id) await notify(db, post.user_id, 'reply', `${label} replied to your post`, text.slice(0, 120), `/community?post=${post.id}`);
  const told = await tellMentioned(db, user, text, post.id, label);
  if (parent && parent.user_id !== user.id && parent.user_id !== post.user_id && !told.has(parent.user_id)) {
    await notify(db, parent.user_id, 'reply', `${label} replied to you`, text.slice(0, 120), `/community?post=${post.id}`);
    told.add(parent.user_id);
  }
  const followers = await db.prepare('SELECT user_id FROM community_post_follows WHERE post_id = ? AND user_id != ? AND user_id != ? LIMIT 200').bind(post.id, user.id, post.user_id).all<{ user_id: string }>();
  for (const f of followers.results) if (!told.has(f.user_id)) await notify(db, f.user_id, 'thread', 'New reply on a post you follow', `${label}: ${text.slice(0, 100)}`, `/community?post=${post.id}`);
  await follow(db, post.id, user.id);
  const awarded = await rewardSocial(db, user.id, 'reply', id);
  const row = await db.prepare(`${REPLY_SELECT} WHERE r.id = ?2`).bind(user.id, id).first<ReplyRow>();
  return c.json({ reply: row ? ((await presentReplies(c, [row]))[0] ?? null) : null, awarded }, 201);
});

// Block the person behind a post or reply without learning who it is, which is how an anonymous author is blocked.
community.post('/posts/:id/block-author', async (c) => {
  const row = await c.env.DB.prepare('SELECT user_id FROM community_posts WHERE id = ?').bind(c.req.param('id')).first<{ user_id: string }>();
  return blockBehind(c, row?.user_id);
});
community.post('/replies/:id/block-author', async (c) => {
  const row = await c.env.DB.prepare('SELECT user_id FROM community_replies WHERE id = ?').bind(c.req.param('id')).first<{ user_id: string }>();
  return blockBehind(c, row?.user_id);
});
async function blockBehind(c: Context<AppEnv>, target: string | undefined) {
  const me = c.get('user');
  if (!target) return c.json({ error: 'not found' }, 404);
  if (target === me.id) return c.json({ error: 'that is you' }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT OR REPLACE INTO blocks (blocker_id, blocked_id, reason, created_at) VALUES (?, ?, ?, ?)').bind(me.id, target, '', nowIso()),
    c.env.DB.prepare('DELETE FROM friendships WHERE (requester_id = ?1 AND recipient_id = ?2) OR (requester_id = ?2 AND recipient_id = ?1)').bind(me.id, target),
  ]);
  return c.json({ ok: true }, 201);
}

// React to a reply: the same six kinds. Reactions on replies pay nothing; the like that pays is on posts.
community.post('/replies/:id/react', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const reply = await db.prepare('SELECT id FROM community_replies WHERE id = ? AND hidden_at IS NULL').bind(c.req.param('id')).first<{ id: string }>();
  if (!reply) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ kind?: unknown }>().catch(() => ({}) as { kind?: unknown });
  const kind = isReaction(body.kind) ? body.kind : 'like';
  const had = await db.prepare('SELECT kind FROM community_reply_reactions WHERE reply_id = ? AND user_id = ?').bind(reply.id, user.id).first<{ kind: string }>();
  if (had?.kind === kind) await db.prepare('DELETE FROM community_reply_reactions WHERE reply_id = ? AND user_id = ?').bind(reply.id, user.id).run();
  else await db.prepare('INSERT INTO community_reply_reactions (reply_id, user_id, kind, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(reply_id, user_id) DO UPDATE SET kind = excluded.kind').bind(reply.id, user.id, kind, nowIso()).run();
  const row = await db.prepare(`${REPLY_SELECT} WHERE r.id = ?2`).bind(user.id, reply.id).first<ReplyRow>();
  return c.json({ reply: row ? ((await presentReplies(c, [row]))[0] ?? null) : null });
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

// Muting a member: a guide (the moderation permission), staff or an admin, and only someone of a lower rank.
// Lifting it follows the same rule, so a guide cannot undo what an admin did.
const rankOf = (u: UserRow) => communityRankOf({ role: u.role, permissions: parseList(u.permissions) });

community.get('/mutes', async (c) => {
  const me = c.get('user');
  if (!canMute(rankOf(me), 'member')) return c.json({ error: 'you do not have access to that' }, 403);
  const rows = await c.env.DB.prepare('SELECT m.user_id, m.reason, m.created_at, m.muter_rank, u.display_name, u.handle FROM community_mutes m JOIN users u ON u.id = m.user_id ORDER BY m.created_at DESC LIMIT 100').all<{ user_id: string; reason: string; created_at: string; muter_rank: string; display_name: string; handle: string | null }>();
  return c.json({ mutes: rows.results.map((r) => ({ userId: r.user_id, name: nameOf(r), handle: r.handle, reason: r.reason, by: r.muter_rank, createdAt: r.created_at })) });
});

community.post('/members/:userId/mute', async (c) => {
  const db = c.env.DB;
  const me = c.get('user');
  const target = await db.prepare('SELECT * FROM users WHERE id = ?').bind(c.req.param('userId')).first<UserRow>();
  if (!target) return c.json({ error: 'not found' }, 404);
  if (!canMute(rankOf(me), rankOf(target))) return c.json({ error: 'you can only mute someone of a lower rank than yours' }, 403);
  const body = await c.req.json<{ reason?: string }>().catch(() => ({}) as { reason?: string });
  await db.prepare('INSERT OR REPLACE INTO community_mutes (user_id, muted_by, muter_rank, reason, created_at) VALUES (?, ?, ?, ?, ?)').bind(target.id, me.id, rankOf(me), typeof body.reason === 'string' ? body.reason.trim().slice(0, 300) : '', nowIso()).run();
  await audit(c.env.DB, me.id, 'community.mute', 'user', target.id, '', rankOf(me));
  await notify(db, target.id, 'moderation', 'You are muted in Community', typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 200) : 'A guide muted you for now. You can still read.', null);
  return c.json({ ok: true });
});

community.delete('/members/:userId/mute', async (c) => {
  const db = c.env.DB;
  const me = c.get('user');
  const row = await db.prepare('SELECT muter_rank FROM community_mutes WHERE user_id = ?').bind(c.req.param('userId')).first<{ muter_rank: 'member' | 'guide' | 'staff' | 'admin' }>();
  if (!row) return c.json({ ok: true });
  // Whoever lifts it must outrank, or equal, whoever set it, and hold the power at all.
  if (!canMute(rankOf(me), 'member') || (({ member: 0, guide: 1, staff: 2, admin: 3 })[rankOf(me)] < ({ member: 0, guide: 1, staff: 2, admin: 3 })[row.muter_rank])) return c.json({ error: 'only the rank that muted them, or a higher one, can lift it' }, 403);
  await db.prepare('DELETE FROM community_mutes WHERE user_id = ?').bind(c.req.param('userId')).run();
  await audit(c.env.DB, me.id, 'community.unmute', 'user', c.req.param('userId'));
  return c.json({ ok: true });
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
  return c.json({ post: await presentPost(c, row) });
});

moderate.post('/replies/:id', async (c) => {
  const body = await c.req.json<{ hidden?: boolean }>().catch(() => ({}) as { hidden?: boolean });
  await c.env.DB.prepare('UPDATE community_replies SET hidden_at = ? WHERE id = ?').bind(body.hidden === false ? null : nowIso(), c.req.param('id')).run();
  return c.json({ ok: true });
});

// Pin a post to the top of its category, or unpin it. A category holds MAX_PINNED pins at once.
moderate.post('/posts/:id/pin', async (c) => {
  const db = c.env.DB;
  const mod = c.get('user');
  const post = await db.prepare('SELECT id, category, product_id, pinned_at FROM community_posts WHERE id = ? AND hidden_at IS NULL AND held_at IS NULL').bind(c.req.param('id')).first<{ id: string; category: string; product_id: string | null; pinned_at: string | null }>();
  if (!post) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ pinned?: boolean }>().catch(() => ({}) as { pinned?: boolean });
  const pin = body.pinned !== false;
  if (pin && !post.pinned_at) {
    const n = await db.prepare('SELECT COUNT(*) AS n FROM community_posts WHERE category = ? AND product_id IS ? AND pinned_at IS NOT NULL AND hidden_at IS NULL').bind(post.category, post.product_id).first<{ n: number }>();
    if ((n?.n ?? 0) >= MAX_PINNED) return c.json({ error: `${post.category} already has ${MAX_PINNED} pinned posts. Unpin one first.` }, 409);
  }
  await db.prepare('UPDATE community_posts SET pinned_at = ?, pinned_by = ? WHERE id = ?').bind(pin ? (post.pinned_at ?? nowIso()) : null, pin ? mod.id : null, post.id).run();
  const row = await db.prepare(`${POST_SELECT} WHERE p.id = ?2`).bind(mod.id, post.id).first<PostRow>();
  return c.json({ post: await presentPost(c, row) });
});

// First posts waiting for a guide's okay, oldest first.
moderate.get('/held', async (c) => {
  const ask = pageOf(c, 'held');
  const user = c.get('user');
  const rows = await c.env.DB.prepare(`${POST_SELECT} WHERE p.held_at IS NOT NULL AND p.hidden_at IS NULL ORDER BY p.held_at ASC LIMIT ?2 OFFSET ?3`).bind(user.id, ask.limit, ask.offset).all<PostRow>();
  const pg = paged(rows.results, ask);
  return c.json({ posts: await presentPosts(c, pg.items), page: pg.page, holdFirstPosts: await holdsFirstPosts(c.env.DB) });
});

// Say okay to a held first post: it goes up, pays its author as any post does, and tells the people it mentions.
moderate.post('/posts/:id/approve', async (c) => {
  const db = c.env.DB;
  const mod = c.get('user');
  const post = await db.prepare('SELECT p.id, p.user_id, p.body FROM community_posts p WHERE p.id = ? AND p.held_at IS NOT NULL').bind(c.req.param('id')).first<{ id: string; user_id: string; body: string }>();
  if (!post) return c.json({ error: 'not found' }, 404);
  await db.prepare('UPDATE community_posts SET held_at = NULL WHERE id = ?').bind(post.id).run();
  await rewardSocial(db, post.user_id, 'post', post.id);
  const author = await db.prepare('SELECT * FROM users WHERE id = ?').bind(post.user_id).first<UserRow>();
  if (author) await tellMentioned(db, author, post.body, post.id);
  await notify(db, post.user_id, 'moderation', 'Your first post is up', 'A guide said okay. Welcome to the community.', `/community?post=${post.id}`);
  const row = await db.prepare(`${POST_SELECT} WHERE p.id = ?2`).bind(mod.id, post.id).first<PostRow>();
  return c.json({ post: await presentPost(c, row) });
});

// Whether a new member's first post waits for a guide. Off to start with.
moderate.put('/settings', async (c) => {
  const db = c.env.DB;
  const mod = c.get('user');
  const body = await c.req.json<{ holdFirstPosts?: unknown }>().catch(() => ({}) as { holdFirstPosts?: unknown });
  if (typeof body.holdFirstPosts !== 'boolean') return c.json({ error: 'say holdFirstPosts: true or false' }, 400);
  await db
    .prepare("INSERT INTO community_settings (key, value, updated_by, updated_at) VALUES ('hold_first_posts', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at")
    .bind(body.holdFirstPosts ? '1' : '0', mod.id, nowIso())
    .run();
  await audit(db, mod.id, 'community.settings', 'community', 'hold_first_posts', '', { holdFirstPosts: body.holdFirstPosts });
  return c.json({ holdFirstPosts: body.holdFirstPosts });
});
