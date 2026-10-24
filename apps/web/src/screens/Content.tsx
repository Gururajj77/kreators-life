import { CONTENT_KINDS, LINK_SOURCES, SOCIAL_PLATFORM_META, type ContentItem, type TrackedLink } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useAuthed, useStudio } from '../lib/queries';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const chip = (on: boolean) => `min-h-[44px] rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`;

function Back() {
  return (
    <Link to="/shop" className="inline-flex min-h-[44px] items-center gap-xs font-bold text-ink-soft">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5l-7 7 7 7" />
      </svg>
      Shop
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 font-display text-[24px] font-extrabold leading-none">{value}</p>
      <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{label}</p>
    </div>
  );
}

const err = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export function Content() {
  const [sort, setSort] = useState<'revenue' | 'views' | 'recent'>('revenue');
  const content = useAuthed(['content', sort], () => api.content(sort));
  const links = useAuthed(['links'], api.links);
  const studio = useStudio();
  const [adding, setAdding] = useState(false);
  const [linking, setLinking] = useState(false);
  const d = content.data;
  const attributed = studio.data?.analytics.attributed ?? 0;
  const direct = d?.direct.sales ?? studio.data?.analytics.direct ?? 0;
  const goBase = `${window.location.origin}/go/`;

  return (
    <Screen>
      <header className="pt-lg">
        <Back />
        <h1 className="text-[30px]">Content</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Which post made money. Share the /go link instead of the plain one and every sale is credited to the post it came from.</p>
      </header>

      <section className="mt-md grid grid-cols-3 gap-xs" aria-label="Numbers">
        <Stat label="sales from links" value={attributed} />
        <Stat label="profile direct" value={direct} />
        <Stat label="points via links" value={d?.items.reduce((a, i) => a + i.revenuePoints, 0) ?? 0} />
      </section>

      <section className="mt-lg" aria-labelledby="posts-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="posts-heading" className="text-[24px]">
            Posts
          </h2>
          <Button onClick={() => setAdding(true)}>Add a post</Button>
        </div>
        <div className="mt-sm flex gap-xs" role="group" aria-label="Sort posts">
          {(
            [
              ['revenue', 'By revenue'],
              ['views', 'By views'],
              ['recent', 'Newest'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className={chip(sort === k)}>
              {label}
            </button>
          ))}
        </div>
        {d && d.items.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">No posts yet. Add the link to a Reel, post or video and you get a tracked link for it.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {d?.items.map((item) => (
            <ContentCard key={item.id} item={item} onChange={() => void Promise.all([content.refetch(), links.refetch()])} />
          ))}
        </ul>
      </section>

      <section className="mt-lg" aria-labelledby="links-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="links-heading" className="text-[24px]">
            Tracked links
          </h2>
          <Button onClick={() => setLinking(true)}>New link</Button>
        </div>
        {links.data && links.data.links.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Nothing yet. A link can open your page or one product.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {links.data?.links.map((l) => (
            <LinkCard key={l.id} link={l} goBase={goBase} onChange={() => void links.refetch()} />
          ))}
        </ul>
      </section>

      <AddPostSheet
        open={adding}
        onClose={() => setAdding(false)}
        products={studio.data?.products ?? []}
        onDone={() => {
          setAdding(false);
          void Promise.all([content.refetch(), links.refetch()]);
        }}
      />
      <NewLinkSheet
        open={linking}
        onClose={() => setLinking(false)}
        products={studio.data?.products ?? []}
        items={d?.items ?? []}
        onDone={() => {
          setLinking(false);
          void links.refetch();
        }}
      />
    </Screen>
  );
}

function ContentCard({ item, onChange }: { item: ContentItem; onChange: () => void }) {
  const [typing, setTyping] = useState(false);
  const [views, setViews] = useState(String(item.views));
  const [likes, setLikes] = useState(String(item.likes));
  const [comments, setComments] = useState(String(item.comments));
  const refresh = useMutation({
    mutationFn: (body?: { views: number; likes?: number; comments?: number }) => api.refreshContent(item.id, body),
    onSuccess: () => {
      setTyping(false);
      onChange();
    },
  });
  const remove = useMutation({ mutationFn: () => api.deleteContent(item.id), onSuccess: onChange });
  const platform = SOCIAL_PLATFORM_META[item.platform]?.name ?? 'Other';
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 text-[12px] font-bold text-ink-soft">
        {platform}, {item.kind}
        {item.syncedAt ? `, numbers from ${new Date(item.syncedAt).toLocaleString()}` : ', numbers not read yet'}
      </p>
      <a href={item.url} target="_blank" rel="noreferrer" className="mt-xs block break-words text-[16px] font-bold underline-offset-4 hover:underline">
        {item.caption || item.url}
      </a>
      <dl className="mt-sm grid grid-cols-3 gap-xs m-0 text-[14px]">
        {(
          [
            ['views', item.views],
            ['likes', item.likes],
            ['comments', item.comments],
            ['links', item.links],
            ['clicks', item.clicks],
            ['sales', item.sales],
            ['points', item.revenuePoints],
            ['pts per 1k views', item.rpm ?? 'n/a'],
          ] as [string, string | number][]
        ).map(([k, v]) => (
          <div key={k} className="rounded-tile bg-paper p-xs">
            <dt className="text-[12px] font-bold text-ink-soft">{k}</dt>
            <dd className="m-0 font-display text-[16px] font-extrabold">{v}</dd>
          </div>
        ))}
      </dl>
      {refresh.isError && (
        <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          {err(refresh.error, 'Could not read the numbers.')}
        </p>
      )}
      {refresh.isSuccess && !typing && <p className="mt-sm m-0 text-[14px] font-bold">{refresh.data.why}</p>}
      {typing ? (
        <form
          className="mt-sm flex flex-wrap items-end gap-xs"
          onSubmit={(e) => {
            e.preventDefault();
            refresh.mutate({ views: Number(views) || 0, likes: Number(likes) || 0, comments: Number(comments) || 0 });
          }}
        >
          <label className="block w-[96px]">
            <span className="block text-[12px] font-bold">Views</span>
            <input type="number" min={0} value={views} onChange={(e) => setViews(e.target.value)} className={field} />
          </label>
          <label className="block w-[96px]">
            <span className="block text-[12px] font-bold">Likes</span>
            <input type="number" min={0} value={likes} onChange={(e) => setLikes(e.target.value)} className={field} />
          </label>
          <label className="block w-[96px]">
            <span className="block text-[12px] font-bold">Comments</span>
            <input type="number" min={0} value={comments} onChange={(e) => setComments(e.target.value)} className={field} />
          </label>
          <Button type="submit" disabled={refresh.isPending}>
            Save
          </Button>
          <Button variant="ghost" onClick={() => setTyping(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <div className="mt-sm flex flex-wrap gap-xs">
          <Button variant="outline" onClick={() => refresh.mutate(undefined)} disabled={refresh.isPending}>
            Refresh numbers
          </Button>
          <Button variant="outline" onClick={() => setTyping(true)}>
            Type the numbers
          </Button>
          <Button variant="ghost" disabled={remove.isPending} onClick={() => window.confirm('Remove this post and its tracked links?') && remove.mutate()}>
            Remove
          </Button>
        </div>
      )}
    </li>
  );
}

function LinkCard({ link, goBase, onChange }: { link: TrackedLink; goBase: string; onChange: () => void }) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const remove = useMutation({ mutationFn: () => api.deleteLink(link.id), onSuccess: onChange });
  const url = `${goBase}${link.code}`;
  useEffect(() => {
    if (!qrOpen || qr) return;
    QRCode.toDataURL(url, { margin: 1, width: 160 })
      .then(setQr)
      .catch(() => setQrError('Could not draw the code.'));
  }, [qrOpen, qr, url]);
  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the link is visible to select by hand.
    }
  };
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 text-[16px] font-bold">{link.label || `Link ${link.code}`}</p>
      <p className="mt-xs m-0 break-all text-[14px] font-semibold">{url}</p>
      <p className="m-0 text-[14px] font-semibold text-ink-soft">
        Opens {link.productTitle ?? 'your page'}, from {link.sourceType}. {link.clicks} clicks, {link.checkouts} checkouts, {link.sales} sales, {link.revenuePoints} points.
      </p>
      <div className="mt-sm flex flex-wrap gap-xs">
        <Button variant="outline" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="outline" onClick={() => setQrOpen(true)}>
          QR
        </Button>
        <Button variant="ghost" disabled={remove.isPending} onClick={() => window.confirm('Remove this link? Sales already credited stay.') && remove.mutate()}>
          Remove
        </Button>
      </div>
      <Sheet open={qrOpen} onClose={() => setQrOpen(false)} title={link.label || `Link ${link.code}`}>
        <div className="flex flex-col items-center gap-sm text-center">
          {qr ? <img src={qr} width={160} height={160} alt={`QR code for ${url}`} className="rounded-tile bg-white p-xs" /> : qrError ? <p className="m-0 text-[14px] font-bold">{qrError}</p> : <p className="m-0 text-[14px] font-semibold text-ink-soft">Drawing the code</p>}
          <p className="m-0 break-all text-[14px] font-semibold">{url}</p>
          <p className="m-0 text-[12px] font-semibold text-ink-soft">Put it on a slide, a poster or a video end card. Every scan is credited to this link.</p>
          <Button variant="outline" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      </Sheet>
    </li>
  );
}

function AddPostSheet({ open, onClose, products, onDone }: { open: boolean; onClose: () => void; products: { id: string; title: string }[]; onDone: () => void }) {
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [kind, setKind] = useState<ContentItem['kind']>('reel');
  const [productId, setProductId] = useState('');
  const [views, setViews] = useState('');
  const add = useMutation({
    mutationFn: () => api.addContent({ url, caption: caption || undefined, kind, productId: productId || null, views: views ? Number(views) : undefined }),
    onSuccess: () => {
      setUrl('');
      setCaption('');
      setViews('');
      onDone();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Add a post">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) add.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Public link to the post</span>
          <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://" className={field} />
          <span className="mt-xs block text-[12px] font-bold text-ink-soft">YouTube numbers are read automatically. For Instagram, TikTok and others, type the views yourself.</span>
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Caption or a short name</span>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} className={field} />
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Kind</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {CONTENT_KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>
                {k}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="block text-[14px] font-bold">Tracked link opens</span>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={field}>
            <option value="">Your page</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Views so far, if the platform cannot be read</span>
          <input type="number" min={0} value={views} onChange={(e) => setViews(e.target.value)} className={field} placeholder="Optional" />
        </label>
        {add.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {err(add.error, 'Could not add it.')}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={add.isPending || !url.trim()}>
          Add post and make its link
        </Button>
      </form>
    </Sheet>
  );
}

function NewLinkSheet({ open, onClose, products, items, onDone }: { open: boolean; onClose: () => void; products: { id: string; title: string }[]; items: ContentItem[]; onDone: () => void }) {
  const [label, setLabel] = useState('');
  const [productId, setProductId] = useState('');
  const [sourceType, setSourceType] = useState<TrackedLink['sourceType']>('bio');
  const [contentItemId, setContentItemId] = useState('');
  const create = useMutation({
    mutationFn: () => api.createLink({ label, productId: productId || null, sourceType, contentItemId: contentItemId || null }),
    onSuccess: () => {
      setLabel('');
      onDone();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="New tracked link">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Label</span>
          <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="Bio link, newsletter footer" className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Opens</span>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={field}>
            <option value="">Your page</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Where it will be shared</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {LINK_SOURCES.map((s) => (
              <button key={s} type="button" aria-pressed={sourceType === s} onClick={() => setSourceType(s)} className={chip(sourceType === s)}>
                {s}
              </button>
            ))}
          </div>
        </fieldset>
        {items.length > 0 && (
          <label className="block">
            <span className="block text-[14px] font-bold">Tie it to a post</span>
            <select value={contentItemId} onChange={(e) => setContentItemId(e.target.value)} className={field}>
              <option value="">None</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.caption || i.url}
                </option>
              ))}
            </select>
          </label>
        )}
        {create.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {err(create.error, 'Could not create it.')}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={create.isPending}>
          Create link
        </Button>
      </form>
    </Sheet>
  );
}
