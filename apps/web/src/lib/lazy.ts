import { createElement, lazy, type ComponentType } from 'react';

/**
 * A screen that downloads when it is first opened.
 *
 * `lazyNamed(() => import('../screens/Store'), 'Store')` is `React.lazy` for a named export. If the download
 * fails (most often a new version went out and the old file is gone) the page reloads once to pick up the new
 * files; the guard is kept in sessionStorage so it can never loop. If it still fails after that, the screen is a
 * short line saying so instead of a blank page.
 */
const GUARD = 'kreators.chunkReload';

function guard(): { tried: () => boolean; mark: () => void; clear: () => void } {
  return {
    tried: () => {
      try {
        return sessionStorage.getItem(GUARD) === '1';
      } catch {
        return true; // no storage means we cannot guard a reload, so never reload
      }
    },
    mark: () => {
      try {
        sessionStorage.setItem(GUARD, '1');
      } catch {
        /* ignore */
      }
    },
    clear: () => {
      try {
        sessionStorage.removeItem(GUARD);
      } catch {
        /* ignore */
      }
    },
  };
}

function ChunkFailed() {
  return createElement(
    'div',
    { className: 'mx-auto flex min-h-[50dvh] max-w-[480px] flex-col items-center justify-center gap-sm px-md text-center', role: 'alert' },
    createElement('p', { className: 'm-0 text-headline' }, 'This page could not load.'),
    createElement('p', { className: 'm-0 text-subhead text-ink-soft' }, 'Check your connection, then reload the page.'),
  );
}

export function lazyNamed<M extends Record<string, unknown>, K extends keyof M>(load: () => Promise<M>, name: K) {
  const g = guard();
  return lazy<ComponentType<any>>(() =>
    load().then(
      (m) => {
        g.clear();
        return { default: m[name] as ComponentType<any> };
      },
      (err) => {
        if (!g.tried()) {
          g.mark();
          window.location.reload();
          // The page is going away; never settle so nothing renders in between.
          return new Promise<never>(() => {});
        }
        console.error('Could not load a page', err);
        return { default: ChunkFailed };
      },
    ),
  ) as unknown as ComponentType<M[K] extends ComponentType<infer P> ? P : Record<string, never>>;
}
