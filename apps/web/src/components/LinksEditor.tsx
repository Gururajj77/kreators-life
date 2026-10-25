import { LINK_BLOCK_META, LINK_BLOCK_TYPES, MAX_CAROUSEL_ITEMS, MAX_LINK_BLOCKS, type LinkBlock, type LinkBlockItem, type LinkBlockType } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { Button } from './Button';
import { Sheet } from './Sheet';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const newId = () => Math.random().toString(36).slice(2, 10);
const blank = (type: LinkBlockType): LinkBlock => ({ id: newId(), type, title: '', url: '', image: '', text: '', featured: false, on: true, items: [] });
const isHttps = (v: string) => v.trim() === '' || /^https:\/\/\S+$/.test(v.trim());

/** What a block needs before it can be saved, in plain words. Empty means it is fine. */
function problem(b: LinkBlock): string {
  if (b.type === 'link' && !isHttps(b.url)) return 'The link must start with https://';
  if (b.type === 'link' && !b.url.trim()) return 'Add the link.';
  if (b.type === 'header' && !b.title.trim()) return 'Add the header text.';
  if (b.type === 'text' && !b.text.trim()) return 'Write something.';
  if (b.type === 'image' && !/^https:\/\/\S+$/.test(b.image.trim())) return 'The picture needs an https:// address.';
  if (b.type === 'image' && !isHttps(b.url)) return 'The link must start with https://';
  if (b.type === 'video' && !/^https:\/\/\S+$/.test(b.url.trim())) return 'Paste the YouTube link, starting with https://';
  if (b.type === 'carousel' && b.items.filter((it) => it.title.trim() || it.image.trim()).length === 0) return 'Add at least one card.';
  if (b.type === 'carousel' && b.items.some((it) => !isHttps(it.url) || !isHttps(it.image))) return 'Every card link and picture must start with https://';
  return '';
}

/**
 * The creator's own links page, edited in place: add a block, change it, move it, hide it, remove it.
 * Every change saves straight away. The clicks column shows what people actually open.
 */
export function LinksEditor({ initial }: { initial: LinkBlock[] }) {
  const refresh = useRefreshAll();
  const [blocks, setBlocks] = useState<LinkBlock[]>(initial);
  const [editing, setEditing] = useState<LinkBlock | null>(null);
  const [isNew, setIsNew] = useState(false);
  const clicks = useAuthed(['link-clicks'], api.linkClicks);
  const save = useMutation({
    mutationFn: (next: LinkBlock[]) => api.updateMe({ links: next }),
    onSuccess: async (r) => {
      if (r.user) setBlocks(r.user.links);
      await refresh();
    },
  });
  const commit = (next: LinkBlock[]) => {
    setBlocks(next);
    save.mutate(next);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    const a = next[i]!;
    next[i] = next[j]!;
    next[j] = a;
    commit(next);
  };
  const summary = (b: LinkBlock) => {
    if (b.type === 'carousel') return `${b.items.length} ${b.items.length === 1 ? 'card' : 'cards'}`;
    if (b.type === 'text') return b.text;
    if (b.type === 'header') return 'Header';
    return b.url || b.image;
  };
  const done = () => {
    if (!editing) return;
    const next = isNew ? [...blocks, editing] : blocks.map((b) => (b.id === editing.id ? editing : b));
    commit(next);
    setEditing(null);
  };
  const err = editing ? problem(editing) : '';

  return (
    <div>
      <div className="flex flex-wrap gap-xs" role="group" aria-label="Add a block">
        {LINK_BLOCK_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            disabled={blocks.length >= MAX_LINK_BLOCKS}
            onClick={() => {
              setEditing(blank(t));
              setIsNew(true);
            }}
            className="toy toy-soft inline-flex min-h-[44px] items-center gap-xs rounded-pill border-2 border-line bg-card px-sm text-[14px] font-bold disabled:opacity-50"
          >
            <span aria-hidden="true">{LINK_BLOCK_META[t].emoji}</span>
            {LINK_BLOCK_META[t].name}
          </button>
        ))}
      </div>
      <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">
        {blocks.length} of {MAX_LINK_BLOCKS} blocks. {save.isPending ? 'Saving.' : save.isError ? 'Could not save. Try again.' : save.isSuccess ? 'Saved.' : ''}
      </p>
      {blocks.length === 0 ? (
        <p className="mt-sm m-0 rounded-tile bg-paper p-sm text-[14px] font-semibold text-ink-soft">Nothing here yet. Add a link to your best thing first; people tap the top one most.</p>
      ) : (
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {blocks.map((b, i) => (
            <li key={b.id} className={`rounded-tile bg-card p-sm shadow-toy-soft ${b.on ? '' : 'opacity-60'}`}>
              <div className="flex items-center gap-sm">
                <span className="flex size-[40px] shrink-0 items-center justify-center rounded-pill bg-paper text-[20px]" aria-hidden="true">
                  {LINK_BLOCK_META[b.type].emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-bold">
                    {b.title || LINK_BLOCK_META[b.type].name}
                    {b.featured ? ' · featured' : ''}
                    {b.on ? '' : ' · hidden'}
                  </span>
                  <span className="block truncate text-[12px] font-bold text-ink-soft">{summary(b)}</span>
                </span>
                {(b.type === 'link' || b.type === 'image' || b.type === 'video' || b.type === 'carousel') && (
                  <span className="shrink-0 rounded-pill bg-paper px-sm text-[12px] font-extrabold leading-[28px] text-ink-soft">{clicks.data?.clicks[b.id] ?? 0} {(clicks.data?.clicks[b.id] ?? 0) === 1 ? 'tap' : 'taps'}</span>
                )}
              </div>
              <div className="mt-xs flex flex-wrap gap-xs">
                <Button variant="outline" size="sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${b.title || LINK_BLOCK_META[b.type].name} up`}>
                  Up
                </Button>
                <Button variant="outline" size="sm" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria-label={`Move ${b.title || LINK_BLOCK_META[b.type].name} down`}>
                  Down
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing({ ...b, items: b.items.map((it) => ({ ...it })) });
                    setIsNew(false);
                  }}
                >
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => commit(blocks.map((x) => (x.id === b.id ? { ...x, on: !x.on } : x)))}>
                  {b.on ? 'Hide' : 'Show'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => commit(blocks.filter((x) => x.id !== b.id))}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? `${isNew ? 'Add' : 'Edit'} ${LINK_BLOCK_META[editing.type].name.toLowerCase()}` : 'Block'}>
        {editing && (
          <form
            className="flex flex-col gap-sm"
            onSubmit={(e) => {
              e.preventDefault();
              if (!err) done();
            }}
          >
            <p className="m-0 text-[14px] font-semibold text-ink-soft">{LINK_BLOCK_META[editing.type].blurb}</p>
            {editing.type !== 'text' && (
              <label className="block">
                <span className="block text-[14px] font-bold">{editing.type === 'header' ? 'Header' : editing.type === 'link' ? 'Button text' : 'Title (optional)'}</span>
                <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} maxLength={120} className={field} />
              </label>
            )}
            {(editing.type === 'link' || editing.type === 'video' || editing.type === 'image') && (
              <label className="block">
                <span className="block text-[14px] font-bold">{editing.type === 'video' ? 'YouTube link' : editing.type === 'image' ? 'Link when tapped (optional)' : 'Link'}</span>
                <input value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} maxLength={500} placeholder="https://" inputMode="url" className={field} />
              </label>
            )}
            {editing.type === 'image' && (
              <label className="block">
                <span className="block text-[14px] font-bold">Picture address</span>
                <input value={editing.image} onChange={(e) => setEditing({ ...editing, image: e.target.value })} maxLength={500} placeholder="https://" inputMode="url" className={field} />
              </label>
            )}
            {editing.type === 'text' && (
              <label className="block">
                <span className="block text-[14px] font-bold">Text</span>
                <textarea value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} maxLength={600} rows={4} className={field} />
              </label>
            )}
            {editing.type === 'link' && (
              <label className="flex items-center gap-sm text-[14px] font-bold">
                <input type="checkbox" checked={editing.featured} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} className="size-[20px] accent-ink" />
                Featured: big and in colour
              </label>
            )}
            {editing.type === 'carousel' && (
              <fieldset className="m-0 border-0 p-0">
                <legend className="text-[14px] font-bold">Cards, up to {MAX_CAROUSEL_ITEMS}</legend>
                <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                  {editing.items.map((it, i) => {
                    const set = (patch: Partial<LinkBlockItem>) => setEditing({ ...editing, items: editing.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                    return (
                      <li key={it.id} className="rounded-tile bg-paper p-sm">
                        <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">Card {i + 1}</p>
                        <input value={it.title} onChange={(e) => set({ title: e.target.value })} maxLength={80} placeholder="Title" className={field} />
                        <input value={it.image} onChange={(e) => set({ image: e.target.value })} maxLength={500} placeholder="Picture https://" inputMode="url" className={field} />
                        <input value={it.url} onChange={(e) => set({ url: e.target.value })} maxLength={500} placeholder="Link https:// (optional)" inputMode="url" className={field} />
                        <Button variant="ghost" size="sm" className="mt-xs" onClick={() => setEditing({ ...editing, items: editing.items.filter((_, j) => j !== i) })}>
                          Remove card
                        </Button>
                      </li>
                    );
                  })}
                </ul>
                <Button variant="outline" size="sm" className="mt-xs" disabled={editing.items.length >= MAX_CAROUSEL_ITEMS} onClick={() => setEditing({ ...editing, items: [...editing.items, { id: newId(), title: '', url: '', image: '' }] })}>
                  Add a card
                </Button>
              </fieldset>
            )}
            {err && <p className="m-0 text-[14px] font-bold text-ink-soft">{err}</p>}
            <div className="flex gap-xs">
              <Button type="submit" size="lg" className="flex-1" disabled={Boolean(err)}>
                {isNew ? 'Add to my page' : 'Save'}
              </Button>
              <Button variant="outline" size="lg" onClick={() => setEditing(null)}>
                Not now
              </Button>
            </div>
          </form>
        )}
      </Sheet>
    </div>
  );
}
