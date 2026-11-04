import { Hono } from 'hono';
import {
  AGENCY_CLIENT_STATUSES,
  LOCALE,
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
  parseOnboarding,
  portalPasswordProblem,
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
  type PortalWaitingOn,
  type PortalRetainer,
  type NoteKind,
  CHANGE_FROM_STAGES,
  CHANGE_TO_STAGE,
  TRIAL_RULES,
  parseLifecycleDates,
  parseRetainerOptions,
  parseStage,
  retainerMonthlyCents,
  retainerTotalCents,
  stageIndex,
} from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { dayFromDevice, liveUser, newId, nameOf, notify, nowIso, num, oneOf, pageOf, paged, randomCode, shiftDate, str } from '../db';
import { dateOrNull, moneyIn } from '../agencyUtil';
import { resolveAccess } from '../access';
import { uploadVersion } from './army';
import { lifecycleFor, syncStageFromAgreements, logStmt, type RetainerRow } from '../lifecycle';
import { teamMay } from '../agencyTeamAccess';
import { teamShowOf } from './teamLink';
import { agencyFace, clearPortalSessions, closedLinkAnswer, newPortalPassword, passwordColumns, requirePortalAccess, retirePortalLink } from '../portalAccess';

/**
 * Agency: a content agency's or a freelance creator's clients, the deliverables made for them, time, approvals and invoices.
 * Owner only: every query filters by the session user. The day always comes from the device (`?day=`), like a task's tick.
 */
export const agency = new Hono<AppEnv>();
/** What a client sees at their link, mounted at /public/agency. */
export const agencyPublic = new Hono<AppEnv>();

const utcToday = () => new Date().toISOString().slice(0, 10);

// ---- rows

interface ClientRow {
  id: string; user_id: string; name: string; contact_name: string; contact_email: string; status: AgencyClient['status']; health: AgencyClient['health']; channels_json: string; retainer_cents: number;
  pieces_per_month: number; hours_per_month: number; renewal_date: string | null; notes: string; campaign_id: string | null; billing_json: string; portal_token: string | null; portal_json: string; created_at: string; campaign_name?: string | null;
  stage: string; stage_since: string | null; lifecycle_json: string; ticks_json: string; revisions_per_piece: number;
  portal_pass_hash: string | null; portal_pass_salt: string | null; portal_pass_set_at: string | null; portal_last_opened_day: string | null;
  onboarding_json: string; onboarded_at: string | null; onboarding_needed: number;
  team_link_token: string | null; team_link_json: string; team_link_pass_hash: string | null; team_link_pass_set_at: string | null; team_link_opened_day: string | null;
}
interface ItemRow {
  id: string; client_id: string; client_name: string; title: string; kind: DeliverableKind; platform: string; stage: DeliverableStage; due_date: string | null; publish_date: string | null; link: string; notes: string;
  army_deliverable_id: string | null; fee_cents: number; revisions: number; approved_at: string | null; published_at: string | null; approved_day: string | null; published_day: string | null; created_at: string; note_count: number; army_status: string | null; army_feedback: string | null;
  cycle_n: number | null; allowed: number; trial: number;
}
const ITEM_SELECT = `SELECT i.*, c.name AS client_name, COALESCE(i.revisions_allowed, c.revisions_per_piece) AS allowed,
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
    revisionsAllowed: r.allowed,
    cycleNumber: r.cycle_n,
    trial: r.trial === 1,
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

/** What the client typed in the onboarding form, read through the one reader (an unreadable value is an empty form). */
export function onboardingOf(raw: string | null | undefined) {
  try {
    return parseOnboarding(JSON.parse(raw || '{}'));
  } catch {
    return parseOnboarding({});
  }
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
    portalLocked: Boolean(r.portal_pass_hash),
    // The team link's own state; its ask for a new password is read only on the client's own page (GET /clients/:id).
    teamLink: { token: r.team_link_token, show: teamShowOf(r.team_link_json), password: { set: Boolean(r.team_link_pass_hash), setAt: r.team_link_pass_set_at, lastOpenedDay: r.team_link_opened_day, request: null } },
    stage: parseStage(r.stage),
    createdAt: r.created_at,
    month: m,
    flags: flagsFor(r, m, today),
  };
}

const CLIENT_SELECT = 'SELECT c.*, (SELECT name FROM campaigns WHERE id = c.campaign_id) AS campaign_name FROM agency_clients c';

export async function clientRow(db: D1Database, userId: string, id: string): Promise<ClientRow | null> {
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
  const today = dayFromDevice(c.req.query('day'));
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

// A new client is added with the least: the brand, the client's email and the password the owner sets for their link (or 'generate'
// for one made here and shown once). The link is switched on at once and the client is asked to fill in the onboarding form there.
agency.post('/clients', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const f = clientFields(body);
  if (!f.name) return c.json({ error: 'who is the client?' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contactEmail)) return c.json({ error: "type the client's email" }, 400);
  const generated = body.portalPassword === 'generate';
  const password = generated ? newPortalPassword(f.name) : typeof body.portalPassword === 'string' ? body.portalPassword : '';
  if (!password) return c.json({ error: 'set a password for their page' }, 400);
  const problem = portalPasswordProblem(password, f.name);
  if (problem) return c.json({ error: problem }, 400);
  const n = await db.prepare('SELECT COUNT(*) AS n FROM agency_clients WHERE user_id = ?').bind(user.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= AGENCY_MAX_CLIENTS) return c.json({ error: `up to ${AGENCY_MAX_CLIENTS} clients` }, 400);
  const id = newId();
  const now = nowIso();
  const token = randomCode(16);
  const col = await passwordColumns(password);
  // One batch: the client, its password (only the hash), the link switched on (with its agreements and invoices shown, so what the
  // form makes is there to download), the form asked for, and the log line (never the word).
  await db.batch([
    db
      .prepare('INSERT INTO agency_clients (id, user_id, name, contact_name, contact_email, status, health, channels_json, retainer_cents, pieces_per_month, hours_per_month, renewal_date, notes, portal_pass_hash, portal_pass_salt, portal_pass_set_at, portal_token, portal_json, onboarding_needed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)')
      .bind(id, user.id, f.name, f.contactName, f.contactEmail, f.status, f.health, JSON.stringify(f.channels), f.retainerCents, f.piecesPerMonth, f.hoursPerMonth, f.renewalDate, f.notes, col.hash, col.salt, now, token, JSON.stringify(parsePortalShow({ contracts: true, invoices: true })), now, now),
    logStmt(db, user.id, id, 'me', 'password', 'A password was set for the client link.'),
  ]);
  return c.json(generated ? { id, portalToken: token, password } : { id, portalToken: token }, 201);
});

agency.patch('/clients/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const prev = await clientRow(db, user.id, c.req.param('id'));
  if (!prev) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  // A team member never changes the owner's private notes or the Army link, and the money only with paperwork to edit (they were shown blanks).
  if (c.get('team')) {
    delete body.notes;
    delete body.campaignId;
    // The client's email is where their link and every paper's email go: only the owner changes it, so a member cannot send the link to themselves.
    delete body.contactEmail;
    if (!teamMay(c, 'paperwork', 'edit')) for (const k of ['retainerCents', 'billing', 'onboarding']) delete body[k];
  }
  const f = clientFields(body, prev);
  if (!f.name) return c.json({ error: 'who is the client?' }, 400);
  let campaignId = prev.campaign_id;
  if ('campaignId' in body) {
    if (body.campaignId === null || body.campaignId === '') campaignId = null;
    else if (typeof body.campaignId === 'string' && (await ownCampaign(c, user, body.campaignId))) campaignId = body.campaignId;
    else return c.json({ error: 'you are not a creator on that campaign' }, 403);
  }
  const billing = 'billing' in body ? JSON.stringify(parseParty(body.billing)) : prev.billing_json;
  // What the client told you in the onboarding form, corrected by you: the same reader as the client's own save.
  const onboardingJson = 'onboarding' in body ? JSON.stringify(parseOnboarding(body.onboarding)) : prev.onboarding_json;
  await db
    .prepare('UPDATE agency_clients SET name = ?, contact_name = ?, contact_email = ?, status = ?, health = ?, channels_json = ?, retainer_cents = ?, pieces_per_month = ?, hours_per_month = ?, renewal_date = ?, notes = ?, campaign_id = ?, billing_json = ?, onboarding_json = ?, updated_at = ? WHERE id = ? AND user_id = ?')
    .bind(f.name, f.contactName, f.contactEmail, f.status, f.health, JSON.stringify(f.channels), f.retainerCents, f.piecesPerMonth, f.hoursPerMonth, f.renewalDate, f.notes, campaignId, billing, onboardingJson, nowIso(), prev.id, user.id)
    .run();
  return c.json({ ok: true });
});

agency.delete('/clients/:id', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM agency_clients WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  if (!res.meta.changes) return c.json({ error: 'not found' }, 404);
  await c.env.DB.batch([
    // A client team member tied to this client goes with it (the foreign key says so too; this does not lean on the pragma).
    c.env.DB.prepare('DELETE FROM agency_team WHERE client_id = ? AND owner_id = ?').bind(c.req.param('id'), c.get('user').id),
    c.env.DB.prepare('DELETE FROM retired_portal_links WHERE client_id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id),
    c.env.DB.prepare('DELETE FROM agency_password_requests WHERE client_id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id),
    c.env.DB.prepare('DELETE FROM portal_sessions WHERE client_id = ?').bind(c.req.param('id')),
    c.env.DB.prepare('DELETE FROM team_link_sessions WHERE client_id = ?').bind(c.req.param('id')),
  ]);
  return c.json({ ok: true });
});

agency.get('/clients/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const today = dayFromDevice(c.req.query('day'));
  const { start, end } = monthBounds(today.slice(0, 7));
  // An agreement that was sent or signed since the last look moves the client on first.
  await syncStageFromAgreements(db, { userId: user.id, clientId: c.req.param('id') });
  const row = await clientRow(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const [settings, stats, counts, channels, time, invoices, campaigns, lifecycle, teamAsk] = await Promise.all([
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
    lifecycleFor(db, user.id, row),
    // Their team's open ask for a new team link password, with its reason: shown only here, on the owner's own client page.
    db.prepare("SELECT reason, created_at FROM agency_password_requests WHERE client_id = ? AND user_id = ? AND link = 'team' AND closed_at IS NULL LIMIT 1").bind(row.id, user.id).first<{ reason: string; created_at: string }>(),
  ]);
  const client = toClient(row, stats.get(row.id) ?? emptyStats(), today);
  if (teamAsk) client.teamLink.password.request = { at: teamAsk.created_at, reason: teamAsk.reason };
  const by = Object.fromEntries(DELIVERABLE_STAGES.map((s) => [s, 0])) as Record<DeliverableStage, number>;
  for (const r of counts.results) by[r.stage] = r.n;
  const body: AgencyClientPage = {
    settings,
    client,
    counts: by,
    byChannel: channels.results.map((r) => ({ channel: r.platform, published: r.published ?? 0, open: r.open ?? 0 })),
    campaigns,
    time: time.results.map((t): AgencyTimeEntry => ({ id: t.id, clientId: t.client_id, clientName: row.name, itemId: t.item_id, itemTitle: t.item_title ?? '', day: t.day, minutes: t.minutes, billable: t.billable === 1, note: t.note })),
    invoices: invoices.results.map((i): AgencyInvoiceRow => ({ id: i.id, number: i.number, totalCents: i.total_cents, currency: i.currency, status: i.status, issueDate: i.issue_date, token: i.token })),
    lifecycle,
    onboarding: { needed: row.onboarding_needed === 1, done: Boolean(row.onboarded_at), at: row.onboarded_at, answers: row.onboarded_at || row.onboarding_json !== '{}' ? onboardingOf(row.onboarding_json) : null },
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
  const closing = body.on === false || Boolean(body.fresh);
  await db.batch([
    db.prepare('UPDATE agency_clients SET portal_token = ?, portal_json = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(token, JSON.stringify(show), nowIso(), row.id, user.id),
    ...(closing ? [clearPortalSessions(db, row.id)] : []),
    // The old link, renewed or closed, is remembered as a hash so it answers "this link was closed" (410), not "no page".
    ...(row.portal_token && token !== row.portal_token ? [await retirePortalLink(db, row.id, user.id, row.portal_token)] : []),
  ]);
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
  const today = dayFromDevice(c.req.query('day'));
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
  const today = dayFromDevice(c.req.query('day'));
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
  const today = dayFromDevice(c.req.query('day'));
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const client = typeof body.clientId === 'string' ? await clientRow(db, user.id, body.clientId) : null;
  if (!client) return c.json({ error: 'pick a client' }, 400);
  // A piece's fee is set by a team member only with paperwork to edit; its private notes are the owner's alone.
  if (!teamMay(c, 'paperwork', 'edit')) delete body.feeCents;
  if (c.get('team')) delete body.notes;
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
  const today = dayFromDevice(c.req.query('day'));
  const prev = await db.prepare(`${ITEM_SELECT} WHERE i.id = ? AND i.user_id = ?`).bind(c.req.param('id'), user.id).first<ItemRow>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  if (!teamMay(c, 'paperwork', 'edit')) delete body.feeCents;
  // A member never sees the owner's private notes on a piece (the gate blanks them), so whatever they send keeps the stored words.
  if (c.get('team')) delete body.notes;
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

interface NoteRow { id: string; author: AgencyNote['author']; kind: NoteKind; shared: number; body: string; created_at: string; author_id?: string | null; author_name?: string | null; via_team_link?: number }
const toNote = (r: NoteRow, readerId?: string): AgencyNote => ({
  id: r.id,
  author: r.author,
  // A team note says who wrote it, named when read, so a deleted account leaves no name behind.
  ...(r.author === 'team' ? { authorName: r.author_name || 'A former team member', mine: Boolean(readerId && r.author_id === readerId) } : {}),
  // A client note written at the team link says so.
  ...(r.author === 'client' && r.via_team_link === 1 ? { clientTeam: true } : {}),
  kind: r.kind,
  shared: r.shared === 1,
  body: r.body,
  createdAt: r.created_at,
});

agency.get('/items/:id/notes', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const item = await db.prepare('SELECT id FROM agency_items WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first();
  if (!item) return c.json({ error: 'not found' }, 404);
  const rows = await db
    .prepare(`SELECT n.id, n.author, n.kind, n.shared, n.body, n.created_at, n.author_id, n.via_team_link, (SELECT u.display_name FROM users u WHERE u.id = n.author_id AND ${liveUser('u')}) AS author_name FROM agency_notes n WHERE n.item_id = ? AND n.user_id = ? ORDER BY n.created_at LIMIT 100`)
    .bind(c.req.param('id'), user.id)
    .all<NoteRow>();
  const reader = c.get('team')?.memberId ?? user.id;
  return c.json({ notes: rows.results.map((r) => toNote(r, reader)) });
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
  // A team member's note, and the owner's note shared with the team, are `team` notes: never shown to the client, named by who wrote them.
  const team = c.get('team');
  if (team || body.team === true) {
    await db.prepare("INSERT INTO agency_notes (id, user_id, item_id, author, shared, body, author_id, created_at) VALUES (?, ?, ?, 'team', 0, ?, ?, ?)").bind(id, user.id, c.req.param('id'), text, team?.memberId ?? user.id, nowIso()).run();
    return c.json({ id }, 201);
  }
  await db.prepare("INSERT INTO agency_notes (id, user_id, item_id, author, shared, body, created_at) VALUES (?, ?, ?, 'me', ?, ?, ?)").bind(id, user.id, c.req.param('id'), body.shared === true ? 1 : 0, text, nowIso()).run();
  return c.json({ id }, 201);
});

agency.delete('/notes/:id', async (c) => {
  // A team member removes only their own team notes; the owner removes their own notes and any team note on their Agency.
  const team = c.get('team');
  const res = team
    ? await c.env.DB.prepare("DELETE FROM agency_notes WHERE id = ? AND user_id = ? AND author = 'team' AND author_id = ?").bind(c.req.param('id'), c.get('user').id, team.memberId).run()
    : await c.env.DB.prepare("DELETE FROM agency_notes WHERE id = ? AND user_id = ? AND author IN ('me', 'team')").bind(c.req.param('id'), c.get('user').id).run();
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
  const today = dayFromDevice(c.req.query('day'));
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
  const today = dayFromDevice(c.req.query('day'));
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

interface PortalClient { id: string; user_id: string; name: string; pieces_per_month: number; hours_per_month: number; portal_json: string; owner_name: string; revisions_per_piece: number; onboarding_needed: number; onboarded_at: string | null }
async function portalClient(db: D1Database, token: string): Promise<PortalClient | null> {
  if (!/^[A-Z0-9]{16}$/.test(token)) return null;
  return db
    .prepare('SELECT c.id, c.user_id, c.name, c.pieces_per_month, c.hours_per_month, c.portal_json, c.revisions_per_piece, c.onboarding_needed, c.onboarded_at, u.display_name AS owner_name FROM agency_clients c JOIN users u ON u.id = c.user_id WHERE c.portal_token = ?')
    .bind(token)
    .first<PortalClient>();
}
export { portalClient };

const dayWords = (d: string): string => new Date(`${d}T00:00:00Z`).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// The client's dashboard: only the parts the owner switched on. Fees, private notes, time entries and other clients are never in it.
// A client with a password gets the lock answer until they unlock the link (see portalAccess.ts).
agencyPublic.get('/:token', async (c) => {
  const db = c.env.DB;
  const client = await portalClient(db, c.req.param('token'));
  if (!client) return (await closedLinkAnswer(c, c.req.param('token'))) ?? c.json({ error: 'no page at this link' }, 404);
  const denied = await requirePortalAccess(c, client.id);
  if (denied) return denied;
  const view = await portalViewFor(db, client, { visit: true });
  c.header('Cache-Control', 'no-store');
  return c.json(view);
});

/** The page before the onboarding form is sent: who sent it, the client's name, the stage and the form. */
export interface PortalPending { agencyName: string; agencyLogo: string; agencyEmail: string; clientName: string; stage: ReturnType<typeof parseStage>; onboarding: { needed: boolean; done: boolean } }

/** A client by id, in the owner's books, in the shape the client link reads. */
export async function portalClientById(db: D1Database, ownerId: string, clientId: string): Promise<PortalClient | null> {
  return db
    .prepare('SELECT c.id, c.user_id, c.name, c.pieces_per_month, c.hours_per_month, c.portal_json, c.revisions_per_piece, c.onboarding_needed, c.onboarded_at, u.display_name AS owner_name FROM agency_clients c JOIN users u ON u.id = c.user_id WHERE c.id = ? AND c.user_id = ?')
    .bind(clientId, ownerId)
    .first<PortalClient>();
}

/**
 * The client's dashboard, built once for both its callers: the client link (after its password) and a client team member's read-only view
 * (/me/teams/:id/client-view). Only the parts the owner switched on are read, so PORTAL_NEVER holds by construction for both. `visit`
 * records the day the link was opened; the in-app view does not.
 */
export async function portalViewFor(db: D1Database, client: PortalClient, opts: { visit: boolean }): Promise<PortalView | PortalPending> {
  await syncStageFromAgreements(db, { userId: client.user_id, clientId: client.id });
  const show = portalOf(client.portal_json);
  const onboarding = { needed: client.onboarding_needed === 1, done: Boolean(client.onboarded_at) };
  // Before the form is sent, the page is the form: only who sent it, the client's name, the stage and the form. No part is read, so nothing leaks early.
  if (onboarding.needed && !onboarding.done) {
    // Opening the form is a visit too, so the owner sees the link was opened before the form is sent. A day, nothing more.
    const today0 = utcToday();
    const [fresh0, face0] = await Promise.all([
      db.prepare('SELECT stage FROM agency_clients WHERE id = ?').bind(client.id).first<{ stage: string }>(),
      agencyFace(db, client.user_id),
      opts.visit ? db.prepare("UPDATE agency_clients SET portal_last_opened_day = ? WHERE id = ? AND COALESCE(portal_last_opened_day, '') != ?").bind(today0, client.id, today0).run() : Promise.resolve(null),
    ]);
    return { agencyName: face0.agencyName || nameOf({ display_name: client.owner_name }), agencyLogo: face0.agencyLogo, agencyEmail: face0.agencyEmail, clientName: client.name, stage: parseStage(fresh0?.stage), onboarding };
  }
  const todayUtc = utcToday();
  const { start, end } = monthBounds(todayUtc.slice(0, 7));
  const none = <T,>() => Promise.resolve({ results: [] as T[] });
  type Waiting = { id: string; title: string; kind: DeliverableKind; platform: string; link: string; publish_date: string | null; revisions: number; allowed: number; trial: number };
  type Coming = { id: string; title: string; kind: DeliverableKind; platform: string; stage: DeliverableStage; publish_date: string | null; revisions: number; allowed: number };
  type Done = { id: string; title: string; kind: DeliverableKind; platform: string; link: string; published_at: string | null };
  type PortalInvoiceRow = { number: string; total_cents: number; currency: string; status: PortalView['invoices'][number]['status']; issue_date: string; due_date: string | null; token: string };
  type SentDoc = { title: string; kind: PortalView['docs'][number]['kind']; status: PortalView['docs'][number]['status']; token: string };
  const [fresh, waiting, coming, done, count, channels, time, invoices, contracts, owing, signing, offer, face, docs] = await Promise.all([
    db.prepare('SELECT stage, lifecycle_json FROM agency_clients WHERE id = ?').bind(client.id).first<{ stage: string; lifecycle_json: string }>(),
    show.waiting ? db.prepare("SELECT id, title, kind, platform, link, publish_date, revisions, COALESCE(revisions_allowed, ?) AS allowed, trial FROM agency_items WHERE client_id = ? AND stage = 'review' ORDER BY COALESCE(publish_date, due_date, '9999-12-31') LIMIT 50").bind(client.revisions_per_piece, client.id).all<Waiting>() : none<Waiting>(),
    show.coming ? db.prepare("SELECT id, title, kind, platform, stage, publish_date, revisions, COALESCE(revisions_allowed, ?) AS allowed FROM agency_items WHERE client_id = ? AND stage IN ('script', 'making', 'approved') ORDER BY COALESCE(publish_date, due_date, '9999-12-31') LIMIT 30").bind(client.revisions_per_piece, client.id).all<Coming>() : none<Coming>(),
    show.published ? db.prepare("SELECT id, title, kind, platform, link, published_at FROM agency_items WHERE client_id = ? AND stage = 'published' ORDER BY published_at DESC LIMIT 20").bind(client.id).all<Done>() : none<Done>(),
    show.progress ? db.prepare("SELECT COUNT(*) AS n FROM agency_items WHERE client_id = ? AND stage = 'published' AND published_day >= ? AND published_day <= ?").bind(client.id, start, end).first<{ n: number }>() : Promise.resolve(null),
    show.channels
      ? db.prepare("SELECT platform, SUM(CASE WHEN stage = 'published' AND published_day >= ?2 AND published_day <= ?3 THEN 1 ELSE 0 END) AS published, SUM(CASE WHEN stage != 'published' THEN 1 ELSE 0 END) AS open FROM agency_items WHERE client_id = ?1 AND platform != '' GROUP BY platform ORDER BY published DESC").bind(client.id, start, end).all<{ platform: string; published: number; open: number }>()
      : none<{ platform: string; published: number; open: number }>(),
    show.hours ? db.prepare('SELECT COALESCE(SUM(minutes), 0) AS m FROM agency_time WHERE client_id = ? AND billable = 1 AND day >= ? AND day <= ?').bind(client.id, start, end).first<{ m: number }>() : Promise.resolve(null),
    show.invoices ? db.prepare("SELECT number, total_cents, currency, status, issue_date, due_date, token FROM invoices WHERE agency_client_id = ? AND status != 'draft' ORDER BY created_at DESC LIMIT 12").bind(client.id).all<PortalInvoiceRow>() : none<PortalInvoiceRow>(),
    show.contracts ? db.prepare("SELECT title, status, token FROM agency_contracts WHERE client_id = ? AND status IN ('sent', 'signed') AND token IS NOT NULL ORDER BY updated_at DESC LIMIT 12").bind(client.id).all<{ title: string; status: PortalView['contracts'][number]['status']; token: string }>() : none<{ title: string; status: PortalView['contracts'][number]['status']; token: string }>(),
    // What is owed, whatever is shown: a sent invoice that is not paid, and an agreement sent and not signed. Only a link, when the switch for it is on.
    db.prepare("SELECT number, token FROM invoices WHERE agency_client_id = ? AND status = 'sent' ORDER BY created_at DESC LIMIT 5").bind(client.id).all<{ number: string; token: string }>(),
    db.prepare("SELECT title, token FROM agency_contracts WHERE client_id = ? AND status = 'sent' AND token IS NOT NULL ORDER BY updated_at DESC LIMIT 3").bind(client.id).all<{ title: string; token: string }>(),
    db.prepare("SELECT * FROM agency_retainers WHERE client_id = ? AND status IN ('offered', 'chosen', 'active') ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'chosen' THEN 1 ELSE 2 END, created_at DESC LIMIT 1").bind(client.id).first<RetainerRow>(),
    // Who sent the link: the business name, its logo and its email. Nothing else from the business profile.
    agencyFace(db, client.user_id),
    // Other documents sent to them (never a draft), with their link.
    show.docs ? db.prepare("SELECT title, kind, status, token FROM agency_docs WHERE client_id = ? AND status IN ('sent', 'approved', 'revised') AND token IS NOT NULL ORDER BY updated_at DESC LIMIT 12").bind(client.id).all<SentDoc>() : none<SentDoc>(),
    // Open the link counts as a visit for the day. A day, nothing more.
    opts.visit ? db.prepare("UPDATE agency_clients SET portal_last_opened_day = ? WHERE id = ? AND COALESCE(portal_last_opened_day, '') != ?").bind(todayUtc, client.id, todayUtc).run() : Promise.resolve(null),
  ]);
  const stage = parseStage(fresh?.stage);
  const life = parseLifecycleDates(fresh?.lifecycle_json);
  const at = stageIndex(stage);
  const ids = waiting.results.map((w) => w.id);
  type Thread = { item_id: string; author: 'me' | 'client'; kind: NoteKind; body: string; created_at: string; via_team_link: number };
  const threads = ids.length && show.notes
    ? await db.prepare(`SELECT item_id, author, kind, body, created_at, via_team_link FROM agency_notes WHERE item_id IN (${ids.map(() => '?').join(',')}) AND (shared = 1 OR author = 'client') ORDER BY created_at`).bind(...ids).all<Thread>()
    : { results: [] as Thread[] };

  // The retainer offer, with what each length comes to. The one place the fee shows, because the client has to see a price to choose.
  let retainer: PortalRetainer | null = null;
  if (offer) {
    const currency = (await settingsFor(db, client.user_id)).currency;
    const opts = parseRetainerOptions(offer.options_json);
    retainer = {
      status: offer.status === 'active' ? 'active' : offer.status === 'chosen' ? 'chosen' : 'offered',
      currency,
      options: (offer.status === 'active' && offer.months ? [{ months: offer.months, discountBps: offer.discount_bps }] : opts).map((o) => ({ months: o.months, discountBps: o.discountBps, monthlyCents: retainerMonthlyCents(offer.fee_cents, o.discountBps), totalCents: retainerTotalCents(offer.fee_cents, o.months, o.discountBps) })),
      chosenMonths: offer.months,
      piecesPerMonth: offer.pieces_per_month,
      revisionsPerPiece: offer.revisions_per_piece,
      startDay: offer.start_day,
    };
  }

  // What is waiting on the client, in plain words.
  const waitingOn: PortalWaitingOn[] = [];
  for (const k of signing.results) waitingOn.push({ key: `sign-${k.token}`, title: `Read and sign: ${k.title}`, line: 'Fill in the brief if there is one, then sign by typing your name.', href: show.contracts ? `/k/${k.token}` : null });
  if (stage === 'agreement_signed' || stage === 'strategy') {
    waitingOn.push({
      key: 'strategy',
      title: life.strategyDay ? `Strategy session on ${dayWords(life.strategyDay)}` : 'Strategy session',
      line: life.strategyDay ? 'Join the call. Bring your brand guide and three to five videos that show the feel you want.' : 'A day for the call will be shared here.',
      href: life.strategyLink || null,
    });
  }
  for (const w of waiting.results) if (w.trial === 1) waitingOn.push({ key: `trial-${w.id}`, title: 'Watch the trial video', line: 'Send one set of feedback. The trial rules are below.', href: '#waiting-heading' });
  for (const inv of owing.results) waitingOn.push({ key: `pay-${inv.token}`, title: `Pay invoice ${inv.number}`, line: 'Open it to see the amount and how to pay.', href: show.invoices ? `/i/${inv.token}` : null });
  if (offer?.status === 'offered') waitingOn.push({ key: 'retainer', title: 'Choose how many months', line: 'Pick the length of the retainer.', href: '#retainer-heading' });
  const others = waiting.results.filter((w) => w.trial !== 1).length;
  if (others > 0) waitingOn.push({ key: 'review', title: others === 1 ? 'One piece to review' : `${others} pieces to review`, line: show.canApprove ? (others === 1 ? 'Watch it, then approve it or ask for a change.' : 'Watch each one, then approve it or ask for a change.') : 'Have a look when you can.', href: '#waiting-heading' });

  const view: PortalView = {
    agencyName: face.agencyName || nameOf({ display_name: client.owner_name }),
    agencyLogo: face.agencyLogo,
    agencyEmail: face.agencyEmail,
    clientName: client.name,
    show,
    stage,
    onboarding,
    waitingOn,
    strategy: at >= stageIndex('agreement_signed') && (life.strategyDay || life.strategyLink) ? { day: life.strategyDay, link: life.strategyLink } : null,
    trial: stage === 'trial' ? { due: life.trialDue, rules: TRIAL_RULES } : null,
    pilot: at >= stageIndex('pilot') && (life.pilotStart || life.pilotEnd) ? { start: life.pilotStart, end: life.pilotEnd } : null,
    retainer,
    waiting: waiting.results.map((w) => ({ id: w.id, title: w.title, kind: w.kind, platform: w.platform, link: w.link, publishDate: w.publish_date, changes: { used: w.revisions, allowed: w.allowed }, thread: threads.results.filter((t) => t.item_id === w.id).map((t) => ({ author: t.author, kind: t.kind, body: t.body, createdAt: t.created_at, ...(t.via_team_link === 1 ? { team: true } : {}) })) })),
    coming: coming.results.map((x) => ({ id: x.id, title: x.title, kind: x.kind, platform: x.platform, stage: x.stage, publishDate: x.publish_date, changes: { used: x.revisions, allowed: x.allowed } })),
    published: done.results.map((x) => ({ id: x.id, title: x.title, kind: x.kind, platform: x.platform, link: x.link, publishedAt: x.published_at })),
    month: show.progress ? { published: count?.n ?? 0, planned: client.pieces_per_month } : null,
    channels: channels.results.map((x) => ({ channel: x.platform, published: x.published ?? 0, open: x.open ?? 0 })),
    hours: show.hours ? { usedMinutes: time?.m ?? 0, includedMinutes: client.hours_per_month * 60 } : null,
    invoices: invoices.results.map((x) => ({ number: x.number, totalCents: x.total_cents, currency: x.currency, status: x.status, issueDate: x.issue_date, overdue: x.status === 'sent' && Boolean(x.due_date && x.due_date < todayUtc), token: x.token })),
    contracts: contracts.results.map((x) => ({ title: x.title, status: x.status, token: x.token })),
    docs: docs.results.map((x) => ({ title: x.title, kind: x.kind, status: x.status, token: x.token })),
  };
  return view;
}

// A client approves, asks for a change, or only comments, as far as the owner allowed. The link is the only key (and its password, when set),
// so it is limited per address. A change spends one of the changes included in the piece and sends it back to making; with none left the
// client can leave a note asking for a paid change, which moves nothing.
agencyPublic.post('/:token/items/:id', async (c) => {
  const db = c.env.DB;
  const client = await portalClient(db, c.req.param('token'));
  if (!client) return (await closedLinkAnswer(c, c.req.param('token'))) ?? c.json({ error: 'no page at this link' }, 404);
  const denied = await requirePortalAccess(c, client.id);
  if (denied) return denied;
  const show = portalOf(client.portal_json);
  const item = await db.prepare('SELECT id, title, stage, revisions, COALESCE(revisions_allowed, ?) AS allowed FROM agency_items WHERE id = ? AND client_id = ?').bind(client.revisions_per_piece, c.req.param('id'), client.id).first<{ id: string; title: string; stage: DeliverableStage; revisions: number; allowed: number }>();
  if (!item) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const decision = oneOf(body.decision, ['approve', 'changes', 'paid_change', 'comment'] as const, 'comment');
  if (decision === 'comment' ? !show.canComment : !show.canApprove) return c.json({ error: 'this link is for looking only' }, 403);
  // A change can name the place it is about: a time in the video, a line, a slide.
  const where = str(body.where, 60);
  const typed = str(body.note, AGENCY_NOTE_MAX);
  const note = (decision === 'changes' || decision === 'paid_change') && where && typed ? `${where}: ${typed}`.slice(0, AGENCY_NOTE_MAX) : typed;
  if (decision !== 'approve' && !note) return c.json({ error: decision === 'comment' ? 'write something' : 'say what to change' }, 400);
  if (decision === 'approve' && item.stage !== 'review') return c.json({ error: 'this one is not waiting for you' }, 400);
  const now = nowIso();
  const today = now.slice(0, 10);
  const addNote = (kind: NoteKind) => db.prepare("INSERT INTO agency_notes (id, user_id, item_id, author, kind, shared, body, created_at) VALUES (?, ?, ?, 'client', ?, 1, ?, ?)").bind(newId(), client.user_id, item.id, kind, note, now);
  let title = '';
  if (decision === 'approve') {
    const stmts = [db.prepare("UPDATE agency_items SET stage = 'approved', approved_at = ?, approved_day = ?, updated_at = ? WHERE id = ? AND stage = 'review'").bind(now, today, now, item.id)];
    if (note) stmts.push(addNote('comment'));
    await db.batch(stmts);
    title = `${client.name} approved ${item.title}`;
  } else if (decision === 'changes') {
    if (!(CHANGE_FROM_STAGES as readonly string[]).includes(item.stage)) return c.json({ error: 'a change can be asked for once the piece is in review' }, 400);
    // One statement spends the change and moves the piece, and only if one is left; the note rides along only if it did. Two taps cannot spend the same one.
    const [moved] = await db.batch([
      db.prepare(`UPDATE agency_items SET stage = ?, revisions = revisions + 1, approved_at = NULL, approved_day = NULL, updated_at = ? WHERE id = ? AND client_id = ? AND stage IN ('review', 'approved') AND revisions < COALESCE(revisions_allowed, ?)`).bind(CHANGE_TO_STAGE, now, item.id, client.id, client.revisions_per_piece),
      db.prepare("INSERT INTO agency_notes (id, user_id, item_id, author, kind, shared, body, created_at) SELECT ?, ?, ?, 'client', 'change', 1, ?, ? WHERE changes() > 0").bind(newId(), client.user_id, item.id, note, now),
    ]);
    if (!moved?.meta.changes) return c.json({ error: item.revisions >= item.allowed ? 'no changes are left on this piece' : 'this piece moved on; look again', over: item.revisions >= item.allowed }, 409);
    title = `${client.name} sent back ${item.title} with a change`;
  } else if (decision === 'paid_change') {
    await db.batch([addNote('paid_change')]);
    title = `${client.name} asked for a paid change on ${item.title}`;
  } else {
    await db.batch([addNote('comment')]);
    title = `${client.name} wrote on ${item.title}`;
  }
  await notify(db, client.user_id, 'agency', title, note.slice(0, 160), `/agency/${client.id}`);
  return c.json({ ok: true });
});
