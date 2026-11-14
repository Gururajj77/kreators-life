/**
 * How a tool reaches the app: it calls the same API route a screen would, inside the Worker, with the person's own
 * session token. So the session check, the module switches, the rate limits, the waits, the xp caps and the
 * owner filters all apply to the assistant exactly as they do to a tap. Nothing here can name another person:
 * the user comes from the token, never from the model.
 */

export type Fetcher = (req: Request) => Promise<Response>;

export interface Req {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** A path under /api, with its query string. */
  path: string;
  body?: unknown;
}

export interface Answer {
  status: number;
  ok: boolean;
  // The routes answer with JSON shaped by each route; tools read the parts they need.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

/** A failure to say back to the person in plain words. */
export class ToolError extends Error {}

const SEG = /^[A-Za-z0-9_-]{1,80}$/;

/** One path segment from a value the model chose: an id, never a slash, a dot or anything that moves the path. */
export function seg(v: unknown): string {
  if (typeof v !== 'string' || !SEG.test(v)) throw new ToolError('That id does not look right. Look it up again with a read tool.');
  return v;
}

/**
 * The requests All tables' own doors made, inside this Worker (2026-11-14). A header anyone can send, so the `X-Kreators-Via: tables` mark only
 * says who called; the limiter swaps `prefs` for `tablesRows` (VIA_TABLES) only for a Request object in this set, which no client can reach.
 */
export const tablesCalls = new WeakSet<Request>();

/** A caller bound to one person's session. `via` names who is calling in the X-Kreators-Via header: the assistant, or All tables (2026-11-13). */
export function caller(fetcher: Fetcher, token: string, via: 'assistant' | 'tables' = 'assistant'): (req: Req) => Promise<Answer> {
  return async (req) => {
    const url = new URL(`http://internal/api${req.path}`);
    // The path must arrive as written: anything the URL parser had to tidy (a dot segment, a stray slash) is refused.
    if (url.pathname !== `/api${req.path.split('?')[0]}`) throw new ToolError('That path is not allowed.');
    const request = new Request(url, {
      method: req.method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Kreators-Via': via },
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
    });
    if (via === 'tables') tablesCalls.add(request);
    const res = await fetcher(request);
    const data = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data };
  };
}

/** The answer's data, or the route's own error said back plainly. */
export function must(a: Answer) {
  if (a.ok) return a.data;
  const said = typeof a.data?.error === 'string' ? a.data.error : '';
  if (a.status === 403) throw new ToolError(said || 'That app is switched off on this account.');
  if (a.status === 404) throw new ToolError(said === 'not found' || !said ? 'Could not find that. It may be gone, or not yours.' : said);
  if (a.status === 429 && /too many/.test(said)) throw new ToolError('That was done too often just now. Wait a minute and try again.');
  throw new ToolError(said || `That did not work (${a.status}).`);
}
