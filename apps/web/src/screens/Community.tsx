import { FEED_FILTER_META, FEED_FILTERS, FEED_SORT_META, FEED_SORTS, MAX_PINNED, POST_CATEGORIES, REACTION_META, REACTIONS, SOCIAL_REWARDS, type CommunityPost, type FeedFilter, type FeedSort, type ReactionCounts, type ReactionKind, DEFAULT_PAGE_SIZE, pageQuery, type PageSize } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '../components/Button';
import { useCelebrate } from '../components/Celebration';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useParamState } from '../lib/useParamState';
import { useAuthed, useCommunity, useMe, useRefreshAll } from '../lib/queries';
import { Pager, PagerBar, usePage } from '../components/Pager';
import { Toggle } from '../components/Toggle';

/**
 * Six reactions under a post or a reply: the counts that have any, and a row to pick from. Picking yours again takes
 * it back; picking another changes it. On a post the first one is the like that pays.
 */
function Reactions({ counts, mine, onPick, busy }: { counts: ReactionCounts; mine: ReactionKind | null; onPick: (k: ReactionKind) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const shown = REACTIONS.filter((k) => (counts[k] ?? 0) > 0);
  return (
    <span className="flex flex-wrap items-center gap-xs">
      {shown.map((k) => (
        <button key={k} type="button" aria-pressed={mine === k} disabled={busy} onClick={() => onPick(k)} aria-label={`${REACTION_META[k].name}, ${counts[k]}`} className={`toy toy-soft inline-flex min-h-[40px] items-center gap-xs rounded-pill px-sm text-[14px] font-bold ${mine === k ? 'bg-r1/15' : 'bg-paper'}`}>
          <span aria-hidden="true">{REACTION_META[k].emoji}</span> {counts[k]}
        </button>
      ))}
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="toy toy-soft inline-flex min-h-[40px] items-center rounded-pill bg-paper px-sm text-[14px] font-bold">
        {mine ? 'Change' : 'React'}
      </button>
      {open && (
        <span className="flex flex-wrap gap-xs" role="group" aria-label="Pick a reaction">
          {REACTIONS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={mine === k}
              disabled={busy}
              title={REACTION_META[k].name}
              aria-label={REACTION_META[k].name}
              onClick={() => {
                setOpen(false);
                onPick(k);
              }}
              className={`toy toy-soft size-[40px] rounded-pill text-[18px] ${mine === k ? 'bg-r1/15' : 'bg-card'}`}
            >
              {REACTION_META[k].emoji}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/** For guides: whether first posts wait, and the ones waiting now. */
function HeldPosts() {
  const pg = usePage('held');
  const q = useAuthed(['held-posts', pg.query], () => api.heldPosts(pg.query));
  const refresh = useRefreshAll();
  const approve = useMutation({ mutationFn: (id: string) => api.approvePost(id), onSuccess: () => { refresh(); void q.refetch(); } });
  const hold = useMutation({ mutationFn: (on: boolean) => api.setHoldFirstPosts(on), onSuccess: () => void q.refetch() });
  const posts = q.data?.posts ?? [];
  return (
    <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="held-heading">
      <h2 id="held-heading" className="text-[18px]">
        For guides
      </h2>
      <div className="mt-xs">
        <Toggle compact on={q.data?.holdFirstPosts ?? false} disabled={hold.isPending} onChange={(on) => hold.mutate(on)} label="Hold a new member’s first post until a guide says okay" />
      </div>
      {posts.length > 0 && (
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {posts.map((p) => (
            <li key={p.id} className="rounded-tile bg-paper p-sm">
              <p className="m-0 text-[12px] font-bold text-ink-soft">
                {p.authorName}, {p.category}
              </p>
              <p className="mt-xs m-0 whitespace-pre-wrap text-[14px] font-semibold">{p.body}</p>
              <Button size="sm" className="mt-xs" disabled={approve.isPending} onClick={() => approve.mutate(p.id)}>
                Say okay
              </Button>
            </li>
          ))}
        </ul>
      )}
      {q.data && posts.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">No first posts waiting.</p>}
      <Pager page={q.data?.page} prefix="held" label="waiting posts" />
    </section>
  );
}

export function Community() {
  const me = useMe();
  const [params] = useSearchParams();
  const product = params.get('product') ?? undefined;
  const [category, setCategory] = useParamState('category', '');
  const [sortRaw, setSortRaw] = useParamState('sort', 'recent');
  const [filterRaw, setFilterRaw] = useParamState('filter', 'all');
  const sort: FeedSort = (FEED_SORTS as readonly string[]).includes(sortRaw) ? (sortRaw as FeedSort) : 'recent';
  const filter: FeedFilter = (FEED_FILTERS as readonly string[]).includes(filterRaw) ? (filterRaw as FeedFilter) : 'all';
  const setSort = (s: FeedSort) => setSortRaw(s);
  const setFilter = (f: FeedFilter) => setFilterRaw(f);
  const [showHidden, setShowHidden] = useState(false);
  const isMod = Boolean(me.data && me.data.user.role !== 'user');
  const pg = usePage();
  const q = useCommunity(category || undefined, product, isMod && showHidden, sort, filter, pg.query);
  const celebrate = useCelebrate();
  const refresh = useRefreshAll();
  const [writing, setWriting] = useState(false);
  const [open, setOpen] = useState<CommunityPost | null>(null);
  const like = useMutation({ mutationFn: (v: { id: string; kind: ReactionKind }) => api.likePost(v.id, v.kind), onSuccess: () => refresh() });
  const followPost = useMutation({ mutationFn: (id: string) => api.followPost(id), onSuccess: () => refresh() });
  const pin = useMutation({ mutationFn: (v: { id: string; pinned: boolean }) => api.pinPost(v.id, v.pinned), onSuccess: () => refresh() });
  const [notice, setNotice] = useState<string | null>(null);
  const failed = pin.error ?? like.error;
  const follow = useMutation({ mutationFn: (id: string) => api.followUser(id), onSuccess: () => refresh() });
  const remove = useMutation({ mutationFn: (id: string) => api.deletePost(id), onSuccess: () => refresh() });
  const hide = useMutation({ mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) => api.hidePost(id, hidden), onSuccess: () => refresh() });
  const posts = q.data?.posts ?? [];

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">{product ? 'Members' : 'Community'}</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{product ? 'A members-only feed for this membership.' : 'A place of warmth. Everyone is heard, and guides keep it kind.'}</p>
        <Button full className="mt-md" onClick={() => setWriting(true)}>
          Write a post
        </Button>
        <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">
          Type @ and a page name to tell someone. Follow a post to hear about new replies. Guides pin up to {MAX_PINNED} posts in each category. A post pays {SOCIAL_REWARDS.post.xp} xp, up to {SOCIAL_REWARDS.post.perDay} a day. A reply pays {SOCIAL_REWARDS.reply.xp}, a like you give pays {SOCIAL_REWARDS.like.xp}. A like on your post pays you a point, a new follower {SOCIAL_REWARDS.follower.points}.
        </p>
      </header>
      <div className="mt-md">
      <div className="scroll-row" role="group" aria-label="Show">
        {FEED_FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`toy shrink-0 rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${filter === f ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
            {FEED_FILTER_META[f]}
          </button>
        ))}
        <span className="w-[1px] shrink-0 bg-line" aria-hidden="true" />
        {FEED_SORTS.map((s) => (
          <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)} className={`toy shrink-0 rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${sort === s ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
            {FEED_SORT_META[s]}
          </button>
        ))}
      </div>
      </div>
      {!product && (
        <div className="mt-xs">
        <div className="scroll-row" role="group" aria-label="Browse by">
          {['', ...POST_CATEGORIES].map((c) => (
            <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={`toy shrink-0 rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${category === c ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
              {c || 'Everything'}
            </button>
          ))}
        </div>
        </div>
      )}
      {isMod && !product && <HeldPosts />}
      {notice && (
        <p role="status" className="mt-sm m-0 rounded-tile bg-r3/30 p-sm text-[14px] font-bold">
          {notice}
        </p>
      )}
      {failed && (
        <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          {failed instanceof Error ? failed.message : 'That did not work.'}
        </p>
      )}
      {isMod && (
        <label className="mt-sm flex items-center gap-xs text-[14px] font-bold text-ink-soft">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} className="size-[18px] accent-ink" />
          Show hidden posts
        </label>
      )}
      {q.isError && <p className="mt-md font-bold">{q.error instanceof Error ? q.error.message : 'Could not load.'}</p>}
      {posts.length === 0 && q.data && <p className="mt-md m-0 text-[14px] font-semibold text-ink-soft">{filter === 'following' ? 'Nobody you follow has posted yet. Follow people from their posts.' : filter === 'mine' ? 'You have not posted yet.' : 'No posts here yet. Start the conversation.'}</p>}
      <ul className="mt-md flex list-none flex-col gap-sm p-0 m-0">
        {posts.map((p) => (
          <li key={p.id} className={`rounded-card bg-card p-md shadow-toy-soft ${p.hidden || p.held ? 'opacity-60' : ''}`}>
            {(p.pinned || p.held) && <p className="m-0 mb-xs text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{p.held ? 'Waiting for a guide’s okay. Only you see it for now.' : 'Pinned by a guide'}</p>}
            <div className="flex items-center gap-sm">
              <span className="flex size-[40px] items-center justify-center rounded-pill bg-r2 font-display text-[16px] font-extrabold text-on-fill" aria-hidden="true">
                {p.authorName.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-xs">
                  <Link to={p.authorHandle ? `/u/${p.authorHandle}` : `/people/${p.authorId}`} className="truncate text-[16px] font-bold">
                    {p.authorName}
                  </Link>
                  {p.authorPro && <span className="rounded-pill bg-r7 px-xs text-[11px] font-extrabold leading-[18px] text-white">Pro</span>}
                </span>
                <span className="block text-[12px] font-bold text-ink-soft">
                  {p.category}, {new Date(p.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  {p.authorFollowers > 0 ? ` · ${p.authorFollowers} ${p.authorFollowers === 1 ? 'follower' : 'followers'}` : ''}
                  {p.hidden ? ', hidden' : ''}
                </span>
              </span>
              {me.data?.user.id !== p.authorId && (
                <button type="button" aria-pressed={p.authorFollowing} onClick={() => follow.mutate(p.authorId)} disabled={follow.isPending} className={`toy shrink-0 rounded-pill border-2 px-sm py-xs text-[12px] font-extrabold ${p.authorFollowing ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                  {p.authorFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
            <p className="mt-sm m-0 whitespace-pre-wrap text-[16px] font-semibold leading-relaxed">{p.body}</p>
            <div className="mt-sm flex flex-wrap items-center gap-xs">
              {!p.held && <Reactions counts={p.reactions} mine={p.myReaction} busy={like.isPending} onPick={(kind) => like.mutate({ id: p.id, kind })} />}
              {!p.held && (
                <button type="button" onClick={() => setOpen(p)} className="toy toy-soft inline-flex min-h-[40px] items-center gap-xs rounded-pill bg-paper px-sm text-[14px] font-bold">
                  <span aria-hidden="true">💬</span> {p.replies}
                </button>
              )}
              {!p.held && (
                <button type="button" aria-pressed={p.followingPost} onClick={() => followPost.mutate(p.id)} disabled={followPost.isPending} className={`toy inline-flex min-h-[40px] items-center rounded-pill border-2 px-sm text-[12px] font-extrabold ${p.followingPost ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                  {p.followingPost ? 'Following the post' : 'Follow the post'}
                </button>
              )}
              <span className="flex-1" />
              {isMod && !p.held && !p.hidden && (
                <Button variant="ghost" onClick={() => pin.mutate({ id: p.id, pinned: !p.pinned })}>
                  {p.pinned ? 'Unpin' : 'Pin'}
                </Button>
              )}
              {me.data?.user.id === p.authorId && (
                <Button variant="ghost" onClick={() => window.confirm('Delete your post?') && remove.mutate(p.id)}>
                  Delete
                </Button>
              )}
              {isMod && me.data?.user.id !== p.authorId && (
                <Button variant="ghost" onClick={() => hide.mutate({ id: p.id, hidden: !p.hidden })}>
                  {p.hidden ? 'Unhide' : 'Hide'}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Pager page={q.data?.page} label="posts" />
      <PostSheet open={writing} product={product} onClose={() => setWriting(false)} onSaved={(xp, held) => { refresh(); setNotice(held ? 'Thanks! A guide looks at a first post before it goes up. It pays once they say okay.' : null); if (xp > 0) celebrate({ title: 'Posted', totalXp: xp, color: 'var(--color-r2)' }); }} />
      <RepliesSheet post={open} onClose={() => setOpen(null)} onSaved={(xp) => { refresh(); if (xp > 0) celebrate({ title: 'Replied', totalXp: xp, color: 'var(--color-r2)' }); }} />
    </Screen>
  );
}

function PostSheet({ open, product, onClose, onSaved }: { open: boolean; product?: string; onClose: () => void; onSaved: (xp: number, held: boolean) => void }) {
  const [category, setCategory] = useState<string>('Stories');
  const [body, setBody] = useState('');
  const save = useMutation({
    mutationFn: () => api.createPost({ category, body, productId: product ?? null }),
    onSuccess: (r) => {
      setBody('');
      onSaved(r.awarded.xp, r.held);
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Add new post">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) save.mutate();
        }}
      >
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Select post category</legend>
          <div className="mt-xs grid grid-cols-3 gap-xs">
            {POST_CATEGORIES.map((c) => (
              <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={`min-h-[44px] rounded-tile border-2 text-[12px] font-bold ${category === c ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
                {c}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="block text-[14px] font-bold">Post content</span>
          <textarea autoFocus value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={5} placeholder="What is on your mind?" className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
        </label>
        {save.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {save.error instanceof Error ? save.error.message : 'Could not post.'}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={save.isPending || !body.trim()}>
          Create post
        </Button>
      </form>
    </Sheet>
  );
}

function RepliesSheet({ post, onClose, onSaved }: { post: CommunityPost | null; onClose: () => void; onSaved: (xp: number) => void }) {
  const [rp, setRp] = useState<{ page: number; size: PageSize }>({ page: 1, size: DEFAULT_PAGE_SIZE });
  const q = useAuthed(['replies', post?.id ?? '', rp.page, rp.size], () => api.replies(post!.id, pageQuery(rp.page, rp.size)), Boolean(post));
  const [text, setText] = useState('');
  const react = useMutation({ mutationFn: (v: { id: string; kind: ReactionKind }) => api.reactReply(v.id, v.kind), onSuccess: () => void q.refetch() });
  const send = useMutation({
    mutationFn: () => api.reply(post!.id, text),
    onSuccess: (r) => {
      setText('');
      q.refetch();
      onSaved(r.awarded.xp);
    },
  });
  return (
    <Sheet open={post !== null} onClose={onClose} title={post ? `${post.replies} ${post.replies === 1 ? 'reply' : 'replies'}` : ''}>
      {post && (
        <>
          <p className="m-0 rounded-tile bg-paper p-sm text-[14px] font-semibold">{post.body}</p>
          <ul className="mt-md flex list-none flex-col gap-xs p-0 m-0">
            {q.data?.replies.map((r) => (
              <li key={r.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 text-[14px] font-bold">
                  {r.authorName} <span className="font-semibold text-ink-soft">{new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </p>
                <p className="mt-xs m-0 text-[16px] font-semibold">{r.body}</p>
                <div className="mt-xs">
                  <Reactions counts={r.reactions} mine={r.myReaction} busy={react.isPending} onPick={(kind) => react.mutate({ id: r.id, kind })} />
                </div>
              </li>
            ))}
          </ul>
          <PagerBar page={q.data?.page} onPage={(page, size) => setRp({ page, size })} label="replies" />
          <form
            className="mt-md flex gap-xs"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) send.mutate();
            }}
          >
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Type reply to community" aria-label="Reply" className="min-w-0 flex-1 rounded-pill border-2 border-line bg-paper px-md py-sm text-[16px]" />
            <Button type="submit" disabled={send.isPending || !text.trim()}>
              Send
            </Button>
          </form>
        </>
      )}
    </Sheet>
  );
}
