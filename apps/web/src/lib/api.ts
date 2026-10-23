import type {
  AdminRedemption,
  AdminUser,
  CheckinResponse,
  CompleteResponse,
  LeaderboardResponse,
  LeaderboardSort,
  MeResponse,
  Node,
  NodeKind,
  OnboardingAnswer,
  OnboardingResponse,
  Redemption,
  RelationshipKey,
  RewardsResponse,
  TodayResponse,
  User,
} from '@kreators/shared';
import { useSession } from './store';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useSession.getState().token;
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401) useSession.getState().setToken(null);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error ?? res.statusText, res.status);
  }
  return (await res.json()) as T;
}

export const api = {
  anon: () => request<{ token: string; user: User }>('/auth/anon', { method: 'POST' }),
  me: () => request<MeResponse>('/me'),
  updateMe: (body: { displayName?: string; creatorType?: string; leaderboardOptIn?: boolean }) =>
    request<{ user: User }>('/me', { method: 'PATCH', body: JSON.stringify(body) }),
  reset: () => request<{ ok: true }>('/me/reset', { method: 'POST' }),

  onboard: (body: { answers: OnboardingAnswer[]; displayName?: string; creatorType?: string }) =>
    request<OnboardingResponse>('/onboarding', { method: 'POST', body: JSON.stringify(body) }),
  build: (relationships: RelationshipKey[], date: string) =>
    request<{ nodes: Node[]; skipped: RelationshipKey[] }>('/onboarding/build', { method: 'POST', body: JSON.stringify({ relationships, date }) }),
  acceptQuest: (relationship: RelationshipKey, date: string) =>
    request<{ nodes: Node[] }>('/onboarding/accept-quest', { method: 'POST', body: JSON.stringify({ relationship, date }) }),

  nodes: (relationship?: RelationshipKey) =>
    request<{ nodes: Node[] }>(`/nodes${relationship ? `?relationship=${relationship}` : ''}`),
  createNode: (body: { kind: NodeKind; parentId: string | null; relationship: RelationshipKey; title: string; note?: string; dueDate?: string | null }) =>
    request<{ node: Node }>('/nodes', { method: 'POST', body: JSON.stringify(body) }),
  updateNode: (id: string, body: { title?: string; note?: string; dueDate?: string | null; status?: 'active' | 'archived' }) =>
    request<{ node: Node }>(`/nodes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteNode: (id: string) => request<{ ok: true }>(`/nodes/${id}`, { method: 'DELETE' }),
  complete: (id: string) => request<CompleteResponse>(`/nodes/${id}/complete`, { method: 'POST' }),
  uncomplete: (id: string) => request<{ node: Node }>(`/nodes/${id}/uncomplete`, { method: 'POST' }),

  leaderboard: (by: LeaderboardSort) => request<LeaderboardResponse>(`/leaderboard?by=${by}`),
  rewards: () => request<RewardsResponse>('/rewards'),
  redeem: (key: string) => request<{ redemption: Redemption; points: number }>(`/rewards/${key}/redeem`, { method: 'POST' }),
  cancelRedemption: (id: string) => request<{ ok: true; points: number }>(`/rewards/redemptions/${id}/cancel`, { method: 'POST' }),

  today: (date: string) => request<TodayResponse>(`/today?date=${date}`),
  checkin: (date: string) => request<CheckinResponse>('/today/checkin', { method: 'POST', body: JSON.stringify({ date }) }),
  spark: (date: string) =>
    request<{ awarded: number; relationship: RelationshipKey; alreadyDone: boolean }>('/today/spark', {
      method: 'POST',
      body: JSON.stringify({ date }),
    }),
};

/** Admin calls use a shared key instead of the device session. */
async function adminRequest<T>(key: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error ?? res.statusText, res.status);
  }
  return (await res.json()) as T;
}

export const adminApi = {
  users: (key: string, q: string) => adminRequest<{ users: AdminUser[] }>(key, `/users?q=${encodeURIComponent(q)}`),
  setPro: (key: string, id: string, pro: boolean) =>
    adminRequest<{ user: AdminUser }>(key, `/users/${id}/pro`, { method: 'POST', body: JSON.stringify({ pro }) }),
  grantHonor: (key: string, id: string, honor: string, note: string) =>
    adminRequest<{ user: AdminUser }>(key, `/users/${id}/honors`, { method: 'POST', body: JSON.stringify({ key: honor, note }) }),
  revokeHonor: (key: string, id: string, honor: string) => adminRequest<{ user: AdminUser }>(key, `/users/${id}/honors/${honor}`, { method: 'DELETE' }),
  addPoints: (key: string, id: string, amount: number, note: string) =>
    adminRequest<{ user: AdminUser }>(key, `/users/${id}/points`, { method: 'POST', body: JSON.stringify({ amount, note }) }),
  redemptions: (key: string, status?: string) =>
    adminRequest<{ redemptions: AdminRedemption[] }>(key, `/redemptions${status ? `?status=${status}` : ''}`),
  setRedemption: (key: string, id: string, status: 'fulfilled' | 'cancelled') =>
    adminRequest<{ redemption: Redemption }>(key, `/redemptions/${id}`, { method: 'POST', body: JSON.stringify({ status }) }),
};
