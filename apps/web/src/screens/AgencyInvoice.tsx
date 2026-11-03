import {
  addDays,
  amountInWords,
  daysBetween,
  docDate,
  GST_RATES_BPS,
  INVOICE_DESIGN_META,
  INVOICE_DESIGNS,
  INVOICE_SHOW_PARTS,
  INVOICE_STATUS_NAME,
  INVOICE_STATUS_TONE,
  INVOICE_TITLES,
  invoiceAsText,
  invoiceForClient,
  invoiceTotals,
  parseDocStyle,
  docStyleSummary,
  MAX_INVOICE_LINES,
  money,
  TDS_MODE_NAME,
  TDS_MODES,
  TDS_RATES_BPS,
  type Invoice,
  type InvoiceDesign,
  type DocStyle,
  type InvoiceDoc,
  type InvoiceItem,
  type InvoiceParty,
  type InvoiceShow,
  type TdsMode,
  typedCents,
} from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, Building2, Check, CopyPlus, LayoutTemplate, MessageSquare, Send, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { BankFields, Chips, Field, FIELD, InvoiceView, LABEL, PartyFields, ShowSwitches, SummaryCard, invoiceDate } from '../components/InvoiceView';
import { Button } from '../components/Button';
import { ConfirmSheet, DocLog, EmailCopySheet, PrintButton, type EmailContext } from '../components/DocActions';
import { DocStyleSheet } from '../components/DocStyleSheet';
import { HouseTemplateSheet, useSuperAdmin } from '../components/HouseTemplateButton';
import { Icon } from '../components/Icon';
import { MoreMenu, type MoreMenuItem } from '../components/MoreMenu';
import { ShareButton, ShareSheet } from '../components/ShareSheet';
import { Busy, Skeleton, SkeletonCard } from '../components/Skeleton';
import { Inert } from '../components/Inert';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { Sheet } from '../components/Sheet';
import { StatusTag } from '../components/StatusTag';
import { Toggle } from '../components/Toggle';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { fileTitle, printAs, useAutoPrint } from '../lib/printDoc';
import { useAuthed } from '../lib/queries';

/** The parts of an invoice that open in their own sheet. */
type Part = 'details' | 'from' | 'to' | 'lines' | 'calc' | 'bank' | 'design' | 'show' | 'activity';

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
  style: DocStyle;
}

const cents = (s: string) => Math.max(0, typedCents(s) || 0);
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
    style: parseDocStyle(d.style),
  };
}
const itemsOf = (f: Form): InvoiceItem[] => f.rows.filter((r) => r.description.trim()).map((r) => ({ description: r.description.trim(), quantity: wholeQty(r.qty), unitCents: cents(r.unit) }));
function docOf(f: Form): InvoiceDoc {
  const value = f.discountMode === 'none' ? 0 : f.discountMode === 'percent' ? Math.min(10000, Math.round((Number.parseFloat(f.discountValue) || 0) * 100)) : cents(f.discountValue);
  return { show: f.show, title: f.title, from: f.from, to: f.to, bank: f.bank, design: f.design, discountMode: f.discountMode, discountValue: value, gstBps: f.gstBps, gstSplit: f.gstSplit, tdsBps: f.tdsBps, tdsMode: f.tdsMode, footnote: f.footnote, footer: f.footer, style: f.style };
}

const TDS_SENTENCE: Record<TdsMode, string> = {
  none: 'No TDS on this invoice.',
  grossup: 'Your client pays the TDS. The extra is added to the total, then the invoice shows the TDS they take off and the amount to pay, so you are paid your price in full. A note about it is printed under the total.',
  show: 'The total stays as it is. The invoice shows what your client may take off.',
};
const GST_OPTIONS = GST_RATES_BPS.map((b) => ({ value: b, name: b === 0 ? 'None' : `${b / 100}%` }));
const TDS_OPTIONS = TDS_RATES_BPS.map((b) => ({ value: b, name: b === 0 ? 'None' : `${b / 100}%` }));

/** The number that follows this one in its own series, as a hint: SSBB-001 gives SSBB-002. The server picks the real one. */
function nextHint(number: string): string {
  const m = /^(.*?)(\d+)$/.exec(number);
  return m ? `${m[1]}${String(Number(m[2]) + 1).padStart((m[2] ?? '').length, '0')}` : '';
}

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
  const [confirm, setConfirm] = useState<'void' | 'remove' | 'unpay' | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [houseOpen, setHouseOpen] = useState(false);
  const superAdmin = useSuperAdmin();
  const [dupOpen, setDupOpen] = useState(false);
  const [part, setPart] = useState<Part | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
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
    onError: (e: Error) => setNote(e.message),
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

  // The saved PDF is the client's version of the page, named "Invoice KR-0007".
  const fileName = fileTitle('Invoice', form?.number || inv?.number);
  const print = () => {
    const wasClient = clientView;
    const restore = () => {
      setClientView(wasClient);
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    flushSync(() => setClientView(true));
    printAs(fileName);
  };
  const [params] = useSearchParams();
  // ?print=1 opens the print window once the invoice has loaded (Download PDF on a list row); ?email=1 opens the email sheet.
  useAutoPrint(Boolean(inv && form), fileName, print);
  useEffect(() => {
    if (inv && params.get('email') === '1') setEmailOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv?.id]);

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
        </header>
        <Busy label="Loading the invoice" className="mt-md grid gap-md">
          <Skeleton className="h-[36px] w-1/3" />
          <Skeleton className="h-[48px] w-2/3" />
          <SkeletonCard lines={5} />
          <SkeletonCard lines={8} />
        </Busy>
      </Screen>
    );
  }

  const setLine = (i: number, patch: Partial<Row>) => set({ rows: form.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const close = () => setPart(null);
  const done = (
    <div className="mt-md">
      <Button onClick={close}>Done</Button>
    </div>
  );
  const shown = INVOICE_SHOW_PARTS.filter((p) => form.show[p.key]).length;
  const bankTail = form.bank.account.replace(/\s/g, '').slice(-4);
  const latest = (comments.data?.comments ?? []).at(-1);
  const gstText = form.gstBps > 0 ? `GST ${form.gstBps / 100}%${form.gstSplit ? ' (CGST and SGST)' : ''}` : 'no GST';
  const tdsText = form.tdsBps > 0 && form.tdsMode !== 'none' ? `TDS ${form.tdsBps / 100}%` : 'no TDS';
  const discountText = totals.discount > 0 ? `, ${money(totals.discount, inv.currency)} off` : '';
  // The words Copy text and Email a copy use: the client's version, so what is switched off is not in them.
  const text = invoiceAsText(clientView ? preview : invoiceForClient(preview), totals);
  const emailCtx: EmailContext = {
    kind: 'invoice',
    clientId: inv.agencyClientId,
    title: inv.doc.title,
    number: inv.number,
    amount: money(totals.total, inv.currency),
    dueBy: inv.dueDate ? invoiceDate(inv.dueDate) : '',
    period: new Date(`${inv.issueDate.slice(0, 7)}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    paid: inv.status === 'paid',
    overdue: inv.status === 'sent' && Boolean(inv.dueDate) && (inv.dueDate ?? '') < todayLocal(),
    advance: /advance/i.test(inv.doc.title),
    ...retainerMonthOf(inv),
  };
  const partyText = (p: InvoiceParty) => (p.name ? (p.line ? `${p.name}, ${p.line}` : p.name) : 'Not filled in yet');

  const clientComments = (comments.data?.comments ?? []);
  // Lines from the client since your last reply: what is waiting for you.
  const lastMine = clientComments.map((c) => c.author).lastIndexOf('me');
  const waiting = clientComments.slice(lastMine + 1).filter((c) => c.author === 'client').length;
  const statusLine: Record<Invoice['status'], string> = {
    draft: 'Not sent yet.',
    sent: 'Your client can see it. A change shows there at once, marked as revised.',
    paid: 'Paid, so the books match it. Mark it as sent again to change it.',
    void: 'Void, kept for the record. Duplicate it to start again.',
  };
  const more: MoreMenuItem[] = [
    { key: 'dup', label: 'Duplicate', icon: CopyPlus, onSelect: () => setDupOpen(true) },
    { key: 'tpl', label: 'Save as template', icon: LayoutTemplate, onSelect: () => setTplOpen(true) },
    ...(superAdmin ? [{ key: 'house', label: 'Save as house template', icon: Building2, onSelect: () => setHouseOpen(true) }] : []),
    { key: 'activity', label: 'Comments and activity', icon: MessageSquare, onSelect: () => setPart('activity') },
    ...(inv.status === 'sent' ? [{ key: 'void', label: 'Void', icon: Ban, destructive: true, onSelect: () => setConfirm('void') }] : []),
    ...(inv.status === 'draft' ? [{ key: 'rm', label: 'Remove draft', icon: Trash2, destructive: true, onSelect: () => setConfirm('remove') }] : []),
    ...(inv.status === 'paid' ? [{ key: 'unpay', label: 'Mark as sent again', icon: Undo2, destructive: true, onSelect: () => setConfirm('unpay') }] : []),
  ];
  const look = `${INVOICE_DESIGN_META[form.design].name} look, ${docStyleSummary(parseDocStyle(form.style))}`;

  return (
    <Screen howTo={false}>
      <header className="no-print pt-lg">
        <BackLink to="/agency?tab=invoices">Invoices</BackLink>
        <div className="flex flex-wrap items-center gap-sm">
          <h1 className="m-0 text-[30px]">{inv.number}</h1>
          <StatusTag tone={INVOICE_STATUS_TONE[inv.status]}>{INVOICE_STATUS_NAME[inv.status]}</StatusTag>
          {inv.revisedAt && <StatusTag tone="warn">{`Revised ${docDate(inv.revisedAt)}`}</StatusTag>}
        </div>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          For <Inert text={inv.clientName} />. {statusLine[inv.status]}
        </p>
        <div className="mt-md flex flex-wrap items-center gap-xs">
          {inv.status === 'draft' && (
            <Button onClick={() => status.mutate('sent')} disabled={status.isPending}>
              <Icon icon={Send} size={18} />
              Send to client
            </Button>
          )}
          {inv.status === 'sent' && (
            <Button onClick={() => status.mutate('paid')} disabled={status.isPending}>
              <Icon icon={Check} size={18} />
              Mark as paid
            </Button>
          )}
          <ShareButton onClick={() => setShareOpen(true)} savedClientId={inv.agencyClientId} hasLink={Boolean(link)} />
          <PrintButton onPrint={print} />
          <MoreMenu items={more} label="More for this invoice" />
        </div>
        {note && (
          <p role="status" className="mt-sm m-0 text-[14px] font-bold">
            {note}
          </p>
        )}
      </header>

      {/* On a laptop the parts come first, then the invoice; on a phone the invoice is what you came to see. */}
      <div className="flex flex-col">
        <div className="no-print order-2 md:order-1">
          <Section id="parts" title="Change a part">
            <h3 className="m-0 mb-xs text-[14px] font-extrabold uppercase tracking-wide text-ink-soft">What it says</h3>
            <ul className="fx-inset" aria-label="What the invoice says">
              <SummaryCard row title="Details" disabled={!editable} onEdit={() => setPart('details')} summary={<>{form.title || 'Invoice'}, {form.number}, {invoiceDate(form.issueDate)}{form.dueDate ? `, due ${invoiceDate(form.dueDate)}` : ''}</>} />
              <SummaryCard row title="From" disabled={!editable} onEdit={() => setPart('from')} summary={<Inert text={partyText(form.from)} />} />
              <SummaryCard row title="Billed to" disabled={!editable} onEdit={() => setPart('to')} summary={<Inert text={partyText(form.to)} />} />
              <SummaryCard row title="Lines" disabled={!editable} onEdit={() => setPart('lines')} summary={`${items.length} ${items.length === 1 ? 'line' : 'lines'}, subtotal ${money(totals.subtotal, inv.currency)}`} />
              <SummaryCard row title="Calculator" disabled={!editable} onEdit={() => setPart('calc')} summary={`${gstText}, ${tdsText}${discountText}, total ${money(totals.total, inv.currency)}`} />
              <SummaryCard row title="Bank details" disabled={!editable} onEdit={() => setPart('bank')} summary={form.bank.bankName || bankTail ? <Inert text={`${form.bank.bankName || 'Bank'}${bankTail ? `, ends ${bankTail}` : ''}`} /> : 'Not filled in yet'} />
            </ul>
            <h3 className="m-0 mt-md mb-xs text-[14px] font-extrabold uppercase tracking-wide text-ink-soft">How it looks and who sees it</h3>
            <ul className="fx-inset" aria-label="How the invoice looks and who sees it">
              <SummaryCard row title="Look" disabled={!editable} onEdit={() => setPart('design')} summary={look} />
              <SummaryCard row title="What the client sees" disabled={!editable} onEdit={() => setPart('show')} summary={`${shown} of ${INVOICE_SHOW_PARTS.length} shown`} />
              <SummaryCard
                row
                title="Comments and activity"
                editLabel="Open"
                onEdit={() => setPart('activity')}
                badge={waiting > 0 ? <StatusTag tone="info">{`${waiting} new`}</StatusTag> : undefined}
                summary={
                  latest ? (
                    <>
                      {clientComments.length} {clientComments.length === 1 ? 'comment' : 'comments'}. Latest: <Inert text={latest.body.length > 70 ? `${latest.body.slice(0, 70)}…` : latest.body} />
                    </>
                  ) : (
                    'No comments yet. Copies you emailed are listed here too.'
                  )
                }
              />
            </ul>
          </Section>
        </div>

        <div className="order-1 md:order-2">
          <Section id="preview" className="legal-host" title="The invoice" lede={clientView ? 'What your client sees. Anything you switched off is missing.' : 'How it looks to you, with the money you will receive.'} action={<span className="no-print"><Toggle compact on={clientView} onChange={setClientView} label="View as client" /></span>}>
            <InvoiceView invoice={preview} totals={totals} owner={!clientView} />
          </Section>
        </div>
      </div>

      {dirty && editable && (
        <div role="status" className="no-print sticky bottom-[calc(var(--spacing-xl)+var(--spacing-sm)+env(safe-area-inset-bottom))] z-30 mt-md mr-xl md:bottom-md md:mr-0">
          <div className="flex flex-wrap items-center justify-between gap-sm rounded-tile border border-line bg-card-strong p-sm shadow-toy-soft">
            <p className="m-0 text-[14px] font-bold">You have changes that are not saved.</p>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? 'Saving' : 'Save changes'}
            </Button>
          </div>
        </div>
      )}

      <Sheet open={part === 'details'} onClose={close} title="Details">
        <div className="grid gap-sm md:grid-cols-2">
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
        {done}
      </Sheet>

      <Sheet open={part === 'from'} onClose={close} title="From">
        <PartyFields idp="from" value={form.from} onChange={(p) => set({ from: p })} nameLabel="Name or brand" lineLabel="Line under the name" lineHint="Prop. Your name for Your brand" />
        {done}
      </Sheet>

      <Sheet open={part === 'to'} onClose={close} title="Billed to">
        <PartyFields idp="to" value={form.to} onChange={(p) => set({ to: p })} nameLabel="Client brand" lineLabel="Legal name" lineHint="The company's full name" />
        {done}
      </Sheet>

      <Sheet open={part === 'lines'} onClose={close} title="Lines">
        <p className="mt-0 mb-sm text-[14px] font-semibold text-ink-soft">What you are charging for. Unit cost is in whole currency, like 7000 or 7000.50.</p>
        <ul className="m-0 flex list-none flex-col gap-sm p-0">
          {form.rows.map((r, i) => {
            const lineTotal = wholeQty(r.qty) * cents(r.unit);
            return (
              <li key={i} className="rounded-tile bg-paper p-sm">
                <label htmlFor={`line-${i}`} className={LABEL}>
                  Description
                </label>
                <input id={`line-${i}`} value={r.description} maxLength={200} onChange={(e) => setLine(i, { description: e.target.value })} className={FIELD} />
                <div className="mt-xs grid grid-cols-2 gap-sm">
                  <Field id={`unit-${i}`} label="Unit cost" inputMode="decimal" value={r.unit} onChange={(v) => setLine(i, { unit: v })} />
                  <Field id={`qty-${i}`} label="Quantity" inputMode="numeric" value={r.qty} onChange={(v) => setLine(i, { qty: v })} />
                </div>
                <div className="mt-xs flex items-center justify-between gap-sm">
                  <p className="m-0 text-[16px] font-extrabold">{money(lineTotal, inv.currency)}</p>
                  {form.rows.length > 1 && (
                    <Button variant="outline" size="sm" onClick={() => set({ rows: form.rows.filter((_, j) => j !== i) })}>
                      Remove line
                    </Button>
                  )}
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
        {done}
      </Sheet>

      <Sheet open={part === 'calc'} onClose={close} title="Calculator">
        <p className="mt-0 mb-sm text-[14px] font-semibold text-ink-soft">Discount, GST and TDS. Every sum is in whole paise, so it adds up to the paisa.</p>
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
              ['TDS adjusted (added)', money(totals.tdsAdjusted, inv.currency)],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-soft">{k}</dt>
              <dd className="m-0 text-right">{v}</dd>
            </div>
          ))}
          <dt className="font-extrabold">Total</dt>
          <dd className="m-0 text-right font-display text-[22px] font-extrabold leading-none">{money(totals.total, inv.currency)}</dd>
          <dt className="text-ink-soft">Less: TDS your client takes off</dt>
          <dd className="m-0 text-right">{money(totals.tdsDeducted, inv.currency)}</dd>
          <dt className="font-extrabold">To pay after TDS</dt>
          <dd className="m-0 text-right font-extrabold">{money(totals.netReceivable, inv.currency)}</dd>
          <dt className="col-span-2 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">Total in words</dt>
          <dd className="col-span-2 m-0 text-[14px] font-extrabold">{amountInWords(totals.total, inv.currency)}</dd>
        </dl>
        {done}
      </Sheet>

      <Sheet open={part === 'bank'} onClose={close} title="Bank details">
        <p className="mt-0 mb-sm text-[14px] font-semibold text-ink-soft">Shown on the invoice so your client knows where to pay. You can hide them under What the client sees.</p>
        <BankFields value={form.bank} onChange={(b) => set({ bank: b })} />
        {done}
      </Sheet>

      <Sheet open={part === 'show'} onClose={close} title="What the client sees">
        <p className="mt-0 mb-sm text-[14px] font-semibold text-ink-soft">A switch for each part. What is off is never sent to your client's browser.</p>
        <ShowSwitches value={form.show} onChange={(s) => set({ show: s })} />
        {done}
      </Sheet>

      <Sheet open={part === 'activity'} onClose={close} title="Comments and activity">
        <p className="mt-0 mb-sm text-[14px] font-semibold text-ink-soft">Your client can write here from their link to ask for a change. Only you see this thread.</p>
        {clientComments.length === 0 && <p className="m-0 text-[14px] font-semibold text-ink-soft">No comments yet.</p>}
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {clientComments.map((c) => (
            <li key={c.id} className={`rounded-tile p-sm ${c.author === 'client' ? 'bg-paper' : 'bg-card-strong'}`}>
              <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">
                {c.author === 'client' ? 'Client' : 'You'}, {docDate(c.createdAt)}
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
        <div className="mt-xs flex flex-wrap gap-xs">
          <Button variant="outline" onClick={() => sendReply.mutate()} disabled={!reply.trim() || sendReply.isPending}>
            Send reply
          </Button>
        </div>
        <h3 className="mt-md mb-xs text-[16px]">Activity</h3>
        <DocLog type="invoice" id={inv.id} />
        {done}
      </Sheet>
      <DocStyleSheet
        open={part === 'design'}
        onClose={close}
        title="Look"
        value={form.style}
        onChange={(style) => set({ style })}
        disabled={!editable}
        before={
          <>
            <div>
              <span className={LABEL}>Design</span>
              <div role="group" aria-label="Design" className="mt-xs grid gap-xs md:grid-cols-2">
                {INVOICE_DESIGNS.map((d) => (
                  <button key={d} type="button" aria-pressed={form.design === d} onClick={() => set({ design: d })} className={`toy rounded-tile border-2 p-sm text-left ${form.design === d ? 'border-ink bg-card-strong' : 'toy-soft border-line bg-card'}`}>
                    <span className="block text-[16px] font-extrabold">{INVOICE_DESIGN_META[d].name}</span>
                    <span className="mt-xs block text-[14px] font-semibold text-ink-soft">{INVOICE_DESIGN_META[d].blurb}</span>
                  </button>
                ))}
              </div>
            </div>
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
          </>
        }
      />
      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} link={link} noLink={inv.status === 'void' ? 'A void invoice has no link.' : 'Send it to your client and a link is made for them.'} clientId={inv.agencyClientId} savedClientId={inv.agencyClientId} clientName={inv.clientName} text={text} email={emailCtx} onEmail={() => setEmailOpen(true)} onPrint={print} />
      <HouseTemplateSheet open={houseOpen} onClose={() => setHouseOpen(false)} kind="invoice" fromId={inv.id} defaultName={inv.doc.title || 'Invoice'} beforeSave={dirty && editable ? () => save.mutateAsync() : undefined} />
      <ConfirmSheet open={confirm === 'void'} onClose={() => setConfirm(null)} title="Void this invoice?" body="It is kept for the record and your client's link shows it as void. You cannot change it after this; duplicate it to start again." action="Void it" onConfirm={() => status.mutate('void')} busy={status.isPending} />
      <ConfirmSheet open={confirm === 'remove'} onClose={() => setConfirm(null)} title="Remove this draft?" body="The draft is deleted. It was never sent, so your client has not seen it." action="Remove the draft" onConfirm={() => remove.mutate()} busy={remove.isPending} />
      <ConfirmSheet open={confirm === 'unpay'} onClose={() => setConfirm(null)} title="Mark as sent again?" body="It stops counting as paid in your books, so you can change it. Mark it as paid again once it is right." action="Mark as sent again" onConfirm={() => status.mutate('sent')} busy={status.isPending} />
      <EmailCopySheet open={emailOpen} onClose={() => setEmailOpen(false)} route="invoices" id={inv.id} defaultTo={inv.clientEmail || inv.doc.to.email} context={emailCtx} noLinkYet={inv.status === 'draft' || inv.status === 'void'} />
      <TemplateSheet open={tplOpen} onClose={() => setTplOpen(false)} inv={inv} dirty={dirty && editable} saveFirst={() => save.mutateAsync()} />
      <DuplicateSheet open={dupOpen} onClose={() => setDupOpen(false)} inv={inv} />
    </Screen>
  );
}

/**
 * Whether this invoice is a retainer month's, read from the line the cron writes ("Content retainer, month 3 of 6 (2026-05)", agencyCycles.ts),
 * so Email a copy opens on the monthly invoice note with the month filled in. Any other invoice gets nothing and opens on the first note.
 */
const RETAINER_LINE = /^Content retainer, month \d+ of \d+ \((\d{4})-(\d{2})\)$/;
function retainerMonthOf(inv: Invoice): { retainerMonth?: true; period?: string } {
  for (const i of inv.items) {
    const m = RETAINER_LINE.exec(i.description.trim());
    if (m) return { retainerMonth: true, period: new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
  }
  return {};
}

/** Copy an invoice for next time: the next number in the series, today's date, the same gap to the due date. */
function DuplicateSheet({ open, onClose, inv }: { open: boolean; onClose: () => void; inv: Invoice }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [issue, setIssue] = useState(todayLocal());
  const [bump, setBump] = useState(true);
  const [err, setErr] = useState('');
  const gap = inv.dueDate ? daysBetween(inv.issueDate, inv.dueDate) : null;
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

/** Keep this invoice as a template: its look, sender, bank, tax and lines, never who it is billed to. The same name replaces what a template holds. */
function TemplateSheet({ open, onClose, inv, dirty, saveFirst }: { open: boolean; onClose: () => void; inv: Invoice; dirty: boolean; saveFirst: () => Promise<unknown> }) {
  const qc = useQueryClient();
  const list = useAuthed(['agency', 'templates', 'invoice'], () => api.agencyTemplates('invoice'), open);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (open) {
      setName(`${inv.doc.title || 'Invoice'}, ${inv.clientName}`.slice(0, 60));
      setMsg('');
    }
    // The suggested name is made each time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const same = (list.data?.templates ?? []).find((t) => t.name.trim().toLowerCase() === name.trim().toLowerCase());
  const keep = useMutation({
    mutationFn: async () => {
      if (dirty) await saveFirst();
      if (same) await api.agencyTemplateUpdate(same.id, { fromId: inv.id });
      else await api.agencyTemplateAdd({ kind: 'invoice', name: name.trim(), fromId: inv.id });
    },
    onSuccess: async () => {
      setMsg(same ? 'The template now holds this invoice.' : 'Saved as a template.');
      await qc.invalidateQueries({ queryKey: ['agency'] });
    },
    onError: (e: Error) => setMsg(e.message),
  });
  return (
    <Sheet open={open} onClose={onClose} title="Save as a template">
      <div className="grid gap-sm pb-xl">
        <p className="m-0 text-[14px] font-semibold text-ink-soft">A template keeps the look, who it is from, the bank, GST, TDS and the lines. It never keeps who it is billed to. Start a new invoice from it any time.</p>
        <Field id="tpl-name" label="Template name" value={name} onChange={setName} max={60} />
        {same && <p className="m-0 text-[14px] font-bold">You already have a template with this name. Saving will replace what it holds.</p>}
        {msg && (
          <p role="status" className="m-0 text-[14px] font-bold">
            {msg}
          </p>
        )}
        <Button onClick={() => keep.mutate()} disabled={!name.trim() || keep.isPending}>
          {keep.isPending ? 'Saving' : same ? 'Replace the template' : 'Save the template'}
        </Button>
      </div>
    </Sheet>
  );
}
