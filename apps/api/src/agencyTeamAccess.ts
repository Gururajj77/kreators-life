import type { Context, Next } from 'hono';
import { emptyBank, parsePortalShow, parseTeamLinkShow, parseProfile, parseTeamAccess, teamAllows, TEAM_ROLE_META, type TeamAccess, type TeamRole, type TeamTab } from '@kreators/shared';
import type { AppEnv, TeamActor, UserRow } from './env';
import { liveUser } from './db';
import { resolveAccess } from './access';
import { logStmt } from './lifecycle';

/**
 * The Agency team gate (wave 14). A team member works on an owner's Agency by sending `X-Agency-Team: <row id>` with each Agency request.
 * This one middleware, mounted on /agency and /agency/* after the per-person limits, is the only place that turns that into access:
 *
 * 1. No header: nothing changes, the person works on their own Agency.
 * 2. It reads the member's row on every request (nothing is cached), so a removal or a leave ends access on the very next request.
 * 3. A client member never uses these routes (their read-only view is /me/teams/:id/client-view).
 * 4. The owner's Agency must be open to the owner too.
 * 5. The (method, path) must be on TEAM_ROUTE_RULES, an allowlist: a route that is not on it answers 403, so a new Agency route stays closed
 *    to members until someone adds a rule. The settings, adding or deleting clients, any delete of a piece or paper, the client link and its
 *    password, Army, time, template writes and the team itself have no rule on purpose.
 * 6. The member's access must open the rule's tab at the rule's level.
 * 7. Then `user` becomes the owner, so every existing `WHERE user_id = ?` reads the owner's Agency with no change to the route, and `team`
 *    says who is really acting. After the route, a rule's scrub cuts the answer down (no business profile or bank, private notes, fees, the
 *    retainer amount, the client link or its password, Army links), and a write that worked leaves one line in the client's log.
 */

export const TEAM_HEADER = 'X-Agency-Team';

type Scrub = 'overview' | 'item' | 'notes' | 'clientPage' | 'paper';
/** What a member's write is about, so the client's log can say it: read from the path or from the answer's id. */
type Target = 'item' | 'client' | 'invoice' | 'contract' | 'doc' | 'retainer';
interface TeamRule {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  tab: TeamTab;
  need: 'view' | 'edit';
  /** Any of these tabs at view opens it too (the client names the Pipeline needs from GET /agency). */
  orTabs?: TeamTab[];
  scrub?: Scrub;
  /** For a write: what it is about and the words for the log, unless the route logs itself. */
  log?: { target: Target; from: 'path' | 'answer' | 'body'; verb: string };
}

const pipe = (method: TeamRule['method'], path: string, need: 'view' | 'edit', extra: Partial<TeamRule> = {}): TeamRule => ({ method, path, tab: 'pipeline', need, ...extra });
const cli = (method: TeamRule['method'], path: string, need: 'view' | 'edit', extra: Partial<TeamRule> = {}): TeamRule => ({ method, path, tab: 'clients', need, ...extra });
const paper = (method: TeamRule['method'], path: string, need: 'view' | 'edit', extra: Partial<TeamRule> = {}): TeamRule => ({ method, path, tab: 'paperwork', need, scrub: 'paper', ...extra });

/** Every Agency route a member may reach, and what it needs. Anything not here answers 403 to a member. */
export const TEAM_ROUTE_RULES: readonly TeamRule[] = [
  // Overview (and the client names the Pipeline and Clients tabs need).
  { method: 'GET', path: '/agency', tab: 'overview', need: 'view', orTabs: ['pipeline', 'clients'], scrub: 'overview' },
  // Pipeline.
  pipe('GET', '/agency/items', 'view', { scrub: 'item' }),
  pipe('GET', '/agency/board', 'view', { scrub: 'item' }),
  pipe('GET', '/agency/items/:id/notes', 'view', { scrub: 'notes' }),
  pipe('POST', '/agency/items', 'edit', { log: { target: 'client', from: 'body', verb: 'added a piece' } }),
  pipe('PATCH', '/agency/items/:id', 'edit', { log: { target: 'item', from: 'path', verb: 'changed a piece' } }),
  pipe('POST', '/agency/items/:id/notes', 'edit', { log: { target: 'item', from: 'path', verb: 'wrote a team note on a piece' } }),
  pipe('DELETE', '/agency/notes/:id', 'edit'),
  pipe('POST', '/agency/items/:id/changes', 'edit', { log: { target: 'item', from: 'path', verb: 'changed the changes included in a piece' } }),
  // Clients.
  cli('GET', '/agency/clients/:id', 'view', { scrub: 'clientPage' }),
  cli('PATCH', '/agency/clients/:id', 'edit', { log: { target: 'client', from: 'path', verb: 'changed the client details' } }),
  cli('POST', '/agency/clients/:id/stage', 'edit'),
  cli('PUT', '/agency/clients/:id/lifecycle', 'edit', { log: { target: 'client', from: 'path', verb: 'changed the days' } }),
  cli('POST', '/agency/clients/:id/checklist', 'edit', { log: { target: 'client', from: 'path', verb: 'changed the checklist' } }),
  cli('POST', '/agency/clients/:id/trial-video', 'edit'),
  // Paperwork: reads.
  paper('GET', '/agency/invoices', 'view'),
  paper('GET', '/agency/invoices/board', 'view'),
  paper('GET', '/agency/invoices/:id', 'view'),
  paper('GET', '/agency/contracts', 'view'),
  paper('GET', '/agency/contracts/board', 'view'),
  paper('GET', '/agency/contracts/:id', 'view'),
  paper('GET', '/agency/docs', 'view'),
  paper('GET', '/agency/docs/:id', 'view'),
  paper('GET', '/agency/comments/:type/:id', 'view'),
  paper('GET', '/agency/doc-log/:type/:id', 'view'),
  paper('GET', '/agency/templates', 'view'),
  // Paperwork: writes.
  paper('POST', '/agency/invoices', 'edit', { log: { target: 'invoice', from: 'answer', verb: 'made an invoice' } }),
  paper('POST', '/agency/clients/:id/invoice', 'edit', { log: { target: 'client', from: 'path', verb: 'made an invoice' } }),
  paper('PATCH', '/agency/invoices/:id', 'edit', { log: { target: 'invoice', from: 'path', verb: 'changed an invoice' } }),
  paper('POST', '/agency/invoices/:id/restore', 'edit'),
  paper('POST', '/agency/invoices/:id/duplicate', 'edit', { log: { target: 'invoice', from: 'path', verb: 'copied an invoice' } }),
  paper('POST', '/agency/invoices/:id/email', 'edit', { log: { target: 'invoice', from: 'path', verb: 'emailed an invoice' } }),
  paper('POST', '/agency/contracts', 'edit', { log: { target: 'contract', from: 'answer', verb: 'made an agreement' } }),
  paper('PATCH', '/agency/contracts/:id', 'edit', { log: { target: 'contract', from: 'path', verb: 'changed an agreement' } }),
  paper('POST', '/agency/contracts/:id/restore', 'edit'),
  paper('POST', '/agency/contracts/:id/duplicate', 'edit', { log: { target: 'contract', from: 'path', verb: 'copied an agreement' } }),
  paper('POST', '/agency/contracts/:id/email', 'edit', { log: { target: 'contract', from: 'path', verb: 'emailed an agreement' } }),
  paper('POST', '/agency/docs', 'edit', { log: { target: 'doc', from: 'answer', verb: 'made a document' } }),
  paper('PATCH', '/agency/docs/:id', 'edit', { log: { target: 'doc', from: 'path', verb: 'changed a document' } }),
  paper('POST', '/agency/docs/:id/duplicate', 'edit', { log: { target: 'doc', from: 'path', verb: 'copied a document' } }),
  paper('POST', '/agency/docs/:id/email', 'edit', { log: { target: 'doc', from: 'path', verb: 'emailed a document' } }),
  paper('POST', '/agency/comments/:type/:id', 'edit'),
  paper('POST', '/agency/clients/:id/retainer', 'edit'),
  paper('POST', '/agency/retainers/:id/confirm', 'edit'),
  paper('POST', '/agency/retainers/:id/end', 'edit'),
  paper('POST', '/agency/retainers/:id/auto-send', 'edit', { log: { target: 'retainer', from: 'path', verb: 'changed how a retainer sends its invoices' } }),
  paper('POST', '/agency/retainers/:id/withdraw', 'edit'),
];

const SEG = '[^/]+';
const compiled = TEAM_ROUTE_RULES.map((r) => ({ rule: r, re: new RegExp(`^${r.path.replace(/:[a-zA-Z]+/g, `(${SEG})`)}/?$`) }));

/** The rule for a request, with the first `:id` in its path, or null (the request is refused). */
export function teamRuleFor(method: string, path: string): { rule: TeamRule; id: string | null } | null {
  for (const { rule, re } of compiled) {
    if (rule.method !== method) continue;
    const m = re.exec(path);
    if (m) return { rule, id: m.slice(1).at(-1) ?? null };
  }
  return null;
}

/** Who the log says did a thing: the owner, or the team member acting on the owner's Agency. */
export function actorOf(c: Context<AppEnv>): { actor: 'me' | 'team'; actorId: string | null } {
  const team = c.get('team');
  return team ? { actor: 'team', actorId: team.memberId } : { actor: 'me', actorId: null };
}

/** Whether this request comes from a team member, and whether their access opens a tab at a level. The owner is always allowed. */
export function teamMay(c: Context<AppEnv>, tab: TeamTab, need: 'view' | 'edit'): boolean {
  const team = c.get('team');
  return !team || teamAllows(team.access, tab, need);
}

interface GateRow {
  team_role: TeamRole;
  team_access: string;
}

const refuse = (c: Context<AppEnv>, error: string, reason?: string) => c.json(reason ? { error, reason } : { error }, 403);

export async function agencyTeamGate(c: Context<AppEnv>, next: Next) {
  const header = (c.req.header(TEAM_HEADER) ?? '').trim();
  // '/agency' matches both mounts, so the gate can run twice on one request: the second time it has already resolved the member.
  if (!header || c.get('team')) return next();
  const db = c.env.DB;
  const me = c.get('user');
  const path = new URL(c.req.url).pathname.replace(/^\/api/, '');
  if (path === '/agency/team' || path.startsWith('/agency/team/')) return refuse(c, 'Only the owner can do that.');
  if (header.length > 64) return refuse(c, 'You are no longer on that team.', 'gone');
  const row = await db
    .prepare(`SELECT u.*, t.role AS team_role, t.access_json AS team_access FROM agency_team t JOIN users u ON u.id = t.owner_id WHERE t.id = ? AND t.member_id = ? AND t.status = 'active' AND ${liveUser('u')}`)
    .bind(header, me.id)
    .first<GateRow & UserRow>();
  if (!row) return refuse(c, 'You are no longer on that team.', 'gone');
  if (row.team_role === 'client') return refuse(c, 'Only the owner can do that.');
  const { team_role: role, team_access: accessJson, ...ownerCols } = row;
  const owner = ownerCols as UserRow;
  const { access: ownerAccess } = await resolveAccess(db, owner);
  if (!ownerAccess.agency?.available) return refuse(c, 'This agency is not open right now.');
  const found = teamRuleFor(c.req.method, path);
  if (!found) return refuse(c, 'Only the owner can do that.');
  const access = parseTeamAccess(safeJson(accessJson), role);
  const { rule } = found;
  const open = teamAllows(access, rule.tab, rule.need) || (rule.orTabs ?? []).some((t) => teamAllows(access, t, 'view'));
  if (!open) return refuse(c, 'Your access does not include that.');
  const actor: TeamActor = { id: header, ownerId: owner.id, memberId: me.id, memberName: me.display_name, role, access };
  c.set('team', actor);
  c.set('user', owner);
  await next();
  const status = c.res.status;
  if (status < 200 || status >= 300) return;
  if (rule.log && c.req.method !== 'GET') await writeTeamLog(c, actor, rule, found.id).catch(() => undefined);
  if (rule.scrub && (c.res.headers.get('content-type') ?? '').includes('application/json')) {
    const body = (await c.res.clone().json().catch(() => null)) as unknown;
    if (body && typeof body === 'object') {
      const headers = new Headers(c.res.headers);
      headers.delete('content-length');
      headers.set('content-type', 'application/json; charset=UTF-8');
      const out = scrubFor(rule.scrub, body as Record<string, unknown>, actor);
      // Cleared first, so the old answer's headers (and its length) are not merged into the new one.
      c.res = undefined as unknown as Response;
      c.res = new Response(JSON.stringify(out), { status, headers });
    }
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

/** One line in the client's log for a member's write that has no line of its own: "<role> <verb>", the member by id (named when read). */
async function writeTeamLog(c: Context<AppEnv>, actor: TeamActor, rule: TeamRule, pathId: string | null): Promise<void> {
  const db = c.env.DB;
  const log = rule.log!;
  let id: string | null = null;
  if (log.from === 'path') id = pathId;
  else if (log.from === 'answer') {
    const a = (await c.res.clone().json().catch(() => null)) as { id?: unknown; invoice?: { id?: unknown }; contract?: { id?: unknown }; doc?: { id?: unknown } } | null;
    const v = a?.id ?? a?.invoice?.id ?? a?.contract?.id ?? a?.doc?.id;
    id = typeof v === 'string' ? v : null;
  } else {
    const b = (await c.req.json<{ clientId?: unknown }>().catch(() => null)) ?? {};
    id = typeof b.clientId === 'string' ? b.clientId : null;
  }
  if (!id) return;
  const lookup: Record<Target, string> = {
    client: 'SELECT id AS client_id FROM agency_clients WHERE id = ? AND user_id = ?',
    item: 'SELECT client_id FROM agency_items WHERE id = ? AND user_id = ?',
    invoice: 'SELECT agency_client_id AS client_id FROM invoices WHERE id = ? AND user_id = ?',
    contract: 'SELECT client_id FROM agency_contracts WHERE id = ? AND user_id = ?',
    doc: 'SELECT client_id FROM agency_docs WHERE id = ? AND user_id = ?',
    retainer: 'SELECT client_id FROM agency_retainers WHERE id = ? AND user_id = ?',
  };
  const r = await db.prepare(lookup[log.target]).bind(id, actor.ownerId).first<{ client_id: string | null }>();
  if (!r?.client_id) return;
  const there = await db.prepare('SELECT 1 AS x FROM agency_clients WHERE id = ? AND user_id = ?').bind(r.client_id, actor.ownerId).first();
  if (!there) return;
  await logStmt(db, actor.ownerId, r.client_id, { actor: 'team', actorId: actor.memberId }, 'team', `${TEAM_ROLE_META[actor.role].name} ${log.verb}.`).run();
}

// ---- the scrubs: the one place a member's answer is cut down

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

function scrubSettings(s: unknown): unknown {
  if (!isObj(s)) return s;
  return { currency: s.currency, weeklyHours: s.weeklyHours, profile: parseProfile({}) };
}

function scrubClient(cl: unknown, access: TeamAccess): unknown {
  if (!isObj(cl)) return cl;
  // Neither link (the client link nor the team link for the client's own team) is ever a member's: no token, no switches, no password state.
  const out: Json = { ...cl, notes: '', portal: parsePortalShow({}), portalToken: null, portalLocked: false, teamLink: { token: null, show: parseTeamLinkShow({}), password: { set: false, setAt: null, lastOpenedDay: null, request: null } }, campaignId: null, campaignName: '' };
  if (!teamAllows(access, 'paperwork', 'edit')) out.retainerCents = 0;
  if (!teamAllows(access, 'paperwork', 'view') && isObj(cl.billing)) out.billing = { ...Object.fromEntries(Object.keys(cl.billing).map((k) => [k, ''])), name: cl.name ?? '' };
  return out;
}

function scrubItem(it: unknown, access: TeamAccess): unknown {
  if (!isObj(it)) return it;
  // The owner's "Notes, only for you" on a piece are never a member's to read, nor what the brand wrote in Army (Army is the owner's).
  const out: Json = { ...it, notes: '', armyDeliverableId: null, army: null };
  if (!teamAllows(access, 'paperwork', 'edit')) out.feeCents = 0;
  return out;
}

/** Removes every client-link token and bank detail from a paper answer, however deep. */
function scrubPaper(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(scrubPaper);
  if (!isObj(v)) return v;
  const out: Json = {};
  for (const [k, x] of Object.entries(v)) {
    if (k === 'token' || k === 'portalToken') out[k] = null;
    else if (k === 'bank' && isObj(x)) out[k] = emptyBank();
    else out[k] = scrubPaper(x);
  }
  return out;
}

export function scrubFor(kind: Scrub, body: Json, actor: Pick<TeamActor, 'access' | 'memberId'>): Json {
  const { access } = actor;
  if (kind === 'paper') return scrubPaper(body) as Json;
  if (kind === 'item') {
    const out: Json = { ...body };
    if (Array.isArray(body.items)) out.items = body.items.map((i) => scrubItem(i, access));
    if (Array.isArray(body.columns)) out.columns = body.columns.map((col) => (isObj(col) && Array.isArray(col.items) ? { ...col, items: col.items.map((i) => scrubItem(i, access)) } : col));
    return out;
  }
  if (kind === 'notes') {
    const notes = Array.isArray(body.notes) ? body.notes.filter((n) => isObj(n) && n.author === 'team') : [];
    return { ...body, notes };
  }
  if (kind === 'overview') {
    const clients = Array.isArray(body.clients) ? body.clients : [];
    if (!teamAllows(access, 'overview', 'view')) {
      // Only the client names the other tabs need, and nothing about money or what is coming.
      return {
        settings: scrubSettings(body.settings),
        totals: Object.fromEntries(Object.keys(isObj(body.totals) ? body.totals : {}).map((k) => [k, 0])),
        attention: [],
        clients: clients.map((x) => (isObj(x) ? { id: x.id, name: x.name, status: x.status, stage: x.stage } : x)),
        page: body.page,
        coming: [],
      };
    }
    const totals = isObj(body.totals) ? { ...body.totals, retainerCents: 0 } : body.totals;
    if (isObj(totals) && !teamAllows(access, 'paperwork', 'view')) totals.unpaidCents = 0;
    return {
      ...body,
      settings: scrubSettings(body.settings),
      totals,
      clients: clients.map((x) => scrubClient(x, access)),
      coming: teamAllows(access, 'pipeline', 'view') && Array.isArray(body.coming) ? body.coming.map((i) => scrubItem(i, access)) : [],
    };
  }
  // clientPage
  const life = isObj(body.lifecycle)
    ? { ...body.lifecycle, password: { set: false, setAt: null, lastOpenedDay: null, request: null }, retainer: teamAllows(access, 'paperwork', 'edit') ? body.lifecycle.retainer : null }
    : body.lifecycle;
  const onboarding = isObj(body.onboarding) ? { ...body.onboarding, answers: teamAllows(access, 'paperwork', 'view') ? body.onboarding.answers : null } : body.onboarding;
  return {
    ...body,
    settings: scrubSettings(body.settings),
    client: scrubClient(body.client, access),
    campaigns: [],
    time: [],
    invoices: teamAllows(access, 'paperwork', 'view') && Array.isArray(body.invoices) ? scrubPaper(body.invoices) : [],
    lifecycle: life,
    onboarding,
  };
}
