import { MODULES } from '@kreators/shared';

/**
 * What the person has opened lately, kept on this device only (never sent anywhere): a short list of visit times per app. It is read
 * once when the page loads, so a list never re-sorts under your thumb while you use it; the order catches up on the next visit.
 */
const KEY = 'kreators.appUse';
const FORTNIGHT = 14 * 86_400_000;
type Use = Record<string, number[]>;

function read(): Use {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown;
    return raw && typeof raw === 'object' ? (raw as Use) : {};
  } catch {
    return {};
  }
}
const snapshot: Use = read();

/** Remember that an app was opened. Takes effect in the lists on the next visit. */
export function noteVisit(path: string, now = Date.now()): void {
  const hit = [...MODULES].filter((m) => !m.locked).sort((a, b) => b.path.length - a.path.length).find((m) => path === m.path || path.startsWith(`${m.path}/`));
  if (!hit) return;
  try {
    const use = read();
    use[hit.key] = [...(use[hit.key] ?? []).filter((t) => now - t < FORTNIGHT), now].slice(-60);
    localStorage.setItem(KEY, JSON.stringify(use));
  } catch {
    // no storage here: the order simply stays as it is
  }
}

/** How much the person has used an app lately: opens in two weeks (up to 20), and a bump for the last day. */
export function usageScore(key: string, now = Date.now()): number {
  const visits = (snapshot[key] ?? []).filter((t) => now - t < FORTNIGHT);
  return Math.min(visits.length, 20) * 15 + (visits.some((t) => now - t < 86_400_000) ? 60 : 0);
}
