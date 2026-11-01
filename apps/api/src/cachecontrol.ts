import type { MiddlewareHandler } from 'hono';

/**
 * Cache-Control, in one place.
 *
 * - `public`: anonymous JSON that is the same for everyone (explore lists, stats, a public listing). A minute in the browser,
 *   five at a shared cache, and a stale copy may be served for ten while a fresh one is fetched.
 * - `immutable`: a file whose bytes never change for its id (uploaded pictures). A year, never revalidated.
 * - `none`: anything that belongs to one person or can change under them. Never kept by the browser or a proxy.
 *
 * Only 200 answers to GET and HEAD are marked public or immutable; an error is never kept. A route that already sets its
 * own Cache-Control keeps it. Never put `public` on an answer that differs by viewer, by Authorization or by cookie.
 */
export type CacheKind = 'public' | 'immutable' | 'none';

export const CACHE_CONTROL: Record<CacheKind, string> = {
  public: 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
  immutable: 'public, max-age=31536000, immutable',
  none: 'private, no-store',
};

interface Options {
  /**
   * `public` only: also keep the answer in this data centre's Workers cache for this many seconds, so a burst of anonymous
   * readers costs one database read. Skipped for any request that carries Authorization or a cookie.
   */
  edgeSeconds?: number;
}

export function cache(kind: CacheKind, opts: Options = {}): MiddlewareHandler {
  return async (c, next) => {
    if (kind === 'none') {
      await next();
      c.header('Cache-Control', CACHE_CONTROL.none);
      return;
    }
    const readOnly = c.req.method === 'GET' || c.req.method === 'HEAD';
    if (!readOnly) return next();

    // The Workers cache is the one place a shared copy is made by us, so it is the one place that checks who is asking.
    const store = kind === 'public' && opts.edgeSeconds && !c.req.header('Authorization') && !c.req.header('Cookie') ? (globalThis as { caches?: { default?: Cache } }).caches?.default : undefined;
    const key = store ? new Request(c.req.url, { method: 'GET' }) : null;
    if (store && key) {
      const hit = await store.match(key).catch(() => undefined);
      if (hit) {
        const fromCache = new Response(hit.body, hit);
        fromCache.headers.set('Cache-Control', CACHE_CONTROL.public);
        fromCache.headers.set('X-Edge-Cache', 'hit');
        return fromCache;
      }
    }

    await next();

    if (c.res.status !== 200) {
      c.header('Cache-Control', 'no-store');
      return;
    }
    if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', CACHE_CONTROL[kind]);
    if (store && key && c.req.method === 'GET' && !c.res.headers.has('Set-Cookie')) {
      const copy = new Response(c.res.clone().body, c.res);
      copy.headers.set('Cache-Control', `public, s-maxage=${opts.edgeSeconds}`);
      try {
        c.executionCtx.waitUntil(store.put(key, copy).catch(() => undefined));
      } catch {
        // No execution context (a test harness): nothing is kept, the answer is still right.
      }
    }
  };
}
