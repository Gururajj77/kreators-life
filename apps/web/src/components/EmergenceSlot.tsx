import { Suspense, type ComponentProps } from 'react';
import { useQuery } from '@tanstack/react-query';
import { insightsForPlace, type InsightApp, type InsightsResponse, type RelationshipKey } from '@kreators/shared';
import { api } from '../lib/api';
import { useSession } from '../lib/store';
import { todayLocal } from '../lib/date';
import { lazyNamed } from '../lib/lazy';

/**
 * The one Emerging query (2026-11-05): keyed by the device's day only, so Home, Daily, Pillars, each pillar page and every app screen
 * share one answer, the person's whole list, and each picks its own share with `insightsForPlace` (the same rule the server used per
 * place). An ordinary write marks it stale without refetching it (`useRefreshAll`); the Make it a habit and not to do sheets refetch it.
 */
export function useInsights(app: InsightApp, rel?: RelationshipKey | null) {
  const token = useSession((s) => s.token);
  const day = todayLocal();
  return useQuery({
    queryKey: ['insights', day],
    queryFn: () => api.insights(day),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    select: (d: InsightsResponse): InsightsResponse => ({ day: d.day, insights: insightsForPlace(d.insights, app, rel ?? null) }),
  });
}

const Block = lazyNamed(() => import('./Emergence'), 'EmergenceBlock');
const Habits = lazyNamed(() => import('./Emergence'), 'HabitsBlock');

/**
 * The Emerging block for a screen in the first download (Home, Daily): the patterns are asked for first, and the block's own code is
 * fetched only when there is something ready to show, so a screen with nothing to say downloads nothing more.
 */
export function EmergenceSlot(props: ComponentProps<typeof Block>) {
  const q = useInsights(props.app, props.rel);
  if (!q.data?.insights.some((i) => i.state === 'ready' && !props.exclude?.includes(i.key))) return null;
  return (
    <Suspense fallback={null}>
      <Block {...props} />
    </Suspense>
  );
}

/** Daily's Habits section, fetched the same way: its code downloads only when there is a good or bad habit to list. */
export function HabitsSlot(props: ComponentProps<typeof Habits>) {
  const q = useInsights(props.app);
  if (!q.data?.insights.some((i) => i.state === 'ready' && i.key === 'habit-tie')) return null;
  return (
    <Suspense fallback={null}>
      <Habits {...props} />
    </Suspense>
  );
}
