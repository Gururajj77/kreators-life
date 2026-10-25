import { TOOL_CATEGORIES, type Tool } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../components/Button';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';

function Err({ e }: { e: unknown }) {
  if (!e) return null;
  return (
    <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
      {e instanceof Error ? e.message : 'That did not work.'}
    </p>
  );
}

function ToolRow({ t, reviewer, onChange }: { t: Tool; reviewer: boolean; onChange: () => void }) {
  const set = useMutation({ mutationFn: (body: { verified?: boolean; affiliate?: boolean }) => api.setTool(t.id, body), onSuccess: onChange });
  const remove = useMutation({ mutationFn: () => api.removeTool(t.id), onSuccess: onChange });
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="flex items-start gap-sm">
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold">{t.name}</span>
          {t.description && <span className="block text-[14px] font-semibold text-ink-soft">{t.description}</span>}
          <span className="block text-[12px] font-bold text-ink-mute">
            {t.verified ? 'Verified by the team' : `Suggested by ${t.suggestedByName}, waiting for review`}
            {t.affiliate ? '. Partner link: Kreators may earn a share.' : ''}
          </span>
        </span>
        <a href={t.url} target="_blank" rel="noreferrer" className="toy toy-ink inline-flex min-h-[44px] shrink-0 items-center rounded-pill border-2 border-ink bg-card px-sm text-[14px] font-bold">
          Open
        </a>
      </div>
      {reviewer && (
        <div className="mt-sm flex flex-wrap gap-xs">
          {!t.verified && (
            <Button onClick={() => set.mutate({ verified: true })} disabled={set.isPending}>
              Verify
            </Button>
          )}
          <Button variant="outline" onClick={() => set.mutate({ affiliate: !t.affiliate })} disabled={set.isPending}>
            {t.affiliate ? 'Not a partner link' : 'Mark as partner link'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm(`Remove ${t.name} from the directory?`)) remove.mutate();
            }}
            disabled={remove.isPending}
          >
            Remove
          </Button>
          <Err e={set.isError ? set.error : remove.isError ? remove.error : null} />
        </div>
      )}
    </li>
  );
}

export function Tools() {
  const q = useAuthed(['tools'], api.tools);
  const [suggesting, setSuggesting] = useState(false);
  const d = q.data;
  const verified = (d?.tools ?? []).filter((t) => t.verified);
  const pending = (d?.tools ?? []).filter((t) => !t.verified);
  const categories = d?.categories ?? TOOL_CATEGORIES;

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">Tools</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Tools for making and selling, checked by the team. Suggest one you swear by.</p>
        <Button className="mt-md" onClick={() => setSuggesting(true)}>
          Suggest a tool
        </Button>
      </header>

      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft" role="alert">
          <p className="m-0 font-bold">Could not load the directory.</p>
          <Button variant="outline" className="mt-sm" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {d && verified.length === 0 && <p className="mt-lg m-0 text-[14px] font-semibold text-ink-soft">The shelf is empty. Suggest the first tool.</p>}

      {categories.map((cat) => {
        const list = verified.filter((t) => t.category === cat);
        if (list.length === 0) return null;
        return (
          <section key={cat} className="mt-lg" aria-labelledby={`cat-${cat}`}>
            <h2 id={`cat-${cat}`} className="text-[24px]">
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

      {pending.length > 0 && (
        <section className="mt-lg" aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="text-[24px]">
            {d?.reviewer ? 'Suggestions to review' : 'Your suggestions'}
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {pending.map((t) => (
              <ToolRow key={t.id} t={t} reviewer={d?.reviewer ?? false} onChange={() => q.refetch()} />
            ))}
          </ul>
        </section>
      )}

      <SuggestSheet open={suggesting} onClose={() => setSuggesting(false)} onDone={() => q.refetch()} categories={categories} />
    </Screen>
  );
}

function SuggestSheet({ open, onClose, onDone, categories }: { open: boolean; onClose: () => void; onDone: () => void; categories: readonly string[] }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<string>(categories[0] ?? 'Editing');
  const [description, setDescription] = useState('');
  const suggest = useMutation({
    mutationFn: () => api.suggestTool({ name, url, category, description }),
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
          <span className="block text-[14px] font-bold">Name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Link</span>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} required placeholder="https://" className={field} />
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Category</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {categories.map((c) => (
              <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={`toy rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${category === c ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                {c}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="block text-[14px] font-bold">What it is good for</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} className={field} />
        </label>
        <p className="m-0 text-[12px] font-bold text-ink-soft">A reviewer checks it before it shows to everyone. You see it straight away.</p>
        <Err e={suggest.isError ? suggest.error : null} />
        <Button type="submit" size="lg" full disabled={suggest.isPending || !name.trim() || !url.trim()}>
          Send suggestion
        </Button>
      </form>
    </Sheet>
  );
}
