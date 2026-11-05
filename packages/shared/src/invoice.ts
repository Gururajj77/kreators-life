import { money } from './money.ts';
import type { Invoice, InvoiceItem } from './money.ts';
import type { ContractPackage } from './contract.ts';

// ---------------------------------------------------------------------------
// Invoice designer and calculator
// ---------------------------------------------------------------------------

/**
 * The looks an invoice can wear. Only keys live here: the screen maps each key to colours (theme tokens, or for Founder classic the paper
 * colours in the legal block of app.css), so stored data never becomes a raw colour.
 */
export const INVOICE_DESIGNS = ['founder', 'classic', 'teal', 'warm', 'mono'] as const;
export type InvoiceDesign = (typeof INVOICE_DESIGNS)[number];
export const INVOICE_DESIGN_META: Record<InvoiceDesign, { name: string; blurb: string }> = {
  founder: { name: 'Founder classic', blurb: 'Grey bars, a teal bank header, green totals and a blue words line.' },
  classic: { name: 'Classic', blurb: 'Grey bars, a green total and a blue line for the words.' },
  teal: { name: 'Teal', blurb: 'Teal bars with a soft sky total.' },
  warm: { name: 'Warm', blurb: 'Sand bars with a soft peach total.' },
  mono: { name: 'Plain', blurb: 'Black and white. Prints cleanly.' },
};
/** The titles to pick from. The title stays free text: the owner can type any other on the paper. */
export const INVOICE_TITLES = ['Invoice', 'Advance Invoice', 'Proforma Invoice', 'Tax Invoice'] as const;
/** What the quantity column is called on the paper. */
export const INVOICE_QTY_LABELS = ['Qty', 'Qty/Hr rate', 'Hours'] as const;
export type InvoiceQtyLabel = (typeof INVOICE_QTY_LABELS)[number];
/** A quantity as the invoice prints it: with `pad`, a number under ten gets a leading zero ("05"), the way the founder's invoices write it. */
export function invoiceQty(n: number, pad = false): string {
  const v = Math.round(n);
  return pad && v >= 0 && v < 10 ? `0${v}` : String(v);
}
/** Money on an invoice always shows the paise: "₹35,000.00". The agreement and the rest of the app keep `money()`. */
export function invoiceMoney(cents: number, currency = 'INR'): string {
  const c = Math.round(cents);
  const abs = Math.abs(c);
  const rest = abs % 100;
  return `${c < 0 ? '-' : ''}${money(abs - rest, currency)}.${String(rest).padStart(2, '0')}`;
}
export const GST_RATES_BPS = [0, 500, 1200, 1800, 2800] as const;
/** Common TDS rates for creative work, in basis points (one percent is 100). Any rate from 0 to 30 percent is allowed. */
export const TDS_RATES_BPS = [0, 100, 200, 500, 1000] as const;
export const TDS_MODES = ['none', 'grossup', 'show'] as const;
export type TdsMode = (typeof TDS_MODES)[number];
export const TDS_MODE_NAME: Record<TdsMode, string> = { none: 'No TDS', grossup: 'The client pays the TDS (add it, then deduct it)', show: 'Show what they will deduct' };
/** The line under the total when the client bears the TDS: the extra amount is on the invoice so that, after they deduct TDS, the price is paid in full. */
export const tdsGrossupNote = (tdsBps: number): string => `*Additional ${tdsBps > 0 ? tdsBps / 100 : ''}% adjusted on total invoice amount applicable for TDS deducted to be borne by the company as per the agreement terms.`;
export const MAX_INVOICE_LINES = 30;
export const INVOICE_TEXT_MAX = 200;

export interface InvoiceParty {
  /** The big name: a brand for the sender, the client's brand for the other side. */
  name: string;
  /** The line under it: "Prop. Name for Brand" for the sender, the legal name for the client. */
  line: string;
  /** Tax numbers with their labels, such as PAN or GSTIN. */
  taxIds: { label: string; value: string }[];
  address: string;
  email: string;
  phone: string;
}
export const emptyParty = (): InvoiceParty => ({ name: '', line: '', taxIds: [], address: '', email: '', phone: '' });

export interface BankDetails {
  bankName: string;
  holder: string;
  account: string;
  ifsc: string;
  upi: string;
}
export const emptyBank = (): BankDetails => ({ bankName: '', holder: '', account: '', ifsc: '', upi: '' });

/** What the client sees on this invoice. Each is a switch on the invoice; what is off never leaves the server. */
export const INVOICE_SHOW_PARTS = [
  { key: 'bank', name: 'Bank and UPI details', blurb: 'Where to pay. Switch it off to send those another way.', on: true },
  { key: 'taxIds', name: 'Tax numbers', blurb: 'PAN, GSTIN and any others, for both sides.', on: true },
  { key: 'dueDate', name: 'Payment due date', blurb: 'The "Payment due by" line.', on: true },
  { key: 'words', name: 'Total in words', blurb: 'The line that spells the total out.', on: true },
  { key: 'notes', name: 'Notes and footnote', blurb: 'The note on the invoice and the line under the totals.', on: true },
  { key: 'comments', name: 'Comments from the client', blurb: 'They can write to ask for a change.', on: true },
  { key: 'download', name: 'Download a PDF copy', blurb: 'They can save or print a copy.', on: true },
] as const;
export type InvoiceShowKey = (typeof INVOICE_SHOW_PARTS)[number]['key'];
export type InvoiceShow = Record<InvoiceShowKey, boolean>;
export const defaultInvoiceShow = (): InvoiceShow => Object.fromEntries(INVOICE_SHOW_PARTS.map((p) => [p.key, p.on])) as InvoiceShow;
export function parseInvoiceShow(v: unknown, base: InvoiceShow = defaultInvoiceShow()): InvoiceShow {
  const out = { ...base };
  if (v && typeof v === 'object') for (const k of Object.keys(out) as InvoiceShowKey[]) if (typeof (v as Record<string, unknown>)[k] === 'boolean') out[k] = (v as Record<string, boolean>)[k]!;
  return out;
}

export interface InvoiceDoc {
  show: InvoiceShow;
  title: string;
  from: InvoiceParty;
  to: InvoiceParty;
  bank: BankDetails;
  design: InvoiceDesign;
  discountMode: 'none' | 'flat' | 'percent';
  /** Cents for a flat discount, basis points for a percent one. */
  discountValue: number;
  gstBps: number;
  /** Show GST as half CGST and half SGST. */
  gstSplit: boolean;
  tdsBps: number;
  tdsMode: TdsMode;
  /** The small line under the totals, such as who bears the TDS. */
  footnote: string;
  /** The line at the very foot of the page. */
  footer: string;
  /** How the printed page looks: letterhead, font, size, page, margins, footer. Older invoices have the default. */
  style?: DocStyle;
  /** What the quantity column is called; older invoices read "Qty". */
  qtyLabel?: InvoiceQtyLabel;
  /** Write a quantity under ten with a leading zero ("05"). */
  qtyPad?: boolean;
}
export const emptyInvoiceDoc = (): InvoiceDoc => ({ show: defaultInvoiceShow(), title: 'Invoice', from: emptyParty(), to: emptyParty(), bank: emptyBank(), design: 'classic', discountMode: 'none', discountValue: 0, gstBps: 0, gstSplit: false, tdsBps: 0, tdsMode: 'none', footnote: '', footer: '' });

/** What a person saves once and every invoice starts from. Their own details, on their own account. */
export interface BusinessProfile {
  show: InvoiceShow;
  from: InvoiceParty;
  bank: BankDetails;
  design: InvoiceDesign;
  title: string;
  footnote: string;
  footer: string;
  invoicePrefix: string;
  payDays: number;
  gstBps: number;
  tdsBps: number;
  tdsMode: TdsMode;
  /** For contracts. */
  signerName: string;
  signerTitle: string;
  jurisdiction: string;
  /** The look every new document starts with. */
  docStyle?: DocStyle;
  /** The brand the work is done under (the agreement's 8.1, 8.11 and 10). */
  brandName: string;
  /** "operating under ..." in the agreement's parties; reads as the brand name when left empty. */
  operatingUnder: string;
  /** The proprietorship or company name: "Proprietor, <business>" and "Prop. <business>" in the invoice footer. */
  businessName: string;
  /** The registered address: the agreement's parties and the invoice footer. */
  businessAddress: string;
  /** Up to two emails and two phones for the agreement and the footer; `from.email` and `from.phone` stay the invoice header's. */
  emails: string[];
  phones: string[];
  /** A web address as typed: https or a bare domain. */
  website: string;
  /** The name of the content format the packages sell, and the way it is written inside a line ("05 <format> Videos Package"). */
  formatName: string;
  formatNameInline: string;
  /** The sentence of past clients the agreement's 8.15 names, as the owner writes it. */
  pastClients: string;
  /** The package table, entered once: the agreement's section 6, the offers and invoice lines read it. */
  packages: ProfilePackages;
  /** What a new invoice calls its quantity column, and whether it writes 5 as 05. */
  invoiceQtyLabel: InvoiceQtyLabel;
  invoiceQtyPad: boolean;
}
/** The owner's packages: rows of a name, how many units and the fee, and the block that is sold past the largest one. */
export interface ProfilePackages {
  /** The unit, plural, as the paper writes it: "Videos". */
  unit: string;
  rows: ContractPackage[];
  block: { units: number; feeCents: number };
}
export const MAX_PROFILE_PACKAGES = 8;
const emptyPackages = (): ProfilePackages => ({ unit: 'Videos', rows: [], block: { units: 0, feeCents: 0 } });
export const emptyProfile = (): BusinessProfile => ({
  show: defaultInvoiceShow(),
  from: emptyParty(),
  bank: emptyBank(),
  design: 'founder',
  title: 'Invoice',
  footnote: '',
  footer: '',
  invoicePrefix: '',
  payDays: 14,
  gstBps: 0,
  tdsBps: 0,
  tdsMode: 'none',
  signerName: '',
  signerTitle: '',
  jurisdiction: '',
  docStyle: defaultDocStyle(),
  brandName: '',
  operatingUnder: '',
  businessName: '',
  businessAddress: '',
  emails: [],
  phones: [],
  website: '',
  formatName: '',
  formatNameInline: '',
  pastClients: '',
  packages: emptyPackages(),
  invoiceQtyLabel: 'Qty',
  invoiceQtyPad: false,
});

export const cleanText = (v: unknown, max = INVOICE_TEXT_MAX): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const bps = (v: unknown, max: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
};
export const oneOfList = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => ((list as readonly string[]).includes(String(v)) ? (v as T) : fallback);

export function parseParty(v: unknown): InvoiceParty {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const ids = Array.isArray(o.taxIds) ? o.taxIds : [];
  return {
    name: cleanText(o.name, 120),
    line: cleanText(o.line, 160),
    taxIds: ids
      .map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}))
      .map((x) => ({ label: cleanText(x.label, 20), value: cleanText(x.value, 40) }))
      .filter((x) => x.label && x.value)
      .slice(0, 4),
    address: cleanText(o.address, 300),
    email: cleanText(o.email, 120),
    phone: cleanText(o.phone, 40),
  };
}
export function parseBank(v: unknown): BankDetails {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { bankName: cleanText(o.bankName, 80), holder: cleanText(o.holder, 80), account: cleanText(o.account, 40), ifsc: cleanText(o.ifsc, 20).toUpperCase(), upi: cleanText(o.upi, 80) };
}
export function parseInvoiceDoc(v: unknown, base: InvoiceDoc = emptyInvoiceDoc()): InvoiceDoc {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const mode = oneOfList(o.discountMode, ['none', 'flat', 'percent'] as const, base.discountMode);
  return {
    show: 'show' in o ? parseInvoiceShow(o.show, base.show) : base.show,
    title: cleanText(o.title, 40) || base.title,
    from: 'from' in o ? parseParty(o.from) : base.from,
    to: 'to' in o ? parseParty(o.to) : base.to,
    bank: 'bank' in o ? parseBank(o.bank) : base.bank,
    design: oneOfList(o.design, INVOICE_DESIGNS, base.design),
    discountMode: mode,
    // A doc that leaves the value out keeps the base's, while the mode is the base's too: an invoice made from a template keeps its discount.
    discountValue:
      mode === 'none'
        ? 0
        : !('discountValue' in o) && mode === base.discountMode
          ? base.discountValue
          : mode === 'percent'
            ? bps(o.discountValue, 10000)
            : Math.max(0, Math.min(1_000_000_000_00, Math.round(Number(o.discountValue)) || 0)),
    gstBps: 'gstBps' in o ? bps(o.gstBps, 2800) : base.gstBps,
    gstSplit: 'gstSplit' in o ? o.gstSplit === true : base.gstSplit,
    tdsBps: 'tdsBps' in o ? bps(o.tdsBps, 3000) : base.tdsBps,
    tdsMode: oneOfList(o.tdsMode, TDS_MODES, base.tdsMode),
    footnote: 'footnote' in o ? cleanText(o.footnote, 300) : base.footnote,
    footer: 'footer' in o ? cleanText(o.footer, 300) : base.footer,
    style: 'style' in o ? parseDocStyle(o.style, base.style) : parseDocStyle(base.style),
    qtyLabel: oneOfList(o.qtyLabel, INVOICE_QTY_LABELS, base.qtyLabel ?? 'Qty'),
    qtyPad: 'qtyPad' in o ? o.qtyPad === true : base.qtyPad === true,
  };
}
/** A whole number from a stored value, or null when it is not a number at all. */
const wholeOrNull = (v: unknown, min: number, max: number): number | null => {
  if (typeof v !== 'number' && (typeof v !== 'string' || !v.trim())) return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : null;
};
/** The package table, read defensively: up to eight rows with a count and a fee that are numbers, and the block past the largest. */
export function parsePackages(v: unknown): ProfilePackages {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const rows: ContractPackage[] = [];
  for (const r of Array.isArray(o.rows) ? o.rows : []) {
    if (rows.length >= MAX_PROFILE_PACKAGES) break;
    const x = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    const units = wholeOrNull(x.units, 0, 10_000);
    const feeCents = wholeOrNull(x.feeCents, 0, 1_000_000_000_00);
    if (units === null || units <= 0 || feeCents === null) continue;
    rows.push({ name: cleanText(x.name, 60), units, feeCents });
  }
  const b = (o.block && typeof o.block === 'object' ? o.block : {}) as Record<string, unknown>;
  return { unit: cleanText(o.unit, 30) || 'Videos', rows, block: { units: wholeOrNull(b.units, 0, 10_000) ?? 0, feeCents: wholeOrNull(b.feeCents, 0, 1_000_000_000_00) ?? 0 } };
}
const cleanList = (v: unknown, max: number, len: number, ok: (s: string) => boolean): string[] =>
  (Array.isArray(v) ? v : [])
    .map((x) => cleanText(x, len))
    .filter((x) => x && ok(x))
    .slice(0, max);
/** A web address as the owner typed it, kept only when it is https or a bare domain. */
const cleanWebsite = (v: unknown): string => {
  const s = cleanText(v, 120);
  return /^(https:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(s) ? s : '';
};
export function parseProfile(v: unknown): BusinessProfile {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const e = emptyProfile();
  return {
    show: parseInvoiceShow(o.show),
    from: parseParty(o.from),
    bank: parseBank(o.bank),
    design: oneOfList(o.design, INVOICE_DESIGNS, e.design),
    title: cleanText(o.title, 40) || e.title,
    footnote: cleanText(o.footnote, 300),
    footer: cleanText(o.footer, 300),
    invoicePrefix: cleanText(o.invoicePrefix, 12).toUpperCase().replace(/[^A-Z0-9-]/g, ''),
    payDays: Math.max(0, Math.min(180, Math.round(Number(o.payDays)) || e.payDays)),
    gstBps: bps(o.gstBps, 2800),
    tdsBps: bps(o.tdsBps, 3000),
    tdsMode: oneOfList(o.tdsMode, TDS_MODES, e.tdsMode),
    signerName: cleanText(o.signerName, 80),
    signerTitle: cleanText(o.signerTitle, 80),
    jurisdiction: cleanText(o.jurisdiction, 80),
    docStyle: parseDocStyle(o.docStyle),
    brandName: cleanText(o.brandName, 80),
    operatingUnder: cleanText(o.operatingUnder, 80) || cleanText(o.brandName, 80),
    businessName: cleanText(o.businessName, 120),
    businessAddress: cleanText(o.businessAddress, 300),
    emails: cleanList(o.emails, 2, 120, (x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)),
    phones: cleanList(o.phones, 2, 40, (x) => /^[+\d][\d\s()-]{4,}$/.test(x)),
    website: cleanWebsite(o.website),
    formatName: cleanText(o.formatName, 60),
    formatNameInline: cleanText(o.formatNameInline, 60) || cleanText(o.formatName, 60),
    pastClients: cleanText(o.pastClients, 600),
    packages: parsePackages(o.packages),
    invoiceQtyLabel: oneOfList(o.invoiceQtyLabel, INVOICE_QTY_LABELS, e.invoiceQtyLabel),
    invoiceQtyPad: o.invoiceQtyPad === true,
  };
}
/**
 * The two centred lines at the foot of an invoice, from the profile: "Prop. <business> - <address>" and "Phone: <p1> | <p2> | <email> |
 * <website>". A part that is empty is left out with its separator, so nothing is invented and no line ends in a bare bar.
 */
export function invoiceFooterFor(p: Pick<BusinessProfile, 'businessName' | 'businessAddress' | 'phones' | 'emails' | 'website' | 'from'>): string {
  const address = p.businessAddress.split('\n').map((x) => x.trim()).filter(Boolean).join(', ');
  const first = [p.businessName.trim() ? `Prop. ${p.businessName.trim()}` : '', address].filter(Boolean).join(' - ');
  const phones = (p.phones.length ? p.phones : [p.from.phone]).map((x) => x.trim()).filter(Boolean);
  const email = (p.emails[0] ?? p.from.email).trim();
  const second = [phones.length ? `Phone: ${phones.join(' | ')}` : '', email, p.website.trim()].filter(Boolean).join(' | ');
  return [first, second].filter(Boolean).join('\n');
}
const singularOf = (unit: string): string => (/s$/i.test(unit) ? unit.slice(0, -1) : unit);
/**
 * The worked example under the package table (the agreement's 6.1), from the owner's own numbers: "After the 20 video package,
 * additional videos are added in blocks of 5 at ₹35,000 per block. For example, 25 videos cost ₹1,50,000 + ₹35,000 = ₹1,85,000, and
 * 30 videos cost ₹1,50,000 + ₹70,000 = ₹2,20,000." Empty when there is no block or no package to count from.
 */
export function packageExampleLine(pk: ProfilePackages, currency = 'INR'): string {
  const top = [...pk.rows].filter((r) => r.units > 0).sort((a, b) => a.units - b.units).at(-1);
  const { units: b, feeCents: bf } = pk.block;
  if (!top || b <= 0 || bf <= 0) return '';
  const plural = (pk.unit || 'Videos').toLowerCase();
  const one = singularOf(plural);
  const m = (c: number) => money(c, currency);
  const t = top.units;
  const f = top.feeCents;
  return `After the ${t} ${one} package, additional ${plural} are added in blocks of ${b} at ${m(bf)} per block. For example, ${t + b} ${plural} cost ${m(f)} + ${m(bf)} = ${m(f + bf)}, and ${t + 2 * b} ${plural} cost ${m(f)} + ${m(2 * bf)} = ${m(f + 2 * bf)}.`;
}
/** A package as an invoice line: "05 <format> Videos Package", the count as the quantity, and the fee shared over it to the cent. */
export function packageInvoiceLine(row: ContractPackage, profile: Pick<BusinessProfile, 'formatNameInline' | 'formatName' | 'packages'>): InvoiceItem {
  const unit = profile.packages.unit || 'Videos';
  const Unit = unit.charAt(0).toUpperCase() + unit.slice(1);
  const format = (profile.formatNameInline || profile.formatName).trim();
  const units = Math.max(1, Math.round(row.units));
  return { description: [invoiceQty(units, true), format, Unit, 'Package'].filter(Boolean).join(' '), quantity: units, unitCents: Math.round(row.feeCents / units) };
}
/** Whether a footnote is the generated TDS line (any rate, or the blank "%" the founder's invoice prints). */
const AUTO_TDS_NOTE = /^\*Additional (\d+(\.\d+)?)?% adjusted on total invoice amount/;
/**
 * The italic lines under an invoice's totals. When the client bears the TDS the first is the TDS line for the rate (the founder's own
 * wording, with a blank "%" while no rate is set); then the owner's own footnote, unless it is only an older copy of that TDS line.
 */
export function invoiceFootnote(doc: Pick<InvoiceDoc, 'footnote' | 'tdsMode' | 'tdsBps'>): string[] {
  const own = doc.footnote.trim();
  const out: string[] = [];
  if (doc.tdsMode === 'grossup') out.push(tdsGrossupNote(doc.tdsBps));
  if (own && !(doc.tdsMode === 'grossup' && AUTO_TDS_NOTE.test(own))) out.push(own);
  return out;
}
/** The sender on an invoice: what was typed on the invoice paper, and where a part is empty, what the agreement paper of the same
 *  profile holds (brand, "Prop. <name> for <business>", address, first email and phone), so the business is typed once. */
export function invoiceFromProfile(p: BusinessProfile): InvoiceParty {
  const t = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const f = p.from;
  const business = t(p.businessName);
  const signer = t(p.signerName);
  const prop = signer && business ? `Prop. ${signer} for ${business}` : signer ? `Prop. ${signer}` : '';
  return {
    ...f,
    name: t(f.name) || t(p.brandName) || t(p.operatingUnder) || business,
    line: t(f.line) || prop,
    address: t(f.address) || t(p.businessAddress),
    email: t(f.email) || t((p.emails ?? [])[0]),
    phone: t(f.phone) || t((p.phones ?? [])[0]),
  };
}
/** A fresh invoice's look and details, from the person's profile. */
export function docFromProfile(p: BusinessProfile): InvoiceDoc {
  return {
    ...emptyInvoiceDoc(),
    show: p.show,
    title: p.title,
    from: invoiceFromProfile(p),
    bank: p.bank,
    design: p.design,
    gstBps: p.gstBps,
    tdsBps: p.tdsBps,
    tdsMode: p.tdsMode,
    footnote: p.footnote,
    footer: p.footer || invoiceFooterFor(p),
    style: parseDocStyle(p.docStyle),
    qtyLabel: p.invoiceQtyLabel,
    qtyPad: p.invoiceQtyPad,
  };
}

/** The invoice as the client may see it: what the person switched off is removed here, so it never reaches the client's browser. */
export function invoiceForClient(inv: Invoice): Invoice {
  const show = inv.doc.show;
  const doc: InvoiceDoc = { ...inv.doc, from: { ...inv.doc.from }, to: { ...inv.doc.to }, bank: { ...inv.doc.bank } };
  if (!show.bank) doc.bank = emptyBank();
  if (!show.taxIds) {
    doc.from.taxIds = [];
    doc.to.taxIds = [];
  }
  if (!show.notes) doc.footnote = '';
  return { ...inv, doc, dueDate: show.dueDate ? inv.dueDate : null, note: show.notes ? inv.note : '', agencyClientId: null };
}

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  taxable: number;
  gst: number;
  cgst: number;
  sgst: number;
  /** What is added to the total so the client's TDS comes out of it and nothing is lost. */
  tdsAdjusted: number;
  total: number;
  /** What the client will deduct as TDS when they pay, and what reaches the person after it. */
  tdsDeducted: number;
  netReceivable: number;
}

/**
 * The one sum behind every invoice, in whole cents and basis points, never floats. The discount comes off the subtotal,
 * GST goes on what is left, and TDS is worked on the taxable amount (GST is not part of it). When the person asks to
 * add the TDS to the total, the extra is taxable * rate / (1 - rate), so that after the client deducts the rate from
 * (taxable + extra) the person is left with exactly the taxable amount.
 */
export function invoiceTotals(items: readonly InvoiceItem[], doc: Pick<InvoiceDoc, 'discountMode' | 'discountValue' | 'gstBps' | 'gstSplit' | 'tdsBps' | 'tdsMode'>): InvoiceTotals {
  const subtotal = items.reduce((a, i) => a + Math.round(i.quantity) * Math.round(i.unitCents), 0);
  const rawDiscount = doc.discountMode === 'flat' ? doc.discountValue : doc.discountMode === 'percent' ? Math.round((subtotal * doc.discountValue) / 10000) : 0;
  const discount = Math.min(subtotal, Math.max(0, rawDiscount));
  const taxable = subtotal - discount;
  const gst = Math.round((taxable * doc.gstBps) / 10000);
  const cgst = doc.gstSplit ? Math.floor(gst / 2) : 0;
  const sgst = doc.gstSplit ? gst - cgst : 0;
  // What the client takes off a given amount as TDS, in whole cents.
  const takeOff = (amount: number) => Math.round((amount * doc.tdsBps) / 10000);
  let tdsAdjusted = 0;
  if (doc.tdsMode === 'grossup' && doc.tdsBps > 0 && doc.tdsBps < 10000 && taxable > 0) {
    // The extra is the smallest amount that leaves exactly `taxable` after the client's TDS comes off (taxable + extra - TDS = taxable),
    // so the person is paid their price to the cent. It starts at taxable * rate / (1 - rate) and is nudged by a cent or two where rounding needs it.
    tdsAdjusted = Math.round((taxable * doc.tdsBps) / (10000 - doc.tdsBps));
    for (let i = 0; i < 4 && taxable + tdsAdjusted - takeOff(taxable + tdsAdjusted) < taxable; i += 1) tdsAdjusted += 1;
    for (let i = 0; i < 4 && tdsAdjusted > 0 && taxable + tdsAdjusted - 1 - takeOff(taxable + tdsAdjusted - 1) >= taxable; i += 1) tdsAdjusted -= 1;
  }
  const total = taxable + gst + tdsAdjusted;
  const tdsDeducted = doc.tdsMode === 'none' || doc.tdsBps <= 0 ? 0 : takeOff(taxable + tdsAdjusted);
  return { subtotal, discount, taxable, gst, cgst, sgst, tdsAdjusted, total, tdsDeducted, netReceivable: total - tdsDeducted };
}

const NUM_ONES = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const NUM_TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
function wordsUnder1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) parts.push(`${NUM_ONES[Math.floor(n / 100)]} HUNDRED`);
  const rest = n % 100;
  if (rest > 0) parts.push(rest < 20 ? (NUM_ONES[rest] ?? '') : `${NUM_TENS[Math.floor(rest / 10)]}${rest % 10 ? ` ${NUM_ONES[rest % 10]}` : ''}`);
  return parts.join(' ');
}
/** A whole number in words with lakh and crore, the way Indian invoices write it. */
function wordsIndian(n: number): string {
  if (n === 0) return 'ZERO';
  const steps: [number, string][] = [[10_000_000, 'CRORE'], [100_000, 'LAKH'], [1000, 'THOUSAND']];
  const out: string[] = [];
  let rest = n;
  for (const [size, name] of steps) {
    const q = Math.floor(rest / size);
    if (q > 0) out.push(`${q >= 100 ? wordsIndian(q) : wordsUnder1000(q)} ${name}`);
    rest %= size;
  }
  if (rest > 0) out.push(wordsUnder1000(rest));
  return out.join(' ');
}
function wordsWestern(n: number): string {
  if (n === 0) return 'ZERO';
  const steps: [number, string][] = [[1_000_000_000, 'BILLION'], [1_000_000, 'MILLION'], [1000, 'THOUSAND']];
  const out: string[] = [];
  let rest = n;
  for (const [size, name] of steps) {
    const q = Math.floor(rest / size);
    if (q > 0) out.push(`${wordsUnder1000(q)} ${name}`);
    rest %= size;
  }
  if (rest > 0) out.push(wordsUnder1000(rest));
  return out.join(' ');
}
/** "THIRTY FIVE THOUSAND ONLY". Rupees use lakh and crore; other currencies use thousand, million and billion. */
export function amountInWords(cents: number, currency = 'INR'): string {
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const minor = abs % 100;
  const body = currency === 'INR' ? wordsIndian(whole) : wordsWestern(whole);
  const minorName = currency === 'INR' ? 'PAISE' : currency === 'GBP' ? 'PENCE' : 'CENTS';
  return `${cents < 0 ? 'MINUS ' : ''}${body}${minor > 0 ? ` AND ${wordsUnder1000(minor)} ${minorName}` : ''} ONLY`;
}


// ---------------------------------------------------------------------------
// Agency documents: how a page looks, the text version of any document, the other kinds of document, and house templates.
// ---------------------------------------------------------------------------

/** The look of a printed document. Every choice is a key; the screen maps a key to a value in code, so stored data never becomes a raw CSS value. */
export const DOC_HEADINGS = ['numbered', 'plain'] as const;
export const DOC_FONTS = ['serif', 'sans'] as const;
export const DOC_SIZES = ['small', 'normal', 'large'] as const;
/** Calm presets for the thin rule and the headings: ink, navy, green, plum, clay and slate. */
export const DOC_ACCENTS = ['ink', 'navy', 'green', 'plum', 'clay', 'slate'] as const;
export const DOC_PAGES = ['a4', 'letter'] as const;
export const DOC_MARGINS = ['narrow', 'normal', 'wide'] as const;
export const DOC_SIGN_LAYOUTS = ['side', 'stacked'] as const;
/** How a page is laid out: `legal` (serif, a centred small-caps title, a reference and date, a letterhead) or `typed`, the way a typed
 * agreement looks (left-aligned bold capitals, headings as typed, a hairline between sections, no letterhead). */
export const DOC_LAYOUTS = ['legal', 'typed'] as const;
export type DocLayout = (typeof DOC_LAYOUTS)[number];
export type DocHeading = (typeof DOC_HEADINGS)[number];
export type DocFont = (typeof DOC_FONTS)[number];
export type DocSize = (typeof DOC_SIZES)[number];
export type DocAccent = (typeof DOC_ACCENTS)[number];
export type DocPage = (typeof DOC_PAGES)[number];
export type DocMargin = (typeof DOC_MARGINS)[number];
export type DocSignLayout = (typeof DOC_SIGN_LAYOUTS)[number];
export const DOC_STYLE_NAMES = {
  heading: { numbered: 'Numbered', plain: 'Plain' },
  font: { serif: 'Serif', sans: 'Sans' },
  size: { small: 'Small', normal: 'Normal', large: 'Large' },
  accent: { ink: 'Ink', navy: 'Navy', green: 'Green', plum: 'Plum', clay: 'Clay', slate: 'Slate' },
  page: { a4: 'A4', letter: 'Letter' },
  margin: { narrow: 'Narrow', normal: 'Normal', wide: 'Wide' },
  signLayout: { side: 'Side by side', stacked: 'Stacked' },
  layout: { legal: 'Legal', typed: 'Typed' },
} as const;
export const DOC_FOOTER_MAX = 200;
/** A picture the person uploaded to use as a logo: the id of the stored file, never a web address. */
export const DOC_LOGO_RE = /^[A-Za-z0-9_-]{8,64}$/;

export interface DocStyle {
  /** The sender's name and address at the top of the first page. */
  letterhead: boolean;
  /** An uploaded picture's id, or empty for a text-only letterhead. */
  logo: string;
  heading: DocHeading;
  font: DocFont;
  size: DocSize;
  accent: DocAccent;
  page: DocPage;
  margin: DocMargin;
  /** A line at the foot of every page. */
  footer: string;
  /** "Page 1 of 3" at the foot of every page. */
  pageNumbers: boolean;
  signLayout: DocSignLayout;
  /** Older documents have the legal layout. */
  layout?: DocLayout;
}
/** A function declaration, not a const: profile defaults earlier in this file call it while the module loads. */
export function defaultDocStyle(): DocStyle {
  return { letterhead: true, logo: '', heading: 'numbered', font: 'serif', size: 'normal', accent: 'ink', page: 'a4', margin: 'normal', footer: '', pageNumbers: true, signLayout: 'side', layout: 'legal' };
}

/** The one reader of a document's style: anything unknown falls back to `base` (the default unless given), so a stored value is always a key we know. */
export function parseDocStyle(v: unknown, base: DocStyle = defaultDocStyle()): DocStyle {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const logo = typeof o.logo === 'string' ? o.logo.trim() : base.logo;
  return {
    letterhead: typeof o.letterhead === 'boolean' ? o.letterhead : base.letterhead,
    logo: DOC_LOGO_RE.test(logo) ? logo : '',
    heading: oneOfList(o.heading, DOC_HEADINGS, base.heading),
    font: oneOfList(o.font, DOC_FONTS, base.font),
    size: oneOfList(o.size, DOC_SIZES, base.size),
    accent: oneOfList(o.accent, DOC_ACCENTS, base.accent),
    page: oneOfList(o.page, DOC_PAGES, base.page),
    margin: oneOfList(o.margin, DOC_MARGINS, base.margin),
    footer: 'footer' in o ? cleanText(o.footer, DOC_FOOTER_MAX) : base.footer,
    pageNumbers: typeof o.pageNumbers === 'boolean' ? o.pageNumbers : base.pageNumbers,
    signLayout: oneOfList(o.signLayout, DOC_SIGN_LAYOUTS, base.signLayout),
    layout: oneOfList(o.layout, DOC_LAYOUTS, base.layout ?? 'legal'),
  };
}
