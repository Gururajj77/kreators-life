import { andList, coachTableKeys, dataTableByKey, tableSwitchKey } from '@kreators/shared/dataTables';

/**
 * All tables (2026-11-13): which of a student's tables a coach may open. Stored in `coach_links.share_json` as `tables`, each key the
 * student's own yes for that one coach, off until they turn it on. Only keys the registry knows are ever saved or read, and never a table
 * with other people's details (2026-11-14, `tableReach`): the list form drops one, the one-table form refuses it (routes/coach.ts).
 */

/** The tables a share holds, cleaned: known keys a coach may be shown only, each once, in the registry's order. */
export const sharedTables = (raw: unknown): string[] => coachTableKeys(raw);

/** "started sharing the tables Tasks and Mood; stopped sharing the table Journal entries", or '' when nothing changed. Names only, never contents. */
export function tablesChange(before: readonly string[], after: readonly string[]): string {
  const name = (k: string) => dataTableByKey[k]?.name ?? k;
  const said = (verb: string, keys: string[]) => (keys.length ? `${verb} ${keys.length === 1 ? 'the table' : 'the tables'} ${andList(keys.map(name))}` : '');
  const on = after.filter((k) => !before.includes(k));
  const off = before.filter((k) => !after.includes(k));
  return [said('started sharing', on), said('stopped sharing', off)].filter(Boolean).join('; ');
}

/**
 * The settings inside an app that are on for this person, as `switch:<key>` (TABLE_SWITCHES in dataTables.ts): Business metrics, Reviews' own
 * switch, whose tables list and open only while it is on, as its routes answer only then. One read of one row by its key; started in the same
 * turn as a route's other reads, the batch binding sends it with them. Added to the person's apps on wherever All tables reads them for the
 * person themself (their own list and pages, AI chat's, GET /me); a coach or an admin never reaches these tables, so never reads them.
 */
export async function tableSwitchesOn(db: D1Database, userId: string): Promise<string[]> {
  const kpis = await db.prepare('SELECT enabled FROM kpi_prefs WHERE user_id = ?').bind(userId).first<{ enabled: number }>();
  return kpis?.enabled === 1 ? [tableSwitchKey('businessMetrics')] : [];
}
