import { pickTipSpot, type Align, type Obstacle, type Rect, type Side, type TipSpot } from '@kreators/shared/tipPlace';

/**
 * The page's side of the tooltip rule (2026-11-12): what is drawn around a trigger, read once in one pass, and the one write of the
 * tip's place. The rule itself is `pickTipSpot` in `@kreators/shared/tipPlace`. Read by lib/smartTip.ts (every `data-tip` name),
 * components/Tip.tsx (a glossary word's card) and the assistant's bubble, each after the first paint.
 */

export type Prefer = Array<[Side, Align]>;

export interface TipScene {
  trigger: Rect;
  view: { w: number; h: number };
  panel?: Rect;
  obstacles: Obstacle[];
}

/** Controls, read by their box (the drive's own list, so what it counts as a control the rule stays off). */
const CONTROL = 'button, a[href], input, select, textarea, summary, [role=button], [role=tab], [role=switch], [contenteditable]';
/** A control someone types or picks in: a tip never sits on one. */
const FIELD = 'input, select, textarea, [contenteditable]';
const PICTURE = 'img, svg, canvas, video, picture, [role=img]';
/** The row a trigger sits in: its own words cost more than a neighbour's. */
const ROW = 'tr, li, [role=row], .fx-row';
/** How close to a panel's border a control in its padding counts as on its edge. */
const EDGE = 56;

const rectOf = (r: DOMRect | DOMRectReadOnly): Rect => ({ x: r.left, y: r.top, w: r.width, h: r.height });

/**
 * What a square pixel of each thing costs when nothing near is empty (the founder, 2026-11-13: "never the trigger's own row title, a
 * field, or the next control"): a field most, then a small control (an icon button, the next eye in a list), the words of the trigger's
 * own row and a heading, a button with words, other words, a picture, a decorative picture, and least the empty fill of a big card or
 * row, whose words are counted on their own.
 */
const COST = { field: 40, small: 30, ownRow: 25, heading: 20, button: 12, words: 10, picture: 8, decor: 2, card: 3 } as const;
/** A control no bigger than this each way is a small one (an icon button, a pill). */
const SMALL = 64;
/** A control up to this many square pixels is a button with words; past it, a card or a row. */
const BUTTON_AREA = 220 * 64;

/** A popup's panel: its `.dialog-panel`, or the frame's one child that is not the rail (the assistant's card). */
export function panelOf(frame: Element | null): HTMLElement | null {
  if (!frame) return null;
  const marked = frame.querySelector<HTMLElement>(':scope > .dialog-panel');
  if (marked) return marked;
  return (Array.from(frame.children).find((c) => !c.classList.contains('dialog-rail')) as HTMLElement | undefined) ?? null;
}

/** Whether a tip for this trigger stays off its popup's panel: in the rail, outside the panel, or on its edge rather than in its words. */
function staysOffPanel(trigger: Element, panel: HTMLElement): boolean {
  if (trigger.closest('.dialog-rail')) return true;
  if (!panel.contains(trigger)) return true;
  const p = panel.getBoundingClientRect();
  const t = trigger.getBoundingClientRect();
  const cs = getComputedStyle(panel);
  const content = {
    left: p.left + parseFloat(cs.paddingLeft),
    right: p.right - parseFloat(cs.paddingRight),
    top: p.top + parseFloat(cs.paddingTop),
    bottom: p.bottom - parseFloat(cs.paddingBottom),
  };
  const inContent = t.left >= content.left && t.right <= content.right && t.top >= content.top && t.bottom <= content.bottom;
  if (inContent) return false;
  const nearEdge = t.left - p.left < EDGE || p.right - t.right < EDGE || t.top - p.top < EDGE || p.bottom - t.bottom < EDGE;
  return nearEdge;
}

/** Whether two rects (left, top, right, bottom) meet by at least a pixel each way. */
const meetsBox = (a: DOMRect | DOMRectReadOnly, b: { left: number; top: number; right: number; bottom: number }) =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) >= 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) >= 1;

/** Whether an element is drawn at all (the drive's own test: a box, not hidden, not see-through). */
function shown(el: Element, cache: Map<Element, boolean>): boolean {
  const kept = cache.get(el);
  if (kept !== undefined) return kept;
  let ok = el.isConnected && el.getClientRects().length > 0;
  if (ok) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    ok = r.width >= 1 && r.height >= 1 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
  }
  cache.set(el, ok);
  return ok;
}

/** Whether a box paints over what is under it (a fill more than half opaque, a gradient, a picture). */
function opaque(el: Element): boolean {
  if (el.matches(PICTURE)) return true;
  const cs = getComputedStyle(el);
  if (cs.backgroundImage !== 'none') return true;
  const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
  if (!m) return false;
  const parts = (m[1] ?? '').split(/[ ,/]+/).filter(Boolean);
  return parts.length < 4 || Number(parts[3]) > 0.5;
}

/** Whether a box between `el` and the page clips the point away (a scrolled row, a cut line). */
function clippedAt(el: Element, x: number, y: number): boolean {
  for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
    const cs = getComputedStyle(a);
    if (cs.overflowX === 'visible' && cs.overflowY === 'visible' && !cs.contain.includes('paint')) continue;
    const r = a.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return true;
  }
  return false;
}

/**
 * Bars drawn over the page that take no pointer (2026-11-13): the condensed title bar is opaque but `pointer-events: none`, so the
 * page's hit test sees through it to the card scrolled under it. Read once per scene.
 */
const COVER = '.fx-condensed[data-on]';
let covers: Array<{ el: Element; r: DOMRect }> = [];

/**
 * Whether what sits in `el` is what is drawn at x, y: it comes before any modal scrim and any opaque box over it. Words (not `strict`)
 * whose element takes no pointer count when the first thing met is what holds them and nothing clips them there.
 */
function drawnAt(el: Element, x: number, y: number, strict: boolean, skip?: Element | null): boolean {
  for (const c of covers) {
    if (x < c.r.left || x > c.r.right || y < c.r.top || y > c.r.bottom) continue;
    // The bar is drawn over what scrolls under it, so its own words are drawn there (a hit test never meets them), unless a popup's
    // scrim or panel lies over the bar too.
    if (!c.el.contains(el)) return false;
    const top = document.elementFromPoint(x, y);
    return !top?.closest('.sheet-scrim, .dialog-frame, [role="dialog"]');
  }
  const first = document.elementFromPoint(x, y);
  if (!first) return false;
  if (first === el || el.contains(first)) return true;
  if (first.classList.contains('sheet-scrim')) return false;
  for (const e of document.elementsFromPoint(x, y)) {
    if (skip && skip.contains(e)) continue;
    if (e === el || el.contains(e)) return true;
    if (e.classList.contains('sheet-scrim')) return false;
    if (e.contains(el)) return !strict && !clippedAt(el, x, y);
    if (opaque(e)) return false;
  }
  return !strict && !clippedAt(el, x, y);
}

/** The middle of the part of `r` inside the room and the window, where it is asked whether it is drawn. */
function middleIn(r: DOMRect | DOMRectReadOnly, room: { left: number; top: number; right: number; bottom: number }): { x: number; y: number } {
  const l = Math.max(r.left, room.left);
  const t = Math.max(r.top, room.top);
  return { x: (l + Math.min(r.right, room.right)) / 2, y: (t + Math.min(r.bottom, room.bottom)) / 2 };
}

/** Whether a box holds the trigger's whole box. */
function holds(b: DOMRect, t: Rect): boolean {
  return b.left <= t.x && b.top <= t.y && b.right >= t.x + t.w && b.bottom >= t.y + t.h;
}

/**
 * Everything the rule needs, read once: the trigger, the window, the popup's panel (when the tip stays off it), and what is drawn in
 * the room the tip may stand in (beside the trigger, the gap and the tip's own size around it). It reads the page the way the drive
 * checks it (2026-11-13; it used to ask the page point by point, every 6 to 8px, and missed a "0" in a table's cell): every line of
 * words, every control's box and every picture that meets the room, each kept only where it is what is drawn (not under a modal scrim
 * or an opaque box), each with what covering it costs (`COST`). `skip` is the tip itself.
 */
export function sceneFor(trigger: Element, size: { w: number; h: number }, skip?: Element | null): TipScene {
  const t = rectOf(trigger.getBoundingClientRect());
  const view = { w: document.documentElement.clientWidth, h: window.innerHeight };
  const frame = trigger.closest('.dialog-frame');
  const panelEl = panelOf(frame);
  const panel = panelEl && staysOffPanel(trigger, panelEl) ? rectOf(panelEl.getBoundingClientRect()) : undefined;
  // A tip only stands beside its trigger (2026-11-13), so the room is the trigger, the gap and the tip's size each way.
  const out = 8 + Math.max(size.w, size.h);
  const room = {
    left: Math.max(0, t.x - out),
    top: Math.max(0, t.y - out),
    right: Math.min(view.w, t.x + t.w + out),
    bottom: Math.min(view.h, t.y + t.h + out),
  };
  const cache = new Map<Element, boolean>();
  covers = Array.from(document.querySelectorAll(COVER)).map((el) => ({ el, r: el.getBoundingClientRect() }));
  const row = trigger.closest(ROW);
  const outside = (el: Element) => el === trigger || trigger.contains(el) || Boolean(skip && skip.contains(el)) || Boolean(el.closest('.sheet-scrim'));
  const obstacles: Obstacle[] = [];

  // Words: every line of every text that meets the room.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim()) continue;
    const el = n.parentElement;
    if (!el || outside(el)) continue;
    range.selectNodeContents(n);
    if (!meetsBox(range.getBoundingClientRect(), room) || !shown(el, cache)) continue;
    const cost = row && row.contains(el) ? COST.ownRow : el.closest('h1, h2, h3') ? COST.heading : COST.words;
    for (const r of Array.from(range.getClientRects())) {
      if (r.width < 1 || r.height < 1 || !meetsBox(r, room)) continue;
      for (const run of drawnRuns(el, r, room, skip)) obstacles.push({ x: run.left, w: run.right - run.left, y: r.top, h: r.height, cost });
    }
  }
  range.detach();

  // Controls by their box (a big card's box costs little: its words are counted above), pictures by theirs.
  for (const el of Array.from(document.querySelectorAll(`${CONTROL}, ${PICTURE}`))) {
    if (outside(el) || el.contains(trigger)) continue;
    const isControl = el.matches(CONTROL);
    // A picture inside a control, or a part of a drawing, is that control's or that drawing's.
    if (!isControl && (el.closest(CONTROL) || el.parentElement?.closest('svg'))) continue;
    const b = el.getBoundingClientRect();
    if (!meetsBox(b, room) || !shown(el, cache)) continue;
    if (isControl && holds(b, t)) continue;
    const span = drawnSpan(el, b, room, skip);
    if (!span) continue;
    let cost: number;
    if (isControl) {
      if (el.matches(FIELD)) cost = COST.field;
      else if (b.width <= SMALL && b.height <= SMALL) cost = COST.small;
      else if (b.width * b.height <= BUTTON_AREA) cost = COST.button;
      else cost = COST.card;
    } else {
      const decor = el.closest('[aria-hidden="true"]') && b.width > SMALL && b.height > SMALL;
      cost = decor ? COST.decor : COST.picture;
    }
    obstacles.push({ x: span.left, w: span.right - span.left, y: span.top, h: span.bottom - span.top, cost });
  }
  return { trigger: t, view, panel, obstacles };
}

/** How finely a line of words is asked along its length when part of it is covered. */
const RUN_STEP = 12;

/**
 * The parts of a line of words (inside the room) that are drawn, left to right (2026-11-13): a line half under a popup's panel keeps
 * its other half, so a tip never sits on the words still showing beside the panel (it used to ask only at the line's middle, which the
 * panel covered, and dropped the whole line). Asked at both ends and the middle first; only a line that differs is asked along its length.
 */
function drawnRuns(el: Element, r: DOMRect, room: { left: number; top: number; right: number; bottom: number }, skip?: Element | null): Array<{ left: number; right: number }> {
  const left = Math.max(r.left, room.left);
  const right = Math.min(r.right, room.right);
  const y = (Math.max(r.top, room.top) + Math.min(r.bottom, room.bottom)) / 2;
  if (right - left <= 2 * RUN_STEP) return drawnAt(el, (left + right) / 2, y, false, skip) ? [{ left, right }] : [];
  const ends = [left + 1, (left + right) / 2, right - 1].map((x) => drawnAt(el, x, y, false, skip));
  if (ends.every(Boolean)) return [{ left, right }];
  const runs: Array<{ left: number; right: number }> = [];
  let start: number | null = null;
  for (let x = left; x < right; x += RUN_STEP) {
    const at = Math.min(x + RUN_STEP / 2, right - 1);
    if (drawnAt(el, at, y, false, skip)) {
      if (start === null) start = x;
    } else if (start !== null) {
      runs.push({ left: start, right: Math.min(x + RUN_STEP, right) });
      start = null;
    }
  }
  if (start !== null) runs.push({ left: start, right });
  return runs;
}

/** How finely a box's covered top and foot are trimmed (a sticky bar over a card scrolled under it). */
const TRIM_STEP = 8;

/**
 * The part of a control's or picture's box (inside the room) that is drawn, top to foot, or null when none is (2026-11-13): a card
 * scrolled under a sticky title bar keeps only the part below the bar, so a tip may stand on the bar's empty fill over it, as the drive
 * judges it (it asks at the middle of what the tip meets). Asked down the box's middle line, from each end inward.
 */
function drawnSpan(el: Element, b: DOMRect, room: { left: number; top: number; right: number; bottom: number }, skip?: Element | null): { top: number; bottom: number; left: number; right: number } | null {
  const lo = { x: Math.max(b.left, room.left), y: Math.max(b.top, room.top) };
  const hi = { x: Math.min(b.right, room.right), y: Math.min(b.bottom, room.bottom) };
  const at = (x: number, y: number) => drawnAt(el, x, y, true, skip);
  // Down the middle line, then across the middle of what is left: each end stepped inward until the box is what is drawn there.
  const trim = (a: number, z: number, probe: (v: number) => boolean): [number, number] | null => {
    if (z - a <= 2 * TRIM_STEP) return probe((a + z) / 2) ? [a, z] : null;
    let top = a;
    let foot = z;
    while (top < foot && !probe(Math.min(top + 1, foot - 1))) top += TRIM_STEP;
    if (top >= foot) return null;
    while (foot > top && !probe(Math.max(foot - 1, top + 1))) foot -= TRIM_STEP;
    if (foot <= top) return null;
    return [Math.max(top - TRIM_STEP, a), Math.min(foot + TRIM_STEP, z)];
  };
  const midX = (lo.x + hi.x) / 2;
  const ys = trim(lo.y, hi.y, (y) => at(midX, y));
  if (!ys) return null;
  const midY = (ys[0] + ys[1]) / 2;
  const xs = trim(lo.x, hi.x, (x) => at(x, midY)) ?? [lo.x, hi.x];
  return { top: ys[0], bottom: ys[1], left: xs[0], right: xs[1] };
}

/**
 * Reads the scene, picks the spot and writes the tip's `left` and `top` once. The tip is hidden while the page is read so it is never
 * hit, and keeps its own visibility after. With `relativeTo`, the place is written against that element's box (a tip that is
 * positioned inside a fixed wrapper, like the assistant's bubble); otherwise against the window (a fixed or top-layer tip).
 * Every tip stands beside its trigger, the gap away, above, below, left or right (the founder, 2026-11-13: "the tooltip text should
 * remain close to the button itself not somewhere else"), so a mouse always reaches it across the gap (WCAG 1.4.13 hoverable).
 */
export function placeTip(trigger: Element, el: HTMLElement, prefer: Prefer, relativeTo?: Element | null, opts: { scene?: TipScene } = {}): TipSpot & { scene: TipScene } {
  const before = el.style.visibility;
  el.style.visibility = 'hidden';
  const box = el.getBoundingClientRect();
  const size = { w: Math.ceil(box.width), h: Math.ceil(box.height) };
  // A second try at a smaller size (smartTip's narrow name) passes the first read back: its room lies inside the first one's, so the
  // page is walked once per tip, never twice.
  const scene = opts.scene ?? sceneFor(trigger, size, el);
  const spot = pickTipSpot({ ...scene, size, prefer });
  const base = relativeTo?.getBoundingClientRect();
  el.style.left = `${Math.round(spot.x - (base?.left ?? 0))}px`;
  el.style.top = `${Math.round(spot.y - (base?.top ?? 0))}px`;
  el.style.visibility = before;
  return { ...spot, scene };
}
