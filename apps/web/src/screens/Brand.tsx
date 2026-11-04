import { BRAND_SOURCE_META, strategyPath, PIECE_KINDS, PIECE_META, RESEARCH_KINDS, RESEARCH_META, type BrandPiece, type BrandSource, type PieceKind, type ResearchItem, type ResearchKind, type ResearchRun, formatCount } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';
import { Markdown } from '../components/Markdown';
import { AppCover } from '../components/AppCover';
import { Pager, usePage } from '../components/Pager';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api, errorText } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { useParamState } from '../lib/useParamState';
import { ToolsLine } from './Content';
import { AppIcon } from '../components/AppIcon';
import { Icon } from '../components/Icon';
import { Check, Trash2 } from 'lucide-react';
import { FIELD, chip } from '../lib/ui';
import { copyPlain } from '../lib/clipboard';
import { dateTime } from '../lib/date';
import { ErrorLine } from '../components/ErrorLine';
import { WorkingLine } from '../components/fx/WorkingLine';
import { TabRow } from '../components/TabRow';

const when = dateTime;
const n = (v: number | undefined) => (typeof v === 'number' && v > 0 ? formatCount(v) : '');
const TABS = [
  { key: 'sources', label: 'Links' },
  { key: 'research', label: 'Research' },
  { key: 'create', label: 'Create' },
  { key: 'pieces', label: 'Pieces' },
] as const;
type Tab = (typeof TABS)[number]['key'];


type Preset = { research?: ResearchKind; piece?: PieceKind; query?: string; at: number };

/** The way from "who is this for" to a month of posts: eight steps, done by doing them. The next one is the one to tap. */
/** The pale red outline a delete wears (the Sign out button's look), never solid until the sheet asks. */
const DELETE_BTN = 'toy inline-flex min-h-[48px] items-center justify-center rounded-pill border-2 border-r1/40 bg-transparent px-md text-[16px] font-bold text-r1 hover:bg-r1/10 disabled:opacity-50';

/** Asks before a delete, the Mindful session pattern: a red "Yes, delete it" and a quiet "Keep it". */
function ConfirmDelete({ open, title, body, pending, failed, onYes, onClose }: { open: boolean; title: string; body: string; pending: boolean; failed: boolean; onYes: () => void; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="grid gap-md pb-xl">
        <p className="m-0 text-[16px] font-semibold text-ink-soft">{body}</p>
        {failed && <p role="alert" className="m-0 text-[14px] font-bold text-r1">That did not work. Try again.</p>}
        <div className="flex flex-wrap gap-xs">
          <button type="button" disabled={pending} onClick={onYes} className={DELETE_BTN}>
            Yes, delete it
          </button>
          <Button variant="outline" onClick={onClose}>
            Keep it
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function StrategyPath({ brand, counts, onGo }: { brand: { niche: string; voice: string }; counts: Parameters<typeof strategyPath>[1]; onGo: (go: ReturnType<typeof strategyPath>[number]['go']) => void }) {
  const steps = strategyPath(brand, counts);
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  return (
    <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="path-heading">
      <h2 id="path-heading" className="text-[18px]">
        Your strategy, step by step
      </h2>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
        {next ? `${done} of ${steps.length} done. Next: ${next.title.toLowerCase()}.` : 'All eight steps done. Run the steps again whenever the niche moves.'}
      </p>
      <div className="mt-sm h-[8px] rounded-pill bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Strategy steps done">
        <div className="h-full rounded-pill bg-ink" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-sm m-0 flex list-none flex-col gap-xs p-0">
        {steps.map((s, i) => (
          <li key={s.key}>
            <button type="button" onClick={() => onGo(s.go)} className={`toy toy-flat flex min-h-[44px] w-full items-start gap-sm rounded-tile p-xs text-left ${s === next ? 'bg-paper' : ''}`}>
              <span aria-hidden="true" className={`mt-[2px] flex size-[28px] shrink-0 items-center justify-center rounded-pill text-[14px] font-extrabold ${s.done ? 'bg-r4 text-on-fill' : s === next ? 'bg-ink text-on-ink' : 'bg-line text-ink-soft'}`}>
                {s.done ? <Icon icon={Check} size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={`block text-[16px] font-bold ${s.done ? 'text-ink-soft' : ''}`}>{s.title}</span>
                <span className="block text-[12px] font-bold text-ink-soft">{s.why}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** One brand's folder: the links it is fed, the research done on them, what to create, and the pieces so far. */
export function Brand() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const pg = usePage();
  const q = useAuthed(['brand', id, pg.query], () => api.brand(id, pg.query));
  const [tabRaw, setTab] = useParamState('tab', 'sources');
  const tab: Tab = TABS.some((t) => t.key === tabRaw) ? (tabRaw as Tab) : 'sources';
  const [editing, setEditing] = useState(false);
  const [openRun, setOpenRun] = useState<ResearchRun | null>(null);
  const [openPiece, setOpenPiece] = useState<BrandPiece | null>(null);
  const [preset, setPreset] = useState<Preset | null>(null);
  const remove = useMutation({ mutationFn: () => api.deleteBrand(id), onSuccess: () => nav('/shop/content', { replace: true }) });
  const [deleting, setDeleting] = useState(false);
  const d = q.data;

  if (q.isError) {
    return (
      <Screen>
        <AppCover back={{ to: '/shop/content', label: 'Content' }} title="That folder is gone" lede={errorText(q.error, 'It may have been removed.')} />
      </Screen>
    );
  }
  if (!d) return null;
  const b = d.brand;

  return (
    <Screen>
      <AppCover
        back={{ to: '/shop/content', label: 'Content' }}
        eyebrow={b.niche || 'Brand folder'}
        title={b.name}
        lede={b.description || undefined}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit the brand
            </Button>
            <IconButton icon={Trash2} label="Remove folder" disabled={remove.isPending} onClick={() => setDeleting(true)} opens />
          </>
        }
      >
        <ToolsLine tools={d.tools} />
      </AppCover>
      <ConfirmDelete open={deleting} title="Delete this folder?" body={`${b.name} and everything in its folder: links, research and pieces. This cannot be undone.`} pending={remove.isPending} failed={remove.isError} onYes={() => remove.mutate()} onClose={() => setDeleting(false)} />

      <StrategyPath
        brand={b}
        counts={d.counts}
        onGo={(go) => {
          if (go.to === 'edit') return setEditing(true);
          setPreset(go.to === 'research' ? { research: go.kind, query: b.niche, at: Date.now() } : { piece: go.kind, at: Date.now() });
          setTab(go.to);
        }}
      />

      <div className="mt-md">
        <nav aria-label="Folder sections">
          <TabRow
            label="Folder sections"
            items={TABS.map((t) => ({ key: t.key as Tab, label: `${t.label}${t.key === 'sources' ? ` · ${d.sources.length}` : t.key === 'research' ? ` · ${d.runs.length}` : t.key === 'pieces' ? ` · ${b.pieces}` : ''}` }))}
            value={tab}
            onChange={setTab}
            pillClass={chip}
          />
        </nav>
      </div>

      {tab === 'sources' && <SourcesTab id={id} sources={d.sources} onChange={() => q.refetch()} onOpenRun={setOpenRun} />}
      {tab === 'research' && <ResearchTab id={id} runs={d.runs} preset={preset} reach={d.tools.reach} onChange={() => q.refetch()} onOpen={setOpenRun} />}
      {tab === 'create' && (
        <CreateTab
          id={id}
          preset={preset}
          runs={d.runs}
          writer={d.tools.writer}
          onMade={(p) => {
            q.refetch();
            setTab('pieces');
            setOpenPiece(p);
          }}
        />
      )}
      {tab === 'pieces' && <PiecesTab pieces={d.pieces} onOpen={setOpenPiece} />}
      {tab === 'pieces' && <Pager page={d.page} label="pieces" />}

      <EditBrandSheet open={editing} id={id} brand={b} onClose={() => setEditing(false)} onSaved={() => q.refetch()} />
      <RunSheet run={openRun} onClose={() => setOpenRun(null)} />
      <PieceSheet id={id} piece={openPiece} onClose={() => setOpenPiece(null)} onChange={() => q.refetch()} />
    </Screen>
  );
}

function SourcesTab({ id, sources, onChange, onOpenRun }: { id: string; sources: BrandSource[]; onChange: () => void; onOpenRun: (r: ResearchRun) => void }) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [competitor, setCompetitor] = useState(false);
  const add = useMutation({
    mutationFn: () => api.addBrandSource(id, { url: url.trim(), label, ...(competitor ? { kind: 'competitor' as const } : {}) }),
    onSuccess: () => {
      setUrl('');
      setLabel('');
      setCompetitor(false);
      onChange();
    },
  });
  const read = useMutation({
    mutationFn: (sid: string) => api.readBrandSource(id, sid),
    onSuccess: (r) => {
      onChange();
      if (r.run) onOpenRun(r.run);
    },
  });
  const remove = useMutation({ mutationFn: (sid: string) => api.removeBrandSource(id, sid), onSuccess: onChange });
  return (
    <section className="mt-lg" aria-labelledby="links-heading">
      <h2 id="links-heading" className="text-[24px]">
        Links the brand is fed
      </h2>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Site, channels, top posts and competitors. A read link stays in the folder.</p>
      <form
        className="mt-sm flex flex-col gap-sm rounded-card bg-card p-md shadow-toy-soft"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) add.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Link</span>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} placeholder="https://" required className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Label</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder="Their YouTube, our site, top reel" className={FIELD} />
        </label>
        <label className="toy flex min-h-[48px] cursor-pointer items-center gap-sm rounded-tile bg-paper p-sm">
          <input type="checkbox" checked={competitor} onChange={(e) => setCompetitor(e.target.checked)} className="size-[20px] accent-ink" />
          <span className="text-[14px] font-bold">This is a competitor</span>
        </label>
        <ErrorLine e={add.isError ? add.error : null} className="mt-sm" />
        <Button type="submit" disabled={add.isPending || !url.trim()}>
          Add link
        </Button>
      </form>
      {sources.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">No links yet. Start with the brand's own site or channel.</p>}
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {sources.map((s) => (
          <li key={s.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
            <div className="flex items-start gap-sm">
              <span className="flex size-[40px] shrink-0 items-center justify-center rounded-pill bg-paper" aria-hidden="true">
                <AppIcon name={BRAND_SOURCE_META[s.kind].icon} size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-bold">{s.label || s.url}</span>
                <a href={s.url} target="_blank" rel="noreferrer" className="block truncate text-[12px] font-bold text-ink-soft underline-offset-4 hover:underline">
                  {s.url}
                </a>
                <span className="mt-xs block text-[12px] font-bold text-ink-mute">
                  {BRAND_SOURCE_META[s.kind].name}
                  {s.lastReadAt ? `, read ${when(s.lastReadAt)}` : ', not read yet'}
                </span>
                {s.summary && <span className="mt-xs block text-[14px] font-semibold text-ink-soft">{s.summary.slice(0, 220)}{s.summary.length > 220 ? '…' : ''}</span>}
              </span>
            </div>
            <div className="mt-sm flex flex-wrap gap-xs">
              <Button size="sm" onClick={() => read.mutate(s.id)} disabled={read.isPending}>
                {read.isPending && read.variables === s.id ? 'Reading' : s.lastReadAt ? 'Read again' : 'Read it'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(s.id)} disabled={remove.isPending}>
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <ErrorLine e={read.isError ? read.error : null} className="mt-sm" />
    </section>
  );
}

function ResearchTab({ id, runs, preset, reach, onChange, onOpen }: { id: string; runs: ResearchRun[]; preset: Preset | null; reach: boolean; onChange: () => void; onOpen: (r: ResearchRun) => void }) {
  const [kind, setKind] = useState<ResearchKind>('outliers');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState('10');
  useEffect(() => {
    if (preset?.research) {
      setKind(preset.research);
      setQuery(preset.query ?? '');
    }
  }, [preset]);
  const go = useMutation({
    mutationFn: () => api.researchBrand(id, { kind, query: query.trim(), limit: Number(limit) || 10 }),
    onSuccess: (r) => {
      onChange();
      if (r.run) onOpen(r.run);
    },
  });
  const remove = useMutation({ mutationFn: (rid: string) => api.removeBrandRun(id, rid), onSuccess: onChange });
  const kinds = RESEARCH_KINDS.filter((k) => k !== 'read');
  return (
    <section className="mt-lg" aria-labelledby="research-heading">
      <h2 id="research-heading" className="text-[24px]">
        Research
      </h2>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{reach ? 'Every run goes out through Agent Reach and is kept here with what it found.' : 'Without Agent Reach, pages can be read, and YouTube works with a key. Connect the bridge for the rest.'}</p>
      <form
        className="mt-sm flex flex-col gap-sm rounded-card bg-card p-md shadow-toy-soft"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) go.mutate();
        }}
      >
        <div className="flex flex-wrap gap-xs">
          {kinds.map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>
              {RESEARCH_META[k].name}
            </button>
          ))}
        </div>
        <p className="m-0 text-[12px] font-bold text-ink-soft">{RESEARCH_META[kind].blurb}</p>
        <label className="block">
          <span className="block text-[14px] font-bold">{RESEARCH_META[kind].needsQuery ? 'What to look for' : 'The link'}</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} maxLength={500} placeholder={RESEARCH_META[kind].needsQuery ? 'phone videography for street food' : 'https://'} required className={FIELD} />
        </label>
        {RESEARCH_META[kind].needsQuery && (
          <label className="block">
            <span className="block text-[14px] font-bold">How many</span>
            <select value={limit} onChange={(e) => setLimit(e.target.value)} className={FIELD}>
              {['5', '10', '15', '25'].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}
        <ErrorLine e={go.isError ? go.error : null} className="mt-sm" />
        <Button type="submit" disabled={go.isPending || !query.trim()}>
          {go.isPending ? 'Looking' : 'Run it'}
        </Button>
        {go.isPending && <WorkingLine className="self-center" label="Researching" phrases={['Sending the search out', 'Reading what comes back', 'Keeping it in this folder']} loop={false} />}
      </form>
      {runs.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Nothing researched yet. Start with outliers for the brand's main topic.</p>}
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {runs.map((r) => (
          <li key={r.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
            <button type="button" onClick={() => onOpen(r)} className="toy toy-flat min-w-0 flex-1 rounded-tile p-xs text-left">
              <span className="block truncate text-[16px] font-bold">
                {RESEARCH_META[r.kind].name}
                {r.query ? `: ${r.query}` : ''}
              </span>
              <span className="block text-[12px] font-bold text-ink-soft">
                {r.status === 'done' ? `${r.items.length} ${r.items.length === 1 ? 'item' : 'items'} via ${r.backend}` : `Failed: ${r.error}`}, {when(r.createdAt)}
              </span>
            </button>
            <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)} disabled={remove.isPending}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CreateTab({ id, runs, preset, writer, onMade }: { id: string; runs: ResearchRun[]; preset: Preset | null; writer: 'claude' | 'workers-ai' | 'none'; onMade: (p: BrandPiece) => void }) {
  const [kind, setKind] = useState<PieceKind>('audit');
  const [brief, setBrief] = useState('');
  useEffect(() => {
    if (preset?.piece) setKind(preset.piece);
  }, [preset]);
  const done = runs.filter((r) => r.status === 'done');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // On by default: Content reads the unread links and runs fresh research on the niche before it writes.
  const [research, setResearch] = useState(true);
  const make = useMutation({
    mutationFn: () => api.writePiece(id, { kind, brief, runIds: picked.size ? [...picked] : undefined, research }),
    onSuccess: (r) => {
      if (r.piece) onMade(r.piece);
    },
  });
  const toggle = (rid: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(rid)) next.delete(rid);
      else next.add(rid);
      return next;
    });
  return (
    <section className="mt-lg" aria-labelledby="create-heading">
      <h2 id="create-heading" className="text-[24px]">
        Create
      </h2>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{writer === 'none' ? 'No writing model is connected, so you get the research laid out as a digest.' : 'Pick what to write. The piece leans on the research you tick, or the latest runs if you tick none.'}</p>
      <ul className="mt-sm grid list-none grid-cols-1 gap-xs p-0 m-0 md:grid-cols-2">
        {PIECE_KINDS.map((k) => (
          <li key={k}>
            <button type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`toy toy-flat flex w-full items-start gap-sm rounded-tile border-2 p-sm text-left ${kind === k ? 'border-ink bg-card' : 'border-line bg-card'}`}>
              <span className="flex size-[40px] shrink-0 items-center justify-center rounded-pill bg-paper" aria-hidden="true">
                <AppIcon name={PIECE_META[k].icon} size={20} />
              </span>
              <span className="min-w-0">
                <span className="block text-[16px] font-bold">{PIECE_META[k].name}</span>
                <span className="block text-[14px] font-semibold text-ink-soft">{PIECE_META[k].blurb}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-md flex flex-col gap-sm rounded-card bg-card p-md shadow-toy-soft"
        onSubmit={(e) => {
          e.preventDefault();
          make.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">The brief</span>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={4} maxLength={4000} placeholder={PIECE_META[kind].askFor} className={FIELD} />
        </label>
        <label className="toy flex min-h-[44px] cursor-pointer items-center gap-sm rounded-tile bg-paper p-xs">
          <input type="checkbox" checked={research} onChange={(e) => setResearch(e.target.checked)} className="size-[20px] accent-ink" />
          <span className="min-w-0 text-[14px] font-bold">
            Research first <span className="font-semibold text-ink-soft">reads any unread links and looks up what is working in the niche before writing</span>
          </span>
        </label>
        {done.length > 0 && (
          <fieldset className="m-0 border-0 p-0">
            <legend className="text-[14px] font-bold">Lean on</legend>
            <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
              {done.slice(0, 12).map((r) => (
                <li key={r.id}>
                  <label className="toy flex min-h-[44px] cursor-pointer items-center gap-sm rounded-tile bg-paper p-xs">
                    <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} className="size-[20px] accent-ink" />
                    <span className="min-w-0 truncate text-[14px] font-bold">
                      {RESEARCH_META[r.kind].name}
                      {r.query ? `: ${r.query}` : ''} <span className="font-semibold text-ink-soft">({r.items.length})</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        <ErrorLine e={make.isError ? make.error : null} className="mt-sm" />
        <Button type="submit" size="lg" full disabled={make.isPending}>
          {make.isPending ? 'Writing, this takes a minute' : `Write the ${PIECE_META[kind].name.toLowerCase()}`}
        </Button>
        {make.isPending && <WorkingLine className="self-center" label={`Writing the ${PIECE_META[kind].name.toLowerCase()}`} phrases={research ? ['Reading your links', 'Researching the topic', 'Writing'] : picked.size ? ['Reading the research you picked', 'Writing'] : ['Writing']} loop={false} />}
      </form>
    </section>
  );
}

function PiecesTab({ pieces, onOpen }: { pieces: BrandPiece[]; onOpen: (p: BrandPiece) => void }) {
  return (
    <section className="mt-lg" aria-labelledby="pieces-heading">
      <h2 id="pieces-heading" className="text-[24px]">
        Pieces
      </h2>
      {pieces.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Nothing written yet. Create one from the research.</p>}
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {pieces.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onOpen(p)} className="toy toy-soft flex w-full items-start gap-sm rounded-tile bg-card p-sm text-left text-ink">
              <span className="flex size-[40px] shrink-0 items-center justify-center rounded-pill bg-paper" aria-hidden="true">
                <AppIcon name={PIECE_META[p.kind].icon} size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-bold">{p.title}</span>
                <span className="block text-[12px] font-bold text-ink-soft">
                  {p.writer === 'claude' ? 'Written by Claude' : p.writer === 'workers-ai' ? 'Written by a small model' : 'Research digest, no model'}
                  {p.status === 'kept' ? ', kept' : ''}, {when(p.createdAt)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ItemRow({ it }: { it: ResearchItem }) {
  const stats = Object.entries(it.stats)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${n(v)} ${k}`)
    .join(', ');
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 text-[16px] font-bold">{it.title || it.url}</p>
      <p className="m-0 text-[12px] font-bold text-ink-soft">{[it.author, it.publishedAt, stats].filter(Boolean).join(' · ')}</p>
      {it.url && (
        <a href={it.url} target="_blank" rel="noreferrer" className="block truncate text-[12px] font-bold underline-offset-4 hover:underline">
          {it.url}
        </a>
      )}
      {it.text && <p className="mt-xs m-0 whitespace-pre-wrap text-[14px] font-semibold text-ink-soft">{it.text.slice(0, 600)}{it.text.length > 600 ? '…' : ''}</p>}
    </li>
  );
}

function RunSheet({ run, onClose }: { run: ResearchRun | null; onClose: () => void }) {
  return (
    <Sheet open={run !== null} onClose={onClose} title={run ? `${RESEARCH_META[run.kind].name}${run.query ? `: ${run.query}` : ''}` : ''}>
      {run && (
        <>
          <p className="m-0 text-[12px] font-bold text-ink-soft">{run.status === 'done' ? `${run.items.length} items via ${run.backend}` : `Failed: ${run.error}`}</p>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {run.items.map((it, i) => (
              <ItemRow key={`${it.url}-${i}`} it={it} />
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}

function PieceSheet({ id, piece, onClose, onChange }: { id: string; piece: BrandPiece | null; onClose: () => void; onChange: () => void }) {
  const [copied, setCopied] = useState(false);
  const keep = useMutation({ mutationFn: (status: BrandPiece['status']) => api.updatePiece(id, piece!.id, { status }), onSuccess: onChange });
  const remove = useMutation({
    mutationFn: () => api.removePiece(id, piece!.id),
    onSuccess: () => {
      onChange();
      onClose();
    },
  });
  const copy = async () => {
    if (!piece) return;
    if (!(await copyPlain(piece.body))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Sheet open={piece !== null} onClose={onClose} title={piece?.title ?? ''}>
      {piece && (
        <>
          <p className="m-0 text-[12px] font-bold text-ink-soft">
            {piece.writer === 'claude' ? 'Written by Claude' : piece.writer === 'workers-ai' ? 'Written by a small model' : 'A research digest, no model'} from {piece.sources.length} {piece.sources.length === 1 ? 'run' : 'runs'}, {when(piece.createdAt)}.
          </p>
          {piece.brief && <p className="mt-xs m-0 rounded-tile bg-paper p-sm text-[14px] font-semibold">Brief: {piece.brief}</p>}
          <div className="mt-sm flex flex-wrap gap-xs">
            <Button size="sm" onClick={() => void copy()}>
              {copied ? 'Copied' : 'Copy text'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => keep.mutate(piece.status === 'kept' ? 'draft' : 'kept')} disabled={keep.isPending}>
              {piece.status === 'kept' ? 'Back to draft' : 'Keep it'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => remove.mutate()} disabled={remove.isPending}>
              Remove
            </Button>
          </div>
          <Markdown text={piece.body} className="mt-md" />
        </>
      )}
    </Sheet>
  );
}

function EditBrandSheet({ open, id, brand, onClose, onSaved }: { open: boolean; id: string; brand: { name: string; niche: string; description: string; voice: string }; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(brand.name);
  const [niche, setNiche] = useState(brand.niche);
  const [description, setDescription] = useState(brand.description);
  const [voice, setVoice] = useState(brand.voice);
  const save = useMutation({
    mutationFn: () => api.updateBrand(id, { name, niche, description, voice }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Edit the brand">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Brand</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Niche</span>
          <input value={niche} onChange={(e) => setNiche(e.target.value)} maxLength={120} className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">What it is</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">How it sounds</span>
          <textarea value={voice} onChange={(e) => setVoice(e.target.value)} rows={2} maxLength={1000} className={FIELD} />
        </label>
        <ErrorLine e={save.isError ? save.error : null} className="mt-sm" />
        <Button type="submit" size="lg" full disabled={save.isPending || !name.trim()}>
          Save
        </Button>
      </form>
    </Sheet>
  );
}
