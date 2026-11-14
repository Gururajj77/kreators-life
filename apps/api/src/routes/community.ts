import { Hono, type Context } from 'hono';
import { canModerate, canMute, canUndo, communityRankOf, FEED_FILTERS, MAX_REPLY_DEPTH, threadOrder, FEED_SORTS, isReaction, MAX_PINNED, mentionsIn, POST_CATEGORIES, type CommunityPost, type CommunityRank, type CommunityReply, type FeedFilter, type FeedSort, type ReactionCounts, type ReactionKind } from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { anonAlias, audit, blockedEither, hiddenByBlock, isGuide, isStaff, nameOf, newId, notify, notifyMany, nowIso, oneOf, parseList, rankOf, pageOf, paged, seenBy } from '../db';
import { endLinksOnBlock } from '../coaching';
import { blockAsksStmts } from '../blockAsks';
import { rewardSocial } from '../rewards';

export const community = new Hono<AppEnv>();

/** A reaction taken back by another tab, or by a second send racing the first (2026-11-14, the review). */
const REACTION_GONE = 'That reaction was taken back a moment ago.';
const MUTE_GONE = 'That mute was lifted a moment ago.';

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
  const staff = isStaff(viewer);
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

/** Whether guides hold a new member's first post until they say okay. Off until a guide switches it on. */
export async function holdsFirstPosts(db: D1Database): Promise<boolean> {
  const row = await db.prepare("SELECT value FROM community_settings WHERE key = 'hold_first_posts'").first<{ value: string }>();
  return row?.value === '1';
}

/**
 * Tell the people a post or reply mentions by @handle, at most MAX_MENTIONS of them, never the writer and never
 * across a block either way. Returns who was told, so a follower who was also mentioned is not told twice.
 */
async function tellMentioned(db: D1Database, writer: UserRow, text: string, postId: string, label: string, anonymous: boolean, replyId?: string): Promise<Set<string>> {
  const told = new Set<string>();
  const handles = mentionsIn(text);
  if (handles.length === 0) return told;
  const rows = await db
    .prepare(
      `SELECT id FROM users u WHERE u.handle IN (${handles.map((_, i) => `?${i + 3}`).join(',')}) AND u.id != ?1 AND NOT ${hiddenByBlock('u.id', '?1', '?2')}`,
    )
    .bind(writer.id, anonymous ? 1 : 0, ...handles)
    .all<{ id: string }>();
  // The note opens the post's replies and, for a reply, lands on that reply (`#reply-<id>`, the row's id in the replies sheet).
  await notifyMany(db, rows.results.map((r) => r.id), 'mention', `${label} mentioned you`, text.slice(0, 120), `/community?post=${postId}${replyId ? `#reply-${replyId}` : ''}`);
  for (const r of rows.results) told.add(r.id);
  return told;
}

const follow = (db: D1Database, postId: string, userId: string) => db.prepare('INSERT OR IGNORE INTO community_post_follows (post_id, user_id, created_at) VALUES (?, ?, ?)').bind(postId, userId, nowIso()).run();

community.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const category = (c.req.query('category') ?? '').trim();
  const productId = (c.req.query('product') ?? '').trim();
  const showHidden = c.req.query('all') === '1' && isGuide(user);
  const sort: FeedSort = oneOf(c.req.query('sort'), FEED_SORTS, 'recent');
  const filter: FeedFilter = oneOf(c.req.query('filter'), FEED_FILTERS, 'all');
  const clauses: string[] = [];
  const binds: unknown[] = [user.id];
  if (!showHidden) clauses.push('p.hidden_at IS NULL');
  // Nobody sees a post by someone they blocked, or by someone who blocked them. Staff reading the hidden view still see everything.
  if (!showHidden) clauses.push(`NOT ${hiddenByBlock('?1', 'p.user_id', 'p.anonymous')}`);
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
  const [rows, mutedRow] = await Promise.all([
    db.prepare(`${POST_SELECT} WHERE ${clauses.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...binds, ask.limit, ask.offset).all<PostRow>(),
    db.prepare('SELECT 1 FROM community_mutes WHERE user_id = ?').bind(user.id).first(),
  ]);
  const pg = paged(rows.results, ask);
  const muted = Boolean(mutedRow);
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
  if (!held) await tellMentioned(db, user, text, id, anonymous ? await anonAlias(c.env, user.id, id) : nameOf(user), anonymous);
  const row = await db.prepare(`${POST_SELECT} WHERE p.id = ?2`).bind(user.id, id).first<PostRow>();
  return c.json({ post: await presentPost(c, row), awarded, held }, 201);
});

/**
 * A post in a members-only feed is seen, reacted to and answered only by the product's owner and the people who bought it; any other post is open.
 * A block keeps a post away from reacting, following and answering just as it does from the feed (`hiddenByBlock`). `throughBlock` is only for a guide
 * reading replies from the view that shows everything.
 */
async function canSeePost(db: D1Database, userId: string, postId: string, throughBlock = false): Promise<boolean> {
  const unblocked = throughBlock ? '' : `AND NOT ${hiddenByBlock('?1', 'p.user_id', 'p.anonymous')}`;
  return Boolean(
    await db
      .prepare(`SELECT 1 FROM community_posts p WHERE p.id = ?2 ${unblocked} AND (p.product_id IS NULL OR EXISTS (SELECT 1 FROM products pr WHERE pr.id = p.product_id AND (pr.owner_id = ?1 OR EXISTS (SELECT 1 FROM orders o WHERE o.product_id = pr.id AND o.buyer_id = ?1 AND o.status IN ('paid','test')))))`)
      .bind(userId, postId)
      .first(),
  );
}

// React to a post: six kinds. The first reaction is the like that pays (the reacter a little xp, the author a point,
// each once per post); changing it pays nothing more, and the same reaction again takes it back.
community.post('/:id/like', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = c.req.param('id');
  const post = await db.prepare('SELECT id, user_id FROM community_posts WHERE id = ? AND hidden_at IS NULL AND held_at IS NULL').bind(id).first<{ id: string; user_id: string }>();
  if (!post || !(await canSeePost(db, user.id, id))) return c.json({ error: 'not found' }, 404);
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

/**
 * Set your reaction on a post to one kind, or take it back (2026-11-14, All tables: Edit and Delete for the owner). Unlike the screen's toggle
 * above, each leaves the same state however often it is sent (taking back one already gone says so, 409), so a second send from the table never
 * flips it back. The first reaction is still the like that pays, once per post; a change pays nothing, and taking one back takes nothing back.
 */
community.put('/:id/reaction', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{ kind?: unknown }>().catch(() => ({}) as { kind?: unknown });
  if (!isReaction(body.kind)) return c.json({ error: 'Pick one of the six reactions.' }, 400);
  const kind = body.kind;
  const post = await db.prepare('SELECT id, user_id FROM community_posts WHERE id = ? AND hidden_at IS NULL AND held_at IS NULL').bind(id).first<{ id: string; user_id: string }>();
  if (!post || !(await canSeePost(db, user.id, id))) return c.json({ error: 'not found' }, 404);
  const changed = await db.prepare('UPDATE community_likes SET kind = ? WHERE post_id = ? AND user_id = ?').bind(kind, id, user.id).run();
  let awarded = { xp: 0, points: 0 };
  if (!changed.meta.changes) {
    const added = await db.prepare('INSERT INTO community_likes (post_id, user_id, created_at, kind) VALUES (?, ?, ?, ?) ON CONFLICT (post_id, user_id) DO NOTHING').bind(id, user.id, nowIso(), kind).run();
    if (added.meta.changes) {
      awarded = await rewardSocial(db, user.id, 'like', id);
      if (post.user_id !== user.id) await rewardSocial(db, post.user_id, 'liked', `${id}:${user.id}`);
    }
  }
  return c.json({ ok: true, kind, awarded });
});
// Taking a reaction back (2026-11-14, All tables): one that is gone already answers 409 in words, so two tabs never both count it.
community.delete('/:id/reaction', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM community_likes WHERE post_id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  if (!res.meta.changes) return c.json({ error: REACTION_GONE }, 409);
  return c.json({ ok: true, kind: null });
});

// Follow a post, or stop: new replies land in the inbox under Following.
community.post('/:id/follow-post', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const post = await db.prepare('SELECT id FROM community_posts WHERE id = ? AND hidden_at IS NULL').bind(c.req.param('id')).first<{ id: string }>();
  if (!post || !(await canSeePost(db, user.id, post.id))) return c.json({ error: 'not found' }, 404);
  const had = await db.prepare('SELECT 1 FROM community_post_follows WHERE post_id = ? AND user_id = ?').bind(post.id, user.id).first();
  if (had) await db.prepare('DELETE FROM community_post_follows WHERE post_id = ? AND user_id = ?').bind(post.id, user.id).run();
  else await follow(db, post.id, user.id);
  return c.json({ following: !had });
});

// Stop following a post (2026-11-14, All tables): never a follow again, nobody told. Sent again, it changes nothing and says so (409), so two
// tabs never both count it.
community.delete('/:id/follow-post', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM community_post_follows WHERE post_id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  if (!res.meta.changes) return c.json({ error: 'You no longer follow it.' }, 409);
  return c.json({ following: false });
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
  const staff = isStaff(viewer);
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
  const asked = pageOf(c);
  if (!(await canSeePost(c.env.DB, c.get('user').id, c.req.param('id'), isGuide(c.get('user'))))) return c.json({ error: 'not found' }, 404);
  const rows = await c.env.DB.prepare(`${REPLY_SELECT} WHERE r.post_id = ?2 AND r.hidden_at IS NULL AND NOT ${hiddenByBlock('?1', 'r.user_id', 'r.anonymous')} ORDER BY r.created_at ASC LIMIT 500`)
    .bind(c.get('user').id, c.req.param('id'))
    .all<ReplyRow>();
  const thread = threadOrder(await presentReplies(c, rows.results));
  // A note about one reply (`?at=<reply id>`, from `#reply-<id>`) opens on the page that holds it, so the link lands however long the thread.
  const at = thread.findIndex((r) => r.id === c.req.query('at'));
  const ask = at >= 0 ? { ...asked, page: Math.floor(at / asked.size) + 1, offset: Math.floor(at / asked.size) * asked.size } : asked;
  const ordered = thread.slice(ask.offset, ask.offset + ask.limit);
  const pg = paged(ordered, ask);
  return c.json({ page: pg.page, replies: pg.items });
});

// One post, for a link that names it (an inbox note's `/community?post=<id>`, a search result): the feed's own rules, so a post a guide
// hid, one held for a guide's okay (unless it is yours) or one by someone blocked either way is not found.
community.get('/posts/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = c.req.param('id');
  if (!(await canSeePost(db, user.id, id))) return c.json({ error: 'not found' }, 404);
  const row = await db
    .prepare(`${POST_SELECT} WHERE p.id = ?2 AND p.hidden_at IS NULL AND (p.held_at IS NULL OR p.user_id = ?1)`)
    .bind(user.id, id)
    .first<PostRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.json({ post: await presentPost(c, row) });
});

community.post('/:id/replies', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const post = await db.prepare('SELECT id, user_id, body, anonymous FROM community_posts WHERE id = ? AND hidden_at IS NULL AND held_at IS NULL').bind(c.req.param('id')).first<{ id: string; user_id: string; body: string; anonymous: number }>();
  if (!post || !(await canSeePost(db, user.id, c.req.param('id')))) return c.json({ error: 'not found' }, 404);
  if (await db.prepare('SELECT 1 FROM community_mutes WHERE user_id = ?').bind(user.id).first()) return c.json({ error: 'You are muted in Community for now. A guide or admin can lift it.' }, 403);
  const body = await c.req.json<{ body?: string; anonymous?: boolean; parentId?: string | null }>().catch(() => ({}) as { body?: string; anonymous?: boolean; parentId?: string | null });
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 1000) : '';
  if (!text) return c.json({ error: 'write something first' }, 400);
  // An answer to a reply sits under it. Past the deepest level it lands beside the one it answers, so a long argument stays readable.
  let parent: { id: string; user_id: string; parent_id: string | null; depth: number; anonymous: number } | null = null;
  if (typeof body.parentId === 'string' && body.parentId) {
    parent = await db.prepare(`SELECT r.id, r.user_id, r.parent_id, r.depth, r.anonymous FROM community_replies r WHERE r.id = ?2 AND r.post_id = ?3 AND r.hidden_at IS NULL AND NOT ${hiddenByBlock('?1', 'r.user_id', 'r.anonymous')}`).bind(user.id, body.parentId, post.id).first();
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
  // Every note about a reply opens the post's replies on that reply.
  const at = `/community?post=${post.id}#reply-${id}`;
  const followers = await db.prepare('SELECT user_id FROM community_post_follows WHERE post_id = ? AND user_id != ? AND user_id != ? LIMIT 200').bind(post.id, user.id, post.user_id).all<{ user_id: string }>();
  // Whoever a block keeps this line from hears nothing about it (`seenBy`); a block by name still lets an anonymous line through, or the note would say who wrote it.
  const reach = await seenBy(db, user.id, anonymous, [post.user_id, parent?.user_id, ...followers.results.map((f) => f.user_id)]);
  if (reach.has(post.user_id)) await notify(db, post.user_id, 'reply', `${label} replied to your post`, text.slice(0, 120), at);
  const told = await tellMentioned(db, user, text, post.id, label, anonymous, id);
  if (parent && parent.user_id !== post.user_id && reach.has(parent.user_id) && !told.has(parent.user_id)) {
    await notify(db, parent.user_id, 'reply', `${label} replied to you`, text.slice(0, 120), at);
    told.add(parent.user_id);
  }
  await notifyMany(db, followers.results.filter((f) => reach.has(f.user_id) && !told.has(f.user_id)).map((f) => f.user_id), 'thread', 'New reply on a post you follow', `${label}: ${text.slice(0, 100)}`, at);
  await follow(db, post.id, user.id);
  const awarded = await rewardSocial(db, user.id, 'reply', id);
  const row = await db.prepare(`${REPLY_SELECT} WHERE r.id = ?2`).bind(user.id, id).first<ReplyRow>();
  return c.json({ reply: row ? ((await presentReplies(c, [row]))[0] ?? null) : null, awarded }, 201);
});

// Block the person behind a post or reply without learning who it is, which is how an anonymous author is blocked.
// An anonymous one is blocked under the made-up name the reader saw (the post's own scope, as presentPosts and presentReplies use).
community.post('/posts/:id/block-author', async (c) => {
  const row = await c.env.DB.prepare('SELECT id, user_id, anonymous FROM community_posts WHERE id = ?').bind(c.req.param('id')).first<{ id: string; user_id: string; anonymous: number }>();
  return blockBehind(c, row?.user_id, row?.anonymous === 1 ? await anonAlias(c.env, row.user_id, row.id) : null);
});
community.post('/replies/:id/block-author', async (c) => {
  const row = await c.env.DB.prepare('SELECT post_id, user_id, anonymous FROM community_replies WHERE id = ?').bind(c.req.param('id')).first<{ post_id: string; user_id: string; anonymous: number }>();
  return blockBehind(c, row?.user_id, row?.anonymous === 1 ? await anonAlias(c.env, row.user_id, row.post_id) : null);
});
/** The one block-by-what-they-wrote. With `alias` (the writer was anonymous) the block is kept behind that made-up name
 * (`block_aliases`, migration 0099), so Bond lists the name and never the person; without it, it is an ordinary block by name.
 * The answer is the same either way. */
export async function blockBehind(c: Context<AppEnv>, target: string | undefined, alias: string | null = null) {
  const me = c.get('user');
  if (!target) return c.json({ error: 'not found' }, 404);
  if (target === me.id) return c.json({ error: 'that is you' }, 400);
  const db = c.env.DB;
  const now = nowIso();
  // A block by name ends any coaching between the two. A block behind a made-up name leaves it: ending it would say who the name was.
  if (!alias) await endLinksOnBlock(db, me.id, nameOf(me), target);
  await db.batch([
    alias
      ? db.prepare('INSERT INTO blocks (blocker_id, blocked_id, reason, created_at, by_name) VALUES (?, ?, ?, ?, 0) ON CONFLICT (blocker_id, blocked_id) DO NOTHING').bind(me.id, target, '', now)
      : db.prepare('INSERT OR REPLACE INTO blocks (blocker_id, blocked_id, reason, created_at, by_name) VALUES (?, ?, ?, ?, 1)').bind(me.id, target, '', now),
    ...(alias ? [db.prepare('INSERT OR IGNORE INTO block_aliases (id, blocker_id, blocked_id, alias, created_at) VALUES (?, ?, ?, ?, ?)').bind(newId(), me.id, target, alias, now)] : []),
    // A block by name ends the friendship and every ask still waiting between the two, as Bond's Block does (blockAsks.ts). Behind a
    // made-up name it touches nothing with a name on it: a friend who vanished would say who wrote the line (2026-11-10, the break-it check).
    ...(alias
      ? []
      : [db.prepare('DELETE FROM friendships WHERE (requester_id = ?1 AND recipient_id = ?2) OR (requester_id = ?2 AND recipient_id = ?1)').bind(me.id, target), ...blockAsksStmts(db, me.id, target, now)]),
  ]);
  return c.json({ ok: true }, 201);
}

// React to a reply: the same six kinds. Reactions on replies pay nothing; the like that pays is on posts.
community.post('/replies/:id/react', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const reply = await db.prepare(`SELECT r.id FROM community_replies r WHERE r.id = ?2 AND r.hidden_at IS NULL AND NOT ${hiddenByBlock('?1', 'r.user_id', 'r.anonymous')}`).bind(user.id, c.req.param('id')).first<{ id: string }>();
  if (!reply) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ kind?: unknown }>().catch(() => ({}) as { kind?: unknown });
  const kind = isReaction(body.kind) ? body.kind : 'like';
  const had = await db.prepare('SELECT kind FROM community_reply_reactions WHERE reply_id = ? AND user_id = ?').bind(reply.id, user.id).first<{ kind: string }>();
  if (had?.kind === kind) await db.prepare('DELETE FROM community_reply_reactions WHERE reply_id = ? AND user_id = ?').bind(reply.id, user.id).run();
  else await db.prepare('INSERT INTO community_reply_reactions (reply_id, user_id, kind, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(reply_id, user_id) DO UPDATE SET kind = excluded.kind').bind(reply.id, user.id, kind, nowIso()).run();
  const row = await db.prepare(`${REPLY_SELECT} WHERE r.id = ?2`).bind(user.id, reply.id).first<ReplyRow>();
  return c.json({ reply: row ? ((await presentReplies(c, [row]))[0] ?? null) : null });
});

// Set your reaction on a reply to one kind, or take it back (2026-11-14, All tables): the same state however often it is sent. Pays nothing.
community.put('/replies/:id/reaction', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ kind?: unknown }>().catch(() => ({}) as { kind?: unknown });
  if (!isReaction(body.kind)) return c.json({ error: 'Pick one of the six reactions.' }, 400);
  const reply = await db.prepare(`SELECT r.id FROM community_replies r WHERE r.id = ?2 AND r.hidden_at IS NULL AND NOT ${hiddenByBlock('?1', 'r.user_id', 'r.anonymous')}`).bind(user.id, c.req.param('id')).first<{ id: string }>();
  if (!reply) return c.json({ error: 'not found' }, 404);
  await db.prepare('INSERT INTO community_reply_reactions (reply_id, user_id, kind, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(reply_id, user_id) DO UPDATE SET kind = excluded.kind').bind(reply.id, user.id, body.kind, nowIso()).run();
  return c.json({ ok: true, kind: body.kind });
});
community.delete('/replies/:id/reaction', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM community_reply_reactions WHERE reply_id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  if (!res.meta.changes) return c.json({ error: REACTION_GONE }, 409);
  return c.json({ ok: true, kind: null });
});

/**
 * Delete a reply you wrote that nobody has answered (2026-11-14, All tables), and its reactions with it. One with answers stays, since they are
 * other people's words hanging from it. The xp it paid stays, and a note already in someone's inbox keeps its words. An answer to a reply at the
 * deepest level is stored beside it (the reply route above), with nothing saying which one it answered, so a reply at that level counts as
 * answered once a later one sits beside it: it may stay when nobody answered it, but never goes when somebody did. The table's rule says the same.
 */
community.delete('/replies/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = c.req.param('id');
  const [gone] = await db.batch([
    db
      .prepare(
        'DELETE FROM community_replies WHERE id = ?1 AND user_id = ?2 AND NOT EXISTS (SELECT 1 FROM community_replies x WHERE x.parent_id = ?1) AND NOT (depth >= ?3 AND EXISTS (SELECT 1 FROM community_replies x WHERE x.parent_id = community_replies.parent_id AND x.id != ?1 AND x.depth >= ?3 AND x.created_at >= community_replies.created_at))',
      )
      .bind(id, user.id, MAX_REPLY_DEPTH),
    db.prepare('DELETE FROM community_reply_reactions WHERE reply_id = ?1 AND NOT EXISTS (SELECT 1 FROM community_replies WHERE id = ?1)').bind(id),
  ]);
  if (!gone?.meta.changes) {
    const had = await db.prepare('SELECT 1 FROM community_replies WHERE id = ? AND user_id = ?').bind(id, user.id).first();
    return had ? c.json({ error: 'Someone answered it, so it stays with their words.' }, 409) : c.json({ error: 'not found' }, 404);
  }
  return c.json({ ok: true });
});

/**
 * Change the words of a post you wrote while nobody has answered or reacted to it (2026-11-14, All tables: Edit for the owner), with the create
 * route's length and mute checks. Never its topic, nor whether it carries your name; a post a guide hid stays as it is. People a change newly
 * mentions are not told, since the post is already up.
 */
community.patch('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{ body?: unknown }>().catch(() => ({}) as { body?: unknown });
  if (body.body === undefined) return c.json({ error: 'Say what to change.' }, 400);
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) return c.json({ error: 'write something first' }, 400);
  if (text.length > 2000) return c.json({ error: 'Keep a post to 2,000 characters.' }, 400);
  if (await db.prepare('SELECT 1 FROM community_mutes WHERE user_id = ?').bind(user.id).first()) return c.json({ error: 'You are muted in Community for now. A guide or admin can lift it.' }, 403);
  // One guarded statement: two saves at once, or a reply landing in between, change it once or not at all.
  const res = await db
    .prepare(
      `UPDATE community_posts SET body = ?3 WHERE id = ?1 AND user_id = ?2 AND hidden_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM community_replies r WHERE r.post_id = ?1) AND NOT EXISTS (SELECT 1 FROM community_likes l WHERE l.post_id = ?1)`,
    )
    .bind(id, user.id, text)
    .run();
  if (!res.meta.changes) {
    const post = await db.prepare('SELECT hidden_at FROM community_posts WHERE id = ? AND user_id = ?').bind(id, user.id).first<{ hidden_at: string | null }>();
    if (!post) return c.json({ error: 'not found' }, 404);
    return c.json({ error: post.hidden_at ? 'A guide hid this post, so it stays as it is.' : 'Someone answered or reacted to it, so it stays as written.' }, 409);
  }
  const row = await db.prepare(`${POST_SELECT} WHERE p.id = ?2`).bind(user.id, id).first<PostRow>();
  return c.json({ post: await presentPost(c, row) });
});

community.delete('/:id', async (c) => {
  const user = c.get('user');
  const res = await c.env.DB.prepare('DELETE FROM community_posts WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).run();
  if (res.meta.changes === 0) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

// Stop following someone (2026-11-14, All tables): never a follow again, nobody told. Sent again, it changes nothing and says so (409).
community.delete('/follow/:userId', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM follows WHERE follower_id = ? AND owner_id = ?').bind(c.get('user').id, c.req.param('userId')).run();
  if (!res.meta.changes) return c.json({ error: 'You no longer follow them.' }, 409);
  return c.json({ following: false });
});

/**
 * Take someone off the people who follow you (2026-11-14, the founder's yes in All tables). They are not told and may follow again, unless a block
 * stops them. The points a new follower paid stay. Sent again, it changes nothing and says so (409).
 */
community.delete('/followers/:userId', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM follows WHERE follower_id = ? AND owner_id = ?').bind(c.req.param('userId'), c.get('user').id).run();
  if (!res.meta.changes) return c.json({ error: 'They no longer follow you.' }, 409);
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
  // A block reads like nobody, so a new follow never reaches the inbox of someone who blocked them. An old follow can still be undone.
  if (!had && (await blockedEither(db, user.id, other.id))) return c.json({ error: 'not found' }, 404);
  let awarded = { xp: 0, points: 0 };
  if (had) await db.prepare('DELETE FROM follows WHERE follower_id = ? AND owner_id = ?').bind(user.id, other.id).run();
  else {
    await db.prepare('INSERT INTO follows (follower_id, owner_id, created_at) VALUES (?, ?, ?)').bind(user.id, other.id, nowIso()).run();
    awarded = await rewardSocial(db, other.id, 'follower', user.id);
    // The note is about the follower, so it opens their page, by id: a handle can pass to someone else once they leave.
    await notify(db, other.id, 'follow', `${nameOf(user)} followed you`, '', `/people/${user.id}`);
  }
  const n = await db.prepare('SELECT COUNT(*) AS n FROM follows WHERE owner_id = ?').bind(other.id).first<{ n: number }>();
  return c.json({ following: !had, followers: n?.n ?? 0, awarded });
});

// Muting a member: a guide (the moderation permission), staff or an admin, and only someone of a lower rank.
// Lifting it follows the same rule, so a guide cannot undo what an admin did.

community.get('/mutes', async (c) => {
  const me = c.get('user');
  if (!canMute(rankOf(me), 'member')) return c.json({ error: 'you do not have access to that' }, 403);
  const ask = pageOf(c, 'muted');
  const rows = await c.env.DB.prepare('SELECT m.user_id, m.reason, m.created_at, m.muter_rank, u.display_name, u.handle FROM community_mutes m JOIN users u ON u.id = m.user_id ORDER BY m.created_at DESC LIMIT ? OFFSET ?').bind(ask.limit, ask.offset).all<{ user_id: string; reason: string; created_at: string; muter_rank: string; display_name: string; handle: string | null }>();
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, mutes: pg.items.map((r) => ({ userId: r.user_id, name: nameOf(r), handle: r.handle, reason: r.reason, by: r.muter_rank, createdAt: r.created_at })) });
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
  const row = await db.prepare('SELECT muter_rank, muted_by FROM community_mutes WHERE user_id = ?').bind(c.req.param('userId')).first<{ muter_rank: 'member' | 'guide' | 'staff' | 'admin'; muted_by: string }>();
  // `?mine=1` (All tables' People you muted, 2026-11-14) lifts only the mute this person set: another guide may have muted them again since.
  // There a mute already lifted (another tab, or a second send) answers 409 in words, so the table counts it once; Manage's lift stays a yes.
  const mine = c.req.query('mine') === '1';
  if (!row) return mine ? c.json({ error: MUTE_GONE }, 409) : c.json({ ok: true });
  if (mine && row.muted_by !== me.id) return c.json({ error: 'Another guide has muted them since, so their mute stays.' }, 409);
  // Whoever lifts it must outrank, or equal, whoever set it, and hold the power at all.
  if (!canUndo(rankOf(me), row.muter_rank)) return c.json({ error: 'only the rank that muted them, or a higher one, can lift it' }, 403);
  const lifted = await db.prepare(`DELETE FROM community_mutes WHERE user_id = ?1${mine ? ' AND muted_by = ?2' : ''}`).bind(c.req.param('userId'), ...(mine ? [me.id] : [])).run();
  if (mine && !lifted.meta.changes) return c.json({ error: MUTE_GONE }, 409);
  await audit(c.env.DB, me.id, 'community.unmute', 'user', c.req.param('userId'));
  return c.json({ ok: true });
});

// Moderation, for guides and admins.
// A guide is `isGuide` (the moderation permission; every admin holds it), the same rule the channels use.
export const moderate = new Hono<AppEnv>();
moderate.use('*', async (c, next) => {
  const user = c.get('user');
  if (!user || !isGuide(user)) return c.json({ error: 'you do not have access to that' }, 403);
  await next();
});

// The rank of the person who wrote something, or who hid or pinned it: the one ladder (`canModerate`, `canUndo` in shared).
const rankOfId = async (db: D1Database, id: string | null): Promise<CommunityRank> => {
  if (!id) return 'member';
  const u = await db.prepare('SELECT role, permissions FROM users WHERE id = ?').bind(id).first<Pick<UserRow, 'role' | 'permissions'>>();
  return u ? rankOf(u) : 'member';
};
// One answer whatever the reason, so a refusal never says that an anonymous writer is a guide, staff or an admin.
const OUTRANKED = { error: 'You cannot change this one. Report it and the team will look.' };

moderate.post('/posts/:id', async (c) => {
  const db = c.env.DB;
  const mod = c.get('user');
  const body = await c.req.json<{ hidden?: boolean; reason?: string }>().catch(() => ({}) as { hidden?: boolean; reason?: string });
  const post = await db.prepare('SELECT id, user_id, hidden_by FROM community_posts WHERE id = ?').bind(c.req.param('id')).first<{ id: string; user_id: string; hidden_by: string | null }>();
  if (!post) return c.json({ error: 'not found' }, 404);
  const hide = body.hidden !== false;
  const me = rankOf(mod);
  if (!canModerate(me, await rankOfId(db, post.user_id))) return c.json(OUTRANKED, 403);
  if (!hide && post.hidden_by && !canUndo(me, await rankOfId(db, post.hidden_by))) return c.json(OUTRANKED, 403);
  await db.prepare('UPDATE community_posts SET hidden_at = ?, hidden_by = ? WHERE id = ?').bind(hide ? nowIso() : null, hide ? mod.id : null, post.id).run();
  if (hide) await notify(db, post.user_id, 'moderation', 'A post of yours was hidden', typeof body.reason === 'string' ? body.reason.slice(0, 200) : 'A guide hid it from the community.', null);
  const row = await db.prepare(`${POST_SELECT} WHERE p.id = ?2`).bind(mod.id, post.id).first<PostRow>();
  return c.json({ post: await presentPost(c, row) });
});

moderate.post('/replies/:id', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<{ hidden?: boolean }>().catch(() => ({}) as { hidden?: boolean });
  const reply = await db.prepare('SELECT id, user_id FROM community_replies WHERE id = ?').bind(c.req.param('id')).first<{ id: string; user_id: string }>();
  if (!reply) return c.json({ error: 'not found' }, 404);
  if (!canModerate(rankOf(c.get('user')), await rankOfId(db, reply.user_id))) return c.json(OUTRANKED, 403);
  await db.prepare('UPDATE community_replies SET hidden_at = ? WHERE id = ?').bind(body.hidden === false ? null : nowIso(), reply.id).run();
  return c.json({ ok: true });
});

// Pin a post to the top of its category, or unpin it. A category holds MAX_PINNED pins at once.
moderate.post('/posts/:id/pin', async (c) => {
  const db = c.env.DB;
  const mod = c.get('user');
  const post = await db.prepare('SELECT id, category, product_id, pinned_at, pinned_by FROM community_posts WHERE id = ? AND hidden_at IS NULL AND held_at IS NULL').bind(c.req.param('id')).first<{ id: string; category: string; product_id: string | null; pinned_at: string | null; pinned_by: string | null }>();
  if (!post) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ pinned?: boolean }>().catch(() => ({}) as { pinned?: boolean });
  const pin = body.pinned !== false;
  // Anyone's post can be pinned; a pin comes off only by the rank that put it there or a higher one.
  if (!pin && post.pinned_by && !canUndo(rankOf(mod), await rankOfId(db, post.pinned_by))) return c.json(OUTRANKED, 403);
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
  const post = await db.prepare('SELECT p.id, p.user_id, p.body, p.anonymous FROM community_posts p WHERE p.id = ? AND p.held_at IS NOT NULL').bind(c.req.param('id')).first<{ id: string; user_id: string; body: string; anonymous: number }>();
  if (!post) return c.json({ error: 'not found' }, 404);
  await db.prepare('UPDATE community_posts SET held_at = NULL WHERE id = ?').bind(post.id).run();
  await rewardSocial(db, post.user_id, 'post', post.id);
  const author = await db.prepare('SELECT * FROM users WHERE id = ?').bind(post.user_id).first<UserRow>();
  if (author) await tellMentioned(db, author, post.body, post.id, post.anonymous === 1 ? await anonAlias(c.env, author.id, post.id) : nameOf(author), post.anonymous === 1);
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
  // A guide does not undo what staff or an admin set.
  const last = await db.prepare("SELECT updated_by FROM community_settings WHERE key = 'hold_first_posts'").first<{ updated_by: string | null }>();
  if (last?.updated_by && !canUndo(rankOf(mod), await rankOfId(db, last.updated_by))) return c.json({ error: 'Staff set this. Ask them to change it.' }, 403);
  await db
    .prepare("INSERT INTO community_settings (key, value, updated_by, updated_at) VALUES ('hold_first_posts', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at")
    .bind(body.holdFirstPosts ? '1' : '0', mod.id, nowIso())
    .run();
  await audit(db, mod.id, 'community.settings', 'community', 'hold_first_posts', '', { holdFirstPosts: body.holdFirstPosts });
  return c.json({ holdFirstPosts: body.holdFirstPosts });
});
