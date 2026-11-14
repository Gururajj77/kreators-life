// All tables (2026-11-13, the founder): every list of a person's own data, drawn as a table they can sort, filter, search, page, tick,
// copy, download and, where the app already has a route for it, edit in place. A coach sees only the tables a student switched on for
// them, read only; a super admin sees any member's tables, read only, never the journal, gratitude or a body and mind table.
//
// A subpath export (`@kreators/shared/dataTables`, chunk `shared-tables`) and a LEAF: it imports only types and values from the
// `shared-base` files (core.ts, dates.ts, money.ts), and one type from modules.ts (erased when built), so it never pulls the barrel in and
// the barrel never pulls it in (no chunk cycle, and never in the first download). Plain data and pure functions only. It loads with
// `node --experimental-strip-types`.
//
// WHO SEES A TABLE (2026-11-14, the founder: "ok, add them", on two rules, then "put them in toggles based on categories in every place they
// occur"): `tableReach` is the one rule, read by the routes, the share lists and the screens.
//   - audience 'own' (the default): the person's own records, with nobody else's details or words in them. The person; a life coach only when
//     the person switches that table on for that coach; AI chat when switched on (any model, unless it is a journal, gratitude or Body and mind
//     table, `adminHidden`, which only a model that keeps nothing reads); a super admin, read only and in the audit log, never an adminHidden one.
//   - audience 'others': rows or columns hold another person's details or words (a buyer, a guest, a lead, an applicant, a client, a team
//     member, a chat partner, the other side of a link: a friend, someone you follow or who follows you, a coach's note, an inbox note's
//     title or words), or the founder named it (Agency's tables, the Companion chat, Discover's answers and results). Only the person, and AI
//     chat when switched on, on a model that keeps nothing. Never a life coach (no switch, not in the share list, refused or dropped by both
//     forms of the share route and 404 on every coach route), never a super admin (left out and 404).
//   - A column of an 'own' table that names another person (an order's seller, a certificate's course maker) is `ownerOnly`: the person sees
//     it, and nobody else does, exactly as an 'others' table. A test fails any 'own' table that reads another account's row in a column
//     anyone but the owner sees.
//   - AI chat on a model that may keep what it reads gets an 'own' table as anyone but its owner does (routes/tables.ts reads it in the admin
//     view): no `ownerOnly` column, no row only the owner may see (`othersWhere`), no private badge family (Focus, Reflection, Money), and no
//     `aiPrivateOnly` table at all. Only a read the read_table tool marks as from a model that keeps nothing (`ai=private`) is the owner's own.
//     The Companion chat to AI chat also leaves out every answer that read a table the person has since shut to it (`{aiHeld}`, from the
//     server's one rule, `heldBack`), from its page, count and search alike.
//   - `needs`: the apps its records belong to. The table lists, opens, downloads, edits and archives only while one of them is on for the person
//     whose tables they are (the owner, the coach's student, the admin's member; `X-Kreators-Via: assistant` too); a table with none always does.
//     `needsSwitch` adds a setting inside the app that must be on too (Business metrics in Reviews, whose routes refuse everything while it is off).
//   - Never reveal what the app hides: an anonymous line's writer, an alias's member, a block's other side the app does not show, a code or link
//     key (at most "has a link" in words), a hash, a salt, a session or a payment id. Where the person's lines share a space with other people's,
//     list only the person's own, unless the app already shows them every line with the same names (then exactly what the app shows them).
//   - Every list of tables (the person's, a coach's, an admin's, and the two share lists on the Profile tab) draws one accordion per app group in
//     MODULE_GROUP_ORDER, as the Apps page draws its groups, each category's tables under its quiet eyebrow (`DATA_TABLE_GROUPS[].appGroup`).
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
//   A coach's rows also meet the table's `coachWhere` (no anonymous line, nor a social xp or point that would say who wrote one) and
//   `othersWhere`; the person's own lists in `options` hold
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
//   An admin's rows meet the table's `othersWhere` (rows only the owner may ever see), as do AI chat's on a model that may keep data.
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
// for the owner, `row.edit` from `rowEditable`. Columns the viewer may not see (`ownerOnly`, for a coach, an admin, or AI chat on a model that
// may keep data) are never selected.
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
import { money, PRODUCT_MONEY_MAX } from './money.ts';
import type { ModuleGroup } from './modules.ts';

// -----------------------------------------------------------------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------------------------------------------------------------

export type TableGroupKey =
  | 'daily' | 'pillars' | 'reviews' | 'business' | 'body' | 'journal' | 'coaching' | 'selfAi' | 'money' | 'purchases' | 'shop' | 'audience' | 'creatorContent'
  | 'contentFolders' | 'publicPage' | 'store' | 'tools' | 'pitches' | 'learning' | 'teaching' | 'work' | 'army' | 'win' | 'agency' | 'agencyPaper' | 'people'
  | 'community' | 'bond' | 'club' | 'party' | 'runs' | 'circles' | 'rewards' | 'account' | 'invites';
export type TableView = 'owner' | 'coach' | 'admin';
/** Whose details a table holds: the person's own only ('own', the default), or another person's too ('others'). See WHO SEES A TABLE above. */
export type TableAudience = 'own' | 'others';
/** The keys of the apps on for a person (`ModuleAccess.on`), which `needs` is read against, and `switch:<key>` for each setting inside an app
 * that is on for them (`TABLE_SWITCHES`, read by `needsSwitch`). */
export type AppsOn = readonly string[];
/**
 * A setting inside an app that a table also needs on, beside its app (2026-11-14): Business metrics, Reviews' own switch, whose routes answer
 * 403 to everything but the switch while it is off, so its tables neither list nor open then either. Carried in an apps-on list as
 * `switch:<key>` (`tableSwitchKey`): the server adds it where it reads the person's apps (`tableSwitchesOn` in tablesShare.ts), GET /me sends
 * it as `user.tableSwitches`, and the screen's `useAppsOn` adds it, so every list and every check reads one list.
 */
export type TableSwitch = 'businessMetrics';
export const TABLE_SWITCHES: Readonly<Record<TableSwitch, { name: string; app: string; path: string; where: string }>> = {
  businessMetrics: { name: 'Business metrics', app: 'reviews', path: '/reviews#metrics-heading', where: 'Reviews' },
};
export const tableSwitchKey = (s: TableSwitch): string => `switch:${s}`;
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
  | 'stepLabels' // a funnel's steps_json -> "A post, Shop link, Course" (each step's label, else its kind in words)
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
  | 'practices' // routines.practices_json -> mantraLine, the breathing's name, the affirmation and the reading
  | 'kpiAmount' // a business metric's number in its unit's words, kpiShown(unit, value, currency): from ['unit', <the number>, 'currency']
  | 'minuteRanges' // a day's own session hours, availability_overrides.ranges_json -> "9:00 am to 12:00 pm, 2:00 pm to 5:00 pm" (slotRangeLabel), "Closed all day" when empty
  | 'rewardName' // a reward's key (a game's as `game_<key>`) -> its name in REWARD_BY_KEY, the catalog's one list, else "A reward no longer offered"
  // The seventh batch, You (2026-11-14):
  | 'vibeQuestion' // a vibe check answer's question id -> its prompt (QUESTION_BY_ID), else "A question no longer asked"
  | 'vibeAnswer' // the question id and the stored value -> the choice it counted as: a pick's option, a scale's label, Yes or No; a foundation none
  | 'discoverResult' // discover_results.result_json -> one part of discoverProfile, by the column's key (strongest, quietest, traits, reasoning,
  //                   emotional): the words the assistant may be given, never an answer or a score
  | 'discoverAddOn' // discover_extras' kind and result_json -> the add-on's summary as extrasProfile says it: the type, the love languages each
  //                  way, the mind's three bands, the design's type, authority, profile and life path. Never the birth date, time, place or name.
  | 'answeredBy'; // a Companion line's model -> who answered, as the Companion says it ("the built-in model", a listed model's name)

export const LEAF_DERIVES: readonly DeriveKey[] = ['weekdays', 'stringList', 'routineBlocks', 'pillarList', 'reviewAnswers', 'answered', 'splits', 'stepLabels'];
export const SERVER_DERIVES: readonly DeriveKey[] = [
  'repeatWords', 'kindOfDay', 'reviewName', 'eatMeals', 'eatProtein', 'eatScore', 'eatLegacy', 'gratitudePrompts', 'gratitudePillars',
  'fears', 'insecurities', 'scorecard', 'realDay', 'routineDay', 'practices', 'kpiAmount', 'minuteRanges', 'rewardName',
  'vibeQuestion', 'vibeAnswer', 'discoverResult', 'discoverAddOn', 'answeredBy',
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
 *  - pitchWhole:   PATCH /proposals/:id { title, pitch, budgetAmount }, the route's whole set, as stored with `field` changed (the budget
 *                  sent as the amount typed, from the row's integer cents, which the route keeps in whole units as TV and Fund do).
 */
export type EditRecipe = 'plain' | 'withToday' | 'todayQuery' | 'wellbeingDay' | 'eatWhole' | 'gratitudeLine' | 'notToDoDay' | 'handIn' | 'kindOfDay' | 'budgetsWhole' | 'consentWhole' | 'pitchWhole';

/**
 * When a row's cell may be edited (evaluated by `rowEditable` from the row's cells and the subject's today):
 *  - open:          cells.status is 'active' (a task: move it to another project, hide it).
 *  - project:       cells.layer is 'project' (a pyramid's Due by).
 *  - recent:        the table's `dayCell` is the subject's today or yesterday.
 *  - recentOwnMove: recent, and the movement was not a club run (cells.loggedBy is not 'run').
 *  - recentEat:     recent, and not a check-in from before the meals were asked (cells.legacy is not true).
 *  - handInOpen:    cells.status is not 'approved' and cells.enrolStatus is 'enrolled'.
 *  - paperOpen:     cells.status is 'draft' or 'sent' (an Agency invoice: a paid one is marked sent again first, a void one never changes).
 *  - retainerOpen:  cells.status is 'offered', 'chosen' or 'active' (an Agency retainer whose months may still be made).
 *  - listingOpen:   cells.status is 'live' or 'withdrawn' (a pre-owned listing: one with an accepted offer, or sold, the Store keeps as it is).
 *  - unpublished:   cells.status is 'draft' or 'closed' (a Work listing: Publish and Back to draft are one tap in Work, Close asks first there).
 *  - pitchWaiting:  cells.stage is 'submitted' (a TV pitch or a Fund application the team has not started reading; the route holds it too).
 *  - xpOpen:        cells.xpOpen is true: a Party event or a run that is not cancelled and whose code has not opened yet, thirty minutes before
 *                   its start (attendeeXpLocked), worked out by SQLite's own clock in the read; the route refuses a later change too.
 *  - seatHeld:      cells.status is 'registered' or 'attended' (a guest with a seat, who alone is on an event's list to meet others).
 *  - madeIt:        cells.madeIt is true (a channel the person made: its name and topic are its maker's to change, in Community a guide's).
 *  - linkOpen:      cells.status is 'pending' or 'active' (a coach link: what the student shares changes only while it is asked or running).
 */
export type EditWhen = 'open' | 'project' | 'recent' | 'recentOwnMove' | 'recentEat' | 'handInOpen' | 'paperOpen' | 'retainerOpen' | 'listingOpen' | 'unpublished' | 'pitchWaiting' | 'xpOpen' | 'seatHeld' | 'madeIt' | 'linkOpen';

export interface ColumnEdit {
  method: 'PATCH' | 'PUT' | 'POST';
  /**
   * The app's own route under /api; `:id` is filled from the row's id, or from the cell named by `param`. Any other `:name` in it is filled
   * from the row's own hidden cell of that name (a brand's piece lives under its brand: `/studio/brands/:brandId/pieces/:id`).
   */
  path: string;
  param?: string;
  /** The body field the value goes in (a recipe may read it as a path: 'extra.quality', 'lines.1'). */
  field: string;
  input: EditInput;
  recipe?: EditRecipe;
  when?: EditWhen;
  /** A select's choices: the column's own options (the default) or the person's own list from the page answer. */
  choices?: DynamicOptions;
  /**
   * Only these of the column's options may be picked; the others are states the app moves by itself (a listing is sold or agreed in the
   * Store), shown in the cell and never offered in the select (refused by `editValue` too).
   */
  offer?: readonly string[];
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
  /**
   * Sort by these expressions in turn, each in the asked direction, instead of `sql` or `sortSql`: a sort an index serves only as a whole
   * (a business metric's value by its metric, in the order its index keeps them, then by its period). Never NULL, so no "nulls last" term.
   */
  sortTerms?: readonly string[];
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
  /** Only in the owner's own view: never selected for a coach, an admin or AI chat on a model that may keep data (another person's name or
   * words, a link, an id a route needs). */
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
  /** Never shown to an admin (the journal and every body and mind table): the server answers 404 and the list leaves it out. AI chat reads
   * one only on a model that keeps nothing. */
  adminHidden?: boolean;
  /** 'own' when left out. 'others': another person's details or words are in it, so never a coach or an admin, and AI chat only on a model
   * that keeps nothing (`tableReach`). */
  audience?: TableAudience;
  /** The apps (module keys) its records belong to: it lists and opens only while one of them is on for the person whose tables these are
   * (`tableAppsOn`). Left out: always (a core table, or one several apps and core screens show). */
  needs?: readonly string[];
  /** A setting inside its app that must be on too (`TABLE_SWITCHES`): Business metrics' tables need Reviews and its Business metrics switch. */
  needsSwitch?: TableSwitch;
  /** An extra condition in a coach's view (no anonymous post; only this coach's own notes, `{viewer}`). */
  coachWhere?: string;
  /** An extra condition in every view but the owner's (a coach's, an admin's, and AI chat's on a model that may keep data): rows only the owner
   * may ever see. */
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
  /** The app group this category sits under, whose accordion it is drawn in (DATA_TABLE_GROUPS). */
  appGroup: ModuleGroup;
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
/**
 * The most table keys a share list or AI chat's list takes in one request (Share all sends every table the person may share). Well past the
 * registry (a test holds DATA_TABLES under half of it), so a growing registry never trips it; coaching.ts keeps the same number for a stored share.
 */
export const TABLE_LIST_MAX = 400;
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
// Agency and Business metrics (2026-11-14), copied from agency.ts, agencyPaper.ts, agencyTeam.ts and contract.ts (the test checks each).
export const AGENCY_CLIENT_STATUS_OPTIONS = opts([['lead', 'Lead'], ['active', 'Active'], ['paused', 'Paused'], ['ended', 'Ended']]);
export const AGENCY_HEALTH_OPTIONS = opts([['green', 'Going well'], ['amber', 'Needs care'], ['red', 'At risk']]);
export const AGENCY_STAGE_OPTIONS = opts([
  ['enquiry', 'Enquiry'], ['agreement_sent', 'Agreement sent'], ['agreement_signed', 'Agreement signed'], ['strategy', 'Strategy session'], ['trial', 'Trial video'],
  ['pilot', 'Pilot month'], ['retainer_offer', 'Retainer proposed'], ['retainer', 'Retainer active'], ['delivery', 'Monthly delivery'],
]);
export const DELIVERABLE_KIND_OPTIONS = opts([['video', 'Video'], ['short', 'Short'], ['post', 'Post'], ['carousel', 'Carousel'], ['newsletter', 'Newsletter'], ['blog', 'Blog'], ['script', 'Script'], ['thumbnail', 'Thumbnail'], ['podcast', 'Podcast'], ['other', 'Other']]);
export const DELIVERABLE_STAGE_OPTIONS = opts([['idea', 'Idea'], ['script', 'Script'], ['making', 'Making'], ['review', 'In review'], ['approved', 'Approved'], ['published', 'Published']]);
export const NOTE_KIND_OPTIONS = opts([['note', 'Note'], ['comment', 'Comment'], ['change', 'Change asked for'], ['paid_change', 'Paid change asked for']]);
/** Who wrote a line on a piece, as Agency names them (toNote in routes/agency.ts): a client's line from the team link reads "Client’s team". */
const NOTE_FROM_OPTIONS = opts([['me', 'You'], ['client', 'Client'], ['clientTeam', 'Client’s team'], ['brand', 'Brand'], ['team', 'Team']]);
export const INVOICE_STATUS_OPTIONS = opts([['draft', 'Draft'], ['sent', 'Sent'], ['paid', 'Paid'], ['void', 'Void']]);
export const CONTRACT_STATUS_OPTIONS = opts([['draft', 'Draft'], ['sent', 'Sent'], ['signed', 'Signed'], ['void', 'Void']]);
export const AGENCY_DOC_KIND_OPTIONS = opts([['brief', 'Strategy session summary'], ['trial_terms', 'Trial video terms'], ['retainer_proposal', 'Retainer proposal'], ['monthly_report', 'Monthly report']]);
export const AGENCY_DOC_STATUS_OPTIONS = opts([['draft', 'Draft'], ['sent', 'Sent'], ['approved', 'Approved'], ['revised', 'Revised']]);
export const RETAINER_STATUS_OPTIONS = opts([['offered', 'Offered'], ['chosen', 'Chosen by the client'], ['active', 'Active'], ['ended', 'Ended'], ['withdrawn', 'Withdrawn']]);
/** Who did something in a client's log (LogActor in lifecycle.ts); a team member is never named here, since the log keeps only their id. */
const AGENCY_LOG_ACTOR_OPTIONS = opts([['me', 'You'], ['client', 'Client'], ['auto', 'The app'], ['team', 'A team member']]);
const AGENCY_LOG_KIND_OPTIONS = opts([['stage', 'Stage'], ['password', 'Password'], ['link', 'Client link'], ['onboarding', 'Onboarding form'], ['trial', 'Trial video'], ['retainer', 'Retainer'], ['cycle', 'A retainer month'], ['restore', 'Brought back'], ['team', 'Team']]);
export const TEMPLATE_KIND_OPTIONS = opts([['invoice', 'Invoice'], ['contract', 'Agreement'], ['doc', 'Document'], ['email', 'Email note']]);
export const TEAM_ROLE_OPTIONS = opts([['content_creator', 'Content creator'], ['videographer', 'Videographer'], ['editor', 'Video editor'], ['client', 'Client']]);
export const TEAM_STATUS_OPTIONS = opts([['invited', 'Invited'], ['active', 'Active'], ['removed', 'Removed']]);
export const TEAM_LEVEL_OPTIONS = opts([['off', 'Off'], ['view', 'View'], ['edit', 'Edit']]);
/** Who ended a place on the team. A member who said no to the invite never joined (migration 0076: a decline is `member` with no joined_at). */
const TEAM_ENDED_BY_OPTIONS = opts([['owner', 'You'], ['member', 'They left'], ['declined', 'They said no']]);
export const KPI_UNIT_OPTIONS = opts([['number', 'A count'], ['money', 'Money'], ['percent', 'A percent'], ['hours', 'Hours']]);
const KPI_DIRECTION_OPTIONS = opts([['up', 'Higher is better'], ['down', 'Lower is better']]);
/** Business metrics keep the week to the year (KPI_KINDS in routes/kpis.ts): a day is too short for a business number. */
const KPI_CADENCE_OPTIONS = PERIOD_OPTIONS.filter((o) => o.value !== 'day');
export const KPI_SOURCE_OPTIONS = opts([
  ['manual', 'Typed in'], ['published', 'Pieces published'], ['first_pass', 'Approved first time'], ['on_time', 'Published on time'], ['hours', 'Billable hours'],
  ['utilisation', 'Utilisation'], ['invoiced', 'Invoiced'], ['paid', 'Paid'], ['new_clients', 'New clients'],
]);
// Shop and creator tools (2026-11-14), copied from account.ts, studio.ts and work.ts (the test checks each).
/** A product's state as Shop names it (productStatusLabel): a live course reads Public, any other live product Live. */
export const PRODUCT_STATUS_OPTIONS = opts([['draft', 'Draft'], ['private', 'Private'], ['live', 'Live'], ['public', 'Public'], ['archived', 'Archived']]);
export const BOOKING_STATUS_OPTIONS = opts([['requested', 'Waiting for a yes'], ['confirmed', 'Confirmed'], ['cancelled', 'Cancelled'], ['done', 'Done']]);
/** A session hour's day as stored (getUTCDay: 0 is Sunday), in that order, as Shop lists them. */
export const WEEKDAY_SUNDAY_FIRST_OPTIONS = opts([['0', 'Sunday'], ['1', 'Monday'], ['2', 'Tuesday'], ['3', 'Wednesday'], ['4', 'Thursday'], ['5', 'Friday'], ['6', 'Saturday']]);
export const LINK_SOURCE_OPTIONS = opts([['content', 'A post'], ['automation', 'An Auto-DM'], ['bio', 'Your bio'], ['youtube', 'YouTube'], ['newsletter', 'A newsletter'], ['other', 'Other']]);
export const CONTENT_KIND_OPTIONS = opts([['reel', 'Reel'], ['post', 'Post'], ['carousel', 'Carousel'], ['story', 'Story'], ['video', 'Video'], ['short', 'Short'], ['other', 'Other']]);
export const SOCIAL_PLATFORM_OPTIONS = opts([['instagram', 'Instagram'], ['youtube', 'YouTube'], ['tiktok', 'TikTok'], ['x', 'X'], ['facebook', 'Facebook'], ['linkedin', 'LinkedIn'], ['other', 'Other']]);
const BROADCAST_AUDIENCE_OPTIONS = opts([['followers', 'Your followers'], ['buyers', 'Your buyers']]);
/** Where a lead came from: the two places Shop writes one (routes/store.ts: the page's form, and a free product that gathers leads). */
export const LEAD_SOURCE_OPTIONS = opts([['page', 'Your page'], ['lead_magnet', 'A free product']]);
export const DM_STATUS_OPTIONS = opts([['open', 'Waiting for an answer'], ['answered', 'Answered'], ['refunded', 'Refunded']]);
const PORTFOLIO_VISIBILITY_OPTIONS = opts([['public', 'On your page'], ['private', 'Only you']]);
const RATING_OPTIONS = opts([['1', '1 star'], ['2', '2 stars'], ['3', '3 stars'], ['4', '4 stars'], ['5', '5 stars']]);
/** A funnel step's words when it has no label of its own (FunnelStep's kinds in studio.ts). */
export const FUNNEL_STEP_WORDS: Readonly<Record<string, string>> = byKey([
  ['content', 'A post'], ['automation', 'An Auto-DM'], ['link', 'A link'], ['lead', 'A lead'], ['product', 'A product'], ['broadcast', 'A broadcast'],
]);
// Content, the Store, Tools and Rewards (2026-11-14), copied from studio.ts, store.ts, wellbeing.ts and rewards.ts (the test checks each).
export const BRAND_SOURCE_KIND_OPTIONS = opts([['site', 'Website'], ['youtube', 'YouTube'], ['instagram', 'Instagram'], ['x', 'X'], ['tiktok', 'TikTok'], ['reddit', 'Reddit'], ['article', 'Article'], ['competitor', 'Competitor']]);
export const RESEARCH_KIND_OPTIONS = opts([
  ['read', 'Read a link'], ['search', 'Search the web'], ['youtube_search', 'Search YouTube'], ['channels', 'Find channels'], ['outliers', 'Find outliers'],
  ['x_search', 'Search X'], ['reddit_search', 'Search Reddit'], ['transcript', 'Transcript'], ['profile', 'Profile'],
]);
const RUN_STATUS_OPTIONS = opts([['done', 'Done'], ['failed', 'Did not work']]);
export const PIECE_KIND_OPTIONS = opts([
  ['audit', 'Strategy audit'], ['plan', 'Marketing plan'], ['calendar', 'Four-week calendar'], ['ideas', 'Video ideas'], ['hooks', 'Hooks'],
  ['script', 'Short-form script'], ['post', 'Posts and captions'], ['analysis', 'Why it worked'], ['playbook', 'What is working'],
]);
export const PIECE_STATUS_OPTIONS = opts([['draft', 'Draft'], ['kept', 'Kept']]);
/** Who wrote a piece, in Content's own words (Brand.tsx): Claude, the small model, or the research laid out with no model. */
export const PIECE_WRITER_OPTIONS = opts([['claude', 'Claude'], ['workers-ai', 'A small model'], ['digest', 'A research digest, no model']]);
export const STORE_CATEGORY_OPTIONS = opts([['Camera', 'Camera'], ['Audio', 'Audio'], ['Lighting', 'Lighting'], ['Computer', 'Computer'], ['Phone', 'Phone'], ['Software', 'Software'], ['Desk', 'Desk'], ['Other', 'Other']]);
export const PREOWNED_CONDITION_OPTIONS = opts([['new', 'Brand new'], ['lightly_used', 'Lightly used'], ['regularly_used', 'Regularly used'], ['well_used', 'Well used']]);
/** A listing's state as the Store names it: "Offer accepted" and "Taken down" are its own tags (Store.tsx). */
export const LISTING_STATUS_OPTIONS = opts([['live', 'For sale'], ['agreed', 'Offer accepted'], ['sold', 'Sold'], ['withdrawn', 'Taken down']]);
/** An offer's state as the listing's sheet says it (offerWord in ListingSheet.tsx: open reads waiting). */
export const OFFER_STATUS_OPTIONS = opts([['open', 'Waiting'], ['accepted', 'Accepted'], ['declined', 'Declined'], ['withdrawn', 'Withdrawn']]);
export const TOOL_CATEGORY_OPTIONS = opts([
  ['Capture', 'Capture'], ['Editing', 'Editing'], ['Audio', 'Audio'], ['Design', 'Design'], ['Scheduling', 'Scheduling'], ['Analytics', 'Analytics'],
  ['Monetization', 'Monetization'], ['Community', 'Community'], ['AI', 'AI'],
]);
/** A reservation's state; a game is unlocked at once and for good, which Rewards says as "unlocked" (Rewards.tsx), never "fulfilled". */
export const REDEMPTION_STATUS_OPTIONS = opts([['reserved', 'Reserved'], ['unlocked', 'Unlocked'], ['fulfilled', 'Done'], ['cancelled', 'Cancelled']]);
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

/** One category of tables: its name, its line, and the app group (a key of MODULE_GROUP_ORDER) whose accordion it is drawn in, the group the apps
 * its tables belong to sit in on the Apps page. */
export interface DataTableGroup {
  key: TableGroupKey;
  name: string;
  blurb: string;
  appGroup: ModuleGroup;
}

/** The categories, in order. Their app groups (2026-11-14, rule 7): Daily, Pillars, Rewards, Account and Invites and help under Essentials (Daily,
 * Pillars, the inbox, the leaderboard and Help are there, and Rewards is no app); Reviews, Business metrics, Body and mind, Journal, Life coaching
 * and Discover and AI chat under Reflection (Business metrics is Reviews' own switch; Coaching, Discover and the Companion sit there); Money, My purchases, Shop, Audience, Content and Auto-DM, Content folders, Public page, Store, Tools and TV and Fund under
 * Creation, where Finance and those apps sit; Learning, Teaching, Work, Army, Win, Agency and Agency paperwork under Contribution, where School,
 * Work, Army, Win and Agency sit; People, Community, Bond, Club, Party, Kreators Run and Circles under Connection. */
export const DATA_TABLE_GROUPS: readonly DataTableGroup[] = [
  { key: 'daily', name: 'Daily', blurb: 'Tasks, your not to do list, reminders and the shape of your days.', appGroup: 'core' },
  { key: 'pillars', name: 'Pillars', blurb: 'Your pyramids, scores, xp, life map, routine, vibe check answers and live call asks.', appGroup: 'core' },
  { key: 'reviews', name: 'Reviews', blurb: 'The reviews you wrote, their reminders and your own templates.', appGroup: 'wellbeing' },
  { key: 'business', name: 'Business metrics', blurb: 'The numbers you track for your business, and each period’s value.', appGroup: 'wellbeing' },
  { key: 'body', name: 'Body and mind', blurb: 'Mood, sleep, stress, movement, eating, water, focus and supplements.', appGroup: 'wellbeing' },
  { key: 'journal', name: 'Journal', blurb: 'Your entries and your gratitude.', appGroup: 'wellbeing' },
  { key: 'coaching', name: 'Life coaching', blurb: 'Your coaches and students, what each link shares, the coaching log and your coach card.', appGroup: 'wellbeing' },
  { key: 'selfAi', name: 'Discover and AI chat', blurb: 'Your Discover results and add-ons, your Companion chat and what the assistant changed.', appGroup: 'wellbeing' },
  { key: 'money', name: 'Money', blurb: 'Money in and out, budgets, dues, goals, points, credits, your plan, orders, discounts and payout details.', appGroup: 'creator' },
  { key: 'purchases', name: 'My purchases', blurb: 'Sessions you booked, questions you paid for, course invites and the reviews you wrote.', appGroup: 'creator' },
  { key: 'shop', name: 'Shop', blurb: 'Your products, coupons, bookings, hours, course invites, paid questions and reviews.', appGroup: 'creator' },
  { key: 'audience', name: 'Audience', blurb: 'The leads from your page and the messages you sent.', appGroup: 'creator' },
  { key: 'creatorContent', name: 'Content and Auto-DM', blurb: 'Your tracked posts and links, Auto-DMs, funnels and after-purchase messages.', appGroup: 'creator' },
  { key: 'contentFolders', name: 'Content folders', blurb: 'Your brand folders, the links and research in them, and the pieces written.', appGroup: 'creator' },
  { key: 'publicPage', name: 'Public page', blurb: 'The work you show on your page.', appGroup: 'creator' },
  { key: 'store', name: 'Store', blurb: 'Gear you listed, offers made both ways and the chats about them.', appGroup: 'creator' },
  { key: 'tools', name: 'Tools', blurb: 'The tools you suggested for the directory.', appGroup: 'creator' },
  { key: 'pitches', name: 'TV and Fund', blurb: 'Series you pitched in TV and the backing you asked Fund for.', appGroup: 'creator' },
  { key: 'learning', name: 'Learning', blurb: 'Programs, lessons, hand-ins, quizzes, certificates, invites and your lines in cohort talk.', appGroup: 'earn' },
  { key: 'teaching', name: 'Teaching', blurb: 'Programs you made, cohorts you run and the people you invited.', appGroup: 'earn' },
  { key: 'work', name: 'Work', blurb: 'Listings you posted, who applied, and your own applications.', appGroup: 'earn' },
  { key: 'army', name: 'Army', blurb: 'Your campaign roles, the work you sent, and your brands’ teams and campaigns.', appGroup: 'earn' },
  { key: 'win', name: 'Win', blurb: 'Content rewards you launched, your entries and what reviewers wrote.', appGroup: 'earn' },
  { key: 'agency', name: 'Agency', blurb: 'Clients, pieces, notes, time, retainers, the client log and your team.', appGroup: 'earn' },
  { key: 'agencyPaper', name: 'Agency paperwork', blurb: 'Invoices, agreements, other documents and your templates.', appGroup: 'earn' },
  { key: 'people', name: 'People', blurb: 'Friends, follows, your posts and replies, and notes from your coach.', appGroup: 'community' },
  { key: 'community', name: 'Community', blurb: 'Channels you are in, your lines there, your reactions, posts you follow and who you muted.', appGroup: 'community' },
  { key: 'bond', name: 'Bond', blurb: 'Your anonymous chats, introductions, Bond channels and the people you blocked.', appGroup: 'community' },
  { key: 'club', name: 'Club', blurb: 'Your Club application and membership.', appGroup: 'community' },
  { key: 'party', name: 'Party', blurb: 'Events you host and signed up for, your feedback, your lines in their talk and your guests.', appGroup: 'community' },
  { key: 'runs', name: 'Kreators Run', blurb: 'Clubs and runs you host, clubs you are in, runs you logged, your lines and brand collabs.', appGroup: 'community' },
  { key: 'circles', name: 'Circles', blurb: 'Circles you signed up for, and your lines at their tables.', appGroup: 'community' },
  { key: 'rewards', name: 'Rewards', blurb: 'Rewards you reserved with points and the games you unlocked.', appGroup: 'core' },
  { key: 'account', name: 'Account', blurb: 'Badges, honors, seasons, your inbox, your calendar link, privacy choices and the terms you accepted.', appGroup: 'core' },
  { key: 'invites', name: 'Invites and help', blurb: 'The invite codes you made and your messages to the team.', appGroup: 'core' },
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
  needs: ['reviews'],
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
  needs: ['reviews'],
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
  needs: ['reviews'],
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
], { privateSelect: DAY_LOG_FIELDS, needs: ['mood'] });

const SLEEP = wellbeingTable('sleep', 'Sleep', 'Your hours and how deep you slept, night by night.', 'sleep', [
  day('day', 'Morning of', 't.date'),
  c('hours', 'Hours', 'number', 't.value', { sortable: true, notNull: true, format: 'hours', edit: dayLogEdit('sleep', 'value', 'number', { min: 0, max: 14, step: 0.5 }) }),
  c('quality', 'How deep', 'enum', "json_extract(t.extra, '$.quality')", { options: SLEEP_QUALITY_OPTIONS, sortable: true, filter: 'pick', edit: dayLogEdit('sleep', 'extra.quality', 'select', { send: numberSend(SLEEP_QUALITY_OPTIONS) }) }),
  c('note', 'Note', 'text', 't.note', { searchable: true, edit: dayLogEdit('sleep', 'note', 'text', { maxLength: 500 }) }),
  stamp('createdAt', 'Saved at', 't.created_at', { filter: undefined }),
], { privateSelect: DAY_LOG_FIELDS, needs: ['sleep'] });

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
], { privateSelect: { ...DAY_LOG_FIELDS, stressors: "json_extract(t.extra, '$.stressors')" }, needs: ['stress'] });

const MINDFUL = wellbeingTable('mindfulMinutes', 'Mindful minutes', 'Each time you logged mindful minutes.', 'mindful', [
  day('day', 'Day', 't.date'),
  c('minutes', 'Minutes', 'number', 't.value', { sortable: true, notNull: true, format: 'minutes' }),
  c('from', 'From', 'enum', "json_extract(t.extra, '$.kind')", { options: MINDFUL_FROM_OPTIONS, sortable: true, filter: 'pick' }),
  c('note', 'Note', 'text', 't.note', { searchable: true }),
  stamp('createdAt', 'Logged at', 't.created_at', { filter: undefined }),
], { readOnlyWhy: 'A focus round’s minutes change with the round, under Focus sessions.', needs: ['mindful'] });

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
], { dayCell: 'day', needs: ['fitness', 'run'] });

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
], { privateSelect: DAY_LOG_FIELDS, dayCell: 'day', needs: ['fitness'] });

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
  needs: ['mindful'],
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
  needs: ['fitness'],
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
  needs: ['fitness'],
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
  needs: ['journal'],
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
  needs: ['journal'],
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
  needs: ['finance'],
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
  needs: ['finance'],
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
  needs: ['finance'],
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
  needs: ['finance'],
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
  needs: ['finance'],
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
    // Another person's name: the owner's own view only, never a coach's, an admin's or AI chat's on a model that may keep data.
    c('seller', 'Seller', 'text', 'ow.display_name', { searchable: true, ownerOnly: true }),
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
  needs: ['school'],
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
  needs: ['school'],
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
  columns: [
    c('course', 'Course', 'text', 'p.title', { sortable: true, searchable: true }),
    // The course maker's name: the owner's own view only, as an order's seller.
    c('from', 'From', 'text', 'u.display_name', { sortable: true, searchable: true, ownerOnly: true }),
    stamp('issued', 'Issued', 't.issued_at'),
  ],
};

const ATTENDANCE: DataTable = {
  key: 'attendance',
  name: 'Attendance',
  blurb: 'The cohort sessions you checked in to.',
  group: 'learning',
  needs: ['school'],
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
  // Every row is another person, by name and @username: the other side of a link (2026-11-14, the review, on the founder's two audiences).
  audience: 'others',
  sqlTable: 'friendships',
  from: `friendships t JOIN users u ON u.id = CASE WHEN t.requester_id = ?1 THEN t.recipient_id ELSE t.requester_id END AND u.display_name != ${DELETED}`,
  owner: '(t.requester_id = ?1 OR t.recipient_id = ?1)',
  where: "t.status IN ('pending', 'accepted')",
  idSql: 't.id',
  defaultSort: { key: 'askedOn', dir: 'desc' },
  read: 'sql',
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
  // Another person on every row, by name and @username.
  audience: 'others',
  sqlTable: 'follows',
  from: `follows t JOIN users u ON u.id = t.owner_id AND u.display_name != ${DELETED}`,
  owner: 't.follower_id = ?1',
  idSql: 't.owner_id',
  defaultSort: { key: 'since', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Unfollow from their page or a post.',
  columns: [c('name', 'Name', 'text', 'u.display_name', { sortable: true, searchable: true }), c('handle', 'Username', 'text', 'u.handle', { sortable: true, searchable: true, format: 'handle' }), stamp('since', 'Since', 't.created_at')],
};

const FOLLOWERS: DataTable = {
  key: 'followers',
  name: 'Followers',
  blurb: 'The people who follow you.',
  group: 'people',
  // Another person on every row, by name and @username.
  audience: 'others',
  sqlTable: 'follows',
  from: `follows t JOIN users u ON u.id = t.follower_id AND u.display_name != ${DELETED}`,
  owner: 't.owner_id = ?1',
  idSql: 't.follower_id',
  defaultSort: { key: 'since', dir: 'desc' },
  read: 'sql',
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
  needs: ['community'],
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
  // A coach's words and name: the other side of a link. Never shared with a coach, nor read by a super admin.
  audience: 'others',
  sqlTable: 'coach_notes',
  from: 'coach_notes t LEFT JOIN users u ON u.id = t.coach_id',
  owner: 't.student_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'written', dir: 'desc' },
  read: 'sql',
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
  needs: ['notifications'],
  // A note's title names other people ("<name> mentioned you") and its words quote them (a reply, a mention, a coach's note); some are body
  // and mind (the supplement and focus nudges). Only the person, and AI chat on a model that keeps nothing.
  audience: 'others',
  sqlTable: 'notifications',
  from: 'notifications t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'arrived', dir: 'desc' },
  read: 'sql',
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
    // Other people's words sit in a note's body (a reply, a mention, a coach's note): only its owner's own view selects them, whatever the audience.
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

// -----------------------------------------------------------------------------------------------------------------------------------
// Agency and Business metrics (2026-11-14, the founder: "Me and AI chat only"). Every one is audience 'others': a client's details, a
// brand's or a teammate's words, or the founder named it. Only the person, and AI chat on a model that keeps nothing; never a coach or an
// admin. Money is in the Agency's own currency (agency_settings.currency, rupees until changed), as Agency shows it, or an invoice's own.
// Never listed: a client link's or a team link's key, a password's hash or salt, a paper's link key, the bank on an invoice, a teammate's id.
// -----------------------------------------------------------------------------------------------------------------------------------

const AGENCY_CURRENCY = "COALESCE(s.currency, 'INR')";
const AGENCY_SETTINGS_JOIN = 'LEFT JOIN agency_settings s ON s.user_id = t.user_id';
const CLIENT_PATH = '/agency/clients/:id';
const ITEM_PATH = '/agency/items/:id';
/** A piece changes through Agency's own PATCH, with the device's day, which a move to Approved or Published dates itself by. */
function itemEdit(field: string, input: EditInput, more: Partial<ColumnEdit> = {}): ColumnEdit {
  return { method: 'PATCH', path: ITEM_PATH, field, input, recipe: 'todayQuery', ...more };
}

const AGENCY_CLIENTS: DataTable = {
  key: 'agencyClients',
  name: 'Agency clients',
  blurb: 'Every client in Agency, with their stage, fee and plan.',
  group: 'agency',
  audience: 'others',
  needs: ['agency'],
  sqlTable: 'agency_clients',
  from: `agency_clients t ${AGENCY_SETTINGS_JOIN}`,
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  privateSelect: { channels: 't.channels_json' },
  columns: [
    c('name', 'Client', 'text', 't.name', { sortable: true, searchable: true, notNull: true, edit: patch(CLIENT_PATH, 'name', 'text', { minLength: 1, maxLength: 80 }) }),
    c('contact', 'Contact', 'text', 't.contact_name', { sortable: true, searchable: true, edit: patch(CLIENT_PATH, 'contactName', 'text', { maxLength: 80 }) }),
    c('contactEmail', 'Their email', 'text', 't.contact_email', { searchable: true }),
    c('status', 'State', 'enum', 't.status', { options: AGENCY_CLIENT_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true, edit: patch(CLIENT_PATH, 'status', 'select') }),
    c('health', 'How it is going', 'enum', 't.health', { options: AGENCY_HEALTH_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true, edit: patch(CLIENT_PATH, 'health', 'select') }),
    c('stage', 'Stage', 'enum', 't.stage', { options: AGENCY_STAGE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('channels', 'Channels', 'summary', null, { derive: 'stringList', from: ['channels'] }),
    c('monthlyFee', 'Monthly fee', 'money', 't.retainer_cents', { currency: 'currency', sortable: true, notNull: true, edit: patch(CLIENT_PATH, 'retainerCents', 'money', { min: 0 }) }),
    c('pieces', 'Pieces a month', 'number', 't.pieces_per_month', { sortable: true, notNull: true, edit: patch(CLIENT_PATH, 'piecesPerMonth', 'number', { min: 0, max: 500, step: 1 }) }),
    c('hours', 'Hours a month', 'number', 't.hours_per_month', { sortable: true, notNull: true, format: 'hours', edit: patch(CLIENT_PATH, 'hoursPerMonth', 'number', { min: 0, max: 1000, step: 1 }) }),
    c('changes', 'Changes in each piece', 'number', 't.revisions_per_piece', {
      sortable: true,
      notNull: true,
      edit: { method: 'PUT', path: '/agency/clients/:id/lifecycle', field: 'revisionsPerPiece', input: 'number', min: 0, max: 20, step: 1, note: 'New pieces start with this many.' },
    }),
    c('renews', 'Renews on', 'date', 't.renewal_date', { sortable: true, filter: 'range', edit: patch(CLIENT_PATH, 'renewalDate', 'date', { nullable: true }) }),
    c('notes', 'Your notes', 'longtext', 't.notes', { searchable: true, format: 'inert', edit: patch(CLIENT_PATH, 'notes', 'longtext', { maxLength: 1000 }) }),
    c('formSent', 'Onboarding form sent', 'datetime', 't.onboarded_at', { sortable: true }),
    c('linkLocked', 'Link locked since', 'datetime', 't.portal_pass_set_at', { sortable: true }),
    hiddenCell('currency', AGENCY_CURRENCY),
    stamp('createdAt', 'Added', 't.created_at'),
    stamp('updatedAt', 'Changed', 't.updated_at', { filter: undefined }),
  ],
};

const AGENCY_PIECES: DataTable = {
  key: 'agencyPieces',
  name: 'Agency pieces',
  blurb: 'Every piece of client work, from idea to published.',
  group: 'agency',
  audience: 'others',
  needs: ['agency'],
  sqlTable: 'agency_items',
  from: `agency_items t LEFT JOIN agency_clients cl ON cl.id = t.client_id AND cl.user_id = t.user_id ${AGENCY_SETTINGS_JOIN}`,
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  columns: [
    c('title', 'Piece', 'text', 't.title', { sortable: true, searchable: true, notNull: true, edit: itemEdit('title', 'text', { minLength: 1, maxLength: 120 }) }),
    c('client', 'Client', 'text', 'cl.name', { sortable: true, searchable: true }),
    c('kind', 'Kind', 'enum', 't.kind', { options: DELIVERABLE_KIND_OPTIONS, sortable: true, filter: 'pick', notNull: true, edit: itemEdit('kind', 'select') }),
    c('channel', 'Channel', 'text', 't.platform', { sortable: true, searchable: true, edit: itemEdit('platform', 'text', { maxLength: 30 }) }),
    c('stage', 'Stage', 'enum', 't.stage', { options: DELIVERABLE_STAGE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true, edit: itemEdit('stage', 'select', { note: 'Approved and Published take today’s date.' }) }),
    c('due', 'Due', 'date', 't.due_date', { sortable: true, filter: 'range', edit: itemEdit('dueDate', 'date', { nullable: true }) }),
    c('goesLive', 'Goes live', 'date', 't.publish_date', { sortable: true, filter: 'range', edit: itemEdit('publishDate', 'date', { nullable: true }) }),
    c('fee', 'Fee', 'money', 't.fee_cents', { currency: 'currency', sortable: true, notNull: true, edit: itemEdit('feeCents', 'money', { min: 0 }) }),
    c('changesUsed', 'Changes used', 'number', 't.revisions', { sortable: true, notNull: true }),
    c('changesIncluded', 'Changes included', 'number', 'COALESCE(t.revisions_allowed, cl.revisions_per_piece)'),
    c('month', 'Retainer month', 'number', 't.cycle_n', { sortable: true }),
    c('trial', 'Trial piece', 'bool', 't.trial', { filter: 'pick', notNull: true }),
    c('link', 'Link', 'text', 't.link', { format: 'inert' }),
    c('notes', 'Your notes', 'longtext', 't.notes', { searchable: true, format: 'inert', edit: itemEdit('notes', 'longtext', { maxLength: 1000 }) }),
    c('approvedOn', 'Approved on', 'date', 't.approved_day', { sortable: true }),
    c('publishedOn', 'Published on', 'date', 't.published_day', { sortable: true, filter: 'range' }),
    hiddenCell('currency', AGENCY_CURRENCY),
    stamp('createdAt', 'Added', 't.created_at'),
    stamp('updatedAt', 'Changed', 't.updated_at', { filter: undefined }),
  ],
};

/** A team line's writer, named as Agency names them: you, or the teammate's name while their account lives. Their id is never read out. */
const NOTE_TEAMMATE_SQL = `CASE WHEN t.author = 'team' THEN CASE WHEN t.author_id = ?1 THEN 'You' WHEN au.display_name IS NOT NULL AND au.display_name != ${DELETED} THEN au.display_name ELSE 'A former team member' END END`;
const AGENCY_NOTES: DataTable = {
  key: 'agencyNotes',
  name: 'Agency piece notes',
  blurb: 'The lines on your pieces, from you, your client, the brand and your team.',
  group: 'agency',
  audience: 'others',
  needs: ['agency'],
  sqlTable: 'agency_notes',
  from: 'agency_notes t LEFT JOIN agency_items i ON i.id = t.item_id AND i.user_id = t.user_id LEFT JOIN agency_clients cl ON cl.id = i.client_id AND cl.user_id = t.user_id LEFT JOIN users au ON au.id = t.author_id',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A note stays as it was written. Write a new one on the piece in Agency.',
  columns: [
    stamp('createdAt', 'Written', 't.created_at'),
    c('piece', 'Piece', 'text', 'i.title', { sortable: true, searchable: true }),
    c('client', 'Client', 'text', 'cl.name', { sortable: true, searchable: true }),
    c('from', 'From', 'enum', "CASE WHEN t.author = 'client' AND t.via_team_link = 1 THEN 'clientTeam' ELSE t.author END", { options: NOTE_FROM_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('teammate', 'Teammate', 'text', NOTE_TEAMMATE_SQL),
    c('kind', 'Kind', 'enum', 't.kind', { options: NOTE_KIND_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('shared', 'Shown to the client', 'bool', "CASE WHEN t.author = 'me' THEN t.shared END", { filter: 'pick' }),
    c('words', 'Words', 'longtext', 't.body', { searchable: true, format: 'inert' }),
  ],
};

const AGENCY_TIME: DataTable = {
  key: 'agencyTime',
  name: 'Agency time',
  blurb: 'The time you logged for each client.',
  group: 'agency',
  audience: 'others',
  needs: ['agency'],
  sqlTable: 'agency_time',
  from: 'agency_time t LEFT JOIN agency_clients cl ON cl.id = t.client_id AND cl.user_id = t.user_id LEFT JOIN agency_items i ON i.id = t.item_id AND i.user_id = t.user_id',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'day', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Time is logged and taken off on the client’s page in Agency.',
  columns: [
    day('day', 'Day', 't.day'),
    c('client', 'Client', 'text', 'cl.name', { sortable: true, searchable: true }),
    c('piece', 'Piece', 'text', 'i.title', { sortable: true, searchable: true }),
    c('minutes', 'Minutes', 'number', 't.minutes', { sortable: true, notNull: true, format: 'minutes' }),
    c('billable', 'Billable', 'bool', 't.billable', { sortable: true, filter: 'pick', notNull: true }),
    c('note', 'Note', 'text', 't.note', { searchable: true, format: 'inert' }),
    stamp('createdAt', 'Logged', 't.created_at', { filter: undefined }),
  ],
};

/**
 * A retainer's month after its discount, in SQL: `retainerMonthlyCents` (agency.ts) on the row. This file is a leaf and cannot import the cap,
 * so it is written here and a shared test holds it to RETAINER_DISCOUNT_MAX_BPS and to retainerMonthlyCents on real numbers.
 */
export const RETAINER_DISCOUNT_CAP_BPS = 5000;
// The CAST keeps the division whole even if a number ever reached SQLite as a real one (both columns are INTEGER, so it never moves a stored row).
export const RETAINER_MONTH_SQL = `(t.fee_cents - CAST((t.fee_cents * MIN(MAX(t.discount_bps, 0), ${RETAINER_DISCOUNT_CAP_BPS}) + 5000) / 10000 AS INTEGER))`;

const AGENCY_RETAINERS: DataTable = {
  key: 'agencyRetainers',
  name: 'Agency retainers',
  blurb: 'Retainers you offered your clients, and the ones running.',
  group: 'agency',
  audience: 'others',
  needs: ['agency'],
  sqlTable: 'agency_retainers',
  from: `agency_retainers t LEFT JOIN agency_clients cl ON cl.id = t.client_id AND cl.user_id = t.user_id ${AGENCY_SETTINGS_JOIN}`,
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  columns: [
    c('client', 'Client', 'text', 'cl.name', { sortable: true, searchable: true }),
    c('status', 'State', 'enum', 't.status', { options: RETAINER_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('months', 'Months', 'number', 't.months', { sortable: true }),
    // The month's fee after the discount, as Agency shows it and bills each month (retainerMonthlyCents in agency.ts: the discount held to 0
    // to its cap and rounded to the nearest cent, half up; integer division of whole numbers, so never a float). An offer not yet chosen has
    // no discount yet, so it reads the fee offered (the review, 2026-11-14: it read the fee before the discount).
    c('fee', 'Fee a month', 'money', RETAINER_MONTH_SQL, { currency: 'currency', sortable: true, notNull: true }),
    c('discount', 'Discount', 'number', 't.discount_bps / 100.0', { sortable: true, notNull: true, format: 'percent' }),
    c('feeBefore', 'Fee before the discount', 'money', 't.fee_cents', { currency: 'currency', sortable: true, notNull: true }),
    c('pieces', 'Pieces a month', 'number', 't.pieces_per_month', { sortable: true, notNull: true }),
    c('changes', 'Changes in each piece', 'number', 't.revisions_per_piece', { notNull: true }),
    c('starts', 'Starts', 'date', 't.start_day', { sortable: true, filter: 'range' }),
    c('autoSend', 'Sends each month’s invoice', 'bool', 't.auto_send', {
      filter: 'pick',
      notNull: true,
      edit: { method: 'POST', path: '/agency/retainers/:id/auto-send', field: 'on', input: 'toggle', when: 'retainerOpen', note: 'Off keeps each month’s invoice a draft for you to send.' },
    }),
    c('chosenAt', 'Chosen at', 'datetime', 't.chosen_at', { sortable: true }),
    c('confirmedAt', 'Started at', 'datetime', 't.confirmed_at', { sortable: true }),
    c('endedAt', 'Ended at', 'datetime', 't.ended_at', { sortable: true }),
    hiddenCell('currency', AGENCY_CURRENCY),
    stamp('createdAt', 'Offered', 't.created_at'),
  ],
};

const AGENCY_LOG: DataTable = {
  key: 'agencyLog',
  name: 'Agency client log',
  blurb: 'What happened with each client, line by line.',
  group: 'agency',
  audience: 'others',
  needs: ['agency'],
  sqlTable: 'agency_log',
  from: 'agency_log t LEFT JOIN agency_clients cl ON cl.id = t.client_id AND cl.user_id = t.user_id',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A record of what happened, so it stays as it is.',
  columns: [
    stamp('createdAt', 'When', 't.created_at'),
    c('client', 'Client', 'text', 'cl.name', { sortable: true, searchable: true }),
    c('who', 'Who', 'enum', 't.actor', { options: AGENCY_LOG_ACTOR_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('about', 'About', 'enum', 't.kind', { options: AGENCY_LOG_KIND_OPTIONS, otherLabel: 'Other', sortable: true, filter: 'pick', notNull: true }),
    c('what', 'What happened', 'text', 't.text', { searchable: true, format: 'inert' }),
  ],
};

const AGENCY_TEAM: DataTable = {
  key: 'agencyTeam',
  name: 'Agency team',
  blurb: 'The people you asked onto your Agency, their roles and what they can open.',
  group: 'agency',
  audience: 'others',
  needs: ['agency'],
  sqlTable: 'agency_team',
  from: 'agency_team t LEFT JOIN users u ON u.id = t.member_id LEFT JOIN agency_clients cl ON cl.id = t.client_id AND cl.user_id = t.owner_id',
  owner: 't.owner_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'asked', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Change a teammate’s role and access under Team in Agency.',
  columns: [
    c('member', 'Teammate', 'text', `CASE WHEN u.display_name IS NULL OR u.display_name = ${DELETED} THEN 'A former member' ELSE u.display_name END`, { sortable: true, searchable: true, notNull: true }),
    c('handle', 'Username', 'text', `CASE WHEN u.display_name = ${DELETED} THEN NULL ELSE u.handle END`, { searchable: true, format: 'handle' }),
    c('role', 'Role', 'enum', 't.role', { options: TEAM_ROLE_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('status', 'State', 'enum', 't.status', { options: TEAM_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('forClient', 'For client', 'text', 'cl.name', { sortable: true, searchable: true }),
    c('overview', 'Overview', 'enum', "COALESCE(json_extract(t.access_json, '$.overview'), 'off')", { options: TEAM_LEVEL_OPTIONS, ordered: true, filter: 'pick', notNull: true }),
    c('pipeline', 'Pipeline', 'enum', "COALESCE(json_extract(t.access_json, '$.pipeline'), 'off')", { options: TEAM_LEVEL_OPTIONS, ordered: true, filter: 'pick', notNull: true }),
    c('clients', 'Clients', 'enum', "COALESCE(json_extract(t.access_json, '$.clients'), 'off')", { options: TEAM_LEVEL_OPTIONS, ordered: true, filter: 'pick', notNull: true }),
    c('paperwork', 'Paperwork', 'enum', "COALESCE(json_extract(t.access_json, '$.paperwork'), 'off')", { options: TEAM_LEVEL_OPTIONS, ordered: true, filter: 'pick', notNull: true }),
    stamp('asked', 'Asked on', 't.invited_at'),
    c('joined', 'Joined', 'datetime', 't.joined_at', { sortable: true }),
    c('removed', 'Left or removed', 'datetime', 't.removed_at', { sortable: true }),
    c('endedBy', 'Ended by', 'enum', "CASE WHEN t.ended_by = 'member' AND t.joined_at IS NULL THEN 'declined' ELSE t.ended_by END", { options: TEAM_ENDED_BY_OPTIONS, filter: 'pick' }),
  ],
};

const INVOICE_PATH = '/agency/invoices/:id';
const AGENCY_INVOICES: DataTable = {
  key: 'agencyInvoices',
  name: 'Agency invoices',
  blurb: 'Every invoice you made in Agency, with its total and state.',
  group: 'agencyPaper',
  audience: 'others',
  needs: ['agency'],
  sqlTable: 'invoices',
  from: 'invoices t LEFT JOIN agency_clients cl ON cl.id = t.agency_client_id AND cl.user_id = t.user_id',
  owner: 't.user_id = ?1',
  // Finance's own invoices (none since Finance's invoice screen went, 2026-11-03) have no Agency client and are not Agency's.
  where: 't.agency_client_id IS NOT NULL',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  columns: [
    c('number', 'Number', 'text', 't.number', { sortable: true, searchable: true, notNull: true }),
    c('billedTo', 'Billed to', 'text', 't.client_name', { sortable: true, searchable: true, notNull: true }),
    c('client', 'Client', 'text', 'cl.name', { sortable: true, searchable: true }),
    c('total', 'Total', 'money', 't.total_cents', { currency: 'currency', sortable: true, notNull: true }),
    c('currency', 'Currency', 'enum', 't.currency', { options: CURRENCY_OPTIONS, filter: 'pick', notNull: true }),
    c('status', 'State', 'enum', 't.status', { options: INVOICE_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    day('issued', 'Issued', 't.issue_date'),
    c('due', 'Due', 'date', 't.due_date', {
      sortable: true,
      filter: 'range',
      edit: patch(INVOICE_PATH, 'dueDate', 'date', { nullable: true, when: 'paperOpen', note: 'A sent invoice shows your client it was revised.' }),
    }),
    c('lines', 'Lines', 'number', 'json_array_length(t.items_json)'),
    c('note', 'Note', 'text', 't.note', { searchable: true, format: 'inert', edit: patch(INVOICE_PATH, 'note', 'longtext', { maxLength: 500, when: 'paperOpen', note: 'A sent invoice shows your client it was revised.' }) }),
    c('fromRetainer', 'From a retainer', 'bool', 't.agency_cycle_id IS NOT NULL', { filter: 'pick', notNull: true }),
    c('paidAt', 'Paid at', 'datetime', 't.paid_at', { sortable: true, filter: 'range' }),
    c('revisedAt', 'Revised at', 'datetime', 't.revised_at', { sortable: true }),
    stamp('createdAt', 'Made', 't.created_at'),
  ],
};

const AGENCY_AGREEMENTS: DataTable = {
  key: 'agencyAgreements',
  name: 'Agency agreements',
  blurb: 'Agreements you made for clients, sent, signed or void.',
  group: 'agencyPaper',
  audience: 'others',
  needs: ['agency'],
  sqlTable: 'agency_contracts',
  from: 'agency_contracts t LEFT JOIN agency_clients cl ON cl.id = t.client_id AND cl.user_id = t.user_id',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'updatedAt', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'An agreement is changed on its own page in Agency, as paper.',
  columns: [
    c('title', 'Agreement', 'text', 't.title', { sortable: true, searchable: true, notNull: true }),
    c('client', 'Client', 'text', 'cl.name', { sortable: true, searchable: true }),
    c('status', 'State', 'enum', 't.status', { options: CONTRACT_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('sentAt', 'Sent at', 'datetime', 't.sent_at', { sortable: true, filter: 'range' }),
    c('signedAt', 'Signed at', 'datetime', 't.signed_at', { sortable: true, filter: 'range' }),
    c('revisedAt', 'Revised at', 'datetime', 't.revised_at', { sortable: true }),
    stamp('updatedAt', 'Changed', 't.updated_at'),
    stamp('createdAt', 'Made', 't.created_at', { filter: undefined }),
  ],
};

const AGENCY_DOCUMENTS: DataTable = {
  key: 'agencyDocuments',
  name: 'Agency documents',
  blurb: 'Session summaries, trial terms, proposals and monthly reports.',
  group: 'agencyPaper',
  audience: 'others',
  needs: ['agency'],
  sqlTable: 'agency_docs',
  from: 'agency_docs t LEFT JOIN agency_clients cl ON cl.id = t.client_id AND cl.user_id = t.user_id',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'updatedAt', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A document is changed on its own page in Agency, as paper.',
  columns: [
    c('title', 'Document', 'text', 't.title', { sortable: true, searchable: true, notNull: true }),
    c('kind', 'Kind', 'enum', 't.kind', { options: AGENCY_DOC_KIND_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('client', 'Client', 'text', 'cl.name', { sortable: true, searchable: true }),
    c('status', 'State', 'enum', 't.status', { options: AGENCY_DOC_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('sentAt', 'Sent at', 'datetime', 't.sent_at', { sortable: true, filter: 'range' }),
    c('approvedAt', 'Approved at', 'datetime', 't.approved_at', { sortable: true, filter: 'range' }),
    c('revisedAt', 'Revised at', 'datetime', 't.revised_at', { sortable: true }),
    stamp('updatedAt', 'Changed', 't.updated_at'),
    stamp('createdAt', 'Made', 't.created_at', { filter: undefined }),
  ],
};

const AGENCY_TEMPLATES: DataTable = {
  key: 'agencyTemplates',
  name: 'Agency templates',
  blurb: 'Invoices, agreements, documents and email notes you saved to start from.',
  group: 'agencyPaper',
  audience: 'others',
  needs: ['agency'],
  sqlTable: 'agency_templates',
  from: 'agency_templates t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'updatedAt', dir: 'desc' },
  read: 'sql',
  columns: [
    c('name', 'Template', 'text', 't.name', { sortable: true, searchable: true, notNull: true, edit: patch('/agency/templates/:id', 'name', 'text', { minLength: 1, maxLength: 60 }) }),
    c('kind', 'Kind', 'enum', 't.kind', { options: TEMPLATE_KIND_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('lines', 'Lines', 'number', "CASE WHEN t.kind = 'invoice' THEN json_array_length(t.items_json) END"),
    stamp('updatedAt', 'Changed', 't.updated_at'),
    stamp('createdAt', 'Made', 't.created_at', { filter: undefined }),
  ],
};

const KPI_PATH = '/reviews/kpis/:id';
const BUSINESS_METRICS: DataTable = {
  key: 'businessMetrics',
  name: 'Business metrics',
  blurb: 'The numbers you track for your business, each with its target.',
  group: 'business',
  audience: 'others',
  needs: ['reviews'],
  needsSwitch: 'businessMetrics',
  sqlTable: 'kpis',
  from: `kpis t ${AGENCY_SETTINGS_JOIN}`,
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  privateSelect: { unit: 't.unit', target: 't.target', currency: AGENCY_CURRENCY },
  columns: [
    c('name', 'Metric', 'text', 't.name', { sortable: true, searchable: true, notNull: true, edit: patch(KPI_PATH, 'name', 'text', { minLength: 1, maxLength: 60 }) }),
    c('unit', 'Counted as', 'enum', 't.unit', { options: KPI_UNIT_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('direction', 'Good when', 'enum', 't.direction', { options: KPI_DIRECTION_OPTIONS, filter: 'pick', notNull: true }),
    c('cadence', 'How often', 'enum', 't.cadence', { options: KPI_CADENCE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true, edit: patch(KPI_PATH, 'cadence', 'select') }),
    c('target', 'Target', 'summary', null, { derive: 'kpiAmount', from: ['unit', 'target', 'currency'], sortable: true, sortSql: 't.target', notNull: true }),
    c('source', 'Read from', 'enum', 't.source', { options: KPI_SOURCE_OPTIONS, otherLabel: 'Typed in', sortable: true, filter: 'pick', notNull: true }),
    stamp('createdAt', 'Added', 't.created_at'),
  ],
};

const BUSINESS_METRIC_VALUES: DataTable = {
  key: 'businessMetricValues',
  name: 'Business metric values',
  blurb: 'Each period’s number you typed for a business metric.',
  group: 'business',
  audience: 'others',
  needs: ['reviews'],
  needsSwitch: 'businessMetrics',
  sqlTable: 'kpi_values',
  // A value has no owner of its own: it is the person's through its metric (kpis.user_id, through idx_kpis_user_created).
  from: 'kpi_values t JOIN kpis k ON k.id = t.kpi_id LEFT JOIN agency_settings s ON s.user_id = k.user_id',
  owner: 'k.user_id = ?1',
  idSql: "t.kpi_id || ':' || t.period_start",
  // By metric, newest first, then each metric's periods newest first (`byMetric`): the walk idx_kpis_user_created and each metric's primary
  // key make in reverse, so no page sorts (the review, 2026-11-14: by period alone, every page read all of the person's values and sorted
  // them in a temporary B-tree, since a value has no owner column an index could start on). Tap Period starts to sort by the period alone.
  defaultSort: { key: 'byMetric', dir: 'desc' },
  read: 'sql',
  privateSelect: { unit: 'k.unit', amount: 't.value', currency: AGENCY_CURRENCY },
  readOnlyWhy: 'Type a period’s number in Reviews, under Business metrics.',
  columns: [
    c('metric', 'Metric', 'text', 'k.name', { sortable: true, searchable: true, notNull: true }),
    day('period', 'Period starts', 't.period_start'),
    c('cadence', 'How often', 'enum', 'k.cadence', { options: KPI_CADENCE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('value', 'Value', 'summary', null, { derive: 'kpiAmount', from: ['unit', 'amount', 'currency'], sortable: true, sortSql: 't.value', notNull: true }),
    c('note', 'Note', 'text', 't.note', { searchable: true, format: 'inert' }),
    stamp('updatedAt', 'Changed', 't.updated_at', { filter: undefined }),
    // The default order, never a grid column. The rowid is the index's own last column (idx_kpis_user_created is (user_id, created_at),
    // rowid after them), so two metrics added in the same moment keep one order and the periods under each need no sort step.
    c('byMetric', 'By metric', 'datetime', 'k.created_at', { hidden: true, sortable: true, notNull: true, sortTerms: ['k.created_at', 'k.rowid', 't.period_start'] }),
  ],
};

// -----------------------------------------------------------------------------------------------------------------------------------
// Shop and creator tools (2026-11-14, the founder: "ok, add them"). A creator's own records ('own': products, coupons, hours, tracked posts and
// links, Auto-DMs, funnels, after-purchase messages, broadcasts, the portfolio, and the reviews they wrote themselves) follow the old rules.
// Those that hold another person's details or words ('others': who booked, a buyer's paid question, a review someone wrote, a lead, who was
// invited to a course, and on the buyer's side the creator a session is with, who invited you to a private course and its title, and the
// answer to a question you asked) reach only the person and AI chat on a model that keeps nothing.
// Never listed: a coupon's code or a link's code (anyone holding one can use it), a meeting or download link, a paid post's words, a lead's
// email, a person's id, a click's hashed address. Money is integer cents in each product's own currency.
// -----------------------------------------------------------------------------------------------------------------------------------

const PRODUCT_PATH = '/studio/products/:id';
/**
 * The most a product's points price can be in Shop: Studio reads it through its own `int()`, which holds a number to 0..1,000,000, so a larger
 * one would be saved quietly as 1,000,000 points. The table refuses it out loud instead (a test holds the two together). A money price has no
 * such quiet cap since 2026-11-14: its most is `PRODUCT_MONEY_MAX` in money.ts, ₹10,00,000, which Studio and the table refuse past in words.
 */
export const PRODUCT_POINTS_MAX = 1_000_000;
/** A product's state as Shop shows it: a live course reads Public (productStatusLabel), so the select offers both, and Public is sent as live. */
const productStatusSql = (a: string): string => `CASE WHEN ${a}.status = 'live' AND ${a}.kind = 'course' THEN 'public' ELSE ${a}.status END`;
/** A person on the other side of a record, by name, as the app names them (a deleted account reads "Deleted member", as nameOf does). */
const personName = (a: string): string => `COALESCE(${a}.display_name, ${DELETED})`;
const personHandle = (a: string): string => `CASE WHEN ${a}.display_name = ${DELETED} THEN NULL ELSE ${a}.handle END`;
/** Minutes after midnight as HH:MM (1440, a day's end, reads 24:00), for a session hour. */
const minuteClock = (expr: string): string => `printf('%02d:%02d', ${expr} / 60, ${expr} % 60)`;

const PRODUCTS: DataTable = {
  key: 'products',
  name: 'Products',
  blurb: 'Everything you sell in Shop, with its price and state.',
  group: 'shop',
  needs: ['shop'],
  sqlTable: 'products',
  from: 'products t',
  owner: 't.owner_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  columns: [
    c('title', 'Product', 'text', 't.title', { sortable: true, searchable: true, notNull: true, edit: patch(PRODUCT_PATH, 'title', 'text', { minLength: 1, maxLength: 120 }) }),
    c('kind', 'Kind', 'enum', 't.kind', { options: PRODUCT_KIND_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('status', 'State', 'enum', productStatusSql('t'), {
      options: PRODUCT_STATUS_OPTIONS,
      ordered: true,
      sortable: true,
      filter: 'pick',
      notNull: true,
      edit: patch(PRODUCT_PATH, 'status', 'select', { send: { public: 'live' }, note: 'Private is for a course only. Archived takes no new buyers.' }),
    }),
    c('pricePoints', 'Price in points', 'number', 't.price_points', { sortable: true, notNull: true, edit: patch(PRODUCT_PATH, 'pricePoints', 'number', { min: 0, max: PRODUCT_POINTS_MAX, step: 1 }) }),
    c('price', 'Price in money', 'money', 't.price_cents', {
      currency: 'currency',
      sortable: true,
      notNull: true,
      edit: patch(PRODUCT_PATH, 'priceCents', 'money', { min: 0, max: PRODUCT_MONEY_MAX }),
    }),
    c('currency', 'Currency', 'enum', 't.currency', { options: CURRENCY_OPTIONS, filter: 'pick', notNull: true }),
    c('payWhatYouWant', 'Pay what you want', 'bool', 't.pwyw', { filter: 'pick', notNull: true }),
    c('startsAt', 'Starts', 'datetime', 't.starts_at', { sortable: true }),
    c('minutes', 'How long', 'number', 't.duration_min', { sortable: true, format: 'minutes' }),
    c('seats', 'Seats', 'number', 't.capacity', { sortable: true }),
    c('answerDays', 'Answers within days', 'number', 't.response_days'),
    c('certificate', 'Gives a certificate', 'bool', 't.certificate', { filter: 'pick', notNull: true }),
    c('minPoints', 'Unlocks at points', 'number', 't.min_points', { sortable: true, notNull: true }),
    c('minXp', 'Unlocks at xp', 'number', 't.min_xp', { sortable: true, notNull: true }),
    c('description', 'About it', 'longtext', 't.description', { searchable: true, format: 'inert', edit: patch(PRODUCT_PATH, 'description', 'longtext', { maxLength: 2000 }) }),
    stamp('createdAt', 'Added', 't.created_at'),
    stamp('updatedAt', 'Changed', 't.updated_at', { filter: undefined }),
  ],
};

const COUPONS: DataTable = {
  key: 'coupons',
  name: 'Coupons',
  blurb: 'Your discounts, what each one is for and how often it was used.',
  group: 'shop',
  needs: ['shop'],
  sqlTable: 'coupons',
  from: 'coupons t LEFT JOIN products p ON p.id = t.product_id AND p.owner_id = t.owner_id',
  owner: 't.owner_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'createdAt', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Make or remove a coupon on its product in Shop.',
  columns: [
    c('product', 'For', 'text', "CASE WHEN t.product_id IS NULL THEN 'Every product' ELSE p.title END", { sortable: true, searchable: true }),
    c('percentOff', 'Off', 'number', 't.percent_off', { sortable: true, notNull: true, format: 'percent' }),
    c('used', 'Times used', 'number', 't.uses', { sortable: true, notNull: true }),
    c('usesAllowed', 'Uses allowed', 'number', 't.max_uses', { sortable: true }),
    stamp('createdAt', 'Made', 't.created_at'),
  ],
};

const BOOKINGS: DataTable = {
  key: 'bookings',
  name: 'Bookings',
  blurb: 'Sessions people booked with you, and where each one stands.',
  group: 'shop',
  audience: 'others',
  needs: ['shop'],
  sqlTable: 'bookings',
  from: 'bookings t LEFT JOIN products p ON p.id = t.product_id LEFT JOIN users b ON b.id = t.buyer_id',
  owner: 't.owner_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'starts', dir: 'desc' },
  read: 'sql',
  privateSelect: { answers: 't.intake_json' },
  readOnlyWhy: 'Confirm, cancel or finish a session in Shop, under Bookings, where the buyer is told.',
  columns: [
    c('product', 'Session', 'text', 'p.title', { sortable: true, searchable: true }),
    c('person', 'Booked by', 'text', personName('b'), { sortable: true, searchable: true, notNull: true }),
    stamp('starts', 'Starts', 't.starts_at'),
    c('ends', 'Ends', 'datetime', 't.ends_at', { sortable: true }),
    c('status', 'State', 'enum', 't.status', { options: BOOKING_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('note', 'Their note', 'longtext', 't.note', { searchable: true, format: 'inert' }),
    c('answers', 'Their answers', 'summary', null, { derive: 'stringList', from: ['answers'] }),
    stamp('bookedAt', 'Booked', 't.created_at', { filter: undefined }),
  ],
};

const SESSION_HOURS: DataTable = {
  key: 'sessionHours',
  name: 'Session hours',
  blurb: 'The hours each week people can book a session with you.',
  group: 'shop',
  needs: ['shop'],
  sqlTable: 'availability',
  from: 'availability t',
  owner: 't.owner_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'day', dir: 'asc' },
  read: 'sql',
  readOnlyWhy: 'Change your hours in Shop, under Bookings.',
  columns: [
    // Sunday first, as Shop lists them (ORDER BY weekday, start_min), walked by its index to the rowid, so no page sorts.
    c('day', 'Day', 'enum', 't.weekday', { options: WEEKDAY_SUNDAY_FIRST_OPTIONS, sortable: true, filter: 'pick', notNull: true, sortTerms: ['t.weekday', 't.start_min', 't.rowid'] }),
    c('from', 'From', 'time', minuteClock('t.start_min'), { sortable: true, sortSql: 't.start_min', notNull: true }),
    c('until', 'Until', 'time', minuteClock('t.end_min'), { notNull: true }),
  ],
};

const SESSION_DAYS: DataTable = {
  key: 'sessionDays',
  name: 'Days with other hours',
  blurb: 'Days you closed, or gave their own session hours.',
  group: 'shop',
  needs: ['shop'],
  sqlTable: 'availability_overrides',
  from: 'availability_overrides t',
  owner: 't.owner_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'day', dir: 'desc' },
  read: 'sql',
  privateSelect: { ranges: 't.ranges_json' },
  readOnlyWhy: 'Change a day’s hours in Shop, under Bookings.',
  columns: [
    day('day', 'Day', 't.date'),
    c('closed', 'Closed all day', 'bool', "COALESCE(json_array_length(t.ranges_json), 0) = 0", { filter: 'pick', notNull: true }),
    c('hours', 'Its hours', 'summary', null, { derive: 'minuteRanges', from: ['ranges'] }),
  ],
};

const COURSE_INVITES: DataTable = {
  key: 'courseInvites',
  name: 'Course invites',
  blurb: 'The people you invited to your private courses.',
  group: 'shop',
  audience: 'others',
  needs: ['shop'],
  sqlTable: 'product_invites',
  // An invite has no owner of its own: it is the person's through their course (products.owner_id).
  from: 'product_invites t JOIN products p ON p.id = t.product_id LEFT JOIN users u ON u.id = t.user_id',
  owner: 'p.owner_id = ?1',
  idSql: "t.product_id || ':' || t.user_id",
  // By course, newest first, then each course's invites newest first: the walk the products and invites indexes make (to their rowids), so no
  // page sorts. Tap Invited on to sort by the day alone.
  defaultSort: { key: 'byCourse', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Invite people, or take an invite back, on the course in Shop.',
  columns: [
    c('course', 'Course', 'text', 'p.title', { sortable: true, searchable: true, notNull: true }),
    c('person', 'Invited', 'text', personName('u'), { sortable: true, searchable: true, notNull: true }),
    c('handle', 'Username', 'text', personHandle('u'), { searchable: true, format: 'handle' }),
    c('courseState', 'Course state', 'enum', productStatusSql('p'), { options: PRODUCT_STATUS_OPTIONS, filter: 'pick', notNull: true }),
    stamp('invited', 'Invited on', 't.created_at'),
    c('byCourse', 'By course', 'datetime', 'p.created_at', { hidden: true, sortable: true, notNull: true, sortTerms: ['p.created_at', 'p.rowid', 't.created_at', 't.rowid'] }),
  ],
};

const PRIORITY_DMS: DataTable = {
  key: 'priorityDms',
  name: 'Priority DMs',
  blurb: 'Paid questions people sent you, and your answers.',
  group: 'shop',
  audience: 'others',
  needs: ['shop'],
  sqlTable: 'dm_requests',
  from: 'dm_requests t LEFT JOIN products p ON p.id = t.product_id LEFT JOIN users b ON b.id = t.buyer_id',
  owner: 't.owner_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'asked', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Answer a question in Shop, under Priority DMs, where the buyer is told.',
  columns: [
    c('person', 'From', 'text', personName('b'), { sortable: true, searchable: true, notNull: true }),
    c('product', 'Product', 'text', 'p.title', { sortable: true, searchable: true }),
    c('question', 'Question', 'longtext', 't.question', { searchable: true, format: 'inert' }),
    c('answer', 'Your answer', 'longtext', 't.answer', { searchable: true, format: 'inert' }),
    c('status', 'State', 'enum', 't.status', { options: DM_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('answerBy', 'Answer promised by', 'datetime', 't.due_at', { sortable: true }),
    c('answeredAt', 'Answered at', 'datetime', 't.answered_at', { sortable: true, filter: 'range' }),
    stamp('asked', 'Asked', 't.created_at'),
  ],
};

const PRODUCT_REVIEWS: DataTable = {
  key: 'productReviews',
  name: 'Reviews of your products',
  blurb: 'What buyers wrote about your products, and which ones show.',
  group: 'shop',
  audience: 'others',
  needs: ['shop'],
  sqlTable: 'testimonials',
  from: 'testimonials t LEFT JOIN products p ON p.id = t.product_id LEFT JOIN users a ON a.id = t.author_id',
  owner: 't.owner_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'written', dir: 'desc' },
  read: 'sql',
  columns: [
    c('product', 'Product', 'text', 'p.title', { sortable: true, searchable: true }),
    c('person', 'By', 'text', personName('a'), { sortable: true, searchable: true, notNull: true }),
    c('rating', 'Rating', 'enum', 't.rating', { options: RATING_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('words', 'Words', 'longtext', 't.body', { searchable: true, format: 'inert' }),
    c('shown', 'Shown on the product', 'bool', 't.approved', {
      sortable: true,
      filter: 'pick',
      notNull: true,
      edit: { method: 'POST', path: '/studio/testimonials/:id', field: 'approved', input: 'toggle', note: 'A shown review is on the product’s page for anyone.' },
    }),
    stamp('written', 'Written', 't.created_at'),
  ],
};

const MY_BOOKINGS: DataTable = {
  key: 'myBookings',
  name: 'Sessions you booked',
  blurb: 'Sessions you booked with creators, and where each one stands.',
  group: 'purchases',
  // Each row names the creator the session is with: the other side of the booking, as the seller's Bookings names the buyer.
  audience: 'others',
  needs: ['library'],
  sqlTable: 'bookings',
  from: 'bookings t LEFT JOIN products p ON p.id = t.product_id LEFT JOIN users ow ON ow.id = t.owner_id',
  owner: 't.buyer_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'starts', dir: 'desc' },
  read: 'sql',
  privateSelect: { answers: 't.intake_json' },
  readOnlyWhy: 'Move or cancel a session in My purchases.',
  columns: [
    c('product', 'Session', 'text', 'p.title', { sortable: true, searchable: true }),
    c('host', 'With', 'text', personName('ow'), { sortable: true, searchable: true, notNull: true }),
    stamp('starts', 'Starts', 't.starts_at'),
    c('ends', 'Ends', 'datetime', 't.ends_at', { sortable: true }),
    c('status', 'State', 'enum', 't.status', { options: BOOKING_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('note', 'Your note', 'longtext', 't.note', { searchable: true, format: 'inert' }),
    c('answers', 'Your answers', 'summary', null, { derive: 'stringList', from: ['answers'] }),
    stamp('bookedAt', 'Booked', 't.created_at', { filter: undefined }),
  ],
};

const MY_QUESTIONS: DataTable = {
  key: 'myQuestions',
  name: 'Questions you asked',
  blurb: 'Priority DMs you paid for, and the answers you got.',
  group: 'purchases',
  // The answer is the creator's own words.
  audience: 'others',
  needs: ['library'],
  sqlTable: 'dm_requests',
  from: 'dm_requests t LEFT JOIN products p ON p.id = t.product_id LEFT JOIN users ow ON ow.id = t.owner_id',
  owner: 't.buyer_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'asked', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A question is sent once it is paid for, and the answer is the creator’s.',
  columns: [
    c('person', 'To', 'text', personName('ow'), { sortable: true, searchable: true, notNull: true }),
    c('product', 'Product', 'text', 'p.title', { sortable: true, searchable: true }),
    c('question', 'Your question', 'longtext', 't.question', { searchable: true, format: 'inert' }),
    c('answer', 'Answer', 'longtext', 't.answer', { searchable: true, format: 'inert' }),
    c('status', 'State', 'enum', 't.status', { options: DM_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('answerBy', 'Answer promised by', 'datetime', 't.due_at', { sortable: true }),
    c('answeredAt', 'Answered at', 'datetime', 't.answered_at', { sortable: true, filter: 'range' }),
    stamp('asked', 'Asked', 't.created_at'),
  ],
};

const MY_COURSE_INVITES: DataTable = {
  key: 'myCourseInvites',
  name: 'Courses you were invited to',
  blurb: 'Private courses a creator invited you to.',
  group: 'purchases',
  // Who invited you, and a private course's title, which Shop shows only to its owner, an admin and the people invited (canSeeProduct).
  audience: 'others',
  sqlTable: 'product_invites',
  from: 'product_invites t LEFT JOIN products p ON p.id = t.product_id LEFT JOIN users ow ON ow.id = p.owner_id',
  owner: 't.user_id = ?1',
  idSql: "t.product_id || ':' || t.user_id",
  defaultSort: { key: 'invited', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'An invite is the course owner’s to give or take back.',
  columns: [
    c('course', 'Course', 'text', 'p.title', { sortable: true, searchable: true }),
    c('host', 'From', 'text', personName('ow'), { sortable: true, searchable: true, notNull: true }),
    c('courseState', 'Course state', 'enum', productStatusSql('p'), { options: PRODUCT_STATUS_OPTIONS, filter: 'pick' }),
    stamp('invited', 'Invited on', 't.created_at'),
  ],
};

const MY_PRODUCT_REVIEWS: DataTable = {
  key: 'myProductReviews',
  name: 'Product reviews you wrote',
  blurb: 'The reviews you left on things you bought.',
  group: 'purchases',
  sqlTable: 'testimonials',
  from: 'testimonials t LEFT JOIN products p ON p.id = t.product_id',
  owner: 't.author_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'written', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Write a review again on the product’s page to change it.',
  columns: [
    c('product', 'Product', 'text', 'p.title', { sortable: true, searchable: true }),
    c('rating', 'Rating', 'enum', 't.rating', { options: RATING_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('words', 'Words', 'longtext', 't.body', { searchable: true, format: 'inert' }),
    c('shown', 'Shown on the product', 'bool', 't.approved', { sortable: true, filter: 'pick', notNull: true }),
    stamp('written', 'Written', 't.created_at'),
  ],
};

const LEADS: DataTable = {
  key: 'leads',
  name: 'Leads',
  blurb: 'People who left their name and a message on your page.',
  group: 'audience',
  audience: 'others',
  needs: ['audience'],
  sqlTable: 'leads',
  from: 'leads t',
  owner: 't.owner_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'arrived', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A lead is what someone sent you, so it stays as it is. Their email is in Audience.',
  columns: [
    c('name', 'Name', 'text', 't.name', { sortable: true, searchable: true, notNull: true }),
    c('message', 'Message', 'longtext', 't.message', { searchable: true, format: 'inert' }),
    c('from', 'Came from', 'enum', 't.source', { options: LEAD_SOURCE_OPTIONS, otherLabel: 'Other', sortable: true, filter: 'pick', notNull: true }),
    stamp('arrived', 'Arrived', 't.created_at'),
  ],
};

const BROADCASTS: DataTable = {
  key: 'broadcasts',
  name: 'Broadcasts',
  blurb: 'Messages you sent to your followers or buyers.',
  group: 'audience',
  needs: ['audience'],
  sqlTable: 'broadcasts',
  from: 'broadcasts t',
  owner: 't.owner_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'sentAt', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A message stays as it was sent.',
  columns: [
    c('title', 'Title', 'text', 't.title', { sortable: true, searchable: true, notNull: true }),
    c('message', 'Message', 'longtext', 't.body', { searchable: true, format: 'inert' }),
    c('to', 'Sent to', 'enum', 't.audience', { options: BROADCAST_AUDIENCE_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('reached', 'People it reached', 'number', 't.sent', { sortable: true, notNull: true }),
    stamp('sentAt', 'Sent', 't.created_at'),
  ],
};

const CONTENT_POSTS: DataTable = {
  key: 'contentPosts',
  name: 'Posts you track',
  blurb: 'The posts you added to Content, with their views, likes and comments.',
  group: 'creatorContent',
  needs: ['content', 'automations'],
  sqlTable: 'content_items',
  from: 'content_items t',
  owner: 't.owner_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'added', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Read a post’s numbers again, or type them, in Content.',
  columns: [
    c('caption', 'Post', 'text', 't.caption', { sortable: true, searchable: true }),
    c('platform', 'Where', 'enum', 't.platform', { options: SOCIAL_PLATFORM_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('kind', 'Kind', 'enum', 't.kind', { options: CONTENT_KIND_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('link', 'Link', 'text', 't.url', { searchable: true, format: 'inert' }),
    c('views', 'Views', 'number', 't.views', { sortable: true, notNull: true }),
    c('likes', 'Likes', 'number', 't.likes', { sortable: true, notNull: true }),
    c('comments', 'Comments', 'number', 't.comments', { sortable: true, notNull: true }),
    c('numbersAt', 'Numbers from', 'datetime', 't.synced_at', { sortable: true }),
    stamp('added', 'Added', 't.created_at'),
  ],
};

const TRACKED_LINKS: DataTable = {
  key: 'trackedLinks',
  name: 'Tracked links',
  blurb: 'Your tracked links, where each one opens and how often it was tapped.',
  group: 'creatorContent',
  needs: ['content', 'automations'],
  sqlTable: 'tracked_links',
  from: 'tracked_links t LEFT JOIN products p ON p.id = t.product_id AND p.owner_id = t.owner_id LEFT JOIN content_items ci ON ci.id = t.content_item_id AND ci.owner_id = t.owner_id',
  owner: 't.owner_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'made', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Make or remove a link in Content.',
  columns: [
    c('label', 'Link', 'text', 't.label', { sortable: true, searchable: true, notNull: true }),
    c('opens', 'Opens', 'text', "CASE WHEN t.product_id IS NULL THEN 'Your page' ELSE p.title END", { sortable: true, searchable: true }),
    c('from', 'Used in', 'enum', 't.source_type', { options: LINK_SOURCE_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('post', 'Post', 'text', 'ci.caption', { searchable: true }),
    // A count only, through the clicks' own index: never who tapped, nor their hashed address.
    c('taps', 'Taps', 'number', '(SELECT COUNT(*) FROM link_clicks lc WHERE lc.link_id = t.id)', { notNull: true }),
    stamp('made', 'Made', 't.created_at'),
  ],
};

const AUTO_DMS: DataTable = {
  key: 'autoDms',
  name: 'Auto-DMs',
  blurb: 'Keywords that send your link in a DM, and how many went out.',
  group: 'creatorContent',
  needs: ['automations'],
  sqlTable: 'dm_automations',
  from: 'dm_automations t LEFT JOIN content_items ci ON ci.id = t.content_item_id AND ci.owner_id = t.owner_id LEFT JOIN tracked_links l ON l.id = t.link_id AND l.owner_id = t.owner_id',
  owner: 't.owner_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'made', dir: 'desc' },
  read: 'sql',
  privateSelect: { keywords: 't.keywords_json', replies: 't.public_replies_json' },
  columns: [
    c('keywords', 'Keywords', 'summary', null, { derive: 'stringList', from: ['keywords'] }),
    c('message', 'Message it sends', 'longtext', 't.dm_message', { searchable: true, format: 'inert' }),
    c('replies', 'Public replies', 'summary', null, { derive: 'stringList', from: ['replies'] }),
    c('post', 'On the post', 'text', 'ci.caption', { searchable: true }),
    c('link', 'Its link', 'text', 'l.label', { searchable: true }),
    c('on', 'On', 'bool', 't.active', { sortable: true, filter: 'pick', notNull: true, edit: patch('/studio/automations/:id', 'active', 'toggle') }),
    // A count only, through the sends' own key: never who got one.
    c('sent', 'DMs sent', 'number', "(SELECT COUNT(*) FROM dm_sends ds WHERE ds.automation_id = t.id AND ds.status = 'sent')", { notNull: true }),
    stamp('made', 'Made', 't.created_at'),
  ],
};

const FUNNELS: DataTable = {
  key: 'funnels',
  name: 'Funnels',
  blurb: 'The steps you follow from a post to a sale.',
  group: 'creatorContent',
  needs: ['automations'],
  sqlTable: 'funnels',
  from: 'funnels t',
  owner: 't.owner_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'made', dir: 'desc' },
  read: 'sql',
  privateSelect: { steps: 't.steps_json' },
  readOnlyWhy: 'Make or remove a funnel in Auto-DM.',
  columns: [
    c('name', 'Funnel', 'text', 't.name', { sortable: true, searchable: true, notNull: true }),
    c('steps', 'Steps', 'summary', null, { derive: 'stepLabels', from: ['steps'] }),
    c('stepCount', 'How many steps', 'number', 'json_array_length(t.steps_json)'),
    stamp('made', 'Made', 't.created_at'),
  ],
};

const SEQUENCES: DataTable = {
  key: 'sequences',
  name: 'After-purchase messages',
  blurb: 'Messages that go to buyers some days after they buy.',
  group: 'creatorContent',
  needs: ['automations'],
  sqlTable: 'sequences',
  from: 'sequences t LEFT JOIN products p ON p.id = t.product_id AND p.owner_id = t.owner_id',
  owner: 't.owner_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'made', dir: 'desc' },
  read: 'sql',
  columns: [
    c('title', 'Title', 'text', 't.title', { sortable: true, searchable: true, notNull: true }),
    c('message', 'Message', 'longtext', 't.body', { searchable: true, format: 'inert' }),
    c('product', 'After buying', 'text', "CASE WHEN t.product_id IS NULL THEN 'Any product' ELSE p.title END", { sortable: true, searchable: true }),
    c('days', 'Days after', 'number', 't.delay_days', { sortable: true, notNull: true }),
    c('on', 'On', 'bool', 't.active', { sortable: true, filter: 'pick', notNull: true, edit: patch('/studio/sequences/:id', 'active', 'toggle') }),
    // A count only, through the sends' own key: never who got one.
    c('sent', 'Times sent', 'number', '(SELECT COUNT(*) FROM sequence_sends ss WHERE ss.sequence_id = t.id)', { notNull: true }),
    stamp('made', 'Made', 't.created_at'),
  ],
};

const PORTFOLIO: DataTable = {
  key: 'portfolio',
  name: 'Portfolio',
  blurb: 'The work you show on your Public page.',
  group: 'publicPage',
  needs: ['profile'],
  sqlTable: 'portfolio_items',
  from: 'portfolio_items t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'added', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Add or remove a piece on your Public page.',
  columns: [
    c('title', 'Piece', 'text', 't.title', { sortable: true, searchable: true, notNull: true }),
    c('about', 'About it', 'longtext', 't.description', { searchable: true, format: 'inert' }),
    c('link', 'Link', 'text', 't.url', { searchable: true, format: 'inert' }),
    c('shown', 'Who sees it', 'enum', 't.visibility', { options: PORTFOLIO_VISIBILITY_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    stamp('added', 'Added', 't.created_at'),
  ],
};

// -----------------------------------------------------------------------------------------------------------------------------------
// Content, the Store, Tools and Rewards (2026-11-14, the third batch of "ok, add them"). A brand folder, its links and its research runs, a
// pre-owned listing, an offer the person made, a tool they suggested, a reward they reserved and a game they unlocked are their own records
// ('own'). Offers on the person's listings and both sides of a listing's chat hold a buyer's or a seller's name and words ('others'), and so do
// the pieces written for a brand: a piece's words quote its research (other creators' titles, names and words, copied in whole when no writing
// model is connected), so they are 'others' too. Those reach only the person and AI chat on a model that keeps nothing. Never listed: who bought
// a listing (its buyer's id), a research run's results (other people's posts and names from the web, counted only), a tool's link while the
// team has locked it (Tools blanks it too), a chat a block by name closed (the Store closes it both ways), or a person's id. Money is integer
// cents in each listing's own currency.
// -----------------------------------------------------------------------------------------------------------------------------------

/** A JSON list's length, or 0 for anything that is not one (never an error that would fail the page). */
const jsonCount = (expr: string): string => `CASE WHEN json_valid(${expr}) THEN json_array_length(${expr}) ELSE 0 END`;
/**
 * The order a brand folder's links, runs and pieces read in: by folder, the one changed last first, then each folder's own newest first. It is
 * the walk the folders' index (brands_owner, by owner and last change) and each kind's own index by folder make, to their rowids, so no page
 * sorts; tap Added, Ran or Written to sort by the day alone.
 */
const BY_BRAND_TERMS = ['b.updated_at', 'b.rowid', 't.created_at', 't.rowid'] as const;
const byBrand = (): DataColumn => c('byBrand', 'By folder', 'datetime', 'b.updated_at', { hidden: true, sortable: true, notNull: true, sortTerms: BY_BRAND_TERMS });
const brandName = (): DataColumn => c('brand', 'Brand', 'text', 'b.name', { sortable: true, searchable: true, notNull: true });
const BRAND_PATH = '/studio/brands/:id';
const LISTING_PATH = '/market/listings/:id';
/** A chat about a listing that a block by name either way between its seller and the buyer closed: the Store reads it as no chat at all (threadFor). */
const LISTING_CHAT_OPEN =
  'NOT EXISTS (SELECT 1 FROM blocks bk WHERE bk.by_name = 1 AND ((bk.blocker_id = l.seller_id AND bk.blocked_id = t.buyer_id) OR (bk.blocker_id = t.buyer_id AND bk.blocked_id = l.seller_id)))';
/** Who wrote a line of a listing's chat, as the Store's chat says it: the person's own lines are theirs, the other side by name. */
const chatWriter = (sender: string): string => `CASE WHEN t.sender_id = ?1 THEN 'You' ELSE ${personName(sender)} END`;
/** A game's reservation says unlocked, as Rewards does (a game is never posted, so never "fulfilled"); its stored note is the same word. */
const GAME_REWARD_SQL = "substr(t.reward_key, 1, 5) = 'game_'";

const BRANDS: DataTable = {
  key: 'brands',
  name: 'Brand folders',
  blurb: 'Your Content folders: each brand, its niche and voice, and what is in it.',
  group: 'contentFolders',
  needs: ['content'],
  sqlTable: 'brands',
  from: 'brands t',
  owner: 't.owner_id = ?1',
  idSql: 't.id',
  // The folders' own index (brands_owner) is by owner and last change, the order Content lists them in.
  defaultSort: { key: 'updatedAt', dir: 'desc' },
  read: 'sql',
  columns: [
    c('name', 'Brand', 'text', 't.name', { sortable: true, searchable: true, notNull: true, edit: patch(BRAND_PATH, 'name', 'text', { minLength: 1, maxLength: 80 }) }),
    c('niche', 'Niche', 'text', 't.niche', { sortable: true, searchable: true, edit: patch(BRAND_PATH, 'niche', 'text', { maxLength: 120 }) }),
    c('about', 'About it', 'longtext', 't.description', { searchable: true, format: 'inert', edit: patch(BRAND_PATH, 'description', 'longtext', { maxLength: 2000 }) }),
    c('voice', 'How it sounds', 'longtext', 't.voice', { searchable: true, format: 'inert', edit: patch(BRAND_PATH, 'voice', 'longtext', { maxLength: 1000, note: 'Every piece written for this brand uses it.' }) }),
    // Counts only, each through its kind's own index by folder.
    c('links', 'Links', 'number', '(SELECT COUNT(*) FROM brand_sources s WHERE s.brand_id = t.id)', { notNull: true }),
    c('runs', 'Research runs', 'number', '(SELECT COUNT(*) FROM research_runs r WHERE r.brand_id = t.id)', { notNull: true }),
    c('pieces', 'Pieces', 'number', '(SELECT COUNT(*) FROM brand_pieces p WHERE p.brand_id = t.id)', { notNull: true }),
    stamp('createdAt', 'Made', 't.created_at'),
    stamp('updatedAt', 'Changed', 't.updated_at', { filter: undefined }),
  ],
};

const BRAND_SOURCES: DataTable = {
  key: 'brandSources',
  name: 'Brand links',
  blurb: 'The links each brand folder is fed, and when each one was last read.',
  group: 'contentFolders',
  needs: ['content'],
  sqlTable: 'brand_sources',
  // A link has no owner of its own: it is the person's through its folder (brands.owner_id).
  from: 'brand_sources t JOIN brands b ON b.id = t.brand_id',
  owner: 'b.owner_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'byBrand', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Add, read or remove a link in the brand’s folder in Content.',
  columns: [
    brandName(),
    c('label', 'Name', 'text', 't.label', { sortable: true, searchable: true }),
    c('kind', 'Kind', 'enum', 't.kind', { options: BRAND_SOURCE_KIND_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('link', 'Link', 'text', 't.url', { searchable: true, format: 'inert' }),
    c('lastRead', 'Last read', 'datetime', 't.last_read_at', { sortable: true, filter: 'range' }),
    stamp('added', 'Added', 't.created_at'),
    byBrand(),
  ],
};

const RESEARCH_RUNS: DataTable = {
  key: 'researchRuns',
  name: 'Research runs',
  blurb: 'What you looked up for each brand, and how many results came back.',
  group: 'contentFolders',
  needs: ['content'],
  sqlTable: 'research_runs',
  from: 'research_runs t JOIN brands b ON b.id = t.brand_id',
  owner: 'b.owner_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'byBrand', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A run stays as it came back. Run it again from the brand’s folder in Content.',
  columns: [
    brandName(),
    c('kind', 'Kind', 'enum', 't.kind', { options: RESEARCH_KIND_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('query', 'Looked up', 'text', 't.query', { sortable: true, searchable: true, format: 'inert' }),
    c('status', 'How it went', 'enum', 't.status', { options: RUN_STATUS_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    // How many came back, never what: the results are other people's posts and names from the web.
    c('results', 'Results', 'number', jsonCount('t.items_json'), { notNull: true }),
    c('why', 'Why it did not work', 'text', "CASE WHEN t.status = 'failed' THEN NULLIF(t.error, '') END"),
    stamp('ran', 'Ran', 't.created_at'),
    byBrand(),
  ],
};

const BRAND_PIECES: DataTable = {
  key: 'brandPieces',
  name: 'Pieces written',
  blurb: 'Plans, scripts and ideas written for your brands, and the ones you kept.',
  group: 'contentFolders',
  // A piece's words quote the research it was written from: other creators' titles, names and words (`assemble` in strategist.ts copies them
  // in whole when no writing model is connected, and a model's piece quotes them too). The runs count those results and never show them, so
  // the pieces holding them are the person's and AI chat's on a model that keeps nothing, never a coach's or a super admin's.
  audience: 'others',
  needs: ['content'],
  sqlTable: 'brand_pieces',
  from: 'brand_pieces t JOIN brands b ON b.id = t.brand_id',
  owner: 'b.owner_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'byBrand', dir: 'desc' },
  read: 'sql',
  columns: [
    brandName(),
    c('title', 'Title', 'text', 't.title', {
      sortable: true,
      searchable: true,
      notNull: true,
      edit: patch('/studio/brands/:brandId/pieces/:id', 'title', 'text', { minLength: 1, maxLength: 160 }),
    }),
    c('kind', 'Kind', 'enum', 't.kind', { options: PIECE_KIND_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('status', 'State', 'enum', 't.status', { options: PIECE_STATUS_OPTIONS, sortable: true, filter: 'pick', notNull: true, edit: patch('/studio/brands/:brandId/pieces/:id', 'status', 'select') }),
    c('brief', 'What you asked for', 'longtext', 't.brief', { searchable: true, format: 'inert' }),
    // The piece's first lines (a whole piece can run to 60,000 letters; it is read whole and changed in Content). Search looks in all of it.
    c('opening', 'How it opens', 'longtext', 'substr(t.body, 1, 600)', { searchable: true, searchSql: 't.body', format: 'inert' }),
    c('writer', 'Written by', 'enum', 't.writer', { options: PIECE_WRITER_OPTIONS, otherLabel: 'Another writer', sortable: true, filter: 'pick', notNull: true }),
    c('research', 'Research it used', 'number', jsonCount('t.sources_json'), { notNull: true }),
    stamp('written', 'Written', 't.created_at'),
    stamp('updatedAt', 'Changed', 't.updated_at', { filter: undefined }),
    // The folder the piece lives under, for its route's path; only in the owner's own view.
    c('brandId', 'brandId', 'text', 't.brand_id', { hidden: true, ownerOnly: true }),
    byBrand(),
  ],
};

const PREOWNED_LISTINGS: DataTable = {
  key: 'preownedListings',
  name: 'Pre-owned listings',
  blurb: 'Gear you listed in the Store, its price and where each one stands.',
  group: 'store',
  needs: ['store'],
  sqlTable: 'preowned_listings',
  from: 'preowned_listings t',
  owner: 't.seller_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'listed', dir: 'desc' },
  read: 'sql',
  columns: [
    c('title', 'Listing', 'text', 't.title', { sortable: true, searchable: true, notNull: true, edit: patch(LISTING_PATH, 'title', 'text', { minLength: 1, maxLength: 120, when: 'listingOpen' }) }),
    c('category', 'Category', 'enum', 't.category', { options: STORE_CATEGORY_OPTIONS, otherLabel: 'Other', sortable: true, filter: 'pick', notNull: true }),
    c('condition', 'Condition', 'enum', 't.condition', { options: PREOWNED_CONDITION_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true, edit: patch(LISTING_PATH, 'condition', 'select', { when: 'listingOpen' }) }),
    c('price', 'Price', 'money', 't.price_cents', { currency: 'currency', sortable: true, notNull: true, edit: patch(LISTING_PATH, 'priceCents', 'money', { min: 1, when: 'listingOpen' }) }),
    c('priceNew', 'Price new', 'money', 't.original_cents', { currency: 'currency', sortable: true }),
    c('currency', 'Currency', 'enum', 't.currency', { options: CURRENCY_OPTIONS, filter: 'pick', notNull: true }),
    c('status', 'State', 'enum', 't.status', {
      options: LISTING_STATUS_OPTIONS,
      ordered: true,
      sortable: true,
      filter: 'pick',
      notNull: true,
      edit: patch(LISTING_PATH, 'status', 'select', { offer: ['live', 'withdrawn'], when: 'listingOpen', note: 'Sold is marked in the Store, with what it sold for.' }),
    }),
    c('soldFor', 'Sold for', 'money', 't.sold_cents', { currency: 'currency', sortable: true }),
    // A count only, through the offers' own index by listing: who offered is on the next table, for the person alone.
    c('openOffers', 'Open offers', 'number', "(SELECT COUNT(*) FROM preowned_offers o WHERE o.listing_id = t.id AND o.status = 'open')", { notNull: true }),
    c('city', 'City', 'text', 't.city', { sortable: true, searchable: true, edit: patch(LISTING_PATH, 'city', 'text', { maxLength: 80, when: 'listingOpen' }) }),
    c('yearBought', 'Year bought', 'number', 't.purchase_year', { sortable: true }),
    c('comesWith', 'What comes with it', 'text', 't.includes', { searchable: true, format: 'inert' }),
    c('wholeSetup', 'Whole setup', 'bool', 't.is_kit', { filter: 'pick', notNull: true }),
    c('pictures', 'Pictures', 'number', jsonCount('t.images_json'), { notNull: true }),
    c('about', 'About it', 'longtext', 't.description', { searchable: true, format: 'inert', edit: patch(LISTING_PATH, 'description', 'longtext', { maxLength: 3000, when: 'listingOpen' }) }),
    c('featuredUntil', 'Featured until', 'datetime', 't.featured_until', { sortable: true }),
    stamp('listed', 'Listed', 't.created_at'),
    stamp('updatedAt', 'Changed', 't.updated_at', { filter: undefined }),
  ],
};

const LISTING_OFFERS: DataTable = {
  key: 'listingOffers',
  name: 'Offers on your listings',
  blurb: 'Offers people made on your pre-owned gear, and what you decided.',
  group: 'store',
  audience: 'others',
  needs: ['store'],
  sqlTable: 'preowned_offers',
  // An offer is the seller's through their listing. Every offer reads, as the listing's sheet shows the seller every one, a block or not.
  from: 'preowned_offers t JOIN preowned_listings l ON l.id = t.listing_id LEFT JOIN users b ON b.id = t.buyer_id',
  owner: 'l.seller_id = ?1',
  idSql: 't.id',
  // By listing, newest first, then each listing's offers newest first: the walk its index and the offers' make, so no page sorts.
  defaultSort: { key: 'byListing', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Accept or decline an offer on your listing in the Store, where the buyer is told.',
  columns: [
    c('listing', 'Listing', 'text', 'l.title', { sortable: true, searchable: true, notNull: true }),
    c('person', 'From', 'text', personName('b'), { sortable: true, searchable: true, notNull: true }),
    c('amount', 'Offer', 'money', 't.cents', { currency: 'currency', sortable: true, notNull: true }),
    c('note', 'Their note', 'text', 't.note', { searchable: true, format: 'inert' }),
    c('status', 'State', 'enum', 't.status', { options: OFFER_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('decided', 'Decided', 'datetime', 't.decided_at', { sortable: true, filter: 'range' }),
    stamp('made', 'Made', 't.created_at'),
    c('currency', 'currency', 'text', 'l.currency', { hidden: true }),
    c('byListing', 'By listing', 'datetime', 'l.created_at', { hidden: true, sortable: true, notNull: true, sortTerms: ['l.created_at', 'l.rowid', 't.created_at', 't.rowid'] }),
  ],
};

const CHATS_WITH_BUYERS: DataTable = {
  key: 'chatsWithBuyers',
  name: 'Chats with buyers',
  blurb: 'What you and buyers wrote about your pre-owned gear.',
  group: 'store',
  audience: 'others',
  needs: ['store'],
  sqlTable: 'preowned_messages',
  // Every line of each buyer's chat, as the listing's sheet shows the seller the thread, and never one a block by name closed.
  from: 'preowned_messages t JOIN preowned_listings l ON l.id = t.listing_id LEFT JOIN users s ON s.id = t.sender_id LEFT JOIN users b ON b.id = t.buyer_id',
  owner: 'l.seller_id = ?1',
  where: LISTING_CHAT_OPEN,
  idSql: 't.id',
  // By listing, newest first, then each buyer's chat, its newest line first: the walk the listing's index and the chat's own (by listing, buyer
  // and time) make, so no page sorts. Tap Sent to sort by the time alone.
  defaultSort: { key: 'byChat', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A message stays as it was sent. Write back in the listing’s chat in the Store.',
  columns: [
    c('listing', 'Listing', 'text', 'l.title', { sortable: true, searchable: true, notNull: true }),
    c('buyer', 'Buyer', 'text', personName('b'), { sortable: true, searchable: true, notNull: true }),
    c('from', 'Written by', 'text', chatWriter('s'), { sortable: true, notNull: true }),
    c('message', 'Message', 'longtext', 't.body', { searchable: true, format: 'inert' }),
    stamp('sent', 'Sent', 't.created_at'),
    c('byChat', 'By chat', 'datetime', 'l.created_at', { hidden: true, sortable: true, notNull: true, sortTerms: ['l.created_at', 'l.rowid', 't.buyer_id', 't.created_at', 't.rowid'] }),
  ],
};

const MY_OFFERS: DataTable = {
  key: 'myOffers',
  name: 'Offers you made',
  blurb: 'Offers you made on pre-owned gear, and how each one went.',
  group: 'store',
  needs: ['store'],
  sqlTable: 'preowned_offers',
  from: 'preowned_offers t LEFT JOIN preowned_listings l ON l.id = t.listing_id',
  owner: 't.buyer_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'made', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Make another offer, or take one back, on the listing in the Store.',
  columns: [
    c('listing', 'Listing', 'text', 'l.title', { sortable: true, searchable: true }),
    c('amount', 'Your offer', 'money', 't.cents', { currency: 'currency', sortable: true, notNull: true }),
    c('note', 'Your note', 'text', 't.note', { searchable: true, format: 'inert' }),
    c('status', 'State', 'enum', 't.status', { options: OFFER_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('decided', 'Decided', 'datetime', 't.decided_at', { sortable: true, filter: 'range' }),
    stamp('made', 'Made', 't.created_at'),
    c('currency', 'currency', 'text', "COALESCE(l.currency, 'INR')", { hidden: true }),
  ],
};

const CHATS_WITH_SELLERS: DataTable = {
  key: 'chatsWithSellers',
  name: 'Chats with sellers',
  blurb: 'What you and sellers wrote about gear you asked after.',
  group: 'store',
  audience: 'others',
  needs: ['store'],
  sqlTable: 'preowned_messages',
  // The person's own chats as a buyer, both sides of each as the listing's sheet shows them, never one a block by name closed.
  from: 'preowned_messages t JOIN preowned_listings l ON l.id = t.listing_id LEFT JOIN users s ON s.id = t.sender_id LEFT JOIN users ow ON ow.id = l.seller_id',
  owner: 't.buyer_id = ?1',
  where: LISTING_CHAT_OPEN,
  idSql: 't.id',
  defaultSort: { key: 'sent', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A message stays as it was sent. Write back in the listing’s chat in the Store.',
  columns: [
    c('listing', 'Listing', 'text', 'l.title', { sortable: true, searchable: true, notNull: true }),
    c('seller', 'Seller', 'text', personName('ow'), { sortable: true, searchable: true, notNull: true }),
    c('from', 'Written by', 'text', chatWriter('s'), { sortable: true, notNull: true }),
    c('message', 'Message', 'longtext', 't.body', { searchable: true, format: 'inert' }),
    stamp('sent', 'Sent', 't.created_at'),
  ],
};

const TOOLS_SUGGESTED: DataTable = {
  key: 'toolsSuggested',
  name: 'Tools you suggested',
  blurb: 'Tools you added to the directory, and whether the team checked them.',
  group: 'tools',
  needs: ['tools'],
  sqlTable: 'tools',
  from: 'tools t',
  owner: 't.suggested_by = ?1',
  idSql: 't.id',
  defaultSort: { key: 'added', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'The team checks and changes tools in Tools.',
  columns: [
    c('name', 'Tool', 'text', 't.name', { sortable: true, searchable: true, notNull: true }),
    c('category', 'Category', 'enum', 't.category', { options: TOOL_CATEGORY_OPTIONS, otherLabel: 'Other', sortable: true, filter: 'pick', notNull: true }),
    // Tools blanks a tool's link while the team has locked it behind points, xp or a badge, so this does too (and never searches it).
    c('link', 'Link', 'text', "CASE WHEN t.min_points = 0 AND t.min_xp = 0 AND t.badge = '' THEN t.url END", { format: 'inert' }),
    c('about', 'About it', 'longtext', 't.description', { searchable: true, format: 'inert' }),
    c('checked', 'Checked by the team', 'bool', 't.verified', { sortable: true, filter: 'pick', notNull: true }),
    c('partner', 'Partner link', 'bool', 't.affiliate', { filter: 'pick', notNull: true }),
    stamp('added', 'Added', 't.created_at'),
  ],
};

const REWARD_RESERVATIONS: DataTable = {
  key: 'rewardReservations',
  name: 'Reward reservations',
  blurb: 'Rewards you reserved or unlocked with points, and where each one stands.',
  group: 'rewards',
  sqlTable: 'redemptions',
  from: 'redemptions t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'reserved', dir: 'desc' },
  read: 'sql',
  privateSelect: { reward: 't.reward_key' },
  readOnlyWhy: 'Cancel a reservation on Rewards, where its points come back.',
  columns: [
    // Its name from the catalog, the one list of rewards (REWARD_BY_KEY), on the server.
    c('reward', 'Reward', 'summary', null, { derive: 'rewardName', from: ['reward'] }),
    c('points', 'Points', 'number', 't.points', { sortable: true, notNull: true }),
    c('status', 'State', 'enum', `CASE WHEN ${GAME_REWARD_SQL} THEN 'unlocked' ELSE t.status END`, { options: REDEMPTION_STATUS_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('note', 'Note from the team', 'text', `CASE WHEN ${GAME_REWARD_SQL} THEN NULL ELSE NULLIF(t.note, '') END`, { searchable: true, format: 'inert' }),
    stamp('reserved', 'Reserved', 't.created_at'),
    stamp('updatedAt', 'Changed', 't.updated_at', { filter: undefined }),
  ],
};

const GAMES_UNLOCKED: DataTable = {
  key: 'gamesUnlocked',
  name: 'Games you unlocked',
  blurb: 'The card games you unlocked with points, yours for good.',
  group: 'rewards',
  sqlTable: 'card_unlocks',
  from: 'card_unlocks t',
  owner: 't.user_id = ?1',
  idSql: 't.game_key',
  // By the game, which the unlocks' own key (by person, then game) keeps in order; at most nine.
  defaultSort: { key: 'game', dir: 'asc' },
  read: 'sql',
  privateSelect: { reward: "'game_' || t.game_key" },
  readOnlyWhy: 'A game stays yours for good once it is unlocked.',
  columns: [
    c('game', 'Game', 'summary', null, { derive: 'rewardName', from: ['reward'], sortable: true, sortSql: 't.game_key', notNull: true }),
    stamp('unlocked', 'Unlocked', 't.unlocked_at'),
  ],
};

// -----------------------------------------------------------------------------------------------------------------------------------
// Work, Win, Army, TV, Fund and Club (2026-11-14, the fourth batch of "ok, add them"). The person's own records ('own': listings they posted,
// their applications and each step of them, rewards they launched, their entries, their roles and the work they sent in Army, the brands
// they belong to, their pitches and their Club membership) follow the old rules. Those with another person's details or words ('others': who
// applied to their listings, what a Win reviewer wrote on their entries, what a brand wrote on their work, their brands' teams, campaigns and
// campaign log) reach only the person and AI chat on a model that keeps nothing.
// Never listed: a reviewer's or staff member's id; a step's note on an application (the listing's words, which Work shows only in part, in
// the note that tells the person); a teammate's email; a pitch's decision log (the reviewers' notes); a Club decision's note, or who decided
// or manages it. Amounts kept in whole units (a listing's pay, a role's fee, a campaign's budget, a pitch's budget) read as integer cents.
// -----------------------------------------------------------------------------------------------------------------------------------

// Words copied from work.ts, wellbeing.ts and the screens (Work.tsx, Win.tsx, Army.tsx, Proposals.tsx, Club.tsx); the batch's test checks each.
export const OPPORTUNITY_TYPE_OPTIONS = opts([['gig', 'Gig'], ['campaign', 'Campaign'], ['full_time', 'Full time'], ['part_time', 'Part time'], ['internship', 'Internship'], ['collab', 'Collab']]);
export const LOCATION_MODE_OPTIONS = opts([['remote', 'Remote'], ['on_site', 'On site'], ['hybrid', 'Hybrid']]);
export const OPPORTUNITY_STATUS_OPTIONS = opts([['draft', 'Draft'], ['published', 'Published'], ['closed', 'Closed']]);
/** An application's state in the words Work's tags show (its StatusPill shows the stored word). */
export const APPLICATION_STATUS_OPTIONS = opts([
  ['draft', 'Draft'], ['submitted', 'Submitted'], ['reviewing', 'Reviewing'], ['shortlisted', 'Shortlisted'], ['selected', 'Selected'], ['rejected', 'Rejected'],
  ['withdrawn', 'Withdrawn'], ['completed', 'Completed'],
]);
const APPLICATION_STEP_BY_OPTIONS = opts([['you', 'You'], ['listing', 'The listing’s team']]);
export const REWARD_STATUS_OPTIONS = opts([['open', 'Open'], ['closed', 'Closed'], ['paid', 'Pool paid out']]);
/** An entry's state in Win's own words (STATUS_LABEL in Win.tsx). */
export const ENTRY_STATUS_OPTIONS = opts([['submitted', 'Waiting for review'], ['verified', 'Verified, payout queued'], ['paid', 'Paid'], ['rejected', 'Rejected'], ['disputed', 'Disputed']]);
/** CAMPAIGN_STATUS_META in work.ts, in its order. */
export const CAMPAIGN_STATUS_OPTIONS = opts([
  ['lead', 'New lead'], ['brief', 'Brief written'], ['scoping', 'Scope and budget'], ['shortlist', 'Creators shortlisted'], ['approved', 'Approved by brand'],
  ['production', 'In production'], ['review', 'In review'], ['delivered', 'Delivered'], ['reported', 'Reported and invoiced'], ['cancelled', 'Cancelled'],
]);
export const ROLE_STATUS_OPTIONS = opts([['offered', 'Offered'], ['accepted', 'Accepted'], ['declined', 'Declined'], ['done', 'Done']]);
/** A version's review as Army says it (a pending one reads waiting). */
export const VERSION_REVIEW_OPTIONS = opts([['pending', 'Waiting'], ['approved', 'Approved'], ['changes', 'Changes asked']]);
/** The steps Army's campaign log records (logEvent in routes/army.ts), in words. */
export const CAMPAIGN_EVENT_OPTIONS = opts([
  ['created', 'Started'], ['status', 'Stage moved'], ['deliverable', 'Piece added'], ['assignment', 'A creator’s role'], ['version', 'Work sent'],
  ['approved', 'Work approved'], ['changes', 'Changes asked'],
]);
export const ORG_TYPE_OPTIONS = opts([['brand', 'Brand'], ['agency', 'Agency'], ['partner', 'Partner']]);
export const ORG_ROLE_OPTIONS = opts([['owner', 'Owner'], ['member', 'Member']]);
/** A brand's team as Army and the Profile tab say it: an ask still waiting is no member yet (2026-11-10). */
export const ORG_MEMBER_STATUS_OPTIONS = opts([['active', 'On the team'], ['invited', 'Asked to join']]);
/** STAGE_LABEL in Proposals.tsx, PROPOSAL_STAGES' order. */
export const PROPOSAL_STAGE_OPTIONS = opts([
  ['submitted', 'Submitted'], ['review', 'In review'], ['diligence', 'Checking details'], ['approved', 'Approved'], ['rejected', 'Not this time'],
  ['in_progress', 'In progress'], ['released', 'Released'],
]);
/** A Club membership's state, short (Club.tsx says each one in a sentence; approved and active both read as in the Club there). */
export const CLUB_STATUS_OPTIONS = opts([['applied', 'In review'], ['approved', 'Approved'], ['active', 'Active'], ['rejected', 'Not this time'], ['suspended', 'Paused'], ['expired', 'Ended']]);

const OPPORTUNITY_PATH = '/work/opportunities/:id';
/** A listing's or a reward's brand as Work and Win name it: the brand's own name, else Kreators (a listing the team posted). */
const brandOf = (org: string): string => `COALESCE(${org}.name, 'Kreators')`;
/** A reward's brand as Win names it: the name typed on the reward, else its brand's, else Kreators. */
const rewardBrand = (reward: string, org: string): string => `COALESCE(NULLIF(${reward}.brand_name, ''), ${org}.name, 'Kreators')`;
/** An amount kept in whole rupees or dollars (a listing's pay, a role's fee, a campaign's budget, a pitch's budget), as integer cents. */
const wholeUnits = (expr: string): string => `${expr} * 100`;
/**
 * An ask to join a brand that a block by name either way with one of its owners took away: the Profile tab reads it as no ask (ownerBlocked in
 * routes/orgs.ts), so the table does too. A membership already active stays.
 */
const ORG_ASK_OPEN =
  "(t.status = 'active' OR (og.status = 'active' AND NOT EXISTS (SELECT 1 FROM organization_members ob WHERE ob.organization_id = t.organization_id AND ob.role = 'owner' AND ob.status = 'active' AND EXISTS (SELECT 1 FROM blocks bn WHERE bn.by_name = 1 AND ((bn.blocker_id = ob.user_id AND bn.blocked_id = t.user_id) OR (bn.blocker_id = t.user_id AND bn.blocked_id = ob.user_id))))))";

const WORK_LISTINGS: DataTable = {
  key: 'workListings',
  name: 'Listings you posted',
  blurb: 'Gigs and roles you posted in Work, with their pay, state and how many applied.',
  group: 'work',
  needs: ['work'],
  sqlTable: 'opportunities',
  from: 'opportunities t LEFT JOIN organizations og ON og.id = t.organization_id',
  owner: 't.created_by = ?1',
  idSql: 't.id',
  defaultSort: { key: 'made', dir: 'desc' },
  read: 'sql',
  privateSelect: { skills: 't.skills_required' },
  columns: [
    c('title', 'Title', 'text', 't.title', { sortable: true, searchable: true, notNull: true }),
    c('brand', 'Brand', 'text', brandOf('og'), { sortable: true, searchable: true, notNull: true }),
    c('kind', 'Kind', 'enum', 't.opportunity_type', { options: OPPORTUNITY_TYPE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('status', 'State', 'enum', 't.status', {
      options: OPPORTUNITY_STATUS_OPTIONS,
      ordered: true,
      sortable: true,
      filter: 'pick',
      notNull: true,
      edit: patch(OPPORTUNITY_PATH, 'status', 'select', { offer: ['draft', 'published'], when: 'unpublished', note: 'Published, anyone in Work can see it and apply. To close it, use Close on the listing in Work.' }),
    }),
    c('clubOnly', 'Club only', 'bool', 't.club_only', { sortable: true, filter: 'pick', notNull: true, edit: patch(OPPORTUNITY_PATH, 'clubOnly', 'toggle', { note: 'Only Club members see it and can apply.' }) }),
    // Every application but a withdrawn one, as Work counts them.
    c('applied', 'Applied', 'number', "(SELECT COUNT(*) FROM applications a WHERE a.opportunity_id = t.id AND a.status != 'withdrawn')", { sortable: true, notNull: true }),
    c('locationMode', 'Where', 'enum', 't.location_mode', { options: LOCATION_MODE_OPTIONS, ordered: true, filter: 'pick', notNull: true }),
    c('place', 'Place', 'text', "NULLIF(t.location_text, '')", { searchable: true }),
    c('payFrom', 'Pay from', 'money', wholeUnits('t.compensation_min'), { currency: 'currency', sortable: true }),
    c('payTo', 'Pay up to', 'money', wholeUnits('t.compensation_max'), { currency: 'currency', sortable: true }),
    c('skills', 'Skills', 'summary', null, { derive: 'stringList', from: ['skills'] }),
    c('deadline', 'Apply by', 'date', 't.deadline', { sortable: true, filter: 'range' }),
    c('about', 'About it', 'longtext', 't.description', { searchable: true, format: 'inert' }),
    c('deliverables', 'What to deliver', 'longtext', 't.deliverables', { format: 'inert' }),
    c('eligibility', 'Who can apply', 'longtext', 't.eligibility', { format: 'inert' }),
    c('featured', 'Featured', 'bool', 't.featured', { filter: 'pick', notNull: true }),
    stamp('made', 'Made', 't.created_at'),
    c('published', 'Published', 'datetime', 't.published_at', { sortable: true, filter: 'range' }),
    c('currency', 'currency', 'text', 't.currency', { hidden: true }),
  ],
};

const WORK_APPLICANTS: DataTable = {
  key: 'workApplicants',
  name: 'Applications to your listings',
  blurb: 'Who applied to the listings you posted, their notes and where each one stands.',
  group: 'work',
  audience: 'others',
  needs: ['work'],
  sqlTable: 'applications',
  // Every application to the person's listings, as a listing's page shows its poster each one, by name.
  from: 'applications t JOIN opportunities o ON o.id = t.opportunity_id LEFT JOIN users u ON u.id = t.creator_user_id',
  owner: 'o.created_by = ?1',
  idSql: 't.id',
  // By listing, newest first, then each listing's applications newest first: the walk the listings' index (by poster and day made) and the
  // applications' own (by listing and day sent) make, so no page sorts. Tap Sent to sort by the day alone.
  defaultSort: { key: 'byListing', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Move an application along on the listing’s page in Work, where the person is told.',
  columns: [
    c('listing', 'Listing', 'text', 'o.title', { sortable: true, searchable: true, notNull: true }),
    c('person', 'Who applied', 'text', personName('u'), { sortable: true, searchable: true, notNull: true }),
    c('handle', 'Username', 'text', personHandle('u'), { searchable: true, format: 'handle' }),
    c('status', 'State', 'enum', 't.status', { options: APPLICATION_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('coverNote', 'Their note', 'longtext', 't.cover_note', { searchable: true, format: 'inert' }),
    c('portfolio', 'Their work as sent', 'longtext', 't.portfolio_snapshot', { format: 'inert' }),
    stamp('sent', 'Sent', 't.submitted_at'),
    c('changed', 'Changed', 'datetime', 't.updated_at', { sortable: true, filter: 'range', notNull: true }),
    c('byListing', 'By listing', 'datetime', 'o.created_at', { hidden: true, sortable: true, notNull: true, sortTerms: ['o.created_at', 'o.rowid', 't.submitted_at', 't.rowid'] }),
  ],
};

const WORK_APPLICATIONS: DataTable = {
  key: 'workApplications',
  name: 'Your applications',
  blurb: 'Listings you applied to in Work, your note and where each one stands.',
  group: 'work',
  needs: ['work'],
  sqlTable: 'applications',
  from: 'applications t LEFT JOIN opportunities o ON o.id = t.opportunity_id LEFT JOIN organizations og ON og.id = o.organization_id',
  owner: 't.creator_user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'changed', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Withdraw an application on its listing in Work, where the brand is told.',
  columns: [
    c('listing', 'Listing', 'text', 'o.title', { sortable: true, searchable: true }),
    c('brand', 'Brand', 'text', brandOf('og'), { sortable: true, searchable: true, notNull: true }),
    c('status', 'State', 'enum', 't.status', { options: APPLICATION_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('coverNote', 'Your note', 'longtext', 't.cover_note', { searchable: true, format: 'inert' }),
    c('portfolio', 'Your work as sent', 'longtext', 't.portfolio_snapshot', { format: 'inert' }),
    stamp('sent', 'Sent', 't.submitted_at'),
    stamp('changed', 'Changed', 't.updated_at'),
    c('decided', 'Decided', 'datetime', 't.decision_at', { sortable: true, filter: 'range' }),
  ],
};

const WORK_APPLICATION_STEPS: DataTable = {
  key: 'workApplicationSteps',
  name: 'Application history',
  blurb: 'Each step of your applications in Work: sent, read, picked or withdrawn, and when.',
  group: 'work',
  needs: ['work'],
  sqlTable: 'application_events',
  // A step's note is left out: a reviewer's words, which Work shows only in part, in the note that tells the person. Who took a step is
  // the person or the listing's team, never a name.
  from: 'application_events t JOIN applications a ON a.id = t.application_id LEFT JOIN opportunities o ON o.id = a.opportunity_id',
  owner: 'a.creator_user_id = ?1',
  idSql: 't.id',
  // By application, the one changed last first, then each one's steps newest first: the walk the applications' index (by the person and last
  // change) and the steps' own (by application and time) make, so no page sorts. Tap When to sort by the time alone.
  defaultSort: { key: 'byApplication', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A step is what happened. It changes only as the application moves in Work.',
  columns: [
    c('listing', 'Listing', 'text', 'o.title', { sortable: true, searchable: true }),
    c('step', 'Step', 'enum', 't.event_type', { options: APPLICATION_STATUS_OPTIONS, otherLabel: 'Something else', ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('by', 'By', 'enum', "CASE WHEN t.actor_user_id = ?1 THEN 'you' ELSE 'listing' END", { options: APPLICATION_STEP_BY_OPTIONS, filter: 'pick', notNull: true }),
    stamp('when', 'When', 't.created_at'),
    c('byApplication', 'By application', 'datetime', 'a.updated_at', { hidden: true, sortable: true, notNull: true, sortTerms: ['a.updated_at', 'a.rowid', 't.created_at', 't.rowid'] }),
  ],
};

const ARMY_ROLES: DataTable = {
  key: 'armyRoles',
  name: 'Your campaign roles',
  blurb: 'Roles you were offered on brand campaigns in Army, the fee and where each stands.',
  group: 'army',
  needs: ['army'],
  sqlTable: 'campaign_assignments',
  from: 'campaign_assignments t LEFT JOIN campaigns cp ON cp.id = t.campaign_id LEFT JOIN organizations og ON og.id = cp.organization_id',
  owner: 't.creator_user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'offered', dir: 'desc' },
  read: 'sql',
  // Accepting is agreeing to the campaign's brief, usage rights and exclusivity, which Army shows beside the answer; so it is answered there.
  readOnlyWhy: 'Accept or decline an offer on the campaign in Army, beside its brief and terms.',
  columns: [
    c('campaign', 'Campaign', 'text', 'cp.name', { sortable: true, searchable: true }),
    c('brand', 'Brand', 'text', 'og.name', { sortable: true, searchable: true }),
    c('role', 'Role', 'text', 't.role', { sortable: true, searchable: true, notNull: true }),
    c('fee', 'Fee', 'money', wholeUnits('t.fee_amount'), { currency: 'currency', sortable: true, notNull: true }),
    c('status', 'State', 'enum', 't.status', { options: ROLE_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('stage', 'Campaign stage', 'enum', 'cp.status', { options: CAMPAIGN_STATUS_OPTIONS, ordered: true, filter: 'pick' }),
    c('accepted', 'Terms accepted', 'datetime', 't.terms_accepted_at', { sortable: true, filter: 'range' }),
    stamp('offered', 'Offered', 't.created_at'),
    c('currency', 'currency', 'text', 't.currency', { hidden: true }),
  ],
};

const ARMY_WORK_SENT: DataTable = {
  key: 'armyWorkSent',
  name: 'Work you sent in Army',
  blurb: 'Each version of a campaign piece you sent to a brand, and how it was reviewed.',
  group: 'army',
  needs: ['army'],
  sqlTable: 'deliverable_versions',
  from: 'deliverable_versions t LEFT JOIN campaign_deliverables dl ON dl.id = t.deliverable_id LEFT JOIN campaigns cp ON cp.id = dl.campaign_id',
  owner: 't.submitted_by = ?1',
  idSql: 't.id',
  defaultSort: { key: 'sent', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A version stays as you sent it. Send a new one on the campaign in Army.',
  columns: [
    c('campaign', 'Campaign', 'text', 'cp.name', { sortable: true, searchable: true }),
    c('piece', 'Piece', 'text', 'dl.title', { sortable: true, searchable: true }),
    c('version', 'Version', 'number', 't.version_number', { sortable: true, notNull: true }),
    c('link', 'Link', 'text', 't.url', { searchable: true, format: 'inert' }),
    c('note', 'Your note', 'longtext', 't.note', { searchable: true, format: 'inert' }),
    c('review', 'Review', 'enum', 't.review_status', { options: VERSION_REVIEW_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    stamp('sent', 'Sent', 't.submitted_at'),
  ],
};

const ARMY_FEEDBACK: DataTable = {
  key: 'armyFeedback',
  name: 'Feedback on your work',
  blurb: 'What a brand or the team wrote on the work you sent in Army.',
  group: 'army',
  audience: 'others',
  needs: ['army'],
  sqlTable: 'feedback_items',
  // Each comment on a version the person sent, by name, as the campaign's page shows them.
  from: 'feedback_items t JOIN deliverable_versions v ON v.id = t.deliverable_version_id LEFT JOIN campaign_deliverables dl ON dl.id = v.deliverable_id LEFT JOIN campaigns cp ON cp.id = dl.campaign_id LEFT JOIN users u ON u.id = t.author_user_id',
  owner: 'v.submitted_by = ?1',
  idSql: 't.id',
  // By version, the one sent last first, then each one's comments newest first: the walk the versions' index (by sender and day sent) and the
  // comments' own (by version and time) make, so no page sorts.
  defaultSort: { key: 'byVersion', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Feedback stays as it was written. Answer it with a new version on the campaign in Army.',
  columns: [
    c('campaign', 'Campaign', 'text', 'cp.name', { sortable: true, searchable: true }),
    c('piece', 'Piece', 'text', 'dl.title', { sortable: true, searchable: true }),
    c('version', 'Version', 'number', 'v.version_number', { sortable: true, notNull: true }),
    c('from', 'From', 'text', personName('u'), { sortable: true, searchable: true, notNull: true }),
    c('comment', 'Feedback', 'longtext', 't.comment', { searchable: true, format: 'inert' }),
    stamp('written', 'Written', 't.created_at'),
    c('byVersion', 'By version', 'datetime', 'v.submitted_at', { hidden: true, sortable: true, notNull: true, sortTerms: ['v.submitted_at', 'v.rowid', 't.created_at', 't.rowid'] }),
  ],
};

const ARMY_BRANDS: DataTable = {
  key: 'armyBrands',
  name: 'Your brands',
  blurb: 'Brands whose team you are on or were asked to join, and your role in each.',
  group: 'army',
  // A brand's team is used in Army, Work, Win and Kreators Run, and an ask is answered on the Profile tab: no one app, so it always lists.
  sqlTable: 'organization_members',
  from: 'organization_members t JOIN organizations og ON og.id = t.organization_id',
  owner: 't.user_id = ?1',
  where: ORG_ASK_OPEN,
  // One row per brand for the person (the key is the brand and the person).
  idSql: 't.organization_id',
  defaultSort: { key: 'since', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Answer an ask to join on your Profile tab. A brand’s owner adds and removes teammates in Army.',
  columns: [
    c('brand', 'Brand', 'text', 'og.name', { sortable: true, searchable: true, notNull: true }),
    c('type', 'Kind', 'enum', 'og.type', { options: ORG_TYPE_OPTIONS, filter: 'pick', notNull: true }),
    c('role', 'Your role', 'enum', 't.role', { options: ORG_ROLE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('status', 'State', 'enum', 't.status', { options: ORG_MEMBER_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    stamp('since', 'Since', 't.created_at'),
  ],
};

const ARMY_BRAND_TEAMS: DataTable = {
  key: 'armyBrandTeams',
  name: 'Your brands’ teams',
  blurb: 'Who is on the teams of the brands you own, and who was asked to join.',
  group: 'army',
  audience: 'others',
  needs: ['army'],
  sqlTable: 'organization_members',
  // Every teammate and ask of the brands the person owns, as Army's team list shows its owner; never an email.
  from: "organization_members t JOIN organization_members ow ON ow.organization_id = t.organization_id AND ow.role = 'owner' AND ow.status = 'active' JOIN organizations og ON og.id = t.organization_id LEFT JOIN users u ON u.id = t.user_id",
  owner: 'ow.user_id = ?1',
  where: "t.status IN ('active', 'invited')",
  // The brand and the membership's own row number: a teammate's id is never sent, not even in a row's key.
  idSql: "t.organization_id || '-' || t.rowid",
  // By brand, the one owned last first, then each team newest first: the walk the person's memberships and each brand's team index make.
  defaultSort: { key: 'byBrand', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Ask someone onto a brand’s team, or take them off it, in Army.',
  columns: [
    c('brand', 'Brand', 'text', 'og.name', { sortable: true, searchable: true, notNull: true }),
    c('person', 'Teammate', 'text', `CASE WHEN t.user_id = ?1 THEN 'You' ELSE ${personName('u')} END`, { sortable: true, searchable: true, notNull: true }),
    c('handle', 'Username', 'text', personHandle('u'), { searchable: true, format: 'handle' }),
    c('role', 'Role', 'enum', 't.role', { options: ORG_ROLE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('status', 'State', 'enum', 't.status', { options: ORG_MEMBER_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    stamp('since', 'Since', 't.created_at'),
    c('byBrand', 'By brand', 'datetime', 'ow.created_at', { hidden: true, sortable: true, notNull: true, sortTerms: ['ow.created_at', 'ow.rowid', 't.created_at', 't.rowid'] }),
  ],
};

const ARMY_CAMPAIGNS: DataTable = {
  key: 'armyCampaigns',
  name: 'Your brands’ campaigns',
  blurb: 'Campaigns of the brands whose team you are on: the stage, budget, dates and terms.',
  group: 'army',
  audience: 'others',
  needs: ['army'],
  sqlTable: 'campaigns',
  // Every campaign of the person's brands, as Army lists them for a brand's team, with who on staff runs each one.
  from: "campaigns t JOIN organization_members m ON m.organization_id = t.organization_id AND m.status = 'active' JOIN organizations og ON og.id = t.organization_id LEFT JOIN users u ON u.id = t.owner_user_id",
  owner: 'm.user_id = ?1',
  idSql: 't.id',
  // By brand, then each brand's campaigns changed last first: the walk the person's memberships and the campaigns' index by brand make.
  defaultSort: { key: 'byBrand', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A campaign is the brand’s and the team’s. Change it in Army.',
  columns: [
    c('campaign', 'Campaign', 'text', 't.name', { sortable: true, searchable: true, notNull: true }),
    c('brand', 'Brand', 'text', 'og.name', { sortable: true, searchable: true, notNull: true }),
    c('stage', 'Stage', 'enum', 't.status', { options: CAMPAIGN_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('budget', 'Budget', 'money', wholeUnits('t.budget_amount'), { currency: 'currency', sortable: true, notNull: true }),
    c('starts', 'Starts', 'date', 't.start_date', { sortable: true, filter: 'range' }),
    c('due', 'Due', 'date', 't.due_date', { sortable: true, filter: 'range' }),
    c('runBy', 'Run by', 'text', `CASE WHEN t.owner_user_id IS NULL THEN 'Not given yet' ELSE ${personName('u')} END`, { sortable: true, notNull: true }),
    c('pieces', 'Pieces', 'number', '(SELECT COUNT(*) FROM campaign_deliverables d WHERE d.campaign_id = t.id)', { notNull: true }),
    c('creators', 'Creators', 'number', '(SELECT COUNT(*) FROM campaign_assignments a WHERE a.campaign_id = t.id)', { notNull: true }),
    c('public', 'On the site', 'bool', 't.public', { filter: 'pick', notNull: true }),
    c('brief', 'Brief', 'longtext', 't.brief', { searchable: true, format: 'inert' }),
    c('usage', 'Usage rights', 'longtext', 't.usage_rights', { format: 'inert' }),
    c('exclusivity', 'Exclusivity', 'longtext', 't.exclusivity_terms', { format: 'inert' }),
    c('restrictions', 'Brand rules', 'longtext', 't.brand_restrictions', { format: 'inert' }),
    stamp('changed', 'Changed', 't.updated_at'),
    c('made', 'Made', 'datetime', 't.created_at', { sortable: true, filter: 'range', notNull: true }),
    c('currency', 'currency', 'text', 't.currency', { hidden: true }),
    c('byBrand', 'By brand', 'datetime', 'm.created_at', { hidden: true, sortable: true, notNull: true, sortTerms: ['m.created_at', 'm.rowid', 't.updated_at', 't.rowid'] }),
  ],
};

const ARMY_CAMPAIGN_LOG: DataTable = {
  key: 'armyCampaignLog',
  name: 'Your brands’ campaign log',
  blurb: 'What happened on your brands’ campaigns, step by step, and who did it.',
  group: 'army',
  audience: 'others',
  needs: ['army'],
  sqlTable: 'campaign_events',
  // Every line, by name, as a campaign's page shows its team What happened.
  from: "campaign_events t JOIN campaigns cp ON cp.id = t.campaign_id JOIN organization_members m ON m.organization_id = cp.organization_id AND m.status = 'active' LEFT JOIN users u ON u.id = t.actor_user_id",
  owner: 'm.user_id = ?1',
  idSql: 't.id',
  // By brand and campaign, the one changed last first, then each campaign's lines newest first: the walk the indexes make.
  defaultSort: { key: 'byCampaign', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'The log is what happened. It grows as the campaign moves in Army.',
  columns: [
    c('campaign', 'Campaign', 'text', 'cp.name', { sortable: true, searchable: true, notNull: true }),
    c('who', 'Who', 'text', `CASE WHEN t.actor_user_id IS NULL THEN 'The app' WHEN t.actor_user_id = ?1 THEN 'You' ELSE ${personName('u')} END`, { sortable: true, searchable: true, notNull: true }),
    c('what', 'What', 'enum', 't.event_type', { options: CAMPAIGN_EVENT_OPTIONS, otherLabel: 'Something else', filter: 'pick', notNull: true }),
    c('details', 'Details', 'text', "NULLIF(t.note, '')", { searchable: true, format: 'inert' }),
    stamp('when', 'When', 't.created_at'),
    c('byCampaign', 'By campaign', 'datetime', 'm.created_at', { hidden: true, sortable: true, notNull: true, sortTerms: ['m.created_at', 'm.rowid', 'cp.updated_at', 'cp.rowid', 't.created_at', 't.rowid'] }),
  ],
};

const WIN_REWARDS: DataTable = {
  key: 'winRewards',
  name: 'Rewards you launched',
  blurb: 'Content rewards you launched in Win: the pool, the rules, entries and points paid.',
  group: 'win',
  needs: ['win'],
  sqlTable: 'bounties',
  from: 'bounties t LEFT JOIN organizations og ON og.id = t.organization_id',
  owner: 't.created_by = ?1',
  idSql: 't.id',
  defaultSort: { key: 'launched', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Change a reward on its page in Win, where everyone who entered is told of each change.',
  columns: [
    c('title', 'Title', 'text', 't.title', { sortable: true, searchable: true, notNull: true }),
    c('brand', 'Brand', 'text', rewardBrand('t', 'og'), { sortable: true, searchable: true, notNull: true }),
    c('status', 'State', 'enum', 't.status', { options: REWARD_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('deliverable', 'What to make', 'text', 't.deliverable', { searchable: true }),
    c('platform', 'Where to post', 'text', "NULLIF(t.platform, '')", { searchable: true }),
    c('pool', 'Pool in points', 'number', 't.budget_points', { sortable: true, notNull: true }),
    c('rate', 'Points per 1,000 views', 'number', 't.rate_per_thousand', { sortable: true, notNull: true }),
    c('cap', 'Most points a creator', 'number', 't.max_payout_points', { sortable: true, notNull: true }),
    c('minViews', 'Least views', 'number', 't.min_views', { sortable: true, notNull: true }),
    c('entries', 'Entries', 'number', '(SELECT COUNT(*) FROM bounty_submissions s WHERE s.bounty_id = t.id)', { sortable: true, notNull: true }),
    c('paid', 'Points paid', 'number', "(SELECT COALESCE(SUM(s.payout_points), 0) FROM bounty_submissions s WHERE s.bounty_id = t.id AND s.status = 'paid')", { sortable: true, notNull: true }),
    c('version', 'Version', 'number', 't.version', { notNull: true }),
    c('brief', 'Brief', 'longtext', 't.brief', { searchable: true, format: 'inert' }),
    c('rules', 'Rules', 'longtext', 't.reward_rule', { format: 'inert' }),
    c('eligibility', 'Who can enter', 'longtext', 't.eligibility', { format: 'inert' }),
    c('opens', 'Opens', 'datetime', 't.starts_at', { sortable: true, filter: 'range', notNull: true }),
    c('closes', 'Closes', 'datetime', 't.ends_at', { sortable: true, filter: 'range', notNull: true }),
    c('featured', 'Featured', 'bool', 't.featured', { filter: 'pick', notNull: true }),
    stamp('launched', 'Launched', 't.created_at'),
  ],
};

const WIN_ENTRIES: DataTable = {
  key: 'winEntries',
  name: 'Your reward entries',
  blurb: 'The posts you entered for content rewards in Win, their views and points.',
  group: 'win',
  needs: ['win'],
  sqlTable: 'bounty_submissions',
  // The reviewer's note is a table of its own (another person's words); who reviewed is never read.
  from: 'bounty_submissions t LEFT JOIN bounties b ON b.id = t.bounty_id LEFT JOIN organizations og ON og.id = b.organization_id',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'entered', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Send a new link, or ask again about a rejection, on the reward’s page in Win.',
  columns: [
    c('reward', 'Reward', 'text', 'b.title', { sortable: true, searchable: true }),
    c('brand', 'Brand', 'text', rewardBrand('b', 'og'), { sortable: true, searchable: true, notNull: true }),
    c('link', 'Your post', 'text', 't.url', { searchable: true, format: 'inert' }),
    c('platform', 'Platform', 'enum', 't.platform', { options: SOCIAL_PLATFORM_OPTIONS, otherLabel: 'Other', filter: 'pick', notNull: true }),
    c('status', 'State', 'enum', 't.status', { options: ENTRY_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('views', 'Latest views', 'number', 't.latest_views', { sortable: true, notNull: true }),
    c('verifiedViews', 'Verified views', 'number', 't.evidence_views', { sortable: true }),
    c('points', 'Points', 'number', 't.payout_points', { sortable: true, notNull: true }),
    c('dispute', 'What you asked', 'longtext', "NULLIF(t.dispute_note, '')", { format: 'inert' }),
    stamp('entered', 'Entered', 't.created_at'),
    c('changed', 'Changed', 'datetime', 't.updated_at', { sortable: true, filter: 'range', notNull: true }),
  ],
};

const WIN_REVIEWER_NOTES: DataTable = {
  key: 'winReviewerNotes',
  name: 'Reviewer notes on your entries',
  blurb: 'What a Win reviewer wrote when they checked an entry of yours.',
  group: 'win',
  audience: 'others',
  needs: ['win'],
  sqlTable: 'bounty_submissions',
  // A reviewer's words, which Win shows the person on their entry; never who the reviewer was.
  from: 'bounty_submissions t LEFT JOIN bounties b ON b.id = t.bounty_id',
  owner: 't.user_id = ?1',
  where: "t.evidence_note <> ''",
  idSql: 't.id',
  defaultSort: { key: 'entered', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A reviewer’s note stays as they wrote it. Ask again about a rejection on the reward’s page in Win.',
  columns: [
    c('reward', 'Reward', 'text', 'b.title', { sortable: true, searchable: true }),
    c('status', 'State', 'enum', 't.status', { options: ENTRY_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('note', 'Reviewer’s note', 'longtext', 't.evidence_note', { searchable: true, format: 'inert' }),
    stamp('entered', 'Entered', 't.created_at'),
    c('changed', 'Changed', 'datetime', 't.updated_at', { sortable: true, filter: 'range', notNull: true }),
  ],
};

const PITCH_PATH = '/proposals/:id';
/** A pitch's title, words or budget, sent with the other two as stored (PATCH /proposals/:id takes all three), only while the team has not started. */
function pitchEdit(field: string, input: EditInput, more: Partial<ColumnEdit> = {}): ColumnEdit {
  return { method: 'PATCH', path: PITCH_PATH, field, input, recipe: 'pitchWhole', when: 'pitchWaiting', ...more };
}
/** The most a pitch's budget can be, in cents: the route keeps at most 1,000,000,000,000 whole units (budgetOf in routes/proposals.ts). */
export const PITCH_BUDGET_MAX_CENTS = 100_000_000_000_000;
/** TV's pitches and Fund's applications: one table each, as each is its own app, read from the one table they share. */
function pitchTable(key: string, kind: 'tv' | 'fund', name: string, blurb: string, budgetLabel: string): DataTable {
  return {
    key,
    name,
    blurb,
    group: 'pitches',
    needs: [kind],
    sqlTable: 'proposals',
    // The decision log is left out: the reviewers' notes, and who moved it.
    from: 'proposals t',
    owner: 't.user_id = ?1',
    where: `t.kind = '${kind}'`,
    idSql: 't.id',
    defaultSort: { key: 'changed', dir: 'desc' },
    read: 'sql',
    columns: [
      c('title', 'Title', 'text', 't.title', { sortable: true, searchable: true, notNull: true, edit: pitchEdit('title', 'text', { minLength: 1, maxLength: 120 }) }),
      c('stage', 'Stage', 'enum', 't.stage', { options: PROPOSAL_STAGE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
      c('budget', budgetLabel, 'money', wholeUnits('t.budget_amount'), {
        currency: 'currency',
        sortable: true,
        notNull: true,
        edit: pitchEdit('budgetAmount', 'money', { min: 0, max: PITCH_BUDGET_MAX_CENTS, note: 'Kept in whole amounts, as TV and Fund keep it.' }),
      }),
      c('pitch', 'Pitch', 'longtext', 't.pitch', { searchable: true, format: 'inert', edit: pitchEdit('pitch', 'longtext', { minLength: 1, maxLength: 8000 }) }),
      stamp('sent', 'Sent', 't.created_at'),
      stamp('changed', 'Changed', 't.updated_at'),
      c('currency', 'currency', 'text', 't.currency', { hidden: true }),
    ],
  };
}
const TV_PITCHES = pitchTable('tvPitches', 'tv', 'TV pitches', 'Series you pitched in TV, and where each one stands.', 'Budget');
const FUND_APPLICATIONS = pitchTable('fundApplications', 'fund', 'Fund applications', 'What you asked Fund to back, and where each one stands.', 'Amount asked');

const CLUB_MEMBERSHIP: DataTable = {
  key: 'clubMembership',
  name: 'Club membership',
  blurb: 'Your Club application, where it stands, and when your membership runs.',
  group: 'club',
  needs: ['club'],
  sqlTable: 'memberships',
  // A reviewer's note, and who decided or manages it, are left out: another person's words and name. Only whether a manager is named shows.
  from: 'memberships t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'applied', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Apply, or apply again, under Club. A reviewer decides.',
  columns: [
    c('status', 'State', 'enum', 't.status', { options: CLUB_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('note', 'Your note', 'longtext', "NULLIF(t.note, '')", { format: 'inert' }),
    c('starts', 'Starts', 'datetime', 't.starts_at', { sortable: true }),
    c('ends', 'Ends', 'datetime', 't.ends_at', { sortable: true }),
    c('manager', 'A manager named', 'bool', '(t.manager_user_id IS NOT NULL)', { notNull: true }),
    stamp('applied', 'Applied', 't.created_at'),
  ],
};

// -----------------------------------------------------------------------------------------------------------------------------------
// Party, Kreators Run and Circles (2026-11-14, the fifth batch of "ok, add them"). The person's own records ('own': events they host and
// signed up for, their feedback, their lines in an event's conversation, the clubs and runs they host, the clubs they are in, the runs they
// logged, their lines in a run's discussion, the collabs they posted and the ones their clubs applied to, the circles they signed up for)
// follow the old rules. Those with another person's name or words ('others': the guests at their events, who logged the runs at their clubs,
// the clubs that applied to their collabs) reach only the person and AI chat on a model that keeps nothing. Their own lines at a circle's
// table are 'others' too, though they hold only their words: a circle is aliases only, so showing them to anyone else would say who wrote
// under that alias (a coach could sit at the same table).
// Never listed: a code (an event's or a circle's attendee code, a run's start code), an event's online room link, who took a line down or the
// words of a line taken down, a host's or a poster's name on the person's own side, anyone else at a circle's table. A line written without a
// name never reaches a coach (`coachWhere`), as with posts. An attendee code claimed is a column of the event or circle it was for (its xp),
// never a table of its own, so it lists only while that app is on.
// -----------------------------------------------------------------------------------------------------------------------------------

// Words copied from events.ts, circles.ts and the screens (Party.tsx, Run.tsx, Circles.tsx); the batch's test checks each.
export const EVENT_TYPE_OPTIONS = opts([['meetup', 'Meetup'], ['party', 'Party'], ['workshop', 'Workshop'], ['camp', 'Camp'], ['day', 'Kreators Day']]);
/** An event's or a run's state as Party's cards say it. */
export const EVENT_STATE_OPTIONS = opts([['published', 'Live'], ['cancelled', 'Cancelled'], ['done', 'Done']]);
/** Who can see an event, in the words of Party's form. */
export const EVENT_VISIBILITY_OPTIONS = opts([['public', 'Everyone'], ['club', 'Club members'], ['private', 'People with the link']]);
/** A seat at an event, by its state. */
export const SEAT_STATUS_OPTIONS = opts([['registered', 'Registered'], ['waitlisted', 'Waitlisted'], ['attended', 'Attended'], ['cancelled', 'Cancelled']]);
/** RUN_PACE_META in events.ts, in RUN_PACES' order. */
export const RUN_PACE_OPTIONS = opts([['easy', 'Easy'], ['steady', 'Steady'], ['fast', 'Fast'], ['all', 'All paces']]);
/** Who can find a club, in the words of Kreators Run's form. */
export const CLUB_VISIBILITY_OPTIONS = opts([['public', 'Everyone'], ['private', 'People with the link']]);
export const CLUB_STATE_OPTIONS = opts([['active', 'Open'], ['closed', 'Closed']]);
export const CLUB_MEMBER_OPTIONS = opts([['member', 'In the club'], ['left', 'Left']]);
export const RUN_ENTRY_OPTIONS = opts([['logged', 'Counted'], ['void', 'Voided by the host']]);
export const COLLAB_STATE_OPTIONS = opts([['open', 'Open'], ['closed', 'Closed']]);
/** A club's application to a brand collab, as Kreators Run's cards say it. */
export const COLLAB_APPLICATION_OPTIONS = opts([['applied', 'Applied'], ['accepted', 'Accepted'], ['declined', 'Not this time']]);
export const CIRCLE_STATE_OPTIONS = opts([['open', 'Taking sign-ups'], ['matched', 'Tables set'], ['done', 'Done'], ['cancelled', 'Cancelled']]);
/** How a person said they will show up at a circle (CIRCLE_STATUS_META), which only they ever see. */
export const CIRCLE_SHOW_UP_OPTIONS = opts([['single', 'Single'], ['committed', 'Committed'], ['private', 'Rather not say']], 'Not said');
/** ATTENDEE_XP_MAX in events.ts: the most xp a host gives each guest or runner. */
export const ATTENDEE_XP_MOST = 50;
/** RUN_CODE_WINDOW.before in events.ts: a code opens, and its xp is fixed, this many minutes before the start. */
export const CODE_OPENS_MINUTES = 30;

/**
 * Whether a host may still change the xp each guest or runner gets: not cancelled, and its code not open yet (attendeeXpLocked), read by
 * SQLite's own clock, in the same shape as the stored instants (toISOString), so the box shows only while the route would take it.
 */
const xpOpenSql = (startsAt: string, status: string): string =>
  `(${status} != 'cancelled' AND ${startsAt} > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+${CODE_OPENS_MINUTES} minutes'))`;
/** The photo folder a host shared for an event or a run, and whether there is one. The link reaches only its owner (ownerOnly): it opens the guests' photos. */
const photoFolderOf = (app: 'party' | 'run', thing: string): string => `(SELECT p.url FROM event_photos p WHERE p.app = '${app}' AND p.event_id = ${thing})`;
const photoSharedOf = (app: 'party' | 'run', thing: string): string => `EXISTS (SELECT 1 FROM event_photos p WHERE p.app = '${app}' AND p.event_id = ${thing})`;
/** The xp a person got from an event's or a circle's attendee code, or nothing (never the code). */
const codeXpOf = (app: 'party' | 'circles', thing: string): string => `(SELECT x.xp FROM attendee_claims x WHERE x.app = '${app}' AND x.thing_id = ${thing} AND x.user_id = t.user_id)`;
/** A guest's seats, counting only live accounts, as Party counts them (seatsTaken in routes/party.ts). */
const seatsOf = (statuses: string): string =>
  `(SELECT COUNT(*) FROM event_registrations r JOIN users su ON su.id = r.user_id WHERE r.event_id = t.id AND r.status IN (${statuses}) AND su.display_name != ${DELETED})`;
const XP_NOTE = 'What each one gets for typing the code at the start. It is fixed thirty minutes before. The code itself is shown only on its page.';

const PARTY_HOSTED: DataTable = {
  key: 'partyHosted',
  name: 'Events you host',
  blurb: 'Events you host in Party: when and where, who is coming, and the xp each guest gets.',
  group: 'party',
  needs: ['party'],
  sqlTable: 'events',
  // Never the online room's link, which Party gives only to guests with a seat, nor the attendee code. The guests are a table of their own.
  from: 'events t',
  owner: 't.host_user_id = ?1',
  // The row's own number, never the event's id: a private event's id is its link (Party takes a seat by it and never asks how it was found),
  // so a coach or an admin is never handed one. The owner's edit reads the id from `eventId`, a cell only their own view selects.
  idSql: 't.rowid',
  defaultSort: { key: 'starts', dir: 'desc' },
  read: 'sql',
  columns: [
    c('title', 'Event', 'text', 't.title', { sortable: true, searchable: true, notNull: true }),
    c('kind', 'Kind', 'enum', 't.event_type', { options: EVENT_TYPE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('state', 'State', 'enum', 't.status', { options: EVENT_STATE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('starts', 'Starts', 'datetime', 't.starts_at', { sortable: true, filter: 'range', notNull: true }),
    c('ends', 'Ends', 'datetime', 't.ends_at', { sortable: true, filter: 'range', notNull: true }),
    c('venue', 'Where', 'text', "NULLIF(t.venue, '')", { searchable: true }),
    c('visibility', 'Who can see it', 'enum', 't.visibility', { options: EVENT_VISIBILITY_OPTIONS, ordered: true, filter: 'pick', notNull: true }),
    c('seats', 'Seats', 'number', 't.capacity', { sortable: true }),
    c('going', 'Going', 'number', seatsOf("'registered', 'attended'"), { sortable: true, notNull: true }),
    c('waiting', 'Waitlist', 'number', seatsOf("'waitlisted'"), { notNull: true }),
    c('ticket', 'Ticket in points', 'number', 't.price_points', { sortable: true, notNull: true }),
    c('guestXp', 'Xp for each guest', 'number', "(SELECT a.xp FROM attendee_codes a WHERE a.app = 'party' AND a.thing_id = t.id)", {
      sortable: true,
      edit: { method: 'PUT', path: '/party/events/:id/attendee-code', param: 'eventId', field: 'xp', input: 'number', min: 1, max: ATTENDEE_XP_MOST, step: 1, when: 'xpOpen', note: `${XP_NOTE} With no code yet, the event gets one.` },
    }),
    c('claimed', 'Guests who typed the code', 'number', "(SELECT COUNT(*) FROM attendee_claims x WHERE x.app = 'party' AND x.thing_id = t.id)", { notNull: true }),
    c('score', 'Feedback score', 'number', '(SELECT ROUND(AVG(f.rating), 1) FROM event_feedback f WHERE f.event_id = t.id)', { sortable: true }),
    c('scores', 'Feedback given', 'number', '(SELECT COUNT(*) FROM event_feedback f WHERE f.event_id = t.id)', { notNull: true }),
    c('photosShared', 'Photo folder shared', 'bool', photoSharedOf('party', 't.id'), { filter: 'pick', notNull: true }),
    c('photoFolder', 'Photo folder', 'text', photoFolderOf('party', 't.id'), { ownerOnly: true, format: 'inert' }),
    c('about', 'About it', 'longtext', "NULLIF(t.description, '')", { searchable: true, format: 'inert' }),
    c('featured', 'Featured', 'bool', 't.featured', { filter: 'pick', notNull: true }),
    stamp('made', 'Made', 't.created_at'),
    c('xpOpen', 'xpOpen', 'bool', xpOpenSql('t.starts_at', 't.status'), { hidden: true, notNull: true }),
    c('eventId', 'eventId', 'text', 't.id', { hidden: true, ownerOnly: true }),
  ],
};

const PARTY_GUESTS: DataTable = {
  key: 'partyGuests',
  name: 'Guests at your events',
  blurb: 'Who signed up for the events you host, by name, and who came.',
  group: 'party',
  audience: 'others',
  needs: ['party'],
  sqlTable: 'event_registrations',
  // Every guest of the person's events, by name, as an event's page shows its host the guest list; never a closed account, as there.
  from: 'event_registrations t JOIN events e ON e.id = t.event_id JOIN users u ON u.id = t.user_id',
  owner: 'e.host_user_id = ?1',
  where: `u.display_name != ${DELETED}`,
  idSql: 't.id',
  // By event, the one starting last first, then each event's guests newest first: the walk the events' index (by host and start) and the
  // seats' own (by event and the time each signed up) make, so no page sorts. Tap Signed up to sort by the time alone.
  defaultSort: { key: 'byEvent', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Check a guest in on the event’s page in Party.',
  columns: [
    c('event', 'Event', 'text', 'e.title', { sortable: true, searchable: true, notNull: true }),
    c('starts', 'Starts', 'datetime', 'e.starts_at', { sortable: true, filter: 'range', notNull: true }),
    c('guest', 'Guest', 'text', 'u.display_name', { sortable: true, searchable: true, notNull: true }),
    c('status', 'Seat', 'enum', 't.status', { options: SEAT_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('openToIntros', 'Open to intros', 'bool', '(t.networking_opt_in = 1)', { filter: 'pick', notNull: true }),
    c('checkedIn', 'Checked in', 'datetime', 't.checked_in_at', { sortable: true, filter: 'range' }),
    stamp('signedUp', 'Signed up', 't.registered_at'),
    c('byEvent', 'By event', 'datetime', 'e.starts_at', { hidden: true, sortable: true, notNull: true, sortTerms: ['e.starts_at', 'e.rowid', 't.registered_at', 't.rowid'] }),
  ],
};

/** On an event's list to meet other guests, as its page reads it (`me` in routes/connect.ts): listed, or a seat that said yes. */
const PARTY_OPEN_TO_MEET =
  "(EXISTS (SELECT 1 FROM event_networking n WHERE n.app = 'party' AND n.event_id = t.event_id AND n.user_id = t.user_id) OR (t.networking_opt_in = 1 AND t.status IN ('registered', 'attended')))";

const PARTY_JOINED: DataTable = {
  key: 'partyJoined',
  name: 'Events you signed up for',
  blurb: 'Events you signed up for in Party: your seat, whether you came, and the xp from its code.',
  group: 'party',
  needs: ['party'],
  sqlTable: 'event_registrations',
  // The seat and the event's title, time and place, as the guest sees them. Who hosts it is left out: another person's name.
  from: 'event_registrations t LEFT JOIN events e ON e.id = t.event_id',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'signedUp', dir: 'desc' },
  read: 'sql',
  columns: [
    c('event', 'Event', 'text', 'e.title', { sortable: true, searchable: true }),
    c('kind', 'Kind', 'enum', 'e.event_type', { options: EVENT_TYPE_OPTIONS, ordered: true, filter: 'pick' }),
    c('starts', 'Starts', 'datetime', 'e.starts_at', { sortable: true, filter: 'range' }),
    c('venue', 'Where', 'text', "NULLIF(e.venue, '')", { searchable: true }),
    c('eventState', 'Event is', 'enum', 'e.status', { options: EVENT_STATE_OPTIONS, ordered: true, filter: 'pick' }),
    c('status', 'Your seat', 'enum', 't.status', { options: SEAT_STATUS_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('checkedIn', 'Checked in', 'datetime', 't.checked_in_at', { sortable: true, filter: 'range' }),
    c('paid', 'Ticket in points', 'number', 't.paid_points', { sortable: true }),
    c('openToMeet', 'Open to meeting guests', 'bool', PARTY_OPEN_TO_MEET, {
      filter: 'pick',
      notNull: true,
      edit: { method: 'PUT', path: '/connect/party/:id/networking', param: 'eventId', field: 'on', input: 'toggle', when: 'seatHeld', note: 'Listed under Meet other guests on the event’s page, where another guest can ask you to be friends.' },
    }),
    c('codeXp', 'Xp from its code', 'number', codeXpOf('party', 't.event_id'), { sortable: true }),
    stamp('signedUp', 'Signed up', 't.registered_at'),
    // The event's id, for the list-to-meet route's path: only the owner's own view selects it, since a private event's id is its link.
    c('eventId', 'eventId', 'text', 't.event_id', { hidden: true, ownerOnly: true }),
  ],
};

const PARTY_FEEDBACK: DataTable = {
  key: 'partyFeedback',
  name: 'Your event feedback',
  blurb: 'The score and words you left after events in Party.',
  group: 'party',
  needs: ['party'],
  sqlTable: 'event_feedback',
  from: 'event_feedback t LEFT JOIN events e ON e.id = t.event_id',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'left', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Leave your feedback again on the event’s page in Party.',
  columns: [
    c('event', 'Event', 'text', 'e.title', { sortable: true, searchable: true }),
    c('score', 'Score out of 5', 'number', 't.rating', { sortable: true, notNull: true }),
    c('words', 'Your words', 'longtext', "NULLIF(t.comment, '')", { searchable: true, format: 'inert' }),
    stamp('left', 'Left', 't.created_at'),
  ],
};

const PARTY_LINES: DataTable = {
  key: 'partyLines',
  name: 'Your lines in event talk',
  blurb: 'What you wrote in events’ conversations in Party, with or without your name.',
  group: 'party',
  needs: ['party'],
  sqlTable: 'event_messages',
  // Only the person's own lines: the rest of a conversation is other people's words. Who took a line down is never read, and a line taken
  // down shows no words here, as the conversation shows none. Only Party's lines: a run's moved to its own discussion (0080).
  from: 'event_messages t LEFT JOIN events e ON e.id = t.event_id',
  owner: 't.user_id = ?1',
  where: "t.app = 'party'",
  idSql: 't.id',
  defaultSort: { key: 'written', dir: 'desc' },
  read: 'sql',
  // A coach never sees a line written without a name: listing it would say who wrote it.
  coachWhere: 't.anonymous = 0',
  readOnlyWhy: 'A line stays as written. Take one down in the event’s conversation in Party.',
  columns: [
    c('event', 'Event', 'text', 'e.title', { sortable: true, searchable: true }),
    c('line', 'Your line', 'longtext', 'CASE WHEN t.removed_by IS NULL THEN t.body END', { searchable: true, format: 'inert' }),
    c('anonymous', 'Without your name', 'bool', 't.anonymous', { sortable: true, filter: 'pick', notNull: true }),
    c('answer', 'An answer to a line', 'bool', '(t.parent_id IS NOT NULL)', { filter: 'pick', notNull: true }),
    c('takenDown', 'Taken down', 'bool', '(t.removed_by IS NOT NULL)', { filter: 'pick', notNull: true }),
    stamp('written', 'Written', 't.created_at'),
  ],
};

const RUN_CLUB_PATH = '/run/clubs/:id';

const RUN_CLUBS_HOSTED: DataTable = {
  key: 'runClubsHosted',
  name: 'Clubs you host',
  blurb: 'Run clubs you started in Kreators Run: when they meet, the pace and how many run.',
  group: 'runs',
  needs: ['run'],
  sqlTable: 'run_clubs',
  from: 'run_clubs t',
  owner: 't.host_user_id = ?1',
  // The row's own number, never the club's id: a club found only through its link is opened and joined by its id (Kreators Run never asks
  // how it was found), so a coach or an admin is never handed one. The owner's edits read the id from `clubId`, a cell only they get.
  idSql: 't.rowid',
  defaultSort: { key: 'started', dir: 'desc' },
  read: 'sql',
  columns: [
    c('club', 'Club', 'text', 't.name', { sortable: true, searchable: true, notNull: true }),
    c('city', 'City', 'text', "NULLIF(t.city, '')", { sortable: true, searchable: true }),
    // Closing a club asks first in Kreators Run, so it is never done here.
    c('state', 'State', 'enum', 't.status', { options: CLUB_STATE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('pace', 'Pace', 'enum', 't.pace', { options: RUN_PACE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true, edit: patch(RUN_CLUB_PATH, 'pace', 'select', { param: 'clubId' }) }),
    c('visibility', 'Who can find it', 'enum', 't.visibility', {
      options: CLUB_VISIBILITY_OPTIONS,
      ordered: true,
      filter: 'pick',
      notNull: true,
      edit: patch(RUN_CLUB_PATH, 'visibility', 'select', { param: 'clubId', note: 'People with the link find it only through its link. Its members stay in it.' }),
    }),
    c('meets', 'When it meets', 'text', "NULLIF(t.meets, '')", { searchable: true, edit: patch(RUN_CLUB_PATH, 'meets', 'text', { param: 'clubId', maxLength: 200 }) }),
    c('about', 'About it', 'longtext', "NULLIF(t.description, '')", { searchable: true, format: 'inert', edit: patch(RUN_CLUB_PATH, 'description', 'longtext', { param: 'clubId', maxLength: 2000 }) }),
    c('members', 'Members', 'number', "(SELECT COUNT(*) FROM run_members m WHERE m.club_id = t.id AND m.status = 'member')", { sortable: true, notNull: true }),
    c('runs', 'Runs', 'number', '(SELECT COUNT(*) FROM runs r WHERE r.club_id = t.id)', { sortable: true, notNull: true }),
    stamp('started', 'Started', 't.created_at'),
    c('clubId', 'clubId', 'text', 't.id', { hidden: true, ownerOnly: true }),
  ],
};

const RUN_CLUBS_JOINED: DataTable = {
  key: 'runClubsJoined',
  name: 'Clubs you are in',
  blurb: 'Run clubs you joined in Kreators Run, and the ones you left.',
  group: 'runs',
  needs: ['run'],
  sqlTable: 'run_members',
  // Who hosts a club is left out: another person's name. Whether it is the person's own is said.
  from: 'run_members t JOIN run_clubs k ON k.id = t.club_id',
  owner: 't.user_id = ?1',
  // One row per club for the person, keyed by the membership's own number, never the club's id: a club found only through its link is
  // opened and joined by its id, so a coach or an admin is never handed one (it may be a third person's club the person only joined).
  idSql: 't.rowid',
  defaultSort: { key: 'joined', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Join or leave a club on its page in Kreators Run.',
  columns: [
    c('club', 'Club', 'text', 'k.name', { sortable: true, searchable: true, notNull: true }),
    c('city', 'City', 'text', "NULLIF(k.city, '')", { sortable: true, searchable: true }),
    c('pace', 'Pace', 'enum', 'k.pace', { options: RUN_PACE_OPTIONS, ordered: true, filter: 'pick', notNull: true }),
    c('status', 'You', 'enum', 't.status', { options: CLUB_MEMBER_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('youHost', 'You host it', 'bool', '(k.host_user_id = ?1)', { filter: 'pick', notNull: true }),
    c('clubState', 'Club is', 'enum', 'k.status', { options: CLUB_STATE_OPTIONS, ordered: true, filter: 'pick', notNull: true }),
    stamp('joined', 'Joined', 't.joined_at'),
  ],
};

const RUNS_HOSTED: DataTable = {
  key: 'runsHosted',
  name: 'Runs you host',
  blurb: 'Runs in the clubs you host: when, how far, how many logged, and the xp each runner gets.',
  group: 'runs',
  needs: ['run'],
  sqlTable: 'runs',
  // Never the start code, which only the host is shown, on the run's card.
  from: 'runs t JOIN run_clubs k ON k.id = t.club_id LEFT JOIN run_collabs cb ON cb.id = t.collab_id',
  owner: 'k.host_user_id = ?1',
  idSql: 't.id',
  // By club, the one started last first, then each club's runs starting last first: the walk the clubs' index (by host) and the runs' own
  // (by club and start) make, so no page sorts. Tap Starts to sort by the time alone.
  defaultSort: { key: 'byClub', dir: 'desc' },
  read: 'sql',
  columns: [
    c('run', 'Run', 'text', 't.title', { sortable: true, searchable: true, notNull: true }),
    c('club', 'Club', 'text', 'k.name', { sortable: true, searchable: true, notNull: true }),
    c('starts', 'Starts', 'datetime', 't.starts_at', { sortable: true, filter: 'range', notNull: true }),
    c('ends', 'Ends', 'datetime', 't.ends_at', { sortable: true, filter: 'range', notNull: true }),
    c('meetingPoint', 'Meeting point', 'text', "NULLIF(t.meeting_point, '')", { searchable: true }),
    c('distance', 'Distance', 'number', 't.metres', { sortable: true, notNull: true, format: 'km' }),
    // Mark done and Cancel run are the run card's own (a cancel tells every member), so the state is never changed here.
    c('state', 'State', 'enum', 't.status', { options: EVENT_STATE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('xp', 'Xp for each runner', 'number', 't.xp', {
      sortable: true,
      notNull: true,
      edit: { method: 'POST', path: '/run/runs/:id/recode', field: 'xp', input: 'number', min: 1, max: ATTENDEE_XP_MOST, step: 1, when: 'xpOpen', note: `${XP_NOTE} The code stays as it is.` },
    }),
    c('logged', 'Runners who logged it', 'number', "(SELECT COUNT(*) FROM run_entries e WHERE e.run_id = t.id AND e.status = 'logged')", { sortable: true, notNull: true }),
    c('collab', 'Brand collab', 'text', 'cb.title', { searchable: true }),
    c('photosShared', 'Photo folder shared', 'bool', photoSharedOf('run', 't.id'), { filter: 'pick', notNull: true }),
    c('photoFolder', 'Photo folder', 'text', photoFolderOf('run', 't.id'), { ownerOnly: true, format: 'inert' }),
    stamp('added', 'Added', 't.created_at'),
    c('xpOpen', 'xpOpen', 'bool', xpOpenSql('t.starts_at', 't.status'), { hidden: true, notNull: true }),
    c('byClub', 'By club', 'datetime', 'k.created_at', { hidden: true, sortable: true, notNull: true, sortTerms: ['k.created_at', 'k.rowid', 't.starts_at', 't.rowid'] }),
  ],
};

const RUN_ENTRIES: DataTable = {
  key: 'runEntries',
  name: 'Runs you logged',
  blurb: 'Club runs you logged with their start code in Kreators Run, with the xp and points.',
  group: 'runs',
  needs: ['run'],
  sqlTable: 'run_entries',
  from: 'run_entries t LEFT JOIN runs r ON r.id = t.run_id LEFT JOIN run_clubs k ON k.id = t.club_id',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'logged', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A run is logged with its start code at the line. Only the club’s host can void one.',
  columns: [
    c('run', 'Run', 'text', 'r.title', { sortable: true, searchable: true }),
    c('club', 'Club', 'text', 'k.name', { sortable: true, searchable: true }),
    c('starts', 'Run started', 'datetime', 'r.starts_at', { sortable: true, filter: 'range' }),
    c('distance', 'Distance', 'number', 't.metres', { sortable: true, notNull: true, format: 'km' }),
    c('minutes', 'Time', 'number', 'NULLIF(t.minutes, 0)', { sortable: true, format: 'minutes' }),
    c('xp', 'Xp', 'number', 't.xp', { sortable: true, notNull: true }),
    c('points', 'Points', 'number', 't.points', { sortable: true, notNull: true }),
    c('status', 'State', 'enum', 't.status', { options: RUN_ENTRY_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('openToMeet', 'Open to meeting runners', 'bool', "EXISTS (SELECT 1 FROM event_networking n WHERE n.app = 'run' AND n.event_id = t.run_id AND n.user_id = t.user_id)", { filter: 'pick', notNull: true }),
    stamp('logged', 'Logged', 't.logged_at'),
  ],
};

const RUN_ENTRIES_HOSTED: DataTable = {
  key: 'runEntriesHosted',
  name: 'Runs logged at your clubs',
  blurb: 'Who logged each run at the clubs you host, by name, and any you voided.',
  group: 'runs',
  audience: 'others',
  needs: ['run'],
  sqlTable: 'run_entries',
  // Every entry at the person's clubs, by name, as a club's page shows its host.
  from: 'run_entries t JOIN run_clubs k ON k.id = t.club_id LEFT JOIN runs r ON r.id = t.run_id LEFT JOIN users u ON u.id = t.user_id',
  owner: 'k.host_user_id = ?1',
  idSql: 't.id',
  // By club, the one started last first, then each club's entries newest first: the clubs' index by host and the entries' by club and time.
  defaultSort: { key: 'byClub', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Void an entry on the club’s page in Kreators Run, where the runner is told.',
  columns: [
    c('run', 'Run', 'text', 'r.title', { sortable: true, searchable: true }),
    c('club', 'Club', 'text', 'k.name', { sortable: true, searchable: true, notNull: true }),
    c('runner', 'Runner', 'text', personName('u'), { sortable: true, searchable: true, notNull: true }),
    c('distance', 'Distance', 'number', 't.metres', { sortable: true, notNull: true, format: 'km' }),
    c('minutes', 'Time', 'number', 'NULLIF(t.minutes, 0)', { sortable: true, format: 'minutes' }),
    c('status', 'State', 'enum', 't.status', { options: RUN_ENTRY_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    stamp('logged', 'Logged', 't.logged_at'),
    c('byClub', 'By club', 'datetime', 'k.created_at', { hidden: true, sortable: true, notNull: true, sortTerms: ['k.created_at', 'k.rowid', 't.logged_at', 't.rowid'] }),
  ],
};

const RUN_LINES: DataTable = {
  key: 'runLines',
  name: 'Your lines in run talk',
  blurb: 'What you wrote in runs’ discussions in Kreators Run, with or without your name.',
  group: 'runs',
  needs: ['run'],
  sqlTable: 'run_messages',
  // Only the person's own lines; never who took one down. A line taken down has lost its words, as the discussion keeps none.
  from: 'run_messages t LEFT JOIN runs r ON r.id = t.run_id LEFT JOIN run_clubs k ON k.id = r.club_id',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'written', dir: 'desc' },
  read: 'sql',
  // A coach never sees a line written without a name: listing it would say who wrote it.
  coachWhere: 't.anonymous = 0',
  readOnlyWhy: 'A line stays as written. Take one down in the run’s discussion in Kreators Run.',
  columns: [
    c('run', 'Run', 'text', 'r.title', { sortable: true, searchable: true }),
    c('club', 'Club', 'text', 'k.name', { sortable: true, searchable: true }),
    c('line', 'Your line', 'longtext', 'CASE WHEN t.deleted_at IS NULL THEN t.body END', { searchable: true, format: 'inert' }),
    c('anonymous', 'Without your name', 'bool', 't.anonymous', { sortable: true, filter: 'pick', notNull: true }),
    c('answer', 'An answer to a line', 'bool', '(t.reply_to IS NOT NULL)', { filter: 'pick', notNull: true }),
    c('takenDown', 'Taken down', 'bool', '(t.deleted_at IS NOT NULL)', { filter: 'pick', notNull: true }),
    // In the order they were written (`seq`), which the person's own index keeps.
    stamp('written', 'Written', 't.created_at', { sortSql: 't.seq' }),
  ],
};

const RUN_COLLABS_POSTED: DataTable = {
  key: 'runCollabsPosted',
  name: 'Brand collabs you posted',
  blurb: 'Collabs you posted for run clubs in Kreators Run: the giveaway, dates and who applied.',
  group: 'runs',
  needs: ['run'],
  sqlTable: 'run_collabs',
  from: 'run_collabs t',
  owner: 't.created_by = ?1',
  idSql: 't.id',
  defaultSort: { key: 'posted', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Close a collab, or answer a club, under Brand collabs in Kreators Run.',
  columns: [
    c('collab', 'Collab', 'text', 't.title', { sortable: true, searchable: true, notNull: true }),
    c('brand', 'Brand', 'text', "NULLIF(t.brand_name, '')", { sortable: true, searchable: true }),
    c('state', 'State', 'enum', 't.status', { options: COLLAB_STATE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('giveaway', 'Giveaway', 'text', "NULLIF(t.giveaway, '')", { searchable: true }),
    c('howMany', 'How many to win', 'number', 't.giveaway_count', { sortable: true, notNull: true }),
    c('city', 'City', 'text', "NULLIF(t.city, '')", { searchable: true }),
    c('starts', 'Starts', 'datetime', 't.starts_at', { sortable: true, filter: 'range', notNull: true }),
    c('ends', 'Ends', 'datetime', 't.ends_at', { sortable: true, filter: 'range', notNull: true }),
    c('applied', 'Clubs applied', 'number', '(SELECT COUNT(*) FROM run_collab_applications a WHERE a.collab_id = t.id)', { sortable: true, notNull: true }),
    c('accepted', 'Clubs accepted', 'number', "(SELECT COUNT(*) FROM run_collab_applications a WHERE a.collab_id = t.id AND a.status = 'accepted')", { sortable: true, notNull: true }),
    c('brief', 'Brief', 'longtext', "NULLIF(t.brief, '')", { searchable: true, format: 'inert' }),
    c('asks', 'What it asks', 'longtext', "NULLIF(t.asks, '')", { format: 'inert' }),
    stamp('posted', 'Posted', 't.created_at'),
  ],
};

const RUN_COLLAB_APPLICANTS: DataTable = {
  key: 'runCollabApplicants',
  name: 'Clubs that applied to your collabs',
  blurb: 'Run clubs that applied to the brand collabs you posted, with their host and note.',
  group: 'runs',
  audience: 'others',
  needs: ['run'],
  sqlTable: 'run_collab_applications',
  // Every club that applied to the person's collabs, with its host by name and their note, as Brand collabs shows its poster.
  from: 'run_collab_applications t JOIN run_collabs cb ON cb.id = t.collab_id LEFT JOIN run_clubs k ON k.id = t.club_id LEFT JOIN users u ON u.id = t.user_id',
  owner: 'cb.created_by = ?1',
  idSql: 't.id',
  // By collab, the one posted last first, then each one's applications newest first: the collabs' index by poster and the applications' by
  // collab and time.
  defaultSort: { key: 'byCollab', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Accept or decline a club under Brand collabs in Kreators Run, where its host is told.',
  columns: [
    c('collab', 'Collab', 'text', 'cb.title', { sortable: true, searchable: true, notNull: true }),
    c('club', 'Club', 'text', 'k.name', { sortable: true, searchable: true }),
    c('host', 'Its host', 'text', personName('u'), { sortable: true, searchable: true, notNull: true }),
    c('note', 'Their note', 'longtext', "NULLIF(t.note, '')", { searchable: true, format: 'inert' }),
    c('status', 'State', 'enum', 't.status', { options: COLLAB_APPLICATION_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    stamp('applied', 'Applied', 't.created_at'),
    c('decided', 'Answered', 'datetime', 't.decided_at', { sortable: true, filter: 'range' }),
    c('byCollab', 'By collab', 'datetime', 'cb.created_at', { hidden: true, sortable: true, notNull: true, sortTerms: ['cb.created_at', 'cb.rowid', 't.created_at', 't.rowid'] }),
  ],
};

const RUN_COLLAB_APPLICATIONS: DataTable = {
  key: 'runCollabApplications',
  name: 'Collabs your clubs applied to',
  blurb: 'Brand collabs you applied to with a club you host, your note and the answer.',
  group: 'runs',
  needs: ['run'],
  sqlTable: 'run_collab_applications',
  // Who posted a collab is left out: another person's name. The brand's own name, as the collab shows it, stays.
  from: 'run_collab_applications t LEFT JOIN run_collabs cb ON cb.id = t.collab_id LEFT JOIN run_clubs k ON k.id = t.club_id',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'applied', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A collab’s poster answers each club. Apply under Brand collabs in Kreators Run.',
  columns: [
    c('collab', 'Collab', 'text', 'cb.title', { sortable: true, searchable: true }),
    c('brand', 'Brand', 'text', "NULLIF(cb.brand_name, '')", { sortable: true, searchable: true }),
    c('giveaway', 'Giveaway', 'text', "NULLIF(cb.giveaway, '')", { searchable: true }),
    c('club', 'Your club', 'text', 'k.name', { sortable: true, searchable: true }),
    c('note', 'Your note', 'longtext', "NULLIF(t.note, '')", { searchable: true, format: 'inert' }),
    c('status', 'State', 'enum', 't.status', { options: COLLAB_APPLICATION_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    stamp('applied', 'Applied', 't.created_at'),
    c('decided', 'Answered', 'datetime', 't.decided_at', { sortable: true, filter: 'range' }),
  ],
};

const CIRCLE_SIGNUPS: DataTable = {
  key: 'circleSignups',
  name: 'Circles you signed up for',
  blurb: 'Circles you signed up for, whether you got a table, and the xp from its code.',
  group: 'circles',
  // Only the person and AI chat on a model that keeps nothing (2026-11-14, the review): Circles never tells anyone who is at a circle, its
  // own staff hosts included (they see counts), so even which circle a named person signed up for, and whether they got a table, would
  // narrow their alias at that table to a few names. A coach or an admin who sat at it could find them behind it.
  audience: 'others',
  needs: ['circles'],
  sqlTable: 'circle_signups',
  // The person's own seat only: nobody else at a table is ever read. How they said they will show up, their table and the name they go by
  // there stay ownerOnly too, so no view but the person's own ever selects them.
  from:
    'circle_signups t JOIN circle_events e ON e.id = t.event_id LEFT JOIN circle_groups g ON g.event_id = t.event_id AND g.id IN (SELECT cm.group_id FROM circle_members cm WHERE cm.user_id = t.user_id) LEFT JOIN circle_members m ON m.group_id = g.id AND m.user_id = t.user_id',
  owner: 't.user_id = ?1',
  // One row per circle for the person (the key is the circle and the person).
  idSql: 't.event_id',
  defaultSort: { key: 'signedUp', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Change how you will show up, or leave before the tables are set, under Circles.',
  columns: [
    c('circle', 'Circle', 'text', 'e.title', { sortable: true, searchable: true, notNull: true }),
    c('city', 'City', 'text', 'e.city', { sortable: true, searchable: true, notNull: true }),
    c('area', 'Area', 'text', "NULLIF(e.area, '')", { searchable: true }),
    c('when', 'When', 'datetime', 'e.starts_at', { sortable: true, filter: 'range', notNull: true }),
    c('weekly', 'Every week', 'bool', "(e.repeat = 'weekly')", { filter: 'pick', notNull: true }),
    c('state', 'Circle is', 'enum', 'e.status', { options: CIRCLE_STATE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('showUp', 'How you show up', 'enum', "NULLIF(t.status, '')", { options: CIRCLE_SHOW_UP_OPTIONS, ordered: true, filter: 'pick', ownerOnly: true }),
    c('seated', 'Got a table', 'bool', '(m.group_id IS NOT NULL)', { filter: 'pick', notNull: true }),
    c('table', 'Your table', 'text', 'g.name', { ownerOnly: true }),
    c('alias', 'Your name there', 'text', 'm.alias', { ownerOnly: true }),
    c('codeXp', 'Xp from its code', 'number', codeXpOf('circles', 't.event_id'), { sortable: true }),
    stamp('signedUp', 'Signed up', 't.created_at'),
  ],
};

const CIRCLE_LINES: DataTable = {
  key: 'circleLines',
  name: 'Your lines at circle tables',
  blurb: 'What you wrote in your circle tables’ chats, under the name you went by there.',
  group: 'circles',
  // Only the person's own words, but under an alias at a table of people who never learn who they are: shown to a coach or an admin, a line
  // would say who wrote it. So only the person and AI chat on a model that keeps nothing.
  audience: 'others',
  needs: ['circles'],
  sqlTable: 'circle_messages',
  from:
    'circle_messages t LEFT JOIN circle_groups g ON g.id = t.group_id LEFT JOIN circle_events e ON e.id = g.event_id LEFT JOIN circle_members m ON m.group_id = t.group_id AND m.user_id = t.user_id',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'written', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A line at a circle’s table stays as written.',
  columns: [
    c('circle', 'Circle', 'text', 'e.title', { sortable: true, searchable: true }),
    c('table', 'Table', 'text', 'g.name', { sortable: true }),
    c('alias', 'You went by', 'text', 'm.alias', { searchable: true }),
    c('line', 'Your line', 'longtext', 't.body', { searchable: true, format: 'inert' }),
    stamp('written', 'Written', 't.created_at'),
  ],
};

// -----------------------------------------------------------------------------------------------------------------------------------
// School and Connection (2026-11-14, the sixth batch of "ok, add them"): what a person made and runs in School, the private programs they were
// invited to and their own lines in cohort talk; Community's channels, their lines there, their reactions, the posts they follow and who they
// muted as a guide; Bond's chats under made-up names, introductions, private rooms and the people they blocked by name.
// -----------------------------------------------------------------------------------------------------------------------------------

/** A School program's state, read the one way School reads it (`VIS` in routes/school.ts, a test holds the two together): `published = 1` is
 * public, and a row marked public whose `published` went back to 0 reads as a draft. */
export const programStateSql = (a: string): string => `(CASE WHEN ${a}.published = 1 THEN 'public' WHEN ${a}.visibility = 'public' THEN 'draft' ELSE ${a}.visibility END)`;
/** PROGRAM_VISIBILITY_META's names, in its order (a test holds them together). */
export const PROGRAM_STATE_OPTIONS = opts([['draft', 'Draft'], ['private', 'Private'], ['public', 'Public'], ['archived', 'Archived']]);
/** How a program runs, in School's own words (`modeName` in screens/School.tsx). */
export const DELIVERY_MODE_OPTIONS = opts([['online', 'Online'], ['in_person', 'In person'], ['hybrid', 'Hybrid']]);
/** Where a cohort stands now, worked out from its dates (below). */
export const COHORT_WHEN_OPTIONS = opts([['upcoming', 'Not started'], ['running', 'Running'], ['always', 'Always open'], ['finished', 'Ended'], ['cancelled', 'Cancelled']]);
/**
 * Where a cohort stands now, from its dates: its stored status says 'upcoming' from the day it opens on and nothing moves it, so School reads the
 * dates. One that runs ten years or more is always open, as School says (`cohortAlwaysOpen`). By SQLite's own clock, in the stored instants' shape.
 */
const COHORT_NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
const COHORT_WHEN_SQL = `CASE WHEN t.status = 'cancelled' THEN 'cancelled' WHEN julianday(t.end_at) - julianday(t.start_at) >= 3650 THEN 'always' WHEN t.start_at > ${COHORT_NOW} THEN 'upcoming' WHEN t.end_at < ${COHORT_NOW} THEN 'finished' ELSE 'running' END`;
/** How a member shows in a cohort's talk, in its own words (`CohortDiscussion.tsx`), private unless they said otherwise. */
export const COHORT_TALK_SHOW_OPTIONS = opts([['private', 'Private'], ['public', 'Public']]);
export const COHORT_TALK_SHOWN_DEFAULT = 'private';
/** Community's six reactions, in REACTION_META's words and order (a test holds them together). */
export const REACTION_OPTIONS = opts([['like', 'Like'], ['celebrate', 'Celebrate'], ['support', 'Support'], ['love', 'Love'], ['insightful', 'Insightful'], ['funny', 'Funny']]);
/** Where an anonymous chat in Bond began: from a friend or a page, or at a circle's table (by alias). */
export const CHAT_SOURCE_OPTIONS = opts([['bond', 'Bond'], ['circle', 'A circle table']]);
/** An introduction's state, as Bond words it (waiting until the other side answers). */
export const INTRO_STATE_OPTIONS = opts([['proposed', 'Waiting'], ['accepted', 'Accepted'], ['declined', 'Declined']]);
const INTRO_SIDE_OPTIONS = opts([['you', 'You asked'], ['them', 'They asked']]);
/** A seat in a Bond room: in it, or asked in and not yet said yes. */
export const CHANNEL_SEAT_OPTIONS = opts([['member', 'In it'], ['invited', 'Asked to join']]);
/** A channel's name and topic, as Community's own checks hold them (MIN_CHANNEL_NAME, MAX_CHANNEL_NAME, MAX_CHANNEL_TOPIC; a test holds them together). */
export const CHANNEL_NAME_LEAST = 2;
export const CHANNEL_NAME_MOST = 40;
export const CHANNEL_TOPIC_MOST = 120;
/** A program's name and words, as School's own route holds them. */
export const PROGRAM_NAME_MOST = 120;
export const PROGRAM_ABOUT_MOST = 5000;

/**
 * Whether a block keeps a line from a viewer: `hiddenByBlock` in db.ts, word for word (a test holds the two together), since this leaf may not
 * import it. The writer's own block, of any kind, always hides; the viewer's own reaches only its kind (by name, or behind a made-up name).
 */
export const blockHides = (viewer: string, writer: string, anon: string): string =>
  `(EXISTS (SELECT 1 FROM blocks bw WHERE bw.blocker_id = ${writer} AND bw.blocked_id = ${viewer}) OR CASE WHEN ${anon} = 1 THEN EXISTS (SELECT 1 FROM block_aliases ba WHERE ba.blocker_id = ${viewer} AND ba.blocked_id = ${writer}) ELSE EXISTS (SELECT 1 FROM blocks bv WHERE bv.by_name = 1 AND bv.blocker_id = ${viewer} AND bv.blocked_id = ${writer}) END)`;
/**
 * A post the person may still see, as Community's own reads say it (the feed's conditions and `canSeePost` in routes/community.ts): not hidden by
 * a guide, not held for a guide unless it is theirs, no block either way that hides it, and a members' post only while they own or bought the
 * membership. `?1` is the person (these tables are only ever read by their owner).
 */
export const postSeen = (p: string): string =>
  `${p}.hidden_at IS NULL AND (${p}.held_at IS NULL OR ${p}.user_id = ?1) AND NOT ${blockHides('?1', `${p}.user_id`, `${p}.anonymous`)} AND (${p}.product_id IS NULL OR EXISTS (SELECT 1 FROM products pr WHERE pr.id = ${p}.product_id AND (pr.owner_id = ?1 OR EXISTS (SELECT 1 FROM orders o WHERE o.product_id = pr.id AND o.buyer_id = ?1 AND o.status IN ('paid','test')))))`;
/** Who wrote a post or a reply, as the feed names them: the person's own is "You", one written under a made-up name never says who. */
const writerOf = (row: string, user: string): string => `CASE WHEN ${row}.user_id = ?1 THEN 'You' WHEN ${row}.anonymous = 1 THEN 'Under a made-up name' ELSE ${personName(user)} END`;
/** How many are in a channel (members only, never who: a Community channel's lines can be written under a made-up name). */
const CHANNEL_MEMBERS_SQL = "(SELECT COUNT(*) FROM channel_members m WHERE m.channel_id = t.channel_id AND m.status = 'member')";

const PROGRAM_PATH = '/school/programs/:id';
const PROGRAMS_MADE: DataTable = {
  key: 'programsMade',
  name: 'Programs you made',
  blurb: 'The School programs you made: their state, price, cohorts and how many joined.',
  group: 'teaching',
  needs: ['school'],
  sqlTable: 'programs',
  // A program's own words and numbers, and how many joined it, never who. Its id opens nothing by itself (a private one asks for an invite, a
  // draft or archived one for whoever runs it), and like an event's it stays the owner's: each row is keyed by its own number, and the id the
  // edit needs is a hidden owner-only cell. Its state is changed in School, which asks first before it takes a program from anyone.
  from: 'programs t',
  owner: 't.created_by = ?1',
  idSql: 't.rowid',
  defaultSort: { key: 'made', dir: 'desc' },
  read: 'sql',
  columns: [
    c('name', 'Program', 'text', 't.name', { sortable: true, searchable: true, notNull: true, edit: patch(PROGRAM_PATH, 'name', 'text', { param: 'programId', minLength: 1, maxLength: PROGRAM_NAME_MOST }) }),
    c('about', 'Description', 'longtext', 't.description', { searchable: true, edit: patch(PROGRAM_PATH, 'description', 'longtext', { param: 'programId', maxLength: PROGRAM_ABOUT_MOST }) }),
    c('state', 'State', 'enum', programStateSql('t'), { options: PROGRAM_STATE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('delivery', 'How it runs', 'enum', 't.delivery_mode', { options: DELIVERY_MODE_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('pricePoints', 'Price in points', 'number', 't.price_points', { sortable: true, notNull: true }),
    c('price', 'Price', 'money', 't.price_cents', { currency: 'currency', sortable: true, notNull: true }),
    c('outcomes', 'You leave with', 'longtext', "NULLIF(t.outcomes, '')", { searchable: true }),
    c('cohorts', 'Cohorts', 'number', "(SELECT COUNT(*) FROM cohorts k WHERE k.program_id = t.id AND k.status != 'cancelled')", { sortable: true, notNull: true }),
    c('learners', 'Joined', 'number', "(SELECT COUNT(*) FROM enrollments e WHERE e.status != 'withdrawn' AND e.cohort_id IN (SELECT k.id FROM cohorts k WHERE k.program_id = t.id))", { sortable: true, notNull: true }),
    stamp('made', 'Made on', 't.created_at'),
    c('currency', 'currency', 'text', 't.currency', { hidden: true }),
    c('programId', 'programId', 'text', 't.id', { hidden: true, ownerOnly: true }),
  ],
};

const COHORTS_RUN: DataTable = {
  key: 'cohortsRun',
  name: 'Cohorts you run',
  blurb: 'The School cohorts you run, their dates, seats and how many joined.',
  group: 'teaching',
  needs: ['school'],
  sqlTable: 'cohorts',
  // How many joined, never who: the learners are other people.
  from: 'cohorts t LEFT JOIN programs p ON p.id = t.program_id',
  owner: 't.manager_user_id = ?1',
  idSql: 't.rowid',
  defaultSort: { key: 'starts', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A cohort’s name and dates are set when it opens. Who runs it changes on its page in School.',
  columns: [
    c('cohort', 'Cohort', 'text', 't.name', { sortable: true, searchable: true, notNull: true }),
    c('program', 'Program', 'text', 'p.name', { sortable: true, searchable: true }),
    c('programState', 'Program state', 'enum', programStateSql('p'), { options: PROGRAM_STATE_OPTIONS, ordered: true, filter: 'pick' }),
    c('when', 'Now', 'enum', COHORT_WHEN_SQL, { options: COHORT_WHEN_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('starts', 'Starts', 'datetime', 't.start_at', { sortable: true, filter: 'range', notNull: true }),
    c('ends', 'Ends', 'datetime', 't.end_at', { sortable: true, filter: 'range', notNull: true }),
    c('seats', 'Seats', 'number', 't.capacity', { sortable: true, notNull: true }),
    c('learners', 'Joined', 'number', "(SELECT COUNT(*) FROM enrollments e WHERE e.cohort_id = t.id AND e.status != 'withdrawn')", { sortable: true, notNull: true }),
  ],
};

const PROGRAM_INVITES_SENT: DataTable = {
  key: 'programInvitesSent',
  name: 'Program invites',
  blurb: 'The people you invited to your private School programs.',
  group: 'teaching',
  // Who was invited, by name: the person and AI chat on a model that keeps nothing.
  audience: 'others',
  needs: ['school'],
  sqlTable: 'program_invites',
  // An invite has no owner of its own: it is the person's through their program (programs.created_by), as School lists it to its maker, never a
  // closed account.
  from: `program_invites t JOIN programs p ON p.id = t.program_id JOIN users u ON u.id = t.user_id AND u.display_name != ${DELETED}`,
  owner: 'p.created_by = ?1',
  idSql: 't.rowid',
  // By program, newest first, then each program's invites newest first: the walk the two indexes make, so no page sorts. Tap Invited on to sort
  // by the day alone.
  defaultSort: { key: 'byProgram', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Invite people, or take an invite back, on the program in School.',
  columns: [
    c('program', 'Program', 'text', 'p.name', { sortable: true, searchable: true, notNull: true }),
    c('person', 'Invited', 'text', 'u.display_name', { sortable: true, searchable: true, notNull: true }),
    c('handle', 'Username', 'text', 'u.handle', { searchable: true, format: 'handle' }),
    c('programState', 'Program state', 'enum', programStateSql('p'), { options: PROGRAM_STATE_OPTIONS, ordered: true, filter: 'pick', notNull: true }),
    stamp('invited', 'Invited on', 't.created_at'),
    c('byProgram', 'By program', 'datetime', 'p.created_at', { hidden: true, sortable: true, notNull: true, sortTerms: ['p.created_at', 'p.rowid', 't.created_at', 't.rowid'] }),
  ],
};

const PROGRAM_INVITES: DataTable = {
  key: 'programInvites',
  name: 'Programs you were invited to',
  blurb: 'Private School programs someone invited you to.',
  group: 'learning',
  // A private program's name, which School shows only to the people invited and those who run it.
  audience: 'others',
  needs: ['school'],
  sqlTable: 'program_invites',
  // Only a program the person can still see, as School shows it to the people invited: a private one, or one made public since. A draft or an
  // archived one is hidden from them in School, so it is here too. Who invited them is never read: School's own note names its maker or an
  // admin, Connect people's says only "The team" while it keeps the staff member's id, and School never names a program's maker to anyone else.
  from: 'program_invites t JOIN programs p ON p.id = t.program_id',
  owner: 't.user_id = ?1',
  where: `${programStateSql('p')} IN ('private', 'public')`,
  idSql: 't.rowid',
  defaultSort: { key: 'invited', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'An invite is the program maker’s to give or take back. Enrol from School.',
  columns: [
    c('program', 'Program', 'text', 'p.name', { sortable: true, searchable: true, notNull: true }),
    c('programState', 'Program state', 'enum', programStateSql('p'), { options: PROGRAM_STATE_OPTIONS, ordered: true, filter: 'pick', notNull: true }),
    stamp('invited', 'Invited on', 't.created_at'),
  ],
};

const COHORT_LINES: DataTable = {
  key: 'cohortLines',
  name: 'Your lines in cohort talk',
  blurb: 'What you wrote in your School cohorts’ talk, and how you show there.',
  group: 'learning',
  needs: ['school'],
  sqlTable: 'cohort_talk',
  // Only the person's own lines (the rest of the talk is other people's words); never who took one down, nor the line one answers, and a line
  // taken down shows no words, as the talk keeps none.
  from: 'cohort_talk t LEFT JOIN cohorts k ON k.id = t.cohort_id LEFT JOIN programs p ON p.id = k.program_id LEFT JOIN cohort_talk_prefs v ON v.cohort_id = t.cohort_id AND v.user_id = t.user_id',
  owner: 't.user_id = ?1',
  idSql: 't.rowid',
  defaultSort: { key: 'written', dir: 'desc' },
  read: 'sql',
  // A member is private in a cohort's talk unless they say otherwise, their name in stars to everyone else there. A coach sees only the lines of
  // a cohort where the person shows by their @username now, as the talk itself shows them, never one a masked name would tie to them.
  coachWhere: "v.visibility = 'public'",
  readOnlyWhy: 'A line stays as written. Take one down in the cohort’s talk in School.',
  columns: [
    c('cohort', 'Cohort', 'text', 'k.name', { sortable: true, searchable: true }),
    c('program', 'Program', 'text', 'p.name', { sortable: true, searchable: true }),
    c('line', 'Your line', 'longtext', 'CASE WHEN t.deleted_at IS NULL THEN t.body END', { searchable: true, format: 'inert' }),
    c('shownAs', 'You show there as', 'enum', `COALESCE(v.visibility, '${COHORT_TALK_SHOWN_DEFAULT}')`, { options: COHORT_TALK_SHOW_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('answer', 'An answer to a line', 'bool', '(t.parent_id IS NOT NULL)', { filter: 'pick', notNull: true }),
    c('takenDown', 'Taken down', 'bool', '(t.deleted_at IS NOT NULL)', { filter: 'pick', notNull: true }),
    stamp('written', 'Written', 't.created_at'),
  ],
};

const COMMUNITY_CHANNEL_PATH = '/community/channels/:id';
const COMMUNITY_CHANNELS: DataTable = {
  key: 'communityChannels',
  name: 'Community channels',
  blurb: 'The Community channels you are in, and the ones you opened as a guide.',
  group: 'community',
  needs: ['community'],
  sqlTable: 'channel_members',
  // The person's seat in each public channel. Who else is in it is never read, only how many: a channel's lines can be written under a made-up
  // name. A name and topic change through the channel's own route, which takes them only from a guide. Keyed by the seat's own number, which the
  // person's index keeps in order; the channel's id, which the edit needs, is a hidden owner-only cell, as an event's is.
  from: "channel_members t JOIN channels ch ON ch.id = t.channel_id AND ch.scope = 'community'",
  owner: 't.user_id = ?1',
  idSql: 't.rowid',
  defaultSort: { key: 'joined', dir: 'desc' },
  read: 'sql',
  columns: [
    c('channel', 'Channel', 'text', 'ch.name', { sortable: true, searchable: true, notNull: true, edit: patch(COMMUNITY_CHANNEL_PATH, 'name', 'text', { param: 'channelId', when: 'madeIt', minLength: CHANNEL_NAME_LEAST, maxLength: CHANNEL_NAME_MOST }) }),
    c('topic', 'Topic', 'text', "NULLIF(ch.topic, '')", { searchable: true, edit: patch(COMMUNITY_CHANNEL_PATH, 'topic', 'text', { param: 'channelId', when: 'madeIt', maxLength: CHANNEL_TOPIC_MOST }) }),
    c('madeIt', 'You opened it', 'bool', '(ch.created_by = ?1)', { filter: 'pick', notNull: true }),
    c('open', 'Open', 'bool', '(ch.archived_at IS NULL)', { filter: 'pick', notNull: true }),
    c('members', 'Members', 'number', CHANNEL_MEMBERS_SQL, { sortable: true, notNull: true }),
    stamp('joined', 'Joined', 't.joined_at'),
    c('channelId', 'channelId', 'text', 't.channel_id', { hidden: true, ownerOnly: true }),
  ],
};

const COMMUNITY_LINES: DataTable = {
  key: 'communityLines',
  name: 'Your lines in Community channels',
  blurb: 'What you wrote in Community’s channels, with or without your name.',
  group: 'community',
  needs: ['community'],
  sqlTable: 'channel_messages',
  // Only the person's own lines; never who took one down, nor the line one answers (another person's words), and a line taken down shows no
  // words, as the channel keeps none.
  from: "channel_messages t JOIN channels ch ON ch.id = t.channel_id AND ch.scope = 'community'",
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'written', dir: 'desc' },
  read: 'sql',
  // A coach never sees a line written without a name: listing it would say who wrote it.
  coachWhere: 't.anonymous = 0',
  readOnlyWhy: 'A line stays as written. Take one down in the channel in Community.',
  columns: [
    c('channel', 'Channel', 'text', 'ch.name', { sortable: true, searchable: true, notNull: true }),
    c('line', 'Your line', 'longtext', 'CASE WHEN t.deleted_at IS NULL THEN t.body END', { searchable: true, format: 'inert' }),
    c('anonymous', 'Without your name', 'bool', 't.anonymous', { sortable: true, filter: 'pick', notNull: true }),
    c('answer', 'An answer to a line', 'bool', '(t.reply_to IS NOT NULL)', { filter: 'pick', notNull: true }),
    c('takenDown', 'Taken down', 'bool', '(t.deleted_at IS NOT NULL)', { filter: 'pick', notNull: true }),
    // In the order they were written (`seq`, the row's own number), which the person's own index keeps.
    stamp('written', 'Written', 't.created_at', { sortSql: 't.seq' }),
  ],
};

const POST_REACTIONS: DataTable = {
  key: 'postReactions',
  name: 'Reactions on posts',
  blurb: 'The Community posts you reacted to, and how.',
  group: 'community',
  // Another person's post and, when they wrote it with their name, who: the person and AI chat on a model that keeps nothing.
  audience: 'others',
  needs: ['community'],
  sqlTable: 'community_likes',
  // Only a post the feed still shows the person (`postSeen`): one a guide hid, or by someone either side blocked, leaves the table as it leaves
  // the feed. One written under a made-up name never says who.
  from: 'community_likes t JOIN community_posts p ON p.id = t.post_id LEFT JOIN users u ON u.id = p.user_id',
  owner: 't.user_id = ?1',
  where: postSeen('p'),
  idSql: 't.rowid',
  defaultSort: { key: 'reacted', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Change a reaction, or take it back, on the post in Community.',
  columns: [
    c('reaction', 'Your reaction', 'enum', 't.kind', { options: REACTION_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('post', 'Post', 'longtext', 'p.body', { searchable: true, format: 'inert' }),
    c('writer', 'Written by', 'text', writerOf('p', 'u'), { sortable: true, searchable: true, notNull: true }),
    c('topic', 'Topic', 'enum', 'p.category', { options: POST_CATEGORY_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    stamp('reacted', 'Reacted', 't.created_at'),
  ],
};

const REPLY_REACTIONS: DataTable = {
  key: 'replyReactions',
  name: 'Reactions on replies',
  blurb: 'The Community replies you reacted to, and how.',
  group: 'community',
  audience: 'others',
  needs: ['community'],
  sqlTable: 'community_reply_reactions',
  // Only a reply the person may still see under a post they may still see, as a post's replies show it: not hidden, no block either way that
  // hides the reply or its post.
  from: 'community_reply_reactions t JOIN community_replies r ON r.id = t.reply_id JOIN community_posts p ON p.id = r.post_id LEFT JOIN users u ON u.id = r.user_id',
  owner: 't.user_id = ?1',
  where: `r.hidden_at IS NULL AND NOT ${blockHides('?1', 'r.user_id', 'r.anonymous')} AND ${postSeen('p')}`,
  idSql: 't.rowid',
  defaultSort: { key: 'reacted', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Change a reaction, or take it back, under the post in Community.',
  columns: [
    c('reaction', 'Your reaction', 'enum', 't.kind', { options: REACTION_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('reply', 'Reply', 'longtext', 'r.body', { searchable: true, format: 'inert' }),
    c('writer', 'Written by', 'text', writerOf('r', 'u'), { sortable: true, searchable: true, notNull: true }),
    c('onPost', 'On the post', 'longtext', 'p.body', { searchable: true, format: 'inert' }),
    stamp('reacted', 'Reacted', 't.created_at'),
  ],
};

const FOLLOWED_POSTS: DataTable = {
  key: 'followedPosts',
  name: 'Posts you follow',
  blurb: 'The Community posts you follow, yours and the ones you replied to among them.',
  group: 'community',
  audience: 'others',
  needs: ['community'],
  sqlTable: 'community_post_follows',
  // Only a post the feed still shows the person (`postSeen`); one written under a made-up name never says who.
  from: 'community_post_follows t JOIN community_posts p ON p.id = t.post_id LEFT JOIN users u ON u.id = p.user_id',
  owner: 't.user_id = ?1',
  where: postSeen('p'),
  idSql: 't.rowid',
  defaultSort: { key: 'since', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Stop following a post from the post itself in Community.',
  columns: [
    c('post', 'Post', 'longtext', 'p.body', { searchable: true, format: 'inert' }),
    c('writer', 'Written by', 'text', writerOf('p', 'u'), { sortable: true, searchable: true, notNull: true }),
    c('topic', 'Topic', 'enum', 'p.category', { options: POST_CATEGORY_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    stamp('since', 'Following since', 't.created_at'),
  ],
};

const MUTES: DataTable = {
  key: 'mutes',
  name: 'People you muted',
  blurb: 'Members you muted in Community as a guide, and why.',
  group: 'community',
  // Another member by name, and the guide's own reason: the person and AI chat on a model that keeps nothing.
  audience: 'others',
  needs: ['community'],
  sqlTable: 'community_mutes',
  // Only the mutes the person made. Guides see every mute with the rank that made it, never who, so nobody else's mute is read.
  from: 'community_mutes t JOIN users u ON u.id = t.user_id',
  owner: 't.muted_by = ?1',
  idSql: 't.rowid',
  defaultSort: { key: 'since', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Lift a mute in Community’s guide tools.',
  columns: [
    c('person', 'Muted', 'text', personName('u'), { sortable: true, searchable: true, notNull: true }),
    c('handle', 'Username', 'text', personHandle('u'), { searchable: true, format: 'handle' }),
    c('reason', 'Your reason', 'text', "NULLIF(t.reason, '')", { searchable: true, format: 'inert' }),
    stamp('since', 'Since', 't.created_at'),
  ],
};

const BOND_CHATS: DataTable = {
  key: 'bondChats',
  name: 'Anonymous chats',
  blurb: 'Your Bond chats under made-up names, with the last line of each.',
  group: 'bond',
  audience: 'others',
  needs: ['bond'],
  sqlTable: 'bond_chats',
  // Aliases only, as Bond shows a chat: neither side's id is ever read, only whether a side is the person.
  from: 'bond_chats t',
  owner: '(t.a_user_id = ?1 OR t.b_user_id = ?1)',
  idSql: 't.rowid',
  defaultSort: { key: 'lastAt', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A chat is written in Bond, a line at a time.',
  columns: [
    c('them', 'They go by', 'text', 'CASE WHEN t.a_user_id = ?1 THEN t.b_alias ELSE t.a_alias END', { sortable: true, searchable: true, notNull: true }),
    c('you', 'You go by', 'text', 'CASE WHEN t.a_user_id = ?1 THEN t.a_alias ELSE t.b_alias END', { searchable: true, notNull: true }),
    c('from', 'Started from', 'enum', 't.source', { options: CHAT_SOURCE_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('lines', 'Lines', 'number', '(SELECT COUNT(*) FROM bond_messages m WHERE m.chat_id = t.id)', { sortable: true, notNull: true }),
    c('lastLine', 'Last line', 'longtext', '(SELECT m.body FROM bond_messages m WHERE m.chat_id = t.id ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1)', { format: 'inert' }),
    c('lastAt', 'Last line at', 'datetime', 't.last_message_at', { sortable: true, filter: 'range' }),
    stamp('started', 'Started', 't.created_at'),
  ],
};

const BOND_CHAT_LINES: DataTable = {
  key: 'bondChatLines',
  name: 'Lines in your anonymous chats',
  blurb: 'Every line of your Bond chats, both sides, under the names you go by there.',
  group: 'bond',
  audience: 'others',
  needs: ['bond'],
  sqlTable: 'bond_messages',
  // Both sides of each chat, as Bond shows the person every line of it, and only by alias: a line is "You" or the other side's made-up name,
  // never an id. The person's chats are found by either side's index (the subquery's own `ch`), and the lines are walked chat by chat through
  // idx_bond_messages_chat: CROSS JOIN keeps the lines the outer loop, so a page reads only its own rows, never every line of every chat.
  from: 'bond_messages t CROSS JOIN bond_chats ch ON ch.id = t.chat_id',
  owner: 't.chat_id IN (SELECT ch.id FROM bond_chats ch WHERE ch.a_user_id = ?1 UNION ALL SELECT ch.id FROM bond_chats ch WHERE ch.b_user_id = ?1)',
  idSql: 't.rowid',
  // By chat, then its lines newest first, so a page reads as a conversation. The chats come in the order their index keeps them, which stays
  // the same from page to page. Tap Sent to sort by the time alone.
  defaultSort: { key: 'byChat', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A line stays as it was sent. Write back in the chat in Bond.',
  columns: [
    c('chat', 'Chat with', 'text', 'CASE WHEN ch.a_user_id = ?1 THEN ch.b_alias ELSE ch.a_alias END', { sortable: true, searchable: true, notNull: true }),
    c('from', 'Written by', 'text', "CASE WHEN t.user_id = ?1 THEN 'You' WHEN ch.a_user_id = ?1 THEN ch.b_alias ELSE ch.a_alias END", { sortable: true, notNull: true }),
    c('line', 'Line', 'longtext', 't.body', { searchable: true, format: 'inert' }),
    stamp('sent', 'Sent', 't.created_at'),
    c('byChat', 'By chat', 'datetime', 'ch.created_at', { hidden: true, sortable: true, notNull: true, sortTerms: ['t.chat_id', 't.created_at', 't.rowid'] }),
  ],
};

const INTRODUCTIONS: DataTable = {
  key: 'introductions',
  name: 'Introductions',
  blurb: 'Introductions you asked for in Bond, and the ones asked of you.',
  group: 'bond',
  audience: 'others',
  needs: ['bond'],
  sqlTable: 'introductions',
  // The other person by name and the asker's words, as Bond lists them, never one with someone the person blocked by name.
  from: 'introductions t JOIN users a ON a.id = t.requester_user_id JOIN users b ON b.id = t.recipient_user_id',
  owner: '(t.requester_user_id = ?1 OR t.recipient_user_id = ?1)',
  where: 'NOT EXISTS (SELECT 1 FROM blocks k WHERE k.by_name = 1 AND k.blocker_id = ?1 AND k.blocked_id IN (t.requester_user_id, t.recipient_user_id))',
  idSql: 't.rowid',
  defaultSort: { key: 'asked', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Answer an introduction in Bond.',
  columns: [
    c('person', 'With', 'text', `CASE WHEN t.requester_user_id = ?1 THEN ${personName('b')} ELSE ${personName('a')} END`, { sortable: true, searchable: true, notNull: true }),
    c('side', 'Who asked', 'enum', "CASE WHEN t.requester_user_id = ?1 THEN 'you' ELSE 'them' END", { options: INTRO_SIDE_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('note', 'Why', 'longtext', "NULLIF(t.context, '')", { searchable: true, format: 'inert' }),
    c('state', 'State', 'enum', 't.status', { options: INTRO_STATE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    stamp('asked', 'Asked on', 't.created_at'),
    c('accepted', 'Accepted on', 'datetime', 't.consent_at', { sortable: true }),
  ],
};

const BOND_CHANNEL_PATH = '/bond/channels/:id';
const BOND_CHANNELS: DataTable = {
  key: 'bondChannels',
  name: 'Bond channels',
  blurb: 'The private Bond rooms you made or were asked into.',
  group: 'bond',
  // A room's name and topic are its maker's words, a friend's in a room the person was asked into: the person and AI chat on a model that
  // keeps nothing.
  audience: 'others',
  needs: ['bond'],
  sqlTable: 'channel_members',
  // The person's seat or invitation in each room. Who else is in it is never read, only how many.
  from: "channel_members t JOIN channels ch ON ch.id = t.channel_id AND ch.scope = 'bond'",
  owner: 't.user_id = ?1',
  idSql: 't.rowid',
  defaultSort: { key: 'since', dir: 'desc' },
  read: 'sql',
  columns: [
    c('channel', 'Channel', 'text', 'ch.name', { sortable: true, searchable: true, notNull: true, edit: patch(BOND_CHANNEL_PATH, 'name', 'text', { param: 'channelId', when: 'madeIt', minLength: CHANNEL_NAME_LEAST, maxLength: CHANNEL_NAME_MOST }) }),
    c('topic', 'Topic', 'text', "NULLIF(ch.topic, '')", { searchable: true, edit: patch(BOND_CHANNEL_PATH, 'topic', 'text', { param: 'channelId', when: 'madeIt', maxLength: CHANNEL_TOPIC_MOST }) }),
    c('madeIt', 'You made it', 'bool', '(ch.created_by = ?1)', { filter: 'pick', notNull: true }),
    c('seat', 'You are', 'enum', 't.status', { options: CHANNEL_SEAT_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('open', 'Open', 'bool', '(ch.archived_at IS NULL)', { filter: 'pick', notNull: true }),
    c('members', 'Members', 'number', CHANNEL_MEMBERS_SQL, { sortable: true, notNull: true }),
    stamp('since', 'Since', 't.joined_at'),
    c('channelId', 'channelId', 'text', 't.channel_id', { hidden: true, ownerOnly: true }),
  ],
};

const BOND_CHANNEL_LINES: DataTable = {
  key: 'bondChannelLines',
  name: 'Your lines in Bond channels',
  blurb: 'What you wrote in Bond’s private rooms.',
  group: 'bond',
  audience: 'others',
  needs: ['bond'],
  sqlTable: 'channel_messages',
  // Only the person's own lines (the rest of a room is its members' words), in rooms named in a friend's words; never who took one down, and a
  // line taken down shows no words.
  from: "channel_messages t JOIN channels ch ON ch.id = t.channel_id AND ch.scope = 'bond'",
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'written', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A line stays as written. Take one down in the room in Bond.',
  columns: [
    c('channel', 'Channel', 'text', 'ch.name', { sortable: true, searchable: true, notNull: true }),
    c('line', 'Your line', 'longtext', 'CASE WHEN t.deleted_at IS NULL THEN t.body END', { searchable: true, format: 'inert' }),
    c('answer', 'An answer to a line', 'bool', '(t.reply_to IS NOT NULL)', { filter: 'pick', notNull: true }),
    c('takenDown', 'Taken down', 'bool', '(t.deleted_at IS NOT NULL)', { filter: 'pick', notNull: true }),
    stamp('written', 'Written', 't.created_at', { sortSql: 't.seq' }),
  ],
};

const BLOCKS: DataTable = {
  key: 'blocks',
  name: 'People you blocked',
  blurb: 'Who you blocked by name. Blocks behind a made-up name stay in Bond.',
  group: 'bond',
  audience: 'others',
  needs: ['bond'],
  sqlTable: 'blocks',
  // Only a block by name, listed by name as Bond lists it. A block made from writing under a made-up name (`by_name` 0, with its block_aliases
  // row) is never read here: naming the person behind it would say who wrote it. The other side never learns of a block.
  from: 'blocks t JOIN users u ON u.id = t.blocked_id',
  owner: 't.blocker_id = ?1',
  where: 't.by_name = 1',
  idSql: 't.rowid',
  defaultSort: { key: 'since', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Unblock someone in Bond.',
  columns: [
    c('person', 'Blocked', 'text', personName('u'), { sortable: true, searchable: true, notNull: true }),
    c('handle', 'Username', 'text', personHandle('u'), { searchable: true, format: 'handle' }),
    c('reason', 'Your reason', 'text', "NULLIF(t.reason, '')", { searchable: true, format: 'inert' }),
    stamp('since', 'Since', 't.created_at'),
  ],
};

// -----------------------------------------------------------------------------------------------------------------------------------
// You (2026-11-14, the seventh batch of "ok, add them"): coaching, Discover and AI chat, the account's own records, invites and help.
// 'others' where another person's name or words sit in a row (a coach or a student, the team's answer, a label naming who a code is for, a
// Companion or assistant line), or the founder named it (the Companion chat, Discover's results): only the person, and AI chat on a model that
// keeps nothing. Never read: an invite code, the calendar link's token, a PAN's hash, a payment id, a discount code's word or the order it was
// used on, the assistant's arguments or its undo, a Discover answer, a design's birth date, time, place or name, who on the team linked two
// people, or who did a step in the coaching log by id.
// -----------------------------------------------------------------------------------------------------------------------------------

/** The current instant as SQLite writes an ISO stamp, to compare with a stored one (a code that ran out, a plan that ended). */
const NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** A coach link's state, as Coaching and the Profile tab say it (CoachLinkStatus). */
export const COACH_LINK_STATE_OPTIONS = opts([['pending', 'Waiting for a yes'], ['active', 'Active'], ['declined', 'Said no'], ['ended', 'Ended']]);
/** Who asked, from the person's own side (asked_by: coach, student or admin, the team). */
export const COACH_ASKER_OPTIONS = opts([['you', 'You'], ['them', 'They did'], ['team', 'The team']]);
/** The coaching log's steps (CoachLogAction), in plain words; the line itself says who did it. */
export const COACH_LOG_OPTIONS = opts([
  ['link.ask', 'Asked'], ['link.yes', 'Said yes'], ['link.no', 'Said no'], ['link.end', 'Ended'], ['link.admin', 'Linked by the team'],
  ['link.join', 'Joined by the invite link'], ['share.change', 'Sharing changed'], ['patterns.ask', 'Asked for Patterns'], ['note.add', 'Note left'],
  ['note.remove', 'Note taken back'], ['task.add', 'Task added'], ['task.edit', 'Task changed'], ['invite.renew', 'Invite link renewed'],
  ['invite.close', 'Invite link closed'], ['invite.email', 'Invite emailed'],
]);
/** The six parts a student shares with a coach, their names and what a stored share that does not name one reads as (COACH_SHARE_PARTS,
 * COACH_SHARE_META, DEFAULT_COACH_SHARE in the barrel; a test holds them together). */
export const COACH_SHARE_PART_WORDS: readonly (readonly [key: string, name: string, unset: 0 | 1])[] = [
  ['daily', 'Daily and streaks', 1], ['pillars', 'Pillars and pyramids', 1], ['routine', 'Routine and contract', 1], ['lifeMap', 'Life map answers', 1],
  ['reflection', 'Reflection', 1], ['patterns', 'Patterns', 0],
];
/** COACH_ABOUT_MAX: the words on a coach's directory card. */
export const COACH_ABOUT_MOST = 280;
/** Discover's add-ons, in EXTRA_KINDS' order and words. */
export const EXTRA_KIND_OPTIONS = opts([['type', '16 personality types'], ['love', 'Love languages'], ['design', 'Human design'], ['mind', 'How your mind works']]);
/** The honors kept on an account (HONORS: the team's, a season's; the time honors are worked out from the day the account began), with their tiers. */
export const HONOR_WORDS: readonly (readonly [key: string, name: string, tier: string])[] = [
  ['pro', 'Pro', 'platinum'], ['founder', 'Founding member', 'gold'], ['community_star', 'Community star', 'gold'], ['collab', 'Team player', 'silver'],
  ['week_in', 'One week in', 'bronze'], ['month_in', 'One month in', 'silver'], ['season_in', 'One season in', 'gold'], ['year_in', 'One year in', 'platinum'],
  ['season_top', 'Season top three', 'gold'],
];
const HONOR_OPTIONS = opts(HONOR_WORDS.map(([k, n]) => [k, n] as const));
const HONOR_TIER_SQL = `CASE t.honor_key ${HONOR_WORDS.map(([k, , tier]) => `WHEN '${k}' THEN '${tier}'`).join(' ')} END`;
/** Where a privacy choice was made (saveConsent's source). */
export const CONSENT_SOURCE_OPTIONS = opts([['popup', 'The privacy card'], ['profile', 'Profile'], ['unsubscribe', 'An unsubscribe link']]);
/** LEGAL_DOCS' names, and how each was accepted (the box at sign-up, or the one-time notice). */
export const LEGAL_DOC_OPTIONS = opts([['terms', 'Terms of use'], ['privacy', 'Privacy policy']]);
export const TERMS_HOW_OPTIONS = opts([['signup', 'At sign-up'], ['notice', 'The one-time notice']]);
/** INVITE_STATE_LABEL, and the one reading of a code's state (inviteStateOf: used beats taken back, which beats expired). */
export const INVITE_STATE_OPTIONS = opts([['open', 'Open'], ['used', 'Used'], ['expired', 'Expired'], ['revoked', 'Taken back']]);
const INVITE_STATE_SQL = `CASE WHEN t.used_at IS NOT NULL THEN 'used' WHEN t.revoked_at IS NOT NULL THEN 'revoked' WHEN t.expires_at IS NOT NULL AND t.expires_at <= ${NOW_SQL} THEN 'expired' ELSE 'open' END`;
/** A message to the team (support_tickets.status, as Help shows it). */
export const TICKET_STATE_OPTIONS = opts([['open', 'Open'], ['answered', 'Answered'], ['closed', 'Closed']]);
/** LIVE_CALL_STATUSES, as the life map's contract card says each. */
export const LIVE_CALL_STATE_OPTIONS = opts([['asked', 'Asked, waiting for the team'], ['paying', 'Waiting for payment'], ['paid', 'Paid'], ['booked', 'Booked'], ['done', 'Done'], ['cancelled', 'Cancelled']]);
/** Payout details' state, as the Shop's Customers page says it. */
export const KYC_STATE_OPTIONS = opts([['none', 'Not given'], ['pending', 'Waiting for review'], ['approved', 'Approved'], ['rejected', 'Needs another look']]);
/** A plan by its name (PLANS, planName). */
export const PLAN_OPTIONS = opts([['none', 'No plan'], ['pro', 'Pro'], ['pro_max', 'Pro Max'], ['ultra', 'Ultra']]);
const PLAN_RUNNING_SQL = `(t.plan <> 'none' AND t.plan_until IS NOT NULL AND t.plan_until > ${NOW_SQL})`;
/** DISCOUNT_AREA_META's names. */
export const DISCOUNT_AREA_OPTIONS = opts([['product', 'Shop products'], ['program', 'School programs'], ['event', 'Party tickets'], ['plan', 'Plans'], ['topup', 'Credit top-ups']]);
/** What a discount was used on, by its name: a product, a program, an event or a plan. A top-up is named by its area alone. */
const DISCOUNT_ITEM_SQL = `CASE t.area WHEN 'product' THEN (SELECT p.title FROM products p WHERE p.id = t.item_id) WHEN 'program' THEN (SELECT g.name FROM programs g WHERE g.id = t.item_id) WHEN 'event' THEN (SELECT e.title FROM events e WHERE e.id = t.item_id) WHEN 'plan' THEN ${`CASE t.item_id ${PLAN_OPTIONS.filter((o) => o.value !== 'none').map((o) => `WHEN '${o.value}' THEN '${o.label}'`).join(' ')} END`} END`;
/** An assistant change's state (AssistantActionStatus). */
export const ASSISTANT_ACTION_OPTIONS = opts([['done', 'Done'], ['failed', 'Did not work'], ['pending', 'Waiting for your Confirm'], ['undone', 'Undone'], ['cancelled', 'Cancelled']]);
const COMPANION_WHO_OPTIONS = opts([['you', 'You'], ['companion', 'The Companion']]);
/** A season by its month in words: 2026-10 reads "October 2026". */
const SEASON_LABEL_SQL = `CASE substr(t.season, 6, 2) ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => `WHEN '${String(i + 1).padStart(2, '0')}' THEN '${m}'`).join(' ')} END || ' ' || substr(t.season, 1, 4)`;

/**
 * One part of what a student shares with a coach, read as parseCoachShare reads it: a part stored as true or false, else its default (on, but
 * Patterns off), and a share that is not JSON at all reads as the defaults. CASE evaluates only the branch it takes, so json_type never meets bad JSON.
 */
function sharePart(part: string, unset: 0 | 1): string {
  return `CASE WHEN json_valid(t.share_json) THEN CASE json_type(t.share_json, '$.${part}') WHEN 'true' THEN 1 WHEN 'false' THEN 0 ELSE ${unset} END ELSE ${unset} END`;
}
/** The six parts as yes-or-no cells: on the student's own side each is their switch, through the Profile tab's own route, one part a call. */
function coachParts(student: boolean): DataColumn[] {
  return COACH_SHARE_PART_WORDS.map(([part, name, unset]) =>
    c(part, name, 'bool', sharePart(part, unset), {
      filter: 'pick',
      notNull: true,
      ...(student ? { edit: patch('/me/coach/links/:id/share', part, 'toggle', { when: 'linkOpen', note: 'Your coach sees the change the next time they look.' }) } : {}),
    }),
  );
}
/** Who asked, from this side of the link: the person, the other side, or the team (Admin, Connect people). */
const askerSql = (mine: 'coach' | 'student'): string => `CASE t.asked_by WHEN '${mine}' THEN 'you' WHEN 'admin' THEN 'team' ELSE 'them' END`;

const LIFE_COACHES: DataTable = {
  key: 'lifeCoaches',
  name: 'Your life coaches',
  blurb: 'Each coach you have or were asked by, and the parts you share with them.',
  group: 'coaching',
  audience: 'others',
  // Core like the Profile tab's My coach: a person can always see and change what a coach sees, with Coaching off too.
  sqlTable: 'coach_links',
  // The coach by name, as My coach names them. Who on the team linked two people (created_by) is never read.
  from: 'coach_links t JOIN users u ON u.id = t.coach_id',
  owner: 't.student_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'asked', dir: 'desc' },
  read: 'sql',
  columns: [
    c('coach', 'Coach', 'text', personName('u'), { sortable: true, searchable: true, notNull: true }),
    c('handle', 'Username', 'text', personHandle('u'), { searchable: true, format: 'handle' }),
    c('status', 'State', 'enum', 't.status', { options: COACH_LINK_STATE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('asker', 'Who asked', 'enum', askerSql('student'), { options: COACH_ASKER_OPTIONS, filter: 'pick', notNull: true }),
    ...coachParts(true),
    stamp('asked', 'Asked on', 't.created_at'),
    c('answered', 'Answered on', 'datetime', 't.answered_at', { sortable: true }),
    c('ended', 'Ended on', 'datetime', 't.ended_at', { sortable: true }),
  ],
};

const COACH_STUDENTS: DataTable = {
  key: 'coachStudents',
  name: 'Your students',
  blurb: 'The people you coach or asked to, and the parts each one shares with you.',
  group: 'coaching',
  audience: 'others',
  needs: ['coaching'],
  sqlTable: 'coach_links',
  from: 'coach_links t JOIN users u ON u.id = t.student_id',
  owner: 't.coach_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'asked', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'What a student shares is theirs to switch. Ask, answer or end coaching in Coaching.',
  columns: [
    c('student', 'Student', 'text', personName('u'), { sortable: true, searchable: true, notNull: true }),
    c('handle', 'Username', 'text', personHandle('u'), { searchable: true, format: 'handle' }),
    c('status', 'State', 'enum', 't.status', { options: COACH_LINK_STATE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('asker', 'Who asked', 'enum', askerSql('coach'), { options: COACH_ASKER_OPTIONS, filter: 'pick', notNull: true }),
    ...coachParts(false),
    stamp('asked', 'Asked on', 't.created_at'),
    c('answered', 'Answered on', 'datetime', 't.answered_at', { sortable: true }),
    c('ended', 'Ended on', 'datetime', 't.ended_at', { sortable: true }),
  ],
};

const COACHING_LOG: DataTable = {
  key: 'coachingLog',
  name: 'Log with your coaches',
  blurb: 'Every ask, answer, note, task and sharing change between you and a coach.',
  group: 'coaching',
  audience: 'others',
  // The student's side of My coach's log, core like it, so a student reads theirs with Coaching off. The line already says who did each step, as
  // the app shows it; whose id did it (actor_id) is never read, nor what a task or a share was before and after. One side a table, so each page
  // walks one index in the page's order (coach_log_student here), never both sides at once and a sort; a coach's own invite link lines (they are
  // the coach's alone, coach and student the same person) are on the other side.
  sqlTable: 'coach_log',
  from: 'coach_log t JOIN users co ON co.id = t.coach_id',
  owner: '(t.student_id = ?1 AND t.coach_id <> ?1)',
  // Its own number, which the index holds, so the tie-break needs no sort either; the log opens nothing by it.
  idSql: 't.rowid',
  defaultSort: { key: 'when', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A record of what happened, so it stays as it is.',
  columns: [
    c('person', 'Coach', 'text', personName('co'), { sortable: true, searchable: true, notNull: true }),
    c('step', 'What', 'enum', 't.action', { options: COACH_LOG_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('line', 'What happened', 'text', 't.label', { searchable: true, notNull: true, format: 'inert' }),
    stamp('when', 'When', 't.created_at'),
  ],
};

const STUDENTS_LOG: DataTable = {
  key: 'studentsLog',
  name: 'Log with your students',
  blurb: 'Every ask, answer, note, task and sharing change with the people you coach.',
  group: 'coaching',
  audience: 'others',
  // The coach's side, which Coaching shows, so it needs Coaching as Your students does. Served by idx_coach_log_coach_created (0161).
  needs: ['coaching'],
  sqlTable: 'coach_log',
  from: 'coach_log t JOIN users st ON st.id = t.student_id',
  owner: 't.coach_id = ?1',
  idSql: 't.rowid',
  defaultSort: { key: 'when', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A record of what happened, so it stays as it is.',
  columns: [
    // A coach's own invite link lines (renewed, closed, emailed) name no one.
    c('person', 'Student', 'text', `CASE WHEN t.student_id = ?1 THEN NULL ELSE ${personName('st')} END`, { sortable: true, searchable: true }),
    c('step', 'What', 'enum', 't.action', { options: COACH_LOG_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('line', 'What happened', 'text', 't.label', { searchable: true, notNull: true, format: 'inert' }),
    stamp('when', 'When', 't.created_at'),
  ],
};

const COACH_CARD: DataTable = {
  key: 'coachCard',
  name: 'Your coach card',
  blurb: 'The words on your card in the coach directory, and whether you take new students.',
  group: 'coaching',
  needs: ['coaching'],
  sqlTable: 'coach_profiles',
  from: 'coach_profiles t',
  owner: 't.user_id = ?1',
  // One row at most: its key is a word, never the person's id.
  idSql: "'card'",
  defaultSort: { key: 'changed', dir: 'desc' },
  read: 'sql',
  columns: [
    c('about', 'About you', 'longtext', 't.about', { searchable: true, edit: { method: 'PUT', path: '/coach/profile', field: 'about', input: 'longtext', maxLength: COACH_ABOUT_MOST } }),
    c('open', 'Taking new students', 'bool', 't.open', { filter: 'pick', notNull: true, edit: { method: 'PUT', path: '/coach/profile', field: 'open', input: 'toggle', note: 'Off keeps you out of the directory’s asks. Your students stay.' } }),
    c('askedAt', 'Asked to coach on', 'datetime', 't.asked_at', { sortable: true }),
    stamp('changed', 'Changed', 't.updated_at', { filter: undefined }),
  ],
};

/** Discover's own yes for the assistant ("Let the assistant learn from them"), which AI chat's read needs too: Show to AI chat never reaches past it. */
const DISCOVER_AI_YES = 'EXISTS (SELECT 1 FROM discover_settings ds WHERE ds.user_id = ?1 AND ds.assistant = 1)';

const DISCOVER_RESULTS: DataTable = {
  key: 'discoverResults',
  name: 'Discover results',
  blurb: 'Each time you took the Discover quiz, in words: strengths, traits and puzzles.',
  group: 'selfAi',
  audience: 'others',
  needs: ['discover'],
  sqlTable: 'discover_results',
  // Only what the assistant may ever be given (discoverProfile): never an answer, a score or a time.
  from: 'discover_results t',
  owner: 't.user_id = ?1',
  where: `({ai} = 0 OR ${DISCOVER_AI_YES})`,
  idSql: 't.id',
  defaultSort: { key: 'taken', dir: 'desc' },
  read: 'sql',
  privateSelect: { result: 't.result_json' },
  readOnlyWhy: 'Take the quiz again in Discover. AI chat reads these only while “Let the assistant learn from them” is on there too.',
  columns: [
    stamp('taken', 'Taken on', 't.created_at'),
    c('strongest', 'Strongest', 'summary', null, { derive: 'discoverResult', from: ['result'] }),
    c('quietest', 'Quietest', 'summary', null, { derive: 'discoverResult', from: ['result'] }),
    c('traits', 'Traits', 'summary', null, { derive: 'discoverResult', from: ['result'] }),
    c('reasoning', 'Reasoning puzzles', 'summary', null, { derive: 'discoverResult', from: ['result'] }),
    c('emotional', 'Emotional side', 'summary', null, { derive: 'discoverResult', from: ['result'] }),
  ],
};

const DISCOVER_ADD_ONS: DataTable = {
  key: 'discoverAddOns',
  name: 'Discover add-ons',
  blurb: 'The self-checks you finished: your type, love languages, mind and Human design.',
  group: 'selfAi',
  audience: 'others',
  needs: ['discover'],
  sqlTable: 'discover_extras',
  from: 'discover_extras t',
  owner: 't.user_id = ?1',
  // Finished ones only, never a draft. AI chat reads them only with Discover's own yes for the assistant, and how the mind works only with
  // "Include how my mind works" on too, as the assistant always has.
  where: `t.taken_at IS NOT NULL AND t.result_json IS NOT NULL AND ({ai} = 0 OR EXISTS (SELECT 1 FROM discover_settings ds WHERE ds.user_id = ?1 AND ds.assistant = 1 AND (t.kind <> 'mind' OR ds.mind = 1)))`,
  idSql: 't.kind',
  defaultSort: { key: 'taken', dir: 'desc' },
  read: 'sql',
  privateSelect: { result: 't.result_json' },
  readOnlyWhy: 'Take a self-check again in Discover. AI chat reads these only while “Let the assistant learn from them” is on there too.',
  columns: [
    c('addOn', 'Self-check', 'enum', 't.kind', { options: EXTRA_KIND_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('found', 'What it found', 'summary', null, { derive: 'discoverAddOn', from: ['result'] }),
    stamp('taken', 'Taken on', 't.taken_at'),
    stamp('changed', 'Changed', 't.updated_at', { filter: undefined }),
  ],
};

const COMPANION_CHAT: DataTable = {
  key: 'companionChat',
  name: 'Companion chat',
  blurb: 'Every line of your Companion chat: yours and its answers, and who answered.',
  group: 'selfAi',
  audience: 'others',
  needs: ['companion'],
  sqlTable: 'chat_messages',
  from: 'chat_messages t',
  owner: 't.user_id = ?1',
  // AI chat never gets an answer that read a table the person has since shut to it (the journal it quoted, say): those lines are left out of
  // its page, count and search (`{aiHeld}`, worked out by the server's one rule, `heldBack`). The person's own lines and every other read stay.
  where: "({ai} = 0 OR t.role = 'user' OR COALESCE(t.model, '') NOT IN (SELECT value FROM json_each({aiHeld})))",
  idSql: 't.id',
  defaultSort: { key: 'when', dir: 'desc' },
  read: 'sql',
  privateSelect: { model: 't.model' },
  readOnlyWhy: 'A line stays as it was said. Clear the whole chat in the Companion.',
  columns: [
    c('who', 'Who', 'enum', "CASE WHEN t.role = 'user' THEN 'you' ELSE 'companion' END", { options: COMPANION_WHO_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('line', 'Line', 'longtext', 't.body', { searchable: true, notNull: true, format: 'inert' }),
    c('answeredBy', 'Answered by', 'summary', null, { derive: 'answeredBy', from: ['model'] }),
    stamp('when', 'When', 't.created_at'),
  ],
};

const ASSISTANT_CHANGES: DataTable = {
  key: 'assistantChanges',
  name: 'What the assistant changed',
  blurb: 'Each change the assistant made for you, by its plain label, and whether it was undone.',
  group: 'selfAi',
  audience: 'others',
  sqlTable: 'assistant_actions',
  // The label only: never what the model sent (args_json), the way back (undo_json) or what it refreshed.
  from: 'assistant_actions t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'when', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Undo or confirm a change in the assistant’s panel, where it was made.',
  columns: [
    c('change', 'Change', 'text', 't.label', { sortable: true, searchable: true, notNull: true, format: 'inert' }),
    c('state', 'State', 'enum', 't.status', { options: ASSISTANT_ACTION_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('problem', 'What went wrong', 'text', "NULLIF(t.error, '')", { searchable: true }),
    stamp('when', 'When', 't.created_at'),
    stamp('changed', 'Changed', 't.updated_at', { filter: undefined }),
  ],
};

const VIBE_ANSWERS: DataTable = {
  key: 'vibeCheckAnswers',
  name: 'Vibe check answers',
  blurb: 'Your vibe check by pillar: the choice each answer counted as, and its points.',
  group: 'pillars',
  sqlTable: 'onboarding_answers',
  from: 'onboarding_answers t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'answered', dir: 'desc' },
  read: 'sql',
  privateSelect: { questionId: 't.question_id', value: 't.value' },
  // Only the index of an answer is stored: one in the person's own words counts as a choice it never names, so the cell says what it counted as,
  // and a foundation, whose own words replace it on the pyramid, reads as nothing here (tablesRead.ts, vibeAnswerWords).
  readOnlyWhy: 'Answer a pillar again in the vibe check, which replaces its answers. An answer in your own words shows as the choice it counted as. Your foundation is on your pyramid.',
  columns: [
    pillar('pillar', 'Pillar', 't.relationship', { notNull: true }),
    c('question', 'Question', 'summary', null, { derive: 'vibeQuestion', from: ['questionId'] }),
    c('answer', 'Counted as', 'summary', null, { derive: 'vibeAnswer', from: ['questionId', 'value'] }),
    c('points', 'Points it gave', 'number', 't.points', { sortable: true, notNull: true }),
    stamp('answered', 'Answered on', 't.created_at'),
  ],
};

const LIVE_CALLS: DataTable = {
  key: 'liveCalls',
  name: 'Live call asks',
  blurb: 'Each time you asked for the live strategy call, its price and where it stands.',
  group: 'pillars',
  sqlTable: 'call_requests',
  // Never the payment provider's order or payment id.
  from: 'call_requests t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'asked', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Ask for the live call on your life map. The team sets the time.',
  columns: [
    c('state', 'State', 'enum', 't.status', { options: LIVE_CALL_STATE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('price', 'Price', 'money', 't.amount_cents', { currency: 'currency', sortable: true, notNull: true }),
    c('currency', 'Currency', 'enum', 't.currency', { options: CURRENCY_OPTIONS, hidden: true }),
    stamp('asked', 'Asked on', 't.created_at'),
    c('paidAt', 'Paid on', 'datetime', 't.paid_at', { sortable: true }),
    stamp('changed', 'Changed', 't.updated_at', { filter: undefined }),
  ],
};

const PLAN: DataTable = {
  key: 'plan',
  name: 'Your plan',
  blurb: 'Your plan, when it runs until, and the credits left on it and as extras.',
  group: 'money',
  sqlTable: 'credit_accounts',
  from: 'credit_accounts t',
  owner: 't.user_id = ?1',
  idSql: "'plan'",
  defaultSort: { key: 'changed', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'See plans and top-ups on Plans. While payments are not live, the team starts a plan.',
  columns: [
    c('plan', 'Plan', 'enum', 't.plan', { options: PLAN_OPTIONS, ordered: true, notNull: true }),
    // A plan whose time is up closes the next time the account is read: here it already reads as ended, with no plan credits left.
    c('running', 'Running now', 'bool', PLAN_RUNNING_SQL, { notNull: true }),
    c('started', 'Started', 'datetime', 't.plan_started_at'),
    c('until', 'Runs until', 'datetime', 't.plan_until'),
    c('planCredits', 'Plan credits left', 'number', `CASE WHEN ${PLAN_RUNNING_SQL} THEN t.plan_credits ELSE 0 END`, { notNull: true }),
    c('extraCredits', 'Extra credits left', 'number', 't.extra_credits', { notNull: true }),
    stamp('changed', 'Changed', 't.updated_at', { filter: undefined }),
  ],
};

const DISCOUNTS_USED: DataTable = {
  key: 'discountsUsed',
  name: 'Discount codes you used',
  blurb: 'What each discount code took off, and on what. Never the code itself.',
  group: 'money',
  sqlTable: 'discount_redemptions',
  // Never the code's word, the team's note on it, or the order, enrolment or seat it was used on (ref).
  from: 'discount_redemptions t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'when', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A record of a discount used. One given back means the payment did not go through.',
  columns: [
    c('area', 'Where', 'enum', 't.area', { options: DISCOUNT_AREA_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('item', 'What', 'text', DISCOUNT_ITEM_SQL, { searchable: true }),
    c('off', 'Money off', 'money', 't.off_cents', { currency: 'currency', sortable: true, notNull: true }),
    c('pointsOff', 'Points off', 'number', 't.off_points', { sortable: true, notNull: true }),
    c('currency', 'Currency', 'enum', 't.currency', { options: CURRENCY_OPTIONS, hidden: true }),
    c('givenBack', 'Given back', 'bool', 't.released_at IS NOT NULL', { filter: 'pick', notNull: true }),
    stamp('when', 'Used on', 't.created_at'),
  ],
};

const PAYOUT_DETAILS: DataTable = {
  key: 'payoutDetails',
  name: 'Payout details',
  blurb: 'Your payout details: the legal name, the last four of your PAN and account, the IFSC.',
  group: 'money',
  needs: ['shop'],
  sqlTable: 'kyc_profiles',
  // As stored: the last four only. Never the PAN's hash or who on the team looked at it.
  from: 'kyc_profiles t',
  owner: 't.user_id = ?1',
  idSql: "'payout'",
  defaultSort: { key: 'sent', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Change your payout details in the Shop, under Customers. Sending them again asks the team to look again.',
  columns: [
    c('state', 'State', 'enum', 't.status', { options: KYC_STATE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('legalName', 'Legal name', 'text', "NULLIF(t.legal_name, '')", { searchable: true }),
    c('panEnds', 'PAN ends in', 'text', "NULLIF(t.pan_last4, '')"),
    c('accountEnds', 'Account ends in', 'text', "NULLIF(t.bank_last4, '')"),
    c('ifsc', 'IFSC', 'text', "NULLIF(t.ifsc, '')"),
    c('address', 'Address', 'longtext', "NULLIF(t.address, '')"),
    c('note', 'Note from the team', 'text', "NULLIF(t.note, '')"),
    c('sent', 'Sent on', 'datetime', 't.submitted_at', { sortable: true }),
    c('decided', 'Looked at on', 'datetime', 't.decided_at', { sortable: true }),
  ],
};

const HONORS_TABLE: DataTable = {
  key: 'honors',
  name: 'Honors',
  blurb: 'The honors the team gave you, and the seasons you finished in the top three.',
  group: 'account',
  sqlTable: 'honors',
  from: 'honors t',
  owner: 't.user_id = ?1',
  idSql: 't.honor_key',
  defaultSort: { key: 'given', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'The team gives honors and a season gives its own. The time honors come by themselves and are not kept here.',
  columns: [
    c('honor', 'Honor', 'enum', 't.honor_key', { options: HONOR_OPTIONS, otherLabel: 'An honor no longer given', sortable: true, filter: 'pick', notNull: true }),
    c('tier', 'Tier', 'enum', HONOR_TIER_SQL, { options: BADGE_TIER_OPTIONS, ordered: true, sortable: true, filter: 'pick' }),
    c('note', 'Note from the team', 'text', "NULLIF(t.note, '')", { searchable: true }),
    stamp('given', 'Given on', 't.awarded_at'),
  ],
};

const SEASON_PLACES: DataTable = {
  key: 'seasonPlaces',
  name: 'Season places',
  blurb: 'The monthly leaderboard seasons you finished in the top three, and your xp that month.',
  group: 'account',
  needs: ['leaderboard'],
  sqlTable: 'season_results',
  from: 'season_results t',
  owner: 't.user_id = ?1',
  idSql: 't.season',
  defaultSort: { key: 'season', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A season closes once, at the start of the next month, and stays as it ended.',
  columns: [
    c('season', 'Season', 'text', SEASON_LABEL_SQL, { sortable: true, sortSql: 't.season', notNull: true }),
    c('place', 'Place', 'number', 't.place', { sortable: true, notNull: true }),
    c('xp', 'Xp that month', 'number', 't.xp', { sortable: true, notNull: true }),
  ],
};

const CALENDAR_LINK: DataTable = {
  key: 'calendarLink',
  name: 'Calendar link',
  blurb: 'Whether your private calendar link is on. The link is shown only on your Profile tab.',
  group: 'account',
  sqlTable: 'calendar_feeds',
  // Never the link's token: on or off, and since when.
  from: 'calendar_feeds t',
  owner: 't.user_id = ?1',
  idSql: "'calendar'",
  defaultSort: { key: 'made', dir: 'desc' },
  read: 'sql',
  columns: [
    c('on', 'On', 'bool', 't.enabled', { filter: 'pick', notNull: true, edit: { method: 'POST', path: '/me/calendar', field: 'on', input: 'toggle', note: 'Off stops the link at once. On again brings back the same link.' } }),
    stamp('made', 'First made', 't.created_at', { filter: undefined }),
  ],
};

const PRIVACY_RECORDS: DataTable = {
  key: 'privacyRecords',
  name: 'Privacy choices made',
  blurb: 'Every time you changed a privacy choice: to what, and where.',
  group: 'account',
  sqlTable: 'consent_records',
  from: 'consent_records t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'when', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A record of each choice, so it stays as it is. Change a choice in Privacy choices.',
  columns: [
    c('choice', 'Choice', 'enum', 't.purpose', { options: CONSENT_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('allowed', 'Allowed', 'bool', 't.granted', { filter: 'pick', notNull: true }),
    c('place', 'Where', 'enum', 't.source', { options: CONSENT_SOURCE_OPTIONS, sortable: true, filter: 'pick', notNull: true }),
    c('version', 'Card version', 'number', 't.banner_version', { sortable: true, notNull: true }),
    stamp('when', 'When', 't.created_at'),
  ],
};

const TERMS_ACCEPTED: DataTable = {
  key: 'termsAccepted',
  name: 'Terms you accepted',
  blurb: 'Each version of the terms and the privacy policy you accepted, and how.',
  group: 'account',
  sqlTable: 'terms_acceptances',
  from: 'terms_acceptances t',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'when', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'A record of what you agreed to, so it stays as it is.',
  columns: [
    c('doc', 'Document', 'enum', 't.doc', { options: LEGAL_DOC_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('version', 'Version of', 'date', 't.version', { sortable: true, notNull: true }),
    c('how', 'How', 'enum', 't.how', { options: TERMS_HOW_OPTIONS, filter: 'pick', notNull: true }),
    stamp('when', 'Accepted on', 't.accepted_at'),
  ],
};

const INVITE_CODES: DataTable = {
  key: 'inviteCodes',
  name: 'Invite codes you made',
  blurb: 'Each invite code you made, its label and whether it was used. Never the code.',
  group: 'invites',
  audience: 'others',
  sqlTable: 'invite_codes',
  // Never the code (a live key): whether its link still works, in words. Never who joined with it, as the app never tells its maker.
  from: 'invite_codes t',
  owner: 't.created_by = ?1',
  idSql: 't.id',
  defaultSort: { key: 'made', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Make, copy or take back a code under Invite people on your Profile tab.',
  columns: [
    c('label', 'Your label', 'text', "NULLIF(t.label, '')", { sortable: true, searchable: true, format: 'inert' }),
    c('state', 'State', 'enum', INVITE_STATE_SQL, { options: INVITE_STATE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('linkWorks', 'Its link works', 'bool', `(${INVITE_STATE_SQL}) = 'open'`, { filter: 'pick', notNull: true }),
    stamp('made', 'Made on', 't.created_at'),
    c('runsOut', 'Runs out', 'datetime', 't.expires_at', { sortable: true }),
    c('usedOn', 'Used on', 'datetime', 't.used_at', { sortable: true, filter: 'range' }),
  ],
};

const TEAM_MESSAGES: DataTable = {
  key: 'teamMessages',
  name: 'Messages to the team',
  blurb: 'What you wrote to the team in Help, or reported, and the team’s answers.',
  group: 'invites',
  audience: 'others',
  needs: ['help'],
  sqlTable: 'support_tickets',
  // As Help shows them: the team's answer and who on the team wrote it.
  from: 'support_tickets t LEFT JOIN users r ON r.id = t.replied_by',
  owner: 't.user_id = ?1',
  idSql: 't.id',
  defaultSort: { key: 'sent', dir: 'desc' },
  read: 'sql',
  readOnlyWhy: 'Write to the team in Help. Only the team answers.',
  columns: [
    c('subject', 'Subject', 'text', 't.subject', { sortable: true, searchable: true, notNull: true, format: 'inert' }),
    c('words', 'Your words', 'longtext', 't.body', { searchable: true, notNull: true, format: 'inert' }),
    c('state', 'State', 'enum', 't.status', { options: TICKET_STATE_OPTIONS, ordered: true, sortable: true, filter: 'pick', notNull: true }),
    c('answer', 'The team’s answer', 'longtext', "NULLIF(t.reply, '')", { searchable: true, format: 'inert' }),
    c('answeredBy', 'Answered by', 'text', `CASE WHEN t.replied_by IS NULL THEN NULL ELSE ${personName('r')} END`),
    stamp('sent', 'Sent', 't.created_at'),
    stamp('changed', 'Changed', 't.updated_at', { filter: undefined }),
  ],
};

/** Every table, in its group's order, the groups in DATA_TABLE_GROUPS order. */
export const DATA_TABLES: readonly DataTable[] = [
  TASKS, SUBTASKS, NOT_TO_DO, NOT_TO_DO_DAYS, SMALL_ACTS, REMINDERS, KINDS_OF_DAY, TIME_BLOCKS, DAY_TEMPLATES,
  PYRAMIDS, PILLAR_SCORES, XP_HISTORY, LIFE_MAP, LIFE_MAP_ANSWERS, VIBE_ANSWERS, ROUTINE, ROUTINE_DAYS, CONTRACT, LIVE_CALLS,
  REVIEWS, REVIEW_REMINDERS, REVIEW_TEMPLATES,
  BUSINESS_METRICS, BUSINESS_METRIC_VALUES,
  MOOD, SLEEP, STRESS, MINDFUL, MOVEMENT, EATING, WATER, FOCUS_SESSIONS, SUPPLEMENTS, SUPPLEMENT_DAYS,
  JOURNAL, GRATITUDE,
  LIFE_COACHES, COACH_STUDENTS, COACHING_LOG, STUDENTS_LOG, COACH_CARD,
  DISCOVER_RESULTS, DISCOVER_ADD_ONS, COMPANION_CHAT, ASSISTANT_CHANGES,
  MONEY_IN_OUT, BUDGETS, DUES, SAVINGS_GOALS, RECURRING, POINTS, CREDITS, PLAN, ORDERS, DISCOUNTS_USED, PAYOUT_DETAILS,
  MY_BOOKINGS, MY_QUESTIONS, MY_COURSE_INVITES, MY_PRODUCT_REVIEWS,
  PRODUCTS, COUPONS, BOOKINGS, SESSION_HOURS, SESSION_DAYS, COURSE_INVITES, PRIORITY_DMS, PRODUCT_REVIEWS,
  LEADS, BROADCASTS,
  CONTENT_POSTS, TRACKED_LINKS, AUTO_DMS, FUNNELS, SEQUENCES,
  BRANDS, BRAND_SOURCES, RESEARCH_RUNS, BRAND_PIECES,
  PORTFOLIO,
  PREOWNED_LISTINGS, LISTING_OFFERS, CHATS_WITH_BUYERS, MY_OFFERS, CHATS_WITH_SELLERS,
  TOOLS_SUGGESTED,
  TV_PITCHES, FUND_APPLICATIONS,
  ENROLMENTS, LESSON_PROGRESS, HAND_INS, QUIZ_ATTEMPTS, CERTIFICATES, ATTENDANCE, PROGRAM_INVITES, COHORT_LINES,
  PROGRAMS_MADE, COHORTS_RUN, PROGRAM_INVITES_SENT,
  WORK_LISTINGS, WORK_APPLICANTS, WORK_APPLICATIONS, WORK_APPLICATION_STEPS,
  ARMY_ROLES, ARMY_WORK_SENT, ARMY_FEEDBACK, ARMY_BRANDS, ARMY_BRAND_TEAMS, ARMY_CAMPAIGNS, ARMY_CAMPAIGN_LOG,
  WIN_REWARDS, WIN_ENTRIES, WIN_REVIEWER_NOTES,
  AGENCY_CLIENTS, AGENCY_PIECES, AGENCY_NOTES, AGENCY_TIME, AGENCY_RETAINERS, AGENCY_LOG, AGENCY_TEAM,
  AGENCY_INVOICES, AGENCY_AGREEMENTS, AGENCY_DOCUMENTS, AGENCY_TEMPLATES,
  FRIENDS, FOLLOWING, FOLLOWERS, POSTS, REPLIES, COACH_NOTES,
  COMMUNITY_CHANNELS, COMMUNITY_LINES, POST_REACTIONS, REPLY_REACTIONS, FOLLOWED_POSTS, MUTES,
  BOND_CHATS, BOND_CHAT_LINES, INTRODUCTIONS, BOND_CHANNELS, BOND_CHANNEL_LINES, BLOCKS,
  CLUB_MEMBERSHIP,
  PARTY_HOSTED, PARTY_GUESTS, PARTY_JOINED, PARTY_FEEDBACK, PARTY_LINES,
  RUN_CLUBS_HOSTED, RUN_CLUBS_JOINED, RUNS_HOSTED, RUN_ENTRIES, RUN_ENTRIES_HOSTED, RUN_LINES, RUN_COLLABS_POSTED, RUN_COLLAB_APPLICANTS, RUN_COLLAB_APPLICATIONS,
  CIRCLE_SIGNUPS, CIRCLE_LINES,
  REWARD_RESERVATIONS, GAMES_UNLOCKED,
  BADGES, HONORS_TABLE, SEASON_PLACES, INBOX, CALENDAR_LINK, PRIVACY_CHOICES, PRIVACY_RECORDS, TERMS_ACCEPTED,
  INVITE_CODES, TEAM_MESSAGES,
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

/** A table's audience: 'own' unless it says 'others'. */
export const audienceOf = (table: DataTable): TableAudience => table.audience ?? 'own';

/** Who besides the person may ever see a table (each still only when the person allows it: a coach's switch, AI chat's switch). */
export interface TableReach {
  /** A life coach, when the person shares it with that one coach (Show to my coach, Tables your coach can see). */
  coach: boolean;
  /** A super admin, read only, every read in the audit log. */
  admin: boolean;
  /** AI chat, when the person opens it to AI chat: through any model, or only one that keeps nothing ('private'). */
  ai: 'any' | 'private';
}

/**
 * The one rule for who may see a table (2026-11-14, the founder's two audiences; WHO SEES A TABLE at the top of this file). Every other
 * helper here, the routes, the share lists and the switches on a table's page read it, so the rule cannot drift apart.
 */
export function tableReach(table: DataTable): TableReach {
  const others = audienceOf(table) === 'others';
  return { coach: !others, admin: !others && !table.adminHidden, ai: others || table.adminHidden ? 'private' : 'any' };
}

/** A table AI chat reads only through a model that keeps nothing: the journal, gratitude, every Body and mind table, and every table with other people's details. */
export function aiPrivateOnly(table: DataTable): boolean {
  return tableReach(table).ai === 'private';
}

/** The tables a coach may be shown out of anything (a stored share, a request body): known keys only, each once, in registry order, and never
 * one with other people's details (`tableReach(...).coach`). The coach share is read and saved through this, never `knownTableKeys` alone. */
export function coachTableKeys(raw: unknown): string[] {
  return knownTableKeys(raw).filter((k) => tableReach(dataTableByKey[k]!).coach);
}

/**
 * Is the app a table's records belong to on for this person (`needs`, any one of them), and the setting inside it it needs (`needsSwitch`,
 * carried in `on` as `switch:<key>`)? A table with neither always is.
 */
export function tableAppsOn(table: DataTable, on: AppsOn): boolean {
  const app = !table.needs || table.needs.length === 0 || table.needs.some((k) => on.includes(k));
  return app && (!table.needsSwitch || on.includes(tableSwitchKey(table.needsSwitch)));
}

/**
 * Of a stored list of tables (a coach's share, AI chat's), the ones shown now: known tables whose app is on for the person whose tables they
 * are (2026-11-14, the review). This is all any answer carries, to the person, their coach or AI chat, so every count and every list agrees and
 * nobody can tell from a share which app the person hid. A table whose app is hidden or off keeps its place in the stored list, unseen, and is
 * shown again when the app comes back (`keepHiddenTables`).
 */
export function tablesShownNow(keys: readonly string[], on: AppsOn): string[] {
  return keys.filter((k) => {
    const t = dataTableByKey[k];
    return t !== undefined && tableAppsOn(t, on);
  });
}

/**
 * A whole list sent from a screen (Share all, Share none) speaks only for the tables the person can see now: the ones it names whose app is on,
 * plus every stored table whose app is hidden or off, kept as it was. Clean it after (knownTableKeys or coachTableKeys) for the registry's order.
 */
export function keepHiddenTables(sent: readonly string[], stored: readonly string[], on: AppsOn): string[] {
  const shown = new Set(tablesShownNow(stored, on));
  return [...tablesShownNow(sent, on), ...stored.filter((k) => !shown.has(k))];
}

/**
 * Names said as one list: "Tasks and Mood", "Tasks, Mood and Sleep". When a name holds " and " itself ("Body and mind", "Money in and out") the
 * last one takes a comma too ("Reviews, Body and mind, and Journal"), so each name still reads as one thing.
 */
export function andList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  const comma = names.some((n) => n.includes(' and ')) ? ',' : '';
  return `${names.slice(0, -1).join(', ')}${comma} and ${names.at(-1)}`;
}

/**
 * May this viewer open this table? `shared` is the coach's list from the student's link; `on` the apps on for the person whose tables these
 * are (null only where the server checks it and this side cannot know, a coach's or an admin's screen: never on the server).
 */
export function tableAllowed(table: DataTable, view: TableView, shared: readonly string[], on: AppsOn | null): boolean {
  if (on !== null && !tableAppsOn(table, on)) return false;
  const reach = tableReach(table);
  if (view === 'admin') return reach.admin;
  if (view === 'coach') return reach.coach && shared.includes(table.key);
  return true;
}

/**
 * The list page's groups for a viewer: the owner every table whose app is on, a coach the shared ones, an admin all but the adminHidden ones
 * and those with other people's details; each category carries the app group it is drawn under. Empty categories go.
 */
export function listTables(view: TableView, shared: readonly string[], on: AppsOn | null): TableListGroup[] {
  return DATA_TABLE_GROUPS.map((g) => ({
    key: g.key,
    name: g.name,
    appGroup: g.appGroup,
    tables: DATA_TABLES.filter((t) => t.group === g.key && tableAllowed(t, view, shared, on)).map((t) => ({ key: t.key, name: t.name, blurb: t.blurb })),
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
  /**
   * AI chat is reading (the owner's own read, marked `X-Kreators-Via: assistant`): `{ai}` is bound to 1, else 0. A table whose app keeps its own
   * yes for the assistant reads it in its `where` (Discover's "Let the assistant learn from them" and "Include how my mind works"), so Show to AI
   * chat never reaches past it.
   */
  ai?: boolean;
  /**
   * AI chat's read of the Companion chat: the stored `model` values whose answers it may no longer have, since each read a table the person has
   * shut to AI chat since (or did not say what it read): `{aiHeld}`, bound as a JSON list, empty by default. The server works the list out by
   * its one rule (`heldBack` in aiOpen.ts); the table's `where` leaves those lines out of the page, the count and a search alike.
   */
  aiHeld?: readonly string[];
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
  return sql
    .replace(/\{today\}/g, () => b.once('today', ctx.today))
    .replace(/\{viewer\}/g, () => b.once('viewer', ctx.viewerId))
    .replace(/\{ai\}/g, () => b.once('ai', ctx.ai === true ? 1 : 0))
    .replace(/\{aiHeld\}/g, () => b.once('aiHeld', JSON.stringify(ctx.aiHeld ?? [])));
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
    if (sortCol?.sortTerms && columnFor(sortCol, ctx.view)) {
      for (const term of sortCol.sortTerms) parts.push(`${tokens(term, b, ctx)} ${dir}`);
    } else if (sortCol && (sortCol.sql || sortCol.sortSql) && columnFor(sortCol, ctx.view)) {
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
    case 'stepLabels': {
      const words = parseList(first).flatMap((s) => {
        if (!s || typeof s !== 'object') return [];
        const o = s as { kind?: unknown; label?: unknown };
        const label = typeof o.label === 'string' ? o.label.trim() : '';
        const kind = typeof o.kind === 'string' ? FUNNEL_STEP_WORDS[o.kind] : undefined;
        return label ? [label] : kind ? [kind] : [];
      });
      return words.length ? words.join(', ') : null;
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
    case 'paperOpen':
      return cells.status === 'draft' || cells.status === 'sent';
    case 'retainerOpen':
      return cells.status === 'offered' || cells.status === 'chosen' || cells.status === 'active';
    case 'listingOpen':
      return cells.status === 'live' || cells.status === 'withdrawn';
    case 'unpublished':
      return cells.status === 'draft' || cells.status === 'closed';
    case 'pitchWaiting':
      return cells.stage === 'submitted';
    case 'xpOpen':
      return cells.xpOpen === true;
    case 'seatHeld':
      return cells.status === 'registered' || cells.status === 'attended';
    case 'madeIt':
      return cells.madeIt === true;
    case 'linkOpen':
      return cells.status === 'pending' || cells.status === 'active';
    default:
      return false;
  }
}

/** The column keys the owner may change on this row now. */
export function editableKeys(table: DataTable, cells: Readonly<Record<string, Cell>>, today: string): string[] {
  return table.columns.filter((col) => rowEditable(table, col, cells, today)).map((col) => col.key);
}

/** Whole rupees or dollars, grouped as the app groups numbers (LOCALE in core.ts, en-IN, which this leaf may not import: a test holds them together). */
const WHOLE_UNITS = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

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
      // Money is typed in whole rupees or dollars and sent in paise or cents, so its most is said in whole units ("The most is 10,000.").
      if (edit.max !== undefined && n > edit.max) return { error: `The most is ${edit.input === 'money' ? WHOLE_UNITS.format(edit.max / 100) : edit.max}.` };
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
      // A state the app moves by itself (a listing sold, or with an offer accepted) is shown, never picked here.
      if (edit.offer && !edit.offer.includes(v)) return { error: 'That one is set in the app itself. Pick another.' };
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
  // Any other part of the path (a piece's brand) comes from the row's own cell of that name, an id like any other, or there is no call.
  let missing = false;
  path = path.replace(/:([A-Za-z]\w*)/g, (_, name: string) => {
    const v = cells[name];
    if (typeof v !== 'string' || !TABLE_ID_RE.test(v)) {
      missing = true;
      return '';
    }
    return encodeURIComponent(v);
  });
  if (missing) return null;
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
