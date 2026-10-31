import { INVOICE_STATUS_NAME, INVOICE_STATUS_TONE, INVOICE_STATUSES, money, pageQuery, type Invoice } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { useParamState } from '../lib/useParamState';
import { tie } from '../lib/text';
import { Button } from './Button';
import { Inert } from './Inert';
import { invoiceDate } from './InvoiceView';
import { KanbanBoard } from './KanbanBoard';
import { Pager, usePage } from './Pager';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';
import { useView, ViewToggle } from './ViewToggle';

const BLURB: Record<Invoice['status'], string> = {
  draft: 'Still being made. Your client cannot see it.',
  sent: 'With your client.',
  paid: 'Money received. It is booked as income.',
  void: 'Cancelled, kept for the record.',
};
const PER_STEP = 25;

function Card({ inv }: { inv: Invoice }) {
  return (
    <Link to={`/agency/invoices/${inv.id}`} className="block text-ink no-underline">
      <span className="block text-[14px] font-extrabold">{inv.number}</span>
      <span className="block text-[14px] font-semibold text-ink-soft">
        <Inert text={inv.clientName} />
      </span>
      <span className="mt-xs block font-display text-[20px] font-extrabold leading-none">{money(inv.totalCents, inv.currency)}</span>
      <span className="mt-xs block text-[12px] font-bold text-ink-soft">
        {tie(`${invoiceDate(inv.issueDate)}${inv.dueDate ? `, due ${invoiceDate(inv.dueDate)}` : ''}`)}
      </span>
      {inv.revisedAt && <StatusTag tone="warn">Revised</StatusTag>}
    </Link>
  );
}

/** The invoices pipeline: a board by status or a paged list, for every client or one. */
export function AgencyInvoices({ clientId }: { clientId?: string }) {
  const [view, setView] = useView('inv');
  const qc = useQueryClient();
  const nav = useNavigate();
  const [per, setPer] = useState(PER_STEP);
  const [status, setStatus] = useParamState('invstatus', 'all');
  const { page, size } = usePage('inv');
  const [msg, setMsg] = useState('');
  const [adding, setAdding] = useState(false);
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

  const counts = new Map((list.data?.counts ?? []).map((c) => [c.status, c.n]));
  const total = [...counts.values()].reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <ViewToggle view={view} onChange={setView} label="Invoices view" />
        <Button onClick={() => setAdding(true)}>New invoice</Button>
      </div>
      {msg && (
        <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
          {msg}
        </p>
      )}

      {view === 'board' && (
        <div className="mt-sm">
          {board.isError && (
            <p role="alert" className="m-0 text-[14px] font-bold">
              Could not load the invoices. Try again.
            </p>
          )}
          {board.data && (
            <KanbanBoard
              columns={board.data.columns.map((c) => ({ ...c, stage: c.stage, name: INVOICE_STATUS_NAME[c.stage as Invoice['status']], blurb: BLURB[c.stage as Invoice['status']], note: c.cents > 0 ? money(c.cents) : undefined }))}
              card={(inv) => <Card inv={inv} />}
              onMore={() => setPer((n) => n + PER_STEP)}
              onMove={(inv, from, to) => {
                if (from === 'void') {
                  setMsg('A void invoice is kept for the record. Duplicate it to start again.');
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
        <div className="mt-sm">
          <div role="group" aria-label="Invoice status" className="scroll-row flex gap-xs">
            {[{ key: 'all', name: 'All', n: total }, ...INVOICE_STATUSES.map((s) => ({ key: s as string, name: INVOICE_STATUS_NAME[s], n: counts.get(s) ?? 0 }))].map((s) => (
              <button key={s.key} type="button" aria-pressed={status === s.key} onClick={() => setStatus(s.key)} className={`toy min-h-[44px] shrink-0 rounded-pill border-2 px-md text-[14px] font-bold ${status === s.key ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                {s.name} {s.n}
              </button>
            ))}
          </div>
          {list.isError && (
            <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
              Could not load the invoices. Try again.
            </p>
          )}
          {list.data && list.data.invoices.length === 0 && <p className="mt-sm m-0 rounded-tile bg-card p-sm text-[14px] font-semibold text-ink-soft">No invoices here yet.</p>}
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {list.data?.invoices.map((inv) => (
              <li key={inv.id}>
                <Link to={`/agency/invoices/${inv.id}`} className="toy flex flex-wrap items-center gap-sm rounded-tile bg-card p-sm text-ink no-underline shadow-toy-soft">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-extrabold">{inv.number}</span>
                    <span className="block text-[14px] font-semibold text-ink-soft">
                      <Inert text={inv.clientName} />, {invoiceDate(inv.issueDate)}
                      {inv.dueDate ? `, due ${invoiceDate(inv.dueDate)}` : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-xs">
                    {inv.revisedAt && <StatusTag tone="warn">Revised</StatusTag>}
                    <StatusTag tone={INVOICE_STATUS_TONE[inv.status]}>{INVOICE_STATUS_NAME[inv.status]}</StatusTag>
                  </span>
                  <span className="font-display text-[20px] font-extrabold">{money(inv.totalCents, inv.currency)}</span>
                </Link>
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
    </div>
  );
}

/** Start an invoice: pick the client (when it is not already known) and a first line, then open it in the designer. */
function NewInvoice({ open, clientId, onClose, onMade }: { open: boolean; clientId?: string; onClose: () => void; onMade: (id: string) => void }) {
  const clients = useAuthed(['agency', 'clients', 'all'], () => api.agency(`${pageQuery(1, 100, 'c')}`), open && !clientId);
  const [pick, setPick] = useState('');
  const [what, setWhat] = useState('');
  const [err, setErr] = useState('');
  const id = clientId ?? pick;
  const make = useMutation({
    mutationFn: () => api.agencyInvoiceAdd({ clientId: id, items: [{ description: what.trim() || 'Services', quantity: 1, unitCents: 0 }] }),
    onSuccess: (r) => onMade(r.invoice.id),
    onError: (e: Error) => setErr(e.message),
  });
  return (
    <Sheet open={open} onClose={onClose} title="New invoice">
      <div className="grid gap-sm pb-xl">
        {!clientId && (
          <div>
            <label htmlFor="new-inv-client" className="block text-[14px] font-bold">
              Client
            </label>
            <select id="new-inv-client" value={pick} onChange={(e) => setPick(e.target.value)} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]">
              <option value="">Choose a client</option>
              {clients.data?.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {clients.data && clients.data.clients.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Add a client first, then make an invoice for them.</p>}
          </div>
        )}
        <div>
          <label htmlFor="new-inv-what" className="block text-[14px] font-bold">
            First line
          </label>
          <input id="new-inv-what" value={what} maxLength={200} placeholder="What you are charging for" onChange={(e) => setWhat(e.target.value)} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
        </div>
        <p className="m-0 text-[14px] font-semibold text-ink-soft">It starts from your business details in Settings. You set the amounts in the designer.</p>
        {err && (
          <p role="alert" className="m-0 text-[14px] font-bold">
            {err}
          </p>
        )}
        <Button onClick={() => make.mutate()} disabled={!id || make.isPending}>
          {make.isPending ? 'Making it' : 'Make the invoice'}
        </Button>
      </div>
    </Sheet>
  );
}
