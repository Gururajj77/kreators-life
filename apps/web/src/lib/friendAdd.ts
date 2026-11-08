/**
 * A QR code's link (`/u/<handle>?add=<friend code>`) opened signed out, kept for this tab only (sessionStorage, never localStorage or a
 * cookie) while the person signs in or goes through the setup chat, so they come back to the same Add friend card. Shell reads it on
 * every signed-in page, like the coach's invite link (lib/coachJoin.ts), so this file stays a few lines.
 */
const KEY = 'kreators.friendAdd';

/** Builds the link a QR code holds. The handle and code go in as they are, encoded. */
export const friendAddPath = (handle: string, code: string): string => `/u/${encodeURIComponent(handle)}?add=${encodeURIComponent(code)}`;

export function friendAddKept(): string | null {
  try {
    const kept = sessionStorage.getItem(KEY);
    // Only a person's page on this site, never another path.
    return kept && /^\/u\/[^/?#]+\?add=[A-Za-z0-9%]+$/.test(kept) ? kept : null;
  } catch {
    return null;
  }
}

export function keepFriendAdd(path: string | null): void {
  try {
    if (path) sessionStorage.setItem(KEY, path);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Not kept: they scan the code again after signing in.
  }
}
