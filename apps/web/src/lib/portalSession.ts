/**
 * The unlock of a client link that has a password. The server gives a random token for twelve hours; it lives in sessionStorage only, so it
 * goes when the tab closes, and is never a cookie and never in localStorage. Every call to a client link, an agreement link or an invoice link
 * sends the live ones in `X-Portal-Session` (up to five, newest last). Nothing here is read by anything else on the site.
 */
const KEY = 'kreators.portal.sessions';
const MAX = 5;

interface Kept {
  token: string;
  until: number;
}

function read(): Kept[] {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    const now = Date.now();
    return raw.filter((k): k is Kept => Boolean(k) && typeof (k as Kept).token === 'string' && /^[0-9a-f]{64}$/.test((k as Kept).token) && typeof (k as Kept).until === 'number' && (k as Kept).until > now).slice(-MAX);
  } catch {
    return [];
  }
}

function write(list: Kept[]): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    // Storage blocked: the unlock lasts for the page and the person types the password again after a reload.
    memory = list.slice(-MAX);
  }
}
let memory: Kept[] = [];

/** Keeps a session the server just gave. `expiresAt` is its ISO time. */
export function keepPortalSession(token: string, expiresAt: string | null): void {
  const until = expiresAt ? Date.parse(expiresAt) : Date.now() + 12 * 3_600_000;
  const list = [...read(), ...memory].filter((k) => k.token !== token);
  write([...list, { token, until: Number.isFinite(until) ? until : Date.now() + 12 * 3_600_000 }]);
}

/** The header value: the live tokens, comma separated, or an empty string. */
export function portalSessionHeader(): string {
  return [...read(), ...memory.filter((k) => k.until > Date.now())].map((k) => k.token).slice(-MAX).join(',');
}

/** Forgets every kept session (a locked answer came back, so they are no good). */
export function forgetPortalSessions(): void {
  memory = [];
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // nothing kept
  }
}
