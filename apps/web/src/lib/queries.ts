import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { LeaderboardSort, RelationshipKey } from '@kreators/shared';
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

export function useMe() {
  const token = useSession((s) => s.token);
  return useQuery({ queryKey: keys.me, queryFn: api.me, enabled: Boolean(token) });
}

export function useNodes(relationship: RelationshipKey) {
  const token = useSession((s) => s.token);
  return useQuery({ queryKey: keys.nodes(relationship), queryFn: () => api.nodes(relationship), enabled: Boolean(token) });
}

export function useToday() {
  const token = useSession((s) => s.token);
  const date = todayLocal();
  return { date, ...useQuery({ queryKey: keys.today(date), queryFn: () => api.today(date), enabled: Boolean(token) }) };
}

export function useLeaderboard(by: LeaderboardSort) {
  const token = useSession((s) => s.token);
  return useQuery({ queryKey: keys.leaderboard(by), queryFn: () => api.leaderboard(by), enabled: Boolean(token) });
}

export function useRewards() {
  const token = useSession((s) => s.token);
  return useQuery({ queryKey: keys.rewards, queryFn: api.rewards, enabled: Boolean(token) });
}

/** After anything that changes XP, refresh every screen's data. */
export function useRefreshAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}
