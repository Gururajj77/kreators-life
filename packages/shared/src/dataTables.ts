// All tables (2026-11-13, the founder): every list of a person's own data, drawn as a table they can sort, filter, search, page, tick,
// copy, download and, where the app already has a route for it, edit in place. A coach sees only the tables a student switched on for
// them, read only; a super admin sees any member's tables, read only, never the journal, gratitude or a body and mind table.
//
// A subpath export (`@kreators/shared/dataTables`, chunk `shared-tables`) and a LEAF: it imports only types and values from the
// `shared-base` files (core.ts, dates.ts, money.ts), so it never pulls the barrel in and the barrel never pulls it in (no chunk cycle,
// and never in the first download). Plain data and pure functions only. It loads with `node --experimental-strip-types`.
//
// ===================================================================================================================================
// THE CONTRACT (the API builder and the screen builder both work from this)
// ===================================================================================================================================
// Every path is under /api. `:table` is a key of DATA_TABLES (never 'coach' or 'admin', a test holds it). Unknown table: 404.
//
// The person's own tables (module `tables`; access map `tables: ['tables']`; log area `tables` is private):
//   GET  /tables                         -> TablesListResponse (view 'owner'). The screen may draw the list from `listTables('owner')`
//                                           without asking; the route exists for symmetry and costs one trip.
//   GET  /tables/:table?<query>          -> TablePageResponse. Limit `tables` (about 600 an hour, per person).
//   GET  /tables/:table/csv?<query>      -> text/csv, every row that matches (page and size ignored), at most `csvMaxRows(table, view)`
//                                           (CSV_MAX_ROWS, fewer on a wide table: CSV_MAX_CELLS cells a file).
//                                           Headers: Content-Disposition attachment; filename="<table>-<today>.csv", X-Table-Rows: <n>,
//                                           X-Table-Capped: 1 when more matched. Limits `tablesCsv` (30 an hour) and `tablesCsvDay` (10 a
//                                           day), per person across the owner's, coach's and admin's downloads.
//   POST /tables/:table/edit             body TableEditRequest -> TableEditResponse. Limit `prefs`. Delegated to the app's own route.
//   POST /tables/:table/bulk             body TableBulkRequest -> TableBulkResponse. Limit `prefs`. Only on a table with `archive`.
//
// A coach's view of one student (access map `'tables/coach': ['coaching']`; read only):
//   GET  /tables/coach/:studentId                 -> TablesListResponse (view 'coach'): only the tables the student shares with them.
//   GET  /tables/coach/:studentId/:table?<query>  -> TablePageResponse (view 'coach').
//   GET  /tables/coach/:studentId/:table/csv?...  -> text/csv as above. Limits `tablesCsv` and `tablesCsvDay`.
//   Checked on every request: the link between the two is active, the viewer is its coach and still holds the coach permission
//   (`isStaffFor(user, 'coach')`), and `:table` is in `knownTableKeys(parseCoachShare(link.share_json).tables)`. Anything else: 404.
//   A coach's rows also meet the table's `coachWhere` (no anonymous line, nor a social xp, point or inbox note that would say who wrote one;
//   only their own notes; no one with a block by name either way with the coach) and `othersWhere`; the person's own lists in `options` hold
//   only what the rows on the page use (and a picked filter), never the student's whole list of blocks, templates or items.
//
// A super admin's view of one member (access map `'tables/admin': ['admin']`; read only; a real session with role 'admin', never the
// shared ADMIN_KEY: these routes sit after the session check, and answer 403 { error: 'forbidden' } to anyone whose role is not admin):
//   GET  /tables/admin/:userId                 -> TablesListResponse (view 'admin'): every table but the `adminHidden` ones.
//   GET  /tables/admin/:userId/:table?<query>  -> TablePageResponse (view 'admin'). An `adminHidden` table, a deleted member
//                                                 (display_name 'Deleted member') or an unknown id: 404. When the query has count=1
//                                                 (the first open, and after each filter or search change) it writes one audit row:
//                                                 audit(db, adminId, 'tables.view', 'user', memberId, '', tableKey). Paging writes none.
//   GET  /tables/admin/:userId/:table/csv?...  -> text/csv as above, one audit row `tables.csv` each. No edit, no bulk for an admin.
//   An admin's rows meet the table's `othersWhere` (an inbox's supplement and focus nudges are body and mind, never shown).
//
// <query> is read by `parseTableQuery` and written by `tableQueryString` (the screen's address uses the same names):
//   page=<n>        1 and up (default 1)
//   size=<n>        10 | 25 | 50 | 100 (default 10, the founder, 2026-11-14: "keep all tables at 10 shown by default")
//   sort=<column>   a sortable column key (default the table's `defaultSort`)
//   dir=asc|desc    (default the table's default direction; a new sort column starts at its own default)
//   q=<words>       search over the searchable columns (trimmed, at most SEARCH_MAX characters)
//   f_<column>=<v>  a pick filter: an option value of that column; 'yes' or 'no' for a yes-or-no column; a person's own id for a
//                   column with `dynamic` options
//   f_<column>_from=<YYYY-MM-DD>, f_<column>_to=<YYYY-MM-DD>   a range filter, both ends inclusive, a real calendar day each
//   view=archived   only on a table with `archive` (default active)
//   count=1         also answer `total`: the screen sends it on the first load and after a filter or search change, never when paging
// Anything else is dropped. Changing sort, a filter, the search or the view goes back to page 1 (the screen's job).
//
// Reading (one D1 round trip a page): `tableSql(table, query, ctx)` builds the rows' SELECT (LIMIT size + 1, so `more` comes free) and,
// when count=1, a COUNT(*) with the same conditions; send both in one Promise.all (batchedReads makes them one trip). SQL is built only
// from registry strings; everything a person typed is a bound parameter. `?1` is always the subject's id. A table with `read: 'memory'`
// is read whole by its server reader (`reader`, at most `memoryMax` rows) and paged by `pageRows`. After the read, `rowFromRaw` turns a
// raw row into a TableRow (and fills the derives this file can do, `LEAF_DERIVES`); the server fills the others (`SERVER_DERIVES`) and,
// for the owner, `row.edit` from `rowEditable`. Columns the viewer may not see (`ownerOnly` for a coach or an admin) are never selected.
//
// Editing (owner only, Active view only): TableEditRequest names one row and one column; the server re-reads the row by the owner and
// its id (`tableSql` with `ctx.id`), checks the column has `edit`, `rowEditable` is true and `editValue` accepts the value, builds the
// call (`plainCall` for the plain recipes, the server's own builder for the others; see EditRecipe), and sends it to the app's own
// route as the person through the Hono app's fetch with their Bearer token and header `X-Kreators-Via: tables` (the assistant's
// dispatch caller). The route's own session, module switch, limits, waits and owner filters hold. Its 4xx answers pass through as they
// are ({ error } and the status). Then the server re-reads the row (by id, or as the recipe says for one that replaces its row).
//
// Bulk (owner only, `archive` tables): at most BULK_MAX ids. Archive acts on Active-view rows that meet `archive.only` (others go to
// `skipped` with its `why`), Restore and Delete forever on Archived-view rows only (the server checks `archive.archivedWhere` itself
// before it calls DELETE, and the delete route is asked to take only a row still archived: a task's `DELETE /nodes/:id?archived=1` and an
// inbox note's `DELETE /inbox/:id` both refuse one brought back meanwhile). Each id is one delegated call, in sequence, while tripsOf(db) stays clear of ROUTE_TRIPS; what is not reached
// comes back in `left`, and the screen sends it again.
//
// Status codes: 200 answers; 400 { error } a value or column refused (plain words); 403 { error: 'forbidden' } an admin route without
// an admin session; 404 { error: 'not found' } unknown table, row, member, or a table not shared or not allowed; 409 passed through from
// the delegated route (a newer save elsewhere); 429 from a limit.
// ===================================================================================================================================

import { byKey, PAGE_SIZES, RELATIONSHIPS } from './core.ts';
import type { Page, PageSize } from './core.ts';
import { addDays, asDay, DATE_PATTERN, fromDay, zonedToUtc } from './dates.ts';
import { money } from './money.ts';

// -----------------------------------------------------------------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------------------------------------------------------------

export type TableGroupKey = 'daily' | 'pillars' | 'reviews' | 'body' | 'journal' | 'money' | 'learning' | 'people' | 'account';
export type TableView = 'owner' | 'coach' | 'admin';
/** One cell on the wire: words, a number, yes or no, or nothing. Dates are YYYY-MM-DD, times HH:MM, instants ISO strings; money is integer cents. */
export type Cell = string | number | boolean | null;

/**
 * How a cell is drawn. `summary` is words the server or this file made from stored JSON (never raw JSON). `money` is integer cents in
 * the currency its column names. `date` is a bare calendar day (never moved by a zone); `datetime` an instant, shown in the viewer's
 * zone and format through lib/date.ts; `time` is HH:MM.
 */
export type ColumnKind = 'text' | 'longtext' | 'number' | 'money' | 'bool' | 'enum' | 'date' | 'datetime' | 'time' | 'summary';
/** A display hint the screen reads (Copy and CSV keep the plain value). */
export type CellFormat = 'percent' | 'ml' | 'grams' | 'minutes' | 'hours' | 'km' | 'handle' | 'appLink' | 'inert' | 'signed';
/** A person's own choices, sent by the server in `TablePageResponse.options` for a column that names them. */
export type DynamicOptions = 'timeBlocks' | 'dayTemplates' | 'projects' | 'notToDoItems';

export interface ColumnOption {
  /** As stored (as a string). A test keeps it to letters, digits, spaces and `_ : . -`, since `ordered` inlines it into SQL. */
  value: string;
  label: string;
  /** This choice means "nothing stored": a filter on it is `IS NULL`, an edit to it sends null (or the column's `send`). */
  isNull?: boolean;
  /** For a grouped select (projects by pillar). */
  group?: string;
}

/**
 * Cells the server works out after the read. The ones in LEAF_DERIVES are done here by `rowFromRaw`; the server does SERVER_DERIVES
 * with the barrel's helpers. Each reads the fields named in the column's `from` (private selects of its table) and the row's cells.
 */
export type DeriveKey =
  // Done here.
  | 'weekdays' // [1..7] -> "Every day", "Weekdays", "Weekends" or "Mon, Wed, Fri"
  | 'stringList' // a JSON list of words -> "Work, Money"
  | 'routineBlocks' // routine_days.blocks_json -> "Food and water, Work"
  | 'pillarList' // a JSON list of pillar keys -> "Love, Faith"
  | 'reviewAnswers' // prompts_json + answers_json -> "Question: answer" lines, the unanswered left out
  | 'answered' // prompts_json + answers_json -> "3 of 5"
  | 'splits' // finance splits_json + the row's currency -> "Editor ₹5,000.00, paid"
  // Done by the server.
  | 'repeatWords' // repeatLabel(parseRepeat(repeat), the row's do date, due date or anchor), else "Once"
  | 'kindOfDay' // fills an old day_types row's template id from its kind (a template's source_kind), through loadBlocking
  | 'reviewName' // an empty template_name -> reviewNameFor({ kind, start })
  | 'eatMeals' // eatFromStored(value, extra, note).input.meals in words: "Breakfast: Both, Lunch: Tasty"; fasting reads "Fasting"
  | 'eatProtein' // proteinGrams(eatFromStored(...).input.protein), whole grams, or null
  | 'eatScore' // eatFromStored(...).dayScore, 0 to 100, or null ("No score yet")
  | 'eatLegacy' // eatFromStored(...).legacy as true or false (a hidden cell the edit rule reads)
  | 'gratitudePrompts' // the three prompts' words, in order, joined by " / "
  | 'gratitudePillars' // the three prompts' groups by name (GRATITUDE_GROUP_NAMES), joined by ", "
  | 'fears' // assessments.fears_json -> "Being judged (Love, drives it)"
  | 'insecurities' // assessments.insecurities_json -> "Money (Heavy, Servitude)", weightWord
  | 'scorecard' // assessments.scores_json -> "Sleep 4 stars, Food 3 stars", SCORE_LABEL and starsOf
  | 'realDay' // assessments.real_day_json -> "Up 07:00, bed 23:30, work 09:00 to 18:00"
  | 'routineDay' // routines.general_json or exceptional_json -> "Morning routine 06:30 to 07:30 (5 steps, 30 min), …"
  | 'practices'; // routines.practices_json -> mantraLine, the breathing's name, the affirmation and the reading

export const LEAF_DERIVES: readonly DeriveKey[] = ['weekdays', 'stringList', 'routineBlocks', 'pillarList', 'reviewAnswers', 'answered', 'splits'];
export const SERVER_DERIVES: readonly DeriveKey[] = [
  'repeatWords', 'kindOfDay', 'reviewName', 'eatMeals', 'eatProtein', 'eatScore', 'eatLegacy', 'gratitudePrompts', 'gratitudePillars',
  'fears', 'insecurities', 'scorecard', 'realDay', 'routineDay', 'practices',
];

/** The input an editable cell becomes. `money` is typed and read with typedCents, sent as integer cents. */
export type EditInput = 'text' | 'longtext' | 'number' | 'money' | 'select' | 'toggle' | 'date' | 'time';

/**
 * How the delegated call is built from the row and the new value. `plainCall` builds the first three; the server builds the rest.
 *  - plain:        { [field]: value } to `path` (`:id` filled from the row).
 *  - withToday:    the same, plus `today` (the device's day from the request).
 *  - todayQuery:   the same body, with `?day=<today>` on the path.
 *  - wellbeingDay: POST the day's whole log again, { date, value, extra, note } from the stored row with `field` ('value', 'note' or
 *                  'extra.<key>') changed. The route replaces the day's row, so the answer's row has a new id (`replacedBy`).
 *  - eatWhole:     PUT /fitness/eat with eatFromStored(row).input, `field` changed, `protein` as stored, `ifId` = the row's id. New id.
 *  - gratitudeLine: PUT /journal/gratitude/:day { lines (the stored three, line `field` 'lines.0' to 'lines.2' changed), today,
 *                  ifUpdatedAt: the row's updatedAt }. Refused (400) when all three lines would be empty.
 *  - notToDoDay:   POST /today/not-to-do/:itemId/day { date: the row's day, today, status }.
 *  - handIn:       POST /school/assignments/:assignmentId/submit { cohortId, url, text }, the field not edited sent as stored.
 *  - kindOfDay:    PUT /time-blocks/days { dates: [the row's day], templateId } (null: Follow your week, which removes the row).
 *  - budgetsWhole: PUT /finance/budgets { budgets: every budget of the person, this one's monthlyCents changed } (0 removes it).
 *  - consentWhole: PUT /me/legal/consent { choices: all three as stored with this purpose changed, source: 'profile' }; the answer
 *                  carries `consent`, and the screen also calls useConsent.keep(choices) so the device copy and the cookie match.
 */
export type EditRecipe = 'plain' | 'withToday' | 'todayQuery' | 'wellbeingDay' | 'eatWhole' | 'gratitudeLine' | 'notToDoDay' | 'handIn' | 'kindOfDay' | 'budgetsWhole' | 'consentWhole';

/**
 * When a row's cell may be edited (evaluated by `rowEditable` from the row's cells and the subject's today):
 *  - open:          cells.status is 'active' (a task: move it to another project, hide it).
 *  - project:       cells.layer is 'project' (a pyramid's Due by).
 *  - recent:        the table's `dayCell` is the subject's today or yesterday.
 *  - recentOwnMove: recent, and the movement was not a club run (cells.loggedBy is not 'run').
 *  - recentEat:     recent, and not a check-in from before the meals were asked (cells.legacy is not true).
 *  - handInOpen:    cells.status is not 'approved' and cells.enrolStatus is 'enrolled'.
 */
export type EditWhen = 'open' | 'project' | 'recent' | 'recentOwnMove' | 'recentEat' | 'handInOpen';

export interface ColumnEdit {
  method: 'PATCH' | 'PUT' | 'POST';
  /** The app's own route under /api; `:id` is filled from the row's id, or from the cell named by `param`. */
  path: string;
  param?: string;
  /** The body field the value goes in (a recipe may read it as a path: 'extra.quality', 'lines.1'). */
  field: string;
  input: EditInput;
  recipe?: EditRecipe;
  when?: EditWhen;
  /** A select's choices: the column's own options (the default) or the person's own list from the page answer. */
  choices?: DynamicOptions;
  /** The cell that holds the input's current value, when it is not the column's own (a task's project: its parentId). */
  current?: string;
  /** What an option value is sent as (an option missing here is sent as its value). A number input sends a number. */
  send?: Readonly<Record<string, string | number | boolean | null>>;
  min?: number;
  max?: number;
  step?: number;
  /** For text: at least and at most this many characters (after trimming). */
  minLength?: number;
  maxLength?: number;
  /** May be emptied: an empty text, number, date or time sends null; a select offers `clearLabel` first. */
  nullable?: boolean;
  clearLabel?: string;
  /** Setting it to null removes the row (a kind of day back to Follow your week); the answer then says `gone`. */
  gone?: boolean;
  /** One line the screen shows beside the input while it is open (what a save does). */
  note?: string;
}

export interface DataColumn {
  /** The cell's key: in each row's cells, in `sort=` and `f_<key>=`. Letters and digits, starting lower case. */
  key: string;
  label: string;
  kind: ColumnKind;
  /** The SQL expression read for this cell, over the table's alias `t` and the joins in its `from`. A registry string, never request
   * text. `{today}` is the subject's today and `{viewer}` the viewer's id, both bound. Null when the server fills the cell (`derive`). */
  sql: string | null;
  derive?: DeriveKey;
  /** The private fields (`privateSelect` keys of the table) a derive reads. */
  from?: readonly string[];
  /** Its words: a filter's choices and how the cell is labelled. */
  options?: readonly ColumnOption[];
  /** The person's own choices label this cell (a time block, a day template, a not to do item). */
  dynamic?: DynamicOptions;
  /** What an enum cell not among the options reads as ("Your own colour"); else the stored value. */
  otherLabel?: string;
  sortable?: boolean;
  /** Sort in the options' order (pillar order, life area order), never A to Z. */
  ordered?: boolean;
  /** Sort by this expression instead of `sql`. */
  sortSql?: string;
  /** Never NULL in the table: the sort leaves out its "nulls last" term, so an index can serve it. */
  notNull?: boolean;
  /** A pick (enum, yes or no, or the person's own choices) or a range of days. */
  filter?: 'pick' | 'range';
  /** Filter by this condition instead of `sql = value`; `{v}` is the chosen value, bound. */
  filterSql?: string;
  searchable?: boolean;
  /** Search this expression instead of `sql`. */
  searchSql?: string;
  /** Read for the server's rules and routes; never a grid column, never in Copy or CSV. Never a person's id or anything secret. */
  hidden?: boolean;
  /** Only in the owner's own view: never selected for a coach or an admin. */
  ownerOnly?: boolean;
  /** For money: the cell key holding the currency, or 'person' for the subject's own currency. */
  currency?: string;
  format?: CellFormat;
  edit?: ColumnEdit;
}

/** A call to one of the app's own routes. */
export interface TableCall {
  method: 'PATCH' | 'POST' | 'DELETE';
  /** Under /api; `:id` is the row's id. */
  path: string;
  body?: Readonly<Record<string, unknown>>;
}

/** Only on a table the app already archives (tasks and inbox notes). */
export interface ArchiveSpec {
  activeWhere: string;
  archivedWhere: string;
  archive: TableCall;
  restore: TableCall;
  /** Delete forever: only for a row in the Archived view, which the server checks itself before it calls, and the route itself refuses a row no longer archived. */
  remove: TableCall;
  /** Archive only rows that also meet this, else skipped with `why`. */
  only?: { where: string; why: string };
}

/**
 * The server readers for a table read whole (`read: 'memory'`). Each returns raw rows of the table's column keys plus `_id` (then
 * `rowFromRaw` and `pageRows`), owner only, never more than the table's `memoryMax`.
 */
export type MemoryReader =
  | 'timeBlocks' // loadBlocking/startingSet in timeBlocks.ts (in code until the person's first change; never SQL from a new file,
  //                scan.sh refuses it): every block, `_id` the block's id (the starting set's ids too), `starting` = a seed key, `order` = sort
  | 'dayTemplates' // the same: every template, `_id` its id, `slots` its slots in words through slotRange ("Deep work 9:00 to 12:00, …"),
  //                  `weekdays` the weekdays the week pattern gives it ("Mon, Tue"; the default also takes every weekday the pattern leaves unset)
  | 'notToDo' // not_to_do, `_id` the item's id, `streak` worked out fresh by notToDoStreak over its not_to_do_days as of the subject's
  //           today (the stored streak goes stale on a missed day), `bestStreak` the larger of the stored best and the fresh streak
  | 'badges' // badge_awards and badge_grants, `_id` 'earned:<key>' or 'given:<key>' (a badge given and later earned is two rows),
  //          names, families and tiers from BADGE_BY_KEY; a key no longer in BADGES is left out; for a coach or an admin the private
  //          families (BADGE_FAMILY_META.private: Focus, Reflection, Money) are left out
  | 'consents'; // the three CONSENT_PURPOSES in order, `_id` the purpose, each with the stored row or off (NO_CONSENT) and no date

export interface DataTable {
  key: string;
  name: string;
  blurb: string;
  group: TableGroupKey;
  /** The base table, for the tests and the coverage notes. */
  sqlTable: string;
  /** The FROM clause: the base table as `t`, plus the joins its columns read. */
  from: string;
  /** The owner condition; `?1` is the subject's id. */
  owner: string;
  where?: string;
  /** The row's key: what the screen ticks and what an edit or bulk action names. */
  idSql: string;
  defaultSort: { key: string; dir: 'asc' | 'desc' };
  read: 'sql' | 'memory';
  reader?: MemoryReader;
  memoryMax?: number;
  columns: readonly DataColumn[];
  /** Read for the server's derives and recipes only, never sent: name -> SQL expression. */
  privateSelect?: Readonly<Record<string, string>>;
  archive?: ArchiveSpec;
  /** Never shown to an admin (the journal and every body and mind table): the server answers 404 and the list leaves it out. */
  adminHidden?: boolean;
  /** An extra condition in a coach's view (no anonymous post; only this coach's own notes, `{viewer}`). */
  coachWhere?: string;
  /** An extra condition in every view but the owner's (a coach's and an admin's): rows only the owner may ever see. */
  othersWhere?: string;
  /** The cell `recent` reads. */
  dayCell?: string;
  /** Why nothing in it can be changed here, for a table with no editable column. */
  readOnlyWhy?: string;
}

export interface TableQuery {
  page: number;
  size: PageSize;
  sort: string;
  dir: 'asc' | 'desc';
  q: string;
  /** Pick filters: column key -> value. A prototype-less object. */
  filters: Record<string, string>;
  /** Range filters: column key -> both ends (either may be null). A prototype-less object. */
  ranges: Record<string, { from: string | null; to: string | null }>;
  /** 'active' or 'archived' on a table with `archive`, else null. */
  view: 'active' | 'archived' | null;
  count: boolean;
}

export interface TableRow {
  id: string;
  cells: Record<string, Cell>;
  /** The column keys this row lets its owner change now (owner view, Active view only). */
  edit?: string[];
}

export interface TableSubject {
  id: string;
  name: string;
  /** The subject's own today and zone (the person whose tables these are), which `recent`, ranges and Hidden read. */
  today: string;
  zone: string;
  /** For money columns with `currency: 'person'`. */
  currency: string;
}

export interface TableListEntry {
  key: string;
  name: string;
  blurb: string;
}
export interface TableListGroup {
  key: TableGroupKey;
  name: string;
  tables: TableListEntry[];
}
export interface TablesListResponse {
  view: TableView;
  subject: TableSubject;
  groups: TableListGroup[];
}

export interface TablePageResponse {
  table: string;
  view: TableView;
  /** The column keys this viewer sees, in order (hidden and, for others, ownerOnly ones left out). */
  columns: string[];
  /** The person's own choices for the columns that name `dynamic` options (and, for the owner, `edit.choices`). */
  options: Record<string, ColumnOption[]>;
  rows: TableRow[];
  page: Page;
  /** Only when the query had count=1. "Page 2 of 7" is Math.ceil(total / size). */
  total?: number;
  /** The query as the server read it (anything unknown dropped). */
  query: TableQuery;
  subject: TableSubject;
}

export interface TableEditRequest {
  id: string;
  column: string;
  value: Cell;
  /** The device's day (YYYY-MM-DD). */
  today: string;
}
export interface TableEditResponse {
  /** The row as it is now, or null when it left this view. */
  row: TableRow | null;
  /** The route replaced the row (one a day logs, the eating check-in): its new id. */
  replacedBy?: string;
  /** The row is gone (a kind of day set back to Follow your week). */
  gone?: boolean;
  /** consentWhole only: the three choices as saved. */
  consent?: Record<string, boolean>;
}

export type TableBulkAction = 'archive' | 'restore' | 'delete';
export interface TableBulkRequest {
  action: TableBulkAction;
  /** At most BULK_MAX. */
  ids: string[];
  today: string;
}
export interface TableBulkResponse {
  done: string[];
  skipped: { id: string; why: string }[];
  /** Not reached in this call (the round-trip budget): send these again. */
  left: string[];
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Limits
// -----------------------------------------------------------------------------------------------------------------------------------

/** "Download all" stops here. */
export const CSV_MAX_ROWS = 5000;
/**
 * And at this many cells, so a wide table holds fewer rows a file (tasks, 23 columns: 1,739): turning 5,000 rows of a wide table into a CSV
 * took 30 to 55 ms of CPU, past the free plan's 10 ms an invocation (2026-11-13).
 */
export const CSV_MAX_CELLS = 40_000;
/** The rows one "Download all" of this table holds at most, for this viewer: CSV_MAX_ROWS, fewer on a wide table (CSV_MAX_CELLS). */
export function csvMaxRows(table: DataTable, view: TableView): number {
  return Math.min(CSV_MAX_ROWS, Math.floor(CSV_MAX_CELLS / Math.max(1, visibleColumns(table, view).length)));
}
/** Ids in one bulk call. */
export const BULK_MAX = 100;
/** Characters of search. */
export const SEARCH_MAX = 80;
export const TABLE_PAGE_SIZES: readonly PageSize[] = PAGE_SIZES;
export const TABLE_DEFAULT_SIZE: PageSize = 10;
/** Ids from a person's own list (a time block, a template, an item): a filter value must look like one. */
export const TABLE_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const KEY_RE = /^[a-z][A-Za-z0-9]{0,39}$/;

// -----------------------------------------------------------------------------------------------------------------------------------
// Words (copied from the barrel's own lists, which this leaf may not import; dataTables.test.ts checks every one still matches)
// -----------------------------------------------------------------------------------------------------------------------------------

function opts(pairs: readonly (readonly [string, string])[], none?: string): ColumnOption[] {
  const out: ColumnOption[] = pairs.map(([value, label]) => ({ value, label }));
  if (none) out.push({ value: 'none', label: none, isNull: true });
  return out;
}
function numberSend(options: readonly ColumnOption[]): Record<string, number | null> {
  return Object.fromEntries(options.map((o) => [o.value, o.isNull ? null : Number(o.value)]));
}

export const PILLAR_OPTIONS: readonly ColumnOption[] = RELATIONSHIPS.map((r) => ({ value: r.key, label: r.name }));
const PILLAR_OR_NONE: readonly ColumnOption[] = [...PILLAR_OPTIONS, { value: 'none', label: 'No pillar', isNull: true }];
export const LIFE_AREA_OPTIONS = opts([['physical', 'Physical'], ['financial', 'Financial'], ['mental', 'Mental'], ['emotional', 'Emotional'], ['spiritual', 'Spiritual']]);
const LIFE_AREA_OR_NONE = [...LIFE_AREA_OPTIONS, { value: 'none', label: 'No area', isNull: true }];
export const PRIORITY_OPTIONS = opts([['0', 'P0 Do now'], ['1', 'P1 Important'], ['2', 'P2 Normal'], ['3', 'P3 Whenever']], 'No priority');
export const OPEN_KIND_OPTIONS = opts([['unfinished', 'Unfinished'], ['unresolved', 'Unresolved'], ['undecided', 'Undecided']], 'None');
const TASK_STATE_OPTIONS = opts([['active', 'Open'], ['done', 'Done'], ['archived', 'Let go']]);
const HABIT_OPTIONS = opts([['auto', 'If it repeats'], ['yes', 'Yes'], ['no', 'No']]);
const HIDDEN_OPTIONS = opts([['shown', 'Shown'], ['tomorrow', 'Until tomorrow'], ['always', 'Until I unhide it']]);
const MADE_BY_OPTIONS = opts([['you', 'You'], ['build', 'From pillar'], ['breakdown', 'A content day'], ['coach', 'From your coach']]);
export const LAYER_OPTIONS = opts([['pillar', 'Foundation'], ['principle', 'Guiding principle'], ['value_goal', 'Value goal'], ['outcome', 'Goal outcome'], ['project', 'Project']]);
const LAYER_STATE_OPTIONS = opts([['active', 'Open'], ['done', 'Done']]);
export const PERIOD_OPTIONS = opts([['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['quarter', 'Quarter'], ['half', 'Half year'], ['year', 'Year']]);
export const MAP_LEVEL_OPTIONS = opts([
  ['540', 'Oneness'], ['500', 'Inner love'], ['440', 'Inner wisdom'], ['400', 'Inner light'], ['350', 'Acceptance'], ['310', 'Willingness'],
  ['250', 'Neutrality'], ['200', 'Courage'], ['175', 'Pride'], ['150', 'Anger'], ['125', 'Desire'], ['100', 'Fear'], ['75', 'Grief'],
  ['50', 'Apathy'], ['30', 'Guilt'], ['20', 'Shame'],
]);
export const MAP_BAND_OPTIONS = opts([['realization', 'At ease'], ['empowerment', 'Owning it'], ['victim', 'Stuck']]);
const ASSESSMENT_KIND_OPTIONS = opts([['onboard', 'Strategy session'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['biannual', 'Half-yearly']]);
const DAY_TYPE_OPTIONS = opts([['general', 'Normal day'], ['exceptional', 'Exceptional day']]);
export const PENALTY_OPTIONS = opts([['streak', 'The streak breaks'], ['unlock', 'Unlocks wait'], ['roster', 'The coach sees it']]);
export const MOOD_OPTIONS = opts([['1', 'Low'], ['2', 'Sad'], ['3', 'Neutral'], ['4', 'Happy'], ['5', 'Overjoyed']]);
const MOOD_OR_NONE = [...MOOD_OPTIONS, { value: 'none', label: 'Not said', isNull: true }];
export const STRESS_OPTIONS = opts([['1', 'Calm'], ['2', 'Fine'], ['3', 'Tense'], ['4', 'Stressed'], ['5', 'Overwhelmed']]);
const STRESS_OR_NONE = [...STRESS_OPTIONS, { value: 'none', label: 'Not said', isNull: true }];
export const STRESSOR_OPTIONS = opts([['Work', 'Work'], ['Money', 'Money'], ['Family', 'Family'], ['Health', 'Health'], ['Loneliness', 'Loneliness'], ['Relationship', 'Relationship'], ['Sleep', 'Sleep'], ['Something else', 'Something else']]);
/** Sleep.tsx's QUALITY, by position. */
export const SLEEP_QUALITY_OPTIONS = opts([['1', 'Rough'], ['2', 'Light'], ['3', 'Okay'], ['4', 'Good'], ['5', 'Deep']], 'Not said');
export const MOVE_KIND_OPTIONS = opts([['run', 'Run'], ['walk', 'Walk'], ['cycle', 'Cycle'], ['swim', 'Swim'], ['yoga', 'Yoga'], ['gym', 'Gym'], ['sport', 'Sport'], ['other', 'Other']]);
export const EFFORT_OPTIONS = opts([['1', 'Easy'], ['2', 'Light'], ['3', 'Steady'], ['4', 'Hard'], ['5', 'All out']], 'Not said');
const MINDFUL_FROM_OPTIONS = [...opts([['focus', 'A focus round'], ['break', 'A break'], ['breathe', 'Breathing']]), { value: 'none', label: 'Logged by hand', isNull: true }];
const LOGGED_BY_OPTIONS = [...opts([['run', 'A club run']]), { value: 'none', label: 'You', isNull: true }];
export const EAT_PACKAGED_OPTIONS = opts([['0', 'None'], ['1', 'Some'], ['2', 'A lot']], 'Not said');
export const EAT_FULLNESS_OPTIONS = opts([['0', 'Still hungry'], ['1', 'Just right'], ['2', 'Too full or sluggish']], 'Not said');
export const FOCUS_QUALITY_OPTIONS = opts([['1', 'Scattered'], ['2', 'Drifting'], ['3', 'Steady'], ['4', 'Focused'], ['5', 'Deep']], 'Not rated');
const FOCUS_MODE_OPTIONS = opts([['timer', 'Timer'], ['pomodoro', 'Pomodoro'], ['stopwatch', 'Stopwatch'], ['manual', 'Added later']], 'Not recorded');
export const SUPPLEMENT_KIND_OPTIONS = opts([['vitamin', 'Vitamin'], ['mineral', 'Mineral'], ['protein', 'Protein'], ['omega3', 'Omega-3 or fish oil'], ['herbal', 'Herb or Ayurvedic'], ['probiotic', 'Probiotic'], ['nootropic', 'Nootropic'], ['other', 'Other']]);
export const SUPPLEMENT_TIME_OPTIONS = opts([['morning', 'Morning'], ['meal', 'With a meal'], ['evening', 'Evening'], ['night', 'Night']]);
export const CURRENCY_OPTIONS = opts([['INR', 'INR'], ['USD', 'USD'], ['EUR', 'EUR'], ['GBP', 'GBP'], ['AED', 'AED'], ['AUD', 'AUD'], ['CAD', 'CAD'], ['SGD', 'SGD']]);
export const INCOME_CATEGORY_OPTIONS = opts([['Brand deal', 'Brand deal'], ['Content reward', 'Content reward'], ['Courses', 'Courses'], ['Products', 'Products'], ['Sessions', 'Sessions'], ['Affiliate', 'Affiliate'], ['Ad revenue', 'Ad revenue'], ['Other income', 'Other income']]);
export const EXPENSE_CATEGORY_OPTIONS = opts([['Equipment', 'Equipment'], ['Software', 'Software'], ['Travel', 'Travel'], ['Team', 'Team'], ['Marketing', 'Marketing'], ['Fees', 'Fees'], ['Taxes', 'Taxes'], ['Other expense', 'Other expense']]);
const CATEGORY_OPTIONS = [...INCOME_CATEGORY_OPTIONS, ...EXPENSE_CATEGORY_OPTIONS];
const IN_OUT_OPTIONS = opts([['income', 'Money in'], ['expense', 'Money out']]);
const MONEY_SOURCE_OPTIONS = opts([['manual', 'Typed in'], ['invoice', 'An invoice paid'], ['due', 'A due settled'], ['recurring', 'A monthly entry']]);
export const XP_SOURCE_OPTIONS = opts([
  ['task', 'Task ticked'], ['task_capped', 'Task ticked past the day’s cap'], ['task_undo', 'Task unticked'], ['project_clear', 'Project cleared'],
  ['project_reopen', 'Project opened again'], ['checkin', 'Daily check-in'], ['spark', 'Small act'], ['not_to_do', 'Not to do kept'],
  ['attendee', 'Event code'], ['run', 'Club run'], ['run:void', 'Club run taken back'], ['admin', 'Given by the team'], ['social:post', 'A post'],
  ['social:reply', 'A reply'], ['social:like', 'A like you gave'], ['invite', 'Someone you invited'], ['connect', 'A connection the team made'], ['done', 'Layer cleared'],
]);
export const POINTS_REASON_OPTIONS = opts([
  ['checkin', 'Daily check-in'], ['streak_bonus', 'Streak bonus'], ['purchase', 'Bought something'], ['sale', 'A sale'], ['affiliate', 'Affiliate share'],
  ['refund', 'Refund'], ['refund_out', 'Refunded to a buyer'], ['ticket', 'Event ticket'], ['enrollment', 'Program enrolment'], ['redeem', 'Reward redeemed'],
  ['feature', 'Featured spot'], ['bounty', 'Content reward'], ['run', 'Club run'], ['run:void', 'Club run taken back'], ['admin', 'From the team'],
  ['invite', 'Someone joined with your invite'], ['connect', 'A connection'], ['social:liked', 'A like on your post'], ['social:follower', 'A new follower'],
]);
const CREDIT_REASON_OPTIONS = opts([['plan', 'Plan credits'], ['topup', 'Top-up'], ['admin', 'From the team'], ['usage', 'Used'], ['expire', 'Ran out with the plan']]);
const CREDIT_BUCKET_OPTIONS = opts([['plan', 'Plan credits'], ['extra', 'Extra credits']]);
export const AGENT_OPTIONS = opts([['assistant', 'Assistant'], ['feelings', 'Feelings reader'], ['companion', 'Companion']], 'None');
const DUE_DIRECTION_OPTIONS = opts([['owed', 'Owed to you'], ['owe', 'You owe']]);
const DUE_REPEAT_OPTIONS = opts([['none', 'Once'], ['monthly', 'Every month']]);
const DUE_STATE_OPTIONS = opts([['open', 'Open'], ['settled', 'Settled']]);
const GOAL_KIND_OPTIONS = opts([['save', 'Put money aside'], ['earn', 'Count money in']]);
export const PRODUCT_KIND_OPTIONS = opts([['digital', 'Download'], ['course', 'Course'], ['membership', 'Membership'], ['session', 'Session'], ['event', 'Event'], ['link', 'Link'], ['payment', 'Payment link'], ['bundle', 'Bundle'], ['locked', 'Locked post'], ['dm', 'Priority DM']]);
const ORDER_STATE_OPTIONS = opts([['paid', 'Paid'], ['test', 'Test, nothing charged'], ['pending', 'Waiting for payment'], ['failed', 'Payment failed'], ['expired', 'Ran out before paying'], ['refunded', 'Refunded']]);
const PAID_WITH_OPTIONS = opts([['points', 'Points'], ['test', 'Test'], ['razorpay', 'Razorpay (UPI, card or bank)']]);
const ENROL_STATE_OPTIONS = opts([['enrolled', 'In it'], ['completed', 'Completed'], ['withdrawn', 'Left']]);
const ENROL_PAYMENT_OPTIONS = opts([['free', 'Free'], ['paid', 'Paid'], ['test', 'Test payment'], ['pending', 'Payment pending']]);
const HAND_IN_STATE_OPTIONS = opts([['submitted', 'Waiting for feedback'], ['changes', 'Changes asked'], ['approved', 'Approved']]);
const FRIEND_STATE_OPTIONS = opts([['friends', 'Friends'], ['sent', 'You asked'], ['pending', 'Asked you']]);
export const POST_CATEGORY_OPTIONS = opts([['Self care', 'Self care'], ['Mindfulness', 'Mindfulness'], ['Stories', 'Stories'], ['Support', 'Support'], ['Creative', 'Creative'], ['Learning', 'Learning'], ['Stress', 'Stress'], ['Affirmation', 'Affirmation'], ['Awareness', 'Awareness']]);
const REPLY_DEPTH_OPTIONS = opts([['0', 'The post'], ['1', 'A reply'], ['2', 'A reply, level 2'], ['3', 'A reply, level 3'], ['4', 'A reply, level 4']]);
export const BADGE_FAMILY_OPTIONS = opts([['Daily habits', 'Daily habits'], ['Pillars', 'Pillars'], ['Focus', 'Focus'], ['Reflection', 'Reflection'], ['Community', 'Community'], ['Creator', 'Creator'], ['Money', 'Money'], ['Fitness', 'Fitness'], ['Learning', 'Learning'], ['Milestones', 'Milestones']]);
const BADGE_TIER_OPTIONS = opts([['bronze', 'Bronze'], ['silver', 'Silver'], ['gold', 'Gold'], ['platinum', 'Platinum']]);
const BADGE_HOW_OPTIONS = opts([['earned', 'Earned'], ['given', 'Given by the team']]);
export const CONSENT_OPTIONS = opts([['attribution', 'Remember which link brought me'], ['embeds', 'Show videos from YouTube and Vimeo'], ['marketing', 'Send me news and offers by email']]);
export const TIME_BLOCK_SWATCH_OPTIONS = opts([['amber', 'Amber'], ['orange', 'Orange'], ['vermilion', 'Vermilion'], ['red', 'Red'], ['magenta', 'Magenta'], ['purple', 'Purple'], ['indigo', 'Indigo'], ['blue', 'Blue'], ['teal', 'Teal'], ['green', 'Green'], ['lime', 'Lime']]);
/** The inbox's tabs and the kinds each holds (INBOX_TAB_META without Everything). */
export const INBOX_TAB_KINDS: readonly (readonly [string, string, readonly string[]])[] = [
  ['replies', 'Replies and mentions', ['reply', 'mention', 'dm', 'support', 'moderation']],
  ['following', 'Following', ['thread', 'follow', 'broadcast', 'sequence', 'season']],
  ['reminders', 'Reminders', ['reminder']],
  ['events', 'Events', ['party', 'circle', 'run', 'event']],
  ['friends', 'Friends', ['bond']],
  ['work', 'Work', ['work', 'campaign', 'org', 'collab', 'win', 'club', 'tv', 'fund']],
  ['shop', 'Shop and money', ['order', 'booking', 'refund', 'lead', 'affiliate', 'review', 'certificate', 'store', 'kyc', 'invoice']],
  ['learning', 'School and coaching', ['school', 'invite', 'coach']],
  ['agency', 'Agency', ['agency']],
  ['team', 'Team', ['team']],
];
const INBOX_TAB_OPTIONS = INBOX_TAB_KINDS.map(([value, label]) => ({ value, label }));
const INBOX_TAB_SQL = `CASE t.kind ${INBOX_TAB_KINDS.flatMap(([tab, , kinds]) => kinds.map((k) => `WHEN '${k}' THEN '${tab}'`)).join(' ')} END`;
/** The routine's other blocks (session.ts BLOCK_KEYS without the morning), by the names the routine gives them. */
export const ROUTINE_BLOCK_WORDS: Readonly<Record<string, string>> = byKey([
  ['morning', 'Morning routine'], ['nutrition', 'Food and water'], ['work', 'Work'], ['skills', 'Learning and reflection'], ['social', 'People'], ['sleep', 'Lights out'],
]);

const DELETED = "'Deleted member'";
/**
 * A coach's view of a student's friends and follows: nobody with a block by name either way between them and the coach (`{viewer}`), as
 * blockedByName in db.ts. A block by name works both ways on everything with a name on it, a third person's table too.
 */
const NOT_BLOCKED_WITH_VIEWER =
  'NOT EXISTS (SELECT 1 FROM blocks bn WHERE bn.by_name = 1 AND ((bn.blocker_id = u.id AND bn.blocked_id = {viewer}) OR (bn.blocker_id = {viewer} AND bn.blocked_id = u.id)))';

// -----------------------------------------------------------------------------------------------------------------------------------
// Small builders for the registry (functions, so the constants below may call them)
// -----------------------------------------------------------------------------------------------------------------------------------

type ColumnMore = Partial<Omit<DataColumn, 'key' | 'label' | 'kind' | 'sql'>>;
function c(key: string, label: string, kind: ColumnKind, sql: string | null, more: ColumnMore = {}): DataColumn {
  return { key, label, kind, sql, ...more };
}
/** When it was added or written: a sortable, range-filtered instant that is never null. */
function stamp(key: string, label: string, sql: string, more: ColumnMore = {}): DataColumn {
  return c(key, label, 'datetime', sql, { sortable: true, filter: 'range', notNull: true, ...more });
}
function day(key: string, label: string, sql: string, more: ColumnMore = {}): DataColumn {
  return c(key, label, 'date', sql, { sortable: true, filter: 'range', notNull: true, ...more });
}
function pillar(key: string, label: string, sql: string, more: ColumnMore = {}): DataColumn {
  return c(key, label, 'enum', sql, { options: PILLAR_OPTIONS, ordered: true, sortable: true, filter: 'pick', ...more });
}
function hiddenCell(key: string, sql: string): DataColumn {
  return c(key, key, 'text', sql, { hidden: true });
}
/** An edit through PATCH `path` with one plain body field. */
function patch(path: string, field: string, input: EditInput, more: Partial<ColumnEdit> = {}): ColumnEdit {
  return { method: 'PATCH', path, field, input, ...more };
}

const NODE_PATH = '/nodes/:id';

// -----------------------------------------------------------------------------------------------------------------------------------
// The groups and the tables
// -----------------------------------------------------------------------------------------------------------------------------------

export const DATA_TABLE_GROUPS: readonly { key: TableGroupKey; name: string; blurb: string }[] = [
  { key: 'daily', name: 'Daily', blurb: 'Tasks, your not to do list, reminders and the shape of your days.' },
  { key: 'pillars', name: 'Pillars', blurb: 'Your pyramids, scores, xp, life map and routine.' },
  { key: 'reviews', name: 'Reviews', blurb: 'The reviews you wrote, their reminders and your own templates.' },
  { key: 'body', name: 'Body and mind', blurb: 'Mood, sleep, stress, movement, eating, water, focus and supplements.' },
  { key: 'journal', name: 'Journal', blurb: 'Your entries and your gratitude.' },
  { key: 'money', name: 'Money', blurb: 'Money in and out, budgets, dues, goals, points, credits and orders.' },
  { key: 'learning', name: 'Learning', blurb: 'Programs, lessons, hand-ins, quizzes and certificates.' },
  { key: 'people', name: 'People', blurb: 'Friends, follows, your posts and replies, and notes from your coach.' },
  { key: 'account', name: 'Account', blurb: 'Badges, your inbox and your privacy choices.' },
];

const TASK_HIDDEN_SQL = "CASE WHEN t.hidden_until IS NULL OR t.hidden_until < {today} THEN 'shown' WHEN t.hidden_until = '9999-12-31' THEN 'always' ELSE 'tomorrow' END";
const TASK_MADE_BY_SQL = "CASE WHEN t.added_by IS NOT NULL THEN 'coach' WHEN t.origin = 'build' THEN 'build' WHEN t.origin LIKE 'breakdown:%' THEN 'breakdown' ELSE 'you' END";
const TASK_HABIT_SQL = "CASE WHEN t.habit IS NULL THEN 'auto' WHEN t.habit = 1 THEN 'yes' ELSE 'no' END";
const ONE_A_DAY_NOTE = 'Saving logs this day again, with the same date.';

const TASKS: DataTable = {
  key: 'tasks',
  name: 'Tasks',
  blurb: 'Every task you made, open, done or let go.',
  group: 'daily',
  sqlTable: 'nodes',
  from: 'nodes t LEFT JOIN nodes p ON p.id = t.parent_id AND p.user_id = t.user_id',
  owner: 't.user_id = ?1',
  where: "t.kind = 'task'",
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  privateSelect: { repeat: 't.repeat_json' },
  archive: {
    activeWhere: "t.status IN ('active', 'done')",
    archivedWhere: "t.status = 'archived'",
    archive: { method: 'PATCH', path: NODE_PATH, body: { status: 'archived' } },
    restore: { method: 'PATCH', path: NODE_PATH, body: { status: 'active' } },
    // The route deletes only a task still in the archive when it is asked with ?archived=1 (409 otherwise), so one restored in another tab
    // between the bulk route's check and this call stays.
    remove: { method: 'DELETE', path: '/nodes/:id?archived=1' },
    only: { where: "t.status = 'active'", why: 'A done task stays as it is.' },
  },
  columns: [
    c('title', 'Task', 'text', 't.title', { sortable: true, searchable: true, notNull: true, edit: patch(NODE_PATH, 'title', 'text', { minLength: 1, maxLength: 140, note: 'A new name starts the ten-minute wait again.' }) }),
    c('note', 'Note', 'longtext', 't.note', { searchable: true, edit: patch(NODE_PATH, 'note', 'longtext', { maxLength: 500 }) }),
    pillar('pillar', 'Pillar', 't.relationship'),
    c('project', 'Project', 'text', 'p.title', { sortable: true, searchable: true, edit: patch(NODE_PATH, 'parentId', 'select', { choices: 'projects', current: 'parentId', when: 'open', note: 'It takes the project’s pillar.' }) }),
    hiddenCell('parentId', 't.parent_id'),
    c('status', 'State', 'enum', 't.status', { options: TASK_STATE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('doDate', 'Do date', 'date', 't.do_date', { sortable: true, filter: 'range', edit: patch(NODE_PATH, 'doDate', 'date', { nullable: true }) }),
    c('dueDate', 'Due date', 'date', 't.due_date', { sortable: true, filter: 'range', edit: patch(NODE_PATH, 'dueDate', 'date', { nullable: true }) }),
    c('dueTime', 'Time', 'time', 't.due_time', { sortable: true, edit: patch(NODE_PATH, 'dueTime', 'time', { nullable: true }) }),
    c('estimate', 'Minutes it should take', 'number', 't.estimate_min', { sortable: true, format: 'minutes', edit: patch(NODE_PATH, 'estimateMin', 'number', { min: 1, max: 600, step: 1, nullable: true }) }),
    c('priority', 'Priority', 'enum', 't.priority', { options: PRIORITY_OPTIONS, ordered: true, sortable: true, filter: 'pick', edit: patch(NODE_PATH, 'priority', 'select', { send: numberSend(PRIORITY_OPTIONS) }) }),
    c('repeat', 'Repeats', 'summary', null, { derive: 'repeatWords', from: ['repeat'] }),
    c('remember', 'Remember', 'bool', 't.remind', { sortable: true, filter: 'pick', edit: patch(NODE_PATH, 'remind', 'toggle') }),
    c('forReview', 'Bring to my review', 'bool', 't.for_review', { sortable: true, filter: 'pick', edit: patch(NODE_PATH, 'forReview', 'toggle') }),
    c('habit', 'Habit', 'enum', TASK_HABIT_SQL, { options: HABIT_OPTIONS, filter: 'pick', notNull: true, edit: patch(NODE_PATH, 'habit', 'select', { send: { auto: null, yes: true, no: false } }) }),
    c('lifeArea', 'Area of life', 'enum', 't.life_area', { options: LIFE_AREA_OR_NONE, ordered: true, sortable: true, filter: 'pick', edit: patch(NODE_PATH, 'lifeArea', 'select', { send: { none: null } }) }),
    c('openKind', 'Bottleneck', 'enum', 't.open_kind', { options: OPEN_KIND_OPTIONS, ordered: true, sortable: true, filter: 'pick', edit: patch(NODE_PATH, 'openKind', 'select', { send: { none: null } }) }),
    c('timeBlock', 'Time block', 'enum', 't.time_block_id', { dynamic: 'timeBlocks', filter: 'pick', edit: patch(NODE_PATH, 'timeBlockId', 'select', { choices: 'timeBlocks', nullable: true, clearLabel: 'No block' }) }),
    c('hidden', 'Hidden', 'enum', TASK_HIDDEN_SQL, { options: HIDDEN_OPTIONS, filter: 'pick', notNull: true, edit: { method: 'PATCH', path: NODE_PATH, field: 'hide', input: 'select', recipe: 'withToday', when: 'open', send: { shown: null, tomorrow: 'tomorrow', always: 'always' } } }),
    c('madeBy', 'Made by', 'enum', TASK_MADE_BY_SQL, { options: MADE_BY_OPTIONS, filter: 'pick', notNull: true }),
    c('completedAt', 'Done at', 'datetime', 't.completed_at', { sortable: true, filter: 'range' }),
    c('xp', 'Xp earned', 'number', 't.xp', { sortable: true, notNull: true }),
    stamp('createdAt', 'Added', 't.created_at'),
    stamp('updatedAt', 'Changed', 't.updated_at', { filter: undefined }),
  ],
};

const SUBTASKS: DataTable = {
  key: 'subtasks',
  name: 'Subtasks',
  blurb: 'The checklists inside your tasks.',
  group: 'daily',
  sqlTable: 'subtasks',
  from: 'subtasks t LEFT JOIN nodes n ON n.id = t.task_id AND n.user_id = t.user_id',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  columns: [
    c('title', 'Subtask', 'text', 't.title', { sortable: true, searchable: true, notNull: true, edit: patch('/nodes/subtasks/:id', 'title', 'text', { minLength: 1, maxLength: 140 }) }),
    c('task', 'Task', 'text', 'n.title', { sortable: true, searchable: true }),
    c('done', 'Done', 'bool', 't.done_at IS NOT NULL', { filter: 'pick', notNull: true, edit: patch('/nodes/subtasks/:id', 'done', 'toggle') }),
    c('doneAt', 'Done at', 'datetime', 't.done_at', { sortable: true }),
    stamp('createdAt', 'Added', 't.created_at'),
  ],
};

const NOT_TO_DO: DataTable = {
  key: 'notToDo',
  name: 'Not to do',
  blurb: 'The things you stay away from, with each one’s streak.',
  group: 'daily',
  sqlTable: 'not_to_do',
  from: 'not_to_do t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'asc' },
  read: 'memory',
  reader: 'notToDo',
  memoryMax: 7,
  readOnlyWhy: 'Add, mark or remove these on Daily.',
  columns: [
    c('title', 'Stay away from', 'text', null, { sortable: true, searchable: true }),
    c('pillar', 'Pillar', 'enum', null, { options: PILLAR_OR_NONE, ordered: true, sortable: true, filter: 'pick' }),
    c('streak', 'Streak now', 'number', null, { sortable: true }),
    c('bestStreak', 'Best streak', 'number', null, { sortable: true }),
    c('createdAt', 'Added', 'datetime', null, { sortable: true, filter: 'range' }),
  ],
};

const NOT_TO_DO_DAYS: DataTable = {
  key: 'notToDoDays',
  name: 'Not to do days',
  blurb: 'Each day you marked an item kept or slipped.',
  group: 'daily',
  sqlTable: 'not_to_do_days',
  from: 'not_to_do_days t LEFT JOIN not_to_do i ON i.id = t.item_id AND i.user_id = t.user_id',
  owner: 't.user_id = ?1',
  idSql: "t.item_id || ':' || t.day",
  defaultSort: { key: 'day', dir: 'desc' },
  read: 'sql',
  dayCell: 'day',
  columns: [
    c('item', 'Item', 'text', 'i.title', { sortable: true, searchable: true }),
    c('itemId', 'Which item', 'enum', 't.item_id', { dynamic: 'notToDoItems', filter: 'pick', hidden: true }),
    day('day', 'Day', 't.day'),
    c('status', 'Kept or slipped', 'enum', 't.status', {
      options: opts([['kept', 'Kept'], ['slipped', 'Slipped']]),
      sortable: true,
      filter: 'pick',
      notNull: true,
      edit: { method: 'POST', path: '/today/not-to-do/:id/day', param: 'itemId', field: 'status', input: 'select', recipe: 'notToDoDay', when: 'recent', note: 'A kept day pays its xp once.' },
    }),
    stamp('createdAt', 'First marked', 't.created_at'),
  ],
};

const SMALL_ACTS: DataTable = {
  key: 'smallActs',
  name: 'Small acts',
  blurb: 'The small act you did each day, and the pillar it went to.',
  group: 'daily',
  sqlTable: 'spark_completions',
  from: 'spark_completions t',
  owner: 't.user_id = ?1',
  idSql: 't.date',
  defaultSort: { key: 'day', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A small act paid its xp when you did it, so it stays as it is.',
  columns: [day('day', 'Day', 't.date'), pillar('pillar', 'Pillar it went to', 't.relationship'), stamp('createdAt', 'Done at', 't.created_at', { filter: undefined })],
};

const REMINDERS: DataTable = {
  key: 'reminders',
  name: 'Reminders',
  blurb: 'Your own reminders: a line, a time and the days.',
  group: 'daily',
  sqlTable: 'custom_reminders',
  from: 'custom_reminders t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'time', dir: 'asc' },
  read: 'sql',
  privateSelect: { days: 't.days_json' },
  columns: [
    c('title', 'Reminder', 'text', 't.title', { sortable: true, searchable: true, notNull: true, edit: patch('/reminders/custom/:id', 'title', 'text', { minLength: 1, maxLength: 60 }) }),
    c('time', 'Time', 'time', 't.time', { sortable: true, notNull: true, edit: patch('/reminders/custom/:id', 'time', 'time') }),
    c('days', 'Days', 'summary', null, { derive: 'weekdays', from: ['days'] }),
    c('enabled', 'On', 'bool', 't.enabled', { sortable: true, filter: 'pick', notNull: true, edit: patch('/reminders/custom/:id', 'enabled', 'toggle', { note: 'Off pauses it.' }) }),
    c('lastSent', 'Last sent', 'date', 't.last_sent_day', { sortable: true }),
    stamp('createdAt', 'Added', 't.created_at', { filter: undefined }),
  ],
};

const KINDS_OF_DAY: DataTable = {
  key: 'kindsOfDay',
  name: 'Kinds of day',
  blurb: 'The days you set to a kind of day by hand.',
  group: 'daily',
  sqlTable: 'day_types',
  from: 'day_types t',
  owner: 't.user_id = ?1',
  idSql: 't.day',
  defaultSort: { key: 'day', dir: 'desc' },
  read: 'sql',
  privateSelect: { oldKind: 't.kind' },
  columns: [
    day('day', 'Day', 't.day'),
    c('kindOfDay', 'Kind of day', 'enum', 't.template_id', {
      dynamic: 'dayTemplates',
      derive: 'kindOfDay',
      from: ['oldKind'],
      filter: 'pick',
      edit: { method: 'PUT', path: '/time-blocks/days', field: 'templateId', input: 'select', recipe: 'kindOfDay', choices: 'dayTemplates', nullable: true, clearLabel: 'Follow your week', gone: true },
    }),
    stamp('createdAt', 'Set on', 't.created_at', { filter: undefined }),
  ],
};

const TIME_BLOCKS: DataTable = {
  key: 'timeBlocks',
  name: 'Time blocks',
  blurb: 'The blocks your days are made of.',
  group: 'daily',
  sqlTable: 'time_blocks',
  from: 'time_blocks t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'order', dir: 'asc' },
  read: 'memory',
  reader: 'timeBlocks',
  memoryMax: 24,
  columns: [
    c('name', 'Block', 'text', null, { sortable: true, searchable: true, edit: patch('/time-blocks/blocks/:id', 'name', 'text', { minLength: 1, maxLength: 40 }) }),
    c('tag', 'Tag', 'text', null, { sortable: true, searchable: true, edit: patch('/time-blocks/blocks/:id', 'tag', 'text', { maxLength: 24 }) }),
    c('color', 'Colour', 'enum', null, { options: TIME_BLOCK_SWATCH_OPTIONS, otherLabel: 'Your own colour' }),
    c('lifeArea', 'Area of life', 'enum', null, { options: LIFE_AREA_OR_NONE, ordered: true, sortable: true, filter: 'pick', edit: patch('/time-blocks/blocks/:id', 'area', 'select', { send: { none: null } }) }),
    c('pillar', 'Pillar', 'enum', null, { options: PILLAR_OR_NONE, ordered: true, sortable: true, filter: 'pick', edit: patch('/time-blocks/blocks/:id', 'pillar', 'select', { send: { none: null } }) }),
    c('starting', 'Starting block', 'bool', null, { filter: 'pick' }),
    c('order', 'Order', 'number', null, { sortable: true, hidden: true }),
    c('updatedAt', 'Changed', 'datetime', null, { sortable: true }),
  ],
};

const DAY_TEMPLATES: DataTable = {
  key: 'dayTemplates',
  name: 'Day templates',
  blurb: 'Your kinds of day and the blocks in each.',
  group: 'daily',
  sqlTable: 'day_templates',
  from: 'day_templates t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'order', dir: 'asc' },
  read: 'memory',
  reader: 'dayTemplates',
  memoryMax: 24,
  columns: [
    c('name', 'Kind of day', 'text', null, { sortable: true, searchable: true, edit: patch('/time-blocks/templates/:id', 'name', 'text', { minLength: 1, maxLength: 40 }) }),
    c('lead', 'Leads with', 'enum', null, { options: PILLAR_OPTIONS, ordered: true, sortable: true, filter: 'pick', edit: patch('/time-blocks/templates/:id', 'lead', 'select') }),
    c('second', 'Then', 'enum', null, { options: PILLAR_OR_NONE, ordered: true, sortable: true, filter: 'pick', edit: patch('/time-blocks/templates/:id', 'second', 'select', { send: { none: null } }) }),
    c('slots', 'Blocks', 'summary', null, { searchable: true }),
    c('weekdays', 'Weekdays', 'summary', null),
    c('isDefault', 'Default', 'bool', null, { filter: 'pick' }),
    c('why', 'Why', 'longtext', null, { searchable: true }),
    c('source', 'From', 'text', null),
    c('order', 'Order', 'number', null, { sortable: true, hidden: true }),
    c('updatedAt', 'Changed', 'datetime', null, { sortable: true }),
  ],
};

const PYRAMIDS: DataTable = {
  key: 'pyramids',
  name: 'Pyramids',
  blurb: 'Every layer of your seven pyramids, from foundation to project.',
  group: 'pillars',
  sqlTable: 'nodes',
  from: 'nodes t LEFT JOIN nodes p ON p.id = t.parent_id AND p.user_id = t.user_id',
  owner: 't.user_id = ?1',
  where: "t.kind IN ('pillar', 'principle', 'value_goal', 'outcome', 'project') AND t.status != 'archived'",
  idSql: 't.id',
  defaultSort: { key: 'pillar', dir: 'asc' },
  read: 'sql',
  columns: [
    pillar('pillar', 'Pillar', 't.relationship', { notNull: true }),
    c('layer', 'Layer', 'enum', 't.kind', { options: LAYER_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('title', 'Words', 'text', 't.title', { sortable: true, searchable: true, notNull: true, edit: patch(NODE_PATH, 'title', 'text', { minLength: 1, maxLength: 140 }) }),
    c('note', 'Note', 'longtext', 't.note', { searchable: true, edit: patch(NODE_PATH, 'note', 'longtext', { maxLength: 500 }) }),
    c('sitsUnder', 'Sits under', 'text', 'p.title', { sortable: true }),
    c('status', 'State', 'enum', 't.status', { options: LAYER_STATE_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('dueBy', 'Due by', 'date', 't.due_date', { sortable: true, filter: 'range', edit: patch(NODE_PATH, 'dueDate', 'date', { nullable: true, when: 'project', note: 'Projects only: it sets the pace.' }) }),
    c('xp', 'Xp', 'number', 't.xp', { sortable: true, notNull: true }),
    c('completedAt', 'Done at', 'datetime', 't.completed_at', { sortable: true }),
    stamp('createdAt', 'Added', 't.created_at'),
  ],
};

const PILLAR_SCORES: DataTable = {
  key: 'pillarScores',
  name: 'Pillar scores',
  blurb: 'Each pillar’s vibe check score and the xp it earned.',
  group: 'pillars',
  sqlTable: 'relationship_scores',
  from: 'relationship_scores t',
  owner: 't.user_id = ?1',
  idSql: 't.relationship',
  defaultSort: { key: 'pillar', dir: 'asc' },
  read: 'sql',
  readOnlyWhy: 'The vibe check sets the score, and ticks earn the xp.',
  columns: [pillar('pillar', 'Pillar', 't.relationship', { filter: undefined, notNull: true }), c('score', 'Vibe check score', 'number', 't.score', { sortable: true }), c('xp', 'Pillar xp', 'number', 't.xp', { sortable: true })],
};

const XP_HISTORY: DataTable = {
  key: 'xpHistory',
  name: 'Xp history',
  blurb: 'Every time you earned xp, or it was taken back.',
  group: 'pillars',
  sqlTable: 'xp_events',
  from: 'xp_events t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  // A post's, a reply's or a like's xp lands at the moment it was written: its time would say who wrote an anonymous line, so a coach never gets one.
  coachWhere: "t.source NOT LIKE 'social:%'",
  readOnlyWhy: 'A record of what was paid, so it stays as it is.',
  columns: [
    c('amount', 'Xp', 'number', 't.amount', { sortable: true, notNull: true, format: 'signed' }),
    c('source', 'From', 'enum', 't.source', { options: XP_SOURCE_OPTIONS, otherLabel: 'Other', sortable: true, filter: 'pick', notNull: true }),
    pillar('pillar', 'Pillar', 't.relationship', { options: PILLAR_OR_NONE }),
    stamp('createdAt', 'When', 't.created_at'),
  ],
};

const LIFE_MAP: DataTable = {
  key: 'lifeMap',
  name: 'Life map',
  blurb: 'Where each pillar sat on the map, each time you placed it.',
  group: 'pillars',
  sqlTable: 'placements',
  from: 'placements t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Place your pillars again in the strategy session.',
  columns: [
    pillar('pillar', 'Pillar', 't.relationship', { notNull: true }),
    c('core', 'Where you usually live', 'enum', 't.core_level', { options: MAP_LEVEL_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('floor', 'Where you drop under stress', 'enum', 't.floor_level', { options: MAP_LEVEL_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('coreBand', 'Usual band', 'enum', 't.core_band', { options: MAP_BAND_OPTIONS, ordered: true, sortable: true, filter: 'pick' }),
    c('floorBand', 'Band under stress', 'enum', 't.floor_band', { options: MAP_BAND_OPTIONS, ordered: true, sortable: true, filter: 'pick' }),
    c('evidence', 'Your evidence', 'longtext', 't.evidence', { searchable: true }),
    stamp('createdAt', 'Placed on', 't.created_at'),
  ],
};

const LIFE_MAP_ANSWERS: DataTable = {
  key: 'lifeMapAnswers',
  name: 'Life map answers',
  blurb: 'Your focus, fears, scorecard and real day from each strategy session.',
  group: 'pillars',
  sqlTable: 'assessments',
  from: 'assessments t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  privateSelect: { focus: 't.focus_json', away: 't.away_json', fears: 't.fears_json', insecurities: 't.insecurities_json', scores: 't.scores_json', realDay: 't.real_day_json' },
  readOnlyWhy: 'Run the strategy session again to change these.',
  columns: [
    c('kind', 'Kind', 'enum', 't.kind', { options: ASSESSMENT_KIND_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('focus', 'Focus', 'summary', null, { derive: 'pillarList', from: ['focus'] }),
    c('away', 'Set aside', 'summary', null, { derive: 'pillarList', from: ['away'] }),
    c('fears', 'Fears', 'summary', null, { derive: 'fears', from: ['fears'], searchable: true, searchSql: 't.fears_json' }),
    c('insecurities', 'Insecurities', 'summary', null, { derive: 'insecurities', from: ['insecurities'], searchable: true, searchSql: 't.insecurities_json' }),
    c('scorecard', 'Scorecard', 'summary', null, { derive: 'scorecard', from: ['scores'] }),
    c('realDay', 'Your real day', 'summary', null, { derive: 'realDay', from: ['realDay'] }),
    stamp('createdAt', 'Made on', 't.created_at'),
  ],
};

const ROUTINE: DataTable = {
  key: 'routine',
  name: 'Routine',
  blurb: 'Each routine your plans made, the newest one live.',
  group: 'pillars',
  sqlTable: 'routines',
  from: 'routines t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  privateSelect: { general: 't.general_json', exceptional: 't.exceptional_json', practices: 't.practices_json' },
  readOnlyWhy: 'Change your routine on the life map, under Pillars.',
  columns: [
    c('current', 'Current', 'bool', 't.id = (SELECT r.id FROM routines r WHERE r.user_id = ?1 ORDER BY r.created_at DESC LIMIT 1)', { filter: 'pick', notNull: true }),
    c('general', 'Normal day', 'summary', null, { derive: 'routineDay', from: ['general'] }),
    c('exceptional', 'Exceptional day', 'summary', null, { derive: 'routineDay', from: ['exceptional'] }),
    c('practices', 'Practices', 'summary', null, { derive: 'practices', from: ['practices'], searchable: true, searchSql: 't.practices_json' }),
    stamp('createdAt', 'Made on', 't.created_at'),
  ],
};

const ROUTINE_DAYS: DataTable = {
  key: 'routineDays',
  name: 'Routine days',
  blurb: 'What you ticked of your routine each day.',
  group: 'pillars',
  sqlTable: 'routine_days',
  from: 'routine_days t',
  owner: 't.user_id = ?1',
  idSql: 't.day',
  defaultSort: { key: 'day', dir: 'desc' },
  read: 'sql',
  privateSelect: { steps: 't.steps_json', blocks: 't.blocks_json' },
  readOnlyWhy: 'Tick your routine on Daily: a change here could lose a day’s steps.',
  columns: [
    day('day', 'Day', 't.day'),
    c('dayType', 'Kind of day', 'enum', 't.day_type', { options: DAY_TYPE_OPTIONS, sortable: true, filter: 'pick' }),
    c('steps', 'Morning steps ticked', 'summary', null, { derive: 'stringList', from: ['steps'] }),
    c('blocks', 'Other blocks ticked', 'summary', null, { derive: 'routineBlocks', from: ['blocks'] }),
    c('done', 'Morning done', 'bool', 't.done', { sortable: true, filter: 'pick', notNull: true }),
    stamp('updatedAt', 'Last ticked', 't.updated_at', { filter: undefined }),
  ],
};

const CONTRACT: DataTable = {
  key: 'contract',
  name: 'Contract',
  blurb: 'The deal you signed with yourself, each time you signed one.',
  group: 'pillars',
  sqlTable: 'contracts',
  from: 'contracts t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'signedAt', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Signed paper stays as it is. A new plan signs a new one.',
  columns: [
    c('current', 'Current', 'bool', 't.id = (SELECT k.id FROM contracts k WHERE k.user_id = ?1 ORDER BY k.signed_at DESC LIMIT 1)', { filter: 'pick', notNull: true }),
    c('minDays', 'Days a week', 'number', 't.min_days', { sortable: true }),
    c('checkinTime', 'Check-in time', 'time', 't.checkin_time'),
    c('penalty', 'If a week is missed', 'enum', 't.penalty', { options: PENALTY_OPTIONS, filter: 'pick' }),
    stamp('signedAt', 'Signed on', 't.signed_at'),
  ],
};

const REVIEWS: DataTable = {
  key: 'reviews',
  name: 'Reviews',
  blurb: 'Every review you saved, with your answers.',
  group: 'reviews',
  sqlTable: 'reviews',
  from: 'reviews t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'from', dir: 'desc' },
  read: 'sql',
  privateSelect: { prompts: 't.prompts_json', answers: 't.answers_json' },
  readOnlyWhy: 'Change a review on Reviews, where its numbers are kept with it.',
  columns: [
    c('kind', 'Period', 'enum', 't.kind', { options: PERIOD_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    day('from', 'From', 't.period_start'),
    day('to', 'To', 't.period_end', { filter: undefined }),
    c('name', 'Name', 'text', 't.template_name', { derive: 'reviewName', sortable: true, searchable: true }),
    c('answered', 'Answered', 'summary', null, { derive: 'answered', from: ['prompts', 'answers'] }),
    c('answers', 'Answers', 'summary', null, { derive: 'reviewAnswers', from: ['prompts', 'answers'], searchable: true, searchSql: 't.answers_json' }),
    c('rating', 'Rating', 'number', 't.rating', { sortable: true, filter: 'pick', options: opts([['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']], 'Not rated') }),
    c('highlight', 'Highlight', 'text', 't.highlight', { searchable: true }),
    stamp('createdAt', 'Written', 't.created_at', { filter: undefined }),
    stamp('updatedAt', 'Changed', 't.updated_at', { filter: undefined }),
  ],
};

const SCHEDULE_PATH = '/reviews/schedule/:id';
const REVIEW_REMINDERS: DataTable = {
  key: 'reviewReminders',
  name: 'Review reminders',
  blurb: 'When the app reminds you to write a review.',
  group: 'reviews',
  sqlTable: 'review_schedules',
  from: 'review_schedules t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'nextOn', dir: 'asc' },
  read: 'sql',
  privateSelect: { repeat: 't.repeat_json' },
  columns: [
    c('kind', 'Period', 'enum', 't.kind', { options: PERIOD_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true, edit: { method: 'PATCH', path: SCHEDULE_PATH, field: 'kind', input: 'select', recipe: 'todayQuery' } }),
    c('name', 'Name', 'text', 't.name', { sortable: true, searchable: true, edit: { method: 'PATCH', path: SCHEDULE_PATH, field: 'name', input: 'text', recipe: 'todayQuery', maxLength: 60 } }),
    c('anchor', 'First day', 'date', 't.anchor', { sortable: true, notNull: true, edit: { method: 'PATCH', path: SCHEDULE_PATH, field: 'anchor', input: 'date', recipe: 'todayQuery' } }),
    c('time', 'Time', 'time', 't.time', { sortable: true, notNull: true, edit: { method: 'PATCH', path: SCHEDULE_PATH, field: 'time', input: 'time', recipe: 'todayQuery' } }),
    c('repeat', 'Repeats', 'summary', null, { derive: 'repeatWords', from: ['repeat'] }),
    c('enabled', 'On', 'bool', 't.enabled', { sortable: true, filter: 'pick', notNull: true, edit: { method: 'PATCH', path: SCHEDULE_PATH, field: 'enabled', input: 'toggle', recipe: 'todayQuery' } }),
    c('nextOn', 'Next reminder', 'date', 't.next_on', { sortable: true, filter: 'range' }),
    stamp('createdAt', 'Added', 't.created_at', { filter: undefined }),
  ],
};

const REVIEW_TEMPLATES: DataTable = {
  key: 'reviewTemplates',
  name: 'Review templates',
  blurb: 'Your own sets of review questions.',
  group: 'reviews',
  sqlTable: 'review_templates',
  from: 'review_templates t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'updatedAt', dir: 'desc' },
  read: 'sql',
  privateSelect: { prompts: 't.prompts_json' },
  columns: [
    c('kind', 'Period', 'enum', 't.kind', { options: PERIOD_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('name', 'Name', 'text', 't.name', { sortable: true, searchable: true, notNull: true, edit: patch('/reviews/templates/:id', 'name', 'text', { minLength: 1, maxLength: 60 }) }),
    c('count', 'Questions', 'number', 'json_array_length(t.prompts_json)', { sortable: true }),
    c('questions', 'The questions', 'summary', null, { derive: 'stringList', from: ['prompts'], searchable: true, searchSql: 't.prompts_json' }),
    stamp('createdAt', 'Added', 't.created_at', { filter: undefined }),
    stamp('updatedAt', 'Changed', 't.updated_at', { filter: undefined }),
  ],
};

/** A wellbeing kind that keeps one log a day (mood, sleep, stress): its private fields, which the wellbeingDay recipe sends again. */
const DAY_LOG_FIELDS = { value: 't.value', extra: 't.extra', note: 't.note' } as const;
function dayLogEdit(kind: string, field: string, input: EditInput, more: Partial<ColumnEdit> = {}): ColumnEdit {
  return { method: 'POST', path: `/wellbeing/${kind}`, field, input, recipe: 'wellbeingDay', note: ONE_A_DAY_NOTE, ...more };
}
function wellbeingTable(key: string, name: string, blurb: string, kind: string, columns: DataColumn[], more: Partial<DataTable> = {}): DataTable {
  return {
    key,
    name,
    blurb,
    group: 'body',
    sqlTable: 'wellbeing_logs',
    from: 'wellbeing_logs t',
    owner: 't.user_id = ?1',
    where: `t.kind = '${kind}'`,
    idSql: 't.id',
    defaultSort: { key: 'day', dir: 'desc' },
    read: 'sql',
    adminHidden: true,
    columns,
    ...more,
  };
}

const MOOD = wellbeingTable('mood', 'Mood', 'How you felt each day.', 'mood', [
  day('day', 'Day', 't.date'),
  c('mood', 'Mood', 'enum', 't.value', { options: MOOD_OPTIONS, sortable: true, filter: 'pick', notNull: true, edit: dayLogEdit('mood', 'value', 'select', { send: numberSend(MOOD_OPTIONS) }) }),
  c('active', 'How active', 'number', "json_extract(t.extra, '$.active')", { sortable: true }),
  c('ate', 'How well you ate', 'number', "json_extract(t.extra, '$.ate')", { sortable: true }),
  c('slept', 'How you slept', 'number', "json_extract(t.extra, '$.slept')", { sortable: true }),
  c('note', 'Note', 'text', 't.note', { searchable: true, edit: dayLogEdit('mood', 'note', 'text', { maxLength: 500 }) }),
  stamp('createdAt', 'Saved at', 't.created_at', { filter: undefined }),
], { privateSelect: DAY_LOG_FIELDS });

const SLEEP = wellbeingTable('sleep', 'Sleep', 'Your hours and how deep you slept, night by night.', 'sleep', [
  day('day', 'Morning of', 't.date'),
  c('hours', 'Hours', 'number', 't.value', { sortable: true, notNull: true, format: 'hours', edit: dayLogEdit('sleep', 'value', 'number', { min: 0, max: 14, step: 0.5 }) }),
  c('quality', 'How deep', 'enum', "json_extract(t.extra, '$.quality')", { options: SLEEP_QUALITY_OPTIONS, sortable: true, filter: 'pick', edit: dayLogEdit('sleep', 'extra.quality', 'select', { send: numberSend(SLEEP_QUALITY_OPTIONS) }) }),
  c('note', 'Note', 'text', 't.note', { searchable: true, edit: dayLogEdit('sleep', 'note', 'text', { maxLength: 500 }) }),
  stamp('createdAt', 'Saved at', 't.created_at', { filter: undefined }),
], { privateSelect: DAY_LOG_FIELDS });

const STRESS = wellbeingTable('stress', 'Stress', 'Your stress level each day and what weighed on you.', 'stress', [
  day('day', 'Day', 't.date'),
  c('level', 'Level', 'enum', 't.value', { options: STRESS_OPTIONS, sortable: true, filter: 'pick', notNull: true, edit: dayLogEdit('stress', 'value', 'select', { send: numberSend(STRESS_OPTIONS) }) }),
  c('stressors', 'What weighed on you', 'summary', null, {
    derive: 'stringList',
    from: ['stressors'],
    options: STRESSOR_OPTIONS,
    filter: 'pick',
    filterSql: "EXISTS (SELECT 1 FROM json_each(t.extra, '$.stressors') s WHERE s.value = {v})",
  }),
  c('note', 'Note', 'text', 't.note', { searchable: true, edit: dayLogEdit('stress', 'note', 'text', { maxLength: 500 }) }),
  stamp('createdAt', 'Saved at', 't.created_at', { filter: undefined }),
], { privateSelect: { ...DAY_LOG_FIELDS, stressors: "json_extract(t.extra, '$.stressors')" } });

const MINDFUL = wellbeingTable('mindfulMinutes', 'Mindful minutes', 'Each time you logged mindful minutes.', 'mindful', [
  day('day', 'Day', 't.date'),
  c('minutes', 'Minutes', 'number', 't.value', { sortable: true, notNull: true, format: 'minutes' }),
  c('from', 'From', 'enum', "json_extract(t.extra, '$.kind')", { options: MINDFUL_FROM_OPTIONS, sortable: true, filter: 'pick' }),
  c('note', 'Note', 'text', 't.note', { searchable: true }),
  stamp('createdAt', 'Logged at', 't.created_at', { filter: undefined }),
], { readOnlyWhy: 'A focus round’s minutes change with the round, under Focus sessions.' });

const MOVE_PATH = '/fitness/move/:id';
const MOVEMENT = wellbeingTable('movement', 'Movement', 'Each run, walk or workout you logged.', 'move', [
  day('day', 'Day', 't.date'),
  c('kind', 'Kind', 'enum', "COALESCE(json_extract(t.extra, '$.kind'), 'run')", { options: MOVE_KIND_OPTIONS, sortable: true, filter: 'pick', notNull: true, edit: patch(MOVE_PATH, 'kind', 'select', { when: 'recentOwnMove' }) }),
  c('minutes', 'Minutes', 'number', 't.value', { sortable: true, notNull: true, format: 'minutes', edit: patch(MOVE_PATH, 'minutes', 'number', { min: 1, max: 600, step: 1, when: 'recentOwnMove' }) }),
  c('distance', 'Distance', 'number', "json_extract(t.extra, '$.metres')", { sortable: true, format: 'km' }),
  c('effort', 'Effort', 'enum', "json_extract(t.extra, '$.effort')", { options: EFFORT_OPTIONS, sortable: true, filter: 'pick', edit: patch(MOVE_PATH, 'effort', 'select', { send: numberSend(EFFORT_OPTIONS), when: 'recentOwnMove' }) }),
  c('loggedBy', 'Logged by', 'enum', "json_extract(t.extra, '$.source')", { options: LOGGED_BY_OPTIONS, filter: 'pick' }),
  c('note', 'Note', 'text', 't.note', { searchable: true, edit: patch(MOVE_PATH, 'note', 'text', { maxLength: 500, when: 'recentOwnMove' }) }),
  stamp('createdAt', 'Logged at', 't.created_at', { filter: undefined }),
], { dayCell: 'day' });

function eatEdit(field: string, input: EditInput, more: Partial<ColumnEdit> = {}): ColumnEdit {
  return { method: 'PUT', path: '/fitness/eat', field, input, recipe: 'eatWhole', when: 'recentEat', ...more };
}
const EATING = wellbeingTable('eating', 'Eating', 'Your daily eating check-in, with its parts and the day’s score.', 'eat', [
  day('day', 'Day', 't.date'),
  c('meals', 'Meals', 'summary', null, { derive: 'eatMeals', from: ['value', 'extra', 'note'] }),
  c('fasting', 'Fasting', 'bool', "COALESCE(json_extract(t.extra, '$.fasting'), 0)", { filter: 'pick', notNull: true, edit: eatEdit('fasting', 'toggle', { note: 'Fasting clears the meals.' }) }),
  c('fruit', 'Fruit (servings)', 'number', "json_extract(t.extra, '$.fruit')", { sortable: true, edit: eatEdit('fruit', 'number', { min: 0, max: 5, step: 1, nullable: true }) }),
  c('veg', 'Vegetables and greens (servings)', 'number', "json_extract(t.extra, '$.veg')", { sortable: true, edit: eatEdit('veg', 'number', { min: 0, max: 8, step: 1, nullable: true }) }),
  c('packaged', 'Packaged, fried or sweet', 'enum', "json_extract(t.extra, '$.packaged')", { options: EAT_PACKAGED_OPTIONS, filter: 'pick', edit: eatEdit('packaged', 'select', { send: numberSend(EAT_PACKAGED_OPTIONS) }) }),
  c('fullness', 'After meals I mostly felt', 'enum', "json_extract(t.extra, '$.fullness')", { options: EAT_FULLNESS_OPTIONS, filter: 'pick', edit: eatEdit('fullness', 'select', { send: numberSend(EAT_FULLNESS_OPTIONS) }) }),
  c('screenFree', 'Meals without a screen', 'number', "json_extract(t.extra, '$.screenFree')", { edit: eatEdit('screenFree', 'number', { min: 0, max: 5, step: 1, nullable: true }) }),
  c('proteinGrams', 'Protein (g)', 'number', null, { derive: 'eatProtein', from: ['value', 'extra', 'note'], format: 'grams' }),
  c('dayScore', 'Day score', 'number', null, { derive: 'eatScore', from: ['value', 'extra', 'note'] }),
  c('howWell', 'How well (1 to 5)', 'number', 't.value', { sortable: true, notNull: true }),
  c('legacy', 'From before the meals were asked', 'bool', null, { derive: 'eatLegacy', from: ['value', 'extra', 'note'], hidden: true }),
  c('note', 'Note', 'text', 't.note', { searchable: true, edit: eatEdit('note', 'text', { maxLength: 500 }) }),
  stamp('createdAt', 'Saved at', 't.created_at', { filter: undefined }),
], { privateSelect: DAY_LOG_FIELDS, dayCell: 'day' });

const WATER: DataTable = {
  key: 'water',
  name: 'Water',
  blurb: 'Every glass or amount you logged.',
  group: 'body',
  sqlTable: 'water_logs',
  from: 'water_logs t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  adminHidden: true,
  readOnlyWhy: 'Add water or undo the last glass in Water and reminders.',
  columns: [day('day', 'Day', 't.day'), c('ml', 'Amount', 'number', 't.ml', { sortable: true, notNull: true, format: 'ml' }), stamp('createdAt', 'Logged at', 't.created_at', { filter: undefined })],
};

const FOCUS_PATH = '/wellbeing/focus/:id';
const FOCUS_SESSIONS: DataTable = {
  key: 'focusSessions',
  name: 'Focus sessions',
  blurb: 'Every focus round, with its task and how it felt.',
  group: 'body',
  sqlTable: 'focus_rounds',
  from: 'focus_rounds t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  adminHidden: true,
  columns: [
    day('day', 'Day', 't.day'),
    c('task', 'Task', 'text', 't.title', { sortable: true, searchable: true }),
    c('minutes', 'Minutes', 'number', 't.minutes', { sortable: true, notNull: true, format: 'minutes', edit: patch(FOCUS_PATH, 'minutes', 'number', { min: 1, max: 600, step: 1, note: 'Its mindful minutes move with it.' }) }),
    c('quality', 'How it felt', 'enum', 't.quality', { options: FOCUS_QUALITY_OPTIONS, sortable: true, filter: 'pick', edit: patch(FOCUS_PATH, 'quality', 'select', { send: numberSend(FOCUS_QUALITY_OPTIONS) }) }),
    c('mode', 'Kind', 'enum', 't.mode', { options: FOCUS_MODE_OPTIONS, sortable: true, filter: 'pick' }),
    c('mindful', 'Counted as mindful minutes', 'bool', 't.log_id IS NOT NULL', { filter: 'pick', notNull: true }),
    stamp('createdAt', 'Logged at', 't.created_at', { filter: undefined }),
  ],
};

const SUPP_PATH = '/fitness/supplements/:id';
const SUPPLEMENTS: DataTable = {
  key: 'supplements',
  name: 'Supplements',
  blurb: 'Your supplement list, as you typed it.',
  group: 'body',
  sqlTable: 'supplements',
  from: 'supplements t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'position', dir: 'asc' },
  read: 'sql',
  adminHidden: true,
  privateSelect: { days: 't.days_json' },
  columns: [
    c('name', 'Name', 'text', 't.name', { sortable: true, searchable: true, notNull: true, edit: patch(SUPP_PATH, 'name', 'text', { minLength: 1, maxLength: 40 }) }),
    c('kind', 'Kind', 'enum', 't.kind', { options: SUPPLEMENT_KIND_OPTIONS, sortable: true, filter: 'pick', notNull: true, edit: patch(SUPP_PATH, 'kind', 'select') }),
    c('amount', 'Amount, as typed', 'text', 't.amount', { searchable: true, edit: patch(SUPP_PATH, 'amount', 'text', { maxLength: 24 }) }),
    c('time', 'When', 'enum', 't.time_of_day', { options: SUPPLEMENT_TIME_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true, edit: patch(SUPP_PATH, 'time', 'select') }),
    c('days', 'Days', 'summary', null, { derive: 'weekdays', from: ['days'] }),
    c('paused', 'Paused', 'bool', 't.paused_at IS NOT NULL', { filter: 'pick', notNull: true, edit: patch(SUPP_PATH, 'paused', 'toggle') }),
    c('pausedAt', 'Paused since', 'datetime', 't.paused_at', { sortable: true }),
    c('position', 'Order', 'number', 't.position', { sortable: true, hidden: true }),
    stamp('createdAt', 'Added', 't.created_at', { filter: undefined }),
  ],
};

const SUPPLEMENT_DAYS: DataTable = {
  key: 'supplementDays',
  name: 'Supplement days',
  blurb: 'Each day you ticked a supplement taken.',
  group: 'body',
  sqlTable: 'supplement_days',
  from: 'supplement_days t LEFT JOIN supplements s ON s.id = t.supplement_id AND s.user_id = t.user_id',
  owner: 't.user_id = ?1',
  idSql: "t.supplement_id || ':' || t.day",
  defaultSort: { key: 'day', dir: 'desc' },
  read: 'sql',
  adminHidden: true,
  readOnlyWhy: 'Tick a supplement on Daily or in Fitness.',
  columns: [
    c('supplement', 'Supplement', 'text', 's.name', { sortable: true, searchable: true }),
    c('kind', 'Kind', 'enum', 's.kind', { options: SUPPLEMENT_KIND_OPTIONS, filter: 'pick' }),
    c('time', 'When', 'enum', 's.time_of_day', { options: SUPPLEMENT_TIME_OPTIONS, ordered: true, filter: 'pick' }),
    day('day', 'Day', 't.day'),
    stamp('takenAt', 'Ticked at', 't.taken_at', { filter: undefined }),
  ],
};

const JOURNAL_PATH = '/journal/:id';
const JOURNAL: DataTable = {
  key: 'journal',
  name: 'Journal entries',
  blurb: 'Everything you wrote in your journal.',
  group: 'journal',
  sqlTable: 'journal_entries',
  from: 'journal_entries t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  adminHidden: true,
  privateSelect: { stressors: 't.stressors' },
  columns: [
    stamp('createdAt', 'Day', 't.created_at'),
    c('title', 'Title', 'text', 't.title', { sortable: true, searchable: true, notNull: true, edit: patch(JOURNAL_PATH, 'title', 'text', { maxLength: 120 }) }),
    c('body', 'Entry', 'longtext', 't.body', { searchable: true, edit: patch(JOURNAL_PATH, 'body', 'longtext', { maxLength: 5000 }) }),
    c('emotion', 'How it felt', 'enum', 't.emotion', { options: MOOD_OR_NONE, sortable: true, filter: 'pick', edit: patch(JOURNAL_PATH, 'emotion', 'select', { send: numberSend(MOOD_OR_NONE) }) }),
    c('stress', 'Stress', 'enum', 't.stress', { options: STRESS_OR_NONE, sortable: true, filter: 'pick', edit: patch(JOURNAL_PATH, 'stress', 'select', { send: numberSend(STRESS_OR_NONE) }) }),
    c('stressors', 'What weighed on you', 'summary', null, { derive: 'stringList', from: ['stressors'], options: STRESSOR_OPTIONS, filter: 'pick', filterSql: 'EXISTS (SELECT 1 FROM json_each(t.stressors) s WHERE s.value = {v})' }),
    stamp('updatedAt', 'Changed', 't.updated_at', { filter: undefined }),
  ],
};

function gratitudeLine(i: number, label: string): DataColumn {
  return c(`line${i + 1}`, label, 'text', `json_extract(t.lines_json, '$[${i}].text')`, {
    searchable: true,
    edit: { method: 'PUT', path: '/journal/gratitude/:id', field: `lines.${i}`, input: 'text', recipe: 'gratitudeLine', when: 'recent', maxLength: 280 },
  });
}
const GRATITUDE_PILLAR_OPTIONS: readonly ColumnOption[] = [...PILLAR_OPTIONS, { value: 'day', label: 'Your day' }];
const GRATITUDE: DataTable = {
  key: 'gratitude',
  name: 'Gratitude',
  blurb: 'Your three lines of gratitude, day by day.',
  group: 'journal',
  sqlTable: 'gratitude_days',
  from: 'gratitude_days t',
  owner: 't.user_id = ?1',
  idSql: 't.day',
  defaultSort: { key: 'day', dir: 'desc' },
  read: 'sql',
  adminHidden: true,
  dayCell: 'day',
  privateSelect: { lines: 't.lines_json' },
  columns: [
    day('day', 'Day', 't.day'),
    c('prompts', 'Prompts', 'summary', null, { derive: 'gratitudePrompts', from: ['lines'] }),
    gratitudeLine(0, 'First line'),
    gratitudeLine(1, 'Second line'),
    gratitudeLine(2, 'Third line'),
    c('pillars', 'Pillars', 'summary', null, {
      derive: 'gratitudePillars',
      from: ['lines'],
      options: GRATITUDE_PILLAR_OPTIONS,
      filter: 'pick',
      filterSql: "(json_extract(t.lines_json, '$[0].prompt') LIKE {v} || '-%' OR json_extract(t.lines_json, '$[1].prompt') LIKE {v} || '-%' OR json_extract(t.lines_json, '$[2].prompt') LIKE {v} || '-%')",
    }),
    stamp('createdAt', 'First written', 't.created_at', { filter: undefined }),
    stamp('updatedAt', 'Changed', 't.updated_at', { filter: undefined }),
  ],
};

const MONEY_IN_OUT: DataTable = {
  key: 'moneyInOut',
  name: 'Money in and out',
  blurb: 'Every money entry, typed or booked by the app.',
  group: 'money',
  sqlTable: 'finance_transactions',
  from: 'finance_transactions t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'day', dir: 'desc' },
  read: 'sql',
  privateSelect: { splits: 't.splits_json' },
  columns: [
    day('day', 'Day', 't.date'),
    c('kind', 'In or out', 'enum', 't.kind', { options: IN_OUT_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('amount', 'Amount', 'money', 't.amount_cents', { currency: 'currency', sortable: true, notNull: true }),
    c('currency', 'Currency', 'enum', 't.currency', { options: CURRENCY_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('category', 'Category', 'enum', 't.category', { options: CATEGORY_OPTIONS, otherLabel: 'Other', sortable: true, filter: 'pick' }),
    c('who', 'Who', 'text', 't.counterparty', { sortable: true, searchable: true, edit: patch('/finance/transactions/:id', 'counterparty', 'text', { maxLength: 80 }) }),
    c('note', 'Note', 'text', 't.note', { searchable: true, edit: patch('/finance/transactions/:id', 'note', 'text', { maxLength: 300 }) }),
    c('source', 'Where it came from', 'enum', 't.source', { options: MONEY_SOURCE_OPTIONS, sortable: true, filter: 'pick' }),
    c('splits', 'Splits', 'summary', null, { derive: 'splits', from: ['splits'] }),
    stamp('createdAt', 'Added', 't.created_at', { filter: undefined }),
  ],
};

const BUDGETS: DataTable = {
  key: 'budgets',
  name: 'Budgets',
  blurb: 'What you mean to spend each month, by category.',
  group: 'money',
  sqlTable: 'finance_budgets',
  from: 'finance_budgets t',
  owner: 't.user_id = ?1',
  idSql: 't.category',
  defaultSort: { key: 'category', dir: 'asc' },
  read: 'sql',
  columns: [
    c('category', 'Category', 'enum', 't.category', { options: EXPENSE_CATEGORY_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('monthly', 'Budget a month', 'money', 't.monthly_cents', {
      currency: 'person',
      sortable: true,
      notNull: true,
      edit: { method: 'PUT', path: '/finance/budgets', field: 'monthlyCents', input: 'money', recipe: 'budgetsWhole', min: 0, note: 'Zero removes the budget.' },
    }),
  ],
};

const DUES: DataTable = {
  key: 'dues',
  name: 'Dues',
  blurb: 'Money owed to you, and money you owe.',
  group: 'money',
  sqlTable: 'finance_dues',
  from: 'finance_dues t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'due', dir: 'asc' },
  read: 'sql',
  readOnlyWhy: 'Settle a due in Finance, which books it in your money.',
  columns: [
    c('direction', 'Who owes', 'enum', 't.direction', { options: DUE_DIRECTION_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('who', 'Who', 'text', 't.counterparty', { sortable: true, searchable: true }),
    c('amount', 'Amount', 'money', 't.amount_cents', { currency: 'currency', sortable: true, notNull: true }),
    c('currency', 'Currency', 'enum', 't.currency', { options: CURRENCY_OPTIONS, filter: 'pick', notNull: true }),
    c('category', 'Category', 'enum', 't.category', { options: CATEGORY_OPTIONS, otherLabel: 'None', sortable: true, filter: 'pick' }),
    c('note', 'Note', 'text', 't.note', { searchable: true }),
    c('due', 'Due', 'date', 't.due_date', { sortable: true, filter: 'range' }),
    c('repeats', 'Repeats', 'enum', 't.recurring', { options: DUE_REPEAT_OPTIONS, filter: 'pick' }),
    c('status', 'State', 'enum', 't.status', { options: DUE_STATE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('settledAt', 'Settled at', 'datetime', 't.settled_at', { sortable: true }),
    stamp('createdAt', 'Added', 't.created_at', { filter: undefined }),
  ],
};

const SAVINGS_GOALS: DataTable = {
  key: 'savingsGoals',
  name: 'Savings goals',
  blurb: 'What you are saving toward or counting in.',
  group: 'money',
  sqlTable: 'finance_goals',
  from: 'finance_goals t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Put money toward a goal in Finance.',
  columns: [
    c('title', 'Goal', 'text', 't.title', { sortable: true, searchable: true, notNull: true }),
    c('kind', 'Kind', 'enum', 't.kind', { options: GOAL_KIND_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('target', 'Target', 'money', 't.target_cents', { currency: 'person', sortable: true, notNull: true }),
    // An earn goal counts money in (Finance works it out), so its stored 0 is never shown as saved.
    c('saved', 'Saved so far', 'money', "CASE WHEN t.kind = 'save' THEN t.saved_cents END", { currency: 'person', sortable: true }),
    c('started', 'Started', 'date', 't.start_date', { sortable: true }),
    c('deadline', 'By', 'date', 't.deadline', { sortable: true, filter: 'range' }),
    stamp('createdAt', 'Added', 't.created_at', { filter: undefined }),
  ],
};

const RECURRING: DataTable = {
  key: 'recurring',
  name: 'Recurring',
  blurb: 'Money in or out that the app books each month.',
  group: 'money',
  sqlTable: 'finance_recurring',
  from: 'finance_recurring t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'nextOn', dir: 'asc' },
  read: 'sql',
  columns: [
    c('kind', 'In or out', 'enum', 't.kind', { options: IN_OUT_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('amount', 'Amount', 'money', 't.amount_cents', { currency: 'currency', sortable: true, notNull: true }),
    c('currency', 'Currency', 'enum', 't.currency', { options: CURRENCY_OPTIONS, filter: 'pick', notNull: true }),
    c('category', 'Category', 'enum', 't.category', { options: CATEGORY_OPTIONS, otherLabel: 'Other', sortable: true, filter: 'pick' }),
    c('who', 'Who', 'text', 't.counterparty', { sortable: true, searchable: true }),
    c('note', 'Note', 'text', 't.note', { searchable: true }),
    c('dayOfMonth', 'Day of the month', 'number', 't.day_of_month', { sortable: true }),
    c('nextOn', 'Next on', 'date', 't.next_date', { sortable: true, notNull: true }),
    c('active', 'On', 'bool', 't.active', { sortable: true, filter: 'pick', notNull: true, edit: patch('/finance/recurring/:id', 'active', 'toggle') }),
    stamp('createdAt', 'Added', 't.created_at', { filter: undefined }),
  ],
};

const POINTS: DataTable = {
  key: 'points',
  name: 'Points',
  blurb: 'Every time you earned or spent points.',
  group: 'money',
  sqlTable: 'points_ledger',
  from: 'points_ledger t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  // A like's or a follow's point lands the moment it happened: a coach who liked an anonymous post could see whose it was, so never one.
  coachWhere: "t.reason NOT LIKE 'social:%'",
  readOnlyWhy: 'A record of what moved, so it stays as it is.',
  columns: [
    stamp('createdAt', 'When', 't.created_at'),
    c('amount', 'Points', 'number', 't.amount', { sortable: true, notNull: true, format: 'signed' }),
    c('reason', 'Why', 'enum', 't.reason', { options: POINTS_REASON_OPTIONS, otherLabel: 'Other', sortable: true, filter: 'pick', notNull: true }),
  ],
};

const CREDITS: DataTable = {
  key: 'credits',
  name: 'Credits',
  blurb: 'Credits your plan gave and what the assistant used.',
  group: 'money',
  sqlTable: 'credit_ledger',
  from: 'credit_ledger t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A record of what moved, so it stays as it is.',
  columns: [
    stamp('createdAt', 'When', 't.created_at'),
    c('amount', 'Credits', 'number', 't.amount', { sortable: true, notNull: true, format: 'signed' }),
    c('reason', 'Why', 'enum', 't.reason', { options: CREDIT_REASON_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('bucket', 'From', 'enum', 't.bucket', { options: CREDIT_BUCKET_OPTIONS, filter: 'pick' }),
    c('agent', 'Agent', 'enum', 't.agent', { options: AGENT_OPTIONS, filter: 'pick' }),
    c('model', 'Model', 'text', 't.model', { searchable: true }),
    c('tokensIn', 'Tokens read', 'number', 't.input_tokens', { sortable: true }),
    c('tokensOut', 'Tokens written', 'number', 't.output_tokens', { sortable: true }),
    c('note', 'Note', 'text', 't.note', { searchable: true }),
  ],
};

const ORDERS: DataTable = {
  key: 'orders',
  name: 'Orders',
  blurb: 'Everything you bought, with points or money.',
  group: 'money',
  sqlTable: 'orders',
  from: 'orders t LEFT JOIN products p ON p.id = t.product_id LEFT JOIN users ow ON ow.id = t.owner_id',
  owner: 't.buyer_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'An order is a record of a purchase.',
  columns: [
    stamp('createdAt', 'Bought at', 't.created_at'),
    c('product', 'Product', 'text', 'p.title', { sortable: true, searchable: true }),
    c('kind', 'Kind', 'enum', 'p.kind', { options: PRODUCT_KIND_OPTIONS, filter: 'pick' }),
    c('seller', 'Seller', 'text', 'ow.display_name', { searchable: true }),
    c('status', 'State', 'enum', 't.status', { options: ORDER_STATE_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('points', 'Paid in points', 'number', 't.points', { sortable: true }),
    c('cents', 'Paid in money', 'money', 't.cents', { currency: 'currency', sortable: true }),
    c('currency', 'Currency', 'enum', 't.currency', { options: CURRENCY_OPTIONS, filter: 'pick' }),
    c('discount', 'Discount', 'money', 't.discount_cents', { currency: 'currency' }),
    c('discountPoints', 'Discount in points', 'number', 't.discount_points'),
    c('paidWith', 'Paid with', 'enum', 't.provider', { options: PAID_WITH_OPTIONS, otherLabel: 'Other', filter: 'pick' }),
    c('paidAt', 'Paid at', 'datetime', 't.paid_at', { sortable: true }),
    c('accessUntil', 'Access until', 'datetime', 't.expires_at', { sortable: true }),
    c('refundedAt', 'Refunded at', 'datetime', 't.refunded_at', { sortable: true }),
    c('refundReason', 'Why refunded', 'text', 't.refund_reason', { searchable: true }),
    c('answers', 'Your answers', 'number', 'json_array_length(t.intake_json)'),
  ],
};

const ENROLMENTS: DataTable = {
  key: 'enrolments',
  name: 'Enrolments',
  blurb: 'The School programs and cohorts you joined.',
  group: 'learning',
  sqlTable: 'enrollments',
  from: 'enrollments t LEFT JOIN cohorts k ON k.id = t.cohort_id LEFT JOIN programs p ON p.id = k.program_id',
  owner: 't.learner_user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'joined', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'The cohort’s manager marks it complete.',
  columns: [
    c('program', 'Program', 'text', 'p.name', { sortable: true, searchable: true }),
    c('cohort', 'Cohort', 'text', 'k.name', { sortable: true, searchable: true }),
    c('status', 'Status', 'enum', 't.status', { options: ENROL_STATE_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('payment', 'Payment', 'enum', 't.payment_status', { options: ENROL_PAYMENT_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    stamp('joined', 'Joined', 't.enrolled_at'),
    c('completedAt', 'Completed on', 'datetime', 't.completed_at', { sortable: true }),
  ],
};

const LESSON_PROGRESS: DataTable = {
  key: 'lessonProgress',
  name: 'Lesson progress',
  blurb: 'The lessons of Shop courses you finished.',
  group: 'learning',
  sqlTable: 'lesson_progress',
  from: 'lesson_progress t LEFT JOIN lessons l ON l.id = t.lesson_id LEFT JOIN products p ON p.id = l.product_id',
  owner: 't.user_id = ?1',
  idSql: 't.lesson_id',
  defaultSort: { key: 'doneAt', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A finished lesson stays finished.',
  columns: [c('lesson', 'Lesson', 'text', 'l.title', { sortable: true, searchable: true }), c('course', 'Course', 'text', 'p.title', { sortable: true, searchable: true }), stamp('doneAt', 'Done on', 't.completed_at')],
};

function handInEdit(field: string, input: EditInput, more: Partial<ColumnEdit> = {}): ColumnEdit {
  return { method: 'POST', path: '/school/assignments/:id/submit', param: 'assignmentId', field, input, recipe: 'handIn', when: 'handInOpen', note: 'Saving sends it again for feedback.', ...more };
}
const HAND_INS: DataTable = {
  key: 'handIns',
  name: 'Hand-ins',
  blurb: 'The work you handed in to a cohort.',
  group: 'learning',
  sqlTable: 'submissions',
  from: 'submissions t LEFT JOIN course_assignments a ON a.id = t.assignment_id LEFT JOIN cohorts k ON k.id = t.cohort_id LEFT JOIN programs p ON p.id = k.program_id LEFT JOIN enrollments en ON en.cohort_id = t.cohort_id AND en.learner_user_id = t.learner_user_id',
  owner: 't.learner_user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'handedIn', dir: 'desc' },
  read: 'sql',
  columns: [
    c('assignment', 'Assignment', 'text', 'a.title', { sortable: true, searchable: true }),
    c('program', 'Program', 'text', 'p.name', { sortable: true, searchable: true }),
    c('cohort', 'Cohort', 'text', 'k.name', { sortable: true, searchable: true }),
    c('url', 'Link', 'text', 't.url', { format: 'inert', edit: handInEdit('url', 'text', { maxLength: 500 }) }),
    c('text', 'Words', 'longtext', 't.text', { searchable: true, edit: handInEdit('text', 'longtext', { maxLength: 5000 }) }),
    c('status', 'Status', 'enum', 't.status', { options: HAND_IN_STATE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    stamp('handedIn', 'Handed in', 't.submitted_at'),
    stamp('updatedAt', 'Last changed', 't.updated_at', { filter: undefined }),
    hiddenCell('assignmentId', 't.assignment_id'),
    hiddenCell('cohortId', 't.cohort_id'),
    hiddenCell('enrolStatus', 'en.status'),
  ],
};

const QUIZ_ATTEMPTS: DataTable = {
  key: 'quizAttempts',
  name: 'Quiz attempts',
  blurb: 'Your last try at each Shop course quiz.',
  group: 'learning',
  sqlTable: 'quiz_attempts',
  from: 'quiz_attempts t LEFT JOIN lessons l ON l.id = t.lesson_id LEFT JOIN products p ON p.id = l.product_id',
  owner: 't.user_id = ?1',
  idSql: 't.lesson_id',
  defaultSort: { key: 'lastTried', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'The quiz works out the score.',
  columns: [
    c('lesson', 'Lesson', 'text', 'l.title', { sortable: true, searchable: true }),
    c('course', 'Course', 'text', 'p.title', { sortable: true, searchable: true }),
    c('score', 'Score', 'number', 't.score', { sortable: true, notNull: true, format: 'percent' }),
    c('passed', 'Passed', 'bool', 't.passed', { sortable: true, filter: 'pick', notNull: true }),
    stamp('lastTried', 'Last tried', 't.created_at'),
  ],
};

const CERTIFICATES: DataTable = {
  key: 'certificates',
  name: 'Certificates',
  blurb: 'The certificates you earned. Open them in My purchases.',
  group: 'learning',
  sqlTable: 'certificates',
  from: 'certificates t LEFT JOIN products p ON p.id = t.product_id LEFT JOIN users u ON u.id = p.owner_id',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'issued', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A certificate is a record, issued once.',
  columns: [c('course', 'Course', 'text', 'p.title', { sortable: true, searchable: true }), c('from', 'From', 'text', 'u.display_name', { sortable: true, searchable: true }), stamp('issued', 'Issued', 't.issued_at')],
};

const ATTENDANCE: DataTable = {
  key: 'attendance',
  name: 'Attendance',
  blurb: 'The cohort sessions you checked in to.',
  group: 'learning',
  sqlTable: 'attendance',
  from: 'attendance t LEFT JOIN cohort_sessions cs ON cs.id = t.session_id LEFT JOIN cohorts k ON k.id = cs.cohort_id',
  owner: 't.user_id = ?1',
  idSql: 't.session_id',
  defaultSort: { key: 'checkedIn', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A check-in is a record.',
  columns: [
    c('meeting', 'Session', 'text', 'cs.title', { sortable: true, searchable: true }),
    c('cohort', 'Cohort', 'text', 'k.name', { sortable: true, searchable: true }),
    c('startsAt', 'Session start', 'datetime', 'cs.starts_at', { sortable: true }),
    stamp('checkedIn', 'Checked in', 't.checked_in_at'),
  ],
};

const FRIENDS: DataTable = {
  key: 'friends',
  name: 'Friends',
  blurb: 'Your friends and the requests between you.',
  group: 'people',
  sqlTable: 'friendships',
  from: `friendships t JOIN users u ON u.id = CASE WHEN t.requester_id = ?1 THEN t.recipient_id ELSE t.requester_id END AND u.display_name != ${DELETED}`,
  owner: '(t.requester_id = ?1 OR t.recipient_id = ?1)',
  where: "t.status IN ('pending', 'accepted')",
  idSql: 't.id',
  defaultSort: { key: 'askedOn', dir: 'desc' },
  read: 'sql',
  coachWhere: NOT_BLOCKED_WITH_VIEWER,
  readOnlyWhy: 'Answer or remove a friend in Bond.',
  columns: [
    c('name', 'Name', 'text', 'u.display_name', { sortable: true, searchable: true }),
    c('handle', 'Username', 'text', 'u.handle', { sortable: true, searchable: true, format: 'handle' }),
    c('state', 'Status', 'enum', "CASE WHEN t.status = 'accepted' THEN 'friends' WHEN t.requester_id = ?1 THEN 'sent' ELSE 'pending' END", { options: FRIEND_STATE_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    stamp('askedOn', 'Asked on', 't.created_at'),
    c('answeredAt', 'Became friends', 'datetime', 't.answered_at', { sortable: true }),
  ],
};

const FOLLOWING: DataTable = {
  key: 'following',
  name: 'Following',
  blurb: 'The people you follow.',
  group: 'people',
  sqlTable: 'follows',
  from: `follows t JOIN users u ON u.id = t.owner_id AND u.display_name != ${DELETED}`,
  owner: 't.follower_id = ?1',
  idSql: 't.owner_id',
  defaultSort: { key: 'since', dir: 'desc' },
  read: 'sql',
  coachWhere: NOT_BLOCKED_WITH_VIEWER,
  readOnlyWhy: 'Unfollow from their page or a post.',
  columns: [c('name', 'Name', 'text', 'u.display_name', { sortable: true, searchable: true }), c('handle', 'Username', 'text', 'u.handle', { sortable: true, searchable: true, format: 'handle' }), stamp('since', 'Since', 't.created_at')],
};

const FOLLOWERS: DataTable = {
  key: 'followers',
  name: 'Followers',
  blurb: 'The people who follow you.',
  group: 'people',
  sqlTable: 'follows',
  from: `follows t JOIN users u ON u.id = t.follower_id AND u.display_name != ${DELETED}`,
  owner: 't.owner_id = ?1',
  idSql: 't.follower_id',
  defaultSort: { key: 'since', dir: 'desc' },
  read: 'sql',
  coachWhere: NOT_BLOCKED_WITH_VIEWER,
  readOnlyWhy: 'Only they can undo a follow.',
  columns: [c('name', 'Name', 'text', 'u.display_name', { sortable: true, searchable: true }), c('handle', 'Username', 'text', 'u.handle', { sortable: true, searchable: true, format: 'handle' }), stamp('since', 'Since', 't.created_at')],
};

const POSTS: DataTable = {
  key: 'posts',
  name: 'Posts',
  blurb: 'The posts you wrote in Community.',
  group: 'people',
  sqlTable: 'community_posts',
  from: 'community_posts t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'posted', dir: 'desc' },
  read: 'sql',
  // A coach never sees an anonymous post: listing it would say who wrote it.
  coachWhere: 't.anonymous = 0',
  readOnlyWhy: 'A post is not changed once written. Remove it in Community.',
  columns: [
    c('body', 'Post', 'longtext', 't.body', { searchable: true, format: 'inert' }),
    c('topic', 'Topic', 'enum', 't.category', { options: POST_CATEGORY_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('anonymous', 'Without your name', 'bool', 't.anonymous', { sortable: true, filter: 'pick', notNull: true }),
    c('membersFeed', 'In a members’ feed', 'bool', 't.product_id IS NOT NULL', { filter: 'pick', notNull: true }),
    c('pinned', 'Pinned', 'bool', 't.pinned_at IS NOT NULL', { filter: 'pick', notNull: true }),
    c('held', 'Waiting for a guide', 'bool', 't.held_at IS NOT NULL', { filter: 'pick', notNull: true }),
    c('hiddenByGuide', 'Hidden by a guide', 'bool', 't.hidden_at IS NOT NULL', { filter: 'pick', notNull: true }),
    stamp('posted', 'Posted', 't.created_at'),
  ],
};

const REPLIES: DataTable = {
  key: 'replies',
  name: 'Replies',
  blurb: 'The replies you wrote in Community.',
  group: 'people',
  sqlTable: 'community_replies',
  from: 'community_replies t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'written', dir: 'desc' },
  read: 'sql',
  coachWhere: 't.anonymous = 0',
  readOnlyWhy: 'A reply is not changed once written.',
  columns: [
    c('body', 'Reply', 'longtext', 't.body', { searchable: true, format: 'inert' }),
    c('anonymous', 'Without your name', 'bool', 't.anonymous', { sortable: true, filter: 'pick', notNull: true }),
    c('answers', 'Answers', 'enum', 't.depth', { options: REPLY_DEPTH_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('hiddenByGuide', 'Hidden by a guide', 'bool', 't.hidden_at IS NOT NULL', { filter: 'pick', notNull: true }),
    stamp('written', 'Written', 't.created_at'),
    hiddenCell('postId', 't.post_id'),
  ],
};

const COACH_NOTES: DataTable = {
  key: 'coachNotes',
  name: 'Coach notes',
  blurb: 'The notes your life coaches left you.',
  group: 'people',
  sqlTable: 'coach_notes',
  from: 'coach_notes t LEFT JOIN users u ON u.id = t.coach_id',
  owner: 't.student_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'written', dir: 'desc' },
  read: 'sql',
  // Another coach's notes are that coach's words: a coach sees only their own.
  coachWhere: 't.coach_id = {viewer}',
  readOnlyWhy: 'A note is your coach’s words. Only they can take it back.',
  columns: [c('coach', 'Coach', 'text', 'u.display_name', { sortable: true, searchable: true }), c('body', 'Note', 'longtext', 't.body', { searchable: true, format: 'inert' }), stamp('written', 'Written', 't.created_at')],
};

const BADGES: DataTable = {
  key: 'badges',
  name: 'Badges',
  blurb: 'The badges you earned, and any the team gave you.',
  group: 'account',
  sqlTable: 'badge_awards',
  from: 'badge_awards t',
  owner: 't.user_id = ?1',
  idSql: 't.badge_key',
  defaultSort: { key: 'at', dir: 'desc' },
  read: 'memory',
  reader: 'badges',
  memoryMax: 300,
  readOnlyWhy: 'A badge once earned is never taken back.',
  columns: [
    c('badge', 'Badge', 'text', null, { sortable: true, searchable: true }),
    c('family', 'Family', 'enum', null, { options: BADGE_FAMILY_OPTIONS, ordered: true, sortable: true, filter: 'pick' }),
    c('tier', 'Tier', 'enum', null, { options: BADGE_TIER_OPTIONS, ordered: true, sortable: true, filter: 'pick' }),
    c('how', 'How', 'enum', null, { options: BADGE_HOW_OPTIONS, sortable: true, filter: 'pick' }),
    c('note', 'Note from the team', 'text', null, { searchable: true }),
    c('at', 'When', 'datetime', null, { sortable: true, filter: 'range' }),
  ],
};

const INBOX: DataTable = {
  key: 'inbox',
  name: 'Inbox',
  blurb: 'Every note the app sent you.',
  group: 'account',
  sqlTable: 'notifications',
  from: 'notifications t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'arrived', dir: 'desc' },
  read: 'sql',
  // A reply, a thread or a moderation note reaches the writer of the line it is about, at that moment: it would say who wrote an anonymous line,
  // so a coach never gets one (nor a note to the team).
  coachWhere: "t.kind NOT IN ('reply', 'thread', 'moderation', 'team')",
  // The supplement and focus nudges are body and mind (their tables never reach an admin, nor a coach unless shared): never in anyone else's view.
  othersWhere: "NOT (t.id >= 'supp-' AND t.id < 'supp.') AND NOT (t.id >= 'focus-' AND t.id < 'focus.')",
  readOnlyWhy: 'The app wrote these. Archive or delete them here or in Inbox.',
  archive: {
    activeWhere: 't.archived_at IS NULL',
    archivedWhere: 't.archived_at IS NOT NULL',
    archive: { method: 'POST', path: '/inbox/:id/archive', body: { archived: true } },
    restore: { method: 'POST', path: '/inbox/:id/archive', body: { archived: false } },
    remove: { method: 'DELETE', path: '/inbox/:id' },
  },
  columns: [
    c('tab', 'Kind', 'enum', INBOX_TAB_SQL, { options: INBOX_TAB_OPTIONS, ordered: true, sortable: true, filter: 'pick' }),
    c('title', 'Title', 'text', 't.title', { sortable: true, searchable: true, notNull: true, format: 'inert' }),
    // Other people's words sit in a note's body (a reply, a mention, a coach's note): only its owner reads them here.
    c('body', 'Words', 'longtext', 't.body', { searchable: true, ownerOnly: true, format: 'inert' }),
    c('link', 'Opens', 'text', 't.link', { format: 'appLink', ownerOnly: true }),
    c('read', 'Read', 'bool', 't.read_at IS NOT NULL', { filter: 'pick', notNull: true }),
    c('archivedAt', 'Archived on', 'datetime', 't.archived_at', { sortable: true }),
    stamp('arrived', 'Arrived', 't.created_at'),
  ],
};

const PRIVACY_CHOICES: DataTable = {
  key: 'privacyChoices',
  name: 'Privacy choices',
  blurb: 'What you allowed: the tracked-link cookie, videos and news by email.',
  group: 'account',
  sqlTable: 'user_consents',
  from: 'user_consents t',
  owner: 't.user_id = ?1',
  idSql: 't.purpose',
  defaultSort: { key: 'choice', dir: 'asc' },
  read: 'memory',
  reader: 'consents',
  memoryMax: 3,
  columns: [
    c('choice', 'Choice', 'enum', null, { options: CONSENT_OPTIONS, ordered: true, sortable: true }),
    c('allowed', 'Allowed', 'bool', null, { sortable: true, filter: 'pick', edit: { method: 'PUT', path: '/me/legal/consent', field: 'granted', input: 'toggle', recipe: 'consentWhole', note: 'Off by Global Privacy Control in this browser stays off.' } }),
    c('changed', 'Changed', 'datetime', null, { sortable: true }),
  ],
};

/** Every table, in its group's order, the groups in DATA_TABLE_GROUPS order. */
export const DATA_TABLES: readonly DataTable[] = [
  TASKS, SUBTASKS, NOT_TO_DO, NOT_TO_DO_DAYS, SMALL_ACTS, REMINDERS, KINDS_OF_DAY, TIME_BLOCKS, DAY_TEMPLATES,
  PYRAMIDS, PILLAR_SCORES, XP_HISTORY, LIFE_MAP, LIFE_MAP_ANSWERS, ROUTINE, ROUTINE_DAYS, CONTRACT,
  REVIEWS, REVIEW_REMINDERS, REVIEW_TEMPLATES,
  MOOD, SLEEP, STRESS, MINDFUL, MOVEMENT, EATING, WATER, FOCUS_SESSIONS, SUPPLEMENTS, SUPPLEMENT_DAYS,
  JOURNAL, GRATITUDE,
  MONEY_IN_OUT, BUDGETS, DUES, SAVINGS_GOALS, RECURRING, POINTS, CREDITS, ORDERS,
  ENROLMENTS, LESSON_PROGRESS, HAND_INS, QUIZ_ATTEMPTS, CERTIFICATES, ATTENDANCE,
  FRIENDS, FOLLOWING, FOLLOWERS, POSTS, REPLIES, COACH_NOTES,
  BADGES, INBOX, PRIVACY_CHOICES,
];

/** A table by its key, or undefined. A prototype-less lookup, so a typed "constructor" finds nothing. */
export const dataTableByKey: Readonly<Record<string, DataTable | undefined>> = byKey(DATA_TABLES.map((t) => [t.key, t]));
export const DATA_TABLE_KEYS: readonly string[] = DATA_TABLES.map((t) => t.key);

// -----------------------------------------------------------------------------------------------------------------------------------
// Who sees what
// -----------------------------------------------------------------------------------------------------------------------------------

/** A table's column, or undefined (compared with ===, so "constructor" finds nothing). */
export function tableColumn(table: DataTable, key: string): DataColumn | undefined {
  return table.columns.find((col) => col.key === key);
}

/** May this viewer see this column at all (as a grid column or a hidden cell)? */
export function columnFor(col: DataColumn, view: TableView): boolean {
  return view === 'owner' || !col.ownerOnly;
}

/** The grid's columns for this viewer, in order: never a hidden one, and for a coach or an admin never an ownerOnly one. */
export function visibleColumns(table: DataTable, view: TableView): DataColumn[] {
  return table.columns.filter((col) => !col.hidden && columnFor(col, view));
}

/** Registry keys out of anything (a stored share, a request body): strings only, known tables only, each once, in registry order. */
export function knownTableKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const asked = new Set(raw.filter((v): v is string => typeof v === 'string'));
  return DATA_TABLE_KEYS.filter((k) => asked.has(k));
}

/**
 * AI chat's tables (2026-11-14, the founder: "give one toggle for ai chat access just next to coach button too and even in profile section"):
 * the tables a person opened to the assistant and the Companion, kept as `users.ai_tables_json` (migration 0153), each off until they switch it
 * on with Show to AI chat at the top of the table or under AI chat on the Profile tab. Read only, through the assistant's `read_table` tool,
 * which the tables route also checks (`X-Kreators-Via: assistant` reads only these, and never a download, an edit or an archive).
 * The stored list read back: known keys only, each once, in registry order; anything else reads as none.
 */
export function parseAiTables(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    return knownTableKeys(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** A table AI chat reads only through a model that keeps nothing: the journal, gratitude and every Body and mind table, the ones an admin never sees. */
export function aiPrivateOnly(table: DataTable): boolean {
  return Boolean(table.adminHidden);
}

/** May this viewer open this table? `shared` is the coach's list from the student's link. */
export function tableAllowed(table: DataTable, view: TableView, shared: readonly string[] = []): boolean {
  if (view === 'admin') return !table.adminHidden;
  if (view === 'coach') return shared.includes(table.key);
  return true;
}

/** The list page's groups for a viewer: the owner every table, a coach the shared ones, an admin all but the adminHidden ones. Empty groups go. */
export function listTables(view: TableView, shared: readonly string[] = []): TableListGroup[] {
  return DATA_TABLE_GROUPS.map((g) => ({
    key: g.key,
    name: g.name,
    tables: DATA_TABLES.filter((t) => t.group === g.key && tableAllowed(t, view, shared)).map((t) => ({ key: t.key, name: t.name, blurb: t.blurb })),
  })).filter((g) => g.tables.length > 0);
}

/** Does the table have anything its owner can change here? */
export const tableEditable = (table: DataTable): boolean => table.columns.some((col) => col.edit !== undefined);

// -----------------------------------------------------------------------------------------------------------------------------------
// The query: one reader, one writer
// -----------------------------------------------------------------------------------------------------------------------------------

/** URLSearchParams (or Hono's query), without naming the DOM type this package does not load, or a plain record. */
interface ParamGetter {
  get(name: string): string | null;
  has(name: string): boolean;
}
type ParamsLike = ParamGetter | Readonly<Record<string, string | null | undefined>>;
function paramOf(p: ParamsLike, k: string): string | null {
  const g = p as Partial<ParamGetter>;
  if (typeof g.get === 'function' && typeof g.has === 'function') return g.get.call(p, k);
  const rec = p as Readonly<Record<string, string | null | undefined>>;
  return Object.prototype.hasOwnProperty.call(rec, k) ? (rec[k] ?? null) : null;
}

/** A YYYY-MM-DD that is on the calendar (2026-11-31 and 2026-00-00 are refused). */
export function isRealDay(v: unknown): v is string {
  return typeof v === 'string' && DATE_PATTERN.test(v) && fromDay(asDay(v)) === v;
}

const pickValueOk = (col: DataColumn, v: string): boolean => {
  if (col.kind === 'bool') return v === 'yes' || v === 'no';
  if (col.dynamic && !col.options) return TABLE_ID_RE.test(v);
  return (col.options ?? []).some((o) => o.value === v);
};

/**
 * The one reader of a table's address or API query. Everything is checked against the registry, column by column (the params are
 * never walked, so `f_constructor` is never read); anything unknown, out of range or not allowed to this viewer is dropped.
 */
export function parseTableQuery(table: DataTable, params: ParamsLike, view: TableView = 'owner'): TableQuery {
  const cols = visibleColumns(table, view).concat(table.columns.filter((col) => col.hidden && col.filter && columnFor(col, view)));
  const pageRaw = Math.floor(Number(paramOf(params, 'page')));
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.min(pageRaw, 100_000) : 1;
  const sizeRaw = Number(paramOf(params, 'size'));
  const size = (TABLE_PAGE_SIZES as readonly number[]).includes(sizeRaw) ? (sizeRaw as PageSize) : TABLE_DEFAULT_SIZE;
  const sortAsked = paramOf(params, 'sort') ?? '';
  const sortCol = cols.find((col) => col.key === sortAsked && col.sortable);
  const sort = sortCol ? sortCol.key : table.defaultSort.key;
  const dirAsked = paramOf(params, 'dir');
  const dir = dirAsked === 'asc' || dirAsked === 'desc' ? dirAsked : sortCol && sortCol.key !== table.defaultSort.key ? (sortCol.kind === 'date' || sortCol.kind === 'datetime' ? 'desc' : 'asc') : table.defaultSort.dir;
  const searchable = cols.some((col) => col.searchable);
  const q = searchable ? (paramOf(params, 'q') ?? '').replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX) : '';
  const filters: Record<string, string> = Object.create(null);
  const ranges: Record<string, { from: string | null; to: string | null }> = Object.create(null);
  for (const col of cols) {
    if (col.filter === 'pick') {
      const v = paramOf(params, `f_${col.key}`);
      if (v !== null && v !== '' && pickValueOk(col, v)) filters[col.key] = v;
    } else if (col.filter === 'range') {
      const from = paramOf(params, `f_${col.key}_from`);
      const to = paramOf(params, `f_${col.key}_to`);
      const f = isRealDay(from) ? from : null;
      const t = isRealDay(to) ? to : null;
      if (f || t) ranges[col.key] = f && t && f > t ? { from: t, to: f } : { from: f, to: t };
    }
  }
  const view_ = table.archive ? (paramOf(params, 'view') === 'archived' ? 'archived' : 'active') : null;
  return { page, size, sort, dir, q, filters, ranges, view: view_, count: paramOf(params, 'count') === '1' };
}

/** The query as an address or API query string, defaults left out. `count` and `page` can be dropped (the CSV needs neither). */
export function tableQueryString(table: DataTable, query: TableQuery, opts: { count?: boolean; page?: boolean } = {}): string {
  const parts: string[] = [];
  const out = { set: (k: string, v: string) => parts.push(`${k}=${encodeURIComponent(v)}`), toString: () => parts.join('&') };
  if (opts.page !== false) {
    if (query.page > 1) out.set('page', String(query.page));
    if (query.size !== TABLE_DEFAULT_SIZE) out.set('size', String(query.size));
  }
  if (query.sort !== table.defaultSort.key || query.dir !== table.defaultSort.dir) {
    out.set('sort', query.sort);
    out.set('dir', query.dir);
  }
  if (query.q) out.set('q', query.q);
  for (const col of table.columns) {
    const v = query.filters[col.key];
    if (v !== undefined) out.set(`f_${col.key}`, v);
    const r = query.ranges[col.key];
    if (r?.from) out.set(`f_${col.key}_from`, r.from);
    if (r?.to) out.set(`f_${col.key}_to`, r.to);
  }
  if (query.view === 'archived') out.set('view', 'archived');
  if (opts.count !== false && query.count) out.set('count', '1');
  return out.toString();
}

// -----------------------------------------------------------------------------------------------------------------------------------
// SQL: built only from registry strings; every typed word, id and day is a bound parameter
// -----------------------------------------------------------------------------------------------------------------------------------

export interface TableSqlContext {
  view: TableView;
  /** The person whose tables these are: always ?1. */
  ownerId: string;
  /** Who is looking (for a coach's `{viewer}`). */
  viewerId: string;
  /** The subject's own today and zone. */
  today: string;
  zone: string;
  /** Read one row by its id (an edit or a bulk action): no paging, no count. */
  id?: string;
  /** Rows to read and skip; by default the query's page (size + 1, so `more` comes free). The CSV passes CSV_MAX_ROWS + 1 and 0. */
  limit?: number;
  offset?: number;
  /** A registry condition to add (`archive.only.where` before an archive). */
  and?: string;
}
export interface TableSql {
  sql: string;
  binds: unknown[];
  /** Only when the query asked for a count (and not reading one row). */
  countSql: string | null;
  countBinds: unknown[];
}

/** A search pattern: cut on a whole letter so the pattern stays under D1's 50 bytes, with % _ and \ escaped (ESCAPE '\'). */
export function likePattern(typed: string, room = 46): string {
  let bytes = 0;
  let out = '';
  for (const ch of typed) {
    const esc = ch === '%' || ch === '_' || ch === '\\' ? `\\${ch}` : ch;
    let add = 0;
    for (const e of esc) {
      const cp = e.codePointAt(0) ?? 0;
      add += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    }
    if (bytes + add > room) break;
    bytes += add;
    out += esc;
  }
  return `%${out}%`;
}

const sqlText = (v: string): string => `'${v.replace(/'/g, "''")}'`;
function orderCase(expr: string, options: readonly ColumnOption[]): string {
  const known = options.filter((o) => !o.isNull);
  return `CASE ${expr} ${known.map((o, i) => `WHEN ${sqlText(o.value)} THEN ${i}`).join(' ')} ELSE ${known.length} END`;
}

class Binder {
  binds: unknown[];
  private tokens = new Map<string, string>();
  constructor(ownerId: string) {
    this.binds = [ownerId];
  }
  bind(v: unknown): string {
    this.binds.push(v);
    return `?${this.binds.length}`;
  }
  once(name: string, v: unknown): string {
    const had = this.tokens.get(name);
    if (had) return had;
    const ref = this.bind(v);
    this.tokens.set(name, ref);
    return ref;
  }
}

function tokens(sql: string, b: Binder, ctx: TableSqlContext): string {
  return sql.replace(/\{today\}/g, () => b.once('today', ctx.today)).replace(/\{viewer\}/g, () => b.once('viewer', ctx.viewerId));
}

/** The day a range starts or ends at, as the instant to compare a stored ISO stamp with (the subject's own midnight). */
function instantOf(dayStr: string, zone: string): string {
  return zonedToUtc(dayStr, 0, zone).toISOString();
}

function conditions(table: DataTable, query: TableQuery, ctx: TableSqlContext, b: Binder): string[] {
  const out: string[] = [tokens(table.owner, b, ctx)];
  if (table.where) out.push(tokens(table.where, b, ctx));
  if (ctx.view === 'coach' && table.coachWhere) out.push(tokens(table.coachWhere, b, ctx));
  if (ctx.view !== 'owner' && table.othersWhere) out.push(tokens(table.othersWhere, b, ctx));
  if (table.archive && query.view) out.push(query.view === 'archived' ? table.archive.archivedWhere : table.archive.activeWhere);
  if (ctx.and) out.push(tokens(ctx.and, b, ctx));
  if (ctx.id !== undefined) {
    out.push(`${table.idSql} = ${b.bind(ctx.id)}`);
    return out;
  }
  for (const col of table.columns) {
    if (!columnFor(col, ctx.view)) continue;
    const v = query.filters[col.key];
    if (v !== undefined) {
      const opt = col.options?.find((o) => o.value === v);
      if (col.filterSql) {
        if (!opt?.isNull) out.push(tokens(col.filterSql, b, ctx).replace(/\{v\}/g, b.once(`f_${col.key}`, v)));
      } else if (col.sql) {
        const expr = tokens(col.sql, b, ctx);
        if (col.kind === 'bool') out.push(v === 'yes' ? `(${expr}) = 1` : `((${expr}) = 0 OR (${expr}) IS NULL)`);
        else if (opt?.isNull) out.push(`(${expr}) IS NULL`);
        else out.push(`(${expr}) = ${b.bind(col.kind === 'number' || /^-?\d+$/.test(v) && isNumericColumn(col) ? Number(v) : v)}`);
      }
    }
    const r = query.ranges[col.key];
    if (r && col.sql) {
      const expr = tokens(col.sql, b, ctx);
      if (col.kind === 'datetime') {
        if (r.from) out.push(`${expr} >= ${b.bind(instantOf(r.from, ctx.zone))}`);
        if (r.to) out.push(`${expr} < ${b.bind(instantOf(addDays(r.to, 1), ctx.zone))}`);
      } else {
        if (r.from) out.push(`${expr} >= ${b.bind(r.from)}`);
        if (r.to) out.push(`${expr} <= ${b.bind(r.to)}`);
      }
    }
  }
  if (query.q) {
    const exprs = table.columns.filter((col) => col.searchable && columnFor(col, ctx.view) && (col.searchSql ?? col.sql)).map((col) => tokens((col.searchSql ?? col.sql) as string, b, ctx));
    if (exprs.length) {
      const pat = b.bind(likePattern(query.q));
      out.push(`(${exprs.map((e) => `${e} LIKE ${pat} ESCAPE '\\'`).join(' OR ')})`);
    }
  }
  return out;
}

/** A column whose options are numbers stored as numbers (a mood, a priority, a level): its filter binds a number, so a JSON number matches. */
function isNumericColumn(col: DataColumn): boolean {
  const known = (col.options ?? []).filter((o) => !o.isNull);
  return known.length > 0 && known.every((o) => /^-?\d+$/.test(o.value));
}

/**
 * The SELECT for a page of a table read with SQL (`read: 'sql'`). Raw rows carry `_id`, each column's key, and each private field as
 * `_p_<name>`; turn them into rows with `rowFromRaw`. The count, when asked, uses the same conditions and its own binds.
 */
export function tableSql(table: DataTable, query: TableQuery, ctx: TableSqlContext): TableSql {
  if (table.read !== 'sql') throw new Error(`${table.key} is read whole by its server reader`);
  const b = new Binder(ctx.ownerId);
  const select = [`${table.idSql} AS "_id"`];
  for (const col of table.columns) if (col.sql && columnFor(col, ctx.view)) select.push(`${tokens(col.sql, b, ctx)} AS "${col.key}"`);
  for (const [name, expr] of Object.entries(table.privateSelect ?? {})) select.push(`${tokens(expr, b, ctx)} AS "_p_${name}"`);
  const from = tokens(table.from, b, ctx);
  const where = conditions(table, query, ctx, b).join(' AND ');
  let sql = `SELECT ${select.join(', ')} FROM ${from} WHERE ${where}`;
  if (ctx.id === undefined) {
    const sortCol = tableColumn(table, query.sort) ?? tableColumn(table, table.defaultSort.key);
    const dir = query.dir === 'asc' ? 'ASC' : 'DESC';
    const parts: string[] = [];
    if (sortCol && (sortCol.sql || sortCol.sortSql) && columnFor(sortCol, ctx.view)) {
      const raw = tokens(sortCol.sortSql ?? (sortCol.sql as string), b, ctx);
      const expr = sortCol.ordered && sortCol.options ? orderCase(raw, sortCol.options) : raw;
      if (!sortCol.notNull) parts.push(`(${raw}) IS NULL`);
      parts.push(`${expr} ${dir}`);
    }
    parts.push(`${table.idSql} ${dir}`);
    const limit = ctx.limit ?? query.size + 1;
    const offset = ctx.offset ?? (query.page - 1) * query.size;
    sql += ` ORDER BY ${parts.join(', ')} LIMIT ${b.bind(limit)} OFFSET ${b.bind(offset)}`;
  }
  let countSql: string | null = null;
  let countBinds: unknown[] = [];
  if (query.count && ctx.id === undefined) {
    const cb = new Binder(ctx.ownerId);
    const cFrom = tokens(table.from, cb, ctx);
    // The LIMIT keeps SQLite from flattening the subquery, so it drops the LEFT JOINs that neither a cell nor a condition reads (under a bare
    // COUNT(*) it runs them all: a heavy person's tasks count read every task's project too). Inner joins and joins a condition reads stay.
    countSql = `SELECT COUNT(*) AS n FROM (SELECT 1 FROM ${cFrom} WHERE ${conditions(table, query, ctx, cb).join(' AND ')} LIMIT -1)`;
    countBinds = cb.binds;
  }
  return { sql, binds: b.binds, countSql, countBinds };
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Rows: from raw, derived, paged in memory, editable
// -----------------------------------------------------------------------------------------------------------------------------------

function toCell(kind: ColumnKind, raw: unknown): Cell {
  if (raw === null || raw === undefined) return null;
  if (kind === 'bool') return raw === true || raw === 1 || raw === '1' || raw === 'true';
  if (kind === 'number' || kind === 'money') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === 'number' || typeof raw === 'boolean') return kind === 'enum' ? String(raw) : (raw as Cell);
  return String(raw);
}

function parseList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const PILLAR_NAME: Readonly<Record<string, string>> = byKey(PILLAR_OPTIONS.map((o) => [o.value, o.label]));

/** The words for a list of ISO weekdays (1 Monday to 7 Sunday). */
export function weekdayWords(days: readonly number[]): string {
  const set = [...new Set(days.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort((a, b) => a - b);
  if (set.length === 7) return 'Every day';
  if (set.join() === '1,2,3,4,5') return 'Weekdays';
  if (set.join() === '6,7') return 'Weekends';
  return set.map((d) => WEEKDAY_SHORT[d - 1]).join(', ');
}

/** A derive this file can do, or undefined for one the server does (SERVER_DERIVES). */
export function deriveLeaf(key: DeriveKey, fields: Readonly<Record<string, unknown>>, from: readonly string[] = []): Cell | undefined {
  const first = fields[from[0] ?? ''];
  switch (key) {
    case 'weekdays': {
      const list = parseList(first).map(Number);
      return list.length ? weekdayWords(list) : null;
    }
    case 'stringList': {
      const words = parseList(first).filter((v): v is string => typeof v === 'string' && v.trim() !== '');
      return words.length ? words.join(', ') : null;
    }
    case 'routineBlocks': {
      const words = parseList(first).map((k) => (typeof k === 'string' ? ROUTINE_BLOCK_WORDS[k] : undefined)).filter((w): w is string => !!w);
      return words.length ? words.join(', ') : null;
    }
    case 'pillarList': {
      const words = parseList(first).map((k) => (typeof k === 'string' ? PILLAR_NAME[k] : undefined)).filter((w): w is string => !!w);
      return words.length ? words.join(', ') : null;
    }
    case 'reviewAnswers': {
      const prompts = parseList(fields[from[0] ?? '']);
      const answers = parseList(fields[from[1] ?? '']);
      const lines = prompts.map((p, i) => [p, answers[i]] as const).filter(([, a]) => typeof a === 'string' && a.trim() !== '').map(([p, a]) => `${String(p)}: ${String(a).trim()}`);
      return lines.length ? lines.join('\n') : null;
    }
    case 'answered': {
      const prompts = parseList(fields[from[0] ?? '']);
      const answers = parseList(fields[from[1] ?? '']);
      const n = answers.filter((a) => typeof a === 'string' && a.trim() !== '').length;
      return `${n} of ${prompts.length}`;
    }
    case 'splits': {
      const currency = typeof fields.currency === 'string' ? fields.currency : 'INR';
      const parts = parseList(first).flatMap((s) => {
        if (!s || typeof s !== 'object') return [];
        const o = s as { name?: unknown; cents?: unknown; status?: unknown };
        const cents = Number(o.cents);
        if (typeof o.name !== 'string' || !Number.isFinite(cents)) return [];
        return [`${o.name} ${money(Math.round(cents), currency)}, ${o.status === 'paid' ? 'paid' : 'due'}`];
      });
      return parts.length ? parts.join('; ') : null;
    }
    default:
      return undefined;
  }
}

/**
 * A raw row (from `tableSql`, or a memory reader) as a TableRow, with the private fields beside it for the server's derives and
 * recipes. Leaf derives are filled here; a server derive is left null for the server to fill. Hidden cells stay in `cells` (the rules
 * and routes read them) and are never a grid column. A column this viewer may not see is never put in.
 */
export function rowFromRaw(table: DataTable, raw: Readonly<Record<string, unknown>>, view: TableView): { row: TableRow; fields: Record<string, unknown> } {
  const plan = rowPlan(table, view);
  const cells: Record<string, Cell> = {};
  for (const col of plan.cols) cells[col.key] = toCell(col.kind, raw[col.key]);
  const fields: Record<string, unknown> = { ...cells };
  // A private field wins over a cell of the same name, and is set only when the raw row has it (as the read always does).
  for (const name of plan.priv) {
    const k = `_p_${name}`;
    if (k in raw) fields[name] = raw[k];
  }
  for (const col of plan.derived) {
    const done = deriveLeaf(col.derive as DeriveKey, fields, col.from);
    if (done !== undefined) cells[col.key] = done;
  }
  return { row: { id: String(raw._id ?? ''), cells }, fields };
}

/**
 * What `rowFromRaw` walks for a table and a viewer, worked out once (a 5,000-row CSV turned each row's keys over and over: about 20 ms of
 * CPU on a wide table, past the free plan's 10). The owner's plan and everyone else's differ only by the owner-only columns.
 */
interface RowPlan {
  cols: DataColumn[];
  priv: string[];
  derived: DataColumn[];
}
const ROW_PLANS = new WeakMap<DataTable, { owner?: RowPlan; other?: RowPlan }>();
function rowPlan(table: DataTable, view: TableView): RowPlan {
  const kept = ROW_PLANS.get(table) ?? {};
  const slot = view === 'owner' ? 'owner' : 'other';
  const had = kept[slot];
  if (had) return had;
  const cols = table.columns.filter((col) => columnFor(col, view));
  const plan: RowPlan = { cols, priv: Object.keys(table.privateSelect ?? {}), derived: cols.filter((col) => col.derive) };
  kept[slot] = plan;
  ROW_PLANS.set(table, kept);
  return plan;
}

/** Is `dayStr` the subject's today or yesterday? */
export function isRecentDay(dayStr: Cell, today: string): boolean {
  return typeof dayStr === 'string' && isRealDay(today) && (dayStr === today || dayStr === addDays(today, -1));
}

/** May the owner change this cell of this row now? (Owner view, Active view; the server checks it again before it calls.) */
export function rowEditable(table: DataTable, col: DataColumn, cells: Readonly<Record<string, Cell>>, today: string): boolean {
  const edit = col.edit;
  if (!edit) return false;
  const recent = () => isRecentDay(table.dayCell ? (cells[table.dayCell] ?? null) : null, today);
  switch (edit.when) {
    case undefined:
      return true;
    case 'open':
      return cells.status === 'active';
    case 'project':
      return cells.layer === 'project';
    case 'recent':
      return recent();
    case 'recentOwnMove':
      return recent() && cells.loggedBy !== 'run';
    case 'recentEat':
      return recent() && cells.legacy !== true;
    case 'handInOpen':
      return cells.status !== 'approved' && cells.enrolStatus === 'enrolled';
    default:
      return false;
  }
}

/** The column keys the owner may change on this row now. */
export function editableKeys(table: DataTable, cells: Readonly<Record<string, Cell>>, today: string): string[] {
  return table.columns.filter((col) => rowEditable(table, col, cells, today)).map((col) => col.key);
}

/**
 * Check a value for an editable column and turn it into what the route's body gets: { value } or { error } in plain words.
 * `choices` are the person's own options for a `choices` select (from the page answer), checked by value.
 */
export function editValue(col: DataColumn, value: Cell, choices: readonly ColumnOption[] = []): { value: unknown } | { error: string } {
  const edit = col.edit;
  if (!edit) return { error: 'That column cannot be changed here.' };
  if (value === null || value === '') {
    if (edit.nullable || edit.input === 'select' && (col.options ?? []).some((o) => o.isNull)) {
      const nullOpt = (col.options ?? []).find((o) => o.isNull);
      return { value: nullOpt && edit.send && nullOpt.value in edit.send ? edit.send[nullOpt.value] : null };
    }
    // Words with no least length can be emptied (a task's or a layer's note, a journal entry's words), as on the app's own screens.
    if ((edit.input === 'text' || edit.input === 'longtext') && !edit.minLength) return { value: '' };
    return { error: 'This one cannot be empty.' };
  }
  switch (edit.input) {
    case 'text':
    case 'longtext': {
      if (typeof value !== 'string') return { error: 'Type some words.' };
      const v = value.trim();
      if (edit.minLength && v.length < edit.minLength) return { error: 'This one cannot be empty.' };
      if (edit.maxLength && v.length > edit.maxLength) return { error: `Keep it to ${edit.maxLength} characters.` };
      return { value: v };
    }
    case 'number':
    case 'money': {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) return { error: 'Type a number.' };
      if (edit.input === 'money' && !Number.isInteger(n)) return { error: 'Type a whole amount in paise or cents.' };
      if (edit.min !== undefined && n < edit.min) return { error: `The least is ${edit.min}.` };
      if (edit.max !== undefined && n > edit.max) return { error: `The most is ${edit.max}.` };
      if (edit.step && Math.abs(Math.round(n / edit.step) * edit.step - n) > 1e-9) return { error: `Use steps of ${edit.step}.` };
      return { value: n };
    }
    case 'toggle':
      return typeof value === 'boolean' ? { value } : { error: 'Pick yes or no.' };
    case 'date':
      return isRealDay(value) ? { value } : { error: 'Pick a real day.' };
    case 'time':
      return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? { value } : { error: 'Pick a time.' };
    case 'select': {
      const v = String(value);
      const list = edit.choices ? choices : (col.options ?? []);
      const picked = list.find((o) => o.value === v);
      if (!picked) return { error: 'Pick one of the choices.' };
      if (edit.send && v in edit.send) return { value: edit.send[v] };
      return { value: picked.isNull ? null : v };
    }
    default:
      return { error: 'That column cannot be changed here.' };
  }
}

/** The call for a plain, withToday or todayQuery recipe, or null for a recipe the server builds itself. */
export function plainCall(col: DataColumn, rowId: string, cells: Readonly<Record<string, Cell>>, value: unknown, today: string): { method: string; path: string; body: Record<string, unknown> } | null {
  const edit = col.edit;
  if (!edit) return null;
  const recipe = edit.recipe ?? 'plain';
  if (recipe !== 'plain' && recipe !== 'withToday' && recipe !== 'todayQuery') return null;
  const idValue = edit.param ? cells[edit.param] : rowId;
  if (typeof idValue !== 'string' || !TABLE_ID_RE.test(idValue)) return null;
  let path = edit.path.replace(':id', encodeURIComponent(idValue));
  const body: Record<string, unknown> = { [edit.field]: value };
  if (recipe === 'withToday') body.today = today;
  if (recipe === 'todayQuery') path += `?day=${encodeURIComponent(today)}`;
  return { method: edit.method, path, body };
}

/** The archive's call for one row, with `:id` filled. */
export function archiveCall(spec: TableCall, rowId: string): { method: string; path: string; body?: Record<string, unknown> } | null {
  if (!TABLE_ID_RE.test(rowId)) return null;
  return { method: spec.method, path: spec.path.replace(':id', encodeURIComponent(rowId)), ...(spec.body ? { body: { ...spec.body } } : {}) };
}

function cmpCells(a: Cell, b: Cell, col: DataColumn): number {
  if (col.ordered && col.options) {
    const ia = col.options.findIndex((o) => o.value === String(a));
    const ib = col.options.findIndex((o) => o.value === String(b));
    return (ia < 0 ? col.options.length : ia) - (ib < 0 ? col.options.length : ib);
  }
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), 'en', { sensitivity: 'base', numeric: true });
}

/**
 * Filter, search, sort and page rows a memory reader returned (`read: 'memory'`), by the same rules the SQL follows: a pick filter
 * matches the cell (a null-option matches an empty cell), a range compares days (an instant by the subject's own midnight), the search
 * looks in the searchable cells and in an enum's words, nulls sort last, the id breaks ties.
 */
export function pageRows(table: DataTable, rows: readonly TableRow[], query: TableQuery, ctx: { view: TableView; zone: string }): { rows: TableRow[]; page: Page; total: number } {
  const cols = table.columns.filter((col) => columnFor(col, ctx.view));
  const needle = query.q.toLowerCase();
  const kept = rows.filter((r) => {
    for (const col of cols) {
      const cell = r.cells[col.key] ?? null;
      const v = query.filters[col.key];
      if (v !== undefined) {
        if (col.kind === 'bool') {
          if ((v === 'yes') !== (cell === true)) return false;
        } else {
          const opt = col.options?.find((o) => o.value === v);
          if (opt?.isNull ? cell !== null : String(cell) !== v) return false;
        }
      }
      const rg = query.ranges[col.key];
      if (rg) {
        if (typeof cell !== 'string') return false;
        if (col.kind === 'datetime') {
          if (rg.from && cell < instantOf(rg.from, ctx.zone)) return false;
          if (rg.to && cell >= instantOf(addDays(rg.to, 1), ctx.zone)) return false;
        } else {
          if (rg.from && cell < rg.from) return false;
          if (rg.to && cell > rg.to) return false;
        }
      }
    }
    if (needle) {
      const hay = cols
        .filter((col) => col.searchable)
        .map((col) => {
          const cell = r.cells[col.key];
          const label = col.options?.find((o) => o.value === String(cell))?.label;
          return `${cell ?? ''} ${label ?? ''}`;
        })
        .join(' ')
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
  const sortCol = tableColumn(table, query.sort) ?? tableColumn(table, table.defaultSort.key);
  const sign = query.dir === 'asc' ? 1 : -1;
  kept.sort((a, b) => {
    if (sortCol) {
      const x = a.cells[sortCol.key] ?? null;
      const y = b.cells[sortCol.key] ?? null;
      if (x === null && y !== null) return 1;
      if (y === null && x !== null) return -1;
      if (x !== null && y !== null) {
        const d = cmpCells(x, y, sortCol);
        if (d !== 0) return d * sign;
      }
    }
    return a.id < b.id ? -sign : a.id > b.id ? sign : 0;
  });
  const start = (query.page - 1) * query.size;
  const slice = kept.slice(start, start + query.size);
  return {
    rows: slice,
    page: { page: query.page, size: query.size, more: kept.length > start + query.size, ...(slice.length === 0 && query.page > 1 ? { empty: true } : {}) },
    total: kept.length,
  };
}

// -----------------------------------------------------------------------------------------------------------------------------------
// Words out: one cell as plain text, Copy (tab-separated) and CSV
// -----------------------------------------------------------------------------------------------------------------------------------

export interface CellTextContext {
  /** The person's own options for `dynamic` columns (from the page answer). */
  options?: Readonly<Record<string, readonly ColumnOption[]>>;
  /** The subject's currency, for `currency: 'person'`. */
  currency?: string;
}

/** One cell as plain text for Copy and CSV: an enum's words, Yes or No, money through money(), days and instants as stored. */
export function cellText(col: DataColumn, cells: Readonly<Record<string, Cell>>, ctx: CellTextContext = {}): string {
  const cell = cells[col.key] ?? null;
  if (col.kind === 'bool') return cell === null ? '' : cell ? 'Yes' : 'No';
  if (cell === null) {
    const nullOpt = col.kind === 'enum' ? col.options?.find((o) => o.isNull) : undefined;
    return nullOpt ? nullOpt.label : '';
  }
  if (col.kind === 'enum') {
    const list = col.dynamic ? (ctx.options?.[col.key] ?? col.options ?? []) : (col.options ?? []);
    return list.find((o) => o.value === String(cell))?.label ?? col.otherLabel ?? String(cell);
  }
  if (col.kind === 'money' && typeof cell === 'number') {
    const cur = col.currency === 'person' ? (ctx.currency ?? 'INR') : typeof cells[col.currency ?? ''] === 'string' ? (cells[col.currency ?? ''] as string) : 'INR';
    return money(cell, cur);
  }
  if (col.format === 'handle' && typeof cell === 'string' && cell) return `@${cell}`;
  return String(cell);
}

/** A spreadsheet must never run what a person typed: a word cell that starts like a formula gets a leading quote. */
function safeWords(col: DataColumn, s: string): string {
  const words = col.kind === 'text' || col.kind === 'longtext' || col.kind === 'summary' || col.kind === 'enum';
  return words && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

/** Rows as CSV (RFC 4180, CRLF), a header of labels, the viewer's visible columns in order. */
export function toCsv(columns: readonly DataColumn[], rows: readonly TableRow[], ctx: CellTextContext = {}): string {
  const quote = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [columns.map((col) => quote(safeWords(col, col.label))).join(',')];
  for (const r of rows) lines.push(columns.map((col) => quote(safeWords(col, cellText(col, r.cells, ctx)))).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

/** Rows as tab-separated text for Copy: tabs and line breaks inside a cell become spaces. */
export function toTsv(columns: readonly DataColumn[], rows: readonly TableRow[], ctx: CellTextContext = {}): string {
  const clean = (s: string) => s.replace(/[\t\r\n]+/g, ' ');
  return [columns.map((col) => clean(col.label)).join('\t'), ...rows.map((r) => columns.map((col) => clean(safeWords(col, cellText(col, r.cells, ctx)))).join('\t'))].join('\n');
}
