import { PUBLIC_BADGES, formatCount, isFeatured, TOOL_CATEGORIES, unlockAt, type Tool } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../components/Button';
import { LockedButton } from '../components/LockedButton';
import { MediaSection, useMediaMenuItem } from '../components/MediaSection';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { FeaturedTag } from './Store';
import { useAuthed } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { FIELD, RED_YES } from '../lib/ui';
import { ErrorLine } from '../components/ErrorLine';
import { MoreMenu } from '../components/MoreMenu';
import { SkeletonList } from '../components/Skeleton';
import { FactTag, IconTag } from '../components/FactTag';
import { StatusTag } from '../components/StatusTag';
import '../components/fx/spotlight';

function ToolRow({ t, reviewer, onChange }: { t: Tool; reviewer: boolean; onChange: () => void }) {
  const set = useMutation({ mutationFn: (body: { verified?: boolean; affiliate?: boolean; featured?: boolean }) => api.setTool(t.id, body), onSuccess: onChange });
  const remove = useMutation({ mutationFn: () => api.removeTool(t.id), onSuccess: onChange });
  const featured = isFeatured(t.featuredUntil);
  // Remove asks first in a sheet of its own, red, never window.confirm.
  const [removing, setRemoving] = useState(false);
  // Pictures and videos are edited from the More menu, never a button on the card, so the page keeps one solid button.
  const [editingMedia, setEditingMedia] = useState(false);
  const mediaItem = useMediaMenuItem('tool', t.id, () => setEditingMedia(true));
  return (
    // The name at the top left with the More beside it, the words under it, then at the foot the marks (Verified or Waiting first) on
    // the left and Open or Get it at the bottom right (2026-11-05 card rules, with the 2026-11-06 card head).
    <li className={`fx-spot flex h-full flex-col rounded-tile bg-card p-sm ${featured ? 'border-2 border-r3 shadow-toy' : 'border-2 border-transparent shadow-toy-soft'}`}>
      {/* The name and the "…" on one row, centred on each other; Verified or Waiting for review is a tag with the others at the foot
          (the founder, 2026-11-06, School's program card). */}
      <div className="flex items-center justify-between gap-xs">
        <p className="m-0 min-w-0 flex-1 text-balance text-card-title">{t.name}</p>
        {(reviewer || mediaItem) && (
          <MoreMenu
            label={`Review actions for ${t.name}`}
            title={t.name}
            items={[
              ...(mediaItem ? [mediaItem] : []),
              ...(reviewer
                ? [
                    ...(!t.verified ? [{ key: 'verify', label: 'Verify', disabled: set.isPending, onSelect: () => set.mutate({ verified: true }) }] : []),
                    { key: 'affiliate', label: t.affiliate ? 'Not a partner link' : 'Mark as partner link', disabled: set.isPending, onSelect: () => set.mutate({ affiliate: !t.affiliate }) },
                    { key: 'feature', label: featured ? 'Take off the top' : 'Feature for a week', disabled: set.isPending, onSelect: () => set.mutate({ featured: !featured }) },
                    { key: 'remove', label: 'Remove', destructive: true, disabled: remove.isPending, onSelect: () => setRemoving(true) },
                  ]
                : []),
            ]}
          />
        )}
      </div>
      {t.description && <span className="mt-xs block text-card-note text-ink-soft">{t.description}</span>}
      {!t.unlock.ok && (
        <div className="mt-sm">
          <LockedButton unlock={t.unlock} />
        </div>
      )}
      <div className="mt-auto flex items-end justify-between gap-sm pt-sm">
        <span className="flex min-w-0 flex-col items-start gap-xs">
          <span className="fill-row-all flex min-w-0 flex-wrap gap-xs">
            {t.verified ? <FactTag kind="verified">Verified</FactTag> : <StatusTag tone="warn">Waiting for review</StatusTag>}
            {featured && <FeaturedTag />}
            {t.clicks > 0 && <IconTag tone="neutral" icon="TrendingUp">{`${formatCount(t.clicks)} ${t.clicks === 1 ? 'tap' : 'taps'}`}</IconTag>}
          </span>
          {(!t.verified || t.affiliate || (t.unlock.ok && (t.minPoints > 0 || t.minXp > 0 || t.badge))) && (
            <span className="block text-caption text-ink-mute">
              {[!t.verified ? `Suggested by ${t.suggestedByName}.` : '', t.affiliate ? 'Partner link. Kreators may earn a share.' : '', t.unlock.ok && (t.minPoints > 0 || t.minXp > 0 || t.badge) ? `${unlockAt(t.unlock)}. You have it.` : ''].filter(Boolean).join(' ')}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-xs">
          {!t.unlock.ok ? null : t.affiliate && t.verified ? (
            // The same outline look as Open, so the page keeps one solid button, Suggest a tool.
            <a href={`/out/tool/${t.id}`} target="_blank" rel="noreferrer" className="toy toy-ink inline-flex min-h-[44px] items-center rounded-pill border-2 border-ink bg-card px-sm text-subhead font-semibold">
              Get it
            </a>
          ) : (
            <a href={t.url} target="_blank" rel="noreferrer" className="toy toy-ink inline-flex min-h-[44px] items-center rounded-pill border-2 border-ink bg-card px-sm text-subhead font-semibold">
              Open
            </a>
          )}
        </span>
      </div>
      <MediaSection type="tool" id={t.id} title="Pictures and videos" trigger={null} open={editingMedia} onOpenChange={setEditingMedia} />
      {reviewer && <ErrorLine e={set.isError ? set.error : null} />}
      {reviewer && (
        <Sheet open={removing} onClose={() => setRemoving(false)} title="Remove this tool?">
          <div className="grid gap-md pb-xl">
            <p className="m-0 text-callout text-ink-soft">{t.name} leaves the directory for everyone.</p>
            <ErrorLine e={remove.isError ? remove.error : null} />
            <div className="flex flex-wrap gap-xs">
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => remove.mutate(undefined, { onSuccess: () => setRemoving(false) })}
                className={RED_YES}
              >
                Yes, remove it
              </button>
              <Button variant="outline" onClick={() => setRemoving(false)}>
                Keep it
              </Button>
            </div>
          </div>
        </Sheet>
      )}
    </li>
  );
}

export function Tools() {
  const pg = usePage();
  const q = useAuthed(['tools', pg.query], () => api.tools(pg.query));
  const [suggesting, setSuggesting] = useState(false);
  const d = q.data;
  const verified = (d?.tools ?? []).filter((t) => t.verified);
  const pending = (d?.tools ?? []).filter((t) => !t.verified);
  const categories = d?.categories ?? TOOL_CATEGORIES;

  return (
    <Screen>
      <AppCover
        back={{ to: '/apps', label: 'Apps' }}
        title="Tools"
        lede="Tools for making and selling, checked by the team. Suggest one you swear by."
        actions={<Button onClick={() => setSuggesting(true)}>Suggest a tool</Button>}
      />

      {q.isError && (
        <div className="mt-md flex flex-wrap-reverse items-center justify-between gap-sm rounded-card bg-card p-md shadow-toy-soft" role="alert">
          <p className="m-0 min-w-0 flex-1 basis-[60%] font-semibold">Could not load the directory.</p>
          <Button variant="outline" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {q.isPending && <SkeletonList className="mt-lg" count={3} lines={2} label="Loading the tools" />}

      {d && verified.length === 0 && <p className="mt-lg m-0 text-subhead text-ink-soft">The shelf is empty. Suggest the first tool.</p>}

      {verified.some((t) => isFeatured(t.featuredUntil)) && (
        <section className="mt-lg" aria-labelledby="featured-tools">
          <h2 id="featured-tools" className="text-title2">
            Featured this week
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {verified.filter((t) => isFeatured(t.featuredUntil)).map((t) => (
              <ToolRow key={t.id} t={t} reviewer={d?.reviewer ?? false} onChange={() => q.refetch()} />
            ))}
          </ul>
        </section>
      )}

      {categories.map((cat) => {
        const list = verified.filter((t) => t.category === cat);
        if (list.length === 0) return null;
        return (
          <section key={cat} className="mt-lg" aria-labelledby={`cat-${cat}`}>
            <h2 id={`cat-${cat}`} className="text-title2">
              {cat}
            </h2>
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {list.map((t) => (
                <ToolRow key={t.id} t={t} reviewer={d?.reviewer ?? false} onChange={() => q.refetch()} />
              ))}
            </ul>
          </section>
        );
      })}
      <Pager page={d?.page} label="tools" />

      {pending.length > 0 && (
        <section className="mt-lg" aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="text-title2">
            {d?.reviewer ? 'Suggestions to review' : 'Your suggestions'}
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {pending.map((t) => (
              <ToolRow key={t.id} t={t} reviewer={d?.reviewer ?? false} onChange={() => q.refetch()} />
            ))}
          </ul>
        </section>
      )}

      <SuggestSheet open={suggesting} onClose={() => setSuggesting(false)} onDone={() => q.refetch()} categories={categories} reviewer={d?.reviewer ?? false} />
    </Screen>
  );
}

function SuggestSheet({ open, onClose, onDone, categories, reviewer }: { open: boolean; onClose: () => void; onDone: () => void; categories: readonly string[]; reviewer: boolean }) {
  const [minPoints, setMinPoints] = useState('0');
  const [minXp, setMinXp] = useState('0');
  const [badge, setBadge] = useState('');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<string>(categories[0] ?? 'Editing');
  const [description, setDescription] = useState('');
  const suggest = useMutation({
    mutationFn: () => api.suggestTool({ name, url, category, description, ...(reviewer ? { minPoints: Number(minPoints) || 0, minXp: Number(minXp) || 0, badge } : {}) }),
    onSuccess: () => {
      setName('');
      setUrl('');
      setDescription('');
      onDone();
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Suggest a tool">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          suggest.mutate();
        }}
      >
        <label className="block">
          <span className="block text-subhead font-semibold">Name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Link</span>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} required placeholder="https://" className={FIELD} />
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-subhead font-semibold">Category</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {categories.map((c) => (
              <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={`toy min-h-[44px] rounded-pill border-2 px-sm py-xs text-subhead font-medium ${category === c ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                {c}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="block text-subhead font-semibold">What it is good for</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} className={FIELD} />
        </label>
        {reviewer && (
          <div className="grid grid-cols-2 gap-xs">
            <label className="block">
              <span className="block text-subhead font-semibold">Xp of at least</span>
              <input type="number" min={0} value={minXp} onChange={(e) => setMinXp(e.target.value)} className={FIELD} />
            </label>
            <label className="block">
              <span className="block text-subhead font-semibold">Points of at least</span>
              <input type="number" min={0} value={minPoints} onChange={(e) => setMinPoints(e.target.value)} className={FIELD} />
            </label>
            {/* The third field takes the whole second row, so the row is filled (the form rules, 2026-11-06). */}
            <label className="col-span-2 block">
              <span className="block text-subhead font-semibold">Holds the badge</span>
              <select value={badge} onChange={(e) => setBadge(e.target.value)} className={FIELD}>
                <option value="">Any badge or none</option>
                {PUBLIC_BADGES.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <p className="m-0 text-caption text-ink-soft">A reviewer checks it before it shows to everyone. You see it straight away.</p>
        <ErrorLine e={suggest.isError ? suggest.error : null} />
        <Button type="submit" size="lg" full disabled={suggest.isPending || !name.trim() || !url.trim()}>
          Send suggestion
        </Button>
      </form>
    </Sheet>
  );
}
