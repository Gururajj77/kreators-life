import { useEffect, useState } from 'react';

type SiteMeta = typeof import('@kreators/shared/siteMeta');

/** The production origin, set by vite.config.ts from SITE_URL (else https://kreators.app), so a canonical never names a preview host. */
declare const __SITE_URL__: string;

/** What the shell (index.html) says before a page sets its own; put back when a site page leaves, so an app screen never keeps its words. */
const SHELL_TITLE = 'kreators.app';
const SHELL_DESCRIPTION =
  'kreators.app: grow your work without losing your life. A daily game for the seven relationships that make a life, with the tools a creator needs built in. One small act a day, for all seven. Free to start, free to stay.';

let loading: Promise<SiteMeta> | null = null;
let loaded: SiteMeta | null = null;

/** The site's words, fetched once (a failed fetch is tried again on the next ask). */
export function loadSiteMeta(): Promise<SiteMeta> {
  loading ??= import('@kreators/shared/siteMeta').then(
    (m) => (loaded = m),
    (err: unknown) => {
      loading = null;
      throw err;
    },
  );
  return loading;
}

/** The site's words once they are in (null until then), for a page that draws some of them, like the home's fair questions. */
export function useSiteMeta(): SiteMeta | null {
  const [m, setM] = useState<SiteMeta | null>(loaded);
  useEffect(() => {
    if (m) return;
    let alive = true;
    let retry: number | undefined;
    const done = (x: SiteMeta) => alive && setM(x);
    // One more try a few seconds after a failed download (a dropped connection); a page that still cannot load it leaves the words out.
    loadSiteMeta().then(done, () => {
      retry = window.setTimeout(() => loadSiteMeta().then(done, () => undefined), 4000);
    });
    return () => {
      alive = false;
      window.clearTimeout(retry);
    };
  }, [m]);
  return m;
}

/**
 * The tab's title, the meta description and the canonical link for a public page, for people browsing (docs/aeo-kit.md, part 8).
 * The words come from `@kreators/shared/siteMeta`, the one list the build-time pages and the Worker read too, loaded with import()
 * so they never enter the entry or the first download (its own chunk, `shared-site-meta`, in vite.config.ts).
 *
 * `path` is the page's own path (`/features/agency`, `/privacy`); a live page the list does not hold (an event, a public page) passes
 * what it knows in `override`: its own title and description, and the path its canonical names. The canonical is always on the production
 * origin (`__SITE_URL__`), never the host the page is open on. On unmount the title and description it set go back to the shell's and its
 * canonical is taken away, so an app screen never keeps a site page's words; a next site page sets its own straight after.
 * A clock that holds the tab's title (FocusRounds) hears the new page title through `PAGE_TITLE_EVENT` and keeps it for when it stops.
 */
export interface PageMetaOverride {
  title?: string;
  description?: string;
  /** The path the canonical link names, with no query, hash or trailing slash. */
  canonical?: string;
}

/** Sent on `window` with the page's title as `detail` each time a page sets its title. */
export const PAGE_TITLE_EVENT = 'kreators:page-title';

const MARK = 'data-page-meta';

/** A path as a canonical names it: no query, no hash, no trailing slash (the root stays `/`). */
function cleanPath(path: string): string {
  let p = path.split(/[?#]/, 1)[0] ?? '';
  if (!p.startsWith('/')) p = `/${p}`;
  return p.length > 1 ? p.replace(/\/+$/, '') || '/' : p;
}

/** A description cut at a word to about 160 characters, the length a result shows. */
export function clipDescription(text: string, max = 160): string {
  const s = text.replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  return `${(at > max / 2 ? cut.slice(0, at) : cut).replace(/[\s,.;:–—-]+$/, '')}…`;
}

/** A page's tab title for a name a person typed: "<name, cut at a word> | kreators.app", at most 60 characters like every site page's. */
export function pageTitle(name: string): string {
  const tail = ' | kreators.app';
  return `${clipDescription(name, 60 - tail.length)}${tail}`;
}

function setTitle(title: string) {
  if (document.title !== title) document.title = title;
  window.dispatchEvent(new CustomEvent(PAGE_TITLE_EVENT, { detail: title }));
}

function setDescription(text: string) {
  let el = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!el) {
    el = document.createElement('meta');
    el.name = 'description';
    document.head.append(el);
  }
  el.content = text;
}

/** Puts this page's canonical in place of any other (one the server wrote for the first page would name it after a move). */
function setCanonical(href: string): HTMLLinkElement {
  for (const old of document.head.querySelectorAll('link[rel="canonical"]')) old.remove();
  const el = document.createElement('link');
  el.rel = 'canonical';
  el.href = href;
  el.setAttribute(MARK, '');
  document.head.append(el);
  return el;
}

export function usePageMeta(path: string | null, override?: PageMetaOverride): void {
  const title = override?.title;
  const description = override?.description;
  const canonical = override?.canonical;
  useEffect(() => {
    if (!path && !title && !description && !canonical) return;
    let alive = true;
    let added: HTMLLinkElement | null = null;
    let setT = false;
    let setD = false;
    const apply = (meta: { title: string; description: string } | null) => {
      if (!alive) return;
      const t = title ?? meta?.title;
      const d = description ?? meta?.description;
      if (t) {
        setTitle(t);
        setT = true;
      }
      if (d) {
        setDescription(d);
        setD = true;
      }
      const at = canonical ?? (meta || title ? path : null);
      if (at) added = setCanonical(`${__SITE_URL__}${cleanPath(at)}`);
    };
    if (path && (!title || !description)) {
      loadSiteMeta().then(
        (m) => apply(m.metaForPath(path)),
        () => apply(null),
      );
    } else {
      apply(null);
    }
    return () => {
      alive = false;
      added?.remove();
      if (setT) setTitle(SHELL_TITLE);
      if (setD) setDescription(SHELL_DESCRIPTION);
    };
  }, [path, title, description, canonical]);
}
