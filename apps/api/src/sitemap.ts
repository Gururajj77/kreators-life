import { SITE_PAGES } from '@kreators/shared/siteMeta';

/**
 * The words of /sitemap.xml (served by routes/go.ts). One `<urlset>`, every address on the production origin (`siteUrl(PUBLIC_URL)`), never the
 * request's host: the stable pages from `SITE_PAGES` in @kreators/shared/siteMeta (the same list the build writes pages for, so an app page
 * that is not on the site, like Dev Tools, is never listed), each upcoming public event, and each switched-on public page with a live product.
 */

/** Text made safe inside an XML element. */
export function xmlEscape(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** The stable public pages, in the site's own order. */
export const SITEMAP_PATHS: readonly string[] = SITE_PAGES.map((p) => p.path);

/** One live address in the sitemap: a path on the origin and, when known, the day it last changed (YYYY-MM-DD). */
export interface SitemapEntry {
  path: string;
  lastmod?: string | null;
}

/** The whole sitemap. `origin` has no trailing slash. */
export function sitemapXml(origin: string, live: readonly SitemapEntry[]): string {
  const entries: SitemapEntry[] = [...SITEMAP_PATHS.map((path) => ({ path })), ...live];
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const e of entries) {
    if (seen.has(e.path)) continue;
    seen.add(e.path);
    const day = typeof e.lastmod === 'string' && /^\d{4}-\d{2}-\d{2}/.test(e.lastmod) ? e.lastmod.slice(0, 10) : null;
    lines.push(`  <url><loc>${xmlEscape(origin + e.path)}</loc>${day ? `<lastmod>${day}</lastmod>` : ''}</url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join('\n')}\n</urlset>`;
}
