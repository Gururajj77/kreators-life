import { ChevronUp } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { CloseButton } from './CloseButton';
import { STICKY_CLOSE_CHANGED, STICKY_CLOSE_MARK, bottomChrome, boxesAbove, scrollPanel, topBars, type StickyCloseProps } from './StickyClose';

/**
 * The drawn half of `StickyClose` (StickyClose.tsx says what it is and where it goes): a chunk of its own, fetched when the browser is idle
 * after the first screen with a toggle, so its measuring never sits in the first download (2026-11-14). Nothing in the first download may
 * import this file, or it comes back into the entry; it reads the readings it shares with `useTallOpen` from StickyClose.tsx, and keeps
 * here every reading only it uses (an export from StickyClose.tsx that only this file reads still ships in the entry).
 */

/** A target inside one of these keeps its Escape: a popup, a menu or a control whose own popup is open, or a mode of the page that ends on
 *  Escape and so owns the key over every close inside it (`data-owns-escape`: Apps' Select, whose Escape leaves Select and hands focus to
 *  Done, never to a group's toggle; 2026-11-14). */
const POPUP = '[role="listbox"], [role="menu"], [role="dialog"], [aria-modal="true"], [aria-haspopup][aria-expanded="true"], [role="combobox"][aria-expanded="true"], [data-owns-escape]';
/** A field that takes typed words: a text area, an editable region, or an input that is not a box, a choice, a button, a slider, a colour,
 *  a file or a picker of a day or a time (those come filled in). */
const TYPED =
  'textarea, [contenteditable]:not([contenteditable="false"]), input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="password"], input[type="number"]';
const holdsWords = (el: Element) => (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : (el.textContent ?? '')).trim() !== '';
/** Escape never throws typed words away (2026-11-14): closing unmounts what the toggle opened, a half-written "Add a task" with it. So it
 *  closes nothing from a field that holds words (the key is the field's: a search may clear itself on it), nor from anywhere in a form in
 *  the root one of whose fields does (Escape on a form's button would lose the title too). The close itself still closes, in one tap. */
function keepsWords(t: Element, root: HTMLElement): boolean {
  const field = t.closest(TYPED);
  if (field && holdsWords(field)) return true;
  const form = t.closest('form');
  return Boolean(form && root.contains(form) && [...form.querySelectorAll(TYPED)].some(holdsWords));
}
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

/** How far to scroll so a box from `top` to `bottom` sits inside the room from `from` to `to`, 8px clear of either end, at whichever end is
 *  nearer (block 'nearest'): up when it starts above the room, down when it ends below it, never so far down that its top leaves. */
function nearest(top: number, bottom: number, from: number, to: number): number {
  const up = top - from - 8;
  if (up < 0) return up;
  const down = bottom - to + 8;
  return down > 0 ? Math.min(down, up) : 0;
}

/** Brings `el` back into the room after a close: under the top bar (or the panel's top) when a close from deep in the content left it above
 *  the window, and above the tab bar or a held main action (or the panel's foot) when the content's going, or a root round it going with
 *  it, left it at the window's foot (2026-11-16: How it works' "Words we use" landed behind a phone's tab bar). */
function bringBack(el: Element | null | undefined) {
  if (!el || !el.isConnected) return;
  const r = el.getBoundingClientRect();
  if (r.height <= 0) return;
  // The slim bars of the open roots round it that show cover the top too (a task's card closed inside a tall time block box).
  let bars = 0;
  for (const bar of document.querySelectorAll('[data-sticky-close-bar][data-shown="true"]')) {
    if (bar.parentElement?.parentElement?.contains(el)) bars = Math.max(bars, bar.getBoundingClientRect().bottom);
  }
  const panel = scrollPanel(el);
  if (panel) {
    const p = panel.getBoundingClientRect();
    const from = Math.max(p.top + panel.clientTop, bars);
    const by = nearest(r.top, r.bottom, from, from + panel.clientHeight);
    if (by) panel.scrollBy({ top: by });
    return;
  }
  const condensed = document.querySelector('.fx-condensed[data-on]')?.getBoundingClientRect().height ?? 0;
  const by = nearest(r.top, r.bottom, Math.max(condensed, topBars(), bars), window.innerHeight - bottomChrome());
  if (by) window.scrollBy({ top: by });
}

/** How long after a close a change to the closes round it (an outer root that is short again losing its own close, a frame or two later)
 *  may still move the toggle, and has it brought back again. */
const SETTLE_MS = 600;

/** Brings the toggle back after a close, and again after each change to the closes or to the page's height for a moment, since closing a
 *  nested one can make the root round it short again, whose close then goes and moves the toggle once more, and a page that grew
 *  shorter pulls the window up under it. It only ever scrolls to a toggle outside the room, so the runs after the first do nothing while
 *  it is in view. */
function bringBackSoon(target: () => Element | null | undefined) {
  let frame = 0;
  const run = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => bringBack(target()));
  };
  run();
  const ro = new ResizeObserver(run);
  ro.observe(document.documentElement);
  window.addEventListener(STICKY_CLOSE_CHANGED, run);
  window.setTimeout(() => {
    ro.disconnect();
    window.removeEventListener(STICKY_CLOSE_CHANGED, run);
  }, SETTLE_MS);
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
/** The nearest box round `el` that the bar's `position: sticky` sticks in (a popup's panel, or a box that clips): any box that is not
 *  `overflow: visible` (or `clip`) in either direction; none means the window. */
function stickBox(el: Element): HTMLElement | null {
  for (const a of boxesAbove(el)) {
    const cs = getComputedStyle(a);
    if (/auto|scroll|hidden/.test(`${cs.overflowX} ${cs.overflowY}`)) return a;
  }
  return null;
}

/** The line in the window a running-in bar sticks at: its own `top` (the bars over the window's top, the safe area and its step under the
 *  bars of the roots round it, all in px once worked out), from the top of the box it sticks in, inside that box's padding (a sticky box
 *  keeps clear of its scroller's padding; the bar's `top` takes the padding back with `--sc-pad`). */
function stuckLine(bar: HTMLElement): number {
  const top = parseFloat(getComputedStyle(bar).top) || 0;
  const box = stickBox(bar);
  return box ? box.getBoundingClientRect().top + box.clientTop + (parseFloat(getComputedStyle(box).paddingTop) || 0) + top : top;
}

/** Where a running-in bar must stop being shown at the root's foot: the highest point at which a painted surface as wide as the root (the
 *  root itself, or the card that fills it) starts rounding its bottom corners, so the bar's square corners never stand out past a rounded
 *  foot over the page (2026-11-17 review). Only boxes that reach the rail's own end are walked, so it costs a few reads near the end. */
function footLine(root: HTMLElement, end: number): number {
  const width = root.getBoundingClientRect().width;
  let foot = Infinity;
  const visit = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.bottom < end - 1 || r.height <= 0) return;
    if (r.width >= width * 0.9) {
      const cs = getComputedStyle(el);
      const rad = Math.max(parseFloat(cs.borderBottomLeftRadius) || 0, parseFloat(cs.borderBottomRightRadius) || 0);
      const paints = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none' || parseFloat(cs.borderBottomWidth) > 0;
      if (rad > 0 && paints) foot = Math.min(foot, r.bottom - rad);
    }
    for (const c of el.children) if (!c.classList.contains('sticky-close-rail')) visit(c);
  };
  visit(root);
  return foot;
}

/** The toggle's own mark inside its header (a task card's pencil, `data-row-edit`; a fold's chevron or plus, `sticky-close-mark`), never one
 *  of a root nested in it. */
function markOf(head: Element, root: HTMLElement): Element | null {
  const own = (m: Element) => m.closest('[data-sticky-close-root]') === root;
  if (head.matches('[data-row-edit], .sticky-close-mark') && own(head)) return head;
  for (const m of head.querySelectorAll('[data-row-edit], .sticky-close-mark')) if (own(m)) return m;
  return null;
}

/** How far the header must come back down past the bar's line before the bar goes again, so it never flickers on the line. */
const SHOW_SLACK = 4;

/** The words the bar shows when the caller gave none: the close's name less its "Close" and the words that only join it to the toggle's. */
function titleFrom(label: string): string {
  const t = label.replace(/^Close (the plan for |the form for |the change to |the fix: |the replies to |the people in |the )?/, '');
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : label;
}

interface Geo {
  /** Standing outside the root (the 44px close beside it) or running in (the slim bar over its top). */
  out: boolean;
  /** How far a painted box round the root reaches past it (a rail of its own). */
  shift: number;
  /** How many open roots it sits in that draw a close of the same kind: beside it (out), or a bar over it (in). */
  depth: number;
  bar: number;
  panel: boolean;
  head: number;
  lead: number;
  /** Lined up with the outermost open root's close round it, standing out, `x` px from the root's left edge. */
  nest: boolean;
  x: number;
  /** The top padding of the box a running-in bar sticks in (a popup's panel), which its `top` takes back so it sits at the panel's top. */
  pad: number;
  /** Inside a popup (a Sheet), whose own X sits in its rail right by the bar: the bar's close then folds with a chevron (2026-11-17 review). */
  sheet: boolean;
}
const START: Geo = { out: false, shift: 0, depth: 0, bar: 0, panel: false, head: 44, lead: 0, nest: false, x: 0, pad: 0, sheet: false };
const sameGeo = (a: Geo, b: Geo) =>
  a.out === b.out && a.shift === b.shift && a.depth === b.depth && a.bar === b.bar && a.panel === b.panel && a.head === b.head && a.lead === b.lead && a.nest === b.nest && a.x === b.x && a.pad === b.pad && a.sheet === b.sheet;
const say = () => queueMicrotask(() => window.dispatchEvent(new Event(STICKY_CLOSE_CHANGED)));

export function StickyCloseRail({ onClose, label, title, tip, opener, anchor, escape = true, variant = 'fold' }: StickyCloseProps) {
  const rail = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const [geo, setGeo] = useState<Geo>(START);
  const latest = useRef({ onClose, opener, anchor });
  latest.current = { onClose, opener, anchor };
  const openerOf = (root: HTMLElement) => latest.current.opener?.(root) ?? root.querySelector<HTMLElement>('[aria-expanded]');
  const row = variant === 'row';

  // The header the bar stands in for while it runs in: a task's card (its anchor), else the toggle drawn right before the rail, else the
  // opener when it sits inside the root (a table row's form opens from outside it: none then).
  const headerOf = (root: HTMLElement): Element | null => {
    const el = rail.current;
    if (row) return latest.current.anchor?.(openerOf(root), root) ?? el?.previousElementSibling ?? null;
    const prev = el?.previousElementSibling;
    if (prev) return prev;
    const o = openerOf(root);
    return o && root.contains(o) ? o : null;
  };

  // Whether the press that clicks the close came from a mouse or a finger (a pointerdown on it), not the keyboard's Enter or Space.
  const byPointer = useRef(false);
  const close = (pointer = false) => {
    const root = rail.current?.parentElement;
    if (!root) return;
    const toggle = openerOf(root);
    const back = latest.current.anchor;
    // The keyboard's ring follows the keyboard only (2026-11-14): after Enter, Space or Escape the toggle shows it; after a mouse or a
    // finger it does not, even when focus was in a field (which always matches :focus-visible, so a toggle focused from it would show the
    // ring too). The press itself moves focus off the field (the button takes it where the browser gives a pressed button focus), a field
    // still focused (Safari gives a button none) lets go, and the toggle is focused with no ring where the browser takes that option.
    const was = document.activeElement;
    if (pointer && was instanceof HTMLElement && was !== toggle && root.contains(was)) was.blur();
    toggle?.focus({ preventScroll: true, ...(pointer ? { focusVisible: false } : {}) } as FocusOptions);
    latest.current.onClose();
    // Closed from deep in the content, the toggle would be above the window (or, the page now shorter, at its foot): bring it back.
    bringBackSoon(() => (back ? back(toggle, root) : toggle));
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  // Which side it stands on, how far a painted box round the root reaches, how deep it sits in other open roots and what covers the top.
  // Inside an open root whose close stands out it takes that one's column as drawn (the same x and size), unless a box between them clips
  // there; it then measures for itself, as a root on its own does. Inside one that runs in it runs in too, its bar under that one's.
  useLayoutEffect(() => {
    const root = rail.current?.parentElement;
    if (!root) return;
    const measure = () => {
      const box = root.getBoundingClientRect();
      const toggle = openerOf(root)?.getBoundingClientRect();
      const above = openRootsAbove(root);
      const limit = limitOf(root);
      const col = above.length ? columnOf(above[above.length - 1]!) : null;
      const inAbove = above.filter((a) => a.getAttribute('data-sticky-close') === 'in').length;
      const sticksIn = stickBox(root);
      const base = {
        pad: sticksIn ? Math.round(parseFloat(getComputedStyle(sticksIn).paddingTop) || 0) : 0,
        bar: Math.round(topBars()),
        panel: inScrollBox(root),
        sheet: Boolean(root.closest('[role="dialog"]')),
        head: toggle && toggle.height > 0 ? Math.round(toggle.height) : 44,
        lead: toggle && toggle.height > 0 ? Math.max(0, Math.round(toggle.top - box.top)) : 0,
      };
      let next: Geo;
      if (col && col.out && col.right <= limit + 0.5) {
        next = { ...base, depth: above.length, out: true, shift: 0, nest: true, x: Math.round(col.left - box.left) };
      } else if (col && !col.out) {
        next = { ...base, depth: inAbove, out: false, shift: 0, nest: false, x: 0 };
      } else {
        const edge = groupRight(root);
        const out = limit - edge >= OUTSIDE_ROOM;
        next = { ...base, depth: out ? above.length : inAbove, out, shift: out ? Math.round(edge - box.right) : 0, nest: false, x: 0 };
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

  // The root says it is a root, and which way its close is drawn.
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
  useLayoutEffect(() => {
    const root = rail.current?.parentElement;
    if (!root) return;
    root.setAttribute('data-sticky-close', mode);
    if (row) root.dataset.rowClose = mode;
    say();
    return () => {
      root.removeAttribute('data-sticky-close');
      if (row) delete root.dataset.rowClose;
      say();
    };
  }, [mode, row]);
  // A column that moved without changing side (a painted box round it that grew) is said too, so the closes lined up with it follow.
  const firstMove = useRef(true);
  useLayoutEffect(() => {
    if (firstMove.current) {
      firstMove.current = false;
      return;
    }
    say();
  }, [geo.shift, geo.x]);

  // Standing out, the close takes the toggle's own mark's place: the root's own marks (never a nested root's) keep their slot unseen.
  // Running in, the mark stays: it closes the toggle while the header is in sight.
  useLayoutEffect(() => {
    const root = rail.current?.parentElement;
    if (!root || mode !== 'out') return;
    let hidden: Element[] = [];
    const sync = () => {
      const mine = [...root.querySelectorAll(`.${STICKY_CLOSE_MARK}`)].filter((m) => m.closest('[data-sticky-close-root]') === root);
      for (const m of hidden) if (!mine.includes(m)) m.removeAttribute('data-sc-hide');
      for (const m of mine) m.setAttribute('data-sc-hide', '');
      hidden = mine;
    };
    sync();
    window.addEventListener(STICKY_CLOSE_CHANGED, sync);
    return () => {
      window.removeEventListener(STICKY_CLOSE_CHANGED, sync);
      for (const m of hidden) m.removeAttribute('data-sc-hide');
    };
  }, [mode]);

  // Standing out, a nested close stuck one step under the close round it is pushed up when its own content ends, onto that close: for that
  // moment it tucks away (`data-tuck`, faded out and not tappable, unless the keyboard is on it), so two closes are never on each other.
  useEffect(() => {
    const el = rail.current;
    const root = el?.parentElement;
    if (!el || !root || mode !== 'out' || geo.depth === 0) return;
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
  }, [geo.depth, mode]);

  // Running in, the slim bar shows only once the header's own mark has started going up under the line it sticks at (the top bars, the bar
  // round it, or the panel's top), while
  // the root still reaches past that line by more than the bar's height; it goes once the header comes back down past the line or the
  // root's end comes up under the bar (it would be pushed up over the bar round it). It stays while the keyboard is in it. Fading costs
  // the page nothing: the bar is drawn over the content, so showing it moves nothing.
  useLayoutEffect(() => {
    const el = rail.current;
    const bar = barRef.current;
    const root = el?.parentElement;
    if (!el || !bar || !root || mode !== 'in') return;
    let on = false;
    let frame = 0;
    const write = (next: boolean) => {
      on = next;
      bar.dataset.shown = String(next);
      bar.inert = !next;
    };
    write(false);
    const check = () => {
      frame = 0;
      const line = stuckLine(bar);
      const r = root.getBoundingClientRect();
      const head = headerOf(root);
      const h = head?.getBoundingClientRect();
      // The header's own mark (a task card's pencil, a fold's chevron or plus) is what closes it while it is in sight, so the bar shows
      // once that mark starts going under the line, not once the whole header has: a tall card (a long title and its tags, 430px at 320)
      // would otherwise leave its plan with no close of its own in sight for a long stretch (2026-11-17 review). With no mark found, the
      // header's foot, as before.
      const mark = head ? markOf(head, root)?.getBoundingClientRect() : undefined;
      const gone = mark && mark.height > 0 ? mark.top : h && h.height > 0 ? h.bottom : r.top + bar.offsetHeight;
      const end = el.getBoundingClientRect().bottom;
      let next = on ? gone <= line + SHOW_SLACK : gone < line;
      if (end < line + bar.offsetHeight) next = false;
      // Near the end, also never past where a rounded foot starts curving in (only read in that last stretch).
      else if (next && end < line + bar.offsetHeight + 64 && footLine(root, end) < line + bar.offsetHeight) next = false;
      if (bar.contains(document.activeElement)) next = true;
      if (next !== on) write(next);
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    document.addEventListener('scroll', soon, { capture: true, passive: true });
    window.addEventListener('resize', soon);
    window.addEventListener(STICKY_CLOSE_CHANGED, soon);
    const ro = new ResizeObserver(soon);
    ro.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('scroll', soon, { capture: true });
      window.removeEventListener('resize', soon);
      window.removeEventListener(STICKY_CLOSE_CHANGED, soon);
      ro.disconnect();
      write(false);
    };
    // The header is read through `latest` and the rail's own place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Escape anywhere in the root closes it, read on the document once React and the content had their turn: a native listener, since a
  // React handler would also hear a key from a Sheet opened inside (React's events bubble through portals), and on the document, so a
  // control in the content that closes on Escape itself (and says so with preventDefault) keeps the key. The nearest open root owns it,
  // and a row being dragged (SortableList, whose Escape puts it back, read on the window after this) keeps it too, as do typed words
  // (`keepsWords`) and a word an input method is still composing.
  useEffect(() => {
    if (!escape) return;
    const root = rail.current?.parentElement;
    if (!root) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing || document.documentElement.classList.contains('kanban-drag')) return;
      const t = e.target instanceof Element ? e.target : null;
      if (!t || !root.contains(t) || t.closest('[data-sticky-close]') !== root || t.closest(POPUP) || keepsWords(t, root)) return;
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
  if (geo.pad > 0) vars['--sc-pad'] = `${geo.pad}px`;
  if (variant === 'fold' && geo.out) {
    vars['--sticky-close-head'] = `${geo.head}px`;
    if (geo.lead > 0) vars['--sticky-close-lead'] = `${geo.lead}px`;
  }
  const button = (
    <CloseButton
      data-sticky-close-btn=""
      data-row-close-btn={row ? '' : undefined}
      label={label}
      small={!geo.out}
      icon={!geo.out && geo.sheet ? ChevronUp : undefined}
      tip={geo.out ? (tip ?? label) : false}
      className={row ? 'row-close' : 'sticky-close'}
      // Either way the toggle takes focus after it; only the keyboard's way shows its ring (`close`).
      onPointerDown={() => {
        byPointer.current = true;
      }}
      onKeyDown={() => {
        byPointer.current = false;
      }}
      onClick={() => {
        const pointer = byPointer.current;
        byPointer.current = false;
        close(pointer);
      }}
    />
  );
  const name = title ?? titleFrom(label);
  return (
    <span
      ref={rail}
      data-mode={mode}
      data-nest={geo.nest ? '' : undefined}
      data-panel={geo.panel ? '' : undefined}
      className={`sticky-close-rail ${row ? 'row-close-rail' : ''}`}
      style={vars as CSSProperties}
    >
      {geo.out ? (
        // Keyed apart, so React never turns the bar's node (its `inert` and `data-shown` set by hand) into the slot's.
        <span key="out" className={`sticky-close-slot ${row ? 'row-close-slot' : ''}`}>
          {button}
        </span>
      ) : (
        <span key="in" ref={barRef} className="sticky-close-bar" data-sticky-close-bar="" data-shown="false">
          {/* The name, for a mouse or a finger only: a tap brings the header back into sight. The keyboard's one stop is the close. */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            title={name}
            className="sticky-close-bar-name text-footnote font-semibold text-ink"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const root = rail.current?.parentElement;
              const bar = barRef.current;
              const h = root ? headerOf(root)?.getBoundingClientRect() : null;
              if (!bar || !h) return;
              // The header comes back just under the line the bar sticks at (under the bars of the roots round it), 8px clear.
              const by = h.top - stuckLine(bar) - 8;
              const box = stickBox(bar);
              if (box) box.scrollBy({ top: by });
              else window.scrollBy({ top: by });
            }}
          >
            {name}
          </button>
          {button}
        </span>
      )}
    </span>
  );
}
