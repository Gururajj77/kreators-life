import { dataTableByKey, knownTableKeys } from '@kreators/shared/dataTables';

/**
 * All tables (2026-11-13): which of a student's tables a coach may open. Stored in `coach_links.share_json` as `tables`, each key the
 * student's own yes for that one coach, off until they turn it on. Only keys the registry knows are ever saved or read.
 */

/** The tables a share holds, cleaned: known keys only, each once, in the registry's order. */
export const sharedTables = (raw: unknown): string[] => knownTableKeys(raw);

/** "started sharing the tables Tasks and Mood; stopped sharing the table Journal entries", or '' when nothing changed. Names only, never contents. */
export function tablesChange(before: readonly string[], after: readonly string[]): string {
  const name = (k: string) => dataTableByKey[k]?.name ?? k;
  const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
  const said = (verb: string, keys: string[]) => (keys.length ? `${verb} ${keys.length === 1 ? 'the table' : 'the tables'} ${list(keys.map(name))}` : '');
  const on = after.filter((k) => !before.includes(k));
  const off = before.filter((k) => !after.includes(k));
  return [said('started sharing', on), said('stopped sharing', off)].filter(Boolean).join('; ');
}
