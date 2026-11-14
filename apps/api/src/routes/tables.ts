import { Hono, type Context } from 'hono';
import {
  aiPrivateOnly,
  andList,
  BULK_MAX,
  archiveCall,
  coachTableKeys,
  dataTableByKey,
  editValue,
  listTables,
  parseAiTables,
  parseTableQuery,
  plainCall,
  TABLE_SWITCHES,
  tableAppsOn,
  rowEditable,
  tableAllowed,
  tableColumn,
  toCsv,
  visibleColumns,
  type Cell,
  type ColumnEdit,
  type DataColumn,
  type DataTable,
  type TableBulkAction,
  type TableBulkResponse,
  type TableEditResponse,
  type TableRow,
  type TablesListResponse,
  type TableView,
} from '@kreators/shared/dataTables';
import { eatFromStored } from '@kreators/shared/fitness';
import { MODULE_BY_KEY, parseCoachShare, parseRepeat, type ModuleAccess } from '@kreators/shared';
import type { AppEnv, UserRow } from '../env';
import { accessFor, appsOn, loadAccessContext, resolveAccess } from '../access';
import { caller, type Answer, type Req } from '../assistant/dispatch';
import { ctxOf, tokenOf, type AppFetch } from '../assistant/run';
import { activeLink, isCoach } from '../coaching';
import { ROUTE_TRIPS, tripsOf } from '../d1Batch';
import { DELETED_NAME, getUser, newId, nowIso, objectBody, orgIdsOf, personDay } from '../db';
import { loadTable, readPage, subjectOf, viewQuery, type Loaded, type ReadCtx } from '../tablesRead';
import { tableSwitchesOn } from '../tablesShare';
import { heldCompanionModels } from '../aiOpen';

/**
 * All tables (2026-11-13, the founder): every list of a person's own data as a table they can sort, filter, search, page, tick, copy,
 * download and, where the app already has a route for it, change in place. The contract is in `@kreators/shared/dataTables`; the reads
 * are in tablesRead.ts. Mounted at /tables, a private log area, since a table holds the journal (logs.ts keeps no path of it).
 *
 * - The owner: GET /tables, /tables/:table, /tables/:table/csv; POST /tables/:table/edit and /tables/:table/bulk. An edit or a bulk action is
 *   never done here: it is sent to the app's own route as the person, with their own token, through the app itself (the assistant's caller,
 *   `X-Kreators-Via: tables`), so the session, the module switches, the limits, the waits, the xp caps and the owner filters all hold.
 * - A coach (access map `tables/coach`, the Coaching app): only the tables the student switched on for them, read only, checked on every request,
 *   never one with other people's details (`tableReach`).
 * - A super admin (access map `tables/admin`): any member's tables but the journal, the body and mind ones and those with other people's
 *   details, read only, every table opened written to the audit log (never what it holds). A real session with the admin role: the shared
 *   admin key never reaches these.
 * - Every view, AI chat's too: a table lists and opens only while its app (`needs`) is on for the person whose tables these are (2026-11-14).
 *   The owner is told which app to turn on; a coach and an admin get the plain 404, which says nothing of the person's apps.
 */

type Ctx = Context<AppEnv>;
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
/** A row's id: an id, a day, "item:day", a category or a purpose. Always bound, never put in SQL. */
const rowId = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 && v.length <= 120 ? v : null);
const NOT_FOUND = { error: 'not found' } as const;

const tableOf = (key: string): DataTable | null => dataTableByKey[key] ?? null;
const queryOf = (c: Ctx, table: DataTable, view: TableView) => parseTableQuery(table, new URL(c.req.url).searchParams, view);

/**
 * Which apps are on for someone else (a coach's student, an admin's member), read in the same turn as the reads beside it, so the batch binding
 * sends them as one round trip: their organizations (one statement) and the flags, which this worker keeps for a few seconds (access.ts).
 */
function appsOnFor(db: D1Database, id: string): Promise<(u: UserRow) => string[]> {
  return Promise.all([orgIdsOf(db, id), loadAccessContext(db)]).then(([orgIds, ctx]) => (u: UserRow) => appsOn(accessFor(u, ctx, orgIds)));
}
/** The owner's own apps: what the module gate already read for this request, else read now. */
async function ownAccess(c: Ctx): Promise<Record<string, ModuleAccess>> {
  return c.get('gateAccess') ?? (await resolveAccess(c.env.DB, c.get('user'))).access;
}
/** The apps on for the person themself, with the settings inside them a table may need (`switch:<key>`, read only when asked for). */
async function ownOn(c: Ctx, switches: boolean): Promise<{ access: Record<string, ModuleAccess>; on: string[] }> {
  const [access, more] = await Promise.all([ownAccess(c), switches ? tableSwitchesOn(c.env.DB, c.get('user').id) : Promise.resolve([] as string[])]);
  return { access, on: [...appsOn(access), ...more] };
}
/** The owner's own table, when its app (and any setting inside it, `needsSwitch`) is on for them; else the answer saying why. */
async function ownTableShut(c: Ctx, table: DataTable): Promise<Response | null> {
  const { access, on } = await ownOn(c, Boolean(table.needsSwitch));
  return tableAllowed(table, 'owner', [], on) ? null : appOff(c, table, access, on);
}
/**
 * The owner's read of their own table, behind its app check. A table behind a setting inside its app (Business metrics, `needsSwitch`) reads
 * the setting and the rows in one turn, so the batch binding sends them as one round trip, and drops the rows when the setting is off (the
 * review, 2026-11-14: awaited first, it made every such page two). Any other table's check reads nothing (the module gate already read the
 * apps), so it goes first and a shut table reads no row.
 */
async function ownTableRead<T>(c: Ctx, table: DataTable, read: () => Promise<T>): Promise<{ shut: Response } | { got: T }> {
  if (!table.needsSwitch) {
    const shut = await ownTableShut(c, table);
    return shut ? { shut } : { got: await read() };
  }
  const [shut, got] = await Promise.all([ownTableShut(c, table), read()]);
  return shut ? { shut } : { got };
}
/**
 * The owner's answer for a table whose app is hidden or off (a coach and an admin get the plain 404, which says nothing of it): which app to
 * show in Apps when one of them can be shown, else that none is available on their account (the team switched it off, a rollout, a role), in
 * the module gate's own words, since Apps cannot show such an app (the review, 2026-11-14).
 */
function appOff(c: Ctx, table: DataTable, access: Record<string, ModuleAccess>, on: string[]): Response {
  const needs = table.needs ?? [];
  // Its app is on and only the setting inside it is off (Business metrics in Reviews): say which switch, and where it is.
  if (table.needsSwitch && tableAppsOn({ ...table, needsSwitch: undefined }, on)) {
    const sw = TABLE_SWITCHES[table.needsSwitch];
    return c.json({ error: `Turn on ${sw.name} in ${sw.where} to open ${table.name}.`, switchOff: table.needsSwitch }, 404);
  }
  const name = (k: string) => MODULE_BY_KEY[k]?.name ?? k;
  const orList = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? 'its app') : `${xs.slice(0, -1).join(', ')} or ${xs.at(-1)}`);
  const showable = needs.filter((k) => access[k]?.available === true);
  if (showable.length === 0) {
    const names = needs.map(name);
    return c.json({ error: `${andList(names) || 'Its app'} ${names.length > 1 ? 'are' : 'is'} not available on your account.`, unavailable: needs }, 404);
  }
  return c.json({ error: `Show ${orList(showable.map(name))} in Apps to open ${table.name}.`, off: showable }, 404);
}

/** The words for a CSV answer: every matching row up to `csvMaxRows`, in the viewer's columns. */
function csvAnswer(c: Ctx, table: DataTable, got: Loaded, view: TableView, currency: string, today: string): Response {
  const csv = `\uFEFF${toCsv(visibleColumns(table, view), got.rows, { options: got.options, currency })}`;
  return c.body(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${table.key}-${today}.csv"`,
    'Cache-Control': 'no-store',
    'X-Table-Rows': String(got.rows.length),
    ...(got.capped ? { 'X-Table-Capped': '1' } : {}),
  });
}

/** Why a row's cell cannot change now, in plain words. */
function notNowWhy(edit: ColumnEdit, cells: Record<string, Cell>): string {
  switch (edit.when) {
    case 'open':
      return 'Only an open task can be changed this way.';
    case 'project':
      return 'Only a project has a due day here.';
    case 'recentOwnMove':
      return cells.loggedBy === 'run' ? 'A club run is changed in Kreators Run.' : 'Only today or yesterday can be changed here.';
    case 'recentEat':
      return cells.legacy === true ? 'A check-in from before the meals were asked stays as it is.' : 'Only today or yesterday can be changed here.';
    case 'recent':
      return 'Only today or yesterday can be changed here.';
    case 'handInOpen':
      return 'An approved hand-in, or one from a cohort you left, stays as it is.';
    case 'paperOpen':
      return cells.status === 'paid' ? 'A paid invoice is marked sent again in Agency before it can change.' : 'A void invoice stays as it is.';
    case 'retainerOpen':
      return 'An ended or withdrawn retainer stays as it is.';
    case 'listingOpen':
      return 'A listing with an accepted offer, or one that sold, stays as it is.';
    case 'unpublished':
      return 'A published listing is closed on its page in Work, where that asks first.';
    case 'pitchWaiting':
      return 'The team has started reading it, so it can no longer be changed.';
    case 'xpOpen':
      return 'The xp is fixed once the code opens, thirty minutes before the start, and a cancelled one stays as it is.';
    case 'seatHeld':
      return 'Only a guest with a seat can be on the list to meet other guests.';
    case 'madeIt':
      return 'Only a channel you made can be renamed here.';
    case 'linkOpen':
      return 'Coaching that ended or was turned down shares nothing, so it stays as it is.';
    default:
      return 'This one cannot be changed now.';
  }
}

/** The route's own error, said back plainly, with its status (a 409 passes through for the screen to read the row again). */
function passBack(c: Ctx, a: Answer): Response {
  const said = typeof a.data?.error === 'string' ? (a.data.error as string) : '';
  const status = a.status >= 400 && a.status < 500 ? a.status : 502;
  const words =
    said === 'not found' ? 'Could not find that. It may be gone.' : said === 'changed' ? 'Changed somewhere else. Reload to see it.' : said || (status === 502 ? 'That did not save. Try again.' : 'That did not work.');
  return c.json({ error: words, ...(said === 'changed' ? { changed: true } : {}) }, status as 400);
}

export function tablesRoutes(appFetch: AppFetch) {
  const r = new Hono<AppEnv>();
  /** The app's own routes as this person: their token, every gate. */
  const callAs = (c: Ctx) => caller((req) => Promise.resolve(appFetch(req, c.env, ctxOf(c))), tokenOf(c), 'tables');

  // AI chat (2026-11-14): the assistant and the Companion call these routes as the person, marked `X-Kreators-Via: assistant` by the tool
  // dispatcher. They may list and read a page of the person's own tables, and only the ones the person opened to AI chat (`ai_tables_json`);
  // never a download, an edit, an archive, a coach's or an admin's view. A person who sends the mark themselves only shuts doors on themselves.
  const viaAi = (c: Ctx) => c.req.header('X-Kreators-Via') === 'assistant';
  r.use('*', async (c, next) => {
    if (!viaAi(c)) return next();
    const parts = new URL(c.req.url).pathname.split('/').filter(Boolean);
    const at = parts.indexOf('tables');
    const rest = at < 0 ? parts : parts.slice(at + 1);
    if (c.req.method !== 'GET' || rest.length > 1 || rest[0] === 'coach' || rest[0] === 'admin') return c.json({ error: 'AI chat can only read the tables you open to it.' }, 403);
    return next();
  });
  /** The tables this person opened to AI chat. */
  const aiTablesOf = (c: Ctx) => parseAiTables(c.get('user').ai_tables_json ?? null);
  /**
   * AI chat on a model that may keep what it reads (2026-11-14, the review): the read_table tool marks a model that keeps nothing with `ai=private`,
   * and every other read marked as AI chat is one that may keep data, so a caller that forgets the mark gets the narrower read. Such a read never
   * gets a table only a model that keeps nothing may read (`aiPrivateOnly`), and gets an 'own' table as anyone but its owner does (the admin view:
   * no `ownerOnly` column, no `othersWhere` row, no private badge family). A person who sends either mark themselves reads only their own tables,
   * as they always may.
   */
  const aiKeepsData = (c: Ctx) => viaAi(c) && c.req.query('ai') !== 'private';

  // ----------------------------------------------------------------------------------------------------------------------------------
  // A coach's view of one student: only the tables the student shares with them, read only. Registered before the owner's `/:table`.
  // ----------------------------------------------------------------------------------------------------------------------------------

  /**
   * The student, the tables they share with this coach now and the apps on for them, or null (404): an active link, the coach permission held
   * now. A table with other people's details is never in `shared`, whatever was stored (`coachTableKeys`); one whose app is off for the
   * student is shut by `tableAllowed` with `on`. All in one round trip.
   */
  async function coachAccess(c: Ctx): Promise<{ student: UserRow; shared: string[]; on: string[] } | null> {
    const user = c.get('user');
    const studentId = c.req.param('studentId') ?? '';
    if (!isCoach(user) || !ID_RE.test(studentId) || studentId === user.id) return null;
    const [link, student, onOf] = await Promise.all([activeLink(c.env.DB, user.id, studentId), getUser(c.env.DB, studentId), appsOnFor(c.env.DB, studentId)]);
    if (!link || !student || student.display_name === DELETED_NAME) return null;
    return { student, shared: coachTableKeys(parseCoachShare(link.share_json).tables), on: onOf(student) };
  }

  r.get('/coach/:studentId', async (c) => {
    const got = await coachAccess(c);
    if (!got) return c.json(NOT_FOUND, 404);
    return c.json({ view: 'coach', subject: subjectOf(got.student), groups: listTables('coach', got.shared, got.on) } satisfies TablesListResponse);
  });

  r.get('/coach/:studentId/:table', async (c) => {
    const table = tableOf(c.req.param('table'));
    const got = table ? await coachAccess(c) : null;
    if (!table || !got || !tableAllowed(table, 'coach', got.shared, got.on)) return c.json(NOT_FOUND, 404);
    const ctx: ReadCtx = { view: 'coach', subject: subjectOf(got.student), viewerId: c.get('user').id };
    return c.json(await readPage(c.env.DB, table, queryOf(c, table, 'coach'), ctx));
  });

  r.get('/coach/:studentId/:table/csv', async (c) => {
    const table = tableOf(c.req.param('table'));
    const got = table ? await coachAccess(c) : null;
    if (!table || !got || !tableAllowed(table, 'coach', got.shared, got.on)) return c.json(NOT_FOUND, 404);
    const subject = subjectOf(got.student);
    const loaded = await loadTable(c.env.DB, table, queryOf(c, table, 'coach'), { view: 'coach', subject, viewerId: c.get('user').id }, { kind: 'all' });
    return csvAnswer(c, table, loaded, 'coach', subject.currency, subject.today);
  });

  // ----------------------------------------------------------------------------------------------------------------------------------
  // A super admin's view of one member: read only, never the journal or a body and mind table, every table opened in the audit log.
  // ----------------------------------------------------------------------------------------------------------------------------------

  /** The member and the apps on for them, or an answer to send: 403 to anyone not an admin (by session), 404 for nobody or a deleted member. */
  async function adminAccess(c: Ctx): Promise<{ member: UserRow; on: string[] } | Response> {
    if (c.get('user').role !== 'admin') return c.json({ error: 'forbidden' }, 403);
    const userId = c.req.param('userId') ?? '';
    const [member, onOf] = ID_RE.test(userId) ? await Promise.all([getUser(c.env.DB, userId), appsOnFor(c.env.DB, userId)]) : [null, null];
    if (!member || !onOf || member.display_name === DELETED_NAME) return c.json(NOT_FOUND, 404);
    return { member, on: onOf(member) };
  }
  /**
   * One audit line for a table an admin opened: who, whose and which table, never what it holds. Written for any page read, so no page is
   * read unseen, but once per admin, member and table in half an hour (a guarded insert through the audit index), so paging adds no noise.
   */
  async function auditView(c: Ctx, memberId: string, tableKey: string, action: 'tables.view' | 'tables.csv'): Promise<void> {
    const now = nowIso();
    const since = new Date(Date.now() - 30 * 60_000).toISOString();
    const adminId = c.get('user').id;
    await c.env.DB.prepare(
      `INSERT INTO audit_logs (id, actor_user_id, action, resource_type, resource_id, before_summary, after_summary, created_at)
       SELECT ?1, ?2, ?3, 'user', ?4, '', ?5, ?6
       WHERE ?3 = 'tables.csv' OR NOT EXISTS (SELECT 1 FROM audit_logs WHERE resource_type = 'user' AND resource_id = ?4 AND action = ?3 AND actor_user_id = ?2 AND after_summary = ?5 AND created_at > ?7)`,
    )
      .bind(newId(), adminId, action, memberId, tableKey, now, since)
      .run();
  }

  r.get('/admin/:userId', async (c) => {
    const got = await adminAccess(c);
    if (got instanceof Response) return got;
    return c.json({ view: 'admin', subject: subjectOf(got.member), groups: listTables('admin', [], got.on) } satisfies TablesListResponse);
  });

  r.get('/admin/:userId/:table', async (c) => {
    const got = await adminAccess(c);
    if (got instanceof Response) return got;
    const table = tableOf(c.req.param('table'));
    if (!table || !tableAllowed(table, 'admin', [], got.on)) return c.json(NOT_FOUND, 404);
    const ctx: ReadCtx = { view: 'admin', subject: subjectOf(got.member), viewerId: c.get('user').id };
    const [page] = await Promise.all([readPage(c.env.DB, table, queryOf(c, table, 'admin'), ctx), auditView(c, got.member.id, table.key, 'tables.view')]);
    return c.json(page);
  });

  r.get('/admin/:userId/:table/csv', async (c) => {
    const got = await adminAccess(c);
    if (got instanceof Response) return got;
    const table = tableOf(c.req.param('table'));
    if (!table || !tableAllowed(table, 'admin', [], got.on)) return c.json(NOT_FOUND, 404);
    const subject = subjectOf(got.member);
    const [loaded] = await Promise.all([loadTable(c.env.DB, table, queryOf(c, table, 'admin'), { view: 'admin', subject, viewerId: c.get('user').id }, { kind: 'all' }), auditView(c, got.member.id, table.key, 'tables.csv')]);
    return csvAnswer(c, table, loaded, 'admin', subject.currency, subject.today);
  });

  // ----------------------------------------------------------------------------------------------------------------------------------
  // The person's own tables
  // ----------------------------------------------------------------------------------------------------------------------------------

  const ownerCtx = (c: Ctx, today?: unknown): ReadCtx => {
    const user = c.get('user');
    const day = personDay(typeof today === 'string' ? today : c.req.query('day'), user.timezone);
    // AI chat's read (`X-Kreators-Via: assistant`) binds `{ai}`, which a table reads where its app keeps its own yes for the assistant.
    return { view: 'owner', subject: subjectOf(user, day), viewerId: user.id, ai: viaAi(c) };
  };

  r.get('/', async (c) => {
    const groups = listTables('owner', [], (await ownOn(c, true)).on);
    if (!viaAi(c)) return c.json({ view: 'owner', subject: ownerCtx(c).subject, groups } satisfies TablesListResponse);
    // AI chat lists only what the person opened to it.
    const open = new Set(aiTablesOf(c));
    const shown = groups.map((g) => ({ ...g, tables: g.tables.filter((t) => open.has(t.key)) })).filter((g) => g.tables.length > 0);
    return c.json({ view: 'owner', subject: ownerCtx(c).subject, groups: shown } satisfies TablesListResponse);
  });

  r.get('/:table', async (c) => {
    const table = tableOf(c.req.param('table'));
    if (!table) return c.json(NOT_FOUND, 404);
    // AI chat's refusals need no read, so nothing is read for them.
    const aiShut = viaAi(c) && !aiTablesOf(c).includes(table.key);
    const keeps = aiKeepsData(c);
    const aiPrivate = keeps && aiPrivateOnly(table);
    const view: TableView = keeps ? 'admin' : 'owner';
    // The Companion chat to AI chat leaves out every answer that read a table the person has since shut to it (`heldCompanionModels`).
    const read = async () => {
      const aiHeld = viaAi(c) && table.key === 'companionChat' ? await heldCompanionModels(c, !keeps) : undefined;
      return readPage(c.env.DB, table, queryOf(c, table, view), { ...ownerCtx(c), view, ...(aiHeld ? { aiHeld } : {}) });
    };
    const got = await ownTableRead(c, table, () => (aiShut || aiPrivate ? Promise.resolve(null) : read()));
    if ('shut' in got) return got.shut;
    if (!got.got) {
      if (aiShut) return c.json({ error: `${table.name} is not open to AI chat. Switch on Show to AI chat at the top of that table to let it read it.` }, 403);
      return c.json({ error: `This model may keep what it reads, so it cannot read ${table.name}. Pick a model that keeps nothing to read it.` }, 403);
    }
    return c.json(got.got);
  });

  r.get('/:table/csv', async (c) => {
    const table = tableOf(c.req.param('table'));
    if (!table) return c.json(NOT_FOUND, 404);
    const ctx = ownerCtx(c);
    const got = await ownTableRead(c, table, () => loadTable(c.env.DB, table, queryOf(c, table, 'owner'), ctx, { kind: 'all' }));
    if ('shut' in got) return got.shut;
    return csvAnswer(c, table, got.got, 'owner', ctx.subject.currency, ctx.subject.today);
  });

  /** The row as the owner sees it now, in the table's Active view (a row in the archive is never edited). */
  const ownRow = (db: D1Database, table: DataTable, id: string, ctx: ReadCtx) => loadTable(db, table, viewQuery(table, 'owner'), ctx, { kind: 'one', id });

  /**
   * The call to the app's own route for one cell of one row, or a refusal in plain words. The plain recipes are built by the registry; the rest
   * send the whole thing the route keeps (a day's log, the eating check-in, the three gratitude lines, every budget, all three privacy choices).
   */
  async function editCall(db: D1Database, table: DataTable, col: DataColumn, row: TableRow, fields: Record<string, unknown>, value: unknown, ctx: ReadCtx): Promise<Req | { error: string }> {
    const edit = col.edit!;
    const cells = row.cells;
    const today = ctx.subject.today;
    const recipe = edit.recipe ?? 'plain';
    if (recipe === 'plain' || recipe === 'withToday' || recipe === 'todayQuery') {
      const call = plainCall(col, row.id, cells, value, today);
      return call ? { method: call.method as Req['method'], path: call.path, body: call.body } : { error: 'That row cannot be changed here.' };
    }
    switch (recipe) {
      case 'wellbeingDay': {
        const kind = edit.path.split('/').pop() ?? '';
        let extra: Record<string, unknown> = {};
        try {
          const v: unknown = typeof fields.extra === 'string' && fields.extra ? JSON.parse(fields.extra) : {};
          if (v && typeof v === 'object' && !Array.isArray(v)) extra = v as Record<string, unknown>;
        } catch {
          extra = {};
        }
        const body: Record<string, unknown> = { date: cells.day, value: Number(fields.value), extra, note: typeof fields.note === 'string' ? fields.note : '' };
        if (edit.field === 'value') body.value = value;
        else if (edit.field === 'note') body.note = typeof value === 'string' ? value : '';
        else if (edit.field.startsWith('extra.')) {
          const key = edit.field.slice(6);
          const next = { ...extra };
          if (value === null) delete next[key];
          else next[key] = value;
          body.extra = next;
        }
        return { method: 'POST', path: `/wellbeing/${kind}`, body };
      }
      case 'eatWhole': {
        const stored = eatFromStored(Number(fields.value) || 0, typeof fields.extra === 'string' ? fields.extra : '', typeof fields.note === 'string' ? fields.note : '');
        const input: Record<string, unknown> = { ...stored.input };
        if (edit.field === 'fasting') {
          input.fasting = value === true;
          if (value === true) input.meals = [];
        } else input[edit.field] = edit.field === 'note' ? (typeof value === 'string' ? value : '') : value;
        return { method: 'PUT', path: '/fitness/eat', body: { ...input, date: cells.day, protein: stored.input.protein, ifId: row.id } };
      }
      case 'gratitudeLine': {
        const i = Number(edit.field.split('.')[1]);
        let lines: { prompt: string; text: string }[] = [];
        try {
          const v: unknown = typeof fields.lines === 'string' ? JSON.parse(fields.lines) : [];
          if (Array.isArray(v)) lines = v.map((l) => ({ prompt: typeof l?.prompt === 'string' ? l.prompt : '', text: typeof l?.text === 'string' ? l.text : '' }));
        } catch {
          lines = [];
        }
        if (!lines[i]) return { error: 'That line cannot be changed here.' };
        // An empty line's prompt may have moved on Journal since it was saved ("Another prompt", or a pillar picked), which changes only the
        // day's offer: the route takes words only under the offer's prompt, so empty lines take the offer's (a written one already matches it).
        const off = await db.prepare('SELECT prompts_json FROM gratitude_offers WHERE user_id = ? AND day = ?').bind(ctx.subject.id, row.id).first<{ prompts_json: string }>();
        let offered: unknown = null;
        try {
          offered = off ? JSON.parse(off.prompts_json) : null;
        } catch {
          offered = null;
        }
        const prompts: unknown[] = Array.isArray(offered) ? offered : [];
        lines = lines.map((l, j) => {
          const p = prompts[j];
          return !l.text.trim() && typeof p === 'string' ? { ...l, prompt: p } : l;
        });
        lines[i] = { ...lines[i]!, text: typeof value === 'string' ? value : '' };
        if (lines.every((l) => !l.text.trim())) return { error: 'Keep at least one line. To clear the day, do it on Journal.' };
        return { method: 'PUT', path: `/journal/gratitude/${encodeURIComponent(row.id)}`, body: { lines, today, ifUpdatedAt: typeof cells.updatedAt === 'string' ? cells.updatedAt : '' } };
      }
      case 'notToDoDay': {
        const itemId = cells.itemId;
        if (typeof itemId !== 'string' || !ID_RE.test(itemId)) return { error: 'That row cannot be changed here.' };
        return { method: 'POST', path: `/today/not-to-do/${itemId}/day`, body: { date: cells.day, today, status: value } };
      }
      case 'handIn': {
        const assignmentId = cells.assignmentId;
        if (typeof assignmentId !== 'string' || !ID_RE.test(assignmentId)) return { error: 'That row cannot be changed here.' };
        const url = edit.field === 'url' ? value : (cells.url ?? '');
        const text = edit.field === 'text' ? value : (cells.text ?? '');
        if (!url && !text) return { error: 'A hand-in needs a link or some words.' };
        return { method: 'POST', path: `/school/assignments/${assignmentId}/submit`, body: { cohortId: cells.cohortId, url, text } };
      }
      case 'kindOfDay':
        return { method: 'PUT', path: '/time-blocks/days', body: { dates: [row.id], templateId: value } };
      case 'budgetsWhole': {
        const all = await db.prepare('SELECT category, monthly_cents FROM finance_budgets WHERE user_id = ?').bind(ctx.subject.id).all<{ category: string; monthly_cents: number }>();
        const budgets = all.results.map((b) => ({ category: b.category, monthlyCents: b.category === row.id ? value : b.monthly_cents }));
        return { method: 'PUT', path: '/finance/budgets', body: { budgets } };
      }
      case 'consentWhole': {
        const all = await db.prepare('SELECT purpose, granted FROM user_consents WHERE user_id = ?').bind(ctx.subject.id).all<{ purpose: string; granted: number }>();
        const choices: Record<string, boolean> = { attribution: false, embeds: false, marketing: false };
        for (const k of Object.keys(choices)) choices[k] = all.results.some((x) => x.purpose === k && x.granted === 1);
        if (!(row.id in choices)) return { error: 'That row cannot be changed here.' };
        choices[row.id] = value === true;
        return { method: 'PUT', path: '/me/legal/consent', body: { choices, source: 'profile' } };
      }
      case 'pitchWhole': {
        // The route takes all three each time: the two not changed go as stored, the budget as the amount it reads (whole units, from cents).
        if (!ID_RE.test(row.id)) return { error: 'That row cannot be changed here.' };
        const cents = edit.field === 'budgetAmount' ? value : cells.budget;
        if (typeof cents !== 'number' || !Number.isInteger(cents) || cents < 0) return { error: 'Type an amount, like 1,250.' };
        const body = {
          title: edit.field === 'title' ? value : cells.title,
          pitch: edit.field === 'pitch' ? value : cells.pitch,
          budgetAmount: `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`,
        };
        return { method: 'PATCH', path: `/proposals/${encodeURIComponent(row.id)}`, body };
      }
      default:
        return { error: 'That column cannot be changed here.' };
    }
  }

  r.post('/:table/edit', async (c) => {
    const db = c.env.DB;
    const table = tableOf(c.req.param('table'));
    if (!table) return c.json(NOT_FOUND, 404);
    const shut = await ownTableShut(c, table);
    if (shut) return shut;
    const body = await objectBody(c);
    const id = rowId(body.id);
    if (!id) return c.json({ error: 'Pick a row.' }, 400);
    const col = typeof body.column === 'string' ? tableColumn(table, body.column) : undefined;
    if (!col?.edit) return c.json({ error: table.readOnlyWhy ?? 'That column cannot be changed here.' }, 400);
    const value = body.value;
    if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) return c.json({ error: 'That value cannot be saved.' }, 400);
    const ctx = ownerCtx(c, body.today);
    const before = await ownRow(db, table, id, ctx);
    const row = before.rows[0];
    if (!row) return c.json(NOT_FOUND, 404);
    if (!rowEditable(table, col, row.cells, ctx.subject.today)) return c.json({ error: notNowWhy(col.edit, row.cells) }, 400);
    const checked = editValue(col, value as Cell, before.options[col.key] ?? []);
    if ('error' in checked) return c.json({ error: checked.error }, 400);
    const fields = before.fields[0] ?? {};
    // A repeating task counts from its do date or its due date: emptying the only one would drop the repeat (or leave it with no day), which
    // the task form refuses too. The route keeps its own rule for the assistant; here it is refused out loud.
    if (table.key === 'tasks' && (col.key === 'doDate' || col.key === 'dueDate') && checked.value === null && parseRepeat(fields.repeat) && !row.cells[col.key === 'doDate' ? 'dueDate' : 'doDate'])
      return c.json({ error: 'It repeats, so it keeps a do date or a due date. Change the repeat on Daily first.' }, 400);
    const call = await editCall(db, table, col, row, fields, checked.value, ctx);
    if ('error' in call) return c.json({ error: call.error }, 400);
    const answer = await callAs(c)(call);
    if (!answer.ok) return passBack(c, answer);
    const recipe = col.edit.recipe;
    const out: TableEditResponse = { row: null };
    if ((recipe === 'kindOfDay' && checked.value === null) || (recipe === 'budgetsWhole' && checked.value === 0)) out.gone = true;
    const replaced = recipe === 'wellbeingDay' ? answer.data?.log?.id : recipe === 'eatWhole' ? answer.data?.eat?.id : undefined;
    if (typeof replaced === 'string' && replaced !== id) out.replacedBy = replaced;
    if (recipe === 'consentWhole' && answer.data?.consent && typeof answer.data.consent === 'object') out.consent = answer.data.consent as Record<string, boolean>;
    // The row as it is now: its cells and what may change, without the person's lists again (the screen holds them from the page).
    if (!out.gone) out.row = (await loadTable(db, table, viewQuery(table, 'owner'), ctx, { kind: 'one', id: out.replacedBy ?? id }, { options: false })).rows[0] ?? null;
    return c.json(out);
  });

  r.post('/:table/bulk', async (c) => {
    const db = c.env.DB;
    const table = tableOf(c.req.param('table'));
    if (!table) return c.json(NOT_FOUND, 404);
    const shut = await ownTableShut(c, table);
    if (shut) return shut;
    const spec = table.archive;
    if (!spec) return c.json({ error: 'This table has no archive, so rows here are not archived or deleted.' }, 400);
    const body = await objectBody(c);
    const action = body.action as TableBulkAction;
    if (action !== 'archive' && action !== 'restore' && action !== 'delete') return c.json({ error: 'Pick archive, restore or delete.' }, 400);
    if (!Array.isArray(body.ids) || body.ids.length === 0) return c.json({ error: 'Tick at least one row.' }, 400);
    if (body.ids.length > BULK_MAX) return c.json({ error: `Up to ${BULK_MAX} rows at a time.` }, 400);
    const ids = [...new Set(body.ids.map(rowId).filter((v): v is string => v !== null))];
    const ctx = ownerCtx(c, body.today);
    // One read for every row asked about: in the view the action needs, and for an archive whether the row meets the archive's own rule.
    // Built from the registry's own strings; the owner is ?1 and the ids one bound list.
    const where = [table.owner, table.where, action === 'archive' ? spec.activeWhere : spec.archivedWhere].filter(Boolean).join(' AND ');
    const ok = action === 'archive' && spec.only ? `CASE WHEN ${spec.only.where} THEN 1 ELSE 0 END` : '1';
    if (/\{(today|viewer|ai)\}/.test(`${table.from} ${where} ${ok}`)) return c.json({ error: 'This table has no archive, so rows here are not archived or deleted.' }, 400);
    const found = await db
      // The ids lead (CROSS JOIN keeps them the outer loop), so each is one look-up by its key, never a walk through every row the person has.
      .prepare(`SELECT ${table.idSql} AS id, ${ok} AS ok FROM json_each(?2) AS asked CROSS JOIN ${table.from} WHERE ${table.idSql} = asked.value AND ${where}`)
      .bind(ctx.subject.id, JSON.stringify(ids))
      .all<{ id: string; ok: number }>();
    const byId = new Map(found.results.map((x) => [String(x.id), x.ok === 1]));
    const call = callAs(c);
    const out: TableBulkResponse = { done: [], skipped: [], left: [] };
    const step = action === 'archive' ? spec.archive : action === 'restore' ? spec.restore : spec.remove;
    // Each row is the app's own call as the person, in turn. A call costs a few round trips (its session, its gate, its own reads); the
    // dearest so far is kept as the guess for the next, and the rest wait in `left` for the screen to send again, well under the free plan's 50.
    let dearest = 10;
    for (const id of ids) {
      const good = byId.get(id);
      if (good === undefined) {
        out.skipped.push({ id, why: action === 'archive' ? 'It is not in your active list.' : 'It is not in your archive.' });
        continue;
      }
      if (!good) {
        out.skipped.push({ id, why: spec.only?.why ?? 'This one stays as it is.' });
        continue;
      }
      if (tripsOf(db) + dearest + 2 > ROUTE_TRIPS) {
        out.left.push(id);
        continue;
      }
      const req = archiveCall(step, id);
      if (!req) {
        out.skipped.push({ id, why: 'This one cannot be changed here.' });
        continue;
      }
      const before = tripsOf(db);
      const a = await call({ method: req.method as Req['method'], path: req.path, body: req.body });
      dearest = Math.max(dearest, tripsOf(db) - before);
      if (a.ok) out.done.push(id);
      else out.skipped.push({ id, why: typeof a.data?.error === 'string' && a.data.error !== 'not found' ? a.data.error : 'That did not work. Try again.' });
    }
    return c.json(out);
  });

  return r;
}

