import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';

/**
 * A link with a hash lands on its section (2026-11-07, the founder: "ensure the notifications open the right page and sections too").
 * React Router's ScrollRestoration scrolls to a hash only when its element is already in the page, and most sections arrive later, with
 * their data or their chunk. After a navigation that carries a hash (a tap, a redirect, the first load; never Back or Forward, whose
 * place ScrollRestoration keeps) this waits up to `LAND_WAIT_MS` for the element: one with that `id`, or one whose `data-land` list
 * names it (a section answering to two hashes). Then it:
 * - opens it when it is closed: the element itself is a closed toggle (`aria-expanded="false"`), or holds its own toggle marked
 *   `data-land-open` (a `Fold` given an `id`, the Water and reminders section);
 * - scrolls it into view under the condensed title bar (inside a sheet, to the middle of the sheet), smoothly only on the same page
 *   and never under reduced motion;
 * - moves focus to it (its toggle, else its heading, else itself), so a keyboard or a screen reader lands there too, unless the person
 *   already moved focus somewhere;
 * - keeps going to that place for a moment while the page settles (a fold's panel that comes with its data, a lazy section, a list that
 *   loads), until the person scrolls (the wheel, a finger, the scrollbar), taps or types.
 * Wired once, in `Root`; the landing is its own chunk (lib/landOnHash.ts), so the first download carries only this hook. A hidden
 * element (display none, such as Daily's Water section on a laptop, where the bubble has it) is never a target. `scripts/check-note-links.mjs` (run
 * by scripts/scan.sh) checks that every inbox note's link is a route here and its hash an id the app draws.
 */
export function useLandOnHash() {
  const loc = useLocation();
  const nav = useNavigationType();
  const first = useRef(true);
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    const wasFirst = first.current;
    first.current = false;
    const samePage = lastPath.current === loc.pathname;
    lastPath.current = loc.pathname;
    if (!loc.hash || loc.hash.length < 2) return;
    // Back and Forward return to where the person was; only a fresh arrival (or the first load) lands.
    if (nav === 'POP' && !wasFirst) return;
    let id = loc.hash.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      return;
    }
    let stop: (() => void) | null = null;
    let gone = false;
    void import('./landOnHash').then((m) => {
      if (!gone) stop = m.land(id, samePage && !wasFirst, wasFirst);
    });
    return () => {
      gone = true;
      stop?.();
    };
  }, [loc.key]); // eslint-disable-line react-hooks/exhaustive-deps
}
