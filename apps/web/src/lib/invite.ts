import { lazyNamed } from './lazy';

/**
 * The invite code someone arrived with (`/join/<code>`, or typed at the gate), kept for this tab only (sessionStorage, never localStorage or a
 * cookie, like lib/friendAdd.ts) until it makes their account. Welcome sends it with the device session; signing in or making the account
 * clears it. The server checks it again every time, so a stale one is only refused and the gate shows again.
 */
const KEY = 'kreators.invite';

export function keptInvite(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function keepInvite(code: string | null): void {
  try {
    if (code) sessionStorage.setItem(KEY, code);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Not kept: they type the code again.
  }
}

/** The reason /auth/anon or /auth/signup refused a new account for want of a working invite code (403), else null. */
export const inviteRefusal = (e: unknown): string | null => {
  const x = e as { status?: number; data?: { reason?: string } } | null;
  return x?.status === 403 && x.data?.reason?.startsWith('invite') ? x.data.reason : null;
};

/** The gate (Welcome) or the code field alone (the sign-up page), one lazy chunk for both so the first download carries one reference. */
export const InviteDoor = lazyNamed(() => import('../components/InviteGate'), 'InviteDoor');
