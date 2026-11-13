import type { InboxShow, InboxTab, TaskTab, TodayResponse } from '@kreators/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FeedFilter, FeedSort, LeaderboardScope, LeaderboardSort, LogKind, RelationshipKey } from '@kreators/shared';
import { api } from './api';
import { useSession } from './store';
import { todayLocal } from './date';

export const keys = {
  me: ['me'] as const,
  nodes: (relationship: RelationshipKey) => ['nodes', relationship] as const,
  today: (date: string) => ['today', date] as const,
  leaderboard: (by: LeaderboardSort, scope: LeaderboardScope, value: string, paging: string) => ['leaderboard', by, scope, value, paging] as const,
  rewards: ['rewards'] as const,
  cards: ['cards'] as const,
  discover: ['discover'] as const,
  discoverMore: ['discover', 'more'] as const,
};

/** A query that only runs once there is a session. */
export function useAuthed<T>(key: readonly unknown[], fn: () => Promise<T>, enabled = true) {
  const token = useSession((s) => s.token);
  return useQuery({ queryKey: key, queryFn: fn, enabled: Boolean(token) && enabled });
}

export function useMe() {
  return useAuthed(keys.me, api.me);
}

export function useNodes(relationship: RelationshipKey) {
  return useAuthed(keys.nodes(relationship), () => api.nodes(relationship));
}

/**
 * Daily's day. With an area (Daily's Area filter) the server cuts the lists to it, and `group` reads the longer list Daily's coloured boxes
 * need; each is kept under its own key beneath `keys.today(date)`, so invalidating the day refreshes them all.
 */
export function useToday(area = '', opts: { group?: boolean; sort?: string; open?: string; tab?: TaskTab | ''; tags?: string } = {}) {
  const date = todayLocal();
  const token = useSession((s) => s.token);
  const group = opts.group === true;
  // The sort the person picked (none: the server's own default), so the six shown are the top six of it.
  const sort = group ? '' : (opts.sort ?? '');
  // The Unfinished business view's cut ('any'), on the server like the area.
  const open = opts.open ?? '';
  // Daily's tab (2026-11-12): the Today tab's cut unless asked otherwise, so Daily and the not to do list share one answer; '' (the
  // Bottlenecks view) sends none, since the tabs never cut it.
  const tab = opts.tab ?? 'today';
  // The tags a person tapped (2026-11-13), cut on the server like the area.
  const tags = opts.tags ?? '';
  // Changing a filter keeps the last answer on screen (filtered on the device) until the new one lands, never the loading cards.
  const q = useQuery<TodayResponse>({ queryKey: [...keys.today(date), area, group ? 'group' : '', sort, open, tab, tags], queryFn: () => api.today(date, area, { group, sort, open, tab: tab || undefined, tags }), enabled: Boolean(token), placeholderData: (prev) => (prev?.date === date ? prev : undefined) });
  return { date, ...q };
}

export function useLeaderboard(by: LeaderboardSort, scope: LeaderboardScope = 'all', value = '', paging = '') {
  return useAuthed(keys.leaderboard(by, scope, value, paging), () => api.leaderboard(by, scope, value, paging), scope === 'all' || Boolean(value));
}

export const useDiscover = () => useAuthed(keys.discover, api.discover);
export const useDiscoverMore = () => useAuthed(keys.discoverMore, api.discoverMore);
export const useCardGames = () => useAuthed(keys.cards, api.cardGames);
export const useCardGame = (key: string) => useAuthed([...keys.cards, key] as const, () => api.cardGame(key), Boolean(key));

export function useRewards(pq = '') {
  return useAuthed([...keys.rewards, pq], () => api.rewards(pq));
}

export const useWellbeing = () => useAuthed(['wellbeing'], api.wellbeing);
export const useLogs = (kind: LogKind, days = 30) => useAuthed(['logs', kind, days], () => api.logs(kind, days));
export const useJournal = (pq = '') => useAuthed(['journal', pq], () => api.journal(pq));
export const useCompanion = () => useAuthed(['companion'], api.companion);
export const useInbox = (pq = '', tab: InboxTab = 'all', show: InboxShow = 'inbox') => useAuthed(['inbox', pq, tab, show], () => api.inbox(pq, tab, show));
export const useResources = (tag?: string, pq = '') => useAuthed(['resources', tag ?? '', pq], () => api.resources(tag, pq));
export const useCommunity = (category?: string, product?: string, all = false, sort: FeedSort = 'recent', filter: FeedFilter = 'all', pq = '') => useAuthed(['community', category ?? '', product ?? '', all, sort, filter, pq], () => api.community(category, product, all, sort, filter, pq));
export const useStudio = () => useAuthed(['studio'], api.studio);
export const useLibrary = (pq = '') => useAuthed(['library', pq], () => api.library(pq));

/**
 * After anything that changes XP, refresh every screen's data. Emerging is the exception (2026-11-05): it rebuilds weeks of rows, so a
 * plain tick only marks it stale and it is read again the next time a screen with it opens. A write that changes what an Emerging card
 * offers (a task's repeat, habit, title, day or place, a new task, a not to do item added or removed) passes `{ insights: true }`, or
 * calls `useRefreshInsights`, so the card on screen is read again at once and never offers what was just done.
 */
export function useRefreshAll(opts: { insights?: boolean } = {}) {
  const qc = useQueryClient();
  const insights = opts.insights === true;
  return () =>
    Promise.all([
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'insights' }),
      qc.invalidateQueries({ queryKey: ['insights'], refetchType: insights ? 'active' : 'none' }),
    ]).then(() => undefined);
}

/** Read Emerging again now (the active screens only), for a write that changes what its cards offer. */
export function useRefreshInsights() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['insights'] });
}
