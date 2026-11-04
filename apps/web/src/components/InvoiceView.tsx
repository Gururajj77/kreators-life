import {
  amountInWords,
  GST_RATES_BPS,
  INVOICE_QTY_LABELS,
  INVOICE_SHOW_PARTS,
  INVOICE_TITLES,
  invoiceFootnote,
  invoiceMoney,
  invoiceQty,
  invoiceTotals,
  MAX_INVOICE_LINES,
  packageInvoiceLine,
  phoneDisplay,
  TDS_MODE_NAME,
  TDS_MODES,
  TDS_RATES_BPS,
  typedCents,
  type BankDetails,
  type BusinessProfile,
  type Invoice,
  type InvoiceDesign,
  type InvoiceDoc,
  type InvoiceItem,
  type InvoiceParty,
  type InvoiceQtyLabel,
  type InvoiceShow,
  type InvoiceTotals,
  type TdsMode,
} from '@kreators/shared';
import { ArrowDown, ArrowUp, ChevronRight, GripVertical, Package, Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { invoiceStamp, PrintSheet } from './PrintSheet';
import { Sheet } from './Sheet';
import { Toggle } from './Toggle';
import { FIELD, LABEL } from '../lib/ui';
export { FIELD, LABEL } from '../lib/ui';

/**
 * What each look wears. Theme tokens for the older looks (a bar that holds text has its own text token so dark mode keeps it readable);
 * Founder classic reads paper colours from CSS variables set by its key in app.css (`.legal-invoice[data-design='founder']`).
 */
interface Look {
  bar: string;
  barText: string;
  head: string;
  headText: string;
  row: string;
  sum: string;
  words: string;
  bank: string;
  box: string;
  title: string;
}
const LOOK: Record<InvoiceDesign, Look> = {
  founder: { bar: 'var(--inv-bar)', barText: 'var(--inv-bar-text)', head: 'var(--inv-head)', headText: 'var(--inv-head-text)', row: 'var(--inv-row)', sum: 'var(--inv-sum)', words: 'var(--inv-words)', bank: 'var(--inv-bank)', box: 'var(--inv-box)', title: 'var(--inv-title)' },
  classic: { bar: 'var(--color-ink)', barText: 'var(--color-on-ink)', head: 'var(--color-r5)', headText: 'var(--color-on-fill)', row: 'var(--tint-sky)', sum: 'var(--tint-green)', words: 'var(--tint-sky)', bank: 'transparent', box: 'var(--tint-sky)', title: 'var(--color-ink-soft)' },
  teal: { bar: 'var(--color-r5)', barText: 'var(--color-on-fill)', head: 'var(--color-r4)', headText: 'var(--color-on-fill)', row: 'var(--tint-sky)', sum: 'var(--tint-sky)', words: 'var(--tint-green)', bank: 'transparent', box: 'var(--tint-sky)', title: 'var(--color-ink-soft)' },
  warm: { bar: 'var(--color-earth)', barText: 'var(--color-on-fill)', head: 'var(--color-r2)', headText: 'var(--color-on-fill)', row: 'var(--tint-orange)', sum: 'var(--tint-orange)', words: 'var(--tint-yellow)', bank: 'transparent', box: 'var(--tint-orange)', title: 'var(--color-ink-soft)' },
  mono: { bar: 'var(--color-ink)', barText: 'var(--color-on-ink)', head: 'var(--color-ink)', headText: 'var(--color-on-ink)', row: 'transparent', sum: 'transparent', words: 'transparent', bank: 'transparent', box: 'transparent', title: 'var(--color-ink)' },
};

/** 22/09/2026 the way the sample invoice writes a date. */
export function invoiceDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const lines = (...parts: (string | undefined)[]) => parts.filter((p): p is string => Boolean(p && p.trim()));

/** What the paper can change when the owner edits it in place. Every change goes straight to the draft; the page saves it by itself. */
export interface InvoiceEditor {
  setDoc: (patch: Partial<InvoiceDoc>) => void;
  setMeta: (patch: Partial<{ number: string; issueDate: string; dueDate: string; note: string }>) => void;
  setItems: (items: InvoiceItem[]) => void;
  /** The owner's profile, for "From a package". */
  profile?: BusinessProfile | null;
}

/**
 * A piece of the paper you can type in: an input (or a textarea for more than one line) drawn as the printed text, with a label for a
 * screen reader. Plain text only; nothing typed is ever read as markup.
 */
export function PaperText({ value, onChange, label, placeholder, multiline = false, max = 200, className = '', onKeyDown, type = 'text', id }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string; multiline?: boolean; max?: number; className?: string; onKeyDown?: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void; type?: string; id?: string }) {
  if (multiline) {
    return <textarea id={id} aria-label={label} value={value} placeholder={placeholder} maxLength={max} rows={Math.max(1, value.split('\n').length)} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} className={`inv-edit ${className}`} />;
  }
  return <input id={id} type={type} aria-label={label} value={value} placeholder={placeholder} maxLength={max} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} className={`inv-edit ${className}`} />;
}

/**
 * The owner's own words on their own paper, set in the paper's face. React text is never a link, so a name like "SHOP.IN" or an email
 * reads the way the founder's invoice prints it, not in the code face `Inert` gives addresses in what people write to each other.
 */
function Plain({ text }: { text: string }) {
  return <>{text}</>;
}

// `tight`: the founder's invoice sets the Billed To lines close together (about 1.25), the sender's lines open (relaxed).
function Party({ p, tight = false }: { p: InvoiceParty; tight?: boolean }) {
  const rows = lines(...p.taxIds.map((t) => `${t.label}: ${t.value}`), ...p.address.split('\n'), p.email);
  return (
    <div className={`text-[14px] font-normal ${tight ? 'leading-snug' : 'leading-relaxed'}`}>
      {rows.map((r, i) => (
        <p key={i} className="m-0">
          <Plain text={r} />
        </p>
      ))}
      {p.phone && (
        <p className="m-0 mt-xs">
          <Plain text={phoneDisplay(p.phone)} />
        </p>
      )}
    </div>
  );
}

/** One side's details, typed on the paper: tax numbers (a blank one waits at the end), the address, the email and the phone. */
function PartyEdit({ p, onChange, who, taxHint, tight = false }: { p: InvoiceParty; onChange: (p: InvoiceParty) => void; who: string; taxHint: string; tight?: boolean }) {
  const set = (patch: Partial<InvoiceParty>) => onChange({ ...p, ...patch });
  // The blank row waiting at the end names the usual number only while that one is not there yet ("PAN" twice reads as a mistake).
  const hint = p.taxIds.some((t) => t.label.trim().toUpperCase() === taxHint.toUpperCase()) ? '' : taxHint;
  const taxRows = p.taxIds.length < 4 ? [...p.taxIds, { label: hint, value: '' }] : p.taxIds;
  const setTax = (i: number, patch: Partial<{ label: string; value: string }>) => set({ taxIds: taxRows.map((t, j) => (j === i ? { ...t, ...patch } : t)).filter((t, j) => t.value.trim() || j === i) });
  return (
    <div className={`text-[14px] font-normal ${tight ? 'leading-snug' : 'leading-relaxed'}`}>
      {taxRows.map((t, i) => (
        // The blank row waiting at the end is for typing on screen; the printed paper never carries it.
        // On paper the name sits close to its colon, "PAN: ABCDE1234F", like the founder's invoice (`.inv-tax-k` in app.css).
        <div key={i} className={`flex items-baseline ${i === p.taxIds.length ? 'no-print' : ''}`}>
          <PaperText value={t.label} onChange={(v) => setTax(i, { label: v })} label={`${who} tax number name`} placeholder={i === p.taxIds.length ? 'Name' : undefined} max={20} className="inv-tax-k w-[64px] shrink-0" />
          <span aria-hidden="true" className="whitespace-pre">{': '}</span>
          <PaperText value={t.value} onChange={(v) => setTax(i, { value: v })} label={`${who} ${t.label || 'tax number'}`} placeholder={i === p.taxIds.length ? 'Add a number' : undefined} max={40} />
        </div>
      ))}
      <PaperText multiline value={p.address} onChange={(v) => set({ address: v })} label={`${who} address`} placeholder="Address" max={300} />
      <PaperText type="email" value={p.email} onChange={(v) => set({ email: v })} label={`${who} email`} placeholder="Email" max={120} />
      <PhoneText value={p.phone} onChange={(v) => set({ phone: v })} label={`${who} phone`} />
    </div>
  );
}

/**
 * A phone typed on the paper: read the Indian way ("+91 77421 14087", `phoneDisplay`) until it is picked, then exactly as kept, so the
 * stored number only changes when the person types.
 */
function PhoneText({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [typing, setTyping] = useState(false);
  return <input aria-label={label} value={typing ? value : phoneDisplay(value)} placeholder="Phone" maxLength={40} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} onChange={(e) => onChange(e.target.value)} className="inv-edit mt-xs" />;
}

const pct = (bps: number) => `${bps / 100}%`;

/**
 * The total's size, measured against the founder's invoice: half as big again as the 14px text (22px) for "₹35,000.00", a step smaller
 * for a lakh and smaller again for a crore, so the total never breaks and its label keeps one line beside it.
 */
function totalSize(shown: string): string {
  if (shown.length <= 10) return 'text-[22px]';
  if (shown.length <= 13) return 'text-[20px]';
  return 'text-[18px]';
}

/**
 * An invoice drawn the way the person designed it, laid out like the founder's own (the sender and the client, the lines, the bank, the
 * sums, the total in words, the footnote and a two-line footer). What the person switched off is simply missing from the data (the server
 * removes it). With `editor` the owner types straight on the paper: every name, line, date, cell, bank detail, the footnote and the footer;
 * the sums stay worked out. Lines marked no-print stay on screen only, and the client view and the print never carry a field.
 */
/** `owner` is kept on the type for the callers that pass it; the invoice reads the same to the owner and the client. */
export function InvoiceView({ invoice, totals, editor }: { invoice: Invoice; totals?: InvoiceTotals; owner?: boolean; editor?: InvoiceEditor | null }) {
  const doc = invoice.doc;
  const t = totals ?? invoiceTotals(invoice.items, doc);
  const look = LOOK[doc.design] ?? LOOK.classic;
  const cur = invoice.currency;
  const m = (c: number) => invoiceMoney(c, cur);
  const ed = editor ?? null;
  const [menu, setMenu] = useState<number | null>(null);
  const baseId = useId();
  const fromName = doc.from.name || invoice.ownerName;
  const toName = doc.to.name || invoice.clientName;
  const qtyLabel: InvoiceQtyLabel = doc.qtyLabel ?? 'Qty';
  const bankRows: [keyof BankDetails, string][] = [
    ['bankName', 'Bank Name'],
    ['holder', 'Account holder'],
    ['account', 'Account number'],
    ['ifsc', 'IFSC code'],
    ['upi', 'UPI Details'],
  ];
  const bankShown = bankRows.filter(([k]) => doc.bank[k].trim());
  const sums: [string, string][] = [['Subtotal', m(t.subtotal)]];
  if (t.discount > 0) sums.push([doc.discountMode === 'percent' ? `Discount (${pct(doc.discountValue)})` : 'Discount', `-${m(t.discount)}`]);
  if (t.gst > 0 || doc.gstBps > 0) {
    if (doc.gstSplit) {
      sums.push([`CGST (${doc.gstBps / 200}%)`, m(t.cgst)]);
      sums.push([`SGST (${doc.gstBps / 200}%)`, m(t.sgst)]);
    } else sums.push([`${cur === 'INR' ? 'IGST' : 'GST'} (${pct(doc.gstBps)})`, m(t.gst)]); // one rate, not split: IGST, for a client in another state
  }
  // The founder's invoice keeps this row whenever the client bears the TDS, even at zero.
  if (doc.tdsMode === 'grossup') sums.push(['TDS adjusted', m(t.tdsAdjusted)]);
  const notes = invoiceFootnote(doc);
  const tdsLine = doc.tdsMode === 'grossup' ? notes[0] : undefined;
  const ownFoot = doc.tdsMode === 'grossup' ? (notes[1] ?? '') : (notes[0] ?? '');
  const items = invoice.items;
  const setItem = (i: number, patch: Partial<InvoiceItem>) => ed?.setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const addAfter = (i: number, item: InvoiceItem = { description: '', quantity: 1, unitCents: 0 }) => {
    if (!ed || items.length >= MAX_INVOICE_LINES) return;
    ed.setItems([...items.slice(0, i + 1), item, ...items.slice(i + 1)]);
    // The new line's description takes the caret once it is drawn.
    window.setTimeout(() => document.getElementById(`${baseId}-d${i + 1}`)?.focus(), 0);
  };
  const removeAt = (i: number) => {
    if (!ed || items.length <= 1) return;
    ed.setItems(items.filter((_, j) => j !== i));
    window.setTimeout(() => document.getElementById(`${baseId}-d${Math.max(0, i - 1)}`)?.focus(), 0);
  };
  const moveTo = (i: number, to: number) => {
    if (!ed || to < 0 || to >= items.length) return;
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(to, 0, x!);
    ed.setItems(next);
  };
  const packages = ed?.profile?.packages.rows ?? [];
  const cell = 'px-xs py-sm sm:px-sm';
  const sumK = 'inv-sum-k whitespace-nowrap text-right text-[12px] font-extrabold uppercase tracking-wide text-ink-soft';
  const sumV = 'inv-sum-v m-0 whitespace-nowrap text-right text-ink-soft';
  const meta: { key: 'issueDate' | 'number' | 'dueDate'; label: string; value: string; show: boolean }[] = [
    { key: 'issueDate', label: 'Date', value: invoice.issueDate, show: true },
    { key: 'number', label: 'Invoice #', value: invoice.number, show: true },
    { key: 'dueDate', label: 'Payment due by', value: invoice.dueDate ?? '', show: Boolean(invoice.dueDate) || Boolean(ed) },
  ];

  return (
    <PrintSheet kind="invoice" title={doc.title || 'Invoice'} reference={invoice.number} date={invoice.issueDate} style={doc.style} stamp={invoiceStamp(invoice)} titleBlock={false} letterhead={{ name: '', lines: [] }}>
      <div className="legal-invoice" data-design={doc.design}>
        <div className="grid gap-md md:grid-cols-2 md:gap-lg">
          <div className="min-w-0">
            <h2 className="m-0 break-words font-display text-[30px] font-extrabold leading-tight">{ed ? <PaperText value={doc.from.name} onChange={(v) => ed.setDoc({ from: { ...doc.from, name: v } })} label="Your brand name" placeholder={invoice.ownerName || 'Your brand'} max={120} /> : <Plain text={fromName} />}</h2>
            {(doc.from.line || ed) && (
              <p className="mt-xs mb-xs m-0 px-sm text-[14px] font-extrabold leading-[32px]" style={{ background: look.bar, color: look.barText }}>
                {ed ? <PaperText value={doc.from.line} onChange={(v) => ed.setDoc({ from: { ...doc.from, line: v } })} label="Line under your name" placeholder="Prop. Your name for Your business" max={160} /> : <Plain text={doc.from.line} />}
              </p>
            )}
            {ed ? <PartyEdit p={doc.from} onChange={(from) => ed.setDoc({ from })} who="Your" taxHint="PAN" /> : <Party p={doc.from} />}
          </div>
          <div className="min-w-0">
            <h2 className="m-0 break-words font-display text-[24px] font-extrabold leading-tight" style={{ color: look.title }}>
              {ed ? (
<PaperText value={doc.title} onChange={(v) => ed.setDoc({ title: v })} label="Invoice title" placeholder="Invoice" max={40} />
              ) : (
                <Plain text={doc.title} />
              )}
            </h2>
            {ed && (
              <select aria-label="Pick a title" value="" onChange={(e) => e.target.value && ed.setDoc({ title: e.target.value })} className="inv-edit no-print mt-xs w-auto text-[12px] font-bold text-ink-soft">
                <option value="">Pick a title</option>
                {INVOICE_TITLES.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            )}
            <dl className="mt-xs mb-sm grid grid-cols-[auto_1fr] gap-x-md gap-y-xs text-[14px] font-normal">
              {meta
                .filter((x) => x.show && (x.value || ed))
                .map((x) => (
                  <div key={x.key} className="contents">
                    <dt className="leading-[28px]">{x.label}:</dt>
                    <dd className="m-0 px-sm leading-[28px]" style={{ background: look.box }}>
                      {ed ? x.key === 'number' ? <PaperText value={x.value} onChange={(v) => ed.setMeta({ number: v })} label="Invoice number" max={30} /> : <input type="date" aria-label={x.label} value={x.value} onChange={(e) => ed.setMeta({ [x.key]: e.target.value })} className="inv-edit" /> : x.key === 'number' ? x.value : invoiceDate(x.value)}
                    </dd>
                  </div>
                ))}
            </dl>
            <p className="m-0 mb-xs flex px-sm text-[14px] font-extrabold leading-[32px]" style={{ background: look.bar, color: look.barText }}>
              <span className="shrink-0 whitespace-pre">{'Billed To: '}</span>
              {ed ? <PaperText value={doc.to.name} onChange={(v) => ed.setDoc({ to: { ...doc.to, name: v } })} label="Client brand" placeholder={invoice.clientName || 'Client'} max={120} /> : <Plain text={toName} />}
            </p>
            {ed ? (
              <>
                <PaperText value={doc.to.line} onChange={(v) => ed.setDoc({ to: { ...doc.to, line: v } })} label="Client legal name" placeholder="Legal name" max={160} className="text-[14px]" />
                <PartyEdit p={doc.to} onChange={(to) => ed.setDoc({ to })} who="Client" taxHint="GSTIN" tight={doc.design === 'founder'} />
              </>
            ) : (
              <>
                {doc.to.line && (
                  <p className="m-0 text-[14px] font-normal">
                    <Plain text={doc.to.line} />
                  </p>
                )}
                <Party p={doc.to} tight={doc.design === 'founder'} />
              </>
            )}
          </div>
        </div>

        <div className="mt-md overflow-x-auto">
          <table className="w-full border-collapse text-[14px] font-normal">
            {/* The founder's column shares: the description wide, then three money and count columns, each right-aligned at its edge. */}
            <colgroup>
              <col className="w-[38%]" />
              <col className="w-[22%]" />
              <col className="w-[20%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead>
              <tr style={{ background: look.bar, color: look.barText }}>
                <th className="px-xs py-xs text-left font-extrabold sm:px-sm">Description</th>
                <th className="whitespace-nowrap px-xs py-xs text-right font-extrabold sm:px-sm">Unit cost</th>
                <th className="whitespace-nowrap px-xs py-xs text-right font-extrabold sm:px-sm">
                  {ed ? (
                    <select aria-label="Name of the quantity column" value={qtyLabel} onChange={(e) => ed.setDoc({ qtyLabel: e.target.value as InvoiceQtyLabel })} className="inv-edit no-print ml-auto w-auto text-right font-extrabold">
                      {INVOICE_QTY_LABELS.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  ) : (
                    qtyLabel
                  )}
                  {/* A select cannot right-align its own words, so the paper prints the column's name as text. */}
                  {ed && <span className="hidden print:inline">{qtyLabel}</span>}
                </th>
                <th className="whitespace-nowrap px-xs py-xs text-right font-extrabold sm:px-sm">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="inv-line" style={{ background: doc.design === 'founder' || i % 2 === 0 ? look.row : 'transparent' }}>
                  <td className={cell}>
                    {ed ? (
                      <div className="flex items-center gap-xs">
                        <button type="button" aria-label={`Line ${i + 1}: move, add or remove`} onClick={() => setMenu(i)} className="inv-handle no-print toy toy-soft min-h-[32px] min-w-[32px] shrink-0 items-center justify-center rounded-pill text-ink-mute">
                          <Icon icon={GripVertical} size={16} />
                        </button>
                        {/* A text area, so a long line wraps inside its column on screen and on paper instead of pushing the amounts off it. */}
                        <PaperText
                          multiline
                          id={`${baseId}-d${i}`}
                          value={it.description}
                          onChange={(v) => setItem(i, { description: v })}
                          label={`Line ${i + 1} description`}
                          placeholder="What it is for"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addAfter(i);
                            } else if (e.key === 'Backspace' && !it.description && items.length > 1) {
                              e.preventDefault();
                              removeAt(i);
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <Plain text={it.description} />
                    )}
                  </td>
                  <td className={`whitespace-nowrap text-right ${cell}`}>{ed ? <MoneyCell cents={it.unitCents} currency={cur} onChange={(c) => setItem(i, { unitCents: c })} label={`Line ${i + 1} unit cost`} /> : m(it.unitCents)}</td>
                  <td className={`whitespace-nowrap text-right ${cell}`}>{ed ? <QtyCell qty={it.quantity} pad={doc.qtyPad === true} onChange={(q) => setItem(i, { quantity: q })} label={`Line ${i + 1} ${qtyLabel}`} /> : invoiceQty(it.quantity, doc.qtyPad)}</td>
                  <td className={`whitespace-nowrap text-right ${cell}`}>{m(it.quantity * it.unitCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bank and sums share the width the way the founder's invoice does (three to two); the sums only take more when a row's label
            and the total would not otherwise sit on one line ("TDS to deduct (10%)"). */}
        <div className="grid md:grid-cols-[minmax(0,3fr)_minmax(max-content,2fr)]">
          {bankShown.length > 0 || ed ? (
            <div className="flex min-w-0 flex-col" style={{ background: look.bank, border: doc.design === 'founder' ? undefined : '1px solid var(--color-line)' }}>
              <p className="m-0 px-sm py-sm text-[14px] font-extrabold uppercase leading-[32px]" style={{ background: look.head, color: look.headText }}>
                Bank account details
              </p>
              <div className="flex-1 p-sm text-[14px] font-normal leading-relaxed">
                {ed
                  ? bankRows.map(([k, label]) => (
                      <div key={k} className="flex items-baseline">
                        <span className="shrink-0 whitespace-pre">{`${label}: `}</span>
                        <PaperText value={doc.bank[k]} onChange={(v) => ed.setDoc({ bank: { ...doc.bank, [k]: k === 'ifsc' ? v.toUpperCase() : v } })} label={label} placeholder="Add" max={80} />
                      </div>
                    ))
                  : bankShown.map(([k, label]) => (
                      <p key={k} className="m-0">
                        {label}: <Plain text={doc.bank[k]} />
                      </p>
                    ))}
              </div>
            </div>
          ) : (
            <div />
          )}
          <div className="min-w-0 p-sm" style={{ background: look.sum, border: doc.design === 'mono' ? '1px solid var(--color-line)' : undefined }}>
            <dl className="m-0 grid grid-cols-[1fr_auto] items-baseline gap-x-md gap-y-sm text-[14px] font-normal">
              {sums.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className={sumK}>{k}</dt>
                  <dd className={sumV}>{v}</dd>
                </div>
              ))}
              <dt className={`${sumK} mt-sm`}>Total</dt>
              <dd className={`inv-sum-v m-0 mt-sm whitespace-nowrap text-right font-normal leading-none ${totalSize(m(t.total))}`}>{m(t.total)}</dd>
              {(doc.tdsMode === 'show' || doc.tdsMode === 'grossup') && t.tdsDeducted > 0 && (
                <>
                  <dt className={`${sumK} mt-sm`}>TDS to deduct ({pct(doc.tdsBps)})</dt>
                  <dd className={`${sumV} mt-sm`}>-{m(t.tdsDeducted)}</dd>
                  <dt className={sumK}>To pay after TDS</dt>
                  <dd className="inv-sum-v m-0 text-right font-extrabold">{m(t.netReceivable)}</dd>
                </>
              )}
            </dl>
            {ed && <SumControls doc={doc} onChange={ed.setDoc} currency={cur} />}
          </div>
        </div>

        {doc.show.words && (
          <p className="m-0 px-sm py-md text-[14px] font-extrabold uppercase leading-snug" style={{ background: look.words, border: doc.design === 'mono' ? '1px solid var(--color-line)' : undefined }}>
            Total amount in words : {amountInWords(t.total, cur)}
          </p>
        )}
        {tdsLine && (
          <p className="mt-sm m-0 px-sm text-[14px] italic leading-snug text-pretty text-ink-mute" style={doc.design === 'founder' ? { color: 'var(--inv-note)' } : undefined}>
            <Plain text={tdsLine} />
          </p>
        )}
        {ed ? (
          <div className={`mt-xs px-sm text-[14px] italic text-ink-mute ${ownFoot ? '' : 'no-print'}`}>
            <PaperText multiline value={ownFoot} onChange={(v) => ed.setDoc({ footnote: v })} label="Line under the totals" placeholder="A line under the totals (optional)" max={300} />
          </div>
        ) : (
          ownFoot && (
            <p className="mt-xs m-0 whitespace-pre-wrap px-sm text-[14px] italic leading-snug text-pretty text-ink-mute">
              <Plain text={ownFoot} />
            </p>
          )
        )}
        {ed ? (
          <div className={`mt-md text-[14px] font-semibold text-ink-soft ${invoice.note ? '' : 'no-print'}`}>
            <PaperText multiline value={invoice.note} onChange={(v) => ed.setMeta({ note: v })} label="Note to your client" placeholder="A note to your client (optional)" max={500} />
          </div>
        ) : (
          invoice.note && (
            <p className="mt-md m-0 whitespace-pre-wrap text-[14px] font-semibold text-ink-soft">
              <Plain text={invoice.note} />
            </p>
          )
        )}
        {ed ? (
          <div className="mt-xl text-center text-[14px] leading-loose">
            <PaperText multiline value={doc.footer} onChange={(v) => ed.setDoc({ footer: v })} label="Footer" placeholder="Prop. Your business - address, then your phones, email and website" max={300} className="text-center" />
          </div>
        ) : (
          doc.footer && (
            <div className="mt-xl text-center text-[14px] leading-loose">
              {/* The owner's own footer, as plain text (never a link), set in the paper's face like the rest of the page. */}
              {doc.footer.split('\n').map((l, i) => (
                <p key={i} className="m-0">
                  {l}
                </p>
              ))}
            </div>
          )
        )}
      </div>
      {ed && (
        <Sheet open={menu !== null} onClose={() => setMenu(null)} title={menu !== null ? `Line ${menu + 1}` : 'Line'}>
          {menu !== null && (
            <ul className="m-0 flex list-none flex-col gap-xs p-0 pb-xl">
              {(
                [
                  { key: 'up', label: 'Move up', icon: ArrowUp, run: () => moveTo(menu, menu - 1), off: menu === 0 },
                  { key: 'down', label: 'Move down', icon: ArrowDown, run: () => moveTo(menu, menu + 1), off: menu >= items.length - 1 },
                  { key: 'add', label: 'Add a line below', icon: Plus, run: () => addAfter(menu), off: items.length >= MAX_INVOICE_LINES },
                  ...packages.map((row, k) => ({ key: `pk${k}`, label: `From a package: ${row.name || `${row.units} ${ed.profile?.packages.unit ?? ''}`}`, icon: Package, run: () => setItem(menu, packageInvoiceLine(row, ed.profile!)), off: false })),
                  { key: 'rm', label: 'Remove this line', icon: Trash2, run: () => removeAt(menu), off: items.length <= 1 },
                ] as const
              ).map((a) => (
                <li key={a.key}>
                  <button
                    type="button"
                    disabled={a.off}
                    onClick={() => {
                      setMenu(null);
                      a.run();
                    }}
                    className={`toy toy-soft flex min-h-[48px] w-full items-center gap-sm rounded-tile px-sm text-left text-[16px] font-bold disabled:opacity-50 ${a.key === 'rm' ? 'text-r1' : 'text-ink'}`}
                  >
                    <Icon icon={a.icon} size={20} />
                    {a.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}
    </PrintSheet>
  );
}

/** A unit cost typed on the paper: shown as "₹7,000.00", typed as "7000" or "7000.50" and read with `typedCents`. */
export function MoneyCell({ cents, currency, onChange, label }: { cents: number; currency: string; onChange: (c: number) => void; label: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={draft ?? invoiceMoney(cents, currency)}
      onFocus={(e) => {
        const el = e.currentTarget;
        const start = cents ? String(cents % 100 ? (cents / 100).toFixed(2) : cents / 100) : '';
        setDraft(start);
        // The whole number is picked, so typing replaces it (unless typing already began).
        window.requestAnimationFrame(() => el.value === start && el.select());
      }}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(Math.max(0, typedCents(e.target.value) || 0));
      }}
      className="inv-edit text-right"
    />
  );
}

/** A count typed on the paper: whole, one or more, shown with the leading zero when the invoice asks for it. */
export function QtyCell({ qty, pad, onChange, label }: { qty: number; pad: boolean; onChange: (q: number) => void; label: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={draft ?? invoiceQty(qty, pad)}
      onFocus={(e) => {
        const el = e.currentTarget;
        setDraft(String(qty));
        window.requestAnimationFrame(() => el.value === String(qty) && el.select());
      }}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = Math.round(Number.parseFloat(e.target.value));
        if (Number.isFinite(n) && n >= 1) onChange(Math.min(100_000, n));
      }}
      className="inv-edit text-right"
    />
  );
}

/** The sums' settings, on screen only, inside the totals block: discount, GST (and the split), TDS rate and who bears it, the leading zero. */
function SumControls({ doc, onChange, currency }: { doc: InvoiceDoc; onChange: (p: Partial<InvoiceDoc>) => void; currency: string }) {
  const sel = 'mt-xs w-full rounded-inner border border-line bg-card-strong px-xs py-xs text-[14px] font-bold text-ink';
  const gstValue = doc.gstBps === 0 ? '0' : `${doc.gstBps}:${doc.gstSplit ? 'split' : 'one'}`;
  const tdsRates: number[] = (TDS_RATES_BPS as readonly number[]).includes(doc.tdsBps) ? [...TDS_RATES_BPS] : [...TDS_RATES_BPS, doc.tdsBps].sort((a, b) => a - b);
  const [discount, setDiscount] = useState(doc.discountMode === 'none' ? '' : String(doc.discountValue / 100));
  useEffect(() => {
    if (doc.discountMode === 'none') setDiscount('');
  }, [doc.discountMode]);
  return (
    // `w-0 min-w-full`: the controls fill the sums block but never widen it, so the paper's columns are the same on screen and on paper.
    <div className="no-print mt-md grid w-0 min-w-full gap-xs border-t border-line pt-sm sm:grid-cols-2">
      <label className="text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">
        GST
        <select
          value={gstValue}
          onChange={(e) => {
            const [b, mode] = e.target.value.split(':');
            onChange({ gstBps: Number(b) || 0, gstSplit: mode === 'split' });
          }}
          className={sel}
        >
          <option value="0">No GST</option>
          {GST_RATES_BPS.filter((b) => b > 0).flatMap((b) => [
            <option key={`${b}o`} value={`${b}:one`}>
              {`${b / 100}% ${currency === 'INR' ? 'IGST' : 'GST'}`}
            </option>,
            ...(currency === 'INR'
              ? [
                  <option key={`${b}s`} value={`${b}:split`}>
                    {`${b / 100}% as CGST and SGST`}
                  </option>,
                ]
              : []),
          ])}
        </select>
      </label>
      <label className="text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">
        TDS
        <select value={doc.tdsMode} onChange={(e) => onChange({ tdsMode: e.target.value as TdsMode })} className={sel}>
          {TDS_MODES.map((x) => (
            <option key={x} value={x}>
              {TDS_MODE_NAME[x]}
            </option>
          ))}
        </select>
      </label>
      {doc.tdsMode !== 'none' && (
        <label className="text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">
          TDS rate
          <select value={doc.tdsBps} onChange={(e) => onChange({ tdsBps: Number(e.target.value) || 0 })} className={sel}>
            {tdsRates.map((b) => (
              <option key={b} value={b}>
                {b === 0 ? 'Not set' : `${b / 100}%`}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">
        Discount
        <select value={doc.discountMode} onChange={(e) => onChange({ discountMode: e.target.value as InvoiceDoc['discountMode'], discountValue: 0 })} className={sel}>
          <option value="none">No discount</option>
          <option value="flat">An amount off</option>
          <option value="percent">A percent off</option>
        </select>
      </label>
      {doc.discountMode !== 'none' && (
        <label className="text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">
          {doc.discountMode === 'percent' ? 'Percent off' : 'Amount off'}
          <input
            inputMode="decimal"
            value={discount}
            onChange={(e) => {
              setDiscount(e.target.value);
              onChange({ discountValue: doc.discountMode === 'percent' ? Math.max(0, Math.min(10000, Math.round((Number.parseFloat(e.target.value) || 0) * 100))) : Math.max(0, typedCents(e.target.value) || 0) });
            }}
            className={sel}
          />
        </label>
      )}
      <label className="flex min-h-[44px] items-center gap-xs text-[12px] font-extrabold uppercase tracking-wide text-ink-soft sm:col-span-2">
        <input type="checkbox" checked={doc.qtyPad === true} onChange={(e) => onChange({ qtyPad: e.target.checked })} />
        Write 5 as 05
      </label>
    </div>
  );
}

// ---- form pieces the designer and Settings share


export function Field({ label, id, value, onChange, placeholder, type = 'text', max, inputMode }: { label: string; id: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; max?: number; inputMode?: 'text' | 'decimal' | 'numeric' }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input id={id} type={type} inputMode={inputMode} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={FIELD} />
    </div>
  );
}

/** A switch for each thing the client may see on an invoice. */
export function ShowSwitches({ value, onChange }: { value: InvoiceShow; onChange: (s: InvoiceShow) => void }): ReactNode {
  return (
    <div className="flex flex-col gap-xs">
      {INVOICE_SHOW_PARTS.map((p) => (
        <Toggle key={p.key} on={value[p.key]} onChange={(on) => onChange({ ...value, [p.key]: on })} label={p.name} hint={p.blurb} />
      ))}
    </div>
  );
}

/** Pickable chips for one choice among a few. */
export function Chips<T extends string | number>({ label, options, value, onChange }: { label: string; options: readonly { value: T; name: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="mt-xs flex flex-wrap gap-xs">
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={`toy min-h-[44px] rounded-pill border-2 px-md text-[14px] font-bold ${value === o.value ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
          {o.name}
        </button>
      ))}
    </div>
  );
}

/**
 * One part of a document, in a line or two, with a small Edit button that opens only that part's form in a sheet.
 * The page stays short: the document on top, then these cards. `row` draws it as one line of an inset list (`.fx-inset`): the whole
 * line is the button (title, what is set now, a chevron), so a long list of parts is one calm group instead of a column of Edit pills.
 */
export function SummaryCard({ title, summary, onEdit, editLabel = 'Edit', disabled = false, row = false, badge }: { title: string; summary: ReactNode; onEdit: () => void; editLabel?: string; disabled?: boolean; row?: boolean; /** A short tag after the title (a row only): "2 new". */ badge?: ReactNode }) {
  if (row) {
    return (
      <li>
        <button type="button" onClick={onEdit} disabled={disabled} aria-label={`${editLabel} ${title.toLowerCase()}`} className="fx-row text-ink disabled:opacity-60">
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-xs">
              <span className="text-[16px] font-extrabold">{title}</span>
              {badge}
            </span>
            <span className="mt-xs block text-[14px] font-semibold text-ink-soft">{summary}</span>
          </span>
          {!disabled && <Icon icon={ChevronRight} size={20} className="shrink-0 text-ink-mute" />}
        </button>
      </li>
    );
  }
  return (
    <li className="flex items-start justify-between gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="min-w-0">
        <h3 className="m-0 text-[16px] font-extrabold">{title}</h3>
        <div className="mt-xs text-[14px] font-semibold text-ink-soft">{summary}</div>
      </div>
      <Button variant="outline" size="sm" onClick={onEdit} disabled={disabled} aria-label={`${editLabel} ${title.toLowerCase()}`}>
        {editLabel}
      </Button>
    </li>
  );
}
