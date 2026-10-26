import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FeedFilter, FeedSort, LeaderboardSort, LogKind, RelationshipKey } from '@kreators/shared';
import { api } from './api';
import { useSession } from './store';
import { todayLocal } from './date';

export const keys = {
  me: ['me'] as const,
  nodes: (relationship: RelationshipKey) => ['nodes', relationship] as const,
  today: (date: string) => ['today', date] as const,
  leaderboard: (by: LeaderboardSort) => ['leaderboard', by] as const,
  rewards: ['rewards'] as const,
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

export function useToday() {
  const date = todayLocal();
  return { date, ...useAuthed(keys.today(date), () => api.today(date)) };
}

export function useLeaderboard(by: LeaderboardSort) {
  return useAuthed(keys.leaderboard(by), () => api.leaderboard(by));
}

export function useRewards() {
  return useAuthed(keys.rewards, api.rewards);
}

export const useWellbeing = () => useAuthed(['wellbeing'], api.wellbeing);
export const useLogs = (kind: LogKind, days = 30) => useAuthed(['logs', kind, days], () => api.logs(kind, days));
export const useJournal = (pq = '') => useAuthed(['journal', pq], () => api.journal(pq));
export const useCompanion = () => useAuthed(['companion'], api.companion);
export const useInbox = (pq = '') => useAuthed(['inbox', pq], () => api.inbox(pq));
export const useResources = (tag?: string, pq = '') => useAuthed(['resources', tag ?? '', pq], () => api.resources(tag, pq));
export const useCommunity = (category?: string, product?: string, all = false, sort: FeedSort = 'recent', filter: FeedFilter = 'all', pq = '') => useAuthed(['community', category ?? '', product ?? '', all, sort, filter, pq], () => api.community(category, product, all, sort, filter, pq));
export const useStudio = () => useAuthed(['studio'], api.studio);
export const useLibrary = (pq = '') => useAuthed(['library', pq], () => api.library(pq));

/** After anything that changes XP, refresh every screen's data. */
export function useRefreshAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}
