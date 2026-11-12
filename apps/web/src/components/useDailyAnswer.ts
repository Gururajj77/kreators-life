import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import type { TodayResponse } from '@kreators/shared';
import { todayLocal } from '../lib/date';

/** Whether a cached answer is GET /today's own (not /today/waiting, /today/done or the month, which share the key's start). */
function isDailyAnswer(d: unknown): d is TodayResponse {
  return Boolean(d && typeof d === 'object' && 'day' in d && 'checkedIn' in d && Array.isArray((d as { tasks?: unknown }).tasks));
}

/**
 * The newest GET /today answer for the day held in React Query's cache, whatever area, sort or tab it was read for (2026-11-12). Daily's
 * Your day and its By time block view both read Place my day's plan from this one answer, so the two always show the same plan, and
 * neither needs Daily to hand it down. `looseTasks`, the day plan and the breakdowns are the same for every cut. Undefined until the first
 * answer lands. Reads the cache only: never asks the server.
 */
export function useDailyAnswer(date: string): TodayResponse | undefined {
  const cache = useQueryClient().getQueryCache();
  const subscribe = useCallback((cb: () => void) => cache.subscribe(cb), [cache]);
  const snapshot = useCallback(() => {
    let best: TodayResponse | undefined;
    let at = -1;
    for (const q of cache.findAll({ queryKey: ['today', date] })) {
      const d = q.state.data;
      if (isDailyAnswer(d) && d.date === date && q.state.dataUpdatedAt > at) {
        best = d;
        at = q.state.dataUpdatedAt;
      }
    }
    return best;
  }, [cache, date]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** The minute of the device's day it is now, when `day` is today; null for any other day (nothing on another day is over yet). */
export function minuteNowOn(day: string, now: number): number | null {
  if (day !== todayLocal()) return null;
  const d = new Date(now);
  return d.getHours() * 60 + d.getMinutes();
}
