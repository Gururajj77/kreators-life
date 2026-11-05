import { Hono } from 'hono';
import {
  AGENCY_DOC_KINDS,
  AGENCY_DOC_STATUSES,
  agencyDocStarter,
  contractAsText,
  contractVarsFor,
  cleanContractAnswers,
  DOC_COMMENT_MAX,
  docDate,
  docRef,
  isAgencyDocKind,
  MAX_AGENCY_DOCS,
  monthBounds,
  monthlyReportDoc,
  parseContractDoc,
  parseDocStyle,
  parseRetainerInput,
  AGENCY_DOC_KIND_META,
  type AgencyDocFull,
  type AgencyDocKind,
  type AgencyDocListItem,
  type AgencyDocStatus,
  type ContractAnswer,
  type ContractDoc,
  type DocComment,
  type PublicAgencyDoc,
  invoiceFromProfile,
} from '@kreators/shared';
import type { AppEnv } from '../env';
import { audit, dayFromDevice, nameOf, newId, notify, nowIso, oneOf, pageOf, paged, randomCode, str } from '../db';
import { coverFrom, emailCopy, logDoc, maskEmail, ownLogo, publicUrl } from '../agencyPaper';
import { settingsFor } from './agency';
import { activeHouse, clientBits, clientFacts, docOf, houseContract, jsonOr, ownTemplate, recipientFor, templateDoc } from './agencyDocs';

/**
 * Agency's other documents: a strategy session summary, trial video terms, a retainer proposal and a monthly report. They are sectioned
 * documents in the same shape as an agreement, so the same page, text version and editor serve them. Owner only at /agency/docs;
 * the client reads one at /d/<token> (public routes below), approves it by typing a name and may write a comment.
 *
 * The client's password, when the client has one, is checked in front of these three routes by `portalDocGate('doc')` (index.ts, portalAccess.ts),
 * so a locked client's document links are locked with the rest. The document's own token is the other gate.
 */
export const agencyOther = new Hono<AppEnv>();
export const docsPublic = new Hono<AppEnv>();

interface DocRow {
  id: string; user_id: string; client_id: string | null; client_name: string | null; kind: AgencyDocKind; title: string; status: AgencyDocStatus; body_json: string; token: string | null; answers_json: string;
  approval_json: string | null; sent_at: string | null; approved_at: string | null; revised_at: string | null; created_at: string; updated_at: string;
}
const SELECT = 'SELECT d.*, (SELECT name FROM agency_clients c WHERE c.id = d.client_id) AS client_name FROM agency_docs d';
/** The list leaves out the document itself, the answers and the approval (the heavy columns). */
const LIST_SELECT = 'SELECT d.id, d.client_id, d.kind, d.title, d.status, d.sent_at, d.approved_at, d.updated_at, (SELECT name FROM agency_clients c WHERE c.id = d.client_id) AS client_name FROM agency_docs d';
type ListRow = Pick<DocRow, 'id' | 'client_id' | 'client_name' | 'kind' | 'title' | 'status' | 'sent_at' | 'approved_at' | 'updated_at'>;

const toListItem = (r: ListRow): AgencyDocListItem => ({ id: r.id, clientId: r.client_id, clientName: r.client_name ?? '', kind: r.kind, title: r.title, status: r.status, sentAt: r.sent_at, approvedAt: r.approved_at, updatedAt: r.updated_at });
const toFull = (r: DocRow): AgencyDocFull => ({
  ...toListItem(r),
  doc: docOf(r.body_json),
  token: r.token,
  ref: docRef(AGENCY_DOC_KIND_META[r.kind]?.refPrefix ?? 'DOC', r.id),
  revisedAt: r.revised_at,
  acceptance: jsonOr<AgencyDocFull['acceptance']>(r.approval_json, null),
  answers: jsonOr<Record<string, ContractAnswer>>(r.answers_json, {}),
  createdAt: r.created_at,
});

/** Only answers to the document's own questions, only options it offered, only fields it names and only web links are kept. */
const cleanAnswers = (doc: ContractDoc, raw: unknown): Record<string, ContractAnswer> => cleanContractAnswers(doc, raw);

agencyOther.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const ask = pageOf(c);
  const kind = c.req.query('kind');
  const status = c.req.query('status');
  const client = c.req.query('client');
  const where = ['d.user_id = ?'];
  const binds: unknown[] = [user.id];
  if (isAgencyDocKind(kind)) {
    where.push('d.kind = ?');
    binds.push(kind);
  }
  if (status && (AGENCY_DOC_STATUSES as readonly string[]).includes(status)) {
    where.push('d.status = ?');
    binds.push(status);
  }
  if (client) {
    where.push('d.client_id = ?');
    binds.push(client);
  }
  const [rows, counts] = await Promise.all([
    db.prepare(`${LIST_SELECT} WHERE ${where.join(' AND ')} ORDER BY d.updated_at DESC LIMIT ? OFFSET ?`).bind(...binds, ask.limit, ask.offset).all<ListRow>(),
    db.prepare('SELECT status, COUNT(*) AS n FROM agency_docs WHERE user_id = ? GROUP BY status').bind(user.id).all<{ status: string; n: number }>(),
  ]);
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, docs: pg.items.map(toListItem), counts: counts.results });
});

agencyOther.get('/:id', async (c) => {
  const row = await c.env.DB.prepare(`${SELECT} WHERE d.id = ? AND d.user_id = ?`).bind(c.req.param('id'), c.get('user').id).first<DocRow>();
  return row ? c.json({ doc: toFull(row) }) : c.json({ error: 'not found' }, 404);
});

/** The numbers a monthly report is made from, all counts: what was published, what waits, how many times pieces were sent back, invoices. */
async function reportFacts(db: D1Database, userId: string, clientId: string, clientName: string, month: string) {
  const { start, end } = monthBounds(month);
  const [published, review, open, invRaised, invPaid] = await Promise.all([
    db.prepare("SELECT title, revisions FROM agency_items WHERE client_id = ? AND user_id = ? AND stage = 'published' AND published_day >= ? AND published_day <= ? ORDER BY published_day LIMIT 200").bind(clientId, userId, start, end).all<{ title: string; revisions: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM agency_items WHERE client_id = ? AND user_id = ? AND stage = 'review'").bind(clientId, userId).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM agency_items WHERE client_id = ? AND user_id = ? AND stage NOT IN ('published', 'review')").bind(clientId, userId).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM invoices WHERE user_id = ? AND agency_client_id = ? AND status != 'void' AND status != 'draft' AND issue_date >= ? AND issue_date <= ?").bind(userId, clientId, start, end).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM invoices WHERE user_id = ? AND agency_client_id = ? AND status = 'paid' AND substr(paid_at, 1, 10) >= ? AND substr(paid_at, 1, 10) <= ?").bind(userId, clientId, start, end).first<{ n: number }>(),
  ]);
  return monthlyReportDoc({
    clientName,
    month,
    published: published.results.map((p) => ({ title: p.title })),
    inReview: review?.n ?? 0,
    open: open?.n ?? 0,
    revisionsUsed: published.results.reduce((a, p) => a + (p.revisions ?? 0), 0),
    invoicesRaised: invRaised?.n ?? 0,
    invoicesPaid: invPaid?.n ?? 0,
  });
}

// A new document starts from a built-in starting point, one of the person's own templates, or a house template (copied, so it is theirs).
agencyOther.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const client = await clientBits(db, user.id, body.clientId);
  if (body.clientId && !client) return c.json({ error: 'pick one of your clients' }, 400);
  const n = await db.prepare('SELECT COUNT(*) AS n FROM agency_docs WHERE user_id = ?').bind(user.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= MAX_AGENCY_DOCS) return c.json({ error: 'too many documents; remove some first' }, 400);
  const settings = await settingsFor(db, user.id);
  const own = body.templateId ? await ownTemplate(db, user.id, body.templateId, 'doc') : null;
  if (body.templateId && !own) return c.json({ error: 'that template is not yours' }, 400);
  const house = body.houseId ? await activeHouse(db, body.houseId, 'doc') : null;
  if (body.houseId && !house) return c.json({ error: 'that house template is not here any more' }, 404);

  let doc: ContractDoc;
  let kind: AgencyDocKind;
  let fromTemplate = false;
  if (house || own) {
    doc = house ? houseContract(house, settings.profile) : templateDoc(own!).contract!;
    kind = isAgencyDocKind(doc.templateKey) ? doc.templateKey : isAgencyDocKind(body.kind) ? body.kind : 'brief';
    fromTemplate = true;
  } else {
    if (!isAgencyDocKind(body.kind)) return c.json({ error: `pick a kind of document: ${AGENCY_DOC_KINDS.join(', ')}` }, 400);
    kind = body.kind;
    if (kind === 'monthly_report') {
      if (!client) return c.json({ error: 'a monthly report is for one client; pick one' }, 400);
      const month = typeof body.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(body.month) ? body.month : dayFromDevice(c.req.query('day')).slice(0, 7);
      doc = await reportFacts(db, user.id, client.id, client.name, month);
    } else if (kind === 'retainer_proposal') {
      // The proposal is priced from the client's retainer and their changes a piece, unless the form sent its own.
      const asked = parseRetainerInput(body.retainer);
      const sent = body.retainer && typeof body.retainer === 'object' ? (body.retainer as Record<string, unknown>) : {};
      doc = agencyDocStarter(kind, {
        ...asked,
        monthlyFeeCents: asked.monthlyFeeCents > 0 ? asked.monthlyFeeCents : (client?.retainer_cents ?? 0),
        revisionRounds: 'revisionRounds' in sent ? asked.revisionRounds : (client?.revisions_per_piece ?? asked.revisionRounds),
      });
    } else doc = agencyDocStarter(kind);
  }
  const mine = parseDocStyle(settings.profile.docStyle);
  const vars = contractVarsFor(settings.profile, client ? clientFacts(client, settings.currency) : null);
  // A strategy session summary is written on the day of the session, so it starts dated today (the device's day).
  if (kind === 'brief') vars.sessionDate = docDate(dayFromDevice(c.req.query('day')));
  const withStyle: ContractDoc = {
    ...structuredClone(doc),
    templateKey: kind,
    currency: settings.currency,
    vars,
    style: fromTemplate ? parseDocStyle(doc.style, mine) : mine,
  };
  const final = house ? withStyle : await ownLogo(db, user.id, withStyle, parseDocStyle(doc.style).logo);
  const id = newId();
  const now = nowIso();
  await db.prepare("INSERT INTO agency_docs (id, user_id, client_id, kind, title, status, body_json, answers_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'draft', ?, '{}', ?, ?)").bind(id, user.id, client?.id ?? null, kind, final.title, JSON.stringify(final), now, now).run();
  return c.json({ id }, 201);
});

// A copy as a new draft, with no answers, no approval and no link. This is how an approved document is revised.
agencyOther.post('/:id/duplicate', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare(`${SELECT} WHERE d.id = ? AND d.user_id = ?`).bind(c.req.param('id'), user.id).first<DocRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const n = await db.prepare('SELECT COUNT(*) AS n FROM agency_docs WHERE user_id = ?').bind(user.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= MAX_AGENCY_DOCS) return c.json({ error: 'too many documents; remove some first' }, 400);
  const id = newId();
  const now = nowIso();
  await db.prepare("INSERT INTO agency_docs (id, user_id, client_id, kind, title, status, body_json, answers_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'draft', ?, '{}', ?, ?)").bind(id, user.id, row.client_id, row.kind, row.title, row.body_json, now, now).run();
  return c.json({ id }, 201);
});

// Edit; send it (a link appears); take it back to a draft while nobody has approved. Approved is a record: revise it into a new draft.
agencyOther.patch('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare(`${SELECT} WHERE d.id = ? AND d.user_id = ?`).bind(c.req.param('id'), user.id).first<DocRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const now = nowIso();
  if ('doc' in body || 'clientId' in body) {
    if (row.status === 'approved') return c.json({ error: 'an approved document is a record; make a revised copy and send that' }, 400);
    const parsed = 'doc' in body ? parseContractDoc(body.doc) : docOf(row.body_json);
    if (!parsed) return c.json({ error: 'that document could not be read' }, 400);
    const doc = await ownLogo(db, user.id, parsed, parseDocStyle(docOf(row.body_json).style).logo);
    let clientId = row.client_id;
    if ('clientId' in body) {
      if (body.clientId === null || body.clientId === '') clientId = null;
      else {
        const cl = await clientBits(db, user.id, body.clientId);
        if (!cl) return c.json({ error: 'pick one of your clients' }, 400);
        clientId = cl.id;
      }
    }
    // Saving as you go: the change lands only on the version the page read (`ifUpdatedAt`), so another tab's save is never written over.
    const guard = typeof body.ifUpdatedAt === 'string' ? body.ifUpdatedAt : null;
    if (guard !== null && guard !== row.updated_at) return c.json({ error: 'changed' }, 409);
    const res = await db
      .prepare(`UPDATE agency_docs SET body_json = ?, title = ?, client_id = ?, status = CASE WHEN status IN ('sent', 'revised') THEN 'revised' ELSE status END, revised_at = CASE WHEN status IN ('sent', 'revised') THEN ? ELSE revised_at END, updated_at = ? WHERE id = ? AND user_id = ? AND status IN ('draft', 'sent', 'revised')${guard !== null ? ' AND updated_at = ?' : ''}`)
      .bind(JSON.stringify(doc), doc.title, clientId, now, now, row.id, user.id, ...(guard !== null ? [guard] : []))
      .run();
    if (guard !== null && res.meta.changes !== 1) return c.json({ error: 'changed' }, 409);
  }
  if (typeof body.status === 'string') {
    const next = oneOf(body.status, ['draft', 'sent'] as const, 'draft');
    if (row.status === 'approved') return c.json({ error: 'an approved document can only be revised into a new draft' }, 400);
    if (next === 'sent' && row.status === 'draft') {
      if (docOf(row.body_json).sections.length === 0) return c.json({ error: 'a document needs at least one section' }, 400);
      await db.prepare("UPDATE agency_docs SET status = 'sent', token = COALESCE(token, ?), sent_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND status = 'draft'").bind(randomCode(16), now, now, row.id, user.id).run();
    } else if (next === 'draft' && row.status !== 'draft') {
      await db.prepare("UPDATE agency_docs SET status = 'draft', token = NULL, revised_at = NULL, updated_at = ? WHERE id = ? AND user_id = ? AND status IN ('sent', 'revised')").bind(now, row.id, user.id).run();
    }
  }
  const fresh = await db.prepare(`${SELECT} WHERE d.id = ? AND d.user_id = ?`).bind(row.id, user.id).first<DocRow>();
  return fresh ? c.json({ doc: toFull(fresh) }) : c.json({ error: 'not found' }, 404);
});

agencyOther.delete('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const res = await db.prepare("DELETE FROM agency_docs WHERE id = ? AND user_id = ? AND status = 'draft'").bind(c.req.param('id'), user.id).run();
  if (!res.meta.changes) return c.json({ error: 'only a draft can be removed' }, 400);
  await db.prepare("DELETE FROM agency_doc_comments WHERE doc_type = 'doc' AND doc_id = ? AND user_id = ?").bind(c.req.param('id'), user.id).run();
  await db.prepare("DELETE FROM agency_doc_log WHERE doc_type = 'doc' AND doc_id = ? AND user_id = ?").bind(c.req.param('id'), user.id).run();
  return c.json({ ok: true });
});

agencyOther.post('/:id/email', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await db.prepare(`${SELECT} WHERE d.id = ? AND d.user_id = ?`).bind(c.req.param('id'), user.id).first<DocRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  if (row.status === 'draft' || !row.token) return c.json({ error: 'send the document first, so the link in the email works' }, 400);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const who = await recipientFor(db, user.id, row.client_id, body.to, '', Boolean(c.get('team')));
  if ('error' in who) return c.json({ error: who.error }, 400);
  const full = toFull(row);
  const settings = await settingsFor(db, user.id);
  const cover = coverFrom(body);
  const result = await emailCopy(db, c.env, user.id, {
    to: who.to,
    subject: cover?.subject || `${full.doc.title} from ${full.doc.vars.providerBusiness || nameOf(user)}`,
    intro: cover ? cover.message : 'Hello,\n\nHere is the document for you to read. You can write a comment or approve it at the link below.',
    text: cover ? '' : contractAsText(full.doc, { reference: full.ref, date: row.sent_at ?? row.created_at, answers: full.answers, acceptance: full.acceptance }),
    link: publicUrl(c.env, `/d/${row.token}`),
    replyTo: invoiceFromProfile(settings.profile).email,
  });
  await logDoc(db, user.id, 'doc', row.id, result.sent ? 'emailed' : 'email-not-sent', maskEmail(who.to));
  await audit(db, user.id, 'agency_doc.email', 'doc', row.id, '', maskEmail(who.to));
  return c.json({ ok: true, ...result, to: maskEmail(who.to) });
});

// ---- the client's side

async function sentDoc(db: D1Database, token: string): Promise<(DocRow & { owner_name: string }) | null> {
  if (!/^[A-Z0-9]{16}$/.test(token)) return null;
  return db
    .prepare("SELECT d.*, (SELECT name FROM agency_clients c WHERE c.id = d.client_id) AS client_name, u.display_name AS owner_name FROM agency_docs d JOIN users u ON u.id = d.user_id WHERE d.token = ? AND d.status IN ('sent', 'revised', 'approved')")
    .bind(token)
    .first<DocRow & { owner_name: string }>();
}

docsPublic.get('/:token', async (c) => {
  const row = await sentDoc(c.env.DB, c.req.param('token'));
  if (!row) return c.json({ error: 'no document at this link' }, 404);
  const doc = docOf(row.body_json);
  const comments = doc.show.comments
    ? await c.env.DB.prepare("SELECT id, author, body, created_at FROM agency_doc_comments WHERE doc_type = 'doc' AND doc_id = ? ORDER BY created_at LIMIT 100").bind(row.id).all<{ id: string; author: 'me' | 'client'; body: string; created_at: string }>()
    : { results: [] as { id: string; author: 'me' | 'client'; body: string; created_at: string }[] };
  const view: PublicAgencyDoc = {
    ref: docRef(AGENCY_DOC_KIND_META[row.kind]?.refPrefix ?? 'DOC', row.id),
    // The client meets the business that sent it (the name on the paper), not the account's own display name.
    ownerName: doc.vars?.providerBusiness?.trim() || nameOf({ display_name: row.owner_name }),
    kind: row.kind,
    status: row.status,
    sentAt: row.sent_at,
    revisedAt: row.revised_at,
    comments: comments.results.map((r): DocComment => ({ id: r.id, author: r.author, body: r.body, createdAt: r.created_at })),
    doc,
    answers: jsonOr<Record<string, ContractAnswer>>(row.answers_json, {}),
    acceptance: jsonOr<PublicAgencyDoc['acceptance']>(row.approval_json, null),
  };
  return c.json(view);
});

// The client approves by typing a name. Once only: the status moves first, and a second tap finds it already moved.
docsPublic.post('/:token/approve', async (c) => {
  const db = c.env.DB;
  const row = await sentDoc(db, c.req.param('token'));
  if (!row) return c.json({ error: 'no document at this link' }, 404);
  if (row.status === 'approved') return c.json({ error: 'this document is already approved' }, 400);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const name = str(body.name, 80);
  const title = str(body.title, 80);
  if (!name) return c.json({ error: 'type your full name' }, 400);
  if (body.agree !== true) return c.json({ error: 'tick that you have read and agree' }, 400);
  const answers = cleanAnswers(docOf(row.body_json), body.answers);
  const now = nowIso();
  const res = await db
    .prepare("UPDATE agency_docs SET status = 'approved', approved_at = ?, approval_json = ?, answers_json = ?, updated_at = ? WHERE id = ? AND status IN ('sent', 'revised')")
    .bind(now, JSON.stringify({ name, title, at: now }), JSON.stringify(answers), now, row.id)
    .run();
  if (!res.meta.changes) return c.json({ error: 'this document is already approved' }, 400);
  await logDoc(db, row.user_id, 'doc', row.id, 'approved', name.slice(0, 80));
  await notify(db, row.user_id, 'agency', `${name} approved ${row.title}`, '', `/agency/docs/${row.id}`);
  return c.json({ ok: true });
});

docsPublic.post('/:token/comments', async (c) => {
  const db = c.env.DB;
  const row = await sentDoc(db, c.req.param('token'));
  if (!row) return c.json({ error: 'no document at this link' }, 404);
  if (!docOf(row.body_json).show.comments) return c.json({ error: 'comments are switched off on this document' }, 403);
  const body = await c.req.json<{ body?: string }>().catch(() => ({}) as { body?: string });
  const text = str(body.body, DOC_COMMENT_MAX);
  if (!text) return c.json({ error: 'write something' }, 400);
  await db.prepare("INSERT INTO agency_doc_comments (id, user_id, doc_type, doc_id, author, body, created_at) VALUES (?, ?, 'doc', ?, 'client', ?, ?)").bind(newId(), row.user_id, row.id, text, nowIso()).run();
  await notify(db, row.user_id, 'agency', `${row.client_name ?? 'The client'} wrote on ${row.title}`, text.slice(0, 160), `/agency/docs/${row.id}`);
  return c.json({ ok: true }, 201);
});
