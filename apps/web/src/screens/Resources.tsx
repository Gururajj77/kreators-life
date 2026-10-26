import type { Resource } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../components/Button';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useAuthed, useMe, useRefreshAll, useResources } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';

const KIND_EMOJI = { article: '📖', exercise: '🧩', video: '🎬' } as const;

export function Resources() {
  const { id } = useParams();
  if (id) return <Detail id={id} />;
  return <List />;
}

function List() {
  const me = useMe();
  const [tag, setTag] = useState('');
  const pg = usePage();
  const q = useResources(tag || undefined, pg.query);
  const refresh = useRefreshAll();
  const canAuthor = me.data && me.data.user.role !== 'user';
  const [editing, setEditing] = useState<Resource | 'new' | null>(null);
  const tags = Array.from(new Set((q.data?.resources ?? []).flatMap((r) => r.tags))).sort();

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">Knowledge</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Short reads and exercises from the guides. Each one takes a few minutes.</p>
        {canAuthor && (
          <Button variant="outline" className="mt-sm" onClick={() => setEditing('new')}>
            Write a resource
          </Button>
        )}
      </header>
      {tags.length > 0 && (
        <div className="mt-md flex flex-wrap gap-xs" role="group" aria-label="Filter by tag">
          <button type="button" aria-pressed={tag === ''} onClick={() => setTag('')} className={`rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${tag === '' ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
            All
          </button>
          {tags.map((t) => (
            <button key={t} type="button" aria-pressed={tag === t} onClick={() => setTag(t)} className={`rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${tag === t ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
              {t}
            </button>
          ))}
        </div>
      )}
      <ul className="mt-md flex list-none flex-col gap-xs p-0 m-0">
        {q.data?.resources.map((r) => (
          <li key={r.id}>
            <Link to={`/knowledge/${r.id}`} className="toy toy-soft flex items-start gap-sm rounded-tile bg-card p-sm">
              <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-r4 text-[20px]" aria-hidden="true">
                {KIND_EMOJI[r.kind]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold leading-snug">{r.title}</span>
                <span className="block text-[14px] font-semibold text-ink-soft">{r.summary}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Pager page={q.data?.page} label="guides" />
      {canAuthor && <ResourceSheet resource={editing} onClose={() => setEditing(null)} onSaved={refresh} />}
    </Screen>
  );
}

function Detail({ id }: { id: string }) {
  const me = useMe();
  const q = useAuthed(['resource', id], () => api.resource(id));
  const refresh = useRefreshAll();
  const [editing, setEditing] = useState<Resource | null>(null);
  const r = q.data?.resource;
  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/knowledge">Knowledge</BackLink>
        {r && (
          <>
            <p className="m-0 text-[14px] font-bold text-ink-soft">
              {r.kind === 'exercise' ? 'Exercise' : r.kind === 'video' ? 'Video' : 'Article'} by {r.authorName}
            </p>
            <h1 className="text-[30px]">{r.title}</h1>
          </>
        )}
      </header>
      {q.isError && <p className="mt-md font-bold">That resource is not here.</p>}
      {r && (
        <article className="mt-md rounded-card bg-card p-md shadow-toy-soft">
          <p className="m-0 text-[18px] font-bold">{r.summary}</p>
          {r.body.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="mt-md m-0 text-[16px] font-semibold leading-relaxed">
              {p}
            </p>
          ))}
          {r.url && (
            <a href={r.url} target="_blank" rel="noreferrer" className="toy mt-md inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-on-ink">
              Open {r.kind === 'video' ? 'video' : 'link'}
            </a>
          )}
          {r.tags.length > 0 && <p className="mt-md m-0 text-[14px] font-bold text-ink-soft">{r.tags.join(', ')}</p>}
          {me.data && me.data.user.role !== 'user' && (
            <Button variant="ghost" className="mt-md" onClick={() => setEditing(r)}>
              Edit
            </Button>
          )}
        </article>
      )}
      {me.data && me.data.user.role !== 'user' && <ResourceSheet resource={editing} onClose={() => setEditing(null)} onSaved={refresh} />}
    </Screen>
  );
}

function ResourceSheet({ resource, onClose, onSaved }: { resource: Resource | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const existing = resource && resource !== 'new' ? resource : null;
  const [kind, setKind] = useState<Resource['kind']>('article');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');
  const [published, setPublished] = useState(true);
  useEffect(() => {
    setKind(existing?.kind ?? 'article');
    setTitle(existing?.title ?? '');
    setSummary(existing?.summary ?? '');
    setBody(existing?.body ?? '');
    setUrl(existing?.url ?? '');
    setTags(existing?.tags.join(', ') ?? '');
    setPublished(existing?.published ?? true);
  }, [resource]); // eslint-disable-line react-hooks/exhaustive-deps
  const payload = () => ({ kind, title, summary, body, url: url || null, tags: tags.split(',').map((t) => t.trim()).filter(Boolean), published });
  const save = useMutation({
    mutationFn: () => (existing ? api.updateResource(existing.id, payload()) : api.createResource(payload())),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteResource(existing!.id),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
  return (
    <Sheet open={resource !== null} onClose={onClose} title={existing ? 'Edit resource' : 'New resource'}>
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) save.mutate();
        }}
      >
        <div className="grid grid-cols-3 gap-xs" role="group" aria-label="Kind">
          {(['article', 'exercise', 'video'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`min-h-[44px] rounded-pill border-2 text-[14px] font-bold ${kind === k ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
              {KIND_EMOJI[k]} {k}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="block text-[14px] font-bold">Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">One-line summary</span>
          <input value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300} className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Body</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Link or video URL</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} className={field} placeholder="Optional" />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Tags, comma separated</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} className={field} placeholder="stress, sleep" />
        </label>
        <label className="flex items-center gap-sm text-[14px] font-bold">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="size-[20px] accent-ink" />
          Published
        </label>
        {save.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {save.error instanceof Error ? save.error.message : 'Could not save.'}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={save.isPending || !title.trim()}>
          {existing ? 'Save changes' : 'Publish'}
        </Button>
        {existing && (
          <Button variant="ghost" disabled={remove.isPending} onClick={() => window.confirm('Delete this resource?') && remove.mutate()}>
            Delete
          </Button>
        )}
      </form>
    </Sheet>
  );
}
