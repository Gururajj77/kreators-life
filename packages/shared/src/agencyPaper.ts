import { money } from './money.ts';
import type { Invoice } from './money.ts';
import { amountInWords, cleanText, defaultDocStyle, emptyBank, emptyParty, invoiceFootnote, invoiceQty, invoiceTotals, parseDocStyle } from './invoice.ts';
import type { DocStyle, InvoiceDoc, InvoiceParty, InvoiceTotals } from './invoice.ts';
import { CONTRACT_TEMPLATE_BY_KEY, contractGapNote, docVars, fillContractText, invoiceTemplateDoc, packageRate, writeOnKeys } from './contract.ts';
import type { ContractAnswer, ContractDoc, ContractSection, DocAudience, DocComment, DocTemplateKind } from './contract.ts';
import type { TagTone } from './agency.ts';

// ---- the words of a document

const DOC_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
/** 2026-10-12 or a full instant as "12 Oct 2026", the same everywhere (no locale), read in UTC. */
export function docDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '';
  return `${Number(m[3])} ${DOC_MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}`;
}
/** An instant as "12 Oct 2026, 14:05 UTC". */
export function docDateTime(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  return m ? `${docDate(m[1]!)}, ${m[2]} UTC` : docDate(iso);
}
/** A heading with its typed number taken off ("4. Trial content" is "Trial content"), so numbering is done once, in order. */
export function stripNumber(heading: string): string {
  return heading.replace(/^\s*\d+(\.\d+)*\.?\s+/, '').trim();
}
/** The heading as printed: numbered counts the sections in order (the typed number is dropped), plain keeps it as typed. */
export function docHeadingText(style: DocStyle, heading: string, n: number): string {
  return style.heading === 'numbered' ? `${n}. ${stripNumber(heading)}` : heading.trim();
}
/** AGR-1A2B3C: a short reference printed on a document, from its id. */
export function docRef(prefix: string, id: string): string {
  return `${prefix}-${id.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()}`;
}

export interface DocParty {
  label: string;
  lines: string[];
}
/** The two sides of a document, from the names filled in (the blanks show as lines to write on in the page, not here). */
export function contractParties(doc: Pick<ContractDoc, 'vars'>): DocParty[] {
  const v = doc.vars;
  const f = (k: string) => (v[k] ?? '').trim();
  const lines = (...xs: string[]) => xs.flatMap((x) => x.split('\n')).map((x) => x.trim()).filter(Boolean);
  const provider = lines([f('provider'), f('providerTitle')].filter(Boolean).join(', '), f('providerBusiness'), f('providerAddress'), [f('providerEmail'), f('providerPhone')].filter(Boolean).join(' | '));
  const client = lines(f('client'), f('clientAddress'), f('brands') && f('brands') !== f('client') ? `Brand or brands: ${f('brands')}` : '', f('clientContact') ? `Contact: ${f('clientContact')}` : '');
  return [
    ...(provider.length ? [{ label: 'Service provider', lines: provider }] : []),
    ...(client.length ? [{ label: 'Client', lines: client }] : []),
  ];
}
/** An agreement built from a template already has a Parties section, so the page does not draw the parties table as well. */
export const hasPartiesSection = (doc: Pick<ContractDoc, 'sections'>): boolean => doc.sections.some((s) => s.id === 'parties');

/** A line with its marks taken off: a "### " subhead, **bold** and a "* " bullet. */
const unmark = (line: string): string =>
  line
    .replace(/^###\s+/, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/^\*\s/, '- ')
    .trimEnd();
/** One section's words as plain text: blanks filled, subheads and **bold** marks removed, bullets kept as "- ". */
export function plainWords(body: string, vars: Record<string, string>, audience: DocAudience = 'client', writeOn?: ReadonlySet<string>): string {
  return fillContractText(body, vars, audience, writeOn)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(unmark)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface DocTextExtras {
  reference?: string;
  /** The date on the document, as YYYY-MM-DD or an instant. */
  date?: string;
  answers?: Record<string, ContractAnswer>;
  acceptance?: { name: string; title: string; at: string } | null;
  parties?: DocParty[];
  /** The client's copy (the default) leaves out every empty line; the owner's copy carries one note of what is missing instead. */
  audience?: DocAudience;
}

const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "videos" read as one: "video". */
export const unitOne = (unit: string): string => (/s$/i.test(unit) ? unit.slice(0, -1) : unit);

/** The rows of a price table as the page draws them: the header, a row per package, and the row for blocks past the largest. */
export function packageRows(s: Pick<ContractSection, 'packages' | 'extra' | 'unitName'>, currency: string): { head: string[]; rows: string[][] } {
  const unit = (s.unitName || 'pieces').toLowerCase();
  const fee = (c: number) => (c > 0 ? money(c, currency) : '—');
  const top = Math.max(0, ...(s.packages ?? []).map((p) => p.units));
  const rows = (s.packages ?? []).map((p) => [p.name, String(p.units), fee(p.feeCents), fee(packageRate(p))]);
  if (s.extra && s.extra.units > 0) rows.push([`Additional ${unit} beyond ${top}`, `Each block of ${s.extra.units}`, s.extra.feeCents > 0 ? `${money(s.extra.feeCents, currency)} per block` : '—', fee(packageRate({ name: '', units: s.extra.units, feeCents: s.extra.feeCents }))]);
  return { head: ['Package', capital(unit), 'Package fee', `Effective rate per ${unitOne(unit)}`], rows };
}

/**
 * An agreement (or any sectioned document) as clean plain text, the way it goes into an email and the way the page prints: the title,
 * the parties, the sections with a blank line between them, the price table as lines, the brief with its answers, and the signature
 * lines. A typed layout keeps the title and the headings exactly as typed; the legal layout numbers them. No markup characters.
 */
export function contractAsText(doc: ContractDoc, extras: DocTextExtras = {}): string {
  const style = parseDocStyle(doc.style);
  const typed = style.layout === 'typed';
  const vars = docVars(doc);
  const blanks = writeOnKeys(doc);
  const out: string[] = [typed ? doc.title : doc.title.toUpperCase()];
  if (doc.subtitle) out.push(doc.subtitle);
  const meta = typed ? [] : [extras.reference ? `Reference: ${extras.reference}` : '', extras.date ? `Date: ${docDate(extras.date)}` : ''].filter(Boolean);
  if (meta.length) out.push(meta.join('   '));
  const audience = extras.audience ?? 'client';
  const gapNote = audience === 'owner' ? contractGapNote(doc) : null;
  if (gapNote) out.push('', `Note for you: ${gapNote}`);
  const parties = extras.parties ?? (hasPartiesSection(doc) ? [] : contractParties(doc));
  for (const p of parties) out.push('', `${p.label}:`, ...p.lines);
  let n = 0;
  for (const s of doc.sections) {
    const words = plainWords(s.body, vars, audience, blanks);
    // A part with nothing written in it yet is the owner's to write; the client's copy leaves it out.
    if (s.kind === 'text' && !words && audience === 'client') continue;
    if (s.heading.trim()) {
      n += 1;
      out.push('', typed ? s.heading.trim() : docHeadingText(style, s.heading, n).toUpperCase());
    }
    if (words) out.push('', words);
    else if (s.kind === 'text') out.push('', 'Not written yet.');
    if (s.kind === 'packages' && (s.packages ?? []).length) {
      const t = packageRows(s, doc.currency);
      out.push('', t.head.join(' | '), ...t.rows.map((r) => r.join(' | ')));
    }
    if (s.kind === 'brief') {
      for (const q of s.questions ?? []) {
        const a = extras.answers && hasOwn(extras.answers, q.id) ? extras.answers[q.id] : undefined;
        if (q.heading) out.push('', q.heading);
        if (q.intro) out.push('', plainWords(q.intro, vars, audience));
        if (q.group) out.push('', q.group);
        if (q.label) out.push('', plainWords(q.label, vars, audience));
        for (const o of q.options) out.push(`[${a?.picked.includes(o) ? 'x' : ' '}] ${o}`);
        if (q.other) out.push(`[${a?.other ? 'x' : ' '}] Other: ${a?.other ?? ''}`.trimEnd());
        if (q.text) out.push(`${q.answerLabel || 'Answer:'} ${a?.text ?? ''}`.trimEnd());
        for (const f of q.fields ?? []) out.push(`- ${f}: ${a?.fields && hasOwn(a.fields, f) ? a.fields[f] : ''}`.trimEnd());
        (a?.links ?? []).forEach((l, i) => out.push(`${i + 1}. ${l}`));
      }
    }
    if (s.tail) {
      const tail = plainWords(s.tail, vars, audience);
      if (tail) out.push('', tail);
    }
    if (s.kind === 'signatures') {
      const acc = extras.acceptance;
      const v = doc.vars;
      out.push(
        '',
        'For the Service Provider:',
        `Name: ${(v.provider ?? '').trim()}`.trimEnd(),
        `Designation: ${((v.providerDesignation ?? '').trim() || (v.providerTitle ?? '').trim())}`.trimEnd(),
        'Signature: ____________________',
        'Date: ____________________',
        '',
        'For the Client:',
        `Name: ${acc?.name ?? ''}`.trimEnd(),
        `Designation: ${acc?.title ?? ''}`.trimEnd(),
        `Signature: ${acc ? acc.name : '____________________'}`,
        `Date: ${acc ? docDate(acc.at) : '____________________'}`,
      );
      if (acc) out.push('', `Accepted electronically by ${acc.name} on ${docDateTime(acc.at)}. Typed acceptance, not a certified e-signature.`);
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---- the words of a section as blocks, for editing them in place on the page

/** A piece of a block: plain words, a variable ({{key}}, or an either form with its fallback), or **bold** words. */
export type BodySegment = string | { var: string; when?: string; fallback?: string } | { bold: string };
/** One block of a section's words: a paragraph (its lines kept), a bullet, a "### " subhead or a whole bold line. */
export interface BodyBlock {
  kind: 'p' | 'li' | 'h3' | 'strong';
  segments: BodySegment[];
  /** The exact line breaks before it (one between bullets, a blank line otherwise), so a body reads back byte for byte. */
  sep: string;
  /** Unused by the built-ins: a lead in bold is a `{ bold }` segment. Kept for callers that set one. */
  lead?: string;
}
const SEG_RE = /(\*\*[^*\n]+?\*\*|\{\{\w+(?:\?[^|{}]*)?(?:\|[^{}]*)?\}\})/;
function segmentsOf(text: string): BodySegment[] {
  const out: BodySegment[] = [];
  for (const part of text.split(SEG_RE)) {
    if (!part) continue;
    const b = /^\*\*([^*\n]+?)\*\*$/.exec(part);
    if (b) {
      out.push({ bold: b[1]! });
      continue;
    }
    const v = /^\{\{(\w+)(?:\?([^|{}]*))?(?:\|([^{}]*))?\}\}$/.exec(part);
    if (v) {
      const seg: { var: string; when?: string; fallback?: string } = { var: v[1]! };
      if (v[2] !== undefined) seg.when = v[2];
      if (v[3] !== undefined) seg.fallback = v[3];
      out.push(seg);
      continue;
    }
    out.push(part);
  }
  return out;
}
/** A segment back to its words. */
export function segmentText(seg: BodySegment): string {
  if (typeof seg === 'string') return seg;
  if ('bold' in seg) return `**${seg.bold}**`;
  return `{{${seg.var}${seg.when !== undefined ? `?${seg.when}` : ''}${seg.fallback !== undefined ? `|${seg.fallback}` : ''}}}`;
}
/** A section's words as blocks. `joinBodyBlocks` gives the same words back, byte for byte, for any body that has no blank lines at its ends. */
export function parseBodyBlocks(body: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  let blanks: string[] = [];
  let cur: { kind: BodyBlock['kind']; raw: string; sep: string } | null = null;
  const done: { kind: BodyBlock['kind']; raw: string; sep: string }[] = [];
  const sepFor = (): string => (done.length || cur ? '\n' : '') + blanks.map((b) => `${b}\n`).join('');
  for (const line of body.split('\n')) {
    if (!line.trim()) {
      if (cur) done.push(cur);
      cur = null;
      blanks.push(line);
      continue;
    }
    const kind: BodyBlock['kind'] = /^###\s/.test(line) ? 'h3' : /^- /.test(line) ? 'li' : /^\*\*[^*\n]+\*\*$/.test(line.trim()) && line === line.trim() ? 'strong' : 'p';
    if (kind === 'p' && cur?.kind === 'p' && blanks.length === 0) {
      cur.raw += `\n${line}`;
      continue;
    }
    const sep = sepFor();
    if (cur) done.push(cur);
    cur = { kind, raw: line, sep };
    blanks = [];
  }
  if (cur) done.push(cur);
  for (const d of done) {
    const inner = d.kind === 'h3' ? d.raw.replace(/^###\s/, '') : d.kind === 'li' ? d.raw.slice(2) : d.kind === 'strong' ? d.raw.slice(2, -2) : d.raw;
    blocks.push({ kind: d.kind, segments: segmentsOf(inner), sep: d.sep });
  }
  return blocks;
}
const PREFIX: Record<BodyBlock['kind'], [string, string]> = { p: ['', ''], li: ['- ', ''], h3: ['### ', ''], strong: ['**', '**'] };
/** Blocks back to a section's words. A block with no `sep` (a new one) gets one line break after a bullet before a bullet, else a blank line. */
export function joinBodyBlocks(blocks: readonly BodyBlock[]): string {
  return blocks
    .map((b, i) => {
      const prev = blocks[i - 1];
      const sep = i === 0 ? '' : b.sep && b.sep.includes('\n') ? b.sep : b.kind === 'li' && prev?.kind === 'li' ? '\n' : '\n\n';
      const [a, z] = PREFIX[b.kind];
      return `${sep}${b.lead ? `**${b.lead}** ` : ''}${a}${b.segments.map(segmentText).join('')}${z}`;
    })
    .join('');
}

/** A link a client may give: http or https, a real host, no spaces and no user name or password in it. */
function linkOk(s: string): boolean {
  return s.length <= 500 && /^https?:\/\/([a-z0-9-]+\.)+[a-z]{2,}(:\d{2,5})?([/?#][^\s]*)?$/i.test(s);
}
/**
 * The client's answers to a document's questions, cleaned: only questions the document has, only options it offered (one unless it takes
 * several), "Other" and a written answer only where asked, a field only where the question names it, and links only http or https, at most
 * the question's own number. Anything else is dropped. The one reader of answers, on every route that takes them.
 */
export function cleanContractAnswers(doc: Pick<ContractDoc, 'sections'>, raw: unknown): Record<string, ContractAnswer> {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Record<string, ContractAnswer> = {};
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  for (const section of doc.sections) {
    for (const q of section.questions ?? []) {
      const a = (hasOwn(r, q.id) && r[q.id] && typeof r[q.id] === 'object' ? r[q.id] : {}) as Record<string, unknown>;
      const picked = [...new Set((Array.isArray(a.picked) ? a.picked : []).filter((x): x is string => typeof x === 'string' && q.options.includes(x)))].slice(0, q.multi ? q.options.length : 1);
      const answer: ContractAnswer = { picked, other: q.other ? str(a.other, 200) : '', text: q.text ? str(a.text, 1500) : '' };
      if ((q.fields ?? []).length) {
        const given = (a.fields && typeof a.fields === 'object' ? a.fields : {}) as Record<string, unknown>;
        const fields: Record<string, string> = {};
        for (const f of q.fields ?? []) if (hasOwn(given, f)) fields[f] = str(given[f], 300);
        answer.fields = fields;
      }
      if (q.links) {
        answer.links = (Array.isArray(a.links) ? a.links : [])
          .map((l) => str(l, 500))
          .filter(linkOk)
          .slice(0, q.links.max);
      }
      out[q.id] = answer;
    }
  }
  return out;
}

/** What invoiceAsText needs from an invoice. */
export type InvoiceTextSource = Pick<Invoice, 'number' | 'ownerName' | 'clientName' | 'items' | 'currency' | 'issueDate' | 'dueDate' | 'note' | 'doc'>;

/**
 * An invoice as plain text for an email: who it is from and to, the lines, the sums (discount, GST or CGST and SGST, TDS) in whole cents,
 * the total in words, the bank details and the notes. Pass the client's version (`invoiceForClient`) to leave out what the client may not see.
 */
export function invoiceAsText(inv: InvoiceTextSource, totals?: InvoiceTotals): string {
  const d = inv.doc;
  const t = totals ?? invoiceTotals(inv.items, d);
  const cur = inv.currency;
  const party = (p: InvoiceParty, fallback: string): string[] => [p.name || fallback, p.line, ...p.taxIds.map((x) => `${x.label}: ${x.value}`), ...p.address.split('\n'), p.email, p.phone].map((x) => x.trim()).filter(Boolean);
  const out: string[] = [`${(d.title || 'Invoice').toUpperCase()} ${inv.number}`.trim()];
  out.push(`Date: ${docDate(inv.issueDate)}`);
  if (inv.dueDate) out.push(`Payment due by: ${docDate(inv.dueDate)}`);
  out.push('', 'From:', ...party(d.from, inv.ownerName), '', 'Billed To:', ...party(d.to, inv.clientName), '', 'Items:');
  inv.items.forEach((i, n) => out.push(`${n + 1}. ${i.description}: ${invoiceQty(i.quantity, d.qtyPad)} x ${money(i.unitCents, cur)} = ${money(i.quantity * i.unitCents, cur)}`));
  out.push('', `Subtotal: ${money(t.subtotal, cur)}`);
  if (t.discount > 0) out.push(`${d.discountMode === 'percent' ? `Discount (${d.discountValue / 100}%)` : 'Discount'}: -${money(t.discount, cur)}`);
  if (d.gstBps > 0 || t.gst > 0) {
    if (d.gstSplit) {
      out.push(`CGST (${d.gstBps / 200}%): ${money(t.cgst, cur)}`, `SGST (${d.gstBps / 200}%): ${money(t.sgst, cur)}`);
    } else out.push(`${cur === 'INR' ? 'IGST' : 'GST'} (${d.gstBps / 100}%): ${money(t.gst, cur)}`); // one rate, not split: IGST, for a client in another state
  }
  if (d.tdsMode === 'grossup') out.push(`TDS adjusted: ${money(t.tdsAdjusted, cur)}`);
  out.push(`Total: ${money(t.total, cur)}`);
  if (d.show.words) out.push(`TOTAL AMOUNT IN WORDS : ${amountInWords(t.total, cur)}`);
  if ((d.tdsMode === 'show' || d.tdsMode === 'grossup') && t.tdsDeducted > 0) out.push(`TDS to deduct (${d.tdsBps / 100}%): -${money(t.tdsDeducted, cur)}`, `To pay after TDS: ${money(t.netReceivable, cur)}`);
  const bank = [d.bank.bankName && `Bank Name: ${d.bank.bankName}`, d.bank.holder && `Account holder: ${d.bank.holder}`, d.bank.account && `Account number: ${d.bank.account}`, d.bank.ifsc && `IFSC code: ${d.bank.ifsc}`, d.bank.upi && `UPI Details: ${d.bank.upi}`].filter((x): x is string => Boolean(x));
  if (bank.length) out.push('', 'Bank account details:', ...bank);
  if (inv.note.trim()) out.push('', inv.note.trim());
  for (const line of invoiceFootnote(d)) out.push('', line);
  if (d.footer.trim()) out.push('', d.footer.trim());
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---- other kinds of document, in the same page and the same editor as an agreement

export const AGENCY_DOC_KINDS = ['brief', 'trial_terms', 'retainer_proposal', 'monthly_report'] as const;
export type AgencyDocKind = (typeof AGENCY_DOC_KINDS)[number];
export const AGENCY_DOC_KIND_META: Record<AgencyDocKind, { name: string; blurb: string; refPrefix: string }> = {
  brief: { name: 'Strategy session summary', blurb: 'What was agreed, goals, audience, channels, content pillars and next steps. The client reads it and approves.', refPrefix: 'BRF' },
  trial_terms: { name: 'Trial video terms', blurb: 'The rules of a trial and the pilot that follows: what the trial is for, content use, the steps after it, and how revisions work.', refPrefix: 'TRL' },
  retainer_proposal: { name: 'Retainer proposal', blurb: 'The months on offer, the monthly fee, what is delivered and how revisions work.', refPrefix: 'PRP' },
  monthly_report: { name: 'Monthly report', blurb: 'Pieces delivered, changes used, invoices and next month, filled in from your Agency numbers.', refPrefix: 'RPT' },
};
export const AGENCY_DOC_STATUSES = ['draft', 'sent', 'approved', 'revised'] as const;
export type AgencyDocStatus = (typeof AGENCY_DOC_STATUSES)[number];
export const AGENCY_DOC_STATUS_NAME: Record<AgencyDocStatus, string> = { draft: 'Draft', sent: 'Sent', approved: 'Approved', revised: 'Revised' };
export const AGENCY_DOC_STATUS_TONE: Record<AgencyDocStatus, TagTone> = { draft: 'neutral', sent: 'info', approved: 'good', revised: 'warn' };
export const isAgencyDocKind = (v: unknown): v is AgencyDocKind => typeof v === 'string' && (AGENCY_DOC_KINDS as readonly string[]).includes(v);
export const MAX_AGENCY_DOCS = 300;

export interface AgencyDocListItem {
  id: string;
  clientId: string | null;
  clientName: string;
  kind: AgencyDocKind;
  title: string;
  status: AgencyDocStatus;
  sentAt: string | null;
  approvedAt: string | null;
  updatedAt: string;
}
export interface AgencyDocFull extends AgencyDocListItem {
  doc: ContractDoc;
  /** The client link is /d/<token> once it is sent. */
  token: string | null;
  ref: string;
  revisedAt: string | null;
  acceptance: { name: string; title: string; at: string } | null;
  answers: Record<string, ContractAnswer>;
  createdAt: string;
}
/** What a client sees at a document's link. */
export interface PublicAgencyDoc {
  ref: string;
  ownerName: string;
  kind: AgencyDocKind;
  status: AgencyDocStatus;
  sentAt: string | null;
  revisedAt: string | null;
  comments: DocComment[];
  doc: ContractDoc;
  answers: Record<string, ContractAnswer>;
  acceptance: { name: string; title: string; at: string } | null;
}
/** A line in a document's private log. */
export interface DocLogLine {
  id: string;
  event: string;
  detail: string;
  createdAt: string;
}
/** A house template, as the admin's list reads it. */
export interface HouseTemplate {
  id: string;
  kind: DocTemplateKind;
  name: string;
  summary: string;
  includeBusiness: boolean;
  status: 'active' | 'retired';
  createdAt: string;
  updatedAt: string;
}

const sec = (id: string, heading: string, body: string): ContractSection => ({ id, heading, kind: 'text', body });
const APPROVAL = (heading: string, body: string): ContractSection => ({ id: 'sign', heading, kind: 'signatures', body });

/** What a retainer proposal is built from. The retainer part of Agency can pass real data; until then the person types it. */
export interface RetainerInput {
  monthlyFeeCents: number;
  /** The month lengths on offer, such as 1, 3 and 6. */
  months: number[];
  deliverables: string[];
  revisionRounds: number;
  notes: string;
}
export const emptyRetainerInput = (): RetainerInput => ({ monthlyFeeCents: 0, months: [1, 3, 6], deliverables: [], revisionRounds: 2, notes: '' });
export function parseRetainerInput(v: unknown): RetainerInput {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const e = emptyRetainerInput();
  const months = (Array.isArray(o.months) ? o.months : e.months)
    .map((m) => Math.round(Number(m)))
    .filter((m) => Number.isFinite(m) && m >= 1 && m <= 36)
    .slice(0, 6);
  return {
    monthlyFeeCents: Math.max(0, Math.min(1_000_000_000_00, Math.round(Number(o.monthlyFeeCents)) || 0)),
    months: [...new Set(months)].sort((a, b) => a - b).length ? [...new Set(months)].sort((a, b) => a - b) : e.months,
    deliverables: (Array.isArray(o.deliverables) ? o.deliverables : []).map((d) => cleanText(d, 160)).filter(Boolean).slice(0, 12),
    revisionRounds: Math.max(0, Math.min(10, Math.round(Number(o.revisionRounds)) || e.revisionRounds)),
    notes: cleanText(o.notes, 600),
  };
}
const ROUNDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

/** A retainer proposal: the months on offer priced from the monthly fee, what is delivered, and how revisions work. */
export function retainerProposalDoc(input: Partial<RetainerInput> = {}): ContractDoc {
  const r = parseRetainerInput({ ...emptyRetainerInput(), ...input });
  const rounds = r.revisionRounds === 0 ? 'Changes are quoted separately.' : `${ROUNDS[r.revisionRounds]} ${r.revisionRounds === 1 ? 'round' : 'rounds'} of small edit-level changes (text, trims, order, captions) ${r.revisionRounds === 1 ? 'is' : 'are'} included for each piece. A new concept, format or new footage is quoted separately.`;
  return {
    title: 'Retainer proposal',
    subtitle: 'Monthly content services',
    templateKey: 'retainer_proposal',
    show: { comments: true, download: true },
    currency: 'INR',
    vars: {},
    style: defaultDocStyle(),
    sections: [
      sec('summary', 'Summary', 'Prepared for {{client}} by {{providerBusiness}}.\n\nThis is a proposal for monthly content work for the brand or brands: {{brands}}. Pick one of the options below and approve this page to go ahead.'),
      { id: 'options', heading: 'Options and fee', kind: 'packages', body: `The monthly fee is the same in every option${r.monthlyFeeCents > 0 ? '' : ' (to be filled in)'}; a longer option is simply paid for more months. The fee is paid in advance, on or before the first day of each month. Fees do not include taxes such as GST.`, unitName: 'months', packages: r.months.map((m) => ({ name: `${m} ${m === 1 ? 'month' : 'months'}`, units: m, feeCents: r.monthlyFeeCents * m })) },
      sec('included', 'What is delivered each month', r.deliverables.length ? r.deliverables.map((d) => `- ${d}`).join('\n') : '- Pieces a month: {{pieces}}\n- Channels: {{channels}}\n- Hours of work included a month: {{hours}}'),
      sec('revisions', 'Revisions', rounds),
      ...(r.notes ? [sec('notes', 'Notes', r.notes)] : []),
      APPROVAL('Approval', 'By approving, the client confirms they have read this proposal and wish to go ahead with the option they chose.'),
    ],
  };
}

/** The facts a monthly report is made from. Counts and titles only: no fees, no private notes, no time line by line. */
export interface MonthlyReportFacts {
  clientName: string;
  /** YYYY-MM. */
  month: string;
  published: { title: string }[];
  inReview: number;
  open: number;
  /** How many times pieces published this month were sent back for changes. */
  revisionsUsed: number;
  invoicesRaised: number;
  invoicesPaid: number;
}
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function monthName(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  return m ? `${MONTH_NAMES[Number(m[2]) - 1] ?? ''} ${m[1]}` : month;
}
export function monthlyReportDoc(f: MonthlyReportFacts): ContractDoc {
  const n = f.published.length;
  const shown = f.published.slice(0, 20);
  return {
    title: `Monthly report, ${monthName(f.month)}`,
    subtitle: f.clientName,
    templateKey: 'monthly_report',
    show: { comments: true, download: true },
    currency: 'INR',
    vars: {},
    style: defaultDocStyle(),
    sections: [
      sec('numbers', 'This month in numbers', `- Pieces delivered: ${n}\n- Pieces waiting for your review: ${f.inReview}\n- Pieces still being made: ${f.open}\n- Changes used: ${f.revisionsUsed}\n- Invoices raised: ${f.invoicesRaised}\n- Invoices paid: ${f.invoicesPaid}`),
      sec('delivered', 'What was delivered', n === 0 ? 'Nothing was published this month.' : `${shown.map((p) => `- ${p.title}`).join('\n')}${n > shown.length ? `\n- and ${n - shown.length} more` : ''}`),
      sec('changes', 'Changes used', `Pieces were sent back for changes ${f.revisionsUsed} ${f.revisionsUsed === 1 ? 'time' : 'times'} this month. Small edit-level changes such as text, trims, order and captions are part of the process. A new concept, format, set-up, new footage or a reshoot is discussed separately before it is started.`),
      sec('invoices', 'Invoices', `${f.invoicesRaised} ${f.invoicesRaised === 1 ? 'invoice was' : 'invoices were'} raised this month and ${f.invoicesPaid} ${f.invoicesPaid === 1 ? 'was' : 'were'} paid.`),
      sec('next', 'Plan for next month', ''),
      APPROVAL('Received', 'The client confirms they have read this report.'),
    ],
  };
}

const TRIAL = CONTRACT_TEMPLATE_BY_KEY.trial?.doc.sections ?? [];
const trialPart = (id: string, heading: string): ContractSection => {
  const s = TRIAL.find((x) => x.id === id);
  // The trial agreement points to its own section numbers; on this page they point to the parts named here, and its numbered subheads
  // ("8.1 What We Are Building") lose the numbers that belong to the agreement.
  const body = (s?.body ?? '')
    .replace('as described in Section 8.12', 'as described under "How we work" below')
    .replace('from Section 6', 'from the packages in the pilot agreement')
    .replace('the items listed in Section 8.11. The completed brief in Section 3 is', 'the items listed under "How we work" below. The completed trial brief is')
    .replace(/^### \d+(\.\d+)*\s+/gm, '### ');
  return sec(id, heading, body);
};

const STARTERS: Record<AgencyDocKind, () => ContractDoc> = {
  brief: () => ({
    title: 'Strategy session summary',
    subtitle: 'What we agreed',
    templateKey: 'brief',
    show: { comments: true, download: true },
    currency: 'INR',
    vars: {},
    style: defaultDocStyle(),
    sections: [
      sec('about', 'The session', '**Client:** {{client}}\n**Brand or brands:** {{brands}}\n**Point of contact:** {{clientContact}}\n**Prepared by:** {{provider}}, {{providerBusiness}}\n\nDate of the session: {{sessionDate}}\nPeople in the session: {{clientContact}}, {{provider}}'),
      sec('agreed', 'What we agreed', ''),
      sec('goals', 'Goals', 'Results depend on the platform, the audience, the account, ad spend and the offer, so no particular views, reach, sales or return can be promised.'),
      sec('audience', 'Audience', ''),
      sec('channels', 'Channels', '- {{channels}}\n- Pieces a month: {{pieces}}'),
      sec('pillars', 'Content pillars', ''),
      sec('next', 'Next steps', ''),
      APPROVAL('Approval', 'By approving, the client confirms this summary reflects the session. A change can be asked for in writing.'),
    ],
  }),
  trial_terms: () => ({
    title: 'Trial video terms',
    subtitle: 'Trial and pilot rules',
    templateKey: 'trial_terms',
    show: { comments: true, download: true },
    currency: 'INR',
    vars: {},
    style: defaultDocStyle(),
    sections: [
      sec('details', 'Trial details', '**Client:** {{client}}\n**Brand or brands for this trial:** {{brands}}\n**Point of contact:** {{clientContact}}\n\nNumber of trial pieces: {{trialPieces}}\nTrial fee, if any: {{trialFee}}\nShoot or delivery dates: {{deliveryDate}}'),
      trialPart('purpose', 'Purpose of the trial'),
      trialPart('ownership', 'Trial content, ownership and use'),
      trialPart('after', 'What happens after the trial'),
      trialPart('how', 'How we work'),
      APPROVAL('Acceptance', 'By approving, the client confirms they have read and agree to these trial terms.'),
    ],
  }),
  retainer_proposal: () => retainerProposalDoc(),
  monthly_report: () => monthlyReportDoc({ clientName: '', month: '', published: [], inReview: 0, open: 0, revisionsUsed: 0, invoicesRaised: 0, invoicesPaid: 0 }),
};
/** A new document of this kind, ready to fill in. A report is better made with `monthlyReportDoc`, which has the month's facts. */
export function agencyDocStarter(kind: AgencyDocKind, retainer?: Partial<RetainerInput>): ContractDoc {
  return kind === 'retainer_proposal' ? retainerProposalDoc(retainer) : STARTERS[kind]();
}

/** What a house template keeps of a document: everything but the names filled in and, unless the admin chose to include them, their own business details. */
export function houseDoc(doc: ContractDoc, includeBusiness: boolean): ContractDoc {
  const style = parseDocStyle(doc.style);
  return { ...doc, vars: {}, style: includeBusiness ? style : { ...style, logo: '', footer: '' } };
}
export function houseInvoiceDoc(doc: InvoiceDoc, includeBusiness: boolean): InvoiceDoc {
  const style = parseDocStyle(doc.style);
  const base = invoiceTemplateDoc(doc);
  return includeBusiness ? { ...base, style } : { ...base, from: emptyParty(), bank: emptyBank(), footer: '', style: { ...style, logo: '', footer: '' } };
}
