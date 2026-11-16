import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { CloseButton } from './CloseButton';
import { STICKY_CLOSE_CHANGED, STICKY_CLOSE_LANE, bottomChrome, boxesAbove, scrollPanel, topBars, type StickyCloseProps } from './StickyClose';

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
/** A task card's first row, where its close rests (the edit button's slot), when the card has no edit button to read it from, and how far
 * past that slot's foot the close may reach before it counts as over the card's lines below it. */
const ROW_HEAD = 56;
const ROW_SLACK = 6;
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
 *  the window, and above the tab bar or a held main action (or the panel's foot) when the content's going, or the lane and close of a root
 *  round it going with it, left it at the window's foot (2026-11-16: How it works' "Words we use" landed behind a phone's tab bar). */
function bringBack(el: Element | null | undefined) {
  if (!el || !el.isConnected) return;
  const r = el.getBoundingClientRect();
  if (r.height <= 0) return;
  const panel = scrollPanel(el);
  if (panel) {
    const p = panel.getBoundingClientRect();
    const from = p.top + panel.clientTop;
    const by = nearest(r.top, r.bottom, from, from + panel.clientHeight);
    if (by) panel.scrollBy({ top: by });
    return;
  }
  const condensed = document.querySelector('.fx-condensed[data-on]')?.getBoundingClientRect().height ?? 0;
  const by = nearest(r.top, r.bottom, Math.max(condensed, topBars()), window.innerHeight - bottomChrome());
  if (by) window.scrollBy({ top: by });
}

/** How long after a close a change to the closes round it (an outer root that is short again losing its own close and lane, a frame or two
 *  later) may still move the toggle, and has it brought back again. */
const SETTLE_MS = 600;

/** Brings the toggle back after a close, and again after each change to the closes or to the page's height for a moment, since closing a
 *  nested one can make the root round it short again, whose close and lane then go and move the toggle once more, and a page that grew
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

/*
 * A painted surface keeps its full width (2026-11-16, the founder: "where ever you have made the cross button for close u ended up
 * compromising the right space to accomodate for that sticky close ... why dont u keep it similar to the way u did it in tasks?").
 * While a close runs down a root's edge (`in`), the open content's wrapper (`.sticky-close-lane`) keeps a lane for it, which pulls in
 * everything inside it. Every painted surface in that wrapper (a card, a list of cards, an inset list, a form card, a wide toggle) that
 * filled its row at rest reaches back over the lane to the edge it had at rest, and takes the room the close needs as right padding of its
 * own instead, as a task's plan does (`.row-lane`): its rows' own right-edge controls move in and the close runs down the surface's right
 * edge over that padding, never over a control or a word. Unpainted content (a line of words, a bare list of links, a field) keeps the
 * wrapper's lane, since nothing visible shrinks there. The rail measures it (`fitLane`): the root's mode is taken off for a moment, inside
 * the same task, so nothing is drawn, to read where each surface stood at rest; each that filled its row reaches back by a margin less what
 * the lane took (`data-sc-reach`, `--sc-mr`; on the box round it that holds it whole, when its width is its own, such as a `w-full` card
 * in a list item) and keeps the lane as padding (`data-sc-pad`, `--sc-pr`, enough to keep its content clear of the close and 8px), which
 * app.css applies only while the root says `in`. A surface that cannot grow back keeps the wrapper's lane.
 */
/** Marks a box that reaches back over the lane, and a surface that keeps the lane as its own padding (app.css, "A painted surface keeps
 *  its full width"). */
const REACH = 'data-sc-reach';
const PAD = 'data-sc-pad';
/** The lane from the root's right edge: the close 4px in, its 32px, and the 8px the spacing allows. Anything that ends left of it is clear. */
const LANE = 44;
/** Never a surface that reaches: a tag or a pill (a padding on one side would push its words off its middle), a field, a picture, a switch
 *  (each keeps the lane, so the close never sits on it). */
const NO_REACH = '.tag, .rounded-pill, input, select, textarea, [contenteditable]:not([contenteditable="false"]), img, svg, video, canvas, picture, iframe, [role="switch"], [role="slider"]';
/** Classes that paint a surface even where their fill is see-through glass. */
const PAINT_CLASSES = ['toy', 'bg-card', 'bg-card-strong', 'bg-paper', 'fx-inset', 'rounded-card', 'rounded-tile'];
const seeThrough = (c: string) => c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
function painted(el: Element, cs: CSSStyleDeclaration): boolean {
  if (PAINT_CLASSES.some((c) => el.classList.contains(c))) return true;
  if (cs.backgroundImage !== 'none' || !seeThrough(cs.backgroundColor) || cs.boxShadow !== 'none') return true;
  return (
    (parseFloat(cs.borderRightWidth) > 0 && !seeThrough(cs.borderRightColor)) ||
    (parseFloat(cs.borderTopWidth) > 0 && !seeThrough(cs.borderTopColor)) ||
    (parseFloat(cs.borderBottomWidth) > 0 && !seeThrough(cs.borderBottomColor))
  );
}
/** The box `el` is laid out in, past any `display: contents` wrapper. */
function layoutParent(el: Element): HTMLElement | null {
  let p = el.parentElement;
  while (p && getComputedStyle(p).display === 'contents') p = p.parentElement;
  return p;
}
/** The last item a flex box lays out, past `display: contents` wrappers and anything out of the flow. */
function lastItem(box: Element): Element | null {
  for (let i = box.children.length - 1; i >= 0; i -= 1) {
    const c = box.children[i]!;
    const cs = getComputedStyle(c);
    if (cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed') continue;
    if (cs.display === 'contents') {
      const inner = lastItem(c);
      if (inner) return inner;
      continue;
    }
    return c;
  }
  return null;
}
/** Whether a surface fills its row at rest, so a margin taken back can make it wider: a block across its parent's content box, a flex
 *  column's stretched item, a one-column grid's item, or a flex row's last item (one whose width is its own hands the reach to the box round
 *  it, `climb`). */
function fillsRow(el: Element, cs: CSSStyleDeclaration, r: DOMRect): boolean {
  if (cs.display.startsWith('inline')) return false;
  const p = layoutParent(el);
  if (!p) return false;
  const pcs = getComputedStyle(p);
  const pr = p.getBoundingClientRect();
  const right = pr.right - parseFloat(pcs.paddingRight) - parseFloat(pcs.borderRightWidth);
  const left = pr.left + parseFloat(pcs.paddingLeft) + parseFloat(pcs.borderLeftWidth);
  if (Math.abs(r.right + (parseFloat(cs.marginRight) || 0) - right) > 1) return false;
  if (pcs.display.includes('flex') && !pcs.flexDirection.startsWith('column')) return lastItem(p) === el;
  return Math.abs(r.left - (parseFloat(cs.marginLeft) || 0) - left) <= 1;
}
/** A cell of a grid that reaches (`gridSurface`): the box that takes the lane as padding, and its padding and border at its right at rest. */
interface Cell {
  el: HTMLElement;
  pr: number;
  br: number;
}
interface Surface {
  el: HTMLElement;
  /** Its right edge at rest, its padding, margin and border at its right. */
  right: number;
  pr: number;
  mr: number;
  br: number;
  /** A grid of two or more columns that reaches whole: its cells in the lane at rest, padded one by one instead of the grid (`fitLane`). */
  cells?: Cell[];
}
/*
 * A grid of tiles (2026-11-17: a coach's Report numbers through `TileGroups`, a period's tiles). Its right-hand tiles reaching on their own
 * would grow wider than the rest, so the even rows (`evenGrid`) would no longer be one width; left alone, they ended 44px short of a one-tile
 * row beside them, with a bare strip of page by the close. So an unpainted grid of two or more columns that fills its row is the box that
 * reaches: its tracks share the room it takes back, and only the cells that then run into the close's column take the lane as their own
 * padding (`fitLane`). A cell that wraps one painted box (a list item round a card) pads that box. A grid whose cells in the lane are a tag,
 * a picture or a field, or hold more than one painted box, or hold only words, is walked as before.
 */
function columnCount(cs: CSSStyleDeclaration): number {
  if (!cs.display.endsWith('grid')) return 0;
  return cs.gridTemplateColumns
    .replace(/\[[^\]]*\]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t && t !== 'none' && t !== 'subgrid').length;
}
const inFlow = (cs: CSSStyleDeclaration) => cs.display !== 'none' && cs.position !== 'absolute' && cs.position !== 'fixed';
/** The boxes a grid lays out, past `display: contents` wrappers and anything out of the flow. */
function itemsOf(box: Element, out: HTMLElement[] = []): HTMLElement[] {
  for (const c of box.children) {
    if (!(c instanceof HTMLElement)) continue;
    const cs = getComputedStyle(c);
    if (cs.display === 'contents') itemsOf(c, out);
    else if (inFlow(cs)) out.push(c);
  }
  return out;
}
/** Whether anything under `el` paints (past `HAS_PAINT_MAX` boxes it counts as yes, so a big cell keeps the walk as before). */
const HAS_PAINT_MAX = 200;
function hasPainted(el: Element): boolean {
  const all = el.querySelectorAll('*');
  if (all.length > HAS_PAINT_MAX) return true;
  for (const d of all) {
    const cs = getComputedStyle(d);
    if (inFlow(cs) && painted(d, cs)) return true;
  }
  return false;
}
/** How many boxes down a grid cell may hold the painted box that takes its padding. */
const CELL_DEPTH = 4;
/** The box in a grid cell that takes the lane: the cell when painted, else the one painted box it holds whole (down single children), else
 *  the cell itself when nothing in it paints (words: its padding moves them in, and nothing visible narrows); null when it cannot (a tag,
 *  a picture, a field, or more than one painted box). */
function cellOf(item: HTMLElement): HTMLElement | null {
  if (item.matches(NO_REACH)) return null;
  let at = item;
  for (let i = 0; i <= CELL_DEPTH; i += 1) {
    if (painted(at, getComputedStyle(at))) return at.matches(NO_REACH) ? null : at;
    const kids = itemsOf(at);
    if (kids.length !== 1) break;
    const kid = kids[0]!;
    const acs = getComputedStyle(at);
    const ar = at.getBoundingClientRect();
    const kr = kid.getBoundingClientRect();
    const left = ar.left + parseFloat(acs.paddingLeft) + parseFloat(acs.borderLeftWidth);
    const right = ar.right - parseFloat(acs.paddingRight) - parseFloat(acs.borderRightWidth);
    if (Math.abs(kr.left - left) > 1 || Math.abs(kr.right - right) > 1) break;
    at = kid;
  }
  return hasPainted(item) ? null : item;
}
/** An unpainted grid of two or more columns that fills its row and holds a painted cell in the lane, as one surface (see above). */
function gridSurface(grid: HTMLElement, cs: CSSStyleDeclaration, r: DOMRect, zone: number, min: number): Surface | null {
  if (columnCount(cs) < 2 || r.width < min || !fillsRow(grid, cs, r)) return null;
  const cells: Cell[] = [];
  let paint = false;
  for (const item of itemsOf(grid)) {
    const ir = item.getBoundingClientRect();
    if (ir.width <= 0 || ir.right <= zone + 0.5) continue;
    const el = cellOf(item);
    if (!el) return null;
    const ecs = getComputedStyle(el);
    if (painted(el, ecs)) paint = true;
    cells.push({ el, pr: parseFloat(ecs.paddingRight) || 0, br: parseFloat(ecs.borderRightWidth) || 0 });
  }
  if (!paint) return null;
  return { el: grid, right: r.right, pr: parseFloat(cs.paddingRight) || 0, mr: parseFloat(cs.marginRight) || 0, br: parseFloat(cs.borderRightWidth) || 0, cells };
}
/** A surface found in a lane, with the lane's wrapper it was found in (the box its reach may climb to, `climb`). */
type Found = Surface & { lane: HTMLElement };
/** A painted surface that is itself an open root (an app group in Profile's "Tables AI chat can read", 2026-11-16): a frame, not a padded
 *  surface. It reaches back to its edge at rest and keeps its own padding, and the painted surfaces in its own lanes (the share lists) are
 *  found, reached and padded like any other, so the same group reads the same inside a fold as on /tables, never a strip of the group's
 *  fill beside lists pulled in. Its toggle (the group's header) has what it holds moved in as the root's own toggle does. */
interface Frame extends Found {
  /** How many frames round it, so the outer ones are laid back first. */
  depth: number;
  toggle: { el: HTMLElement; right: number; pr: number } | null;
  /** A card that holds surfaces (`throughOf`), not an open root: its own edge stays the close's edge, so the close keeps its place. */
  through?: boolean;
}
/*
 * A card that holds cards (2026-11-17: the hidden apps panel, a card whose groups are inset lists). Padded as one surface, the lists in it
 * ended 44px short of its right edge, off-centre with a bare band down its right, unlike the same lists in an app group. So a painted card
 * whose own content reaching into the lane is painted surfaces filling its content box is a frame that keeps its edge (`through`): it
 * reaches back, keeps its own padding, and the surfaces in it take the lane as their own padding (only what the card's padding does not
 * already give), so they keep the card's inset on both sides and the close runs down the card's edge over their padding, where it stood
 * before. A card that holds no such surface is padded as before.
 */
function throughOf(card: HTMLElement, cs: CSSStyleDeclaration, r: DOMRect, zone: number, min: number, depth: number): { inner: Found[]; frames: Frame[] } | null {
  const inner: Found[] = [];
  const frames: Frame[] = [];
  surfacesIn(card, zone, min, inner, card, frames, depth + 1);
  if (!inner.length) return null;
  const content = r.right - (parseFloat(cs.paddingRight) || 0) - (parseFloat(cs.borderRightWidth) || 0);
  if (!inner.some((f) => Math.abs(f.right + f.mr - content) <= 1)) return null;
  // Anything else in the card that stands in the close's column (a month's Next month button over its grid, a row of tags over a coach's
  // task cards, 2026-11-17) would sit under the close, which keeps the card's edge here: the card is padded as one surface instead.
  return bareInLane(card, [...inner.map((f) => f.el), ...frames.map((f) => f.el)], zone) ? null : { inner, frames };
}
/** What a card holds outside its surfaces that is a control, a tag or a line of words reaching into the close's column (`zone` and right of
 *  it), looked through once (`BARE_MAX` boxes), the surfaces' own content left out. */
const BARE_MAX = 2000;
const BARE_CONTROL = 'a[href], button, input, select, textarea, [role="button"], [role="switch"], [role="checkbox"], [tabindex]:not([tabindex="-1"])';
function bareInLane(card: HTMLElement, held: readonly HTMLElement[], zone: number): boolean {
  const range = document.createRange();
  const walker = document.createTreeWalker(card, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n instanceof Element && (held.includes(n as HTMLElement) || n.classList.contains('sticky-close-rail')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let left = BARE_MAX;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (--left < 0) return true;
    if (n.nodeType === Node.TEXT_NODE) {
      if (!n.textContent?.trim()) continue;
      range.selectNodeContents(n);
      for (const q of range.getClientRects()) if (q.width >= 2 && q.height >= 2 && q.right > zone + 0.5) return true;
      continue;
    }
    const el = n as HTMLElement;
    if (!el.matches(BARE_CONTROL) && !el.matches(NO_REACH)) continue;
    const q = el.getBoundingClientRect();
    if (q.width >= 2 && q.height >= 2 && q.right > zone + 0.5) return true;
  }
  return false;
}
/** The lane wrappers an open root inside shows (its own content), or none when `el` is no root or shows none. */
function frameLanes(el: HTMLElement): HTMLElement[] {
  if (!el.hasAttribute('data-sticky-close-root')) return [];
  return [...el.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains(STICKY_CLOSE_LANE) && getComputedStyle(c).display !== 'none');
}
/** A frame's own toggle: its first `[aria-expanded]` that is not inside one of its lanes, where it was at rest and its padding. */
function frameToggle(frame: HTMLElement, lanes: readonly HTMLElement[]): Frame['toggle'] {
  const el = [...frame.querySelectorAll<HTMLElement>('[aria-expanded]')].find((t) => !lanes.some((l) => l.contains(t)));
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 ? { el, right: r.right, pr: parseFloat(getComputedStyle(el).paddingRight) || 0 } : null;
}
/** One child of a lane: a painted surface that reaches into the lane (`zone` and right of it) and filled its row at rest, a frame (above),
 *  or, unpainted, the box to look inside. */
function visit(child: HTMLElement, zone: number, min: number, out: Found[], lane: HTMLElement, frames: Frame[], depth: number) {
  if (child.classList.contains('sticky-close-rail')) return;
  const cs = getComputedStyle(child);
  if (cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed') return;
  if (cs.display === 'contents') {
    surfacesIn(child, zone, min, out, lane, frames, depth);
    return;
  }
  const r = child.getBoundingClientRect();
  if (r.width <= 0 || r.right <= zone + 0.5 || child.matches(NO_REACH)) return;
  if (!painted(child, cs)) {
    const grid = gridSurface(child, cs, r, zone, min);
    if (grid) out.push({ ...grid, lane });
    else surfacesIn(child, zone, min, out, lane, frames, depth);
    return;
  }
  if (r.width < min || !fillsRow(child, cs, r)) return;
  const s: Found = { el: child, right: r.right, pr: parseFloat(cs.paddingRight) || 0, mr: parseFloat(cs.marginRight) || 0, br: parseFloat(cs.borderRightWidth) || 0, lane };
  const lanes = frameLanes(child);
  if (lanes.length) {
    const inner: Found[] = [];
    for (const l of lanes) {
      // A painted lane of the frame's is a surface of its own (it may not climb to the frame); an unpainted one is looked inside.
      if (painted(l, getComputedStyle(l))) visit(l, zone, r.width / 2, inner, child, frames, depth + 1);
      else surfacesIn(l, zone, l.getBoundingClientRect().width / 2, inner, l, frames, depth + 1);
    }
    if (inner.length) {
      frames.push({ ...s, depth, toggle: frameToggle(child, lanes) });
      out.push(...inner);
      return;
    }
  }
  const through = throughOf(child, cs, r, zone, min, depth);
  if (through) {
    frames.push({ ...s, depth, toggle: null, through: true }, ...through.frames);
    out.push(...through.inner);
    return;
  }
  out.push(s);
}
/** The outermost painted surfaces under `box` that reach into the lane and filled their row at rest (`visit`). */
function surfacesIn(box: Element, zone: number, min: number, out: Found[], lane: HTMLElement, frames: Frame[], depth = 0) {
  for (const child of box.children) if (child instanceof HTMLElement) visit(child, zone, min, out, lane, frames, depth);
}
function unmark(el: HTMLElement) {
  el.removeAttribute(REACH);
  el.removeAttribute(PAD);
  el.style.removeProperty('--sc-mr');
  el.style.removeProperty('--sc-pr');
}
/** How many boxes up a surface whose width is its own (`w-full` in a row) may hand its reach to the box round it that can grow. */
const CLIMB = 4;
/** The box round `el` that may reach for it: unpainted, inside the lane's wrapper, and holding `el` across its whole content box. */
function climb(el: HTMLElement, lane: HTMLElement): HTMLElement | null {
  const p = layoutParent(el);
  if (!p || p === lane || !lane.contains(p)) return null;
  const pcs = getComputedStyle(p);
  if (painted(p, pcs)) return null;
  const pr = p.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const left = pr.left + parseFloat(pcs.paddingLeft) + parseFloat(pcs.borderLeftWidth);
  const right = pr.right - parseFloat(pcs.paddingRight) - parseFloat(pcs.borderRightWidth);
  return Math.abs(r.left - left) <= 1 && Math.abs(r.right - right) <= 1 ? p : null;
}
/** Whether a box between `el` and the lane's wrapper clips it short of `right` (a list that clips its rows): the reach then belongs to that
 *  box, or to one round it. */
function clipped(el: HTMLElement, lane: HTMLElement, right: number): boolean {
  for (let a = el.parentElement; a && a !== lane; a = a.parentElement) {
    if (getComputedStyle(a).overflowX !== 'visible' && a.getBoundingClientRect().right < right - 1) return true;
  }
  return false;
}
/** What `fitLane` did: every box it marked, and how far in from the root's edge the close runs (`inset`, the outermost surface's edge). */
interface Fit {
  marked: HTMLElement[];
  inset: number;
}
/** Lays the root's painted surfaces back to their full width with the lane inside them (see above). The close then runs 4px inside the
 *  outermost of them (2026-11-16: an app group's list or a time block's tasks end 12px inside the group's card, and a close 4px inside the
 *  card straddled the list's edge), so it sits wholly on the surface as a task's does on its card. Only a root on its own fits its lane, so
 *  a nested close, which keeps the column of the one round it, follows this one in (one column). */
function fitLane(root: HTMLElement, before: readonly HTMLElement[]): Fit {
  for (const el of before) unmark(el);
  const none: Fit = { marked: [], inset: 0 };
  const lanes = [...root.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c.classList.contains(STICKY_CLOSE_LANE));
  if (!lanes.length) return none;
  const found: Found[] = [];
  // The painted surfaces that are open roots themselves (`Frame`): laid back to their edge, never padded; their own surfaces are in `found`.
  const frames: Frame[] = [];
  // The right edges, at rest, of the painted wrappers that are their own surface (their lane is their own padding).
  const paintedLanes: number[] = [];
  const toggle = root.querySelector<HTMLElement>('[aria-expanded]');
  let toggleAt: { right: number; pr: number } | null = null;
  let box = root.getBoundingClientRect();
  const mode = root.getAttribute('data-sticky-close');
  // At rest: the lane off for a moment, in the same task, so nothing is drawn. The lanes of the open roots inside it go off too (a fold in
  // a fold, as an event's My QR code inside a run's Photos and people, 2026-11-16): a nested root fits nothing itself, so its surfaces are
  // laid out from here, and read with its own lane still on they would stand at the lane's edge and never count as reaching into it.
  const inner = [...root.querySelectorAll<HTMLElement>('[data-sticky-close]')].map((el) => [el, el.getAttribute('data-sticky-close')!] as const);
  root.removeAttribute('data-sticky-close');
  for (const [el] of inner) el.removeAttribute('data-sticky-close');
  try {
    box = root.getBoundingClientRect();
    const zone = box.right - LANE;
    for (const lane of lanes) {
      const cs = getComputedStyle(lane);
      if (cs.display === 'none') continue;
      // A wrapper that is itself painted is the surface: the lane is its own padding already.
      if (painted(lane, cs)) {
        const r = lane.getBoundingClientRect();
        if (r.width > 0 && r.right > zone + 0.5) paintedLanes.push(r.right);
        continue;
      }
      surfacesIn(lane, zone, lane.getBoundingClientRect().width / 2, found, lane, frames);
    }
    // The root's own toggle (outside the lanes, its mark where the close sits at rest): where it ends and its padding, at rest.
    if (toggle && !lanes.some((l) => l.contains(toggle)) && !toggle.closest(`.${STICKY_CLOSE_LANE}`)) {
      const r = toggle.getBoundingClientRect();
      if (r.width > 0) toggleAt = { right: r.right, pr: parseFloat(getComputedStyle(toggle).paddingRight) || 0 };
    }
  } finally {
    if (mode !== null) root.setAttribute('data-sticky-close', mode);
    for (const [el, m] of inner) el.setAttribute('data-sticky-close', m);
  }
  if (!found.length && !paintedLanes.length) return none;
  const marked = new Set<HTMLElement>();
  type Plan = Surface & { lane: HTMLElement; target: number; reach: number };
  // A surface that is itself a control (a link card, a tile button, a nested fold's bar, shut or open) is laid back like any other and keeps
  // the lane as its own padding, as a task's card does round its plan's close (2026-11-17, the founder's "keep it similar to the way u did
  // it in tasks"; a list of them ended 44px short of the toggle, a bare strip of page beside it, Profile's badge tiles at 430): its words,
  // its arrow and its mark move in by that padding, and the close runs down its right edge over the padding only, never over a word or a
  // mark. A grid of such tiles reaches whole (`gridSurface`) and only the tiles that then run into the close's column take the padding.
  const plan = (s: Surface & { lane: HTMLElement }, target: number): Plan => ({ ...s, target, reach: target - s.el.getBoundingClientRect().right });
  // The reach: a negative margin on the surface, or, where its width is its own and it does not grow, on the box round it that holds it
  // whole (a card that is `w-full` in its list item), tried a level at a time and read back each round.
  // The box that carries each plan's reach (the surface, or the one its climb found), over every round, frames and surfaces alike.
  const carrier = new Map<Plan, HTMLElement>();
  const depthOf = (el: Element) => {
    let n = 0;
    for (let a = el.parentElement; a; a = a.parentElement) n += 1;
    return n;
  };
  // Each plan read again, the outer carriers first, and one that no longer ends at its edge has its own reach put right.
  const settle = (plans: Plan[]) => {
    const check = plans.map((p) => ({ p, at: carrier.get(p) ?? p.el }));
    check.sort((a, b) => depthOf(a.at) - depthOf(b.at));
    for (const { p, at } of check) {
      const off = p.target - p.el.getBoundingClientRect().right;
      if (Math.abs(off) <= 1) continue;
      at.style.setProperty('--sc-mr', `${(parseFloat(getComputedStyle(at).marginRight) || 0) - off}px`);
      at.setAttribute(REACH, '');
      marked.add(at);
    }
  };
  const reachAll = (plans: Plan[], reached: Set<Plan>) => {
    let pending = plans.filter((p) => Math.abs(p.reach) >= 0.5).map((p) => ({ plan: p, at: p.el }));
    for (const p of plans) if (Math.abs(p.reach) < 0.5) reached.add(p);
    for (let round = 0; round <= CLIMB && pending.length; round += 1) {
      for (const { plan, at } of pending) {
        if (at.hasAttribute(REACH)) continue;
        at.style.setProperty('--sc-mr', `${(parseFloat(getComputedStyle(at).marginRight) || 0) - plan.reach}px`);
        at.setAttribute(REACH, '');
        marked.add(at);
      }
      const next: typeof pending = [];
      for (const { plan, at } of pending) {
        if (Math.abs(plan.el.getBoundingClientRect().right - plan.target) <= 1 && !clipped(plan.el, plan.lane, plan.target)) {
          reached.add(plan);
          carrier.set(plan, at);
          continue;
        }
        if (at.hasAttribute(REACH)) {
          at.removeAttribute(REACH);
          at.style.removeProperty('--sc-mr');
          marked.delete(at);
        }
        const up = climb(at, plan.lane);
        if (up) next.push({ plan, at: up });
      }
      pending = next;
    }
    // A reach climbed to a box that holds other surfaces moves them with it (2026-11-17: a nested fold's bar, `w-full`, reached through the
    // fold's own root, and the hidden apps' list under it, which had reached on its own in the same round, then stood 44px past the group's
    // card). Each surface is read again, the outer carriers first, and one that no longer ends at its edge has its own reach put right.
    settle(plans.filter((p) => reached.has(p)));
  };
  // The frames first, the outer ones before those inside them, each read where the one round it now stands: what they hold moves with them,
  // so the surfaces inside are planned from where the frames put them.
  const framed = new Set<Plan>();
  for (const depth of [...new Set(frames.map((f) => f.depth))].sort((a, b) => a - b)) {
    reachAll(frames.filter((f) => f.depth === depth).map((f) => plan(f, f.right)), framed);
  }
  // A card that holds cards and could not reach back is one surface again (its surfaces, read where it now stands, would reach past it).
  const stuck = frames.filter((f) => f.through && ![...framed].some((p) => p.el === f.el));
  const laid = stuck.length
    ? [...found.filter((s) => !stuck.some((f) => f.el.contains(s.el))), ...stuck.filter((f) => !stuck.some((g) => g !== f && g.el.contains(f.el)))]
    : found;
  const reached = new Set<Plan>();
  reachAll(laid.map((s) => plan(s, s.right)), reached);
  // A surface's reach that climbed to a box round a frame laid back before it (a nested fold's bar, `w-full`, reaching through the fold's
  // own root round the card it holds) moves that frame and what it holds once more (2026-11-17: a coach's Pillars and pace › Friends card
  // stood 44px past the window at 360, its cards pulled 44px in). Every frame and surface is read again, the outer carriers first.
  if (framed.size) settle([...framed, ...reached]);
  // The outermost surface's edge, at rest (every surface that reached is back at it), and how far in from the root's edge the close then
  // runs; with none, it runs 4px in from the root's edge as before. Anything that ends left of `limit` is clear of the close.
  // Inside a frame its own surfaces set the edge: the close stands wholly on them (an open app group's share lists, 12px inside the group's
  // card, as on /tables), never across their edge because a shut group beside it ends at the card's (2026-11-17).
  // A card that holds cards (`through`) keeps its own edge as the close's edge, whatever the surfaces in it end at.
  const edges = [...paintedLanes, ...[...reached].map((p) => p.right), ...[...framed].filter((p) => (p as Plan & Frame).through).map((p) => p.right)];
  const inFrames = [...reached].filter((p) => frames.some((f) => !f.through && f.el.contains(p.el))).map((p) => p.right);
  const edge = edges.length ? Math.min(box.right, Math.max(...edges), ...inFrames) : box.right;
  const inset = Math.max(0, Math.round(box.right - edge));
  const limit = edge - LANE;
  // The room the close needs, as the surface's own padding: its content clear of the close and the 8px the spacing allows.
  // A root inside that is one of these surfaces (an app group in Profile's tables fold) is a frame, never padded itself: the surfaces in its
  // own lanes (the share lists) are padded here like any other, so the group reads as it does on /tables, and its close stands in this
  // root's column, over those lists' padding; the surfaces inside it are laid out once, from here (2026-11-16: padding the whole group left
  // a strip of its fill beside lists pulled in).
  for (const p of reached) {
    // A grid keeps its own padding: each cell that now runs into the close's column takes the lane, read where the reach put it.
    if (p.cells) {
      for (const c of p.cells) {
        const r = c.el.getBoundingClientRect();
        const pr = Math.max(c.pr, Math.ceil(r.right - c.br - limit));
        if (r.right <= limit + 0.5 || pr <= c.pr + 0.5) continue;
        c.el.style.setProperty('--sc-pr', `${pr}px`);
        c.el.setAttribute(PAD, '');
        marked.add(c.el);
      }
      continue;
    }
    const pr = Math.max(p.pr, Math.ceil(p.right - p.br - limit));
    if (pr <= p.pr + 0.5) continue;
    p.el.style.setProperty('--sc-pr', `${pr}px`);
    p.el.setAttribute(PAD, '');
    marked.add(p.el);
  }
  // The toggle's own line keeps the 8px from the close it kept at its old place: a toggle that reaches past the surface's edge (an app
  // group's header, across the whole card) has what it holds moved in by as much (its count pill then ends 8px before the close; its mark,
  // unseen while the close shows, keeps its slot under it).
  if (inset > 0 && toggle && toggleAt && toggleAt.right > edge + 0.5 && !marked.has(toggle)) {
    toggle.style.setProperty('--sc-pr', `${Math.ceil(toggleAt.pr + toggleAt.right - edge)}px`);
    toggle.setAttribute(PAD, '');
    marked.add(toggle);
  }
  // A frame's own toggle (the group's header, across its whole card) has what it holds moved in the same way: to the surfaces' edge while
  // its own close shows (its mark, unseen then, keeps its slot under the shared column), else to `limit`, since its mark is drawn then.
  for (const f of frames) {
    const t = f.toggle;
    if (!t || marked.has(t.el)) continue;
    const to = f.el.querySelector(':scope > .sticky-close-rail') ? edge : limit;
    if (t.right <= to + 0.5) continue;
    t.el.style.setProperty('--sc-pr', `${Math.ceil(t.pr + t.right - to)}px`);
    t.el.setAttribute(PAD, '');
    marked.add(t.el);
  }
  return { marked: [...marked], inset };
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
  // How far in from the root's edge a close running down it sits: 4px inside the outermost painted surface of the open content (`fitLane`).
  const [inset, setInset] = useState(0);
  const latest = useRef({ onClose, opener, anchor });
  latest.current = { onClose, opener, anchor };
  const openerOf = (root: HTMLElement) => latest.current.opener?.(root) ?? root.querySelector<HTMLElement>('[aria-expanded]');

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
        // A column that lies over the root's content still needs the root's own lane; one in the outer root's lane, over the root's own
        // padding (the outer root padded it as one of its surfaces, `fitLane`), or outside, does not.
        const cs = getComputedStyle(root);
        const content = box.right - (parseFloat(cs.paddingRight) || 0) - (parseFloat(cs.borderRightWidth) || 0);
        const over = !col.out && col.left < content - 0.5 && col.right > box.left + 0.5;
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
  // The painted surfaces of the open content keep their full width with the lane inside them (`fitLane`), read again when the root
  // changes size, when what it holds changes (rows that come or go) and when a close round it or inside it moves. Only a root on its own
  // does it: inside another open root the outermost one lays out every surface once, so no surface is marked from two roots (whose rules
  // would then stack, and outlive one root's lane).
  const nested = geo.nest;
  useLayoutEffect(() => {
    const el = rail.current;
    const root = el?.parentElement;
    if (!el || !root || variant === 'row' || mode !== 'in' || nested) return;
    let marked: HTMLElement[] = [];
    let frame = 0;
    const fit = () => {
      frame = 0;
      const done = fitLane(root, marked);
      marked = done.marked;
      setInset(done.inset);
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(fit);
    };
    fit();
    const ro = new ResizeObserver(soon);
    ro.observe(root);
    // Rows that come or go are fitted before they are drawn (a mutation's callback runs before the paint).
    const mo = new MutationObserver((records) => {
      if (records.some((m) => !el.contains(m.target))) fit();
    });
    mo.observe(root, { childList: true, subtree: true });
    window.addEventListener(STICKY_CLOSE_CHANGED, soon);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener(STICKY_CLOSE_CHANGED, soon);
      for (const m of marked) unmark(m);
      setInset(0);
    };
  }, [mode, nested, variant]);
  // A column that moved without changing side (a painted box round it that grew) is said too, so the closes lined up with it follow.
  const firstMove = useRef(true);
  useLayoutEffect(() => {
    if (firstMove.current) {
      firstMove.current = false;
      return;
    }
    say();
  }, [geo.shift, geo.x, inset]);

  // A nested close stuck one step under the close round it is pushed up when its own content ends, onto that close: for that moment it
  // tucks away (`data-tuck`, faded out and not tappable, unless the keyboard is on it), so two closes are never on each other. A task's
  // close running down its row's edge does the same while it would sit over the card's lines below its edit button's slot (2026-11-16: the
  // card keeps its resting padding, so its tags reach that edge): at rest it stands in that slot, stuck it shows again once the card has
  // passed and it runs over the plan's lane.
  const rowIn = variant === 'row' && mode === 'in';
  useEffect(() => {
    const el = rail.current;
    const root = el?.parentElement;
    if (!el || !root || (geo.depth === 0 && !rowIn)) return;
    let frame = 0;
    const overCard = (me: DOMRect) => {
      const card = root.querySelector<HTMLElement>(':scope > div > .check-line > .check-row');
      if (!card) return false;
      const c = card.getBoundingClientRect();
      const cs = getComputedStyle(card);
      const right = c.right - (parseFloat(cs.paddingRight) || 0);
      const bottom = c.bottom - (parseFloat(cs.paddingBottom) || 0);
      const slot = card.querySelector('[data-row-edit]')?.getBoundingClientRect();
      const head = slot && slot.height > 0 ? slot.bottom : c.top + ROW_HEAD;
      return me.left < right && me.right > c.left && me.top < bottom && me.bottom > head + ROW_SLACK;
    };
    const check = () => {
      frame = 0;
      const me = el.querySelector('.close-btn')?.getBoundingClientRect();
      if (!me) return;
      let tuck = rowIn && overCard(me);
      for (const a of tuck ? [] : openRootsAbove(root)) {
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
  }, [geo.depth, rowIn]);

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
  else if (inset > 0) vars['--sticky-close-inset'] = `${inset}px`;
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
      </span>
    </span>
  );
}
