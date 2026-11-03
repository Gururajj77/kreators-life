import { Hono } from 'hono';
import {
  CONTRACT_STATUSES,
  contractAsText,
  contractTemplateDoc,
  docRef,
  houseDoc,
  houseInvoiceDoc,
  invoiceAsText,
  invoiceForClient,
  parseDocStyle,
  type DocLogLine,
  type DocStyle,
  type BusinessProfile,
  INVOICE_STARTER_BY_KEY,
  invoiceTemplateDoc,
  MAX_TEMPLATES,
  DOC_TEMPLATE_KINDS,
  TEMPLATE_KINDS,
  type DocTemplateKind,
  TEMPLATE_NAME_MAX,
  templateSummary,
  type AgencyTemplate,
  type TemplateKind,
  DOC_COMMENT_MAX,
  DOC_TYPES,
  defaultDocStyle,
  type DocComment,
  type DocType,
  CONTRACT_TEMPLATE_BY_KEY,
  contractVarsFor,
  cleanContractAnswers,
  parseOnboarding,
  withProfilePackages,
  docFromProfile,
  INVOICE_STATUSES,
  invoiceTotals,
  MAX_INVOICE_LINES,
  monthBounds,
  parseContractDoc,
  parseInvoiceDoc,
  type AgencyContract,
  type ContractAnswer,
  type ContractClientFacts,
  type ContractDoc,
  type ContractSection,
  type ContractListItem,
  type ContractStatus,
  type InvoiceDoc,
  type InvoiceItem,
  type PublicContract,
  monthName,
  tdsGrossupNote,
  invoiceFromProfile,
} from '@kreators/shared';
import type { AppEnv } from '../env';
import { audit, dayFromDevice, nameOf, newId, notify, nowIso, num, oneOf, pageOf, paged, randomCode, shiftDate, str } from '../db';
import { dateOrNull } from '../agencyUtil';
import { createInvoice, INV_SELECT, nextNumberAfter, setInvoiceStatus, toInvoice, updateDraftInvoice, type InvRow } from './finance';
import { billingOf, settingsFor } from './agency';
import { parseEmailNote } from '@kreators/shared/agencyEmail';
import { coverFrom, emailCopy, emailProblem, logDoc, maskEmail, ownLogo, publicUrl } from '../agencyPaper';

/**
 * Agency's paper: designed invoices with a calculator, and agreements made from a template. Owner only, like the rest of Agency;
 * the client's side of an agreement is the public link at /public/contracts.
 */
export const agencyDocs = new Hono<AppEnv>();
export const contractsPublic = new Hono<AppEnv>();

/** The day the request's device is on (`?day=`), else today in UTC: what a new invoice's dates count from. */
const deviceDay = (c: { req: { query: (k: string) => string | undefined } }) => dayFromDevice(c.req.query('day'));

export function itemsIn(v: unknown): InvoiceItem[] {
  return (Array.isArray(v) ? v : [])
    .map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}))
    .map((x) => ({ description: str(x.description, 200), quantity: num(x.quantity, 1, 1, 100000) ?? 1, unitCents: num(x.unitCents, 0, 0, 1_000_000_000_00) ?? 0 }))
    .filter((x) => x.description)
    .slice(0, MAX_INVOICE_LINES);
}

export interface ClientBits {
  id: string;
  name: string;
  contact_name: string;
  contact_email: string;
  billing_json: string;
  channels_json?: string;
  pieces_per_month?: number;
  hours_per_month?: number;
  revisions_per_piece?: number;
  retainer_cents?: number;
  /** What the client wrote in onboarding (migration 0071): the designation and the brands fill an agreement's blanks. */
  onboarding_json?: string;
}
export async function clientBits(db: D1Database, userId: string, id: unknown): Promise<ClientBits | null> {
  if (typeof id !== 'string' || !id) return null;
  const base = 'SELECT id, name, contact_name, contact_email, billing_json, channels_json, pieces_per_month, hours_per_month, revisions_per_piece, retainer_cents';
  try {
    return await db.prepare(`${base}, onboarding_json FROM agency_clients WHERE id = ? AND user_id = ?`).bind(id, userId).first<ClientBits>();
  } catch {
    // A database that has not had migration 0071 yet has no onboarding column; the rest of the record still fills the paper.
    return db.prepare(`${base} FROM agency_clients WHERE id = ? AND user_id = ?`).bind(id, userId).first<ClientBits>();
  }
}

/** Everything a client's record already answers for a new document, so nothing it knows is asked again (contractVarsFor). */
export function clientFacts(client: ClientBits, currency: string): ContractClientFacts {
  let channels: string[] = [];
  try {
    const v = JSON.parse(client.channels_json || '[]') as unknown;
    if (Array.isArray(v)) channels = v.filter((x): x is string => typeof x === 'string');
  } catch {
    channels = [];
  }
  const onboarding = parseOnboarding(jsonOr<unknown>(client.onboarding_json ?? '{}', {}));
  return {
    name: client.name,
    address: billingOf(client).address,
    contactName: client.contact_name || onboarding.pocName,
    contactTitle: onboarding.designation,
    brands: onboarding.brands,
    channels,
    piecesPerMonth: client.pieces_per_month ?? 0,
    hoursPerMonth: client.hours_per_month ?? 0,
    revisionsPerPiece: client.revisions_per_piece,
    retainerCents: client.retainer_cents ?? 0,
    currency,
  };
}


/** A retainer agreement's fee table starts from the client's own retainer: its pieces a month and its monthly fee. Other tables stay as they are. */
export function fillRetainerFee(sections: ContractSection[], client: ClientBits | null): ContractSection[] {
  if (!client) return sections;
  return sections.map((s) => {
    if (s.kind !== 'packages' || s.id !== 'fees' || (s.packages ?? []).length !== 1) return s;
    const p = s.packages![0]!;
    if (p.name !== 'Monthly retainer') return s;
    return { ...s, packages: [{ ...p, units: (client.pieces_per_month ?? 0) > 0 ? client.pieces_per_month! : p.units, feeCents: (client.retainer_cents ?? 0) > 0 ? client.retainer_cents! : p.feeCents }] };
  });
}

/** A built-in invoice's lines, priced from what the client's record already says, so the first draft needs no typing. */
export function starterItems(items: InvoiceItem[], key: string, client: ClientBits, month: string): InvoiceItem[] {
  const fee = client.retainer_cents ?? 0;
  const pieces = client.pieces_per_month ?? 0;
  return items.map((i) => {
    if (key === 'retainer') return { ...i, description: `Monthly retainer, ${monthName(month)}`, unitCents: fee > 0 ? fee : i.unitCents };
    if (key === 'per-piece') return { ...i, quantity: pieces > 0 ? pieces : i.quantity, unitCents: fee > 0 && pieces > 0 ? Math.round(fee / pieces) : i.unitCents };
    if (key === 'advance' && fee > 0) return { ...i, unitCents: fee };
    // The one-line invoice starts at the month's fee too, so a first draft (and the email sent with it) never says "for ₹0".
    if (key === 'standard' && fee > 0 && i.unitCents === 0) return { ...i, description: `Content services, ${monthName(month)}`, unitCents: fee };
    return i;
  });
}

// ---- the person's own templates

export interface TemplateRow { id: string; kind: TemplateKind; name: string; doc_json: string; items_json: string; created_at: string; updated_at: string }
export function templateDoc(r: Pick<TemplateRow, 'kind' | 'doc_json' | 'items_json'>): { invoice: InvoiceDoc | null; contract: ContractDoc | null; items: InvoiceItem[] } {
  const items = itemsIn(jsonOr<unknown>(r.items_json, []));
  return r.kind === 'invoice' ? { invoice: parseInvoiceDoc(jsonOr<unknown>(r.doc_json, {})), contract: null, items } : { invoice: null, contract: parseContractDoc(jsonOr<unknown>(r.doc_json, null)), items };
}
function toTemplate(r: TemplateRow, scope: 'own' | 'house' = 'own'): AgencyTemplate {
  if (r.kind === 'email') {
    // An email note keeps its subject and words only; the summary is the subject, or the first line when there is none.
    const note = parseEmailNote(jsonOr<unknown>(r.doc_json, {})) ?? { subject: '', message: '' };
    return { id: r.id, scope, kind: r.kind, name: r.name, summary: note.subject || note.message.split('\n')[0]!.slice(0, 80), email: note, createdAt: r.created_at, updatedAt: r.updated_at };
  }
  const t = templateDoc(r);
  const doc = (t.invoice ?? t.contract)!;
  return { id: r.id, scope, kind: r.kind, name: r.name, summary: doc ? templateSummary(r.kind, doc, t.items) : '', createdAt: r.created_at, updatedAt: r.updated_at };
}

// ---- house templates: made by the super admin for every Agency user, read only here, copied into the person's own documents

export interface HouseRow { id: string; kind: DocTemplateKind; name: string; doc_json: string; items_json: string; include_business: number; status: 'active' | 'retired'; created_by: string | null; created_at: string; updated_at: string }
export async function activeHouse(db: D1Database, id: unknown, kind: DocTemplateKind): Promise<HouseRow | null> {
  if (typeof id !== 'string' || !id) return null;
  return db.prepare("SELECT * FROM agency_house_templates WHERE id = ? AND kind = ? AND status = 'active'").bind(id, kind).first<HouseRow>();
}
/** A house invoice template used by someone: their own details fill the sender and the bank unless the admin included theirs. */
function houseInvoice(row: HouseRow, profile: BusinessProfile): { doc: InvoiceDoc; items: InvoiceItem[] } {
  const t = templateDoc(row);
  const doc = t.invoice!;
  if (row.include_business) return { doc, items: t.items };
  const logo = parseDocStyle(profile.docStyle).logo;
  return { doc: { ...doc, from: invoiceFromProfile(profile), bank: profile.bank, footer: doc.footer || profile.footer, style: { ...parseDocStyle(doc.style), logo, footer: parseDocStyle(profile.docStyle).footer } }, items: t.items };
}
/** A house agreement or document used by someone: the names are theirs, the logo and footer fall back to their own default look. */
export function houseContract(row: HouseRow, profile: BusinessProfile): ContractDoc {
  const doc = templateDoc(row).contract!;
  if (row.include_business) return doc;
  const mine = parseDocStyle(profile.docStyle);
  return { ...doc, style: { ...parseDocStyle(doc.style), logo: mine.logo, footer: mine.footer } };
}
export async function ownTemplate(db: D1Database, userId: string, id: unknown, kind: DocTemplateKind): Promise<TemplateRow | null> {
  if (typeof id !== 'string' || !id) return null;
  return db.prepare('SELECT * FROM agency_templates WHERE id = ? AND user_id = ? AND kind = ?').bind(id, userId, kind).first<TemplateRow>();
}
/** What a template takes from an invoice or an agreement of the person's: its look and lines (never who it was for), or its sections (never the names). */
export async function snapshotOf(db: D1Database, userId: string, kind: DocTemplateKind, fromId: string): Promise<{ doc: unknown; items: InvoiceItem[] } | null> {
  if (kind === 'doc') {
    const row = await db.prepare('SELECT body_json FROM agency_docs WHERE id = ? AND user_id = ?').bind(fromId, userId).first<{ body_json: string }>();
    return row ? { doc: contractTemplateDoc(docOf(row.body_json)), items: [] } : null;
  }
  if (kind === 'invoice') {
    const row = await db.prepare(`${INV_SELECT} WHERE i.id = ? AND i.user_id = ? AND i.agency_client_id IS NOT NULL`).bind(fromId, userId).first<InvRow>();
    if (!row) return null;
    const inv = toInvoice(row);
    return { doc: invoiceTemplateDoc(inv.doc), items: inv.items };
  }
  const row = await db.prepare(`${CONTRACT_SELECT} WHERE k.id = ? AND k.user_id = ?`).bind(fromId, userId).first<ContractRow>();
  return row ? { doc: contractTemplateDoc(docOf(row.doc_json)), items: [] } : null;
}

// The person's own templates, then the house templates (made by the super admin, read only). One list for the picker.
agencyDocs.get('/templates', async (c) => {
  const kind = c.req.query('kind');
  const ok = kind && (TEMPLATE_KINDS as readonly string[]).includes(kind);
  const [own, house] = await Promise.all([
    c.env.DB
      .prepare(`SELECT * FROM agency_templates WHERE user_id = ?${ok ? ' AND kind = ?' : ''} ORDER BY updated_at DESC LIMIT ${MAX_TEMPLATES * 2}`)
      .bind(...[c.get('user').id, ...(ok ? [kind] : [])])
      .all<TemplateRow>(),
    c.env.DB
      .prepare(`SELECT * FROM agency_house_templates WHERE status = 'active'${ok ? ' AND kind = ?' : ''} ORDER BY name LIMIT 100`)
      .bind(...(ok ? [kind] : []))
      .all<HouseRow>(),
  ]);
  return c.json({ templates: [...own.results.map((r) => toTemplate(r)), ...house.results.map((r) => toTemplate(r, 'house'))] });
});

/** How many own templates of a kind the person has: each kind holds up to `MAX_TEMPLATES`. */
async function templateCount(db: D1Database, userId: string, kind: TemplateKind): Promise<number> {
  const n = await db.prepare('SELECT COUNT(*) AS n FROM agency_templates WHERE user_id = ? AND kind = ?').bind(userId, kind).first<{ n: number }>();
  return n?.n ?? 0;
}

// Save one of the person's invoices or agreements as a template, or replace what an existing template holds with it.
// An email note (`kind: 'email'`) is kept from the words sent with it: `{ name, subject, message }`, plain text, through `parseEmailNote`.
agencyDocs.post('/templates', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  if (body.kind === 'email') {
    const name = str(body.name, TEMPLATE_NAME_MAX);
    if (!name) return c.json({ error: 'give it a name' }, 400);
    const note = parseEmailNote(body);
    if (!note) return c.json({ error: 'write the email first' }, 400);
    if ((await templateCount(db, user.id, 'email')) >= MAX_TEMPLATES) return c.json({ error: `up to ${MAX_TEMPLATES} email notes; remove one first` }, 400);
    const id = newId();
    const now = nowIso();
    await db.prepare("INSERT INTO agency_templates (id, user_id, kind, name, doc_json, items_json, created_at, updated_at) VALUES (?, ?, 'email', ?, ?, '[]', ?, ?)").bind(id, user.id, name, JSON.stringify(note), now, now).run();
    return c.json({ id }, 201);
  }
  let kind: DocTemplateKind = oneOf(body.kind, DOC_TEMPLATE_KINDS, 'invoice');
  // A house template can be copied into the person's own templates; the copy is theirs to change.
  const fromHouse = typeof body.houseId === 'string' ? await db.prepare("SELECT * FROM agency_house_templates WHERE id = ? AND status = 'active'").bind(body.houseId).first<HouseRow>() : null;
  if (typeof body.houseId === 'string' && !fromHouse) return c.json({ error: 'that house template is not here any more' }, 404);
  if (fromHouse) kind = fromHouse.kind;
  const name = str(body.name, TEMPLATE_NAME_MAX) || (fromHouse ? str(fromHouse.name, TEMPLATE_NAME_MAX) : '');
  if (!name) return c.json({ error: 'give it a name' }, 400);
  const snap = fromHouse ? { doc: JSON.parse(fromHouse.doc_json) as unknown, items: itemsIn(jsonOr<unknown>(fromHouse.items_json, [])) } : typeof body.fromId === 'string' ? await snapshotOf(db, user.id, kind, body.fromId) : null;
  if (!snap) return c.json({ error: kind === 'invoice' ? 'pick one of your invoices' : kind === 'doc' ? 'pick one of your documents' : 'pick one of your agreements' }, 400);
  if ((await templateCount(db, user.id, kind)) >= MAX_TEMPLATES) return c.json({ error: `up to ${MAX_TEMPLATES} templates; remove one first` }, 400);
  const id = newId();
  const now = nowIso();
  await db.prepare('INSERT INTO agency_templates (id, user_id, kind, name, doc_json, items_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, user.id, kind, name, JSON.stringify(snap.doc), JSON.stringify(snap.items), now, now).run();
  return c.json({ id }, 201);
});

agencyDocs.patch('/templates/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT * FROM agency_templates WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first<TemplateRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const name = 'name' in body ? str(body.name, TEMPLATE_NAME_MAX) : row.name;
  if (!name) return c.json({ error: 'give it a name' }, 400);
  let doc = row.doc_json;
  let items = row.items_json;
  if (row.kind === 'email') {
    // A note's words change only when new ones are sent; a rename alone keeps them.
    if ('message' in body || 'subject' in body) {
      const old = parseEmailNote(jsonOr<unknown>(row.doc_json, {})) ?? { subject: '', message: '' };
      const note = parseEmailNote({ subject: 'subject' in body ? body.subject : old.subject, message: 'message' in body ? body.message : old.message });
      if (!note) return c.json({ error: 'write the email first' }, 400);
      doc = JSON.stringify(note);
    }
  } else if (typeof body.fromId === 'string') {
    const snap = await snapshotOf(db, user.id, row.kind, body.fromId);
    if (!snap) return c.json({ error: 'pick one of yours' }, 400);
    doc = JSON.stringify(snap.doc);
    items = JSON.stringify(snap.items);
  }
  await db.prepare('UPDATE agency_templates SET name = ?, doc_json = ?, items_json = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(name, doc, items, nowIso(), row.id, user.id).run();
  return c.json({ ok: true });
});

agencyDocs.delete('/templates/:id', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM agency_templates WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  if (!res.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

// ---- invoices

agencyDocs.get('/invoices', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const ask = pageOf(c);
  const status = c.req.query('status');
  const client = c.req.query('client');
  const where = ['i.user_id = ?', 'i.agency_client_id IS NOT NULL'];
  const binds: unknown[] = [user.id];
  if (status && (INVOICE_STATUSES as readonly string[]).includes(status)) {
    where.push('i.status = ?');
    binds.push(status);
  }
  if (client) {
    where.push('i.agency_client_id = ?');
    binds.push(client);
  }
  const [rows, counts] = await Promise.all([
    db.prepare(`${INV_SELECT} WHERE ${where.join(' AND ')} ORDER BY i.created_at DESC LIMIT ? OFFSET ?`).bind(...binds, ask.limit, ask.offset).all<InvRow>(),
    db.prepare('SELECT status, COUNT(*) AS n, COALESCE(SUM(total_cents), 0) AS cents FROM invoices WHERE user_id = ? AND agency_client_id IS NOT NULL GROUP BY status').bind(user.id).all<{ status: string; n: number; cents: number }>(),
  ]);
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, invoices: pg.items.map(toInvoice), counts: counts.results });
});

// The board: one column a status, with its count, its sum and the first cards.
agencyDocs.get('/invoices/board', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const per = Math.max(5, Math.min(100, Math.floor(Number(c.req.query('per')) || 25)));
  const client = c.req.query('client');
  const extra = client ? ' AND i.agency_client_id = ?' : '';
  const columns = await Promise.all(
    INVOICE_STATUSES.map(async (stage) => {
      const [rows, total] = await Promise.all([
        db.prepare(`${INV_SELECT} WHERE i.user_id = ? AND i.agency_client_id IS NOT NULL AND i.status = ?${extra} ORDER BY i.created_at DESC LIMIT ?`).bind(user.id, stage, ...(client ? [client] : []), per).all<InvRow>(),
        db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(total_cents), 0) AS cents FROM invoices i WHERE i.user_id = ? AND i.agency_client_id IS NOT NULL AND i.status = ?${extra}`).bind(user.id, stage, ...(client ? [client] : [])).first<{ n: number; cents: number }>(),
      ]);
      return { stage, total: total?.n ?? 0, cents: total?.cents ?? 0, items: rows.results.map(toInvoice) };
    }),
  );
  return c.json({ columns });
});

agencyDocs.get('/invoices/:id', async (c) => {
  const row = await c.env.DB.prepare(`${INV_SELECT} WHERE i.id = ? AND i.user_id = ? AND i.agency_client_id IS NOT NULL`).bind(c.req.param('id'), c.get('user').id).first<InvRow>();
  return row ? c.json({ invoice: toInvoice(row), version: invoiceVersion(row) }) : c.json({ error: 'not found' }, 404);
});

// A new invoice starts from the person's profile (who it is from, the bank, the look, GST and TDS) and the client's billing details.
agencyDocs.post('/invoices', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const client = await clientBits(db, user.id, body.clientId);
  if (!client) return c.json({ error: 'pick a client' }, 400);
  const settings = await settingsFor(db, user.id);
  // It starts from one of the person's templates, a built-in starting point, or the profile alone; what they send on top wins.
  const tpl = body.templateId ? await ownTemplate(db, user.id, body.templateId, 'invoice') : null;
  if (body.templateId && !tpl) return c.json({ error: 'that template is not yours' }, 400);
  const house = body.houseId ? await activeHouse(db, body.houseId, 'invoice') : null;
  if (body.houseId && !house) return c.json({ error: 'that house template is not here any more' }, 404);
  const starter = typeof body.starter === 'string' ? INVOICE_STARTER_BY_KEY[body.starter] : undefined;
  let base = { ...docFromProfile(settings.profile), to: billingOf(client) };
  let starting: InvoiceItem[] = [];
  if (house) {
    // A house template is copied: the invoice is the person's own, so they can restyle it freely.
    const h = houseInvoice(house, settings.profile);
    base = { ...h.doc, to: billingOf(client) };
    starting = h.items;
  } else if (tpl) {
    const t = templateDoc(tpl);
    // A template saved without the sender's details (a copy of a house template) takes the person's own.
    base = { ...t.invoice!, from: t.invoice!.from.name ? t.invoice!.from : invoiceFromProfile(settings.profile), bank: t.invoice!.bank.account || t.invoice!.bank.upi ? t.invoice!.bank : settings.profile.bank, to: billingOf(client) };
    starting = t.items;
  } else if (starter) {
    // The advance starter's TDS line carries the person's own rate, and is left off when they have none.
    const footnote = starter.key === 'advance' ? (settings.profile.tdsBps > 0 ? tdsGrossupNote(settings.profile.tdsBps) : '') : starter.footnote;
    base = { ...base, title: starter.title, footnote: footnote || base.footnote };
    starting = starterItems(starter.items, starter.key, client, deviceDay(c).slice(0, 7));
  }
  const parsed = parseInvoiceDoc(body.doc, base);
  const doc = house ? parsed : await ownLogo(db, user.id, parsed, parseDocStyle(base.style).logo);
  const items = Array.isArray(body.items) ? itemsIn(body.items) : starting;
  if (items.length === 0) return c.json({ error: 'at least one line' }, 400);
  const invoice = await createInvoice(db, user.id, {
    clientName: client.name,
    clientEmail: doc.to.email || client.contact_email,
    items,
    dueDate: dateOrNull(body.dueDate) ?? shiftDate(deviceDay(c), settings.profile.payDays),
    issueDate: dateOrNull(body.issueDate) ?? deviceDay(c),
    note: str(body.note, 500),
    currency: settings.currency,
    agencyClientId: client.id,
    doc,
    prefix: settings.profile.invoicePrefix,
  });
  return c.json({ invoice }, 201);
});

// The month's retainer and the fees of what went live, as a draft the person can then open in the designer.
agencyDocs.post('/clients/:id/invoice', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare('SELECT id, name, contact_name, contact_email, billing_json, retainer_cents FROM agency_clients WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first<ClientBits & { retainer_cents: number }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ month?: string }>().catch(() => ({}) as { month?: string });
  const month = body.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(body.month) ? body.month : deviceDay(c).slice(0, 7);
  const { start, end } = monthBounds(month);
  const fees = await db
    .prepare("SELECT title, fee_cents FROM agency_items WHERE client_id = ? AND user_id = ? AND stage = 'published' AND fee_cents > 0 AND published_day >= ? AND published_day <= ? ORDER BY published_day LIMIT 29")
    .bind(row.id, user.id, start, end)
    .all<{ title: string; fee_cents: number }>();
  const items: InvoiceItem[] = [];
  if (row.retainer_cents > 0) items.push({ description: `Monthly retainer, ${month}`, quantity: 1, unitCents: row.retainer_cents });
  for (const f of fees.results) items.push({ description: f.title, quantity: 1, unitCents: f.fee_cents });
  if (items.length === 0) return c.json({ error: 'nothing to invoice: set a retainer or a fee on a published deliverable' }, 400);
  const settings = await settingsFor(db, user.id);
  const invoice = await createInvoice(db, user.id, {
    clientName: row.name,
    clientEmail: row.contact_email,
    items,
    dueDate: shiftDate(deviceDay(c), settings.profile.payDays),
    issueDate: deviceDay(c),
    note: '',
    currency: settings.currency,
    agencyClientId: row.id,
    doc: { ...docFromProfile(settings.profile), to: billingOf(row) },
    prefix: settings.profile.invoicePrefix,
  });
  return c.json({ invoice }, 201);
});

// A status change (sent, paid, void) works on any invoice. Anything else changes a draft or a sent one; a paid invoice must be taken back to sent first, so the books stay true.
agencyDocs.patch('/invoices/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare(`${INV_SELECT} WHERE i.id = ? AND i.user_id = ? AND i.agency_client_id IS NOT NULL`).bind(c.req.param('id'), user.id).first<InvRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  if (typeof body.status === 'string') {
    const invoice = await setInvoiceStatus(db, user.id, row.id, body.status);
    return invoice ? c.json({ invoice }) : c.json({ error: 'not found' }, 404);
  }
  if (row.status === 'paid') return c.json({ error: 'a paid invoice must be marked sent again before it can change' }, 400);
  if (row.status === 'void') return c.json({ error: 'a void invoice cannot change' }, 400);
  // Saving as you go: invoices have no updated_at, so the page sends the version it read (`ifVersion`, from GET and every PATCH answer).
  if (typeof body.ifVersion === 'string' && body.ifVersion !== invoiceVersion(row)) return c.json({ error: 'changed' }, 409);
  const prev = toInvoice(row);
  const doc = await ownLogo(db, user.id, parseInvoiceDoc(body.doc, prev.doc), parseDocStyle(prev.doc.style).logo);
  const items = 'items' in body ? itemsIn(body.items) : prev.items;
  if (items.length === 0) return c.json({ error: 'at least one line' }, 400);
  let number: string | undefined;
  if (typeof body.number === 'string' && body.number.trim() && body.number.trim() !== row.number) {
    number = str(body.number, 30);
    const taken = await db.prepare('SELECT 1 AS x FROM invoices WHERE user_id = ? AND number = ? AND id != ?').bind(user.id, number, row.id).first();
    if (taken) return c.json({ error: 'you already have an invoice with that number' }, 400);
  }
  const invoice = await updateDraftInvoice(db, user.id, row.id, {
    number,
    clientName: prev.clientName,
    clientEmail: doc.to.email || prev.clientEmail,
    items,
    issueDate: dateOrNull(body.issueDate),
    dueDate: 'dueDate' in body ? dateOrNull(body.dueDate) : prev.dueDate,
    note: 'note' in body ? str(body.note, 500) : prev.note,
    doc,
  });
  if (!invoice) return c.json({ error: 'not found' }, 404);
  const after = await db.prepare(`${INV_SELECT} WHERE i.id = ? AND i.user_id = ?`).bind(row.id, user.id).first<InvRow>();
  return c.json({ invoice, totals: invoiceTotals(invoice.items, invoice.doc), version: after ? invoiceVersion(after) : '' });
});

/** A short fingerprint of an invoice's editable content: the version the page read, checked before a save lands (`ifVersion`). */
export function invoiceVersion(r: Pick<InvRow, 'doc_json' | 'items_json' | 'number' | 'issue_date' | 'due_date' | 'note' | 'status'>): string {
  const text = [r.status, r.number, r.issue_date, r.due_date ?? '', r.note, r.items_json, r.doc_json].join('\u0001');
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return `${text.length.toString(36)}-${h.toString(36)}`;
}

agencyDocs.delete('/invoices/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const res = await db.prepare("DELETE FROM invoices WHERE id = ? AND user_id = ? AND agency_client_id IS NOT NULL AND status = 'draft'").bind(c.req.param('id'), user.id).run();
  if (!res.meta.changes) return c.json({ error: 'only a draft can be removed; void a sent one' }, 400);
  await db.prepare("DELETE FROM agency_doc_comments WHERE doc_type = 'invoice' AND doc_id = ? AND user_id = ?").bind(c.req.param('id'), user.id).run();
  await db.prepare("DELETE FROM agency_doc_log WHERE doc_type = 'invoice' AND doc_id = ? AND user_id = ?").bind(c.req.param('id'), user.id).run();
  return c.json({ ok: true });
});

// A copy for the next time: the next number in the same series, today's date, the same gap to the due date, and any month in the
// lines (such as "Monthly retainer, 2026-09") moved on by the months between the old issue date and the new one.
agencyDocs.post('/invoices/:id/duplicate', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare(`${INV_SELECT} WHERE i.id = ? AND i.user_id = ? AND i.agency_client_id IS NOT NULL`).bind(c.req.param('id'), user.id).first<InvRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const prev = toInvoice(row);
  const issueDate = dateOrNull(body.issueDate) ?? deviceDay(c);
  const gap = prev.dueDate ? Math.max(0, Math.round((Date.parse(`${prev.dueDate}T00:00:00Z`) - Date.parse(`${prev.issueDate}T00:00:00Z`)) / 86_400_000)) : null;
  const dueDate = 'dueDate' in body ? dateOrNull(body.dueDate) : gap === null ? null : shiftDate(issueDate, gap);
  const months = (Number(issueDate.slice(0, 4)) - Number(prev.issueDate.slice(0, 4))) * 12 + (Number(issueDate.slice(5, 7)) - Number(prev.issueDate.slice(5, 7)));
  const bump = body.bumpMonths !== false && months !== 0;
  const items = prev.items.map((i) => ({ ...i, description: bump ? i.description.replace(/\b(\d{4})-(0[1-9]|1[0-2])\b/g, (_m, y: string, mo: string) => shiftMonthLabel(`${y}-${mo}`, months)) : i.description }));
  const number = typeof body.number === 'string' && body.number.trim() ? str(body.number, 30) : await nextNumberAfter(db, user.id, row.number);
  if (typeof body.number === 'string' && body.number.trim()) {
    const taken = await db.prepare('SELECT 1 AS x FROM invoices WHERE user_id = ? AND number = ?').bind(user.id, number).first();
    if (taken) return c.json({ error: 'you already have an invoice with that number' }, 400);
  }
  const invoice = await createInvoice(db, user.id, { clientName: prev.clientName, clientEmail: prev.clientEmail, items, dueDate, note: prev.note, currency: prev.currency, agencyClientId: row.agency_client_id ?? null, doc: prev.doc, number, issueDate });
  return c.json({ invoice }, 201);
});

/** "2026-09" moved on by n months. */
function shiftMonthLabel(label: string, n: number): string {
  const [y, m] = label.split('-').map(Number);
  return new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1 + n, 1)).toISOString().slice(0, 7);
}

// ---- comments on an invoice or an agreement: the client's, and the person's replies

const docOwned = async (db: D1Database, userId: string, type: DocType, id: string): Promise<boolean> =>
  Boolean(await db.prepare(type === 'invoice' ? 'SELECT 1 AS x FROM invoices WHERE id = ? AND user_id = ? AND agency_client_id IS NOT NULL' : type === 'doc' ? 'SELECT 1 AS x FROM agency_docs WHERE id = ? AND user_id = ?' : 'SELECT 1 AS x FROM agency_contracts WHERE id = ? AND user_id = ?').bind(id, userId).first());

agencyDocs.get('/comments/:type/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const type = c.req.param('type') as DocType;
  if (!(DOC_TYPES as readonly string[]).includes(type) || !(await docOwned(db, user.id, type, c.req.param('id')))) return c.json({ error: 'not found' }, 404);
  const rows = await db.prepare('SELECT id, author, body, created_at FROM agency_doc_comments WHERE doc_type = ? AND doc_id = ? AND user_id = ? ORDER BY created_at LIMIT 100').bind(type, c.req.param('id'), user.id).all<{ id: string; author: 'me' | 'client'; body: string; created_at: string }>();
  return c.json({ comments: rows.results.map((r): DocComment => ({ id: r.id, author: r.author, body: r.body, createdAt: r.created_at })) });
});

agencyDocs.post('/comments/:type/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const type = c.req.param('type') as DocType;
  if (!(DOC_TYPES as readonly string[]).includes(type) || !(await docOwned(db, user.id, type, c.req.param('id')))) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ body?: string }>().catch(() => ({}) as { body?: string });
  const text = str(body.body, DOC_COMMENT_MAX);
  if (!text) return c.json({ error: 'write something' }, 400);
  await db.prepare("INSERT INTO agency_doc_comments (id, user_id, doc_type, doc_id, author, body, created_at) VALUES (?, ?, ?, ?, 'me', ?, ?)").bind(newId(), user.id, type, c.req.param('id'), text, nowIso()).run();
  return c.json({ ok: true }, 201);
});

agencyDocs.delete('/comments/:id', async (c) => {
  const res = await c.env.DB.prepare("DELETE FROM agency_doc_comments WHERE id = ? AND user_id = ? AND author = 'me'").bind(c.req.param('id'), c.get('user').id).run();
  if (!res.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

// ---- contracts

export interface ContractRow {
  id: string; user_id: string; client_id: string | null; client_name: string | null; title: string; template_key: string; status: ContractStatus; doc_json: string; token: string | null; answers_json: string;
  acceptance_json: string | null; sent_at: string | null; signed_at: string | null; revised_at: string | null; created_at: string; updated_at: string;
}
export const CONTRACT_SELECT = 'SELECT k.*, (SELECT name FROM agency_clients c WHERE c.id = k.client_id) AS client_name FROM agency_contracts k';
/** The list and the board show a title and a status, so they leave out the document itself, the answers and the acceptance (the heavy columns). */
const CONTRACT_LIST_SELECT = 'SELECT k.id, k.user_id, k.client_id, k.title, k.template_key, k.status, k.sent_at, k.signed_at, k.revised_at, k.created_at, k.updated_at, (SELECT name FROM agency_clients c WHERE c.id = k.client_id) AS client_name FROM agency_contracts k';
type ContractListRow = Pick<ContractRow, 'id' | 'user_id' | 'client_id' | 'client_name' | 'title' | 'template_key' | 'status' | 'sent_at' | 'signed_at' | 'revised_at' | 'created_at' | 'updated_at'>;

export function jsonOr<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function docOf(raw: string): ContractDoc {
  return parseContractDoc(jsonOr<unknown>(raw, null)) ?? { title: 'Agreement', subtitle: '', templateKey: 'custom', show: { comments: true, download: true }, currency: 'INR', vars: {}, sections: [], style: defaultDocStyle() };
}
const toContract = (r: ContractRow): AgencyContract => ({
  id: r.id,
  clientId: r.client_id,
  clientName: r.client_name ?? '',
  status: r.status,
  doc: docOf(r.doc_json),
  token: r.token,
  sentAt: r.sent_at,
  signedAt: r.signed_at,
  revisedAt: r.revised_at,
  acceptance: jsonOr<AgencyContract['acceptance']>(r.acceptance_json, null),
  answers: jsonOr<Record<string, ContractAnswer>>(r.answers_json, {}),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const toListItem = (r: ContractListRow): ContractListItem => ({ id: r.id, clientId: r.client_id, clientName: r.client_name ?? '', title: r.title, templateKey: r.template_key, status: r.status, sentAt: r.sent_at, signedAt: r.signed_at, updatedAt: r.updated_at });

agencyDocs.get('/contracts', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const ask = pageOf(c);
  const status = c.req.query('status');
  const client = c.req.query('client');
  const where = ['k.user_id = ?'];
  const binds: unknown[] = [user.id];
  if (status && (CONTRACT_STATUSES as readonly string[]).includes(status)) {
    where.push('k.status = ?');
    binds.push(status);
  }
  if (client) {
    where.push('k.client_id = ?');
    binds.push(client);
  }
  const [rows, counts] = await Promise.all([
    db.prepare(`${CONTRACT_LIST_SELECT} WHERE ${where.join(' AND ')} ORDER BY k.updated_at DESC LIMIT ? OFFSET ?`).bind(...binds, ask.limit, ask.offset).all<ContractListRow>(),
    db.prepare('SELECT status, COUNT(*) AS n FROM agency_contracts WHERE user_id = ? GROUP BY status').bind(user.id).all<{ status: string; n: number }>(),
  ]);
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, contracts: pg.items.map(toListItem), counts: counts.results });
});

agencyDocs.get('/contracts/board', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const per = Math.max(5, Math.min(100, Math.floor(Number(c.req.query('per')) || 25)));
  const client = c.req.query('client');
  const extra = client ? ' AND k.client_id = ?' : '';
  const columns = await Promise.all(
    CONTRACT_STATUSES.map(async (stage) => {
      const [rows, total] = await Promise.all([
        db.prepare(`${CONTRACT_LIST_SELECT} WHERE k.user_id = ? AND k.status = ?${extra} ORDER BY k.updated_at DESC LIMIT ?`).bind(user.id, stage, ...(client ? [client] : []), per).all<ContractListRow>(),
        db.prepare(`SELECT COUNT(*) AS n FROM agency_contracts k WHERE k.user_id = ? AND k.status = ?${extra}`).bind(user.id, stage, ...(client ? [client] : [])).first<{ n: number }>(),
      ]);
      return { stage, total: total?.n ?? 0, items: rows.results.map(toListItem) };
    }),
  );
  return c.json({ columns });
});

agencyDocs.get('/contracts/:id', async (c) => {
  const row = await c.env.DB.prepare(`${CONTRACT_SELECT} WHERE k.id = ? AND k.user_id = ?`).bind(c.req.param('id'), c.get('user').id).first<ContractRow>();
  return row ? c.json({ contract: toContract(row) }) : c.json({ error: 'not found' }, 404);
});

const MAX_CONTRACTS = 300;

// A new agreement starts from a template, filled in from the person's profile and the client's details.
agencyDocs.post('/contracts', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const mine = body.templateId ? await ownTemplate(db, user.id, body.templateId, 'contract') : null;
  if (body.templateId && !mine) return c.json({ error: 'that template is not yours' }, 400);
  const houseRow = body.houseId ? await activeHouse(db, body.houseId, 'contract') : null;
  if (body.houseId && !houseRow) return c.json({ error: 'that house template is not here any more' }, 404);
  const settings0 = houseRow ? await settingsFor(db, user.id) : null;
  const template = houseRow ? { key: 'custom', doc: houseContract(houseRow, settings0!.profile) } : mine ? { key: 'custom', doc: templateDoc(mine).contract! } : CONTRACT_TEMPLATE_BY_KEY[String(body.templateKey)];
  if (!template || !template.doc) return c.json({ error: 'pick a template' }, 400);
  const client = await clientBits(db, user.id, body.clientId);
  const n = await db.prepare('SELECT COUNT(*) AS n FROM agency_contracts WHERE user_id = ?').bind(user.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= MAX_CONTRACTS) return c.json({ error: 'too many agreements; remove some first' }, 400);
  const settings = settings0 ?? (await settingsFor(db, user.id));
  // A built-in or own template takes the person's default look unless it has its own; a house template already carries the look it was given.
  const typed = parseDocStyle(template.doc.style).layout === 'typed';
  // A typed agreement (the Trial agreement) keeps its own look; only the page size comes from the person's default.
  const baseStyle = typed ? parseDocStyle({ ...parseDocStyle(template.doc.style), page: parseDocStyle(settings.profile.docStyle).page }) : parseDocStyle(template.doc.style, parseDocStyle(settings.profile.docStyle));
  const doc: ContractDoc = await ownLogo(db, user.id, {
    ...structuredClone(template.doc),
    currency: settings.currency,
    vars: contractVarsFor(settings.profile, client ? clientFacts(client, settings.currency) : null),
    style: baseStyle,
    // The price table takes the owner's own packages (entered once in Settings) when the template has none of its own.
    sections: withProfilePackages(fillRetainerFee(structuredClone(template.doc).sections, client), settings.profile),
  }, houseRow ? baseStyle.logo : '');
  const id = newId();
  const now = nowIso();
  await db
    .prepare("INSERT INTO agency_contracts (id, user_id, client_id, title, template_key, status, doc_json, answers_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'draft', ?, '{}', ?, ?)")
    .bind(id, user.id, client?.id ?? null, doc.title, template.key, JSON.stringify(doc), now, now)
    .run();
  return c.json({ id }, 201);
});

agencyDocs.post('/contracts/:id/duplicate', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare(`${CONTRACT_SELECT} WHERE k.id = ? AND k.user_id = ?`).bind(c.req.param('id'), user.id).first<ContractRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const id = newId();
  const now = nowIso();
  await db.prepare("INSERT INTO agency_contracts (id, user_id, client_id, title, template_key, status, doc_json, answers_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'draft', ?, '{}', ?, ?)").bind(id, user.id, row.client_id, row.title, row.template_key, row.doc_json, now, now).run();
  return c.json({ id }, 201);
});

// Edit a draft; send it (a link appears), take it back to a draft while nobody has signed, or void it.
agencyDocs.patch('/contracts/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare(`${CONTRACT_SELECT} WHERE k.id = ? AND k.user_id = ?`).bind(c.req.param('id'), user.id).first<ContractRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const now = nowIso();
  if ('doc' in body || 'clientId' in body) {
    // A draft or a sent agreement can change in place (the client then sees it marked revised). A signed one is a record: revise it into a new draft.
    if (row.status === 'signed') return c.json({ error: 'a signed agreement is a record; make a revised copy and send that' }, 400);
    if (row.status === 'void') return c.json({ error: 'a voided agreement cannot change' }, 400);
    const parsedDoc = 'doc' in body ? parseContractDoc(body.doc) : docOf(row.doc_json);
    if (!parsedDoc) return c.json({ error: 'that agreement could not be read' }, 400);
    const doc = await ownLogo(db, user.id, parsedDoc, parseDocStyle(docOf(row.doc_json).style).logo);
    let clientId = row.client_id;
    if ('clientId' in body) {
      if (body.clientId === null || body.clientId === '') clientId = null;
      else {
        const cl = await clientBits(db, user.id, body.clientId);
        if (!cl) return c.json({ error: 'pick one of your clients' }, 400);
        clientId = cl.id;
      }
    }
    // Saving as you go: the page sends the time it last read (`ifUpdatedAt`), and the change lands only on that version, so a second tab
    // or device that saved meanwhile is never written over; the page reloads instead (409 changed).
    const guard = typeof body.ifUpdatedAt === 'string' ? body.ifUpdatedAt : null;
    if (guard !== null && guard !== row.updated_at) return c.json({ error: 'changed' }, 409);
    const res = await db
      .prepare(`UPDATE agency_contracts SET doc_json = ?, title = ?, client_id = ?, revised_at = CASE WHEN status = 'sent' THEN ? ELSE revised_at END, updated_at = ? WHERE id = ? AND user_id = ? AND status IN ('draft', 'sent')${guard !== null ? ' AND updated_at = ?' : ''}`)
      .bind(JSON.stringify(doc), doc.title, clientId, now, now, row.id, user.id, ...(guard !== null ? [guard] : []))
      .run();
    if (guard !== null && res.meta.changes !== 1) return c.json({ error: 'changed' }, 409);
  }
  if (typeof body.status === 'string') {
    const next = oneOf(body.status, ['draft', 'sent', 'void'] as const, row.status === 'signed' ? 'draft' : (row.status as 'draft' | 'sent' | 'void'));
    if (row.status === 'signed' && next !== 'void') return c.json({ error: 'a signed agreement can only be voided' }, 400);
    if (row.status === 'void' && next !== 'void') return c.json({ error: 'a voided agreement cannot be sent again; make a copy' }, 400);
    // Every move is guarded on the status that was read, so a client signing at that moment is never undone by a take-back,
    // and a double tap cannot send a voided agreement again.
    const changed = 'This agreement changed while you were working on it (it may have just been signed). Open it again.';
    let res: D1Result | null = null;
    if (next === 'sent' && row.status !== 'sent') {
      const doc = docOf(row.doc_json);
      if (doc.sections.length === 0) return c.json({ error: 'an agreement needs at least one section' }, 400);
      res = await db.prepare("UPDATE agency_contracts SET status = 'sent', token = COALESCE(token, ?), sent_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND status = ?").bind(randomCode(16), now, now, row.id, user.id, row.status).run();
    } else if (next === 'draft' && row.status === 'sent') {
      res = await db.prepare("UPDATE agency_contracts SET status = 'draft', token = NULL, updated_at = ? WHERE id = ? AND user_id = ? AND status = 'sent'").bind(now, row.id, user.id).run();
    } else if (next === 'void' && row.status !== 'void') {
      res = await db.prepare("UPDATE agency_contracts SET status = 'void', token = NULL, updated_at = ? WHERE id = ? AND user_id = ? AND status = ?").bind(now, row.id, user.id, row.status).run();
    }
    if (res && res.meta.changes !== 1) return c.json({ error: changed }, 409);
  }
  const fresh = await db.prepare(`${CONTRACT_SELECT} WHERE k.id = ? AND k.user_id = ?`).bind(row.id, user.id).first<ContractRow>();
  return fresh ? c.json({ contract: toContract(fresh) }) : c.json({ error: 'not found' }, 404);
});

agencyDocs.delete('/contracts/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const res = await db.prepare("DELETE FROM agency_contracts WHERE id = ? AND user_id = ? AND status IN ('draft', 'void')").bind(c.req.param('id'), user.id).run();
  if (!res.meta.changes) return c.json({ error: 'only a draft or a voided agreement can be removed' }, 400);
  await db.prepare("DELETE FROM agency_doc_comments WHERE doc_type = 'contract' AND doc_id = ? AND user_id = ?").bind(c.req.param('id'), user.id).run();
  await db.prepare("DELETE FROM agency_doc_log WHERE doc_type = 'contract' AND doc_id = ? AND user_id = ?").bind(c.req.param('id'), user.id).run();
  return c.json({ ok: true });
});

// ---- email a copy: the text version and the client's link, sent as ordinary mail from the server

/** Who a copy goes to: an address the person typed (checked), else the client's contact address. */
export async function recipientFor(db: D1Database, userId: string, clientId: string | null, typed: unknown, fallback = ''): Promise<{ to: string } | { error: string }> {
  if (typeof typed === 'string' && typed.trim()) {
    const problem = emailProblem(typed);
    return problem ? { error: problem } : { to: typed.trim() };
  }
  const client = clientId ? await db.prepare('SELECT contact_email FROM agency_clients WHERE id = ? AND user_id = ?').bind(clientId, userId).first<{ contact_email: string }>() : null;
  const to = (client?.contact_email || fallback).trim();
  return to && !emailProblem(to) ? { to } : { error: 'there is no email address for this client yet; type one' };
}

agencyDocs.post('/invoices/:id/email', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare(`${INV_SELECT} WHERE i.id = ? AND i.user_id = ? AND i.agency_client_id IS NOT NULL`).bind(c.req.param('id'), user.id).first<InvRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.status === 'draft') return c.json({ error: 'mark the invoice as sent first, so the link in the email works' }, 400);
  if (row.status === 'void') return c.json({ error: 'a void invoice is not sent' }, 400);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const who = await recipientFor(db, user.id, row.agency_client_id ?? null, body.to, row.client_email);
  if ('error' in who) return c.json({ error: who.error }, 400);
  // The client's version: what the person switched off is left out of the words too.
  const inv = invoiceForClient(toInvoice(row));
  const settings = await settingsFor(db, user.id);
  const cover = coverFrom(body);
  const result = await emailCopy(db, c.env, user.id, {
    to: who.to,
    subject: cover?.subject || `${inv.doc.title || 'Invoice'} ${inv.number} from ${inv.doc.from.name || nameOf(user)}`,
    intro: cover ? cover.message : `Hello,\n\nHere is ${inv.doc.title.toLowerCase() === 'invoice' ? 'invoice' : inv.doc.title.toLowerCase()} ${inv.number}.`,
    text: cover ? '' : invoiceAsText(inv),
    link: publicUrl(c.env, `/i/${row.token}`),
    replyTo: invoiceFromProfile(settings.profile).email,
  });
  await logDoc(db, user.id, 'invoice', row.id, result.sent ? 'emailed' : 'email-not-sent', maskEmail(who.to));
  await audit(db, user.id, 'agency_doc.email', 'invoice', row.id, '', maskEmail(who.to));
  return c.json({ ok: true, ...result, to: maskEmail(who.to) });
});

agencyDocs.post('/contracts/:id/email', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare(`${CONTRACT_SELECT} WHERE k.id = ? AND k.user_id = ?`).bind(c.req.param('id'), user.id).first<ContractRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.status === 'draft' || !row.token) return c.json({ error: 'send the agreement first, so the link in the email works' }, 400);
  if (row.status === 'void') return c.json({ error: 'a voided agreement is not sent' }, 400);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const who = await recipientFor(db, user.id, row.client_id, body.to);
  if ('error' in who) return c.json({ error: who.error }, 400);
  const doc = docOf(row.doc_json);
  const settings = await settingsFor(db, user.id);
  const cover = coverFrom(body);
  const result = await emailCopy(db, c.env, user.id, {
    to: who.to,
    subject: cover?.subject || `${doc.title} from ${doc.vars.providerBusiness || nameOf(user)}`,
    intro: cover ? cover.message : 'Hello,\n\nHere is the agreement for you to read. You can answer any questions and accept it at the link below.',
    text: cover ? '' : contractAsText(doc, { reference: docRef('AGR', row.id), date: row.sent_at ?? row.created_at, answers: jsonOr<Record<string, ContractAnswer>>(row.answers_json, {}), acceptance: jsonOr<AgencyContract['acceptance']>(row.acceptance_json, null) }),
    link: publicUrl(c.env, `/k/${row.token}`),
    replyTo: invoiceFromProfile(settings.profile).email,
  });
  await logDoc(db, user.id, 'contract', row.id, result.sent ? 'emailed' : 'email-not-sent', maskEmail(who.to));
  await audit(db, user.id, 'agency_doc.email', 'contract', row.id, '', maskEmail(who.to));
  return c.json({ ok: true, ...result, to: maskEmail(who.to) });
});

// What was done with a document: emailed a copy, approved. Owner only.
agencyDocs.get('/doc-log/:type/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const type = c.req.param('type') as DocType;
  if (!(DOC_TYPES as readonly string[]).includes(type) || !(await docOwned(db, user.id, type, c.req.param('id')))) return c.json({ error: 'not found' }, 404);
  const rows = await db.prepare('SELECT id, event, detail, created_at FROM agency_doc_log WHERE user_id = ? AND doc_type = ? AND doc_id = ? ORDER BY created_at DESC LIMIT 50').bind(user.id, type, c.req.param('id')).all<{ id: string; event: string; detail: string; created_at: string }>();
  return c.json({ log: rows.results.map((r): DocLogLine => ({ id: r.id, event: r.event, detail: r.detail, createdAt: r.created_at })) });
});

// ---- the client's side of an agreement

async function sentContract(db: D1Database, token: string): Promise<(ContractRow & { owner_name: string }) | null> {
  if (!/^[A-Z0-9]{16}$/.test(token)) return null;
  return db
    .prepare("SELECT k.*, (SELECT name FROM agency_clients c WHERE c.id = k.client_id) AS client_name, u.display_name AS owner_name FROM agency_contracts k JOIN users u ON u.id = k.user_id WHERE k.token = ? AND k.status IN ('sent', 'signed')")
    .bind(token)
    .first<ContractRow & { owner_name: string }>();
}

contractsPublic.get('/:token', async (c) => {
  const row = await sentContract(c.env.DB, c.req.param('token'));
  if (!row) return c.json({ error: 'no agreement at this link' }, 404);
  const doc = docOf(row.doc_json);
  const comments = doc.show.comments
    ? await c.env.DB.prepare("SELECT id, author, body, created_at FROM agency_doc_comments WHERE doc_type = 'contract' AND doc_id = ? ORDER BY created_at LIMIT 100").bind(row.id).all<{ id: string; author: 'me' | 'client'; body: string; created_at: string }>()
    : { results: [] as { id: string; author: 'me' | 'client'; body: string; created_at: string }[] };
  const view: PublicContract = {
    ref: docRef('AGR', row.id),
    sentAt: row.sent_at,
    // The client meets the business that sent it (the name on the paper), not the account's own display name.
    ownerName: doc.vars?.providerBusiness?.trim() || nameOf({ display_name: row.owner_name }),
    status: row.status,
    revisedAt: row.revised_at,
    comments: comments.results.map((r): DocComment => ({ id: r.id, author: r.author, body: r.body, createdAt: r.created_at })),
    doc,
    answers: jsonOr<Record<string, ContractAnswer>>(row.answers_json, {}),
    acceptance: jsonOr<PublicContract['acceptance']>(row.acceptance_json, null),
  };
  return c.json(view);
});

// The client answers the brief and accepts by typing their name. This is typed acceptance, not a certified e-signature.
contractsPublic.post('/:token/accept', async (c) => {
  const db = c.env.DB;
  const row = await sentContract(db, c.req.param('token'));
  if (!row) return c.json({ error: 'no agreement at this link' }, 404);
  if (row.status !== 'sent') return c.json({ error: 'this agreement is already signed' }, 400);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const name = str(body.name, 80);
  const title = str(body.title, 80);
  if (!name) return c.json({ error: 'type your full name' }, 400);
  if (body.agree !== true) return c.json({ error: 'tick that you have read and agree' }, 400);
  const doc = docOf(row.doc_json);
  // Only answers to the agreement's own questions, only options it offered, only fields it names and only web links are kept.
  const answers: Record<string, ContractAnswer> = cleanContractAnswers(doc, body.answers);
  const now = nowIso();
  const res = await db
    .prepare("UPDATE agency_contracts SET status = 'signed', signed_at = ?, acceptance_json = ?, answers_json = ?, updated_at = ? WHERE id = ? AND status = 'sent'")
    .bind(now, JSON.stringify({ name, title, at: now }), JSON.stringify(answers), now, row.id)
    .run();
  if (!res.meta.changes) return c.json({ error: 'this agreement is already signed' }, 400);
  await notify(db, row.user_id, 'agency', `${name} accepted ${row.title}`, '', row.client_id ? `/agency/${row.client_id}` : '/agency');
  return c.json({ ok: true });
});

// The client asks for a change to the agreement. It is a note on it, and the person is told.
contractsPublic.post('/:token/comments', async (c) => {
  const db = c.env.DB;
  const row = await sentContract(db, c.req.param('token'));
  if (!row) return c.json({ error: 'no agreement at this link' }, 404);
  if (!docOf(row.doc_json).show.comments) return c.json({ error: 'comments are switched off on this agreement' }, 403);
  const body = await c.req.json<{ body?: string }>().catch(() => ({}) as { body?: string });
  const text = str(body.body, DOC_COMMENT_MAX);
  if (!text) return c.json({ error: 'write something' }, 400);
  await db.prepare("INSERT INTO agency_doc_comments (id, user_id, doc_type, doc_id, author, body, created_at) VALUES (?, ?, 'contract', ?, 'client', ?, ?)").bind(newId(), row.user_id, row.id, text, nowIso()).run();
  await notify(db, row.user_id, 'agency', `${row.client_name ?? 'The client'} wrote on ${row.title}`, text.slice(0, 160), `/agency/contracts/${row.id}`);
  return c.json({ ok: true }, 201);
});
