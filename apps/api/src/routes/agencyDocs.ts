import { Hono } from 'hono';
import {
  CONTRACT_STATUSES,
  contractTemplateDoc,
  INVOICE_STARTER_BY_KEY,
  invoiceTemplateDoc,
  MAX_TEMPLATES,
  TEMPLATE_KINDS,
  TEMPLATE_NAME_MAX,
  templateSummary,
  type AgencyTemplate,
  type TemplateKind,
  DOC_COMMENT_MAX,
  DOC_TYPES,
  type DocComment,
  type DocType,
  CONTRACT_TEMPLATE_BY_KEY,
  contractVarsFor,
  docFromProfile,
  INVOICE_STATUSES,
  invoiceTotals,
  MAX_INVOICE_LINES,
  monthBounds,
  parseContractDoc,
  parseInvoiceDoc,
  type AgencyContract,
  type ContractAnswer,
  type ContractDoc,
  type ContractListItem,
  type ContractStatus,
  type InvoiceDoc,
  type InvoiceItem,
  type PublicContract,
} from '@kreators/shared';
import type { AppEnv } from '../env';
import { DATE_RE, dayFromDevice, nameOf, newId, notify, nowIso, num, oneOf, pageOf, paged, randomCode, shiftDate, str } from '../db';
import { createInvoice, INV_SELECT, nextNumberAfter, setInvoiceStatus, toInvoice, updateDraftInvoice, type InvRow } from './finance';
import { billingOf, settingsFor } from './agency';

/**
 * Agency's paper: designed invoices with a calculator, and agreements made from a template. Owner only, like the rest of Agency;
 * the client's side of an agreement is the public link at /public/contracts.
 */
export const agencyDocs = new Hono<AppEnv>();
export const contractsPublic = new Hono<AppEnv>();

const dayOf = (c: { req: { query: (k: string) => string | undefined } }) => dayFromDevice(c.req.query('day'));
const dateOrNull = (v: unknown): string | null => (typeof v === 'string' && DATE_RE.test(v) ? v : null);

function itemsIn(v: unknown): InvoiceItem[] {
  return (Array.isArray(v) ? v : [])
    .map((x) => (x && typeof x === 'object' ? (x as Record<string, unknown>) : {}))
    .map((x) => ({ description: str(x.description, 200), quantity: num(x.quantity, 1, 1, 100000) ?? 1, unitCents: num(x.unitCents, 0, 0, 1_000_000_000_00) ?? 0 }))
    .filter((x) => x.description)
    .slice(0, MAX_INVOICE_LINES);
}

interface ClientBits { id: string; name: string; contact_name: string; contact_email: string; billing_json: string }
async function clientBits(db: D1Database, userId: string, id: unknown): Promise<ClientBits | null> {
  if (typeof id !== 'string' || !id) return null;
  return db.prepare('SELECT id, name, contact_name, contact_email, billing_json FROM agency_clients WHERE id = ? AND user_id = ?').bind(id, userId).first<ClientBits>();
}


// ---- the person's own templates

interface TemplateRow { id: string; kind: TemplateKind; name: string; doc_json: string; items_json: string; created_at: string; updated_at: string }
function templateDoc(r: TemplateRow): { invoice: InvoiceDoc | null; contract: ContractDoc | null; items: InvoiceItem[] } {
  const items = itemsIn(jsonOr<unknown>(r.items_json, []));
  return r.kind === 'invoice' ? { invoice: parseInvoiceDoc(jsonOr<unknown>(r.doc_json, {})), contract: null, items } : { invoice: null, contract: parseContractDoc(jsonOr<unknown>(r.doc_json, null)), items };
}
function toTemplate(r: TemplateRow): AgencyTemplate {
  const t = templateDoc(r);
  const doc = (t.invoice ?? t.contract)!;
  return { id: r.id, kind: r.kind, name: r.name, summary: doc ? templateSummary(r.kind, doc, t.items) : '', createdAt: r.created_at, updatedAt: r.updated_at };
}
async function ownTemplate(db: D1Database, userId: string, id: unknown, kind: TemplateKind): Promise<TemplateRow | null> {
  if (typeof id !== 'string' || !id) return null;
  return db.prepare('SELECT * FROM agency_templates WHERE id = ? AND user_id = ? AND kind = ?').bind(id, userId, kind).first<TemplateRow>();
}
/** What a template takes from an invoice or an agreement of the person's: its look and lines (never who it was for), or its sections (never the names). */
async function snapshotOf(db: D1Database, userId: string, kind: TemplateKind, fromId: string): Promise<{ doc: unknown; items: InvoiceItem[] } | null> {
  if (kind === 'invoice') {
    const row = await db.prepare(`${INV_SELECT} WHERE i.id = ? AND i.user_id = ? AND i.agency_client_id IS NOT NULL`).bind(fromId, userId).first<InvRow>();
    if (!row) return null;
    const inv = toInvoice(row);
    return { doc: invoiceTemplateDoc(inv.doc), items: inv.items };
  }
  const row = await db.prepare(`${CONTRACT_SELECT} WHERE k.id = ? AND k.user_id = ?`).bind(fromId, userId).first<ContractRow>();
  return row ? { doc: contractTemplateDoc(docOf(row.doc_json)), items: [] } : null;
}

agencyDocs.get('/templates', async (c) => {
  const kind = c.req.query('kind');
  const rows = await c.env.DB
    .prepare(`SELECT * FROM agency_templates WHERE user_id = ?${kind && (TEMPLATE_KINDS as readonly string[]).includes(kind) ? ' AND kind = ?' : ''} ORDER BY updated_at DESC LIMIT ${MAX_TEMPLATES * 2}`)
    .bind(...[c.get('user').id, ...(kind && (TEMPLATE_KINDS as readonly string[]).includes(kind) ? [kind] : [])])
    .all<TemplateRow>();
  return c.json({ templates: rows.results.map(toTemplate) });
});

// Save one of the person's invoices or agreements as a template, or replace what an existing template holds with it.
agencyDocs.post('/templates', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const kind = oneOf(body.kind, TEMPLATE_KINDS, 'invoice');
  const name = str(body.name, TEMPLATE_NAME_MAX);
  if (!name) return c.json({ error: 'give it a name' }, 400);
  const snap = typeof body.fromId === 'string' ? await snapshotOf(db, user.id, kind, body.fromId) : null;
  if (!snap) return c.json({ error: kind === 'invoice' ? 'pick one of your invoices' : 'pick one of your agreements' }, 400);
  const n = await db.prepare('SELECT COUNT(*) AS n FROM agency_templates WHERE user_id = ? AND kind = ?').bind(user.id, kind).first<{ n: number }>();
  if ((n?.n ?? 0) >= MAX_TEMPLATES) return c.json({ error: `up to ${MAX_TEMPLATES} templates; remove one first` }, 400);
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
  if (typeof body.fromId === 'string') {
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
  return row ? c.json({ invoice: toInvoice(row) }) : c.json({ error: 'not found' }, 404);
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
  const starter = typeof body.starter === 'string' ? INVOICE_STARTER_BY_KEY[body.starter] : undefined;
  let base = { ...docFromProfile(settings.profile), to: billingOf(client) };
  let starting: InvoiceItem[] = [];
  if (tpl) {
    const t = templateDoc(tpl);
    base = { ...t.invoice!, to: billingOf(client) };
    starting = t.items;
  } else if (starter) {
    base = { ...base, title: starter.title, footnote: starter.footnote || base.footnote };
    starting = starter.items;
  }
  const doc = parseInvoiceDoc(body.doc, base);
  const items = Array.isArray(body.items) ? itemsIn(body.items) : starting;
  if (items.length === 0) return c.json({ error: 'at least one line' }, 400);
  const invoice = await createInvoice(db, user.id, {
    clientName: client.name,
    clientEmail: doc.to.email || client.contact_email,
    items,
    dueDate: dateOrNull(body.dueDate) ?? shiftDate(dayOf(c), settings.profile.payDays),
    issueDate: dateOrNull(body.issueDate) ?? dayOf(c),
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
  const month = body.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(body.month) ? body.month : dayOf(c).slice(0, 7);
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
    dueDate: shiftDate(dayOf(c), settings.profile.payDays),
    issueDate: dayOf(c),
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
  const prev = toInvoice(row);
  const doc = parseInvoiceDoc(body.doc, prev.doc);
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
  return invoice ? c.json({ invoice, totals: invoiceTotals(invoice.items, invoice.doc) }) : c.json({ error: 'not found' }, 404);
});

agencyDocs.delete('/invoices/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const res = await db.prepare("DELETE FROM invoices WHERE id = ? AND user_id = ? AND agency_client_id IS NOT NULL AND status = 'draft'").bind(c.req.param('id'), user.id).run();
  if (!res.meta.changes) return c.json({ error: 'only a draft can be removed; void a sent one' }, 400);
  await db.prepare("DELETE FROM agency_doc_comments WHERE doc_type = 'invoice' AND doc_id = ? AND user_id = ?").bind(c.req.param('id'), user.id).run();
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
  const issueDate = dateOrNull(body.issueDate) ?? dayOf(c);
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
  Boolean(await db.prepare(type === 'invoice' ? 'SELECT 1 AS x FROM invoices WHERE id = ? AND user_id = ? AND agency_client_id IS NOT NULL' : 'SELECT 1 AS x FROM agency_contracts WHERE id = ? AND user_id = ?').bind(id, userId).first());

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

interface ContractRow {
  id: string; user_id: string; client_id: string | null; client_name: string | null; title: string; template_key: string; status: ContractStatus; doc_json: string; token: string | null; answers_json: string;
  acceptance_json: string | null; sent_at: string | null; signed_at: string | null; revised_at: string | null; created_at: string; updated_at: string;
}
const CONTRACT_SELECT = 'SELECT k.*, (SELECT name FROM agency_clients c WHERE c.id = k.client_id) AS client_name FROM agency_contracts k';

function jsonOr<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function docOf(raw: string): ContractDoc {
  return parseContractDoc(jsonOr<unknown>(raw, null)) ?? { title: 'Agreement', subtitle: '', templateKey: 'custom', show: { comments: true, download: true }, currency: 'INR', vars: {}, sections: [] };
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
const toListItem = (r: ContractRow): ContractListItem => ({ id: r.id, clientId: r.client_id, clientName: r.client_name ?? '', title: r.title, templateKey: r.template_key, status: r.status, sentAt: r.sent_at, signedAt: r.signed_at, updatedAt: r.updated_at });

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
    db.prepare(`${CONTRACT_SELECT} WHERE ${where.join(' AND ')} ORDER BY k.updated_at DESC LIMIT ? OFFSET ?`).bind(...binds, ask.limit, ask.offset).all<ContractRow>(),
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
        db.prepare(`${CONTRACT_SELECT} WHERE k.user_id = ? AND k.status = ?${extra} ORDER BY k.updated_at DESC LIMIT ?`).bind(user.id, stage, ...(client ? [client] : []), per).all<ContractRow>(),
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
  const template = mine ? { key: 'custom', doc: templateDoc(mine).contract! } : CONTRACT_TEMPLATE_BY_KEY[String(body.templateKey)];
  if (!template || !template.doc) return c.json({ error: 'pick a template' }, 400);
  const client = await clientBits(db, user.id, body.clientId);
  const n = await db.prepare('SELECT COUNT(*) AS n FROM agency_contracts WHERE user_id = ?').bind(user.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= MAX_CONTRACTS) return c.json({ error: 'too many agreements; remove some first' }, 400);
  const settings = await settingsFor(db, user.id);
  const billing = client ? billingOf(client) : null;
  const doc: ContractDoc = {
    ...structuredClone(template.doc),
    currency: settings.currency,
    vars: contractVarsFor(settings.profile, client ? { name: client.name, address: billing?.address ?? '', contactName: client.contact_name } : null),
  };
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
    const doc = 'doc' in body ? parseContractDoc(body.doc) : docOf(row.doc_json);
    if (!doc) return c.json({ error: 'that agreement could not be read' }, 400);
    let clientId = row.client_id;
    if ('clientId' in body) {
      if (body.clientId === null || body.clientId === '') clientId = null;
      else {
        const cl = await clientBits(db, user.id, body.clientId);
        if (!cl) return c.json({ error: 'pick one of your clients' }, 400);
        clientId = cl.id;
      }
    }
    await db.prepare("UPDATE agency_contracts SET doc_json = ?, title = ?, client_id = ?, revised_at = CASE WHEN status = 'sent' THEN ? ELSE revised_at END, updated_at = ? WHERE id = ? AND user_id = ?").bind(JSON.stringify(doc), doc.title, clientId, now, now, row.id, user.id).run();
  }
  if (typeof body.status === 'string') {
    const next = oneOf(body.status, ['draft', 'sent', 'void'] as const, row.status === 'signed' ? 'draft' : (row.status as 'draft' | 'sent' | 'void'));
    if (row.status === 'signed' && next !== 'void') return c.json({ error: 'a signed agreement can only be voided' }, 400);
    if (next === 'sent' && row.status !== 'sent') {
      const doc = docOf(row.doc_json);
      if (doc.sections.length === 0) return c.json({ error: 'an agreement needs at least one section' }, 400);
      await db.prepare("UPDATE agency_contracts SET status = 'sent', token = COALESCE(token, ?), sent_at = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(randomCode(16), now, now, row.id, user.id).run();
    } else if (next === 'draft' && row.status === 'sent') {
      await db.prepare("UPDATE agency_contracts SET status = 'draft', token = NULL, updated_at = ? WHERE id = ? AND user_id = ?").bind(now, row.id, user.id).run();
    } else if (next === 'void') {
      await db.prepare("UPDATE agency_contracts SET status = 'void', token = NULL, updated_at = ? WHERE id = ? AND user_id = ?").bind(now, row.id, user.id).run();
    }
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
  return c.json({ ok: true });
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
    ownerName: nameOf({ display_name: row.owner_name }),
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
  // Only answers to the agreement's own questions, and only options it offered, are kept.
  const raw = body.answers && typeof body.answers === 'object' ? (body.answers as Record<string, unknown>) : {};
  const answers: Record<string, ContractAnswer> = {};
  for (const section of doc.sections) {
    for (const q of section.questions ?? []) {
      const a = raw[q.id] && typeof raw[q.id] === 'object' ? (raw[q.id] as Record<string, unknown>) : {};
      const picked = (Array.isArray(a.picked) ? a.picked : []).filter((x): x is string => typeof x === 'string' && q.options.includes(x)).slice(0, q.multi ? q.options.length : 1);
      answers[q.id] = { picked, other: q.other ? str(a.other, 200) : '', text: q.text ? str(a.text, 1500) : '' };
    }
  }
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
