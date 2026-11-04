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
  /** The link it was unlocked at ("agency:<token>", "contracts:<token>"), so a locked answer there forgets only that one. */
  link?: string;
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

/** Keeps a session the server just gave. `expiresAt` is its ISO time; `link` is the link it was unlocked at. */
export function keepPortalSession(token: string, expiresAt: string | null, link?: string): void {
  const until = expiresAt ? Date.parse(expiresAt) : Date.now() + 12 * 3_600_000;
  const list = [...read(), ...memory].filter((k) => k.token !== token);
  write([...list, { token, until: Number.isFinite(until) ? until : Date.now() + 12 * 3_600_000, ...(link ? { link } : {}) }]);
}

/** The header value: the live tokens, comma separated, or an empty string. */
export function portalSessionHeader(): string {
  return [...read(), ...memory.filter((k) => k.until > Date.now())].map((k) => k.token).slice(-MAX).join(',');
}

/**
 * Forgets the sessions kept for one link, because a locked answer came back there (twelve hours passed, or the password changed). The
 * sessions of other clients' links stay; an expired one drops out by itself when it is read.
 */
export function forgetPortalSessions(link: string): void {
  memory = memory.filter((k) => k.link !== link);
  write(read().filter((k) => k.link !== link));
}

/** Whether this tab still keeps a session for a link: read before `forgetPortalSessions`, so a lock screen that came back can say why. */
export function hadPortalSession(link: string): boolean {
  return [...readAll(), ...memory].some((k) => k.link === link);
}

/** Every kept entry, expired or not, so a session that just ran out still counts as one the tab had. */
function readAll(): Kept[] {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((k): k is Kept => Boolean(k) && typeof (k as Kept).token === 'string') : [];
  } catch {
    return [];
  }
}

// ---- the team link's own unlock (2026-11-04)

/**
 * The team link (`/t/<token>`, the client page for the client's own team) keeps its unlock apart, under its own key, and sends it only to
 * the team link's own routes in `X-Team-Link-Session`. It is never sent to a client link or any paper, and the server refuses it there.
 */
const TEAM_KEY = 'kreators.teamLink.sessions';
let teamMemory: Kept[] = [];

function readTeam(): Kept[] {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(TEAM_KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    const now = Date.now();
    return raw.filter((k): k is Kept => Boolean(k) && typeof (k as Kept).token === 'string' && /^[0-9a-f]{64}$/.test((k as Kept).token) && typeof (k as Kept).until === 'number' && (k as Kept).until > now).slice(-MAX);
  } catch {
    return [];
  }
}

function writeTeam(list: Kept[]): void {
  try {
    window.sessionStorage.setItem(TEAM_KEY, JSON.stringify(list.slice(-MAX)));
  } catch {
    teamMemory = list.slice(-MAX);
  }
}

export function keepTeamLinkSession(token: string, expiresAt: string | null, link?: string): void {
  const until = expiresAt ? Date.parse(expiresAt) : Date.now() + 12 * 3_600_000;
  const list = [...readTeam(), ...teamMemory].filter((k) => k.token !== token);
  writeTeam([...list, { token, until: Number.isFinite(until) ? until : Date.now() + 12 * 3_600_000, ...(link ? { link } : {}) }]);
}

export function teamLinkSessionHeader(): string {
  return [...readTeam(), ...teamMemory.filter((k) => k.until > Date.now())].map((k) => k.token).slice(-MAX).join(',');
}

export function forgetTeamLinkSessions(link: string): void {
  teamMemory = teamMemory.filter((k) => k.link !== link);
  writeTeam(readTeam().filter((k) => k.link !== link));
}

export function hadTeamLinkSession(link: string): boolean {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(TEAM_KEY) ?? '[]') as unknown;
    const all = Array.isArray(raw) ? raw.filter((k): k is Kept => Boolean(k) && typeof (k as Kept).token === 'string') : [];
    return [...all, ...teamMemory].some((k) => k.link === link);
  } catch {
    return teamMemory.some((k) => k.link === link);
  }
}
