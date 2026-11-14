import { CONTENT_KINDS, LINK_SOURCES, SOCIAL_PLATFORM_META, type ContentItem, type TrackedLink } from '@kreators/shared';
import { dateTime } from '../lib/date';
import { useMutation } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { ConfirmDelete, DELETE_BTN } from '../components/ConfirmDelete';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api, errorText } from '../lib/api';
import { useAuthed, useStudio } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { FIELD } from '../lib/ui';
import { copyPlain } from '../lib/clipboard';
import { StatTile } from '../components/Charts';
import { Fold } from '../components/Fold';

/** Agency's PAPER_FILL (components/AgencyInvoices.tsx), copied so this page does not pull the Agency chunk in: equal parts on a
 * phone's row, each its own width from 34rem. */
const PAPER_FILL = 'flex w-full *:flex-1 *:px-xs @min-[34rem]:inline-flex @min-[34rem]:w-auto @min-[34rem]:*:flex-none @min-[34rem]:*:px-sm';
const chip = (on: boolean) => `min-h-[36px] md:min-h-[44px] tap-pad rounded-pill border-2 px-sm py-0 md:py-xs text-subhead font-medium ${on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`;




/** Which post made money: tracked links and the posts behind them. The brand folders live one level up. */
export function ContentResults() {
  const [sort, setSort] = useState<'revenue' | 'views' | 'recent'>('revenue');
  const pg = usePage();
  const kp = usePage('k');
  const content = useAuthed(['content', sort, pg.query], () => api.content(sort, pg.query));
  const links = useAuthed(['links', kp.query], () => api.links(kp.query));
  const studio = useStudio();
  const [adding, setAdding] = useState(false);
  const [linking, setLinking] = useState(false);
  const d = content.data;
  const attributed = studio.data?.analytics.attributed ?? 0;
  const direct = d?.direct.sales ?? studio.data?.analytics.direct ?? 0;
  const goBase = `${window.location.origin}/go/`;

  return (
    <Screen>
      <AppCover back={{ to: '/shop/content', label: 'Content' }} title="Posts and links" lede="Which post made money. Share the /go link instead of the plain one and every sale is credited to the post it came from." />

      <section className="mt-md grid grid-cols-3 gap-xs" aria-label="Numbers">
        <StatTile label="sales from links" value={attributed} />
        <StatTile label="profile direct" value={direct} />
        <StatTile label="points via links" value={d?.items.reduce((a, i) => a + i.revenuePoints, 0) ?? 0} />
      </section>

      <section className="mt-lg" aria-labelledby="posts-heading">
        <h2 id="posts-heading" className="text-title2">
          Posts
        </h2>
        {/* The sort at the left and Add a post at the right of one row, like Agency's List and Board (the founder, 2026-11-06); in a row
            under 34rem (a phone) the sort fills its line in equal parts and the button takes the next, full width. */}
        <div className="@container mt-sm flex flex-wrap items-center justify-between gap-sm">
          <div className="basis-full @min-[34rem]:basis-auto">
            <div className={`gap-xs ${PAPER_FILL}`} role="group" aria-label="Sort posts">
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
          </div>
          <Button className="basis-full justify-center @min-[34rem]:basis-auto" onClick={() => setAdding(true)}>
            Add a post
          </Button>
        </div>
        {d && d.items.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">No posts yet. Add the link to a Reel, post or video and you get a tracked link for it.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {d?.items.map((item) => (
            <ContentCard key={item.id} item={item} onChange={() => void Promise.all([content.refetch(), links.refetch()])} />
          ))}
        </ul>
        <Pager page={d?.page} label="posts" />
      </section>

      <section className="mt-lg" aria-labelledby="links-heading">
        {/* Empty, the line sits beside the button, so the button is held to one title line (as on Section). With rows, the button
            keeps the row's height, so it never hangs over the first card. */}
        <div className={`flex justify-between gap-sm ${(links.data && links.data.links.length === 0) ? 'items-start' : 'items-center'}`}>
          <div className="min-w-0">
            <h2 id="links-heading" className="text-title2">
              Tracked links
            </h2>
            {links.data && links.data.links.length === 0 && <p className="mt-xs m-0 text-balance text-subhead text-ink-soft">Nothing yet. A link can open your page or one product.</p>}
          </div>
          <div className={`flex shrink-0 items-center ${(links.data && links.data.links.length === 0) ? 'h-[1.2em] text-[24px] leading-none' : ''}`}>
            <Button variant="outline" onClick={() => setLinking(true)}>New link</Button>
          </div>
        </div>
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {links.data?.links.map((l) => (
            <LinkCard key={l.id} link={l} goBase={goBase} onChange={() => void links.refetch()} />
          ))}
        </ul>
        <Pager page={links.data?.page} prefix="k" label="links" />
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
  const [deleting, setDeleting] = useState(false);
  const platform = SOCIAL_PLATFORM_META[item.platform]?.name ?? 'Other';
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 text-caption text-ink-soft">
        {platform}, {item.kind}
        {item.syncedAt ? `, numbers from ${dateTime(item.syncedAt)}` : ', numbers not read yet'}
      </p>
      <a href={item.url} target="_blank" rel="noreferrer" className="mt-xs flex min-h-[44px] items-center text-headline underline-offset-4 hover:underline">
        <span className="min-w-0 break-words">{item.caption || item.url}</span>
      </a>
      <dl className="mt-sm grid grid-cols-3 gap-xs m-0 text-subhead">
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
            <dt className="text-caption text-ink-soft">{k}</dt>
            <dd className="m-0 text-headline">{v}</dd>
          </div>
        ))}
      </dl>
      {refresh.isError && (
        <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-subhead">
          {errorText(refresh.error, 'Could not read the numbers.')}
        </p>
      )}
      {refresh.isSuccess && !typing && <p className="mt-sm m-0 text-subhead">{refresh.data.why}</p>}
      {typing ? (
        <form
          className="mt-sm flex flex-wrap items-end gap-xs"
          onSubmit={(e) => {
            e.preventDefault();
            refresh.mutate({ views: Number(views) || 0, likes: Number(likes) || 0, comments: Number(comments) || 0 });
          }}
        >
          <label className="block min-w-[96px] flex-1">
            <span className="block text-caption">Views</span>
            <input type="number" min={0} value={views} onChange={(e) => setViews(e.target.value)} className={FIELD} />
          </label>
          <label className="block min-w-[96px] flex-1">
            <span className="block text-caption">Likes</span>
            <input type="number" min={0} value={likes} onChange={(e) => setLikes(e.target.value)} className={FIELD} />
          </label>
          <label className="block min-w-[96px] flex-1">
            <span className="block text-caption">Comments</span>
            <input type="number" min={0} value={comments} onChange={(e) => setComments(e.target.value)} className={FIELD} />
          </label>
          <Button type="submit" disabled={refresh.isPending}>
            Save
          </Button>
          <Button variant="ghost" onClick={() => setTyping(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <div className="mt-sm flex flex-wrap gap-xs fill-row">
          <Button variant="outline" onClick={() => refresh.mutate(undefined)} disabled={refresh.isPending}>
            Refresh numbers
          </Button>
          <Button variant="outline" onClick={() => setTyping(true)}>
            Type the numbers
          </Button>
          <button type="button" disabled={remove.isPending} onClick={() => setDeleting(true)} className={DELETE_BTN}>
            Remove
          </button>
        </div>
      )}
      <ConfirmDelete open={deleting} title="Delete this post?" body="The post goes. Its tracked links keep working, and sales already credited stay. This cannot be undone." pending={remove.isPending} failed={remove.isError} onYes={() => remove.mutate()} onClose={() => setDeleting(false)} />
    </li>
  );
}

function LinkCard({ link, goBase, onChange }: { link: TrackedLink; goBase: string; onChange: () => void }) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const remove = useMutation({ mutationFn: () => api.deleteLink(link.id), onSuccess: onChange });
  const [deleting, setDeleting] = useState(false);
  const url = `${goBase}${link.code}`;
  useEffect(() => {
    if (!qrOpen || qr) return;
    QRCode.toDataURL(url, { margin: 1, width: 160 })
      .then(setQr)
      .catch(() => setQrError('Could not draw the code.'));
  }, [qrOpen, qr, url]);
  const copy = async () => {
    // Clipboard blocked: the link is visible to select by hand.
    if (!(await copyPlain(url))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 text-card-title">{link.label || `Link ${link.code}`}</p>
      <p className="mt-xs m-0 break-all text-card-note">{url}</p>
      <p className="m-0 text-card-note text-ink-soft">
        Opens {link.productTitle ?? 'your page'}, from {link.sourceType}. {link.clicks} clicks, {link.checkouts} checkouts, {link.sales} sales, {link.revenuePoints} points.
      </p>
      <div className="mt-sm flex flex-wrap gap-xs fill-row">
        <Button variant="outline" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <button type="button" disabled={remove.isPending} onClick={() => setDeleting(true)} className={DELETE_BTN}>
          Remove
        </button>
      </div>
      <ConfirmDelete open={deleting} title="Delete this link?" body="The link stops working, and any Auto-DM that sends it goes too. Sales already credited stay. This cannot be undone." pending={remove.isPending} failed={remove.isError} onYes={() => remove.mutate()} onClose={() => setDeleting(false)} />
      {/* The QR code folds out inside the link's own card (2026-11-06: no sheet for a picture and a copy button). */}
      <Fold title="QR code" open={qrOpen} onOpenChange={setQrOpen} className="mt-sm">
        <div className="flex flex-col items-center gap-sm rounded-tile bg-paper p-sm">
          {qr ? <img src={qr} width={160} height={160} alt={`QR code for ${url}`} className="rounded-tile bg-white p-xs" /> : qrError ? <p className="m-0 text-subhead">{qrError}</p> : <p role="status" className="m-0 text-subhead text-ink-soft">Drawing the code</p>}
          <p className="m-0 break-all text-subhead">{url}</p>
          <p className="m-0 text-caption text-ink-soft">Put it on a slide, a poster or a video end card. Every scan is credited to this link.</p>
          <Button variant="outline" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      </Fold>
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
          <span className="block text-subhead font-semibold">Public link to the post</span>
          <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://" className={FIELD} />
          <span className="mt-xs block text-caption text-ink-soft">YouTube numbers are read automatically. For Instagram, TikTok and others, type the views yourself.</span>
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Caption or a short name</span>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} className={FIELD} />
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-subhead font-semibold">Kind</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {CONTENT_KINDS.map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>
                {k}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="block text-subhead font-semibold">Tracked link opens</span>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={FIELD}>
            <option value="">Your page</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-subhead">Views so far, if the platform cannot be read</span>
          <input type="number" min={0} value={views} onChange={(e) => setViews(e.target.value)} className={FIELD} placeholder="Optional" />
        </label>
        {add.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
            {errorText(add.error, 'Could not add it.')}
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
          <span className="block text-subhead font-semibold">Label</span>
          <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="Bio link, newsletter footer" className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Opens</span>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={FIELD}>
            <option value="">Your page</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-subhead font-semibold">Where it will be shared</legend>
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
            <span className="block text-subhead font-semibold">Tie it to a post</span>
            <select value={contentItemId} onChange={(e) => setContentItemId(e.target.value)} className={FIELD}>
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
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
            {errorText(create.error, 'Could not create it.')}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={create.isPending}>
          Create link
        </Button>
      </form>
    </Sheet>
  );
}
