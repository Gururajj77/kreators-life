import { FOCUS_DEFAULTS, parseFocusSettings, type FocusSettings } from '@kreators/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { api } from './api';
import { useMe } from './queries';
import { useSession } from './store';

const KEY = ['focus-settings'] as const;
const LEGACY = 'kreators.focusRounds.settings';
const cacheKey = (uid: string) => `kreators.focusPrefs.${uid}`;

const readLocal = (key: string): FocusSettings | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parseFocusSettings(raw) : null;
  } catch {
    return null;
  }
};

/**
 * The person's timer settings, kept on their account so they follow them to every device, and in this browser (by person) so the screen
 * never waits on the network. A change shows at once and is saved a moment after the last tap. A device that kept settings before this
 * existed hands them over the first time, if the account has none yet. Both Mindful timers share one copy.
 */
export function useFocusPrefs(): { settings: FocusSettings; set: (next: FocusSettings) => void; ready: boolean } {
  const qc = useQueryClient();
  const token = useSession((s) => s.token);
  const me = useMe();
  const uid = me.data?.user.id ?? '';
  const q = useQuery({ queryKey: KEY, queryFn: api.focusSettings, enabled: Boolean(token), staleTime: Number.POSITIVE_INFINITY });
  const timer = useRef<number | null>(null);
  const adopted = useRef(false);

  const settings = q.data?.settings ?? (uid ? readLocal(cacheKey(uid)) : null) ?? FOCUS_DEFAULTS;

  const push = useCallback((next: FocusSettings) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void api.saveFocusSettings(next).catch(() => undefined);
    }, 500);
  }, []);

  const set = useCallback(
    (next: FocusSettings) => {
      qc.setQueryData(KEY, { settings: next });
      try {
        if (uid) localStorage.setItem(cacheKey(uid), JSON.stringify(next));
      } catch {
        // not kept here, still saved on the account
      }
      push(next);
    },
    [qc, uid, push],
  );

  // An account with no saved settings takes what this device kept before, once.
  useEffect(() => {
    if (adopted.current || !q.data || q.data.settings !== null || !uid) return;
    adopted.current = true;
    const old = readLocal(cacheKey(uid)) ?? readLocal(LEGACY);
    if (old) set(old);
  }, [q.data, uid, set]);

  return { settings, set, ready: !q.isPending };
}
