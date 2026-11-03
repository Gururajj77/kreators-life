import {
  amountInWords,
  INVOICE_SHOW_PARTS,
  invoiceTotals,
  money,
  tdsGrossupNote,
  type BankDetails,
  type Invoice,
  type InvoiceDesign,
  type InvoiceParty,
  type InvoiceShow,
  type InvoiceTotals,
} from '@kreators/shared';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { Inert } from './Inert';
import { invoiceStamp, PrintSheet } from './PrintSheet';
import { Toggle } from './Toggle';
import { FIELD, LABEL } from '../lib/ui';
export { FIELD, LABEL } from '../lib/ui';

/** What each look wears. Colours are theme tokens; a bar that holds text has its own text token so dark mode keeps it readable. */
const LOOK: Record<InvoiceDesign, { bar: string; barText: string; head: string; headText: string; row: string; sum: string; words: string }> = {
  classic: { bar: 'var(--color-ink)', barText: 'var(--color-on-ink)', head: 'var(--color-r5)', headText: 'var(--color-on-fill)', row: 'var(--tint-sky)', sum: 'var(--tint-green)', words: 'var(--tint-sky)' },
  teal: { bar: 'var(--color-r5)', barText: 'var(--color-on-fill)', head: 'var(--color-r4)', headText: 'var(--color-on-fill)', row: 'var(--tint-sky)', sum: 'var(--tint-sky)', words: 'var(--tint-green)' },
  warm: { bar: 'var(--color-earth)', barText: 'var(--color-on-fill)', head: 'var(--color-r2)', headText: 'var(--color-on-fill)', row: 'var(--tint-orange)', sum: 'var(--tint-orange)', words: 'var(--tint-yellow)' },
  mono: { bar: 'var(--color-ink)', barText: 'var(--color-on-ink)', head: 'var(--color-ink)', headText: 'var(--color-on-ink)', row: 'transparent', sum: 'transparent', words: 'transparent' },
};

/** 22/09/2026 the way the sample invoice writes a date. */
export function invoiceDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const lines = (...parts: (string | undefined)[]) => parts.filter((p): p is string => Boolean(p && p.trim()));

function Party({ p }: { p: InvoiceParty }) {
  const rows = lines(...p.taxIds.map((t) => `${t.label}: ${t.value}`), ...p.address.split('\n'), p.email, p.phone);
  return (
    <div className="text-[14px] font-normal leading-snug">
      {rows.map((r, i) => (
        <p key={i} className="m-0">
          <Inert text={r} />
        </p>
      ))}
    </div>
  );
}

/**
 * An invoice drawn the way the person designed it: the sender and the client, the lines, the bank, the sums and the total in words.
 * What the person switched off is simply missing from the data (the server removes it), and a block with nothing in it is left out.
 * Lines marked no-print stay on screen only. The whole thing is `print-doc`, so Download PDF is the browser's own save as PDF.
 */
/** `owner` is kept on the type for the callers that pass it; the invoice reads the same to the owner and the client. */
export function InvoiceView({ invoice, totals }: { invoice: Invoice; totals?: InvoiceTotals; owner?: boolean }) {
  const doc = invoice.doc;
  const t = totals ?? invoiceTotals(invoice.items, doc);
  const look = LOOK[doc.design];
  const cur = invoice.currency;
  const fromName = doc.from.name || invoice.ownerName;
  const toName = doc.to.name || invoice.clientName;
  const bankRows = lines(
    doc.bank.bankName && `Bank name: ${doc.bank.bankName}`,
    doc.bank.holder && `Account holder: ${doc.bank.holder}`,
    doc.bank.account && `Account number: ${doc.bank.account}`,
    doc.bank.ifsc && `IFSC code: ${doc.bank.ifsc}`,
    doc.bank.upi && `UPI details: ${doc.bank.upi}`,
  );
  const gstPct = `${doc.gstBps / 100}%`;
  const sums: [string, string, boolean?][] = [['Subtotal', money(t.subtotal, cur)]];
  if (t.discount > 0) sums.push([doc.discountMode === 'percent' ? `Discount (${doc.discountValue / 100}%)` : 'Discount', `-${money(t.discount, cur)}`]);
  if (t.gst > 0 || doc.gstBps > 0) {
    if (doc.gstSplit) {
      sums.push([`CGST (${doc.gstBps / 200}%)`, money(t.cgst, cur)]);
      sums.push([`SGST (${doc.gstBps / 200}%)`, money(t.sgst, cur)]);
    } else sums.push([`GST (${gstPct})`, money(t.gst, cur)]);
  }
  if (doc.tdsMode === 'grossup') sums.push(['TDS adjusted*', money(t.tdsAdjusted, cur)]);
  return (
    <PrintSheet kind="invoice" title={doc.title || 'Invoice'} reference={invoice.number} date={invoice.issueDate} style={doc.style} stamp={invoiceStamp(invoice)} titleBlock={false} letterhead={{ name: '', lines: [] }}>
      <div className="legal-invoice">
      <div className="grid gap-md md:grid-cols-2">
        <div className="min-w-0">
          <h2 className="m-0 break-words font-display text-[30px] font-extrabold leading-tight">
            <Inert text={fromName} />
          </h2>
          {doc.from.line && (
            <p className="mt-xs mb-xs m-0 px-sm text-[14px] font-extrabold leading-[32px]" style={{ background: look.bar, color: look.barText }}>
              <Inert text={doc.from.line} />
            </p>
          )}
          <Party p={doc.from} />
        </div>
        <div className="min-w-0">
          <h2 className="m-0 break-words font-display text-[24px] font-extrabold leading-tight text-ink-soft md:text-right">
            <Inert text={doc.title} />
          </h2>
          <dl className="mt-xs mb-sm grid grid-cols-[auto_1fr] text-[14px] font-normal">
            {(
              [
                ['Date', invoiceDate(invoice.issueDate)],
                ['Invoice #', invoice.number],
                ['Payment due by', invoiceDate(invoice.dueDate)],
              ] as const
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="px-sm leading-[32px]" style={{ background: look.row }}>
                    {k}
                  </dt>
                  <dd className="m-0 px-sm leading-[32px]" style={{ background: look.row }}>
                    {v}
                  </dd>
                </div>
              ))}
          </dl>
          <p className="m-0 mb-xs px-sm text-[14px] font-extrabold leading-[32px]" style={{ background: look.bar, color: look.barText }}>
            Billed to: <Inert text={toName} />
          </p>
          {doc.to.line && (
            <p className="m-0 text-[14px] font-normal">
              <Inert text={doc.to.line} />
            </p>
          )}
          <Party p={doc.to} />
        </div>
      </div>

      <div className="mt-md overflow-x-auto">
        <table className="w-full border-collapse text-[14px] font-normal">
          <thead>
            <tr style={{ background: look.bar, color: look.barText }}>
              <th className="px-xs py-xs text-left font-extrabold sm:px-sm">Description</th>
              <th className="whitespace-nowrap px-xs py-xs text-right font-extrabold sm:px-sm">Unit cost</th>
              <th className="whitespace-nowrap px-xs py-xs text-right font-extrabold sm:px-sm">Qty</th>
              <th className="whitespace-nowrap px-xs py-xs text-right font-extrabold sm:px-sm">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? look.row : 'transparent' }}>
                <td className="px-xs py-xs sm:px-sm">
                  <Inert text={it.description} />
                </td>
                <td className="whitespace-nowrap px-xs py-xs text-right sm:px-sm">{money(it.unitCents, cur)}</td>
                <td className="whitespace-nowrap px-xs py-xs text-right sm:px-sm">{it.quantity}</td>
                <td className="whitespace-nowrap px-xs py-xs text-right font-normal sm:px-sm">{money(it.quantity * it.unitCents, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-xs grid gap-xs md:grid-cols-2">
        {bankRows.length > 0 ? (
          <div className="min-w-0 border border-line">
            <p className="m-0 px-sm text-[12px] font-extrabold uppercase leading-[32px] tracking-wide" style={{ background: look.head, color: look.headText }}>
              Bank account details
            </p>
            <div className="p-sm text-[14px] font-normal leading-snug">
              {bankRows.map((r) => (
                <p key={r} className="m-0">
                  <Inert text={r} />
                </p>
              ))}
            </div>
          </div>
        ) : (
          <div />
        )}
        <div className="min-w-0 p-sm" style={{ background: look.sum, border: doc.design === 'mono' ? '1px solid var(--color-line)' : undefined }}>
          <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-md text-[14px] font-normal">
            {sums.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-right text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{k}</dt>
                <dd className="m-0 text-right text-ink-soft">{v}</dd>
              </div>
            ))}
            <dt className="mt-sm text-right text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">Total</dt>
            <dd className="m-0 mt-xs text-right text-[26px] font-extrabold leading-none">{money(t.total, cur)}</dd>
            {(doc.tdsMode === 'show' || doc.tdsMode === 'grossup') && t.tdsDeducted > 0 && (
              <>
                <dt className="mt-sm text-right text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">TDS to deduct ({doc.tdsBps / 100}%)</dt>
                <dd className="m-0 mt-sm text-right text-ink-soft">-{money(t.tdsDeducted, cur)}</dd>
                <dt className="text-right text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">To pay after TDS</dt>
                <dd className="m-0 text-right font-extrabold">{money(t.netReceivable, cur)}</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {doc.show.words && (
        <p className="m-0 mt-xs px-sm py-xs text-[14px] font-extrabold uppercase leading-snug" style={{ background: look.words, border: doc.design === 'mono' ? '1px solid var(--color-line)' : undefined }}>
          Total amount in words: {amountInWords(t.total, cur)}
        </p>
      )}
      {doc.tdsMode === 'grossup' && doc.tdsBps > 0 && (
        <p className="mt-xs m-0 text-[12px] font-semibold leading-snug text-ink-soft">
          <Inert text={tdsGrossupNote(doc.tdsBps)} />
        </p>
      )}
      {invoice.note && (
        <p className="mt-md m-0 whitespace-pre-wrap text-[14px] font-semibold text-ink-soft">
          <Inert text={invoice.note} />
        </p>
      )}
      {doc.footnote && (
        <p className="mt-sm m-0 whitespace-pre-wrap text-[12px] font-semibold italic text-ink-mute">
          <Inert text={doc.footnote} />
        </p>
      )}
      {doc.footer && (
        <p className="mt-lg m-0 whitespace-pre-wrap text-center text-[12px] font-semibold text-ink-soft">
          <Inert text={doc.footer} />
        </p>
      )}
      </div>
    </PrintSheet>
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

/** One side of an invoice: the names, the tax numbers, the address and how to reach them. */
export function PartyFields({ idp, value, onChange, nameLabel, lineLabel, lineHint }: { idp: string; value: InvoiceParty; onChange: (p: InvoiceParty) => void; nameLabel: string; lineLabel: string; lineHint?: string }) {
  const set = (patch: Partial<InvoiceParty>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-sm md:grid-cols-2">
      <Field id={`${idp}-name`} label={nameLabel} value={value.name} onChange={(v) => set({ name: v })} max={120} />
      <Field id={`${idp}-line`} label={lineLabel} value={value.line} onChange={(v) => set({ line: v })} placeholder={lineHint} max={160} />
      <div className="min-w-0 md:col-span-2">
        <span className={LABEL}>Tax numbers</span>
        {value.taxIds.map((t, i) => (
          <div key={i} className="mt-xs flex gap-xs">
            <input aria-label="Tax number name" value={t.label} maxLength={20} placeholder="PAN" onChange={(e) => set({ taxIds: value.taxIds.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} className="w-[96px] shrink-0 rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
            <input aria-label="Tax number" value={t.value} maxLength={40} onChange={(e) => set({ taxIds: value.taxIds.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} className="min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
            <button type="button" aria-label="Remove this number" onClick={() => set({ taxIds: value.taxIds.filter((_, j) => j !== i) })} className="toy toy-soft min-h-[44px] min-w-[44px] shrink-0 rounded-pill border-2 border-line bg-card text-[16px] font-bold">
              ×
            </button>
          </div>
        ))}
        {value.taxIds.length < 4 && (
          <button type="button" onClick={() => set({ taxIds: [...value.taxIds, { label: value.taxIds.length === 0 ? 'PAN' : 'GSTIN', value: '' }] })} className="toy toy-soft mt-xs min-h-[44px] rounded-pill border-2 border-line bg-card px-md text-[14px] font-bold">
            Add a tax number
          </button>
        )}
      </div>
      <div className="min-w-0 md:col-span-2">
        <label htmlFor={`${idp}-address`} className={LABEL}>
          Address
        </label>
        <textarea id={`${idp}-address`} value={value.address} maxLength={300} rows={3} onChange={(e) => set({ address: e.target.value })} className={FIELD} />
      </div>
      <Field id={`${idp}-email`} label="Email" type="email" value={value.email} onChange={(v) => set({ email: v })} max={120} />
      <Field id={`${idp}-phone`} label="Phone" value={value.phone} onChange={(v) => set({ phone: v })} max={40} />
    </div>
  );
}

export function BankFields({ value, onChange }: { value: BankDetails; onChange: (b: BankDetails) => void }) {
  const set = (patch: Partial<BankDetails>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-sm md:grid-cols-2">
      <Field id="bank-name" label="Bank name" value={value.bankName} onChange={(v) => set({ bankName: v })} max={80} />
      <Field id="bank-holder" label="Account holder" value={value.holder} onChange={(v) => set({ holder: v })} max={80} />
      <Field id="bank-account" label="Account number" inputMode="numeric" value={value.account} onChange={(v) => set({ account: v })} max={40} />
      <Field id="bank-ifsc" label="IFSC code" value={value.ifsc} onChange={(v) => set({ ifsc: v.toUpperCase() })} max={20} />
      <Field id="bank-upi" label="UPI details" value={value.upi} onChange={(v) => set({ upi: v })} max={80} />
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
