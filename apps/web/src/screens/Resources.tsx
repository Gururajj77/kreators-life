import { knowledgeKindIcon, RELATIONSHIP_BY_KEY, RELATIONSHIPS, type Resource } from '@kreators/shared';
import { AppIcon } from '../components/AppIcon';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Button } from '../components/Button';
import { BackLink } from '../components/PageHeader';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { api } from '../lib/api';
import { useAuthed, useMe, useRefreshAll, useResources } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { useParamState } from '../lib/useParamState';
import { FIELD } from '../lib/ui';
import { RowCard } from '../components/RowCard';
import { Reveal } from '../components/fx/Reveal';
import { StatusTag } from '../components/StatusTag';
import { IconTag } from '../components/FactTag';
import { tie } from '../lib/text';


/** A resource's tags are free text; a pillar key among them (parent_child, guru, self...) reads as that pillar's name, and
 * anything else reads as plain words instead of a raw snake_case key. */
function tagLabel(t: string): string {
  return RELATIONSHIP_BY_KEY[t as keyof typeof RELATIONSHIP_BY_KEY]?.name ?? t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Resources() {
  const { id } = useParams();
  if (id) return <Detail id={id} />;
  return <List />;
}

function List() {
  const me = useMe();
  const [tag, setTag] = useParamState('tag', '');
  const pg = usePage();
  const q = useResources(tag || undefined, pg.query);
  const refresh = useRefreshAll();
  const canAuthor = me.data && me.data.user.role !== 'user';
  const [editing, setEditing] = useState<Resource | 'new' | null>(null);
  const isPillar = (t: string) => RELATIONSHIPS.some((r) => r.key === t);
  const otherTags = Array.from(new Set([...(q.data?.resources ?? []).flatMap((r) => r.tags), ...(tag ? [tag] : [])])).filter((t) => !isPillar(t)).sort();

  return (
    <Screen>
      <AppCover
        back={{ to: '/apps', label: 'Apps' }}
        title="Knowledge"
        lede="Short reads and exercises from the guides. Each one takes a few minutes."
        actions={
          canAuthor ? (
            <Button variant="outline" onClick={() => setEditing('new')}>
              Write a resource
            </Button>
          ) : undefined
        }
      />
      {/* One quiet select instead of a wall of pills: the seven pillars by name, then any other topic the reads carry. The choice lives in the URL. */}
      <label className="mt-md flex flex-wrap items-center gap-xs text-subhead font-semibold">
        <span>Show</span>
        <select value={tag} onChange={(e) => setTag(e.target.value)} className="min-h-[44px] min-w-0 rounded-pill border-2 border-line bg-card-strong px-sm text-subhead font-medium text-ink">
          <option value="">Everything</option>
          <optgroup label="Pillars">
            {RELATIONSHIPS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </optgroup>
          {otherTags.length > 0 && (
            <optgroup label="Other topics">
              {otherTags.map((t) => (
                <option key={t} value={t}>
                  {tagLabel(t)}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      {/* Placed like Home's Knowledge cards (2026-11-05): the title at the top left, the kind's icon on a neutral tile at the top right,
          the summary under the title, the topic and the kind as tags at the foot and an arrow at the bottom right. Two to a row from the
          tablet width, one on a phone; the cards of a row are one height and rise in one after another once. */}
      <ul className="mt-md grid list-none grid-cols-1 gap-xs p-0 m-0 md:grid-cols-2">
        {q.data?.resources.map((r, i) => {
          const kindName = r.kind === 'exercise' ? 'Exercise' : r.kind === 'video' ? 'Video' : 'Article';
          return (
            <Reveal as="li" key={r.id} index={i} className="flex">
              <RowCard
                to={`/knowledge/${r.id}`}
                title={tie(r.title)}
                corner={
                  <span className="flex size-[44px] items-center justify-center rounded-inner bg-paper text-ink-soft" aria-hidden="true">
                    <AppIcon name={knowledgeKindIcon(r.kind)} size={22} />
                  </span>
                }
                facts={[
                  ...r.tags.slice(0, 2).map((t) => (
                    <StatusTag key={t} tone="calm" fit>
                      {tagLabel(t)}
                    </StatusTag>
                  )),
                  <IconTag key="kind" tone="neutral" icon={knowledgeKindIcon(r.kind)} fit>
                    {kindName}
                  </IconTag>,
                  !r.published ? <StatusTag key="draft" tone="neutral">Draft</StatusTag> : null,
                ]}
              >
                <span className="mt-xs block text-card-note text-ink-soft">{r.summary}</span>
              </RowCard>
            </Reveal>
          );
        })}
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
      {r ? (
        <AppCover back={{ to: '/knowledge', label: 'Knowledge' }} title={r.title} lede={`${r.kind === 'exercise' ? 'Exercise' : r.kind === 'video' ? 'Video' : 'Article'} by ${r.authorName}`} />
      ) : q.isError ? (
        <AppCover back={{ to: '/knowledge', label: 'Knowledge' }} title="Not here" lede="That resource is not here." />
      ) : (
        <header className="pt-lg">
          <BackLink to="/knowledge">Knowledge</BackLink>
        </header>
      )}
      {r && (
        <article data-reading className="mt-md rounded-card bg-card p-md shadow-toy-soft">
          <p className="m-0 text-headline">{r.summary}</p>
          {r.body.split(/\n{2,}/).map((p, i) => (
            <p key={i} className="prose-long mt-md m-0 text-prose">
              {p}
            </p>
          ))}
          {r.url && (
            <a href={r.url} target="_blank" rel="noreferrer" className="toy mt-md inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-semibold text-on-ink">
              Open {r.kind === 'video' ? 'video' : 'link'}
            </a>
          )}
          {r.tags.length > 0 && <p className="mt-md m-0 text-subhead text-ink-soft">{r.tags.join(', ')}</p>}
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
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    setAsking(false);
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
      setAsking(false);
      onSaved();
      onClose();
    },
  });
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
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`min-h-[44px] rounded-pill border-2 text-subhead font-medium ${kind === k ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
              <span className="inline-flex items-center justify-center gap-xs">
                <AppIcon name={knowledgeKindIcon(k)} size={16} />
                {k}
              </span>
            </button>
          ))}
        </div>
        <label className="block">
          <span className="block text-subhead font-semibold">Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">One-line summary</span>
          <input value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300} className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Body</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Link or video URL</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} className={FIELD} placeholder="Optional" />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Tags, comma separated</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} className={FIELD} placeholder="stress, sleep" />
        </label>
        <label className="flex items-center gap-sm text-subhead font-semibold">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="size-[20px] accent-ink" />
          Published
        </label>
        {save.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
            {save.error instanceof Error ? save.error.message : 'Could not save.'}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={save.isPending || !title.trim()}>
          {existing ? 'Save changes' : 'Publish'}
        </Button>
        {existing && (
          <Button
            variant="ghost"
            disabled={remove.isPending}
            onClick={() => {
              remove.reset();
              setAsking(true);
            }}
          >
            Delete
          </Button>
        )}
      </form>
      {existing && (
        <ConfirmDelete
          open={asking}
          title="Delete this resource?"
          body={`“${existing.title}” goes from Knowledge for everyone. This cannot be undone.`}
          pending={remove.isPending}
          failed={remove.isError}
          onYes={() => remove.mutate()}
          onClose={() => setAsking(false)}
        />
      )}
    </Sheet>
  );
}
