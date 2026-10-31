import {
  amountInWords,
  GST_RATES_BPS,
  INVOICE_DESIGN_META,
  INVOICE_DESIGNS,
  INVOICE_STATUS_NAME,
  INVOICE_STATUS_TONE,
  INVOICE_TITLES,
  invoiceForClient,
  invoiceTotals,
  MAX_INVOICE_LINES,
  money,
  TDS_MODE_NAME,
  TDS_MODES,
  TDS_RATES_BPS,
  type Invoice,
  type InvoiceDesign,
  type InvoiceDoc,
  type InvoiceItem,
  type InvoiceParty,
  type InvoiceShow,
  type TdsMode,
} from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useParams } from 'react-router';
import { BankFields, Chips, Field, FIELD, InvoiceView, LABEL, PartyFields, ShowSwitches, invoiceDate } from '../components/InvoiceView';
import { Button } from '../components/Button';
import { Inert } from '../components/Inert';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { Sheet } from '../components/Sheet';
import { StatusTag } from '../components/StatusTag';
import { Toggle } from '../components/Toggle';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useAuthed } from '../lib/queries';

interface Row {
  description: string;
  unit: string;
  qty: string;
}
interface Form {
  title: string;
  number: string;
  issueDate: string;
  dueDate: string;
  note: string;
  from: InvoiceParty;
  to: InvoiceParty;
  bank: Invoice['doc']['bank'];
  rows: Row[];
  discountMode: InvoiceDoc['discountMode'];
  discountValue: string;
  gstBps: number;
  gstSplit: boolean;
  tdsBps: number;
  tdsMode: TdsMode;
  design: InvoiceDesign;
  show: InvoiceShow;
  footnote: string;
  footer: string;
}

const cents = (s: string) => Math.max(0, Math.round((Number.parseFloat(s) || 0) * 100));
const wholeQty = (s: string) => Math.max(1, Math.round(Number.parseFloat(s) || 1));
const plain = (n: number) => String(Math.round(n * 100) / 100);

function fromInvoice(inv: Invoice): Form {
  const d = inv.doc;
  return {
    title: d.title,
    number: inv.number,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate ?? '',
    note: inv.note,
    from: d.from,
    to: d.to,
    bank: d.bank,
    rows: inv.items.map((i) => ({ description: i.description, unit: plain(i.unitCents / 100), qty: String(i.quantity) })),
    discountMode: d.discountMode,
    discountValue: d.discountMode === 'none' ? '' : d.discountMode === 'percent' ? plain(d.discountValue / 100) : plain(d.discountValue / 100),
    gstBps: d.gstBps,
    gstSplit: d.gstSplit,
    tdsBps: d.tdsBps,
    tdsMode: d.tdsMode,
    design: d.design,
    show: d.show,
    footnote: d.footnote,
    footer: d.footer,
  };
}
const itemsOf = (f: Form): InvoiceItem[] => f.rows.filter((r) => r.description.trim()).map((r) => ({ description: r.description.trim(), quantity: wholeQty(r.qty), unitCents: cents(r.unit) }));
function docOf(f: Form): InvoiceDoc {
  const value = f.discountMode === 'none' ? 0 : f.discountMode === 'percent' ? Math.min(10000, Math.round((Number.parseFloat(f.discountValue) || 0) * 100)) : cents(f.discountValue);
  return { show: f.show, title: f.title, from: f.from, to: f.to, bank: f.bank, design: f.design, discountMode: f.discountMode, discountValue: value, gstBps: f.gstBps, gstSplit: f.gstSplit, tdsBps: f.tdsBps, tdsMode: f.tdsMode, footnote: f.footnote, footer: f.footer };
}

const TDS_SENTENCE: Record<TdsMode, string> = {
  none: 'No TDS on this invoice.',
  grossup: 'The TDS is added to the total, so after your client takes it off you still get the full amount.',
  show: 'The total stays as it is. The invoice shows what your client may take off.',
};
const GST_OPTIONS = GST_RATES_BPS.map((b) => ({ value: b, name: b === 0 ? 'None' : `${b / 100}%` }));
const TDS_OPTIONS = TDS_RATES_BPS.map((b) => ({ value: b, name: b === 0 ? 'None' : `${b / 100}%` }));

/** The number that follows this one in its own series, as a hint: SSBB-001 gives SSBB-002. The server picks the real one. */
function nextHint(number: string): string {
  const m = /^(.*?)(\d+)$/.exec(number);
  return m ? `${m[1]}${String(Number(m[2]) + 1).padStart((m[2] ?? '').length, '0')}` : '';
}
const dayMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const addDays = (iso: string, n: number) => new Date(dayMs(iso) + n * 86_400_000).toISOString().slice(0, 10);

/** The designer and the calculator for one invoice, with the invoice as the client will see it, live beside the form. */
export function AgencyInvoice() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useAuthed(['agency', 'invoice', id], () => api.agencyInvoice(id));
  const inv = q.data?.invoice;
  const [form, setForm] = useState<Form | null>(null);
  const [clientView, setClientView] = useState(false);
  const [note, setNote] = useState('');
  const [copyNote, setCopyNote] = useState('');
  const [sure, setSure] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const stamp = inv ? `${inv.id}:${inv.status}:${inv.revisedAt}:${inv.totalCents}:${inv.number}` : '';
  useEffect(() => {
    if (inv) setForm(fromInvoice(inv));
    // The form follows the saved invoice when it changes under it (a save, a status change); typing in between is kept.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);

  const saved = useMemo(() => (inv ? JSON.stringify(fromInvoice(inv)) : ''), [inv]);
  const dirty = Boolean(form && inv && JSON.stringify(form) !== saved);
  const items = useMemo(() => (form ? itemsOf(form) : []), [form]);
  const doc = useMemo(() => (form ? docOf(form) : null), [form]);
  const totals = useMemo(() => (doc ? invoiceTotals(items, doc) : null), [items, doc]);
  const preview: Invoice | null = useMemo(() => {
    if (!inv || !form || !doc || !totals) return null;
    const p: Invoice = { ...inv, doc, items, number: form.number || inv.number, issueDate: form.issueDate || inv.issueDate, dueDate: form.dueDate || null, note: form.note, totalCents: totals.total };
    return clientView ? invoiceForClient(p) : p;
  }, [inv, form, doc, totals, items, clientView]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['agency'] });
  const save = useMutation({
    mutationFn: async () => {
      if (!form || !doc) return;
      if (items.length === 0) throw new Error('Add at least one line.');
      await api.agencyInvoiceUpdate(id, { items, doc, dueDate: form.dueDate || null, issueDate: form.issueDate || null, note: form.note, number: form.number });
    },
    onSuccess: () => {
      setNote('Saved.');
      return refresh();
    },
    onError: (e: Error) => setNote(e.message),
  });
  const status = useMutation({
    mutationFn: async (next: Invoice['status']) => {
      // Edits are saved first, so the status change goes out with them.
      if (dirty && editable) await save.mutateAsync();
      await api.agencyInvoiceUpdate(id, { status: next });
    },
    onSuccess: () => {
      setNote('');
      return refresh();
    },
    onError: (e: Error) => setNote(e.message),
  });
  const remove = useMutation({
    mutationFn: () => api.agencyInvoiceRemove(id),
    onSuccess: async () => {
      await refresh();
      nav('/agency?tab=invoices', { replace: true });
    },
    onError: (e: Error) => {
      setSure(false);
      setNote(e.message);
    },
  });

  const comments = useAuthed(['agency', 'comments', 'invoice', id], () => api.agencyComments('invoice', id));
  const [reply, setReply] = useState('');
  const sendReply = useMutation({
    mutationFn: () => api.agencyCommentAdd('invoice', id, reply),
    onSuccess: () => {
      setReply('');
      return qc.invalidateQueries({ queryKey: ['agency', 'comments'] });
    },
  });

  const editable = inv ? inv.status === 'draft' || inv.status === 'sent' : false;
  const link = inv && inv.status !== 'draft' ? `${window.location.origin}/i/${inv.token}` : '';
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopyNote('Link copied.');
    } catch {
      setCopyNote(link);
    }
  };
  // The saved PDF is the client's version of the page, named by the invoice number.
  const print = () => {
    const before = document.title;
    const wasClient = clientView;
    const restore = () => {
      document.title = before;
      setClientView(wasClient);
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    flushSync(() => setClientView(true));
    document.title = form?.number || 'Invoice';
    window.print();
  };

  if (q.isError) {
    return (
      <Screen>
        <header className="no-print pt-lg">
          <BackLink to="/agency?tab=invoices">Invoices</BackLink>
          <h1 className="text-[30px]">No invoice here</h1>
          <p role="alert" className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">
            It may have been removed. Go back to the list.
          </p>
        </header>
      </Screen>
    );
  }
  if (!inv || !form || !doc || !totals || !preview) {
    return (
      <Screen>
        <header className="no-print pt-lg">
          <BackLink to="/agency?tab=invoices">Invoices</BackLink>
          <p className="mt-md m-0 text-[16px] font-semibold text-ink-soft">Loading…</p>
        </header>
      </Screen>
    );
  }

  const setLine = (i: number, patch: Partial<Row>) => set({ rows: form.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const card = 'rounded-card bg-card p-md shadow-toy-soft';

  return (
    <Screen howTo={false}>
      <header className="no-print pt-lg">
        <BackLink to="/agency?tab=invoices">Invoices</BackLink>
        <div className="flex flex-wrap items-center gap-sm">
          <h1 className="m-0 text-[30px]">{inv.number}</h1>
          <StatusTag tone={INVOICE_STATUS_TONE[inv.status]}>{INVOICE_STATUS_NAME[inv.status]}</StatusTag>
          {inv.revisedAt && <StatusTag tone="warn">{`Revised ${prettyShort(inv.revisedAt)}`}</StatusTag>}
          {dirty && <StatusTag tone="warn">Not saved yet</StatusTag>}
        </div>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          For <Inert text={inv.clientName} />. Change anything below and the invoice on the right updates as you type.
        </p>
        <div className="mt-md flex flex-wrap gap-xs">
          <Button onClick={() => save.mutate()} disabled={!editable || !dirty || save.isPending}>
            {save.isPending ? 'Saving' : 'Save changes'}
          </Button>
          {inv.status === 'draft' && (
            <Button variant="outline" onClick={() => status.mutate('sent')} disabled={status.isPending}>
              Mark as sent
            </Button>
          )}
          {inv.status === 'sent' && (
            <>
              <Button variant="outline" onClick={() => status.mutate('paid')} disabled={status.isPending}>
                Mark as paid
              </Button>
              <Button variant="outline" onClick={() => status.mutate('void')} disabled={status.isPending}>
                Void
              </Button>
            </>
          )}
          {inv.status === 'paid' && (
            <Button variant="outline" onClick={() => status.mutate('sent')} disabled={status.isPending}>
              Mark as sent again
            </Button>
          )}
          <Button variant="outline" onClick={() => setDupOpen(true)}>
            Duplicate
          </Button>
          <Button variant="outline" onClick={print}>
            Download PDF
          </Button>
          {link && (
            <>
              <Button variant="outline" onClick={copy}>
                Copy client link
              </Button>
              <a href={link} target="_blank" rel="noreferrer" className="toy toy-ink inline-flex min-h-[48px] items-center justify-center rounded-pill border border-ink/30 bg-card-strong px-md text-[16px] font-semibold text-ink">
                Open as the client
              </a>
            </>
          )}
          {inv.status === 'draft' && (
            <Button variant="ghost" onClick={() => (sure ? remove.mutate() : setSure(true))}>
              {sure ? 'Tap again to remove' : 'Remove draft'}
            </Button>
          )}
        </div>
        {!editable && (
          <p className="mt-sm m-0 rounded-tile bg-card p-sm text-[14px] font-bold">
            {inv.status === 'paid' ? 'This invoice is paid, so the books match it. Mark it as sent again to change it.' : 'A void invoice is kept for the record. Duplicate it to start again.'}
          </p>
        )}
        {inv.status === 'sent' && (
          <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Your client can already see this invoice. A change shows there at once, marked as revised.</p>
        )}
        {(note || copyNote) && (
          <p role="status" className="mt-sm m-0 text-[14px] font-bold">
            {note} {copyNote}
          </p>
        )}
      </header>

      <Section id="preview" title="The invoice" lede={clientView ? 'This is what your client sees. Anything you switched off is missing.' : 'This is how it looks to you, with the money you will receive.'} action={<span className="no-print"><Toggle compact on={clientView} onChange={setClientView} label="View as client" /></span>}>
        <InvoiceView invoice={preview} totals={totals} owner={!clientView} />
      </Section>

      <div className="no-print">
        <Section id="details" title="Details">
          <div className={`${card} grid gap-sm md:grid-cols-2`}>
            <div className="min-w-0">
              <label htmlFor="inv-title" className={LABEL}>
                Title
              </label>
              <select id="inv-title" value={(INVOICE_TITLES as readonly string[]).includes(form.title) ? form.title : '__own'} onChange={(e) => set({ title: e.target.value === '__own' ? '' : e.target.value })} className={FIELD}>
                {INVOICE_TITLES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="__own">Write my own</option>
              </select>
              {!(INVOICE_TITLES as readonly string[]).includes(form.title) && <input aria-label="Your own title" value={form.title} maxLength={40} placeholder="Retainer invoice" onChange={(e) => set({ title: e.target.value })} className={FIELD} />}
            </div>
            <Field id="inv-number" label="Invoice number" value={form.number} onChange={(v) => set({ number: v })} max={30} />
            <Field id="inv-issue" label="Date" type="date" value={form.issueDate} onChange={(v) => set({ issueDate: v })} />
            <Field id="inv-due" label="Payment due by" type="date" value={form.dueDate} onChange={(v) => set({ dueDate: v })} />
            <div className="min-w-0 md:col-span-2">
              <label htmlFor="inv-note" className={LABEL}>
                Note to your client
              </label>
              <textarea id="inv-note" rows={2} maxLength={500} value={form.note} onChange={(e) => set({ note: e.target.value })} className={FIELD} />
            </div>
          </div>
        </Section>

        <Section id="from" title="From">
          <div className={card}>
            <PartyFields idp="from" value={form.from} onChange={(p) => set({ from: p })} nameLabel="Name or brand" lineLabel="Line under the name" lineHint="Prop. Your name for Your brand" />
          </div>
        </Section>

        <Section id="to" title="Billed to">
          <div className={card}>
            <PartyFields idp="to" value={form.to} onChange={(p) => set({ to: p })} nameLabel="Client brand" lineLabel="Legal name" lineHint="The company's full name" />
          </div>
        </Section>

        <Section id="lines" title="Lines" lede="What you are charging for. Unit cost is in whole currency, like 7000 or 7000.50.">
          <div className={card}>
            <ul className="m-0 flex list-none flex-col gap-sm p-0">
              {form.rows.map((r, i) => {
                const lineTotal = wholeQty(r.qty) * cents(r.unit);
                return (
                  <li key={i} className="rounded-tile bg-paper p-sm">
                    <label htmlFor={`line-${i}`} className={LABEL}>
                      Description
                    </label>
                    <input id={`line-${i}`} value={r.description} maxLength={200} onChange={(e) => setLine(i, { description: e.target.value })} className={FIELD} />
                    <div className="mt-xs grid grid-cols-2 gap-sm md:grid-cols-[1fr_1fr_auto]">
                      <Field id={`unit-${i}`} label="Unit cost" inputMode="decimal" value={r.unit} onChange={(v) => setLine(i, { unit: v })} />
                      <Field id={`qty-${i}`} label="Quantity" inputMode="numeric" value={r.qty} onChange={(v) => setLine(i, { qty: v })} />
                      <div className="col-span-2 flex items-end justify-between gap-sm md:col-span-1">
                        <p className="m-0 text-[16px] font-extrabold">{money(lineTotal, inv.currency)}</p>
                        {form.rows.length > 1 && (
                          <Button variant="outline" size="sm" onClick={() => set({ rows: form.rows.filter((_, j) => j !== i) })}>
                            Remove line
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {form.rows.length < MAX_INVOICE_LINES && (
              <div className="mt-sm">
                <Button variant="outline" onClick={() => set({ rows: [...form.rows, { description: '', unit: '', qty: '1' }] })}>
                  Add a line
                </Button>
              </div>
            )}
          </div>
        </Section>

        <Section id="calc" title="Calculator" lede="Discount, GST and TDS. Every sum is in whole paise, so it adds up to the paisa.">
          <div className={card}>
            <span className={LABEL}>Discount</span>
            <Chips
              label="Discount"
              value={form.discountMode}
              onChange={(v) => set({ discountMode: v, discountValue: v === 'none' ? '' : form.discountValue })}
              options={[
                { value: 'none', name: 'None' },
                { value: 'flat', name: 'A flat amount' },
                { value: 'percent', name: 'A percent' },
              ]}
            />
            {form.discountMode !== 'none' && <Field id="inv-discount" label={form.discountMode === 'percent' ? 'Percent off' : 'Amount off'} inputMode="decimal" value={form.discountValue} onChange={(v) => set({ discountValue: v })} />}
            <p className="mt-md mb-0 text-[14px] font-bold">GST rate</p>
            <Chips label="GST rate" options={GST_OPTIONS} value={form.gstBps} onChange={(v) => set({ gstBps: v })} />
            {form.gstBps > 0 && (
              <div className="mt-xs">
                <Toggle compact on={form.gstSplit} onChange={(on) => set({ gstSplit: on })} label="Show it as CGST and SGST" />
              </div>
            )}
            <p className="mt-md mb-0 text-[14px] font-bold">TDS rate</p>
            <Chips label="TDS rate" options={TDS_OPTIONS} value={(TDS_RATES_BPS as readonly number[]).includes(form.tdsBps) ? form.tdsBps : -1} onChange={(v) => set({ tdsBps: v })} />
            <div className="mt-xs max-w-[240px]">
              <Field id="inv-tds" label="Or another rate, in percent" inputMode="decimal" value={(TDS_RATES_BPS as readonly number[]).includes(form.tdsBps) ? '' : plain(form.tdsBps / 100)} onChange={(v) => set({ tdsBps: Math.max(0, Math.min(3000, Math.round((Number.parseFloat(v) || 0) * 100))) })} />
            </div>
            <label htmlFor="inv-tdsmode" className={`${LABEL} mt-md`}>
              How to treat TDS
            </label>
            <select id="inv-tdsmode" value={form.tdsMode} onChange={(e) => set({ tdsMode: e.target.value as TdsMode })} className={FIELD}>
              {TDS_MODES.map((m) => (
                <option key={m} value={m}>
                  {TDS_MODE_NAME[m]}
                </option>
              ))}
            </select>
            <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{TDS_SENTENCE[form.tdsMode]}</p>

            <dl className="mt-md grid grid-cols-[1fr_auto] gap-x-md gap-y-xs rounded-tile bg-paper p-sm text-[14px] font-semibold" aria-label="Results">
              {(
                [
                  ['Subtotal', money(totals.subtotal, inv.currency)],
                  ['Discount', `-${money(totals.discount, inv.currency)}`],
                  ['Taxable amount', money(totals.taxable, inv.currency)],
                  ['GST', money(totals.gst, inv.currency)],
                  ['TDS added to the total', money(totals.tdsAdjusted, inv.currency)],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-ink-soft">{k}</dt>
                  <dd className="m-0 text-right">{v}</dd>
                </div>
              ))}
              <dt className="font-extrabold">Total</dt>
              <dd className="m-0 text-right font-display text-[22px] font-extrabold leading-none">{money(totals.total, inv.currency)}</dd>
              <dt className="text-ink-soft">TDS your client will take off</dt>
              <dd className="m-0 text-right">{money(totals.tdsDeducted, inv.currency)}</dd>
              <dt className="font-extrabold">You receive</dt>
              <dd className="m-0 text-right font-extrabold">{money(totals.netReceivable, inv.currency)}</dd>
              <dt className="col-span-2 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">Total in words</dt>
              <dd className="col-span-2 m-0 text-[14px] font-extrabold">{amountInWords(totals.total, inv.currency)}</dd>
            </dl>
          </div>
        </Section>

        <Section id="bank" title="Bank details" lede="Shown on the invoice so your client knows where to pay. You can hide them below.">
          <div className={card}>
            <BankFields value={form.bank} onChange={(b) => set({ bank: b })} />
          </div>
        </Section>

        <Section id="design" title="Design" lede="Pick a look. The colours follow your theme.">
          <div role="group" aria-label="Design" className="grid gap-xs md:grid-cols-4">
            {INVOICE_DESIGNS.map((d) => (
              <button key={d} type="button" aria-pressed={form.design === d} onClick={() => set({ design: d })} className={`toy rounded-tile border-2 p-sm text-left ${form.design === d ? 'border-ink bg-card-strong' : 'toy-soft border-line bg-card'}`}>
                <span className="block text-[16px] font-extrabold">{INVOICE_DESIGN_META[d].name}</span>
                <span className="mt-xs block text-[14px] font-semibold text-ink-soft">{INVOICE_DESIGN_META[d].blurb}</span>
              </button>
            ))}
          </div>
          <div className={`${card} mt-sm grid gap-sm`}>
            <div>
              <label htmlFor="inv-footnote" className={LABEL}>
                Line under the totals
              </label>
              <textarea id="inv-footnote" rows={2} maxLength={300} value={form.footnote} onChange={(e) => set({ footnote: e.target.value })} className={FIELD} />
            </div>
            <div>
              <label htmlFor="inv-footer" className={LABEL}>
                Line at the foot of the page
              </label>
              <textarea id="inv-footer" rows={2} maxLength={300} value={form.footer} onChange={(e) => set({ footer: e.target.value })} className={FIELD} />
            </div>
          </div>
        </Section>

        <Section id="shows" title="What the client sees" lede="A switch for each part. What is off is never sent to your client's browser.">
          <ShowSwitches value={form.show} onChange={(s) => set({ show: s })} />
        </Section>

        <Section id="comments" title="Comments" lede="Your client can write here from their link to ask for a change. Only you see this thread.">
          <div className={card}>
            {(comments.data?.comments ?? []).length === 0 && <p className="m-0 text-[14px] font-semibold text-ink-soft">Nothing yet.</p>}
            <ul className="m-0 flex list-none flex-col gap-xs p-0">
              {(comments.data?.comments ?? []).map((c) => (
                <li key={c.id} className={`rounded-tile p-sm ${c.author === 'client' ? 'bg-paper' : 'bg-card-strong'}`}>
                  <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">
                    {c.author === 'client' ? 'Client' : 'You'}, {prettyShort(c.createdAt)}
                  </p>
                  <p className="m-0 whitespace-pre-wrap text-[14px] font-semibold">
                    <Inert text={c.body} />
                  </p>
                </li>
              ))}
            </ul>
            <label htmlFor="inv-reply" className={`${LABEL} mt-sm`}>
              Reply
            </label>
            <textarea id="inv-reply" rows={2} maxLength={600} value={reply} onChange={(e) => setReply(e.target.value)} className={FIELD} />
            <div className="mt-xs">
              <Button variant="outline" onClick={() => sendReply.mutate()} disabled={!reply.trim() || sendReply.isPending}>
                Send reply
              </Button>
            </div>
          </div>
        </Section>
      </div>

      <DuplicateSheet open={dupOpen} onClose={() => setDupOpen(false)} inv={inv} />
    </Screen>
  );
}

function prettyShort(iso: string): string {
  return invoiceDate(iso.slice(0, 10));
}

/** Copy an invoice for next time: the next number in the series, today's date, the same gap to the due date. */
function DuplicateSheet({ open, onClose, inv }: { open: boolean; onClose: () => void; inv: Invoice }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [issue, setIssue] = useState(todayLocal());
  const [bump, setBump] = useState(true);
  const [err, setErr] = useState('');
  const gap = inv.dueDate ? Math.round((dayMs(inv.dueDate) - dayMs(inv.issueDate)) / 86_400_000) : null;
  const make = useMutation({
    mutationFn: () => api.agencyInvoiceDuplicate(inv.id, { issueDate: issue, bumpMonths: bump }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ['agency'] });
      onClose();
      nav(`/agency/invoices/${r.invoice.id}`);
    },
    onError: (e: Error) => setErr(e.message),
  });
  return (
    <Sheet open={open} onClose={onClose} title="Duplicate this invoice">
      <div className="grid gap-sm pb-xl">
        <p className="m-0 text-[14px] font-semibold text-ink-soft">The copy is a draft with the same lines, design and details.</p>
        <Field id="dup-issue" label="Date for the copy" type="date" value={issue} onChange={setIssue} />
        <p className="m-0 text-[14px] font-semibold">
          Number: {nextHint(inv.number) || 'the next free one'}
          <br />
          {gap !== null && issue ? `Due by ${invoiceDate(addDays(issue, gap))}, the same ${gap} days after it.` : 'No due date on the original.'}
        </p>
        <Toggle on={bump} onChange={setBump} label="Move months in the lines on" hint="A line like “Retainer, 2026-09” becomes the new month." />
        {err && (
          <p role="alert" className="m-0 text-[14px] font-bold">
            {err}
          </p>
        )}
        <Button onClick={() => make.mutate()} disabled={!issue || make.isPending}>
          {make.isPending ? 'Making the copy' : 'Make the copy'}
        </Button>
      </div>
    </Sheet>
  );
}
