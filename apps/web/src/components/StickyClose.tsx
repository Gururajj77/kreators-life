import { isValidElement, lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode, type RefObject } from 'react';

/**
 * A close that stays in view beside what an inline toggle opened (2026-11-14, the founder: "the close buttons that need one to scroll back
 * top need the close button to be sticky outside the toggle tab, follow it in the same way of tasks that was already added previously, put
 * the entire website under such checks"). It is the one core under a task's open plan on Daily (`RowClose` in CheckRow.tsx, 2026-11-13),
 * `Fold`, `GroupAccordion`, "How it works" and any hand-made toggle that opens something in place (never a Sheet, a dialog or a menu,
 * which have their own close in their rail).
 *
 * The rail is drawn inside the toggle's root (the element that holds the toggle and what it opened, `data-sticky-close-root`), right after
 * the toggle in the page's order, so the keyboard meets it before the content's fields. It is as tall as the root (less 8px at its foot)
 * and its button is sticky: level with the toggle at first, it stays in view while the content scrolls by and stops at the content's end.
 * Where the page has 60px of margin at the root's right (past the painted box round it, before the window's edge, On this page when it
 * shows, and the right of the nearest box that clips) it stands in that margin and is the 44px round `CloseButton` with its name as a tip
 * (`data-sticky-close="out"` on the root); where it has none it runs down the root's own right edge as the 32px one (a 44px hit area, no
 * tip, since a tip there would sit on words; `"in"`), and the content keeps a 48px lane for it (`.sticky-close-lane`, a direct child of the
 * root), so it never covers a field. It clears the condensed title bar, the public site's sticky header and a whole-page chat's header, and
 * inside a popup's scrolling panel it sticks to the panel's top. A rail inside another root whose rail shows lines up with the outermost
 * one: the same column and size (inside an `in` root it stands in that root's lane, so its own content keeps no second lane; inside an
 * `out` one it stands out beside it), 52px lower per level once they stick, and it tucks away for the moment its own content's end would
 * push it onto the close above. A tap or Enter hands focus to the toggle and brings it back under the top bar when the content was scrolled
 * past it; Escape anywhere in the root does the same, unless a popup, a control or a drag took the key.
 *
 * Only the cheap part lives here, in the first download: `useTallOpen`, the constants and the few readings the hook shares with the rail.
 * The rail itself (its measuring, Escape, the button) is its own chunk, `StickyCloseRail.tsx`, fetched once the first screen with a toggle
 * is drawn (`preloadRail`, when the browser is idle), so the first tall open does not wait for it (2026-11-14: the entry had gone to
 * 481.5 kB, over the 480 kB budget). A reading only the rail uses lives in the rail, never here: anything exported from this file for the
 * rail ships in the entry (`groupRight` and the room it stands out in moved there the same day, the entry at 480.3 kB).
 *
 * The contract a checker reads: the root carries `data-sticky-close-root`, and `data-sticky-close="in"` or `"out"` while the rail shows;
 * the button carries `data-sticky-close-btn` and a name that starts with "Close".
 */

/** A tall root stops counting as tall only this far under the room the window has, so the rail never flickers on the edge. */
const TALL_SLACK = 24;
/** Said on the window whenever a rail shows, goes, changes side or moves, so a rail inside or around it measures again; anything that
 *  moves a root without resizing it (an app group's body that stops clipping once its slide ends) or changes a top bar (Apps' row while
 *  selecting, which comes, goes and grows) says it too. */
export const STICKY_CLOSE_CHANGED = 'kreators:sticky-close';
/** The class of the open content's wrapper, a direct child of the root: it keeps a lane for a close that runs down the root's edge. */
export const STICKY_CLOSE_LANE = 'sticky-close-lane';

/** The boxes round `el`, nearest first, up to (not including) the page's body. (Shared with the rail.) */
export function* boxesAbove(el: Element): Generator<HTMLElement> {
  for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) yield a;
}

/** The nearest box round `el` that scrolls up and down and has more than it shows (a popup's panel), if any. (Shared with the rail.) */
export function scrollPanel(el: Element): HTMLElement | null {
  for (const a of boxesAbove(el)) {
    if (/auto|scroll/.test(getComputedStyle(a).overflowY) && a.scrollHeight > a.clientHeight + 1) return a;
  }
  return null;
}

/** How far down the window the bars that stick to its top reach, the condensed title bar aside: the public site's header from the width
 *  where it sticks, a whole-page chat's header, the coach's share row, Apps' row while selecting (`data-top-bar`). A bar reaches its own
 *  height past the line it sticks at (its `top`: 0 for most, under the condensed title bar for Apps' row, 2026-11-14), so a close sticks
 *  under it, never on its buttons. (Shared with the rail.) */
export function topBars(): number {
  let h = 0;
  for (const bar of document.querySelectorAll<HTMLElement>('[data-top-bar]')) {
    const cs = getComputedStyle(bar);
    const pos = cs.position;
    if ((pos === 'sticky' || pos === 'fixed') && !bar.closest('[role="dialog"]')) h = Math.max(h, (parseFloat(cs.top) || 0) + bar.getBoundingClientRect().height);
  }
  return h;
}

/** How much of the window's top may be covered while the content scrolls: the condensed title bar (once a title has gone under the top it
 *  shows, so it counts whenever the screen has one) or a sticky bar. */
function topChrome(): number {
  const condensed = document.querySelector('.fx-condensed');
  return Math.max(condensed ? condensed.getBoundingClientRect().height : 0, topBars());
}

/** How much of the window's foot is covered: the phone's tab bar and a held main action (StickyAction). */
function bottomChrome(): number {
  const tabs = document.querySelector('nav[data-tabbar]');
  let h = tabs ? tabs.getBoundingClientRect().height : 0;
  const html = document.documentElement;
  if (html.hasAttribute('data-sticky-held')) h += parseFloat(getComputedStyle(html).getPropertyValue('--sticky-action-h')) || 0;
  return h;
}

/** The height a toggle and what it opened can take before part of it is always out of sight: the popup's panel it scrolls in, or the window
 *  less its bars. */
function roomFor(el: HTMLElement): number {
  const panel = scrollPanel(el);
  if (panel) return panel.clientHeight;
  return window.innerHeight - topChrome() - bottomChrome();
}

/** A title's words, from the React nodes it is made of (strings, numbers, fragments and elements' children). */
export function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  // A string, a number or a bigint: every other node is an object.
  if (typeof node !== 'object') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

/** The rail's chunk, fetched once: when the browser is first idle after a screen with a toggle is drawn, or by the first rail itself. */
const loadRail = () => import('./StickyCloseRail');
let railAsked = false;
function preloadRail() {
  if (railAsked) return;
  railAsked = true;
  const fetchIt = () =>
    void loadRail().catch(() => {
      railAsked = false;
    });
  if ('requestIdleCallback' in window) requestIdleCallback(fetchIt, { timeout: 3000 });
  else setTimeout(fetchIt, 1500);
}
/** A rail that could not be fetched (a new version went out and the old file is gone) draws nothing: the toggle still opens and folds
 *  itself, and nothing reloads the page under a form someone is filling in. */
function NoRail() {
  return null;
}
const Rail = lazy<ComponentType<StickyCloseProps>>(() =>
  loadRail().then(
    (m) => ({ default: m.StickyCloseRail }),
    (err) => {
      console.error('Could not load the sticky close', err);
      return { default: NoRail };
    },
  ),
);

/**
 * Whether an open toggle needs its sticky close: open, and its root (the toggle and what it opened) taller than the room the window has
 * (the window less the condensed title bar or a sticky top bar at its top and the phone's tab bar or a held main action at its foot;
 * inside a popup, its panel). It goes off again only 24px under that, so it never flickers, and is read on open, on a resize, whenever
 * the root changes size (a form that grows, a slide) and whenever `STICKY_CLOSE_CHANGED` is said (a bar or a close came or went).
 * `enabled` false keeps it off (a fold in the laptop sidebar). The first toggle drawn also has the rail's chunk fetched when the browser
 * is idle.
 */
export function useTallOpen(root: RefObject<HTMLElement | null>, open: boolean, enabled = true): boolean {
  const [tall, setTall] = useState(false);
  const on = useRef(false);
  useEffect(() => {
    if (enabled) preloadRail();
  }, [enabled]);
  useLayoutEffect(() => {
    const el = root.current;
    if (!open || !enabled || !el) {
      on.current = false;
      setTall(false);
      return;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const h = el.getBoundingClientRect().height;
      const room = roomFor(el);
      const next = on.current ? h > room - TALL_SLACK : h > room;
      if (next === on.current) return;
      on.current = next;
      setTall(next);
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    const ro = new ResizeObserver(soon);
    ro.observe(el);
    // A bar that comes or goes (Apps' row while selecting) or a close round it changes the room without resizing the root.
    const events = ['resize', STICKY_CLOSE_CHANGED];
    for (const ev of events) window.addEventListener(ev, soon);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      for (const ev of events) window.removeEventListener(ev, soon);
    };
  }, [open, enabled, root]);
  return tall && open && enabled;
}

export interface StickyCloseProps {
  /** Closes what the toggle opened. */
  onClose: () => void;
  /** The button's name, starting with "Close": "Close Add a task", "Close the plan for Call the bank". */
  label: string;
  /** The tip it shows while it stands outside the root (shorter words beside a long name); the name by default. */
  tip?: string;
  /** The toggle that opened it, which takes focus back on a close; the root's first `[aria-expanded]` element by default. */
  opener?: (root: HTMLElement) => HTMLElement | null;
  /** What to bring back under the top bar after a close from deep in the content; the toggle by default. */
  anchor?: (opener: HTMLElement | null, root: HTMLElement) => Element | null;
  /** Escape anywhere in the root closes it too (default). Off where the root already closes on Escape itself (a task's row). */
  escape?: boolean;
  /** `row`: a task's open plan (RowClose), centred on the card's first 56px row standing out, where the edit button was running down it. */
  variant?: 'fold' | 'row';
}

/**
 * The sticky close itself. Draw it as a direct child of the toggle's root, right after the toggle, only while the root needs it (a task's
 * plan whenever it is open; anything else while `useTallOpen` says so), and give the open content's wrapper `STICKY_CLOSE_LANE`. The root
 * becomes `position: relative` while it shows (unless a class already positions it). It draws nothing until its chunk is in (fetched
 * ahead, see `preloadRail`), and has its own Suspense, so it never holds up the screen round it.
 */
export function StickyClose(props: StickyCloseProps) {
  return (
    <Suspense fallback={null}>
      <Rail {...props} />
    </Suspense>
  );
}
