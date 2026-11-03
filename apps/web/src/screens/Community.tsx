import { canMute, communityRankOf, FEED_FILTER_META, FEED_FILTERS, FEED_SORT_META, FEED_SORTS, MAX_PINNED, POST_CATEGORIES, REACTION_META, REACTIONS, SOCIAL_REWARDS, type CommunityPost, type CommunityReply, type FeedFilter, type FeedSort, type ReactionCounts, type ReactionKind, DEFAULT_PAGE_SIZE, pageQuery, type PageSize, LOCALE } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { Inert } from '../components/Inert';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '../components/Button';
import { useCelebrate } from '../components/Celebration';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { SkeletonList } from '../components/Skeleton';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useParamState } from '../lib/useParamState';
import { useAuthed, useCommunity, useMe, useRefreshAll } from '../lib/queries';
import { Pager, PagerBar, usePage } from '../components/Pager';
import { Toggle } from '../components/Toggle';
import { AnonToggle } from '../components/AnonToggle';
import { ChannelsPanel, ChannelTabs } from '../components/Channels';
import { AppIcon } from '../components/AppIcon';
import { MoreMenu } from '../components/MoreMenu';
import { Icon } from '../components/Icon';
import { MessageCircle } from 'lucide-react';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { IconTag } from '../components/FactTag';

/** A reaction's icon. Love is the animated heart: it fills and beats when it is picked. */
function ReactionGlyph({ kind, size, picked }: { kind: ReactionKind; size: number; picked: boolean }) {
  if (kind === 'love') return <AnimatedIcon name="heart" size={size} active={picked} playWhen={picked} />;
  return <AppIcon name={REACTION_META[kind].icon} size={size} />;
}

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
        <button key={k} type="button" aria-pressed={mine === k} disabled={busy} onClick={() => onPick(k)} aria-label={`${REACTION_META[k].name}, ${counts[k]}`} className={`toy toy-soft inline-flex min-h-[44px] items-center gap-xs rounded-pill px-sm text-[14px] font-bold ${mine === k ? 'bg-r1/15' : 'bg-paper'}`}>
          <ReactionGlyph kind={k} size={16} picked={mine === k} /> {counts[k]}
        </button>
      ))}
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="toy toy-soft inline-flex min-h-[44px] items-center rounded-pill bg-paper px-sm text-[14px] font-bold">
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
              className={`toy toy-soft flex size-[44px] items-center justify-center rounded-pill ${mine === k ? 'bg-r1/15' : 'bg-card'}`}
            >
              <ReactionGlyph kind={k} size={20} picked={mine === k} />
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/** For guides: whether first posts wait, and the ones waiting now. */
/** The members muted from Community, for anyone with the power to mute. Lifting a mute follows the same rank rule as setting it. */
function MutedList() {
  const pg = usePage('muted');
  const q = useAuthed(['community-mutes', pg.query], () => api.mutes(pg.query));
  const refresh = useRefreshAll();
  const unmute = useMutation({ mutationFn: (id: string) => api.unmute(id), onSuccess: () => { void q.refetch(); refresh(); } });
  const list = q.data?.mutes ?? [];
  if (pg.page === 1 && list.length === 0) return null;
  return (
    <section className="mt-lg" aria-labelledby="muted-heading">
      <h2 id="muted-heading" className="text-[24px]">
        Muted members
      </h2>
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {list.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
            <span className="min-w-0">
              <span className="block truncate text-[16px] font-bold">{m.name}</span>
              <span className="block text-[12px] font-bold text-ink-soft">Muted by {m.by}{m.reason ? `: ${m.reason}` : ''}</span>
            </span>
            <Button variant="outline" size="sm" onClick={() => unmute.mutate(m.userId)} disabled={unmute.isPending}>
              Lift
            </Button>
          </li>
        ))}
      </ul>
      {unmute.isError && <p role="alert" className="mt-xs m-0 text-[14px] font-bold">{unmute.error instanceof Error ? unmute.error.message : 'That did not work.'}</p>}
      <Pager page={q.data?.page} prefix="muted" label="muted members" />
    </section>
  );
}

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
              <p className="mt-xs m-0 whitespace-pre-wrap text-[14px] font-semibold"><Inert text={p.body} /></p>
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

/** Community has two sections: the feed, and chat channels beside it (kept in the URL as `tab`). */
export function Community() {
  const [tab] = useParamState('tab', 'feed');
  const [params] = useSearchParams();
  return tab === 'channels' && !params.get('product') ? <CommunityChannels /> : <CommunityFeed />;
}

function CommunityChannels() {
  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">Community</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Chat rooms for one topic each, kept kind by guides.</p>
      </header>
      <ChannelTabs />
      <div className="mt-md">
        <ChannelsPanel scope="community" />
      </div>
    </Screen>
  );
}

function CommunityFeed() {
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
  // Anyone can block a member. A guide, staff member or admin can also mute one, but only someone of a lower rank.
  const myRank = me.data ? communityRankOf({ role: me.data.user.role, permissions: me.data.user.permissions }) : 'member';
  // By post, so an anonymous author can be blocked without anyone learning who they are.
  const block = useMutation({ mutationFn: (postId: string) => api.blockPostAuthor(postId), onSuccess: () => refresh() });
  const mute = useMutation({ mutationFn: (id: string) => api.mute(id), onSuccess: () => refresh() });
  const modFailed = block.error ?? mute.error;

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
      {!product && <ChannelTabs />}
      <div className="mt-md">
      <div className="scroll-row" role="group" aria-label="Show">
        {FEED_FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`toy shrink-0 min-h-[44px] rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${filter === f ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
            {FEED_FILTER_META[f]}
          </button>
        ))}
        <span className="w-[1px] shrink-0 bg-line" aria-hidden="true" />
        {FEED_SORTS.map((s) => (
          <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)} className={`toy shrink-0 min-h-[44px] rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${sort === s ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
            {FEED_SORT_META[s]}
          </button>
        ))}
      </div>
      </div>
      {!product && (
        <div className="mt-xs">
        <div className="scroll-row" role="group" aria-label="Browse by">
          {['', ...POST_CATEGORIES].map((c) => (
            <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={`toy shrink-0 min-h-[44px] rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${category === c ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
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
      {q.data?.muted && (
        <p role="status" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          You are muted in Community for now. You can read, but not post or reply. A guide or admin can lift it.
        </p>
      )}
      {(failed ?? modFailed) && (
        <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          {(failed ?? modFailed) instanceof Error ? ((failed ?? modFailed) as Error).message : 'That did not work.'}
        </p>
      )}
      {isMod && (
        <label className="mt-sm flex min-h-[44px] cursor-pointer items-center gap-xs text-[14px] font-bold text-ink-soft">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} className="size-[18px] accent-ink" />
          Show hidden posts
        </label>
      )}
      {q.isError && <p className="mt-md font-bold">{q.error instanceof Error ? q.error.message : 'Could not load.'}</p>}
      {q.isPending && <SkeletonList className="mt-md" count={3} lines={3} label="Loading posts" />}
      {posts.length === 0 && q.data && <p className="mt-md m-0 text-[14px] font-semibold text-ink-soft">{filter === 'following' ? 'Nobody you follow has posted yet. Follow people from their posts.' : filter === 'mine' ? 'You have not posted yet.' : 'No posts here yet. Start the conversation.'}</p>}
      <ul className="mt-md flex list-none flex-col gap-sm p-0 m-0">
        {posts.map((p) => (
          <li key={p.id} data-pillar="friendship" className={`rounded-card bg-card p-md shadow-toy-soft ${p.hidden || p.held ? 'opacity-60' : ''}`}>
            {(p.pinned || p.held) && <p className="m-0 mb-xs text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{p.held ? 'Waiting for a guide’s okay. Only you see it for now.' : 'Pinned by a guide'}</p>}
            <div className="flex items-center gap-sm">
              <span className="flex size-[40px] items-center justify-center rounded-pill bg-r2 font-display text-[16px] font-extrabold text-on-fill" aria-hidden="true">
                {p.anonymous ? '?' : p.authorName.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-xs">
                  {p.anonymous ? (
                    <span className="truncate text-[16px] font-bold">{p.authorName}</span>
                  ) : (
                    <Link to={p.authorHandle ? `/u/${p.authorHandle}` : `/people/${p.authorId}`} className="inline-flex min-h-[44px] min-w-0 items-center truncate text-[16px] font-bold">
                      {p.authorName}
                    </Link>
                  )}
                  {p.anonymous && <IconTag tone="neutral" icon="UserRound">{p.mine ? 'Anonymous, you' : 'Anonymous'}</IconTag>}
                  {p.authorPro && <IconTag tone="deep" icon="Crown">Pro</IconTag>}
                </span>
                <span className="block text-[12px] font-bold text-ink-soft">
                  {p.category}, {new Date(p.createdAt).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' })}
                  {p.authorFollowers > 0 ? ` · ${p.authorFollowers} ${p.authorFollowers === 1 ? 'follower' : 'followers'}` : ''}
                  {p.hidden ? ', hidden' : ''}
                </span>
              </span>
              {!p.mine && !p.anonymous && (
                <button type="button" aria-pressed={p.authorFollowing} onClick={() => follow.mutate(p.authorId)} disabled={follow.isPending} className={`toy shrink-0 min-h-[44px] rounded-pill border-2 px-sm py-xs text-[12px] font-extrabold ${p.authorFollowing ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                  {p.authorFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
            <p className="mt-sm m-0 whitespace-pre-wrap text-[16px] font-semibold leading-relaxed"><Inert text={p.body} /></p>
            <div className="mt-sm flex flex-wrap items-center gap-xs">
              {!p.held && <Reactions counts={p.reactions} mine={p.myReaction} busy={like.isPending} onPick={(kind) => like.mutate({ id: p.id, kind })} />}
              {!p.held && (
                <button type="button" onClick={() => setOpen(p)} className="toy toy-soft inline-flex min-h-[44px] items-center gap-xs rounded-pill bg-paper px-sm text-[14px] font-bold">
                  <Icon icon={MessageCircle} size={16} /> {p.replies}
                </button>
              )}
              <span className="flex-1" />
              {/* React and reply are the two actions most posts need; everything else (follow the post, pin, delete,
                  block, mute, hide) sits behind one More button instead of a row of equal pills. */}
              <MoreMenu
                label={`More for ${p.authorName}'s post`}
                items={[
                  ...(!p.held ? [{ key: 'followPost', label: p.followingPost ? 'Following the post' : 'Follow the post', onSelect: () => followPost.mutate(p.id) }] : []),
                  ...(isMod && !p.held && !p.hidden ? [{ key: 'pin', label: p.pinned ? 'Unpin' : 'Pin', onSelect: () => pin.mutate({ id: p.id, pinned: !p.pinned }) }] : []),
                  ...(p.mine ? [{ key: 'delete', label: 'Delete', destructive: true, onSelect: () => window.confirm('Delete your post?') && remove.mutate(p.id) }] : []),
                  ...(!p.mine ? [{ key: 'block', label: 'Block', destructive: true, onSelect: () => window.confirm(`Block ${p.authorName}? You will not see each other's posts, and any friendship ends. You can undo it under Bond.`) && block.mutate(p.id) }] : []),
                  ...(me.data && me.data.user.id !== p.authorId && canMute(myRank, p.authorRank) ? [{ key: 'mute', label: 'Mute', destructive: true, onSelect: () => window.confirm(`Mute ${p.authorName} in Community? They can still read but cannot post or reply.`) && mute.mutate(p.authorId) }] : []),
                  ...(isMod && me.data?.user.id !== p.authorId ? [{ key: 'hide', label: p.hidden ? 'Unhide' : 'Hide', onSelect: () => hide.mutate({ id: p.id, hidden: !p.hidden }) }] : []),
                ]}
              />
            </div>
          </li>
        ))}
      </ul>
      <Pager page={q.data?.page} label="posts" />
      {canMute(myRank, 'member') && <MutedList />}
      <PostSheet open={writing} product={product} onClose={() => setWriting(false)} onSaved={(xp, held) => { refresh(); setNotice(held ? 'Thanks! A guide looks at a first post before it goes up. It pays once they say okay.' : null); if (xp > 0) celebrate({ title: 'Posted', totalXp: xp, color: 'var(--color-r2)' }); }} />
      <RepliesSheet post={open} onClose={() => setOpen(null)} onSaved={(xp) => { refresh(); if (xp > 0) celebrate({ title: 'Replied', totalXp: xp, color: 'var(--color-r2)' }); }} />
    </Screen>
  );
}

function PostSheet({ open, product, onClose, onSaved }: { open: boolean; product?: string; onClose: () => void; onSaved: (xp: number, held: boolean) => void }) {
  const [category, setCategory] = useState<string>('Stories');
  const [body, setBody] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const save = useMutation({
    mutationFn: () => api.createPost({ category, body, productId: product ?? null, anonymous }),
    onSuccess: (r) => {
      setBody('');
      setAnonymous(false);
      onSaved(r.awarded.xp, r.held);
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Write a post">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) save.mutate();
        }}
      >
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Pick a category</legend>
          <div className="mt-xs grid grid-cols-3 gap-xs">
            {POST_CATEGORIES.map((c) => (
              <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={`min-h-[44px] rounded-tile border-2 text-[12px] font-bold ${category === c ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
                {c}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="block text-[14px] font-bold">Your post</span>
          <textarea autoFocus value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={5} placeholder="What is on your mind?" className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
        </label>
        <AnonToggle on={anonymous} onChange={setAnonymous} />
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
  const [anonymous, setAnonymous] = useState(false);
  // The reply being answered, or null for a reply straight to the post.
  const [to, setTo] = useState<CommunityReply | null>(null);
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const react = useMutation({ mutationFn: (v: { id: string; kind: ReactionKind }) => api.reactReply(v.id, v.kind), onSuccess: () => void q.refetch() });
  const blockAuthor = useMutation({ mutationFn: (id: string) => api.blockReplyAuthor(id), onSuccess: () => void q.refetch() });
  const send = useMutation({
    mutationFn: () => api.reply(post!.id, text, { anonymous, parentId: to?.id ?? null }),
    onSuccess: (r) => {
      setText('');
      setTo(null);
      q.refetch();
      onSaved(r.awarded.xp);
    },
  });
  const replies = q.data?.replies ?? [];
  // A folded reply hides everything under it: the ones after it that sit deeper, until a reply at its level or above.
  const visible: CommunityReply[] = [];
  let hideBelow: number | null = null;
  for (const r of replies) {
    if (hideBelow !== null && r.depth > hideBelow) continue;
    hideBelow = folded.has(r.id) ? r.depth : null;
    visible.push(r);
  }
  const kidsOf = (id: string, depth: number) => {
    const i = replies.findIndex((x) => x.id === id);
    let n = 0;
    for (let k = i + 1; k < replies.length && (replies[k]?.depth ?? 0) > depth; k++) n++;
    return n;
  };
  return (
    <Sheet open={post !== null} onClose={onClose} title={post ? `${post.replies} ${post.replies === 1 ? 'reply' : 'replies'}` : ''}>
      {post && (
        <>
          <p className="m-0 rounded-tile bg-paper p-sm text-[14px] font-semibold">
            <span className="block text-[12px] font-extrabold text-ink-soft">{post.authorName}{post.anonymous ? ' (anonymous)' : ''}</span>
            <Inert text={post.body} />
          </p>
          <ul className="mt-md flex list-none flex-col gap-xs p-0 m-0">
            {visible.map((r) => {
              const kids = kidsOf(r.id, r.depth);
              return (
                <li key={r.id} style={{ marginLeft: `calc(var(--spacing-md) * ${r.depth})` }} className={`rounded-tile bg-card p-sm shadow-toy-soft ${r.depth > 0 ? 'border-l-4 border-line' : ''}`}>
                  <p className="m-0 text-[14px] font-bold">
                    {r.authorName}
                    {r.anonymous && <IconTag className="ml-xs" tone="neutral" icon="UserRound">{r.mine ? 'Anonymous, you' : 'Anonymous'}</IconTag>}{' '}
                    <span className="font-semibold text-ink-soft">{new Date(r.createdAt).toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' })}</span>
                  </p>
                  <p className="mt-xs m-0 text-[16px] font-semibold"><Inert text={r.body} /></p>
                  <div className="mt-xs flex flex-wrap items-center gap-xs">
                    <Reactions counts={r.reactions} mine={r.myReaction} busy={react.isPending} onPick={(kind) => react.mutate({ id: r.id, kind })} />
                    <Button variant="ghost" size="sm" onClick={() => setTo(r)}>
                      Reply
                    </Button>
                    {kids > 0 && (
                      <Button variant="ghost" size="sm" aria-expanded={!folded.has(r.id)} onClick={() => setFolded((f) => { const n = new Set(f); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}>
                        {folded.has(r.id) ? `Show ${kids} ${kids === 1 ? 'reply' : 'replies'}` : 'Fold'}
                      </Button>
                    )}
                    {!r.mine && (
                      <Button variant="ghost" size="sm" onClick={() => window.confirm(`Block ${r.authorName}? You will not see each other's posts or replies.`) && blockAuthor.mutate(r.id)}>
                        Block
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <PagerBar page={q.data?.page} onPage={(page, size) => setRp({ page, size })} label="replies" />
          <form
            className="mt-md flex flex-col gap-xs"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) send.mutate();
            }}
          >
            {to && (
              <p className="m-0 flex items-center justify-between gap-xs rounded-tile bg-paper p-xs text-[12px] font-bold text-ink-soft">
                <span className="min-w-0 truncate">Replying to {to.authorName}: <Inert text={to.body} /></span>
                <Button variant="ghost" size="sm" onClick={() => setTo(null)}>
                  Cancel
                </Button>
              </p>
            )}
            <div className="flex gap-xs">
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={to ? 'Write your answer' : 'Write a reply'} aria-label="Reply" className="min-w-0 flex-1 rounded-pill border-2 border-line bg-paper px-md py-sm text-[16px]" />
              <Button type="submit" disabled={send.isPending || !text.trim()}>
                Send
              </Button>
            </div>
            <AnonToggle on={anonymous} onChange={setAnonymous} />
            {send.isError && <p role="alert" className="m-0 text-[14px] font-bold">{send.error instanceof Error ? send.error.message : 'That did not send.'}</p>}
          </form>
        </>
      )}
    </Sheet>
  );
}
