import { Hono } from 'hono';
import { contractTemplateDoc, houseDoc, houseInvoiceDoc, parseContractDoc, parseInvoiceDoc, DOC_TEMPLATE_KINDS, TEMPLATE_NAME_MAX, templateSummary, type ContractDoc, type DocTemplateKind, type HouseTemplate, type InvoiceDoc, type InvoiceItem } from '@kreators/shared';
import type { AppEnv } from '../env';
import { audit, newId, nowIso, oneOf, pageOf, paged, str } from '../db';
import { rateLimit } from '../ops';
import { docOf, snapshotOf, templateDoc, type HouseRow } from './agencyDocs';

/**
 * House templates: starting points the super admin makes for every Agency user. Mounted at /admin/agency, so the admin check in admin.ts
 * has already run; on top of that only a signed-in person whose role is admin can make, change or retire one (the shared admin key alone
 * cannot, since a house template is made from the admin's own invoice, agreement or document). Everyone else reads them in the template
 * picker (GET /agency/templates) and uses one by copying it. Every write is audited. Nothing is seeded.
 *
 * Rate limit: admin routes are mounted before the session check, so a ROUTE_LIMITS line for them would never run; the limit is applied here.
 */
export const adminAgency = new Hono<AppEnv>();

const superAdmin = (c: { get: (k: 'user') => { role: string; id: string } | undefined }) => {
  const u = c.get('user');
  return u && u.role === 'admin' ? u : null;
};

function toHouse(r: HouseRow): HouseTemplate {
  const t = templateDoc(r);
  const doc = (t.invoice ?? t.contract)!;
  return { id: r.id, kind: r.kind, name: r.name, summary: doc ? templateSummary(r.kind, doc, t.items) : '', includeBusiness: r.include_business === 1, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at };
}

/** The house version of one of the admin's own documents: no names filled in, and no business details unless asked. */
async function houseSnapshot(db: D1Database, userId: string, kind: DocTemplateKind, fromId: string, includeBusiness: boolean): Promise<{ doc: InvoiceDoc | ContractDoc; items: InvoiceItem[] } | null> {
  const snap = await snapshotOf(db, userId, kind, fromId);
  if (!snap) return null;
  if (kind === 'invoice') return { doc: houseInvoiceDoc(parseInvoiceDoc(snap.doc), includeBusiness), items: snap.items };
  const doc = parseContractDoc(snap.doc) ?? docOf('{}');
  return { doc: houseDoc(contractTemplateDoc(doc), includeBusiness), items: [] };
}

adminAgency.get('/templates', async (c) => {
  const ask = pageOf(c);
  const rows = await c.env.DB.prepare('SELECT * FROM agency_house_templates ORDER BY status, updated_at DESC LIMIT ? OFFSET ?').bind(ask.limit, ask.offset).all<HouseRow>();
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, templates: pg.items.map(toHouse) });
});

adminAgency.post('/templates', rateLimit('create'), async (c) => {
  const db = c.env.DB;
  const user = superAdmin(c);
  if (!user) return c.json({ error: 'only a super admin makes a house template; sign in as the admin' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const kind = oneOf(body.kind, DOC_TEMPLATE_KINDS, 'invoice');
  const name = str(body.name, TEMPLATE_NAME_MAX);
  if (!name) return c.json({ error: 'give it a name' }, 400);
  const include = body.includeBusiness === true;
  const snap = typeof body.fromId === 'string' ? await houseSnapshot(db, user.id, kind, body.fromId, include) : null;
  if (!snap) return c.json({ error: 'pick one of your own invoices, agreements or documents to make it from' }, 400);
  const id = newId();
  const now = nowIso();
  await db.prepare('INSERT INTO agency_house_templates (id, kind, name, doc_json, items_json, include_business, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, kind, name, JSON.stringify(snap.doc), JSON.stringify(snap.items), include ? 1 : 0, 'active', user.id, now, now).run();
  await audit(db, user.id, 'agency_house_template.create', 'agency_house_template', id, '', `${kind}: ${name}`);
  return c.json({ id }, 201);
});

adminAgency.patch('/templates/:id', rateLimit('prefs'), async (c) => {
  const db = c.env.DB;
  const user = superAdmin(c);
  if (!user) return c.json({ error: 'only a super admin changes a house template; sign in as the admin' }, 403);
  const row = await db.prepare('SELECT * FROM agency_house_templates WHERE id = ?').bind(c.req.param('id')).first<HouseRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const name = 'name' in body ? str(body.name, TEMPLATE_NAME_MAX) : row.name;
  if (!name) return c.json({ error: 'give it a name' }, 400);
  const status = 'status' in body ? oneOf(body.status, ['active', 'retired'] as const, row.status) : row.status;
  let doc = row.doc_json;
  let items = row.items_json;
  let include = row.include_business;
  if (typeof body.fromId === 'string') {
    include = body.includeBusiness === true ? 1 : 0;
    const snap = await houseSnapshot(db, user.id, row.kind, body.fromId, include === 1);
    if (!snap) return c.json({ error: 'pick one of your own to replace it with' }, 400);
    doc = JSON.stringify(snap.doc);
    items = JSON.stringify(snap.items);
  }
  await db.prepare('UPDATE agency_house_templates SET name = ?, status = ?, doc_json = ?, items_json = ?, include_business = ?, updated_at = ? WHERE id = ?').bind(name, status, doc, items, include, nowIso(), row.id).run();
  await audit(db, user.id, status !== row.status ? `agency_house_template.${status === 'retired' ? 'retire' : 'restore'}` : 'agency_house_template.update', 'agency_house_template', row.id, row.name, name);
  return c.json({ ok: true });
});
