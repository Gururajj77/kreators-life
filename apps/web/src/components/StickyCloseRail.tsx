import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { CloseButton } from './CloseButton';
import { STICKY_CLOSE_CHANGED, boxesAbove, scrollPanel, topBars, type StickyCloseProps } from './StickyClose';

/**
 * The drawn half of `StickyClose` (StickyClose.tsx says what it is and where it goes): a chunk of its own, fetched when the browser is idle
 * after the first screen with a toggle, so its measuring never sits in the first download (2026-11-14). Nothing in the first download may
 * import this file, or it comes back into the entry; it reads the readings it shares with `useTallOpen` from StickyClose.tsx, and keeps
 * here every reading only it uses (an export from StickyClose.tsx that only this file reads still ships in the entry).
 */

/** A target inside one of these keeps its Escape: a popup, a menu or a control whose own popup is open. */
const POPUP = '[role="listbox"], [role="menu"], [role="dialog"], [aria-modal="true"], [aria-haspopup][aria-expanded="true"], [role="combobox"][aria-expanded="true"]';
/** How close a nested close may come to the one round it before it tucks away: the 8px a stuck pair keeps (52px a level, 44px a button). */
const TUCK_GAP = 8;
/** The room the close needs at the root's right to stand outside it: a gap, the 44px button, a gap. */
const OUTSIDE_ROOM = 60;
/** How far past the root a painted box round it may reach and still be its group's box (a time block's box, a fold's card). */
const GROUP_REACH = 40;

/** The right edge of the painted box the root sits in (a time block's `tb-box` and its padding), when one reaches just past the root. */
function groupRight(row: HTMLElement): number {
  const right = row.getBoundingClientRect().right;
  let edge = right;
  let a = row.parentElement;
  for (let depth = 0; a && depth < 6 && a !== document.body; depth += 1, a = a.parentElement) {
    const r = a.getBoundingClientRect().right;
    if (r - right > GROUP_REACH) break;
    if (r <= edge + 0.5) continue;
    const cs = getComputedStyle(a);
    const painted = cs.backgroundImage !== 'none' || !/rgba\([^)]*,\s*0\)|transparent/.test(cs.backgroundColor) || parseFloat(cs.borderRightWidth) > 0;
    if (painted) edge = r;
  }
  return edge;
}

/** Where a rail standing outside the root must end: the window's edge, On this page when it shows, and the right of every box round the root that clips. */
function limitOf(root: HTMLElement): number {
  let limit = document.documentElement.clientWidth;
  const contents = document.querySelector('.page-contents')?.getBoundingClientRect();
  if (contents && contents.width > 0) limit = Math.min(limit, contents.left);
  for (const a of boxesAbove(root)) {
    if (getComputedStyle(a).overflowX !== 'visible') limit = Math.min(limit, a.getBoundingClientRect().right);
  }
  return limit;
}

/** Whether the root sits in a box that scrolls (a popup's panel), whose top a sticky close then sticks to instead of the window's. */
function inScrollBox(root: HTMLElement): boolean {
  for (const a of boxesAbove(root)) {
    const cs = getComputedStyle(a);
    if (/auto|scroll|hidden/.test(`${cs.overflowX} ${cs.overflowY}`)) return true;
  }
  return false;
}

/** Brings `el` back just under the top bar (or the panel's top) when a close from deep in the content left it above the window. */
function bringBack(el: Element | null | undefined) {
  if (!el || !el.isConnected) return;
  const panel = scrollPanel(el);
  if (panel) {
    const top = el.getBoundingClientRect().top - panel.getBoundingClientRect().top - 8;
    if (top < 0) panel.scrollBy({ top });
    return;
  }
  const condensed = document.querySelector('.fx-condensed[data-on]')?.getBoundingClientRect().height ?? 0;
  const top = el.getBoundingClientRect().top - Math.max(condensed, topBars()) - 8;
  if (top < 0) window.scrollBy({ top });
}

/** How long after a close a change to the closes round it (an outer root that is short again losing its own close and lane, a frame or two
 *  later) may still move the toggle, and has it brought back again. */
const SETTLE_MS = 600;

/** Brings the toggle back after a close, and again after each change to the closes for a moment, since closing a nested one can make the
 *  root round it short again, whose close and lane then go and move the toggle once more. It only ever scrolls up to a toggle above the
 *  window, so the runs after the first do nothing while it is in view. */
function bringBackSoon(target: () => Element | null | undefined) {
  const run = () => requestAnimationFrame(() => bringBack(target()));
  run();
  window.addEventListener(STICKY_CLOSE_CHANGED, run);
  window.setTimeout(() => window.removeEventListener(STICKY_CLOSE_CHANGED, run), SETTLE_MS);
}

/** The open roots round `root` whose rail shows, nearest first. */
function openRootsAbove(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (let a = root.parentElement?.closest<HTMLElement>('[data-sticky-close]'); a; a = a.parentElement?.closest<HTMLElement>('[data-sticky-close]')) out.push(a);
  return out;
}

/** The column a root's close is drawn in, read from its rail as drawn, and which way it stands. */
function columnOf(root: HTMLElement): { left: number; right: number; out: boolean } | null {
  const rail = root.querySelector<HTMLElement>(':scope > .sticky-close-rail');
  if (!rail) return null;
  const r = rail.getBoundingClientRect();
  if (r.width <= 0) return null;
  return { left: r.left, right: r.right, out: rail.dataset.mode === 'out' };
}

interface Geo {
  /** Standing outside the root (the 44px close) or running down an edge (the 32px one). */
  out: boolean;
  /** How far a painted box round the root reaches past it (a rail of its own). */
  shift: number;
  /** How many open roots it sits in. */
  depth: number;
  bar: number;
  panel: boolean;
  head: number;
  lead: number;
  /** Lined up with the outermost open root's close round it, `x` px from the root's left edge. */
  nest: boolean;
  x: number;
  /** The root's own content keeps a lane: running down an edge, in a column that lies over the root. */
  lane: boolean;
}
const START: Geo = { out: false, shift: 0, depth: 0, bar: 0, panel: false, head: 44, lead: 0, nest: false, x: 0, lane: true };
const sameGeo = (a: Geo, b: Geo) =>
  a.out === b.out && a.shift === b.shift && a.depth === b.depth && a.bar === b.bar && a.panel === b.panel && a.head === b.head && a.lead === b.lead && a.nest === b.nest && a.x === b.x && a.lane === b.lane;
const say = () => queueMicrotask(() => window.dispatchEvent(new Event(STICKY_CLOSE_CHANGED)));

export function StickyCloseRail({ onClose, label, tip, opener, anchor, escape = true, variant = 'fold' }: StickyCloseProps) {
  const rail = useRef<HTMLSpanElement>(null);
  const [geo, setGeo] = useState<Geo>(START);
  const latest = useRef({ onClose, opener, anchor });
  latest.current = { onClose, opener, anchor };
  const openerOf = (root: HTMLElement) => latest.current.opener?.(root) ?? root.querySelector<HTMLElement>('[aria-expanded]');

  const close = () => {
    const root = rail.current?.parentElement;
    if (!root) return;
    const toggle = openerOf(root);
    const back = latest.current.anchor;
    toggle?.focus({ preventScroll: true });
    latest.current.onClose();
    // Closed from deep in the content, the toggle would be above the window: bring it back under the top bar.
    bringBackSoon(() => (back ? back(toggle, root) : toggle));
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  // Which side it stands on, how far a painted box round the root reaches, how deep it sits in other open roots and what covers the top.
  // Inside another open root it takes the outermost one's column as drawn (the same x and, from its side, the same size), unless a box
  // between them clips there; it then measures for itself, as a root on its own does.
  useLayoutEffect(() => {
    const root = rail.current?.parentElement;
    if (!root) return;
    const measure = () => {
      const box = root.getBoundingClientRect();
      const toggle = openerOf(root)?.getBoundingClientRect();
      const above = openRootsAbove(root);
      const limit = limitOf(root);
      const col = above.length ? columnOf(above[above.length - 1]!) : null;
      const base = {
        depth: above.length,
        bar: Math.round(topBars()),
        panel: inScrollBox(root),
        head: toggle && toggle.height > 0 ? Math.round(toggle.height) : 44,
        lead: toggle && toggle.height > 0 ? Math.max(0, Math.round(toggle.top - box.top)) : 0,
      };
      let next: Geo;
      if (col && col.right <= limit + 0.5) {
        // A column that lies over the root itself still needs the root's own lane; one in the outer root's lane, or outside, does not.
        const over = !col.out && col.left < box.right - 0.5 && col.right > box.left + 0.5;
        next = { ...base, out: col.out, shift: 0, nest: true, x: Math.round(col.left - box.left), lane: over };
      } else {
        const edge = groupRight(root);
        const out = limit - edge >= OUTSIDE_ROOM;
        next = { ...base, out, shift: Math.round(edge - box.right), nest: false, x: 0, lane: !out };
      }
      setGeo((prev) => (sameGeo(prev, next) ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    window.addEventListener('resize', measure);
    window.addEventListener(STICKY_CLOSE_CHANGED, measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener(STICKY_CLOSE_CHANGED, measure);
    };
    // The opener is read through `latest`, so the rail measures from its first draw on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The root says it is a root, and which way its close is drawn, so its content keeps a lane only when the close runs down its edge
  // over it (`data-sticky-close-nest` when the column is another root's, outside this one).
  useLayoutEffect(() => {
    const root = rail.current?.parentElement;
    if (!root) return;
    const own = !root.hasAttribute('data-sticky-close-root');
    if (own) root.setAttribute('data-sticky-close-root', '');
    return () => {
      if (own) root.removeAttribute('data-sticky-close-root');
    };
  }, []);
  const mode = geo.out ? 'out' : 'in';
  const noLane = geo.nest && !geo.lane;
  useLayoutEffect(() => {
    const root = rail.current?.parentElement;
    if (!root) return;
    root.setAttribute('data-sticky-close', mode);
    if (variant === 'row') root.dataset.rowClose = mode;
    if (noLane) root.setAttribute('data-sticky-close-nest', '');
    say();
    return () => {
      root.removeAttribute('data-sticky-close');
      root.removeAttribute('data-sticky-close-nest');
      if (variant === 'row') delete root.dataset.rowClose;
      say();
    };
  }, [mode, variant, noLane]);
  // A column that moved without changing side (a painted box round it that grew) is said too, so the closes lined up with it follow.
  const firstMove = useRef(true);
  useLayoutEffect(() => {
    if (firstMove.current) {
      firstMove.current = false;
      return;
    }
    say();
  }, [geo.shift, geo.x]);

  // A nested close stuck one step under the close round it is pushed up when its own content ends, onto that close: for that moment it
  // tucks away (`data-tuck`, faded out and not tappable, unless the keyboard is on it), so two closes are never on each other.
  useEffect(() => {
    const el = rail.current;
    const root = el?.parentElement;
    if (!el || !root || geo.depth === 0) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const me = el.querySelector('.close-btn')?.getBoundingClientRect();
      if (!me) return;
      let tuck = false;
      for (const a of openRootsAbove(root)) {
        const b = a.querySelector(':scope > .sticky-close-rail .close-btn')?.getBoundingClientRect();
        if (b && me.left < b.right && me.right > b.left && me.top < b.bottom + TUCK_GAP && me.bottom > b.top - TUCK_GAP) {
          tuck = true;
          break;
        }
      }
      el.toggleAttribute('data-tuck', tuck);
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    document.addEventListener('scroll', soon, { capture: true, passive: true });
    window.addEventListener('resize', soon);
    window.addEventListener(STICKY_CLOSE_CHANGED, soon);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('scroll', soon, { capture: true });
      window.removeEventListener('resize', soon);
      window.removeEventListener(STICKY_CLOSE_CHANGED, soon);
      el.removeAttribute('data-tuck');
    };
  }, [geo.depth]);

  // Escape anywhere in the root closes it, read on the document once React and the content had their turn: a native listener, since a
  // React handler would also hear a key from a Sheet opened inside (React's events bubble through portals), and on the document, so a
  // control in the content that closes on Escape itself (and says so with preventDefault) keeps the key. The nearest open root owns it,
  // and a row being dragged (SortableList, whose Escape puts it back, read on the window after this) keeps it too.
  useEffect(() => {
    if (!escape) return;
    const root = rail.current?.parentElement;
    if (!root) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || document.documentElement.classList.contains('kanban-drag')) return;
      const t = e.target instanceof Element ? e.target : null;
      if (!t || !root.contains(t) || t.closest('[data-sticky-close]') !== root || t.closest(POPUP)) return;
      e.preventDefault();
      closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [escape]);

  const vars: Record<string, string> = {};
  if (geo.nest) vars['--sticky-close-x'] = `${geo.x}px`;
  else if (geo.out && geo.shift > 0) vars['--sticky-close-shift'] = `${geo.shift}px`;
  if (geo.depth > 0) vars['--sticky-close-depth'] = String(geo.depth);
  if (geo.bar > 0) vars['--sc-bar'] = `${geo.bar}px`;
  if (variant === 'fold') {
    vars['--sticky-close-head'] = `${geo.head}px`;
    if (geo.lead > 0) vars['--sticky-close-lead'] = `${geo.lead}px`;
  }
  const row = variant === 'row';
  return (
    <span
      ref={rail}
      data-mode={mode}
      data-nest={geo.nest ? '' : undefined}
      data-panel={geo.panel ? '' : undefined}
      className={`sticky-close-rail ${row ? 'row-close-rail' : ''}`}
      style={vars as CSSProperties}
    >
      <span className={`sticky-close-slot ${row ? 'row-close-slot' : ''}`}>
        <CloseButton
          data-sticky-close-btn=""
          data-row-close-btn={row ? '' : undefined}
          label={label}
          small={!geo.out}
          tip={geo.out ? (tip ?? label) : false}
          className={row ? 'row-close' : 'sticky-close'}
          // A mouse or a finger leaves focus where it was; the keyboard's Enter focuses the toggle, like a tap.
          onMouseDown={(e) => e.preventDefault()}
          onClick={close}
        />
      </span>
    </span>
  );
}
