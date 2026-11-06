import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * The Emerging cards set aside with Not now, on this device only (a viewer's convenience, never needed for a page to work), one list per
 * person under `kreators.insightsHidden:<user>`. One store for every block on a screen (2026-11-06): Daily mounts Habits, Emerging and
 * Your kinds of day at once, so each hide or Show again starts from what is stored and every block hears of it, never from a stale copy.
 * A write that storage refuses (a private window) is kept in memory for the visit; another tab's change arrives by the `storage` event.
 */
const MAX = 100;
const mem = new Map<string, string>();
const listeners = new Set<() => void>();

const keyFor = (userId: string | undefined | null) => (userId ? `kreators.insightsHidden:${userId}` : null);

function raw(key: string | null): string {
  if (!key) return '[]';
  const kept = mem.get(key);
  if (kept !== undefined) return kept;
  try {
    return localStorage.getItem(key) ?? '[]';
  } catch {
    return '[]';
  }
}

function parse(text: string): string[] {
  try {
    const v = JSON.parse(text) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-MAX) : [];
  } catch {
    return [];
  }
}

function write(key: string, next: string[]) {
  const text = JSON.stringify(next.slice(-MAX));
  mem.set(key, text);
  try {
    localStorage.setItem(key, text);
  } catch {
    /* private window: set aside for this visit only */
  }
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const fromOtherTab = (e: StorageEvent) => {
    if (e.key && e.key.startsWith('kreators.insightsHidden:')) {
      mem.delete(e.key);
      onChange();
    }
  };
  window.addEventListener('storage', fromOtherTab);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', fromOtherTab);
  };
}

/** The ids set aside for this person, read once (no subscription); empty when storage is blocked or holds no list. */
export function hiddenInsightIds(userId: string | undefined | null): Set<string> {
  return new Set(parse(raw(keyFor(userId))));
}

/** The set-aside ids for this person, kept in step across every block, with `hide` (Not now) and `show` (Show again). */
export function useHiddenInsightIds(userId: string | undefined | null): [Set<string>, (id: string) => void, (id: string) => void] {
  const key = keyFor(userId);
  const text = useSyncExternalStore(subscribe, () => raw(key), () => '[]');
  const ids = useMemo(() => new Set(parse(text)), [text]);
  const hide = useCallback(
    (id: string) => {
      if (key) write(key, [...parse(raw(key)).filter((x) => x !== id), id]);
    },
    [key],
  );
  const show = useCallback(
    (id: string) => {
      if (key) write(key, parse(raw(key)).filter((x) => x !== id));
    },
    [key],
  );
  return [ids, hide, show];
}
