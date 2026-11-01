import { Hono } from 'hono';
import {
  AGENCY_CLIENT_STATUSES,
  AGENCY_CURRENCIES,
  AGENCY_DEFAULT_WEEKLY_HOURS,
  AGENCY_HEALTH,
  AGENCY_MAX_CLIENTS,
  AGENCY_MAX_MINUTES,
  AGENCY_NAME_MAX,
  AGENCY_NOTE_MAX,
  AGENCY_NOTES_MAX,
  AGENCY_TITLE_MAX,
  AGENCY_MAX_ITEMS,
  DELIVERABLE_KINDS,
  parseParty,
  parsePortalShow,
  type PortalShow,
  parseProfile,
  type InvoiceParty,
  DELIVERABLE_STAGES,
  deliverableOverdue,
  monthBounds,
  type AgencyCampaign,
  type AgencyClient,
  type AgencyClientPage,
  type AgencyDeliverable,
  type AgencyInvoiceRow,
  type AgencyNote,
  type AgencyOverview,
  type AgencySettings,
  type AgencyTimeEntry,
  type AgencyTotals,
  type DeliverableKind,
  type DeliverableStage,
  type PortalView,
} from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { DATE_RE, dayFromDevice, newId, nameOf, notify, nowIso, num, oneOf, pageOf, paged, randomCode, shiftDate, str } from '../db';
import { resolveAccess } from '../access';
import { uploadVersion } from './army';

/**
 * Agency: a content agency's or a freelance creator's clients, the deliverables made for them, time, approvals and invoices.
 * Owner only: every query filters by the session user. The day always comes from the device (`?day=`), like a task's tick.
 */
export const agency = new Hono<AppEnv>();
/** What a client sees at their link, mounted at /public/agency. */
export const agencyPublic = new Hono<AppEnv>();

const utcToday = () => new Date().toISOString().slice(0, 10);
/** The person's day from the device, else today in UTC. A day more than a day ahead is not a real today. */
const dayOf = dayFromDevice;
const dateOrNull = (v: unknown): string | null => (typeof v === 'string' && DATE_RE.test(v) ? v : null);
const moneyIn = (v: unknown): number => num(v, 0, 0, 1_000_000_000_00) ?? 0;

// ---- rows

interface ClientRow {
  id: string; user_id: string; name: string; contact_name: string; contact_email: string; status: AgencyClient['status']; health: AgencyClient['health']; channels_json: string; retainer_cents: number;
  pieces_per_month: number; hours_per_month: number; renewal_date: string | null; notes: string; campaign_id: string | null; billing_json: string; portal_token: string | null; portal_json: string; created_at: string; campaign_name?: string | null;
}
interface ItemRow {
  id: string; client_id: string; client_name: string; title: string; kind: DeliverableKind; platform: string; stage: DeliverableStage; due_date: string | null; publish_date: string | null; link: string; notes: string;
  army_deliverable_id: string | null; fee_cents: number; revisions: number; approved_at: string | null; published_at: string | null; approved_day: string | null; published_day: string | null; created_at: string; note_count: number; army_status: string | null; army_feedback: string | null;
}
const ITEM_SELECT = `SELECT i.*, c.name AS client_name,
  (SELECT COUNT(*) FROM agency_notes n WHERE n.item_id = i.id) AS note_count,
  (SELECT cd.status FROM campaign_deliverables cd WHERE cd.id = i.army_deliverable_id) AS army_status,
  (SELECT f.comment FROM feedback_items f JOIN deliverable_versions v ON v.id = f.deliverable_version_id WHERE v.deliverable_id = i.army_deliverable_id ORDER BY f.created_at DESC LIMIT 1) AS army_feedback
  FROM agency_items i JOIN agency_clients c ON c.id = i.client_id`;

const list = (raw: string): string[] => {
  try {
    const v = JSON.parse(raw || '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

function toItem(r: ItemRow, today: string): AgencyDeliverable {
  return {
    id: r.id,
    clientId: r.client_id,
    clientName: r.client_name,
    title: r.title,
    kind: r.kind,
    platform: r.platform,
    stage: r.stage,
    dueDate: r.due_date,
    publishDate: r.publish_date,
    link: r.link,
    notes: r.notes,
    armyDeliverableId: r.army_deliverable_id,
    army: r.army_deliverable_id && r.army_status ? { status: r.army_status, feedback: r.army_feedback ?? '' } : null,
    noteCount: r.note_count,
    feeCents: r.fee_cents,
    revisions: r.revisions,
    approvedAt: r.approved_at,
    publishedAt: r.published_at,
    createdAt: r.created_at,
    overdue: deliverableOverdue(r.stage, r.due_date, r.publish_date, today),
  };
}

export async function settingsFor(db: D1Database, userId: string): Promise<AgencySettings> {
  const r = await db.prepare('SELECT currency, weekly_hours, profile_json FROM agency_settings WHERE user_id = ?').bind(userId).first<{ currency: string; weekly_hours: number; profile_json: string }>();
  let profile = parseProfile({});
  try {
    profile = parseProfile(JSON.parse(r?.profile_json || '{}'));
  } catch {
    /* an unreadable profile is an empty one */
  }
  return { currency: r?.currency ?? 'INR', weeklyHours: r?.weekly_hours ?? AGENCY_DEFAULT_WEEKLY_HOURS, profile };
}

interface MonthStats { published: number; inReview: number; open: number; overdue: number; minutes: number; billableMinutes: number }
const emptyStats = (): MonthStats => ({ published: 0, inReview: 0, open: 0, overdue: 0, minutes: 0, billableMinutes: 0 });

/** This month's numbers for every client in two grouped queries. */
async function statsFor(db: D1Database, userId: string, today: string): Promise<Map<string, MonthStats>> {
  const { start, end } = monthBounds(today.slice(0, 7));
  const [items, time] = await Promise.all([
    db
      .prepare(
        `SELECT client_id,
          SUM(CASE WHEN stage = 'published' AND published_day >= ?2 AND published_day <= ?3 THEN 1 ELSE 0 END) AS published,
          SUM(CASE WHEN stage = 'review' THEN 1 ELSE 0 END) AS in_review,
          SUM(CASE WHEN stage != 'published' THEN 1 ELSE 0 END) AS open,
          SUM(CASE WHEN stage = 'approved' AND COALESCE(publish_date, due_date) < ?4 THEN 1 WHEN stage NOT IN ('approved', 'published') AND due_date < ?4 THEN 1 ELSE 0 END) AS overdue
        FROM agency_items WHERE user_id = ?1 GROUP BY client_id`,
      )
      .bind(userId, start, end, today)
      .all<{ client_id: string; published: number; in_review: number; open: number; overdue: number }>(),
    db
      .prepare('SELECT client_id, SUM(minutes) AS minutes, SUM(CASE WHEN billable = 1 THEN minutes ELSE 0 END) AS billable FROM agency_time WHERE user_id = ? AND day >= ? AND day <= ? GROUP BY client_id')
      .bind(userId, start, end)
      .all<{ client_id: string; minutes: number; billable: number }>(),
  ]);
  const out = new Map<string, MonthStats>();
  for (const r of items.results) out.set(r.client_id, { ...emptyStats(), published: r.published ?? 0, inReview: r.in_review ?? 0, open: r.open ?? 0, overdue: r.overdue ?? 0 });
  for (const r of time.results) out.set(r.client_id, { ...(out.get(r.client_id) ?? emptyStats()), minutes: r.minutes ?? 0, billableMinutes: r.billable ?? 0 });
  return out;
}

/** Plain reasons to look at a client. */
function flagsFor(r: ClientRow, m: MonthStats, today: string): string[] {
  const flags: string[] = [];
  if (r.status !== 'active') return flags;
  if (m.overdue > 0) flags.push(`${m.overdue} late`);
  if (m.inReview > 0) flags.push(`${m.inReview} waiting for them`);
  const [y, mo] = today.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y ?? 2026, mo ?? 1, 0)).getUTCDate();
  const day = Number(today.slice(8, 10));
  if (r.pieces_per_month > 0) {
    const expected = Math.floor((r.pieces_per_month * day) / daysInMonth);
    if (m.published + 1 < expected) flags.push(`${m.published} of ${r.pieces_per_month} published, behind`);
  }
  if (r.hours_per_month > 0 && m.billableMinutes > r.hours_per_month * 60) flags.push('over the hours they pay for');
  if (r.renewal_date) {
    const left = Math.round((Date.parse(`${r.renewal_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    if (left >= 0 && left <= 30) flags.push(left === 0 ? 'renews today' : `renews in ${left} day${left === 1 ? '' : 's'}`);
  }
  if (r.health === 'red') flags.push('marked at risk');
  return flags;
}

function portalOf(raw: string): PortalShow {
  try {
    return parsePortalShow(JSON.parse(raw || '{}'));
  } catch {
    return parsePortalShow({});
  }
}

/** What goes under "Billed to": what was saved, with the client's name and email filled in where it left them empty. */
export function billingOf(r: Pick<ClientRow, 'billing_json' | 'name' | 'contact_email'>): InvoiceParty {
  let saved: InvoiceParty;
  try {
    saved = parseParty(JSON.parse(r.billing_json || '{}'));
  } catch {
    saved = parseParty({});
  }
  return { ...saved, name: saved.name || r.name, email: saved.email || r.contact_email };
}

function toClient(r: ClientRow, m: MonthStats, today: string): AgencyClient {
  return {
    id: r.id,
    name: r.name,
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    status: r.status,
    health: r.health,
    channels: list(r.channels_json),
    retainerCents: r.retainer_cents,
    piecesPerMonth: r.pieces_per_month,
    hoursPerMonth: r.hours_per_month,
    renewalDate: r.renewal_date,
    notes: r.notes,
    campaignId: r.campaign_id,
    campaignName: r.campaign_name ?? '',
    billing: billingOf(r),
    portal: portalOf(r.portal_json),
    portalToken: r.portal_token,
    createdAt: r.created_at,
    month: m,
    flags: flagsFor(r, m, today),
  };
}

const CLIENT_SELECT = 'SELECT c.*, (SELECT name FROM campaigns WHERE id = c.campaign_id) AS campaign_name FROM agency_clients c';

async function clientRow(db: D1Database, userId: string, id: string): Promise<ClientRow | null> {
  return db.prepare(`${CLIENT_SELECT} WHERE c.id = ? AND c.user_id = ?`).bind(id, userId).first<ClientRow>();
}

/** Channels typed in: trimmed, no repeats, up to ten. */
function channelsIn(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = str(x, 30);
    if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out.slice(0, 10);
}

/** The Army campaigns this person is a creator on, with their deliverables. Empty while Army is off for them. */
async function campaignsFor(c: { env: AppEnv['Bindings'] }, user: UserRow): Promise<AgencyCampaign[]> {
  const db = c.env.DB;
  const { access } = await resolveAccess(db, user);
  if (!access.army?.available) return [];
  const camps = await db
    .prepare(
      `SELECT c.id, c.name, o.name AS brand FROM campaigns c JOIN organizations o ON o.id = c.organization_id
       WHERE c.id IN (SELECT campaign_id FROM campaign_assignments WHERE creator_user_id = ? AND status IN ('accepted', 'done')) ORDER BY c.updated_at DESC LIMIT 30`,
    )
    .bind(user.id)
    .all<{ id: string; name: string; brand: string }>();
  if (camps.results.length === 0) return [];
  const marks = camps.results.map(() => '?').join(',');
  const ds = await db
    .prepare(
      `SELECT d.id, d.campaign_id, d.title, d.platform, d.due_at, d.status,
        (SELECT COUNT(*) FROM agency_items i WHERE i.army_deliverable_id = d.id AND i.user_id = ?) AS linked
       FROM campaign_deliverables d WHERE d.campaign_id IN (${marks}) ORDER BY d.created_at`,
    )
    .bind(user.id, ...camps.results.map((x) => x.id))
    .all<{ id: string; campaign_id: string; title: string; platform: string; due_at: string | null; status: string; linked: number }>();
  return camps.results.map((k) => ({
    id: k.id,
    name: k.name,
    brand: k.brand,
    deliverables: ds.results.filter((d) => d.campaign_id === k.id).map((d) => ({ id: d.id, title: d.title, platform: d.platform, dueAt: d.due_at, status: d.status, linked: d.linked > 0 })),
  }));
}

/** Whether a campaign is one the person is a creator on, and Army is open to them. */
async function ownCampaign(c: { env: AppEnv['Bindings'] }, user: UserRow, campaignId: string): Promise<boolean> {
  return (await campaignsFor(c, user)).some((k) => k.id === campaignId);
}

// ---- overview

agency.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const today = dayOf(c.req.query('day'));
  const month = today.slice(0, 7);
  const { start, end } = monthBounds(month);
  const status = c.req.query('status');
  const ask = pageOf(c, 'c');

  const [settings, stats, all, week, unpaid, coming] = await Promise.all([
    settingsFor(db, user.id),
    statsFor(db, user.id, today),
    db.prepare(`${CLIENT_SELECT} WHERE c.user_id = ? ORDER BY CASE c.status WHEN 'active' THEN 0 WHEN 'lead' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END, c.name COLLATE NOCASE`).bind(user.id).all<ClientRow>(),
    db
      .prepare('SELECT SUM(minutes) AS minutes, SUM(CASE WHEN billable = 1 THEN minutes ELSE 0 END) AS billable FROM agency_time WHERE user_id = ? AND day >= ? AND day <= ?')
      .bind(user.id, shiftDate(today, -6), today)
      .first<{ minutes: number | null; billable: number | null }>(),
    db.prepare("SELECT COALESCE(SUM(total_cents), 0) AS cents FROM invoices WHERE user_id = ? AND agency_client_id IS NOT NULL AND status = 'sent'").bind(user.id).first<{ cents: number }>(),
    db
      .prepare(`${ITEM_SELECT} WHERE i.user_id = ?1 AND i.stage != 'published' AND COALESCE(i.publish_date, i.due_date) IS NOT NULL AND COALESCE(i.publish_date, i.due_date) <= ?2 ORDER BY COALESCE(i.publish_date, i.due_date) LIMIT 15`)
      .bind(user.id, shiftDate(today, 14))
      .all<ItemRow>(),
  ]);

  const rows = all.results;
  const active = rows.filter((r) => r.status === 'active');
  const total = [...stats.values()].reduce((a, s) => ({ ...a, inReview: a.inReview + s.inReview, overdue: a.overdue + s.overdue, published: a.published + s.published, minutes: a.minutes + s.minutes, billableMinutes: a.billableMinutes + s.billableMinutes, open: a.open + s.open }), emptyStats());
  const totals: AgencyTotals = {
    activeClients: active.length,
    retainerCents: active.reduce((a, r) => a + r.retainer_cents, 0),
    open: total.open,
    inReview: total.inReview,
    overdue: total.overdue,
    publishedMonth: total.published,
    plannedMonth: active.reduce((a, r) => a + r.pieces_per_month, 0),
    minutesMonth: total.minutes,
    billableMonth: total.billableMinutes,
    minutesWeek: week?.minutes ?? 0,
    billableWeek: week?.billable ?? 0,
    unpaidCents: unpaid?.cents ?? 0,
  };
  const attention = active
    .flatMap((r) => flagsFor(r, stats.get(r.id) ?? emptyStats(), today).map((f) => ({ clientId: r.id, text: `${r.name}: ${f}` })))
    .slice(0, 8);

  const filtered = status && (AGENCY_CLIENT_STATUSES as readonly string[]).includes(status) ? rows.filter((r) => r.status === status) : rows;
  const slice = filtered.slice(ask.offset, ask.offset + ask.limit);
  const pg = paged(slice, ask);
  const body: AgencyOverview = {
    settings,
    totals,
    attention,
    clients: pg.items.map((r) => toClient(r, stats.get(r.id) ?? emptyStats(), today)),
    page: pg.page,
    coming: coming.results.map((r) => toItem(r, today)),
  };
  void start;
  void end;
  return c.json(body);
});

agency.put('/settings', async (c) => {
  const user = c.get('user');
  const prev = await settingsFor(c.env.DB, user.id);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const currency = 'currency' in body ? oneOf(String(body.currency ?? '').toUpperCase(), AGENCY_CURRENCIES, 'INR') : prev.currency;
  const weeklyHours = 'weeklyHours' in body ? (num(body.weeklyHours, AGENCY_DEFAULT_WEEKLY_HOURS, 1, 100) ?? AGENCY_DEFAULT_WEEKLY_HOURS) : prev.weeklyHours;
  const profile = 'profile' in body ? parseProfile(body.profile) : prev.profile;
  await c.env.DB.prepare('INSERT INTO agency_settings (user_id, currency, weekly_hours, profile_json, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET currency = excluded.currency, weekly_hours = excluded.weekly_hours, profile_json = excluded.profile_json, updated_at = excluded.updated_at')
    .bind(user.id, currency, weeklyHours, JSON.stringify(profile), nowIso())
    .run();
  return c.json({ settings: { currency, weeklyHours, profile } satisfies AgencySettings });
});

// ---- clients

function clientFields(body: Record<string, unknown>, prev?: ClientRow) {
  return {
    name: str(body.name, AGENCY_NAME_MAX, prev?.name ?? ''),
    contactName: str(body.contactName, AGENCY_NAME_MAX, prev?.contact_name ?? ''),
    contactEmail: str(body.contactEmail, 120, prev?.contact_email ?? ''),
    status: oneOf(body.status, AGENCY_CLIENT_STATUSES, prev?.status ?? 'active'),
    health: oneOf(body.health, AGENCY_HEALTH, prev?.health ?? 'green'),
    channels: 'channels' in body ? channelsIn(body.channels) : list(prev?.channels_json ?? '[]'),
    retainerCents: 'retainerCents' in body ? moneyIn(body.retainerCents) : (prev?.retainer_cents ?? 0),
    piecesPerMonth: 'piecesPerMonth' in body ? (num(body.piecesPerMonth, 0, 0, 500) ?? 0) : (prev?.pieces_per_month ?? 0),
    hoursPerMonth: 'hoursPerMonth' in body ? (num(body.hoursPerMonth, 0, 0, 1000) ?? 0) : (prev?.hours_per_month ?? 0),
    renewalDate: 'renewalDate' in body ? dateOrNull(body.renewalDate) : (prev?.renewal_date ?? null),
    notes: str(body.notes, AGENCY_NOTES_MAX, prev?.notes ?? ''),
  };
}

agency.post('/clients', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const f = clientFields(body);
  if (!f.name) return c.json({ error: 'who is the client?' }, 400);
  const n = await db.prepare('SELECT COUNT(*) AS n FROM agency_clients WHERE user_id = ?').bind(user.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= AGENCY_MAX_CLIENTS) return c.json({ error: `up to ${AGENCY_MAX_CLIENTS} clients` }, 400);
  const id = newId();
  const now = nowIso();
  await db
    .prepare('INSERT INTO agency_clients (id, user_id, name, contact_name, contact_email, status, health, channels_json, retainer_cents, pieces_per_month, hours_per_month, renewal_date, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, user.id, f.name, f.contactName, f.contactEmail, f.status, f.health, JSON.stringify(f.channels), f.retainerCents, f.piecesPerMonth, f.hoursPerMonth, f.renewalDate, f.notes, now, now)
    .run();
  return c.json({ id }, 201);
});

agency.patch('/clients/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const prev = await clientRow(db, user.id, c.req.param('id'));
  if (!prev) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const f = clientFields(body, prev);
  if (!f.name) return c.json({ error: 'who is the client?' }, 400);
  let campaignId = prev.campaign_id;
  if ('campaignId' in body) {
    if (body.campaignId === null || body.campaignId === '') campaignId = null;
    else if (typeof body.campaignId === 'string' && (await ownCampaign(c, user, body.campaignId))) campaignId = body.campaignId;
    else return c.json({ error: 'you are not a creator on that campaign' }, 403);
  }
  const billing = 'billing' in body ? JSON.stringify(parseParty(body.billing)) : prev.billing_json;
  await db
    .prepare('UPDATE agency_clients SET name = ?, contact_name = ?, contact_email = ?, status = ?, health = ?, channels_json = ?, retainer_cents = ?, pieces_per_month = ?, hours_per_month = ?, renewal_date = ?, notes = ?, campaign_id = ?, billing_json = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(f.name, f.contactName, f.contactEmail, f.status, f.health, JSON.stringify(f.channels), f.retainerCents, f.piecesPerMonth, f.hoursPerMonth, f.renewalDate, f.notes, campaignId, billing, nowIso(), prev.id, user.id)
    .run();
  return c.json({ ok: true });
});

agency.delete('/clients/:id', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM agency_clients WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  if (!res.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

agency.get('/clients/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const today = dayOf(c.req.query('day'));
  const { start, end } = monthBounds(today.slice(0, 7));
  const row = await clientRow(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const [settings, stats, counts, channels, time, invoices, campaigns] = await Promise.all([
    settingsFor(db, user.id),
    statsFor(db, user.id, today),
    db.prepare('SELECT stage, COUNT(*) AS n FROM agency_items WHERE client_id = ? AND user_id = ? GROUP BY stage').bind(row.id, user.id).all<{ stage: DeliverableStage; n: number }>(),
    db
      .prepare(
        `SELECT platform, SUM(CASE WHEN stage = 'published' AND published_day >= ?3 AND published_day <= ?4 THEN 1 ELSE 0 END) AS published, SUM(CASE WHEN stage != 'published' THEN 1 ELSE 0 END) AS open
         FROM agency_items WHERE client_id = ?1 AND user_id = ?2 AND platform != '' GROUP BY platform ORDER BY published DESC, open DESC`,
      )
      .bind(row.id, user.id, start, end)
      .all<{ platform: string; published: number; open: number }>(),
    db
      .prepare('SELECT t.*, i.title AS item_title FROM agency_time t LEFT JOIN agency_items i ON i.id = t.item_id WHERE t.client_id = ? AND t.user_id = ? ORDER BY t.day DESC, t.created_at DESC LIMIT 20')
      .bind(row.id, user.id)
      .all<{ id: string; client_id: string; item_id: string | null; item_title: string | null; day: string; minutes: number; billable: number; note: string }>(),
    db.prepare('SELECT id, number, total_cents, currency, status, issue_date, token FROM invoices WHERE user_id = ? AND agency_client_id = ? ORDER BY created_at DESC LIMIT 12').bind(user.id, row.id).all<{ id: string; number: string; total_cents: number; currency: string; status: AgencyInvoiceRow['status']; issue_date: string; token: string }>(),
    campaignsFor(c, user),
  ]);
  const by = Object.fromEntries(DELIVERABLE_STAGES.map((s) => [s, 0])) as Record<DeliverableStage, number>;
  for (const r of counts.results) by[r.stage] = r.n;
  const body: AgencyClientPage = {
    settings,
    client: toClient(row, stats.get(row.id) ?? emptyStats(), today),
    counts: by,
    byChannel: channels.results.map((r) => ({ channel: r.platform, published: r.published ?? 0, open: r.open ?? 0 })),
    campaigns,
    time: time.results.map((t): AgencyTimeEntry => ({ id: t.id, clientId: t.client_id, clientName: row.name, itemId: t.item_id, itemTitle: t.item_title ?? '', day: t.day, minutes: t.minutes, billable: t.billable === 1, note: t.note })),
    invoices: invoices.results.map((i): AgencyInvoiceRow => ({ id: i.id, number: i.number, totalCents: i.total_cents, currency: i.currency, status: i.status, issueDate: i.issue_date, token: i.token })),
  };
  return c.json(body);
});

// The client link: switch it on to make one, off to close it, ask for a fresh one when the old one got around, and say what it shows.
agency.post('/clients/:id/portal', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await clientRow(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<{ on?: boolean; fresh?: boolean; show?: unknown }>().catch(() => ({}) as { on?: boolean; fresh?: boolean; show?: unknown });
  const token = body.on === false ? null : body.fresh || !row.portal_token ? randomCode(16) : row.portal_token;
  // The switches the person sent replace the saved ones part by part; any they left out stay as they were.
  const show = body.show && typeof body.show === 'object' ? parsePortalShow({ ...portalOf(row.portal_json), ...(body.show as Record<string, unknown>) }) : portalOf(row.portal_json);
  await db.prepare('UPDATE agency_clients SET portal_token = ?, portal_json = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(token, JSON.stringify(show), nowIso(), row.id, user.id).run();
  return c.json({ portalToken: token, portal: show });
});

// Pull the deliverables of the Army campaign this client is served through into the pipeline. Each is linked, none twice.
agency.post('/clients/:id/army-import', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await clientRow(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  if (!row.campaign_id || !(await ownCampaign(c, user, row.campaign_id))) return c.json({ error: 'link this client to a campaign you are a creator on first' }, 400);
  const ds = await db
    .prepare('SELECT d.id, d.title, d.format, d.platform, d.due_at FROM campaign_deliverables d WHERE d.campaign_id = ? AND d.id NOT IN (SELECT army_deliverable_id FROM agency_items WHERE user_id = ? AND army_deliverable_id IS NOT NULL) LIMIT 30')
    .bind(row.campaign_id, user.id)
    .all<{ id: string; title: string; format: string; platform: string; due_at: string | null }>();
  const n = await db.prepare('SELECT COUNT(*) AS n FROM agency_items WHERE user_id = ?').bind(user.id).first<{ n: number }>();
  if ((n?.n ?? 0) + ds.results.length > AGENCY_MAX_ITEMS) return c.json({ error: 'too many deliverables; finish or remove some first' }, 400);
  const now = nowIso();
  const kindOfFormat = (f: string): DeliverableKind => {
    const x = f.toLowerCase();
    return x.includes('short') || x.includes('reel') ? 'short' : x.includes('video') ? 'video' : x.includes('post') ? 'post' : x.includes('story') ? 'post' : x.includes('podcast') ? 'podcast' : 'other';
  };
  if (ds.results.length > 0) {
    await db.batch(
      ds.results.map((d) =>
        db
          .prepare("INSERT INTO agency_items (id, user_id, client_id, title, kind, platform, stage, due_date, army_deliverable_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'idea', ?, ?, ?, ?)")
          .bind(newId(), user.id, row.id, d.title.slice(0, AGENCY_TITLE_MAX), kindOfFormat(d.format), d.platform.slice(0, 30), d.due_at ? d.due_at.slice(0, 10) : null, d.id, now, now),
      ),
    );
  }
  return c.json({ added: ds.results.length });
});

// ---- deliverables

agency.get('/items', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const today = dayOf(c.req.query('day'));
  const ask = pageOf(c);
  const client = c.req.query('client');
  const stage = c.req.query('stage');
  const channel = c.req.query('channel');
  const where = ['i.user_id = ?'];
  const binds: unknown[] = [user.id];
  if (client) {
    where.push('i.client_id = ?');
    binds.push(client);
  }
  if (stage && (DELIVERABLE_STAGES as readonly string[]).includes(stage)) {
    where.push('i.stage = ?');
    binds.push(stage);
  }
  if (channel) {
    where.push('i.platform = ?');
    binds.push(channel);
  }
  const [rows, counts] = await Promise.all([
    db
      .prepare(`${ITEM_SELECT} WHERE ${where.join(' AND ')} ORDER BY CASE WHEN i.stage = 'published' THEN 1 ELSE 0 END, COALESCE(i.publish_date, i.due_date, '9999-12-31'), i.created_at DESC LIMIT ? OFFSET ?`)
      .bind(...binds, ask.limit, ask.offset)
      .all<ItemRow>(),
    db
      .prepare(`SELECT i.stage, COUNT(*) AS n FROM agency_items i WHERE i.user_id = ?${client ? ' AND i.client_id = ?' : ''}${channel ? ' AND i.platform = ?' : ''} GROUP BY i.stage`)
      .bind(...[user.id, ...(client ? [client] : []), ...(channel ? [channel] : [])])
      .all<{ stage: DeliverableStage; n: number }>(),
  ]);
  const by = Object.fromEntries(DELIVERABLE_STAGES.map((s) => [s, 0])) as Record<DeliverableStage, number>;
  for (const r of counts.results) by[r.stage] = r.n;
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, items: pg.items.map((r) => toItem(r, today)), counts: by });
});

// The board: one column a stage, each with its own count and the first few cards. "per" grows a column ("Show more").
agency.get('/board', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const today = dayOf(c.req.query('day'));
  const per = Math.max(5, Math.min(100, Math.floor(Number(c.req.query('per')) || 25)));
  const client = c.req.query('client');
  const channel = c.req.query('channel');
  const extra = `${client ? ' AND i.client_id = ?' : ''}${channel ? ' AND i.platform = ?' : ''}`;
  const extraBinds = [...(client ? [client] : []), ...(channel ? [channel] : [])];
  const columns = await Promise.all(
    DELIVERABLE_STAGES.map(async (stage) => {
      const [rows, total] = await Promise.all([
        db
          .prepare(`${ITEM_SELECT} WHERE i.user_id = ? AND i.stage = ?${extra} ORDER BY COALESCE(i.publish_date, i.due_date, '9999-12-31'), i.created_at DESC LIMIT ?`)
          .bind(user.id, stage, ...extraBinds, per)
          .all<ItemRow>(),
        db.prepare(`SELECT COUNT(*) AS n FROM agency_items i WHERE i.user_id = ? AND i.stage = ?${extra}`).bind(user.id, stage, ...extraBinds).first<{ n: number }>(),
      ]);
      return { stage, total: total?.n ?? 0, items: rows.results.map((r) => toItem(r, today)) };
    }),
  );
  return c.json({ columns });
});

interface ItemFields { title: string; kind: DeliverableKind; platform: string; stage: DeliverableStage; dueDate: string | null; publishDate: string | null; link: string; notes: string; feeCents: number }
function itemFields(body: Record<string, unknown>, prev?: ItemRow): ItemFields {
  return {
    title: str(body.title, AGENCY_TITLE_MAX, prev?.title ?? ''),
    kind: oneOf(body.kind, DELIVERABLE_KINDS, prev?.kind ?? 'video'),
    platform: 'platform' in body ? str(body.platform, 30) : (prev?.platform ?? ''),
    stage: oneOf(body.stage, DELIVERABLE_STAGES, prev?.stage ?? 'idea'),
    dueDate: 'dueDate' in body ? dateOrNull(body.dueDate) : (prev?.due_date ?? null),
    publishDate: 'publishDate' in body ? dateOrNull(body.publishDate) : (prev?.publish_date ?? null),
    link: 'link' in body ? httpsOrEmpty(body.link) : (prev?.link ?? ''),
    notes: 'notes' in body ? str(body.notes, AGENCY_NOTES_MAX) : (prev?.notes ?? ''),
    feeCents: 'feeCents' in body ? moneyIn(body.feeCents) : (prev?.fee_cents ?? 0),
  };
}
/** Links are kept only when they are https web addresses. */
function httpsOrEmpty(v: unknown): string {
  const s = str(v, 500);
  if (!s) return '';
  try {
    return new URL(s).protocol === 'https:' ? s : '';
  } catch {
    return '';
  }
}

agency.post('/items', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const today = dayOf(c.req.query('day'));
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const client = typeof body.clientId === 'string' ? await clientRow(db, user.id, body.clientId) : null;
  if (!client) return c.json({ error: 'pick a client' }, 400);
  const f = itemFields(body);
  if (!f.title) return c.json({ error: 'what is it called?' }, 400);
  const n = await db.prepare('SELECT COUNT(*) AS n FROM agency_items WHERE user_id = ?').bind(user.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= AGENCY_MAX_ITEMS) return c.json({ error: 'too many deliverables; finish or remove some first' }, 400);
  const id = newId();
  const now = nowIso();
  await db
    .prepare('INSERT INTO agency_items (id, user_id, client_id, title, kind, platform, stage, due_date, publish_date, link, notes, fee_cents, approved_at, approved_day, published_at, published_day, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, user.id, client.id, f.title, f.kind, f.platform, f.stage, f.dueDate, f.publishDate, f.link, f.notes, f.feeCents, f.stage === 'approved' || f.stage === 'published' ? now : null, f.stage === 'approved' || f.stage === 'published' ? today : null, f.stage === 'published' ? now : null, f.stage === 'published' ? today : null, now, now)
    .run();
  return c.json({ id }, 201);
});

agency.patch('/items/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const today = dayOf(c.req.query('day'));
  const prev = await db.prepare(`${ITEM_SELECT} WHERE i.id = ? AND i.user_id = ?`).bind(c.req.param('id'), user.id).first<ItemRow>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const f = itemFields(body, prev);
  if (!f.title) return c.json({ error: 'what is it called?' }, 400);
  const now = nowIso();
  // Moving along sets the days from the device; moving back clears what no longer holds.
  const rank = (s: DeliverableStage) => DELIVERABLE_STAGES.indexOf(s);
  const approved = rank(f.stage) >= rank('approved');
  const published = f.stage === 'published';
  await db
    .prepare('UPDATE agency_items SET title = ?, kind = ?, platform = ?, stage = ?, due_date = ?, publish_date = ?, link = ?, notes = ?, fee_cents = ?, approved_at = ?, approved_day = ?, published_at = ?, published_day = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(
      f.title, f.kind, f.platform, f.stage, f.dueDate, f.publishDate, f.link, f.notes, f.feeCents,
      approved ? (prev.approved_at ?? now) : null,
      approved ? (prev.approved_day ?? today) : null,
      published ? (prev.published_at ?? now) : null,
      published ? (prev.published_day ?? today) : null,
      now, prev.id, user.id,
    )
    .run();
  return c.json({ ok: true });
});

agency.delete('/items/:id', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM agency_items WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  if (!res.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

// ---- the thread on a deliverable

interface NoteRow { id: string; author: AgencyNote['author']; shared: number; body: string; created_at: string }
const toNote = (r: NoteRow): AgencyNote => ({ id: r.id, author: r.author, shared: r.shared === 1, body: r.body, createdAt: r.created_at });

agency.get('/items/:id/notes', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const item = await db.prepare('SELECT id FROM agency_items WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first();
  if (!item) return c.json({ error: 'not found' }, 404);
  const rows = await db.prepare('SELECT id, author, shared, body, created_at FROM agency_notes WHERE item_id = ? AND user_id = ? ORDER BY created_at LIMIT 100').bind(c.req.param('id'), user.id).all<NoteRow>();
  return c.json({ notes: rows.results.map(toNote) });
});

agency.post('/items/:id/notes', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const item = await db.prepare('SELECT id FROM agency_items WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first();
  if (!item) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const text = str(body.body, AGENCY_NOTE_MAX);
  if (!text) return c.json({ error: 'write something' }, 400);
  const id = newId();
  await db.prepare("INSERT INTO agency_notes (id, user_id, item_id, author, shared, body, created_at) VALUES (?, ?, ?, 'me', ?, ?, ?)").bind(id, user.id, c.req.param('id'), body.shared === true ? 1 : 0, text, nowIso()).run();
  return c.json({ id }, 201);
});

agency.delete('/notes/:id', async (c) => {
  const res = await c.env.DB.prepare("DELETE FROM agency_notes WHERE id = ? AND user_id = ? AND author = 'me'").bind(c.req.param('id'), c.get('user').id).run();
  if (!res.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

// ---- Army: send a version to the brand, and take its answer back

async function armyReady(c: { env: AppEnv['Bindings'] }, user: UserRow): Promise<boolean> {
  const { access } = await resolveAccess(c.env.DB, user);
  return Boolean(access.army?.available);
}

agency.post('/items/:id/army/send', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const today = dayOf(c.req.query('day'));
  const item = await db.prepare('SELECT id, title, link, army_deliverable_id, stage FROM agency_items WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first<{ id: string; title: string; link: string; army_deliverable_id: string | null; stage: DeliverableStage }>();
  if (!item) return c.json({ error: 'not found' }, 404);
  if (!item.army_deliverable_id) return c.json({ error: 'this deliverable is not linked to Army' }, 400);
  if (!(await armyReady(c, user))) return c.json({ error: 'Army is not available on your account.' }, 403);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const url = httpsOrEmpty(body.url) || item.link;
  const res = await uploadVersion(db, user, item.army_deliverable_id, url, str(body.note, 1000));
  if (!res.ok) return c.json({ error: res.error }, res.status);
  const now = nowIso();
  await db.batch([
    db.prepare("UPDATE agency_items SET stage = 'review', link = ?, updated_at = ? WHERE id = ?").bind(url, now, item.id),
    db.prepare("INSERT INTO agency_notes (id, user_id, item_id, author, shared, body, created_at) VALUES (?, ?, ?, 'me', 0, ?, ?)").bind(newId(), user.id, item.id, `Sent to the brand in Army on ${today}.`, now),
  ]);
  return c.json({ ok: true });
});

// The brand's answer in Army moves the deliverable: approved, or back to making with the feedback in the thread.
agency.post('/items/:id/army/sync', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const today = dayOf(c.req.query('day'));
  const item = await db.prepare(`${ITEM_SELECT} WHERE i.id = ? AND i.user_id = ?`).bind(c.req.param('id'), user.id).first<ItemRow>();
  if (!item) return c.json({ error: 'not found' }, 404);
  if (!item.army_deliverable_id || !item.army_status) return c.json({ error: 'this deliverable is not linked to Army' }, 400);
  if (!(await armyReady(c, user))) return c.json({ error: 'Army is not available on your account.' }, 403);
  const now = nowIso();
  const stmts: D1PreparedStatement[] = [];
  if (item.army_feedback) {
    const seen = await db.prepare("SELECT 1 AS x FROM agency_notes WHERE item_id = ? AND author = 'brand' AND body = ?").bind(item.id, item.army_feedback.slice(0, AGENCY_NOTE_MAX)).first();
    if (!seen) stmts.push(db.prepare("INSERT INTO agency_notes (id, user_id, item_id, author, shared, body, created_at) VALUES (?, ?, ?, 'brand', 0, ?, ?)").bind(newId(), user.id, item.id, item.army_feedback.slice(0, AGENCY_NOTE_MAX), now));
  }
  let moved: DeliverableStage | null = null;
  if (item.army_status === 'approved' && item.stage !== 'approved' && item.stage !== 'published') {
    moved = 'approved';
    stmts.push(db.prepare("UPDATE agency_items SET stage = 'approved', approved_at = COALESCE(approved_at, ?), approved_day = COALESCE(approved_day, ?), updated_at = ? WHERE id = ?").bind(now, today, now, item.id));
  } else if (item.army_status === 'changes' && item.stage === 'review') {
    moved = 'making';
    stmts.push(db.prepare("UPDATE agency_items SET stage = 'making', revisions = revisions + 1, updated_at = ? WHERE id = ?").bind(now, item.id));
  }
  if (stmts.length > 0) await db.batch(stmts);
  return c.json({ moved });
});

// ---- time

agency.post('/time', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const client = typeof body.clientId === 'string' ? await clientRow(db, user.id, body.clientId) : null;
  if (!client) return c.json({ error: 'pick a client' }, 400);
  const day = dateOrNull(body.day);
  if (!day || day > shiftDate(utcToday(), 1)) return c.json({ error: 'pick a day that has started' }, 400);
  const minutes = num(body.minutes, 0, 0, AGENCY_MAX_MINUTES) ?? 0;
  if (minutes < 1) return c.json({ error: 'how long?' }, 400);
  let itemId: string | null = null;
  if (typeof body.itemId === 'string' && body.itemId) {
    const it = await db.prepare('SELECT id FROM agency_items WHERE id = ? AND user_id = ? AND client_id = ?').bind(body.itemId, user.id, client.id).first<{ id: string }>();
    if (!it) return c.json({ error: 'that deliverable is not this client\'s' }, 400);
    itemId = it.id;
  }
  const id = newId();
  await db.prepare('INSERT INTO agency_time (id, user_id, client_id, item_id, day, minutes, billable, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, user.id, client.id, itemId, day, minutes, body.billable === false ? 0 : 1, str(body.note, 200), nowIso()).run();
  return c.json({ id }, 201);
});

agency.delete('/time/:id', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM agency_time WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  if (!res.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

// ---- the client's link

interface PortalClient { id: string; user_id: string; name: string; pieces_per_month: number; hours_per_month: number; portal_json: string; owner_name: string }
async function portalClient(db: D1Database, token: string): Promise<PortalClient | null> {
  if (!/^[A-Z0-9]{16}$/.test(token)) return null;
  return db
    .prepare('SELECT c.id, c.user_id, c.name, c.pieces_per_month, c.hours_per_month, c.portal_json, u.display_name AS owner_name FROM agency_clients c JOIN users u ON u.id = c.user_id WHERE c.portal_token = ?')
    .bind(token)
    .first<PortalClient>();
}

// The client's dashboard: only the parts the owner switched on. Fees, private notes, time entries and other clients are never in it.
agencyPublic.get('/:token', async (c) => {
  const db = c.env.DB;
  const client = await portalClient(db, c.req.param('token'));
  if (!client) return c.json({ error: 'no page at this link' }, 404);
  const show = portalOf(client.portal_json);
  const { start, end } = monthBounds(utcToday().slice(0, 7));
  const none = <T,>() => Promise.resolve({ results: [] as T[] });
  type Waiting = { id: string; title: string; kind: DeliverableKind; platform: string; link: string; publish_date: string | null };
  const [waiting, coming, done, count, channels, time, invoices, contracts] = await Promise.all([
    show.waiting ? db.prepare("SELECT id, title, kind, platform, link, publish_date FROM agency_items WHERE client_id = ? AND stage = 'review' ORDER BY COALESCE(publish_date, due_date, '9999-12-31') LIMIT 50").bind(client.id).all<Waiting>() : none<Waiting>(),
    show.coming ? db.prepare("SELECT title, kind, platform, stage, publish_date FROM agency_items WHERE client_id = ? AND stage IN ('script', 'making', 'approved') ORDER BY COALESCE(publish_date, due_date, '9999-12-31') LIMIT 30").bind(client.id).all<{ title: string; kind: DeliverableKind; platform: string; stage: DeliverableStage; publish_date: string | null }>() : none<{ title: string; kind: DeliverableKind; platform: string; stage: DeliverableStage; publish_date: string | null }>(),
    show.published ? db.prepare("SELECT title, kind, platform, link, published_at FROM agency_items WHERE client_id = ? AND stage = 'published' ORDER BY published_at DESC LIMIT 20").bind(client.id).all<{ title: string; kind: DeliverableKind; platform: string; link: string; published_at: string | null }>() : none<{ title: string; kind: DeliverableKind; platform: string; link: string; published_at: string | null }>(),
    show.progress ? db.prepare("SELECT COUNT(*) AS n FROM agency_items WHERE client_id = ? AND stage = 'published' AND published_day >= ? AND published_day <= ?").bind(client.id, start, end).first<{ n: number }>() : Promise.resolve(null),
    show.channels
      ? db.prepare("SELECT platform, SUM(CASE WHEN stage = 'published' AND published_day >= ?2 AND published_day <= ?3 THEN 1 ELSE 0 END) AS published, SUM(CASE WHEN stage != 'published' THEN 1 ELSE 0 END) AS open FROM agency_items WHERE client_id = ?1 AND platform != '' GROUP BY platform ORDER BY published DESC").bind(client.id, start, end).all<{ platform: string; published: number; open: number }>()
      : none<{ platform: string; published: number; open: number }>(),
    show.hours ? db.prepare('SELECT COALESCE(SUM(minutes), 0) AS m FROM agency_time WHERE client_id = ? AND billable = 1 AND day >= ? AND day <= ?').bind(client.id, start, end).first<{ m: number }>() : Promise.resolve(null),
    show.invoices ? db.prepare("SELECT number, total_cents, currency, status, issue_date, token FROM invoices WHERE agency_client_id = ? AND status != 'draft' ORDER BY created_at DESC LIMIT 12").bind(client.id).all<{ number: string; total_cents: number; currency: string; status: PortalView['invoices'][number]['status']; issue_date: string; token: string }>() : none<{ number: string; total_cents: number; currency: string; status: PortalView['invoices'][number]['status']; issue_date: string; token: string }>(),
    show.contracts ? db.prepare("SELECT title, status, token FROM agency_contracts WHERE client_id = ? AND status IN ('sent', 'signed') AND token IS NOT NULL ORDER BY updated_at DESC LIMIT 12").bind(client.id).all<{ title: string; status: PortalView['contracts'][number]['status']; token: string }>() : none<{ title: string; status: PortalView['contracts'][number]['status']; token: string }>(),
  ]);
  const ids = waiting.results.map((w) => w.id);
  type Thread = { item_id: string; author: 'me' | 'client'; body: string; created_at: string };
  const threads = ids.length && show.notes
    ? await db.prepare(`SELECT item_id, author, body, created_at FROM agency_notes WHERE item_id IN (${ids.map(() => '?').join(',')}) AND (shared = 1 OR author = 'client') ORDER BY created_at`).bind(...ids).all<Thread>()
    : { results: [] as Thread[] };
  const view: PortalView = {
    agencyName: nameOf({ display_name: client.owner_name }),
    clientName: client.name,
    show,
    waiting: waiting.results.map((w) => ({ id: w.id, title: w.title, kind: w.kind, platform: w.platform, link: w.link, publishDate: w.publish_date, thread: threads.results.filter((t) => t.item_id === w.id).map((t) => ({ author: t.author, body: t.body, createdAt: t.created_at })) })),
    coming: coming.results.map((x) => ({ title: x.title, kind: x.kind, platform: x.platform, stage: x.stage, publishDate: x.publish_date })),
    published: done.results.map((x) => ({ title: x.title, kind: x.kind, platform: x.platform, link: x.link, publishedAt: x.published_at })),
    month: show.progress ? { published: count?.n ?? 0, planned: client.pieces_per_month } : null,
    channels: channels.results.map((x) => ({ channel: x.platform, published: x.published ?? 0, open: x.open ?? 0 })),
    hours: show.hours ? { usedMinutes: time?.m ?? 0, includedMinutes: client.hours_per_month * 60 } : null,
    invoices: invoices.results.map((x) => ({ number: x.number, totalCents: x.total_cents, currency: x.currency, status: x.status, issueDate: x.issue_date, token: x.token })),
    contracts: contracts.results.map((x) => ({ title: x.title, status: x.status, token: x.token })),
  };
  return c.json(view);
});

// A client approves, sends back with a note, or only comments, as far as the owner allowed. The link is the only key, so it is limited per address.
agencyPublic.post('/:token/items/:id', async (c) => {
  const db = c.env.DB;
  const client = await portalClient(db, c.req.param('token'));
  if (!client) return c.json({ error: 'no page at this link' }, 404);
  const show = portalOf(client.portal_json);
  const item = await db.prepare('SELECT id, title, stage FROM agency_items WHERE id = ? AND client_id = ?').bind(c.req.param('id'), client.id).first<{ id: string; title: string; stage: DeliverableStage }>();
  if (!item) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const decision = oneOf(body.decision, ['approve', 'changes', 'comment'] as const, 'comment');
  if (decision === 'comment' ? !show.canComment : !show.canApprove) return c.json({ error: 'this link is for looking only' }, 403);
  const note = str(body.note, AGENCY_NOTE_MAX);
  if (decision !== 'approve' && !note) return c.json({ error: decision === 'changes' ? 'say what to change' : 'write something' }, 400);
  if (decision !== 'comment' && item.stage !== 'review') return c.json({ error: 'this one is not waiting for you' }, 400);
  const now = nowIso();
  const today = now.slice(0, 10);
  const stmts: D1PreparedStatement[] = [];
  if (note) stmts.push(db.prepare("INSERT INTO agency_notes (id, user_id, item_id, author, shared, body, created_at) VALUES (?, ?, ?, 'client', 1, ?, ?)").bind(newId(), client.user_id, item.id, note, now));
  if (decision === 'approve') stmts.push(db.prepare("UPDATE agency_items SET stage = 'approved', approved_at = ?, approved_day = ?, updated_at = ? WHERE id = ? AND stage = 'review'").bind(now, today, now, item.id));
  if (decision === 'changes') stmts.push(db.prepare("UPDATE agency_items SET stage = 'making', revisions = revisions + 1, updated_at = ? WHERE id = ? AND stage = 'review'").bind(now, item.id));
  await db.batch(stmts);
  const title = decision === 'approve' ? `${client.name} approved ${item.title}` : decision === 'changes' ? `${client.name} sent back ${item.title}` : `${client.name} wrote on ${item.title}`;
  await notify(db, client.user_id, 'agency', title, note.slice(0, 160), `/agency/${client.id}`);
  return c.json({ ok: true });
});
