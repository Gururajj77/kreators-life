/**
 * The token of a coach's invite link, kept for this tab only (sessionStorage, never localStorage or a cookie) while someone signs in or goes
 * through the setup chat, so they come back to the same card. Shell reads it on every signed-in page, so this file stays a few lines.
 */
const KEY = 'kreators.coachJoin';

export function coachJoinKept(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function keepCoachJoin(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Not kept: they open the link again after signing in.
  }
}
