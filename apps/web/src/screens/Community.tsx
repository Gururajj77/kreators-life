import { POST_CATEGORIES, type CommunityPost } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useAuthed, useCommunity, useMe, useRefreshAll } from '../lib/queries';

export function Community() {
  const me = useMe();
  const [params] = useSearchParams();
  const product = params.get('product') ?? undefined;
  const [category, setCategory] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const isMod = Boolean(me.data && me.data.user.role !== 'user');
  const q = useCommunity(category || undefined, product, isMod && showHidden);
  const refresh = useRefreshAll();
  const [writing, setWriting] = useState(false);
  const [open, setOpen] = useState<CommunityPost | null>(null);
  const like = useMutation({ mutationFn: (id: string) => api.likePost(id), onSuccess: () => refresh() });
  const remove = useMutation({ mutationFn: (id: string) => api.deletePost(id), onSuccess: () => refresh() });
  const hide = useMutation({ mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) => api.hidePost(id, hidden), onSuccess: () => refresh() });
  const posts = q.data?.posts ?? [];

  return (
    <Screen>
      <header className="pt-lg">
        <h1 className="text-[30px]">{product ? 'Members' : 'Community'}</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{product ? 'A members-only feed for this membership.' : 'A place of warmth. Everyone is heard, and guides keep it kind.'}</p>
        <Button full className="mt-md" onClick={() => setWriting(true)}>
          Write a post
        </Button>
      </header>
      {!product && (
        <div className="mt-md flex gap-xs overflow-x-auto pb-xs scrollbar-none" role="group" aria-label="Browse by">
          {['', ...POST_CATEGORIES].map((c) => (
            <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={`shrink-0 rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${category === c ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
              {c || 'Everything'}
            </button>
          ))}
        </div>
      )}
      {isMod && (
        <label className="mt-sm flex items-center gap-xs text-[14px] font-bold text-ink-soft">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} className="size-[18px] accent-ink" />
          Show hidden posts
        </label>
      )}
      {q.isError && <p className="mt-md font-bold">{q.error instanceof Error ? q.error.message : 'Could not load.'}</p>}
      {posts.length === 0 && q.data && <p className="mt-md m-0 text-[14px] font-semibold text-ink-soft">No posts here yet. Start the conversation.</p>}
      <ul className="mt-md flex list-none flex-col gap-sm p-0 m-0">
        {posts.map((p) => (
          <li key={p.id} className={`rounded-card bg-card p-md shadow-toy-soft ${p.hidden ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-sm">
              <span className="flex size-[40px] items-center justify-center rounded-pill bg-r2 font-display text-[16px] font-extrabold text-on-fill" aria-hidden="true">
                {p.authorName.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-xs">
                  {p.authorHandle ? (
                    <Link to={`/u/${p.authorHandle}`} className="truncate text-[16px] font-bold">
                      {p.authorName}
                    </Link>
                  ) : (
                    <span className="truncate text-[16px] font-bold">{p.authorName}</span>
                  )}
                  {p.authorPro && <span className="rounded-pill bg-r7 px-xs text-[11px] font-extrabold leading-[18px] text-white">Pro</span>}
                </span>
                <span className="block text-[12px] font-bold text-ink-soft">
                  {p.category}, {new Date(p.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  {p.hidden ? ', hidden' : ''}
                </span>
              </span>
            </div>
            <p className="mt-sm m-0 whitespace-pre-wrap text-[16px] font-semibold leading-relaxed">{p.body}</p>
            <div className="mt-sm flex items-center gap-xs">
              <button type="button" aria-pressed={p.liked} onClick={() => like.mutate(p.id)} className={`toy toy-soft inline-flex min-h-[40px] items-center gap-xs rounded-pill px-sm text-[14px] font-bold ${p.liked ? 'bg-r1/15 text-ink' : 'bg-paper'}`}>
                <span aria-hidden="true">{p.liked ? '❤️' : '🤍'}</span> {p.likes}
              </button>
              <button type="button" onClick={() => setOpen(p)} className="toy toy-soft inline-flex min-h-[40px] items-center gap-xs rounded-pill bg-paper px-sm text-[14px] font-bold">
                <span aria-hidden="true">💬</span> {p.replies}
              </button>
              <span className="flex-1" />
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
      <PostSheet open={writing} product={product} onClose={() => setWriting(false)} onSaved={refresh} />
      <RepliesSheet post={open} onClose={() => setOpen(null)} onSaved={refresh} />
    </Screen>
  );
}

function PostSheet({ open, product, onClose, onSaved }: { open: boolean; product?: string; onClose: () => void; onSaved: () => void }) {
  const [category, setCategory] = useState<string>('Stories');
  const [body, setBody] = useState('');
  const save = useMutation({
    mutationFn: () => api.createPost({ category, body, productId: product ?? null }),
    onSuccess: () => {
      setBody('');
      onSaved();
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

function RepliesSheet({ post, onClose, onSaved }: { post: CommunityPost | null; onClose: () => void; onSaved: () => void }) {
  const q = useAuthed(['replies', post?.id ?? ''], () => api.replies(post!.id), Boolean(post));
  const [text, setText] = useState('');
  const send = useMutation({
    mutationFn: () => api.reply(post!.id, text),
    onSuccess: () => {
      setText('');
      q.refetch();
      onSaved();
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
              </li>
            ))}
          </ul>
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
