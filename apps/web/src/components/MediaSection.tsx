import { MAX_MEDIA_CAPTION, mediaFromLink, type MediaItem, type MediaOwner } from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { shrinkImage } from '../lib/shrink';
import { useSession } from '../lib/store';
import { Button } from './Button';
import { MediaGallery } from './Media';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { ArrowDown, ArrowUp, ImagePlus, Play } from 'lucide-react';
import type { MoreMenuItem } from './MoreMenu';
import { FIELD } from '../lib/ui';

interface Draft {
  url: string;
  caption: string;
}

const kindOf = (url: string) => mediaFromLink(url)?.kind ?? 'image';

/** The saved set for one owner, shared by the section and any screen that puts its editor in a More menu (same query key). */
export function useMedia(type: MediaOwner, id: string) {
  const token = useSession((s) => s.token);
  return useQuery({ queryKey: ['media', type, id], queryFn: () => api.mediaFor(type, id), enabled: Boolean(token && id) });
}

/** The More menu row that opens the editor, for a screen that draws `MediaSection` with `trigger={null}`; null when this person may not edit. */
export function useMediaMenuItem(type: MediaOwner, id: string, onSelect: () => void): MoreMenuItem | null {
  const q = useMedia(type, id);
  if (!q.data?.canEdit) return null;
  return { key: 'media', label: q.data.items.length > 0 ? 'Edit pictures and videos' : 'Add pictures and videos', icon: ImagePlus, onSelect };
}

/**
 * Pictures, GIFs and videos for one listing, lesson or event page. Everyone sees the gallery; the person who made the
 * thing (or staff for it) gets "Edit pictures and videos", where they upload a picture or GIF, paste a link, or link a
 * video from YouTube, Vimeo or a direct .mp4. The server decides who may save.
 *
 * Like `MoreMenu`, `trigger={null}` draws no button of its own and `open` with `onOpenChange` makes the editor controlled,
 * so a screen can put "Add pictures and videos" in its More menu (`useMediaMenuItem`) and keep one solid button.
 */
export function MediaSection({
  type,
  id,
  title = 'Pictures and videos',
  trigger,
  open: openProp,
  onOpenChange,
}: {
  type: MediaOwner;
  id: string;
  title?: string;
  trigger?: null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const q = useMedia(type, id);
  const [own, setOwn] = useState(false);
  const open = openProp ?? own;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setOwn(v));
  const [draft, setDraft] = useState<Draft[]>([]);
  const [link, setLink] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const items: MediaItem[] = q.data?.items ?? [];
  const max = q.data?.max ?? 8;
  useEffect(() => {
    if (open) setDraft(items.map((m) => ({ url: m.url, caption: m.caption })));
    // The draft starts from what is saved each time the editor opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = useMutation({
    mutationFn: () => api.setMedia(type, id, draft),
    onSuccess: () => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ['media', type, id] });
      void qc.invalidateQueries({ queryKey: ['explore'] });
    },
  });
  const upload = useMutation({
    mutationFn: async (file: File) => api.uploadMedia(await shrinkImage(file)),
    onSuccess: (r) => {
      setNote(null);
      setDraft((d) => [...d, { url: r.url, caption: '' }]);
    },
    onError: (e) => setNote(e instanceof Error ? e.message : 'That upload did not work.'),
  });
  const add = () => {
    const m = mediaFromLink(link);
    if (!m) return setNote('A link starts with https. A video can be YouTube, Vimeo or a direct .mp4 link.');
    if (draft.length >= max) return setNote(`At most ${max}.`);
    setNote(null);
    setDraft((d) => [...d, { url: m.url, caption: '' }]);
    setLink('');
  };
  const move = (i: number, by: -1 | 1) =>
    setDraft((d) => {
      const next = [...d];
      const j = i + by;
      if (j < 0 || j >= next.length) return d;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  if (!q.data || (items.length === 0 && !q.data.canEdit)) return null;
  return (
    // With no pictures and the editor's button in a More menu, only the sheet is drawn, so no empty gap is left.
    <section className={items.length > 0 || trigger !== null ? 'mt-md' : ''} aria-label={title}>
      {items.length > 0 && <MediaGallery items={items} />}
      {q.data.canEdit && trigger !== null && (
        <div className={items.length > 0 ? 'mt-sm' : ''}>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {items.length > 0 ? 'Edit pictures and videos' : 'Add pictures and videos'}
          </Button>
        </div>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <div className="flex flex-col gap-md pb-xl">
          <p className="m-0 text-subhead text-ink-soft">
            Up to {max}. Upload a picture or GIF (under 1 MB; pictures are shrunk for you), paste a link to one, or paste a video link from YouTube, Vimeo or a direct .mp4. The first one is the cover.
          </p>
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {draft.map((d, i) => (
              <li key={`${d.url}-${i}`} className="rounded-tile bg-paper p-sm">
                <div className="flex items-center gap-sm">
                  {kindOf(d.url) === 'video' ? (
                    <span className="flex size-[56px] shrink-0 items-center justify-center rounded-tile bg-card" aria-hidden="true"><Icon icon={Play} size={22} filled /></span>
                  ) : (
                    <img src={d.url} alt={d.caption || `${kindOf(d.url) === 'gif' ? 'GIF' : 'Picture'} ${i + 1}${i === 0 ? ', the cover' : ''}`} width={56} height={56} loading="lazy" decoding="async" className="size-[56px] shrink-0 rounded-tile bg-card object-cover" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-caption text-ink-soft">{kindOf(d.url) === 'video' ? 'Video' : kindOf(d.url) === 'gif' ? 'GIF' : 'Picture'}{i === 0 ? ' · cover' : ''}</span>
                  <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><Icon icon={ArrowUp} size={16} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === draft.length - 1} aria-label="Move down"><Icon icon={ArrowDown} size={16} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setDraft((x) => x.filter((_, k) => k !== i))}>Remove</Button>
                </div>
                <input value={d.caption} maxLength={MAX_MEDIA_CAPTION} onChange={(e) => setDraft((x) => x.map((y, k) => (k === i ? { ...y, caption: e.target.value } : y)))} placeholder="Caption (optional)" aria-label={`Caption ${i + 1}`} className={FIELD} />
              </li>
            ))}
          </ul>
          <label className="block">
            <span className="block text-subhead font-semibold">Upload a picture or GIF</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" disabled={upload.isPending || draft.length >= max} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }} className={FIELD} />
          </label>
          <div>
            <label className="block">
              <span className="block text-subhead font-semibold">Or paste a link</span>
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://… picture, GIF or video" inputMode="url" autoCapitalize="none" className={FIELD} />
            </label>
            <Button variant="outline" size="sm" className="mt-xs" onClick={add} disabled={!link.trim()}>Add the link</Button>
          </div>
          {(note || save.isError) && (
            <p role="alert" className="m-0 text-subhead">
              {note ?? (save.error instanceof Error ? save.error.message : 'That did not save.')}
            </p>
          )}
          {upload.isPending && <p className="m-0 text-subhead text-ink-soft" role="status">Uploading</p>}
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </div>
      </Sheet>
    </section>
  );
}
