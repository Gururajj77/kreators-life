import {
  AGENCY_DOC_KIND_META,
  AGENCY_DOC_KINDS,
  AGENCY_DOC_STATUS_NAME,
  AGENCY_DOC_STATUS_TONE,
  contractAsText,
  docDate,
  typedCents,
  type AgencyDocKind,
  type AgencyDocListItem,
  type AgencyTemplate,
  type RetainerInput,
} from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, ApiError } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useAuthed } from '../lib/queries';
import { tie } from '../lib/text';
import { useParamState } from '../lib/useParamState';
import { Button } from './Button';
import { DocRowActions } from './DocActions';
import { Field } from './InvoiceView';
import { Pager, usePage } from './Pager';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';

const field = 'mt-xs w-full min-h-[48px] rounded-pill border-2 border-line bg-paper px-sm text-[16px]';

/** One pickable starting point. A house template wears a small badge. */
export function PickCard({ on, onPick, name, blurb, house = false }: { on: boolean; onPick: () => void; name: string; blurb: string; house?: boolean }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onPick} className={`toy w-full rounded-tile border-2 p-sm text-left ${on ? 'border-ink bg-card-strong' : 'toy-soft border-line bg-card'}`}>
      <span className="flex flex-wrap items-center gap-xs">
        <span className="text-[16px] font-extrabold">{tie(name)}</span>
        {house && <StatusTag tone="info">House template</StatusTag>}
      </span>
      <span className="mt-xs block text-[14px] font-semibold text-ink-soft">{blurb}</span>
    </button>
  );
}

/** Start another kind of document: a built-in kind, one of your own templates, or a house template (copied, so the copy is yours to restyle). */
export function NewDocSheet({ open, onClose, clientId, retainer }: { open: boolean; onClose: () => void; clientId?: string; retainer?: Partial<RetainerInput> }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const clients = useAuthed(['agency', 'clients-pick'], () => api.agency('csize=100'), open && !clientId);
  const templates = useAuthed(['agency', 'templates', 'doc'], () => api.agencyTemplates('doc'), open);
  const [pick, setPick] = useState<string>(`kind:${AGENCY_DOC_KINDS[0]}`);
  const [client, setClient] = useState('');
  const [month, setMonth] = useState(todayLocal().slice(0, 7));
  const [fee, setFee] = useState(retainer?.monthlyFeeCents ? String(retainer.monthlyFeeCents / 100) : '');
  const [lines, setLines] = useState((retainer?.deliverables ?? []).join('\n'));
  const [err, setErr] = useState('');
  const own = (templates.data?.templates ?? []).filter((t) => t.scope === 'own');
  const house = (templates.data?.templates ?? []).filter((t) => t.scope === 'house');
  const kind = pick.startsWith('kind:') ? (pick.slice(5) as AgencyDocKind) : null;
  const chosenClient = clientId ?? client;

  const make = useMutation({
    mutationFn: () => {
      const base = { clientId: chosenClient || null };
      if (pick.startsWith('own:')) return api.agencyDocAdd({ ...base, templateId: pick.slice(4) });
      if (pick.startsWith('house:')) return api.agencyDocAdd({ ...base, houseId: pick.slice(6) });
      if (kind === 'monthly_report') return api.agencyDocAdd({ ...base, kind, month });
      if (kind === 'retainer_proposal') {
        const cents = typedCents(fee || '0');
        return api.agencyDocAdd({ ...base, kind, retainer: { ...retainer, monthlyFeeCents: Number.isFinite(cents) && cents > 0 ? cents : 0, deliverables: lines.split('\n').map((l) => l.trim()).filter(Boolean) } });
      }
      return api.agencyDocAdd({ ...base, kind: kind ?? 'brief' });
    },
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ['agency'] });
      onClose();
      nav(`/agency/docs/${r.id}`);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : 'That did not work. Try again.'),
  });
  const needsClient = kind === 'monthly_report' && !chosenClient;

  return (
    <Sheet open={open} onClose={onClose} title="New document">
      <div className="grid gap-sm pb-xl">
        <p className="m-0 text-[14px] font-semibold text-ink-soft">Pick a place to start. Your details and the client's fill in for you, and every part can be changed and restyled.</p>
        {!clientId && (
          <label className="block text-[14px] font-bold" htmlFor="new-doc-client">
            For which client
            <select id="new-doc-client" value={client} onChange={(e) => setClient(e.target.value)} className={field}>
              <option value="">No client yet</option>
              {clients.data?.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <h3 className="m-0 text-[16px]">Built in</h3>
        <ul className="m-0 flex list-none flex-col gap-xs p-0" role="radiogroup" aria-label="Kinds of document">
          {AGENCY_DOC_KINDS.map((k) => (
            <li key={k}>
              <PickCard on={pick === `kind:${k}`} onPick={() => setPick(`kind:${k}`)} name={AGENCY_DOC_KIND_META[k].name} blurb={AGENCY_DOC_KIND_META[k].blurb} />
            </li>
          ))}
        </ul>
        {kind === 'monthly_report' && (
          <div>
            <label htmlFor="new-doc-month" className="block text-[14px] font-bold">
              Which month
            </label>
            <input id="new-doc-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={field} />
            <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">The numbers come from this client's pieces and invoices. Counts and titles only: no fees, no private notes.</p>
          </div>
        )}
        {kind === 'retainer_proposal' && (
          <div className="grid gap-xs">
            <Field id="new-doc-fee" label="Monthly fee" inputMode="decimal" value={fee} onChange={setFee} placeholder="Leave empty to fill in later" />
            <label htmlFor="new-doc-lines" className="block text-[14px] font-bold">
              What is delivered each month, one a line
            </label>
            <textarea id="new-doc-lines" rows={3} value={lines} onChange={(e) => setLines(e.target.value)} maxLength={1200} className="w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
          </div>
        )}
        <h3 className="m-0 text-[16px]">Your templates</h3>
        {own.length === 0 ? (
          <p className="m-0 text-[14px] font-semibold text-ink-soft">None yet. Open any document and tap "Save as template".</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-xs p-0" role="radiogroup" aria-label="Your templates">
            {own.map((t: AgencyTemplate) => (
              <li key={t.id}>
                <PickCard on={pick === `own:${t.id}`} onPick={() => setPick(`own:${t.id}`)} name={t.name} blurb={t.summary} />
              </li>
            ))}
          </ul>
        )}
        <h3 className="m-0 text-[16px]">House templates</h3>
        {house.length === 0 ? (
          <p className="m-0 text-[14px] font-semibold text-ink-soft">No house templates yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-xs p-0" role="radiogroup" aria-label="House templates">
            {house.map((t) => (
              <li key={t.id}>
                <PickCard house on={pick === `house:${t.id}`} onPick={() => setPick(`house:${t.id}`)} name={t.name} blurb={t.summary} />
              </li>
            ))}
          </ul>
        )}
        {needsClient && <p className="m-0 text-[14px] font-bold">A monthly report is for one client. Choose a client first.</p>}
        {err && (
          <p role="alert" className="m-0 text-[14px] font-bold">
            {err}
          </p>
        )}
        <div className="flex flex-wrap gap-xs">
          <Button onClick={() => make.mutate()} disabled={make.isPending || needsClient}>
            {make.isPending ? 'Making it' : 'Start this document'}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

const day = (iso: string) => docDate(iso);

/** The other documents, a page at a time, for every client or one: a kind filter, a row for each with its buttons, and a New document button. */
export function AgencyDocsList({ clientId, retainer }: { clientId?: string; retainer?: Partial<RetainerInput> }) {
  const [kind, setKind] = useParamState('adkind', 'all');
  const pg = usePage('ad');
  const [adding, setAdding] = useState(false);
  const query = `page=${pg.page}&size=${pg.size}${kind !== 'all' ? `&kind=${kind}` : ''}${clientId ? `&client=${clientId}` : ''}`;
  const list = useAuthed(['agency', 'docs', 'list', clientId ?? '', kind, pg.page, pg.size], () => api.agencyDocs(query));
  const text = async (id: string) => {
    const { doc } = await api.agencyDoc(id);
    return contractAsText(doc.doc, { reference: doc.ref, date: doc.sentAt ?? doc.createdAt, answers: doc.answers, acceptance: doc.acceptance });
  };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <div role="group" aria-label="Kind of document" className="scroll-row flex gap-xs">
          {([['all', 'All'], ...AGENCY_DOC_KINDS.map((k) => [k, AGENCY_DOC_KIND_META[k].name] as const)] as const).map(([k, name]) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                pg.reset();
              }}
              className={`toy min-h-[44px] shrink-0 rounded-pill border-2 px-md text-[14px] font-bold ${kind === k ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}
            >
              {name}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          New document
        </Button>
      </div>
      {list.isError && (
        <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
          Could not load the documents. Try again.
        </p>
      )}
      {list.data && list.data.docs.length === 0 && <p className="mt-sm m-0 rounded-tile bg-card p-sm text-[14px] font-semibold text-ink-soft shadow-toy-soft">No documents here yet. Start one from a template.</p>}
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {list.data?.docs.map((d: AgencyDocListItem) => (
          <li key={d.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
            <Link to={`/agency/docs/${d.id}`} className="flex flex-wrap items-center justify-between gap-sm text-ink no-underline">
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-extrabold">{tie(d.title)}</span>
                <span className="block text-[14px] font-semibold text-ink-soft">{[AGENCY_DOC_KIND_META[d.kind]?.name, d.clientName || 'No client yet', d.approvedAt ? `Approved ${day(d.approvedAt)}` : d.sentAt ? `Sent ${day(d.sentAt)}` : `Changed ${day(d.updatedAt)}`].filter(Boolean).join(' · ')}</span>
              </span>
              <StatusTag tone={AGENCY_DOC_STATUS_TONE[d.status]}>{AGENCY_DOC_STATUS_NAME[d.status]}</StatusTag>
            </Link>
            <div className="mt-xs">
              <DocRowActions path={`/agency/docs/${d.id}`} getText={() => text(d.id)} />
            </div>
          </li>
        ))}
      </ul>
      <Pager page={list.data?.page} prefix="ad" label="documents" />
      <NewDocSheet open={adding} onClose={() => setAdding(false)} clientId={clientId} retainer={retainer} />
    </div>
  );
}

/**
 * The Documents area of one client's page: their strategy summary, trial terms, proposals and monthly reports.
 * Mount it on the client page with the client's id. `retainer` is optional: the lifecycle part can pass the real retainer so a proposal
 * starts with its fee and deliverables; without it the person types them.
 */
export function ClientDocs({ clientId, retainer }: { clientId: string; retainer?: Partial<RetainerInput> }) {
  return (
    <section aria-labelledby={`client-docs-${clientId}`}>
      <h2 id={`client-docs-${clientId}`} className="text-[24px]">
        Documents
      </h2>
      <p className="mt-xs m-0 text-balance text-[14px] font-semibold text-ink-soft">A strategy session summary, trial terms, a retainer proposal and a monthly report for this client. Each one prints as a PDF and can be emailed.</p>
      <div className="mt-sm">
        <AgencyDocsList clientId={clientId} retainer={retainer} />
      </div>
    </section>
  );
}
