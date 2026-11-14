import type { Context } from 'hono';
import { ASSISTANT_MODEL_BY_ID } from '@kreators/shared';
import { aiPrivateOnly, andList, dataTableByKey, parseAiTables } from '@kreators/shared/dataTables';
import type { AppEnv } from './env';

/**
 * AI chat's door to a table's words outside All tables (2026-11-14, the founder's yes): the journal's own routes, which the assistant's and the
 * Companion's `read_journal` calls, answer AI chat only for a table the person opened with Show to AI chat (`users.ai_tables_json`, migration
 * 0153), and only for a model that keeps nothing (the tool marks one with `ai=private`, as `read_table` does). The list comes from the session's
 * own row (`SELECT u.*`), so asking costs no round trip, and a refusal reads nothing. A call is AI chat's when the tool dispatcher marked it
 * `X-Kreators-Via: assistant` (dispatch.ts); the app's own screens send no mark and are never touched. A person who sends the mark themselves
 * only shuts doors on themselves.
 *
 * What a model was once handed stays in the chat it answered in, so a later message holds back an answer that read a table now shut (and,
 * for a model that may keep data, any answer that read what only a model that keeps nothing may read): `heldBack` is that one rule, for the
 * assistant's turns (kept in the tab, each carrying its `reads`) and the Companion's lines (their `model` carrying the same list, `withReads`;
 * a column of its own would be cleaner, and waits for a migration).
 */

type Ctx = Context<AppEnv>;

/** The call came from the assistant or the Companion, through the tool dispatcher. */
export const viaAssistant = (c: Ctx): boolean => c.req.header('X-Kreators-Via') === 'assistant';

/** True while the person has this table open to AI chat (Show to AI chat). */
export const openToAi = (c: Ctx, key: string): boolean => parseAiTables(c.get('user').ai_tables_json ?? null).includes(key);

/**
 * May this call have the words of `key`? Always for a call without the mark (the screens); for AI chat, only while the table is open to it and
 * the model keeps nothing (`ai=private`). For a route that cuts its answer quietly (search) rather than refusing (`aiTableShut`).
 */
export const aiMayRead = (c: Ctx, key: string): boolean => !viaAssistant(c) || (openToAi(c, key) && c.req.query('ai') === 'private');

/** A table's name as All tables shows it. */
const tableName = (key: string): string => dataTableByKey[key]?.name ?? key;

/** Whether All tables, where the switches live, is shown for the person: on, hidden by them in Apps, or not available on their account. */
export type AllTablesState = 'on' | 'hidden' | 'off';

/** All tables' state as the module gate read it for this request (a route gated by an app reads it there); unknown reads as on. */
export function allTablesState(c: Ctx): AllTablesState {
  const t = c.get('gateAccess')?.tables;
  if (!t) return 'on';
  return !t.available ? 'off' : t.on ? 'on' : 'hidden';
}

/**
 * What to tell the person about tables not open to AI chat, by their names in All tables, and where to switch them on. While All tables is
 * hidden in Apps neither place shows a switch, so the words say to show it first; while it is not available on the account, they say so.
 */
export function notOpenToAi(keys: readonly string[], allTables: AllTablesState = 'on'): string {
  const names = keys.map(tableName);
  const one = names.length === 1;
  const head = `${andList(names)} ${one ? 'is' : 'are'} not open to AI chat.`;
  if (allTables === 'off') return `${head} All tables is not available on your account, so ${one ? 'it' : 'they'} cannot be opened to AI chat.`;
  const where = `switch on Show to AI chat at the top of ${one ? `the ${names[0]} table` : 'each table'} in All tables, or under AI chat on the Profile tab.`;
  return allTables === 'hidden' ? `${head} To let AI chat read ${one ? 'it' : 'them'}, show All tables in Apps first. Then ${where}` : `${head} To let AI chat read ${one ? 'it' : 'them'}, ${where}`;
}

/** What to tell the person when the model may keep what it reads. */
export const keepsWhatItReads = (what: string): string => `This model may keep what it reads, so it cannot read ${what}. Pick a model that keeps nothing instead.`;

/**
 * AI chat's refusal for a route that hands out a table's words, or null to go on. 403 in plain words while the person has not opened `key` to
 * AI chat (`aiClosed` names the table, and `allTables` says when All tables is hidden or off, so the tool can say which part is shut and where
 * to open it without passing on an error), then 403 to a model that may keep what it reads (no `ai=private`). A call without the mark always
 * goes on.
 */
export function aiTableShut(c: Ctx, key: string): Response | null {
  if (!viaAssistant(c)) return null;
  if (!openToAi(c, key)) {
    const allTables = allTablesState(c);
    return c.json({ error: notOpenToAi([key], allTables), aiClosed: key, ...(allTables === 'on' ? {} : { allTables }) }, 403);
  }
  if (c.req.query('ai') !== 'private') return c.json({ error: keepsWhatItReads(tableName(key)) }, 403);
  return null;
}

// ---------------------------------------------------------------------------
// What an earlier answer read
// ---------------------------------------------------------------------------

/**
 * The reads of an answer that does not say what it read (a turn kept by an older tab, or a reply from before reads were kept): held back as if
 * it read the journal, gratitude and something only a model that keeps nothing may see, so nothing slips through on a guess.
 */
export const UNKNOWN_READS: readonly string[] = ['journal', 'gratitude', 'private'];

/** A read only a model that keeps nothing may have: a table `aiPrivateOnly` says so of, or a read that is no table (a tracker, Discover). */
const privateRead = (key: string): boolean => {
  const table = dataTableByKey[key];
  return table ? aiPrivateOnly(table) : true;
};

/**
 * True when an earlier answer must not reach this model: it read a table the person has since shut to AI chat, or the model may keep data and
 * the answer read what only a model that keeps nothing may read. `reads` are table keys from All tables and plain names for any other private
 * read (`tool:get_wellbeing`, `discover`); null is an answer that does not say (`UNKNOWN_READS`).
 */
export function heldBack(c: Ctx, reads: readonly string[] | null, modelKeepsNothing: boolean): boolean {
  const list = reads ?? UNKNOWN_READS;
  return list.some((k) => Boolean(dataTableByKey[k]) && !openToAi(c, k)) || (!modelKeepsNothing && list.some(privateRead));
}

/** The words that stand in for an answer held back, so the turns keep their shape. */
export const HELD_BACK = '(An earlier answer is left out here.)';

/** The mark between a Companion line's model and what its answer read, kept in `chat_messages.model` (no table keys or model ids hold one). */
const READS_MARK = '#reads:';

/** The Companion's own answers that never had a tool or a model's reads: the built-in ones and the crisis line. */
const BUILT_IN = new Set(['', 'local', 'workers-ai', 'crisis']);

/**
 * A Companion line's `model` with what its answer read, for `chat_messages.model`. Every model's line carries the mark, an empty list too, so
 * a line kept before reads were (no mark) can be told apart from one that read nothing.
 */
export const withReads = (model: string, reads: readonly string[]): string => `${model}${READS_MARK}${reads.join(',')}`;

/**
 * A stored Companion `model` split back into the model and what its answer read. A line with no mark from a model that may have read the
 * journal (one the list does not say keeps data) is null, unknown; the built-in answers and a model that keeps data read nothing private.
 */
export function readsOf(raw: string | null | undefined, keepsData: (model: string) => boolean): { model: string; reads: string[] | null } {
  const value = raw ?? '';
  const at = value.indexOf(READS_MARK);
  if (at >= 0) return { model: value.slice(0, at), reads: value.slice(at + READS_MARK.length).split(',').filter(Boolean) };
  return { model: value, reads: BUILT_IN.has(value) || keepsData(value) ? [] : null };
}

/** A stored Companion `model` without what its answer read: the model alone, for the screen, the export's tables and "Answered by". */
export const modelOnly = (raw: string | null | undefined): string => {
  const value = raw ?? '';
  const at = value.indexOf(READS_MARK);
  return at < 0 ? value : value.slice(0, at);
};

/** A model the list says may keep data: its Companion lines never read the journal, the trackers or a table only a model that keeps nothing reads. */
const keepsDataModel = (model: string): boolean => ASSISTANT_MODEL_BY_ID[model]?.private === false;

/**
 * AI chat's read of the Companion chat table (`read_table`): the stored `model` values whose answers it may no longer have, by the one rule
 * (`heldBack`), for the table's `{aiHeld}`. Without it a page, a count or a search would hand a model an earlier answer that quoted the journal
 * or gratitude after the person shut them (the review of 2026-11-14). One round trip, over the person's chat by its index; only for that read.
 */
export async function heldCompanionModels(c: Ctx, modelKeepsNothing: boolean): Promise<string[]> {
  const got = await c.env.DB.prepare("SELECT DISTINCT model FROM chat_messages WHERE user_id = ? AND role = 'assistant' AND model IS NOT NULL AND model <> ''")
    .bind(c.get('user').id)
    .all<{ model: string }>();
  return got.results.map((r) => r.model).filter((m) => heldBack(c, readsOf(m, keepsDataModel).reads, modelKeepsNothing));
}
