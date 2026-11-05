import { contractAsText, docRef, CONTRACT_STATUSES, CONTRACT_STATUS_NAME, CONTRACT_STATUS_TONE, CONTRACT_TEMPLATES, type AgencyTemplate, type BoardColumn, type ContractListItem, type ContractStatus, LOCALE } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAgencyCan } from '../lib/agencyWorkspace';
import { api, ApiError } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { useParamState } from '../lib/useParamState';
import { tie } from '../lib/text';
import { AgencyDocsList } from './AgencyDocs';
import { AgencyInvoices, FILTER_SELECT, PaperLoading, PaperRowMenu } from './AgencyInvoices';
import { Button } from './Button';
import { Segmented } from './fx/Segmented';
import { KanbanBoard } from './KanbanBoard';
import { Pager, usePage } from './Pager';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';
import { CardHead } from './CardHead';
import { useView, ViewToggle } from './ViewToggle';
import { FIELD } from '../lib/ui';

const day = (iso: string) => new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const TEMPLATE_NAME: Record<string, string> = Object.fromEntries(CONTRACT_TEMPLATES.map((t) => [t.key, t.name]));

/** Where an agreement can go from a board: draft and sent move between themselves and to void. A signed one is a record; only the client signs. */
function canMove(from: string, to: string): boolean {
  if (from === 'signed' || from === 'void') return false;
  return to === 'draft' || to === 'sent' || to === 'void';
}

/** The three kinds of paper on Agency's Paperwork tab, in the order of the segmented control. */
export const PAPER_SEGMENTS = [
  { value: 'invoices', label: 'Invoices' },
  { value: 'agreements', label: 'Agreements' },
  { value: 'other', label: 'Documents' },
] as const;
export type PaperSegment = (typeof PAPER_SEGMENTS)[number]['value'];
/** Which kind of paper is showing, kept in the URL as `agseg`. */
export function usePaperSegment(): [PaperSegment, (v: PaperSegment) => void] {
  const [raw, set] = useParamState('agseg', 'invoices');
  const seg = (PAPER_SEGMENTS.find((x) => x.value === raw)?.value ?? 'invoices') as PaperSegment;
  return [seg, set];
}

/**
 * All the paper in one place: invoices, agreements, and the other documents (a strategy session summary, trial terms, a retainer
 * proposal, a monthly report). A segmented control chooses which; each has its own list or board. On the Agency screen the header holds
 * the one New invoice or New agreement button and passes `adding` and `onAdding`; the other documents keep their own New document.
 */
export function AgencyContracts({ clientId, adding, onAdding }: { clientId?: string; adding?: boolean; onAdding?: (open: boolean) => void }) {
  const [seg, setSeg] = usePaperSegment();
  // On one client's page the invoices and the other documents have their own blocks, so only the agreements are here.
  if (clientId) return <AgencyAgreements clientId={clientId} />;
  return (
    <div>
      <Segmented label="Kind of paper" value={seg} onChange={setSeg} options={PAPER_SEGMENTS} />
      <div className="mt-sm">
        {seg === 'invoices' ? <AgencyInvoices adding={adding} onAdding={onAdding} /> : seg === 'other' ? <AgencyDocsList /> : <AgencyAgreements adding={adding} onAdding={onAdding} />}
      </div>
    </div>
  );
}

/** The agreements pipeline: a list or a board, for every client or for one. `adding` and `onAdding` hand the New agreement button to a header. */
export function AgencyAgreements({ clientId, adding: outside, onAdding }: { clientId?: string; adding?: boolean; onAdding?: (open: boolean) => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [view, setView] = useView('ag', 'board');
  const [per, setPer] = useState(25);
  const [status, setStatus] = useParamState('agstatus', 'all');
  const pg = usePage('ag');
  const [own, setOwn] = useState(false);
  const adding = onAdding ? Boolean(outside) : own;
  const setAdding = (v: boolean) => (onAdding ? onAdding(v) : setOwn(v));
  const [rowNote, setRowNote] = useState<{ id: string; text: string } | null>(null);
  // What the new agreement starts from: a built-in template ('key:trial') or one of the person's own ('own:<id>').
  const [template, setTemplate] = useState<string>(`key:${CONTRACT_TEMPLATES[0]?.key ?? 'trial'}`);
  const [pickClient, setPickClient] = useState('');
  const [note, setNote] = useState('');

  const clientQ = clientId ? `&client=${clientId}` : '';
  const board = useAuthed(['agency', 'contracts', 'board', clientId ?? '', per], () => api.agencyContractBoard(`per=${per}${clientQ}`), view === 'board');
  const listQuery = `page=${pg.page}&size=${pg.size}${status !== 'all' ? `&status=${status}` : ''}${clientQ}`;
  const list = useAuthed(['agency', 'contracts', 'list', clientId ?? '', status, pg.page, pg.size], () => api.agencyContracts(listQuery), view === 'list');
  const clients = useAuthed(['agency', 'clients-pick'], () => api.agency('csize=100'), adding && !clientId);
  const templates = useAuthed(['agency', 'templates', 'contract'], () => api.agencyTemplates('contract'), adding);
  const mine = (templates.data?.templates ?? []).filter((t) => t.scope === 'own');
  const house = (templates.data?.templates ?? []).filter((t) => t.scope === 'house');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['agency'] });
  const move = useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) => api.agencyContractUpdate(id, { status: to as 'draft' | 'sent' | 'void' }),
    onSuccess: () => {
      setNote('');
      void invalidate();
    },
    onError: (e) => setNote(e instanceof ApiError ? e.message : 'That did not move. Try again.'),
  });
  // Restore a voided agreement to the status it had before, at the same link (the same action as on its page).
  const restore = useMutation({
    mutationFn: (id: string) => api.agencyContractRestore(id),
    onSuccess: (r) => {
      setRowNote({ id: r.contract.id, text: `Restored as ${CONTRACT_STATUS_NAME[r.restoredTo].toLowerCase()}.` });
      window.setTimeout(() => setRowNote(null), 3000);
      void invalidate();
    },
    onError: (e) => setNote(e instanceof ApiError ? e.message : 'That did not restore. Try again.'),
  });
  const create = useMutation({
    mutationFn: () => {
      const body = template.startsWith('own:') ? { templateId: template.slice(4) } : template.startsWith('house:') ? { houseId: template.slice(6) } : { templateKey: template.slice(4) };
      return api.agencyContractAdd({ ...body, clientId: clientId ?? (pickClient || null) });
    },
    onSuccess: (r) => {
      void invalidate();
      setAdding(false);
      nav(`/agency/contracts/${r.id}`);
    },
  });

  const edit = useAgencyCan().can('paperwork', 'edit');
  const onMove = (item: ContractListItem, from: string, to: string) => {
    if (from === 'signed') return setNote('A signed agreement is a record. Open it and make a revised copy instead.');
    if (to === 'signed') return setNote('Only the client can sign, with the link you send.');
    if (from === 'void') return setNote('A voided agreement stays put. Restore it from its More menu, or make a copy.');
    if (!canMove(from, to)) return;
    move.mutate({ id: item.id, to });
  };

  const columns = (board.data?.columns ?? ([] as BoardColumn<ContractListItem>[])).map((c) => ({ ...c, name: CONTRACT_STATUS_NAME[c.stage as ContractStatus] ?? c.stage }));
  const counts = new Map((list.data?.counts ?? []).map((c) => [c.status, c.n]));
  const total = [...counts.values()].reduce((a, b) => a + b, 0);

  return (
    <section aria-labelledby="agreements-heading">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <ViewToggle view={view} onChange={setView} label="How to see agreements" />
        {!onAdding && edit && (
          <Button size="sm" plusToX onClick={() => setAdding(true)}>
            New agreement
          </Button>
        )}
      </div>

      {note && (
        <p role="status" className="mt-sm m-0 rounded-tile p-sm text-subhead" style={{ background: 'var(--tint-yellow)' }}>
          {note}
        </p>
      )}

      {view === 'board' ? (
        <div className="mt-sm">
          {board.isPending && <PaperLoading label="Loading agreements" />}
          {board.isError && (
            <p role="alert" className="m-0 text-subhead">
              Could not load the board. Try again in a moment.
            </p>
          )}
          {board.data && (
            <KanbanBoard<ContractListItem>
              columns={columns}
              onMove={edit ? onMove : undefined}
              canMoveTo={(_item, from, to) => canMove(from, to)}
              onMore={() => setPer((n) => n + 25)}
              empty="None yet"
              itemLabel={(c) => c.title}
              card={(c) => <Card c={c} />}
              moveAtFoot
            />
          )}
        </div>
      ) : (
        <div className="mt-sm">
          <select
            aria-label="Agreement status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              pg.reset();
            }}
            className={FILTER_SELECT}
          >
            <option value="all">Status: All{list.data ? ` (${total})` : ''}</option>
            {CONTRACT_STATUSES.map((st) => (
              <option key={st} value={st}>
                Status: {CONTRACT_STATUS_NAME[st]}
                {list.data ? ` (${counts.get(st) ?? 0})` : ''}
              </option>
            ))}
          </select>
          {list.isPending && (
            <div className="mt-sm">
              <PaperLoading label="Loading agreements" />
            </div>
          )}
          {list.isError && (
            <p role="alert" className="mt-sm m-0 text-subhead">
              Could not load the agreements. Try again in a moment.
            </p>
          )}
          {list.data && list.data.contracts.length === 0 && <p className="mt-sm m-0 rounded-tile bg-card p-sm text-subhead text-ink-soft shadow-toy-soft">No agreements here yet. Start one from a template.</p>}
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {list.data?.contracts.map((c) => (
              <li key={c.id} className="rounded-tile bg-card shadow-toy-soft">
                <div className="flex items-center gap-xs pr-xs">
                  <Link to={`/agency/contracts/${c.id}`} className="toy flex min-w-0 flex-1 flex-wrap items-center justify-between gap-sm rounded-tile p-sm text-ink no-underline">
                    <span className="min-w-0 flex-1">
                      <span className="block text-headline">{tie(c.title)}</span>
                      <span className="block text-subhead text-ink-soft">
                        {[c.clientName || 'No client yet', TEMPLATE_NAME[c.templateKey] ?? 'Your own', c.signedAt ? `Signed ${day(c.signedAt)}` : c.sentAt ? `Sent ${day(c.sentAt)}` : `Changed ${day(c.updatedAt)}`].join(' · ')}
                      </span>
                    </span>
                    <StatusTag tone={CONTRACT_STATUS_TONE[c.status]}>{CONTRACT_STATUS_NAME[c.status]}</StatusTag>
                  </Link>
                  <PaperRowMenu
                    path={`/agency/contracts/${c.id}`}
                    name={c.title}
                    onNote={(text) => setRowNote(text ? { id: c.id, text } : null)}
                    onRestore={c.status === 'void' ? () => restore.mutate(c.id) : undefined}
                    getText={async () => {
                      const { contract } = await api.agencyContract(c.id);
                      return contractAsText(contract.doc, { reference: docRef('AGR', contract.id), date: contract.sentAt ?? contract.createdAt, answers: contract.answers, acceptance: contract.acceptance });
                    }}
                  />
                </div>
                {rowNote?.id === c.id && (
                  <p role="status" className="m-0 px-sm pb-sm text-caption">
                    {rowNote.text}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <Pager page={list.data?.page} prefix="ag" label="agreements" />
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="New agreement">
        <p className="m-0 text-subhead text-ink-soft">Pick a place to start. Your details and the client's fill in for you, and every part can be changed.</p>
        {!clientId && (
          <label className="mt-sm block text-subhead font-semibold" htmlFor="new-agreement-client">
            For which client
            <select id="new-agreement-client" value={pickClient} onChange={(e) => setPickClient(e.target.value)} className={FIELD}>
              <option value="">No client yet</option>
              {clients.data?.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <h3 className="mt-md text-headline">Built in</h3>
        <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0" role="radiogroup" aria-label="Built-in templates">
          {CONTRACT_TEMPLATES.map((t) => (
            <li key={t.key}>
              <Choice on={template === `key:${t.key}`} onPick={() => setTemplate(`key:${t.key}`)} name={t.name} blurb={t.blurb} />
            </li>
          ))}
        </ul>
        <h3 className="mt-md text-headline">Your templates</h3>
        {mine.length === 0 ? (
          <p className="mt-xs m-0 text-subhead text-ink-soft">None yet. Open any agreement and tap "Save as template" to keep it as a starting point.</p>
        ) : (
          <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0" role="radiogroup" aria-label="Your templates">
            {mine.map((t) => (
              <li key={t.id}>
                <Choice on={template === `own:${t.id}`} onPick={() => setTemplate(`own:${t.id}`)} name={t.name} blurb={t.summary} />
              </li>
            ))}
          </ul>
        )}
        <h3 className="mt-md text-headline">House templates</h3>
        {house.length === 0 ? (
          <p className="mt-xs m-0 text-subhead text-ink-soft">No house templates yet.</p>
        ) : (
          <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0" role="radiogroup" aria-label="House templates">
            {house.map((t) => (
              <li key={t.id}>
                <Choice house on={template === `house:${t.id}`} onPick={() => setTemplate(`house:${t.id}`)} name={t.name} blurb={t.summary} />
              </li>
            ))}
          </ul>
        )}
        {create.isError && (
          <p role="alert" className="mt-sm m-0 text-subhead">
            {create.error instanceof ApiError ? create.error.message : 'That did not work. Try again.'}
          </p>
        )}
        <div className="mt-md flex flex-wrap gap-xs">
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? 'Making it' : 'Start this agreement'}
          </Button>
          <Button variant="outline" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      </Sheet>
    </section>
  );
}

/** One pickable starting point. */
function Choice({ on, onPick, name, blurb, house = false }: { on: boolean; onPick: () => void; name: string; blurb: string; house?: boolean }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onPick} className={`toy w-full rounded-tile border-2 p-sm text-left ${on ? 'border-ink bg-card-strong' : 'toy-soft border-line bg-card'}`}>
      <CardHead tag={house && <StatusTag fit tone="info">House template</StatusTag>}>
        <span className="block text-headline">{tie(name)}</span>
      </CardHead>
      <span className="block text-subhead text-ink-soft">{blurb}</span>
    </button>
  );
}

/** The person's own agreement templates: rename or remove. They are made from any agreement with "Save as template". Shown in Agency settings. */
export function AgreementTemplates() {
  const qc = useQueryClient();
  const q = useAuthed(['agency', 'templates', 'contract'], () => api.agencyTemplates('contract'));
  const templates: AgencyTemplate[] = (q.data?.templates ?? []).filter((t) => t.scope === 'own');
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [armed, setArmed] = useState<string | null>(null);
  const done = () => qc.invalidateQueries({ queryKey: ['agency'] });
  const rename = useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) => api.agencyTemplateUpdate(id, { name: to }),
    onSuccess: () => {
      setEditing(null);
      void done();
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => api.agencyTemplateRemove(id), onSuccess: () => void done() });
  const armRemove = (id: string) => {
    if (armed === id) {
      setArmed(null);
      remove.mutate(id);
      return;
    }
    setArmed(id);
    window.setTimeout(() => setArmed((a) => (a === id ? null : a)), 4000);
  };
  return (
    <div>
      <p className="m-0 text-subhead text-ink-soft">Make one from any agreement: open it and tap "Save as template". It keeps the sections, not the names filled in.</p>
      {q.isPending && (
        <div className="mt-xs">
          <PaperLoading label="Loading your templates" />
        </div>
      )}
      {q.isError && (
        <p role="alert" className="mt-xs m-0 text-subhead">
          Could not load your templates. Try again.
        </p>
      )}
      {q.data && templates.length === 0 && <p className="mt-xs m-0 rounded-tile bg-card p-sm text-subhead text-ink-soft shadow-toy-soft">No templates of your own yet.</p>}
      <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
        {templates.map((t) => (
          <li key={t.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
            {editing === t.id ? (
              <form
                className="flex flex-wrap items-center gap-xs"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim()) rename.mutate({ id: t.id, to: name.trim() });
                }}
              >
                <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="Template name" className="min-h-[44px] min-w-0 flex-1 rounded-pill border-2 border-line bg-paper px-sm text-body" />
                <Button type="submit" size="sm" disabled={rename.isPending || !name.trim()}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-xs">
                <span className="min-w-0 flex-1">
                  <span className="block text-headline">{tie(t.name)}</span>
                  <span className="block text-subhead text-ink-soft">{t.summary}</span>
                </span>
                <span className="flex gap-xs">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(t.id);
                      setName(t.name);
                    }}
                  >
                    Rename
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => armRemove(t.id)}>
                    {armed === t.id ? 'Tap again to remove' : 'Remove'}
                  </Button>
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A card on the agreement board: the title and one line with the client and the day. The column already says its status. */
function Card({ c }: { c: ContractListItem }) {
  return (
    <div>
      <Link to={`/agency/contracts/${c.id}`} className="block text-headline underline-offset-4 hover:underline">
        {/* The Move button sits at the card's foot (moveAtFoot), so the title has the card's whole width and a tail in capitals as long
            as "ENGAGEMENT AGREEMENT" (20 letters) stays on one line instead of leaving "AGREEMENT" alone. */}
        {tie(c.title, 20)}
      </Link>
      <p data-kfoot="" className="mt-xs m-0 text-caption text-ink-soft">{tie(`${c.clientName || 'No client yet'}, ${c.signedAt ? `signed ${day(c.signedAt)}` : c.sentAt ? `sent ${day(c.sentAt)}` : `changed ${day(c.updatedAt)}`}`)}</p>
    </div>
  );
}
