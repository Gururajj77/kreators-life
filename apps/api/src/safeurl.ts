/**
 * The one guard for any address the Worker is asked to fetch that a person influenced (a research link in Content).
 * It refuses only what is clearly unsafe: not https, a login in the address, an IP number, localhost and internal names,
 * names with no dot and ports other than 443. A normal public https address passes.
 *
 * What it cannot do: look up a name in DNS (a Worker has no resolver of its own), so a public name that points at a private
 * address is not caught here. A Worker cannot reach private networks anyway, so that stays a limit, not a hole.
 */

const BAD_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa', '.intranet', '.corp', '.localdomain'];
// Public names that always answer with the address in them, used to point at 127.0.0.1 and friends.
const WILDCARD_DNS = ['nip.io', 'sslip.io', 'xip.io', 'localtest.me', 'lvh.me', 'traefik.me'];

/** An https address on a public name, or null. */
export function publicHttpsUrl(raw: unknown): URL | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2000) return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== '443') return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return null;
  // IPv6 literals keep their brackets; IPv4 literals (also decimal, octal and hex forms) are written out as four numbers by the URL parser.
  if (host.startsWith('[') || host.includes(':')) return null;
  const labels = host.split('.');
  if (labels.length < 2) return null;
  const last = labels[labels.length - 1] ?? '';
  if (/^\d+$/.test(last) || /^0x[0-9a-f]+$/i.test(last)) return null;
  if (host === 'localhost' || host === 'metadata.google.internal') return null;
  if (BAD_SUFFIXES.some((s) => host.endsWith(s))) return null;
  if (WILDCARD_DNS.some((d) => host === d || host.endsWith(`.${d}`))) return null;
  return u;
}

export class UnsafeUrlError extends Error {
  constructor(message = 'That address is not a public https address.') {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

export interface SafeFetchLimits {
  timeoutMs?: number;
  maxBytes?: number;
}

const MAX_HOPS = 3;

/**
 * fetch for an address a person gave: checks it, follows at most three redirects by hand (each hop checked again), stops after
 * a time limit and keeps at most `maxBytes` of the body. Throws UnsafeUrlError for an unsafe address or a bad redirect.
 * The returned Response holds the (possibly cut) body; `x-body-truncated: 1` says it was cut.
 */
export async function safeFetch(raw: string, init: RequestInit = {}, limits: SafeFetchLimits = {}): Promise<Response> {
  const timeoutMs = limits.timeoutMs ?? 10_000;
  const maxBytes = limits.maxBytes ?? 1_000_000;
  let url = publicHttpsUrl(raw);
  if (!url) throw new UnsafeUrlError();
  const signal = AbortSignal.timeout(timeoutMs);
  for (let hop = 0; ; hop += 1) {
    const res = await fetch(url.toString(), { ...init, redirect: 'manual', signal });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      if (hop >= MAX_HOPS) throw new UnsafeUrlError('That address redirects too many times.');
      let next: URL | null = null;
      try {
        next = publicHttpsUrl(new URL(res.headers.get('location') ?? '', url).toString());
      } catch {
        next = null;
      }
      if (!next) throw new UnsafeUrlError('That address redirects somewhere that is not a public https address.');
      url = next;
      continue;
    }
    return capBody(res, maxBytes);
  }
}

async function capBody(res: Response, maxBytes: number): Promise<Response> {
  if (!res.body) return res;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let cut = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      chunks.push(value.subarray(0, value.byteLength - (total - maxBytes)));
      cut = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(Math.min(total, maxBytes));
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  if (cut) headers.set('x-body-truncated', '1');
  return new Response(bytes, { status: res.status, statusText: res.statusText, headers });
}
