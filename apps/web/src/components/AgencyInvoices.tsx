import { INVOICE_STARTERS, invoiceAsText, invoiceForClient, INVOICE_STATUS_NAME, INVOICE_STATUS_TONE, INVOICE_STATUSES, money, pageQuery, TEMPLATE_NAME_MAX, type AgencyTemplate, type Invoice } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAgencyCan } from '../lib/agencyWorkspace';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { useParamState } from '../lib/useParamState';
import { Button } from './Button';
import { ArchiveRestore, Copy, Mail, Printer } from 'lucide-react';
import { copyPlain } from '../lib/clipboard';
import { MoreMenu, type MoreMenuItem } from './MoreMenu';
import { Busy, Skeleton } from './Skeleton';
import { Inert } from './Inert';
import { Field } from './InvoiceView';
import { shortDate } from '../lib/date';
import { KanbanBoard } from './KanbanBoard';
import { Pager, usePage } from './Pager';
import { Sheet } from './Sheet';
import { ConfirmDelete } from './ConfirmDelete';
import { StatusTag } from './StatusTag';
import { useView, ViewToggle } from './ViewToggle';

const PER_STEP = 25;

/** A select in a filter row; the right padding keeps the words clear of its arrow. */
export const FILTER_SELECT = 'min-h-[44px] max-w-full rounded-pill border-2 border-line bg-card pl-sm pr-xl text-subhead font-medium text-ink';

/** Placeholder rows while a list or a board of paper loads. */
export function PaperLoading({ label }: { label: string }) {
  return (
    <Busy label={label} className="flex flex-col gap-xs">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[64px] w-full" />
      ))}
    </Busy>
  );
}

/**
 * The quiet actions of one invoice, agreement or document row, behind one More button: download or print (the page opens and asks the
 * browser to print, where Save as PDF lives), copy the text, and email a copy (the page opens on its email sheet). A voided one also
 * offers Restore (`onRestore`), the same action as on its page.
 */
export function PaperRowMenu({ path, name, getText, onNote, onRestore }: { path: string; name: string; getText: () => Promise<string>; onNote: (note: string) => void; onRestore?: () => void }) {
  const nav = useNavigate();
  return (
    <MoreMenu
      label={`More for ${name}`}
      items={[
        { key: 'print', label: 'Download or print', icon: Printer, onSelect: () => nav(`${path}?print=1`) },
        {
          key: 'copy',
          label: 'Copy text',
          icon: Copy,
          onSelect: async () => {
            try {
              onNote((await copyPlain(await getText())) ? 'Copied.' : 'Open it to copy the text.');
            } catch {
              onNote('That did not load. Try again.');
            }
            window.setTimeout(() => onNote(''), 3000);
          },
        },
        { key: 'email', label: 'Email a copy', icon: Mail, onSelect: () => nav(`${path}?email=1`) },
        ...(onRestore ? [{ key: 'restore', label: 'Restore', icon: ArchiveRestore, onSelect: onRestore } satisfies MoreMenuItem] : []),
      ]}
    />
  );
}

/** A card on the invoice board: the number, a Revised tag when it has one, and one line with who it is for and the amount. */
function Card({ inv }: { inv: Invoice }) {
  return (
    <Link to={`/agency/invoices/${inv.id}`} className="block text-ink no-underline">
      <span className="block text-headline">{inv.number}</span>
      {inv.revisedAt && (
        <span className="mt-xs flex">
          <StatusTag tone="warn">Revised</StatusTag>
        </span>
      )}
      <span className="mt-xs block text-caption text-ink-soft">
        <Inert text={inv.clientName} />, {money(inv.totalCents, inv.currency)}
      </span>
    </Link>
  );
}

/** On Paperwork, a segmented control that fills its row in equal parts on a phone and is its own width from 34rem of row up. */
export const PAPER_FILL = 'flex w-full *:flex-1 *:px-xs @min-[34rem]:inline-flex @min-[34rem]:w-auto @min-[34rem]:*:flex-none @min-[34rem]:*:px-md';
/** The row that holds List and Board with the kinds of paper: the container PAPER_FILL measures. */
export const paperRow = (kinds: unknown) => (kinds ? '@container' : '');

/**
 * The invoices pipeline: a board by status or a paged list, for every client or one. On the Agency screen the header holds the one New
 * invoice button (`adding`, `onAdding`); on a client's page this draws its own.
 */
export function AgencyInvoices({ clientId, adding: outside, onAdding, kinds }: { clientId?: string; adding?: boolean; onAdding?: (open: boolean) => void; /** The kind-of-paper switch, at the right of List and Board (Paperwork). */ kinds?: ReactNode }) {
  const [view, setView] = useView('inv');
  const qc = useQueryClient();
  const nav = useNavigate();
  const [per, setPer] = useState(PER_STEP);
  const [status, setStatus] = useParamState('invstatus', 'all');
  const { page, size, reset } = usePage('inv');
  const [msg, setMsg] = useState('');
  const [rowNote, setRowNote] = useState<{ id: string; text: string } | null>(null);
  // A move to Void on the board asks first, with the invoice it is about.
  const [voiding, setVoiding] = useState<{ id: string; number: string } | null>(null);
  const [own, setOwn] = useState(false);
  const adding = onAdding ? Boolean(outside) : own;
  const setAdding = (v: boolean) => (onAdding ? onAdding(v) : setOwn(v));
  const edit = useAgencyCan().can('paperwork', 'edit');
  const clientQ = clientId ? `client=${clientId}` : '';
  const refresh = () => qc.invalidateQueries({ queryKey: ['agency'] });

  const board = useAuthed(['agency', 'invoices', 'board', clientId ?? '', per], () => api.agencyInvoiceBoard([clientQ, `per=${per}`].filter(Boolean).join('&')), view === 'board');
  const listQuery = [pageQuery(page, size), clientQ, status !== 'all' ? `status=${status}` : ''].filter(Boolean).join('&');
  const list = useAuthed(['agency', 'invoices', 'list', listQuery], () => api.agencyInvoices(listQuery), view === 'list');

  const move = useMutation({
    mutationFn: ({ id, to }: { id: string; to: Invoice['status'] }) => api.agencyInvoiceUpdate(id, { status: to }),
    onSuccess: () => {
      setMsg('');
      return refresh();
    },
    onError: (e: Error) => setMsg(e.message),
  });
  // Restore a void invoice to the status it had before the void, from its row (the same action as on its page).
  const restore = useMutation({
    mutationFn: (id: string) => api.agencyInvoiceRestore(id),
    onSuccess: (r) => {
      setRowNote({ id: r.invoice.id, text: `Restored as ${INVOICE_STATUS_NAME[r.restoredTo].toLowerCase()}.` });
      window.setTimeout(() => setRowNote(null), 3000);
      return refresh();
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const counts = new Map((list.data?.counts ?? []).map((c) => [c.status, c.n]));
  const total = [...counts.values()].reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className={`flex flex-wrap items-center justify-between gap-sm ${paperRow(kinds)}`}>
        <div className={kinds ? 'basis-full @min-[34rem]:basis-auto' : ''}>
          <ViewToggle view={view} onChange={setView} label="Invoices view" className={kinds ? PAPER_FILL : undefined} />
        </div>
        {kinds}
        {!onAdding && edit && <Button onClick={() => setAdding(true)}>New invoice</Button>}
      </div>
      {msg && (
        <p role="alert" className="mt-sm m-0 text-subhead">
          {msg}
        </p>
      )}

      {view === 'board' && (
        <div className="mt-sm">
          {board.isError && (
            <p role="alert" className="m-0 text-subhead">
              Could not load the invoices. Try again.
            </p>
          )}
          {board.isPending && <PaperLoading label="Loading invoices" />}
          {board.data && (
            <KanbanBoard
              columns={board.data.columns.map((c) => ({ ...c, stage: c.stage, name: INVOICE_STATUS_NAME[c.stage as Invoice['status']], note: c.cents > 0 ? money(c.cents) : undefined }))}
              card={(inv) => <Card inv={inv} />}
              itemLabel={(inv) => inv.number}
              onMore={() => setPer((n) => n + PER_STEP)}
              onMove={!edit ? undefined : (inv, from, to) => {
                if (from === 'void') {
                  setMsg('A void invoice is kept for the record. Restore it from its More menu, or duplicate it.');
                  return;
                }
                if (to === 'void') {
                  move.reset();
                  setVoiding({ id: inv.id, number: inv.number });
                  return;
                }
                move.mutate({ id: inv.id, to: to as Invoice['status'] });
              }}
              canMoveTo={(_inv, from) => from !== 'void'}
              empty="No invoices here"
            />
          )}
        </div>
      )}

      {view === 'list' && (
        <div className="@container mt-sm">
          <select
            aria-label="Invoice status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              reset();
            }}
            className={`${FILTER_SELECT} w-full @min-[34rem]:w-auto`}
          >
            <option value="all">Status: All{list.data ? ` (${total})` : ''}</option>
            {INVOICE_STATUSES.map((st) => (
              <option key={st} value={st}>
                Status: {INVOICE_STATUS_NAME[st]}
                {list.data ? ` (${counts.get(st) ?? 0})` : ''}
              </option>
            ))}
          </select>
          {list.isPending && (
            <div className="mt-sm">
              <PaperLoading label="Loading invoices" />
            </div>
          )}
          {list.isError && (
            <p role="alert" className="mt-sm m-0 text-subhead">
              Could not load the invoices. Try again.
            </p>
          )}
          {list.data && list.data.invoices.length === 0 && <p className="mt-sm m-0 rounded-tile bg-card p-sm text-subhead text-ink-soft">No invoices here yet.</p>}
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {list.data?.invoices.map((inv) => (
              <li key={inv.id} className="rounded-tile bg-card shadow-toy-soft">
                <div className="flex items-center gap-xs pr-xs">
                  <Link to={`/agency/invoices/${inv.id}`} className="toy flex min-w-0 flex-1 flex-wrap items-center gap-sm rounded-tile p-sm text-ink no-underline">
                    {/* At least 60% of the row, so on a narrow phone the tags and the total wrap under it instead of squeezing it into
                        a column of short lines. */}
                    <span className="min-w-[60%] flex-1">
                      <span className="block text-headline">{inv.number}</span>
                      <span className="block text-subhead text-ink-soft">
                        <Inert text={inv.clientName} />, {shortDate(inv.issueDate)}
                        {inv.dueDate ? `, due ${shortDate(inv.dueDate)}` : ''}
                      </span>
                    </span>
                    {/* The tags and the total wrap together, so the total never sits alone on a line of its own. */}
                    <span className="flex items-center gap-sm">
                      <span className="flex items-center gap-xs">
                        {inv.revisedAt && <StatusTag tone="warn">Revised</StatusTag>}
                        <StatusTag tone={INVOICE_STATUS_TONE[inv.status]}>{INVOICE_STATUS_NAME[inv.status]}</StatusTag>
                      </span>
                      <span className="text-title3 type-figure">{money(inv.totalCents, inv.currency)}</span>
                    </span>
                  </Link>
                  <PaperRowMenu
                    path={`/agency/invoices/${inv.id}`}
                    name={inv.number}
                    onNote={(text) => setRowNote(text ? { id: inv.id, text } : null)}
                    onRestore={inv.status === 'void' ? () => restore.mutate(inv.id) : undefined}
                    getText={async () => {
                      const { invoice } = await api.agencyInvoice(inv.id);
                      return invoiceAsText(invoiceForClient(invoice));
                    }}
                  />
                </div>
                {rowNote?.id === inv.id && (
                  <p role="status" className="m-0 px-sm pb-sm text-caption">
                    {rowNote.text}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <Pager page={list.data?.page} prefix="inv" label="invoices" />
        </div>
      )}

      <NewInvoice
        open={adding}
        clientId={clientId}
        onClose={() => setAdding(false)}
        onMade={async (id) => {
          await refresh();
          setAdding(false);
          nav(`/agency/invoices/${id}`);
        }}
      />
      <ConfirmDelete
        open={voiding !== null}
        title="Void this invoice?"
        body={`${voiding?.number ?? ''}. It is kept for the record and stops counting as owed. You can restore it from its More menu.`}
        pending={move.isPending}
        failed={move.isError}
        onYes={() => voiding && move.mutate({ id: voiding.id, to: 'void' }, { onSuccess: () => setVoiding(null) })}
        onClose={() => {
          setVoiding(null);
          // The board put the card in Void while it asked; reading the columns again puts it back where it was.
          void board.refetch();
        }}
        yes="Yes, void it"
      />
    </div>
  );
}

/** Start an invoice: pick the client (when it is not already known) and a starting point, then open it in the designer. */
function NewInvoice({ open, clientId, onClose, onMade }: { open: boolean; clientId?: string; onClose: () => void; onMade: (id: string) => void }) {
  const clients = useAuthed(['agency', 'clients', 'all'], () => api.agency(`${pageQuery(1, 100, 'c')}`), open && !clientId);
  const mine = useAuthed(['agency', 'templates', 'invoice'], () => api.agencyTemplates('invoice'), open);
  const [pick, setPick] = useState('');
  const [err, setErr] = useState('');
  const id = clientId ?? pick;
  const make = useMutation({
    mutationFn: (start: { starter?: string; templateId?: string; houseId?: string }) =>
      api.agencyInvoiceAdd({ clientId: id, ...start, ...(start.starter || start.templateId || start.houseId ? {} : { items: [{ description: 'Services', quantity: 1, unitCents: 0 }] }) }),
    onSuccess: (r) => onMade(r.invoice.id),
    onError: (e: Error) => setErr(e.message),
  });
  const card = 'toy toy-soft rounded-tile border-2 border-line bg-card p-sm text-left disabled:opacity-50';
  return (
    <Sheet open={open} onClose={onClose} title="New invoice">
      <div className="grid gap-sm pb-xl">
        {!clientId && (
          <div>
            <label htmlFor="new-inv-client" className="block text-subhead font-semibold">
              Client
            </label>
            <select id="new-inv-client" value={pick} onChange={(e) => setPick(e.target.value)} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-body">
              <option value="">Choose a client</option>
              {clients.data?.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {clients.data && clients.data.clients.length === 0 && <p className="mt-xs m-0 text-subhead text-ink-soft">Add a client first, then make an invoice for them.</p>}
          </div>
        )}
        <p className="m-0 text-subhead text-ink-soft">Pick a starting point. Every one starts from your business details, and you set the amounts in the designer.</p>
        <div role="group" aria-label="Starting points" className="grid gap-xs md:grid-cols-2">
          <button type="button" disabled={!id || make.isPending} onClick={() => make.mutate({})} className={card}>
            <span className="block text-card-title">Blank</span>
            <span className="mt-xs block text-card-note text-ink-soft">One line, from your profile.</span>
          </button>
          {INVOICE_STARTERS.map((t) => (
            <button key={t.key} type="button" disabled={!id || make.isPending} onClick={() => make.mutate({ starter: t.key })} className={card}>
              <span className="block text-card-title">{t.name}</span>
              <span className="mt-xs block text-card-note text-ink-soft">{t.blurb}</span>
            </button>
          ))}
        </div>
        <h3 className="m-0 mt-xs text-headline">Your templates</h3>
        {mine.data && mine.data.templates.filter((t) => t.scope === 'own').length === 0 && <p className="m-0 text-subhead text-ink-soft">None yet. Open any invoice and tap Save as template to keep it as a starting point.</p>}
        <div role="group" aria-label="Your templates" className="grid gap-xs md:grid-cols-2">
          {(mine.data?.templates ?? []).filter((t) => t.scope === 'own').map((t) => (
            <button key={t.id} type="button" disabled={!id || make.isPending} onClick={() => make.mutate({ templateId: t.id })} className={card}>
              <span className="block text-card-title">{t.name}</span>
              <span className="mt-xs block text-card-note text-ink-soft">{t.summary}</span>
            </button>
          ))}
        </div>
        <h3 className="m-0 mt-xs text-headline">House templates</h3>
        {mine.data && mine.data.templates.filter((t) => t.scope === 'house').length === 0 && <p className="m-0 text-subhead text-ink-soft">No house templates yet.</p>}
        <div role="group" aria-label="House templates" className="grid gap-xs md:grid-cols-2">
          {(mine.data?.templates ?? []).filter((t) => t.scope === 'house').map((t) => (
            <button key={t.id} type="button" disabled={!id || make.isPending} onClick={() => make.mutate({ houseId: t.id })} className={card}>
              <span className="flex flex-wrap items-center gap-xs text-card-title">
                {t.name}
                <StatusTag tone="info">House template</StatusTag>
              </span>
              <span className="mt-xs block text-card-note text-ink-soft">{t.summary}</span>
            </button>
          ))}
        </div>
        {!id && !clientId && <p className="m-0 text-subhead font-semibold">Choose a client first.</p>}
        {make.isPending && (
          <p role="status" className="m-0 text-subhead font-semibold">
            Making it
          </p>
        )}
        {err && (
          <p role="alert" className="m-0 text-subhead">
            {err}
          </p>
        )}
      </div>
    </Sheet>
  );
}

/**
 * The person's own invoice templates: rename in two steps, remove after a sheet asks. They are made from an invoice with Save as template.
 * Shown in Agency settings, under Templates.
 */
export function InvoiceTemplates() {
  const qc = useQueryClient();
  const q = useAuthed(['agency', 'templates', 'invoice'], () => api.agencyTemplates('invoice'));
  const [renaming, setRenaming] = useState<AgencyTemplate | null>(null);
  const [name, setName] = useState('');
  // A template's remove asks first, with the template it is about.
  const [dropping, setDropping] = useState<AgencyTemplate | null>(null);
  const [msg, setMsg] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['agency'] });
  const rename = useMutation({
    mutationFn: () => api.agencyTemplateUpdate(renaming!.id, { name: name.trim() }),
    onSuccess: async () => {
      setRenaming(null);
      setMsg('Renamed.');
      await refresh();
    },
    onError: (e: Error) => setMsg(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.agencyTemplateRemove(id),
    onSuccess: async () => {
      setDropping(null);
      setMsg('Removed.');
      await refresh();
    },
    onError: (e: Error) => setMsg(e.message),
  });
  const list = (q.data?.templates ?? []).filter((t) => t.scope === 'own');
  return (
    <div className="rounded-tile bg-card p-sm">
      <p className="m-0 text-subhead text-ink-soft">Open any invoice and tap Save as template to keep it here. A template keeps the look, the bank, the tax and the lines, never who it was for.</p>
      {q.isError && (
        <p role="alert" className="mt-xs m-0 text-subhead">
          Could not load your templates. Try again.
        </p>
      )}
      {q.data && list.length === 0 && <p className="mt-xs m-0 text-subhead font-semibold">You have none yet.</p>}
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {list.map((t) => (
          <li key={t.id} className="rounded-tile bg-paper p-sm">
            {renaming?.id === t.id ? (
              <div className="grid gap-xs">
                <Field id={`tpl-rename-${t.id}`} label="New name" value={name} onChange={setName} max={TEMPLATE_NAME_MAX} />
                <div className="flex flex-wrap gap-xs">
                  <Button size="sm" onClick={() => rename.mutate()} disabled={!name.trim() || rename.isPending}>
                    Save name
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRenaming(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-sm">
                <div className="min-w-0">
                  <p className="m-0 text-card-title">{t.name}</p>
                  <p className="m-0 text-card-note text-ink-soft">{t.summary}</p>
                </div>
                <div className="flex gap-xs">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRenaming(t);
                      setName(t.name);
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      remove.reset();
                      setMsg('');
                      setDropping(t);
                    }}
                    disabled={remove.isPending}
                    aria-label={`Remove template ${t.name}`}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {msg && (
        <p role="status" className="mt-xs m-0 text-subhead">
          {msg}
        </p>
      )}
      <ConfirmDelete
        open={dropping !== null}
        title="Remove this template?"
        body={`"${dropping?.name ?? ''}". Invoices already made from it stay as they are. This cannot be undone.`}
        pending={remove.isPending}
        failed={remove.isError}
        onYes={() => dropping && remove.mutate(dropping.id)}
        onClose={() => setDropping(null)}
        yes="Yes, remove it"
      />
    </div>
  );
}
