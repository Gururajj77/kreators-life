import { Suspense, useState, type ComponentProps } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatCount, insightsForPlace, type InsightApp, type InsightsResponse, type RelationshipKey } from '@kreators/shared';
import { api } from '../lib/api';
import { useSession } from '../lib/store';
import { useMe } from '../lib/queries';
import { todayLocal } from '../lib/date';
import { lazyNamed } from '../lib/lazy';
import { Section, SeeAll } from './Section';
import { useHiddenInsightIds } from '../lib/insightsHidden';
import { Skeleton } from './Skeleton';

/**
 * The one Emerging query (2026-11-05): keyed by the device's day only, so Home, Daily, Pillars, each pillar page and every app screen
 * share one answer, the person's whole list, and each picks its own share with `insightsForPlace` (the same rule the server used per
 * place). An ordinary write marks it stale without refetching it (`useRefreshAll`); the Make it a habit and not to do sheets refetch it.
 */
export function useInsights(app: InsightApp, rel?: RelationshipKey | null, on = true) {
  const token = useSession((s) => s.token);
  const day = todayLocal();
  return useQuery({
    queryKey: ['insights', day],
    queryFn: () => api.insights(day),
    enabled: Boolean(token) && on,
    staleTime: 5 * 60 * 1000,
    // A write marks it stale, and reading it again visits two months of the person's rows (about 2,400 for three months of use), so after a write it waits a quarter of an hour.
    refetchOnMount: (q) => Date.now() - q.state.dataUpdatedAt > INSIGHTS_REST_MS,
    refetchOnWindowFocus: (q) => Date.now() - q.state.dataUpdatedAt > INSIGHTS_REST_MS,
    select: (d: InsightsResponse): InsightsResponse => ({ day: d.day, insights: insightsForPlace(d.insights, app, rel ?? null) }),
  });
}

const INSIGHTS_REST_MS = 15 * 60 * 1000;

const Block = lazyNamed(() => import('./Emergence'), 'EmergenceBlock');
const Habits = lazyNamed(() => import('./Emergence'), 'HabitsBlock');
const Kinds = lazyNamed(() => import('./Emergence'), 'KindsBlock');
// Home only, beside the block (see EmergenceWatch.tsx); its own small chunk so the first download stays in budget.
const EmptyWatch = lazyNamed(() => import('./EmergenceWatch'), 'EmptyWatch');

/**
 * The Emerging block for a screen in the first download (Home, Daily): the patterns are asked for first, and the block's own code is
 * fetched only when there is something ready to show, so a screen with nothing to say downloads nothing more.
 */
export function EmergenceSlot({ always = false, paired = false, ...props }: ComponentProps<typeof Block> & { /** Home and Life (2026-11-06): with nothing ready, a light section says how many patterns are forming, so the way to Emerging is always there. */ always?: boolean; /** Home's half beside Your pillars (2026-11-13): it keeps its half while it loads, and its quiet line sits in a card under a lede like its pair's. */ paired?: boolean }) {
  const q = useInsights(props.app, props.rel);
  // The whole list (the same query, shared cache) for the forming count; only read when `always` is set.
  const every = useInsights('insights');
  const me = useMe();
  // Bumped by `EmptyWatch` when Home's block empties itself, so the set-aside ids below are read again.
  const [, recheck] = useState(0);
  // With `always`, a card set aside with Not now (kept on the device, lib/insightsHidden.ts, the same store the blocks write) does not
  // count as ready here, so a Home whose every ready card was set aside shows the light section rather than a block that draws nothing.
  const [aside] = useHiddenInsightIds(me.data?.user.id);
  const hidden = always ? aside : null;
  // Home's half holds its place while the patterns or the block's code load (review 2026-11-13: the pillars took the whole row, then
  // snapped to a half), so the row never jumps.
  const holding = paired ? (
    <Section id={`emerging-${props.app}`} title="Emerging" span className={props.className} lede="Patterns in what you log." action={<SeeAll to="/insights">See all</SeeAll>}>
      <Skeleton className="h-[220px] rounded-card" />
    </Section>
  ) : null;
  if (!q.data?.insights.some((i) => i.state === 'ready' && !props.exclude?.includes(i.key) && !hidden?.has(i.id))) {
    if (!always) return null;
    if (!every.data) return holding;
    const forming = every.data.insights.filter((i) => i.state === 'watching').length;
    // Patterns found that touch other apps, not this screen: said as found, never as "nothing clear".
    const found = every.data.insights.filter((i) => i.state === 'ready' && !hidden?.has(i.id)).length;
    const plural = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;
    const line = found > 0 ? `${plural(found, 'pattern', 'patterns')} found in your apps${forming > 0 ? `, ${formatCount(forming)} still forming` : ''}.` : forming > 0 ? `Nothing clear yet. ${plural(forming, 'pattern is', 'patterns are')} forming.` : 'Patterns show up here as you log.';
    return (
      <Section id={`emerging-${props.app}`} title="Emerging" span className={props.className} lede={paired ? 'Patterns in what you log.' : undefined} action={<SeeAll to="/insights">See all</SeeAll>}>
        {paired ? (
          // Beside the pillars' card, the line sits in a card of its own that fills the half (review 2026-11-13), in the middle of it.
          <div className="flex flex-col justify-center rounded-card bg-card p-md">
            <p className="m-0 text-balance text-subhead text-ink-soft">{line}</p>
          </div>
        ) : (
          <p className="m-0 text-balance text-subhead text-ink-soft">{line}</p>
        )}
      </Section>
    );
  }
  return (
    <Suspense fallback={holding}>
      <Block {...props} quietWhenAllAside={always} />
      {always && <EmptyWatch id={`emerging-${props.app}${props.rel ? `-${props.rel}` : ''}`} onEmpty={recheck} />}
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

/** Your kinds of day (2026-11-06), on Daily, the Time blocks page and Reviews: its code downloads only when the card is ready. */
export function KindsSlot(props: ComponentProps<typeof Kinds>) {
  const q = useInsights('insights');
  if (!q.data?.insights.some((i) => i.state === 'ready' && i.key === 'daytype-done')) return null;
  return (
    <Suspense fallback={null}>
      <Kinds {...props} />
    </Suspense>
  );
}
