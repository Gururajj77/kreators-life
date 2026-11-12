/**
 * Where a helper tooltip goes (the founder, 2026-11-12: "all the helper tooltips should appear in places that have no pre-existing
 * text, like outside the popups"). A leaf with no imports and its own subpath export, `@kreators/shared/tipPlace`, so the web app
 * loads it with the smart tips after the first paint and never with the shared chunk.
 *
 * The rule is pure: the page reads the trigger, the window, the popup's panel and what is drawn around them (apps/web/src/lib/tipGeometry.ts),
 * and this picks the spot. Every side and alignment around the trigger (and around its rail, when it sits in a popup's rail) is a
 * candidate; each is scored, lower is better:
 * - any part outside the window (less the margin): rejected;
 * - each square pixel over something drawn (words, a control, a picture): 10;
 * - each square pixel over the popup's own panel, when the trigger belongs to that popup but not to its words: 4;
 * - each pixel from the trigger's centre to the tip's: 0.01 (near wins);
 * - each step down the trigger's own list of preferred sides: 1 (the old side wins a tie).
 * When nothing fits inside the window, the best candidate is pulled inside it and returned with `clamped`, so a tip is never cut.
 */

export type Rect = { x: number; y: number; w: number; h: number };
export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Align = 'start' | 'center' | 'end';
export type Size = { w: number; h: number };

export interface TipInput {
  /** The control the tip names, in window coordinates. */
  trigger: Rect;
  /** The tip's own size. */
  size: Size;
  /** The window. */
  view: Size;
  /** Room between the trigger (or its rail) and the tip. */
  gap?: number;
  /** Room the tip keeps from the window's edges. */
  margin?: number;
  /** A popup's panel the tip stays off (given only when the trigger belongs to the popup but not to its words). */
  panel?: Rect;
  /** The whole rail when the trigger sits in a popup's rail: the tip may stand beside the rail rather than the button. */
  group?: Rect;
  /** What is drawn around the trigger: words' lines, controls, pictures. */
  obstacles: Rect[];
  /** The sides the trigger leans to, first the one it always had. */
  prefer: Array<[Side, Align]>;
}

export interface TipSpot {
  x: number;
  y: number;
  side: Side;
  align: Align;
  score: number;
  clamped: boolean;
}

export interface TipCandidate {
  x: number;
  y: number;
  side: Side;
  align: Align;
  /** Placed beside the rail rather than the button. */
  byGroup: boolean;
}

const SIDES: Side[] = ['top', 'bottom', 'left', 'right'];
const ALIGNS: Align[] = ['center', 'start', 'end'];
/** Every side and alignment, in the order used after a trigger's own list. */
export const ALL_SPOTS: Array<[Side, Align]> = SIDES.flatMap((s) => ALIGNS.map((a): [Side, Align] => [s, a]));

export const TIP_REJECT = 1e9;
export const TIP_OBSTACLE_COST = 10;
export const TIP_PANEL_COST = 4;
export const TIP_DISTANCE_COST = 0.01;

/** The area two rects share. */
export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** The tip placed on one side of `anchor`, lined up by `align` on the other axis, against the trigger's own centre when `cross` is given. */
function spotBeside(anchor: Rect, size: Size, gap: number, side: Side, align: Align, cross?: Rect): { x: number; y: number } {
  const c = cross ?? anchor;
  if (side === 'top' || side === 'bottom') {
    const y = side === 'top' ? anchor.y - gap - size.h : anchor.y + anchor.h + gap;
    const x = align === 'start' ? c.x : align === 'end' ? c.x + c.w - size.w : c.x + c.w / 2 - size.w / 2;
    return { x, y };
  }
  const x = side === 'left' ? anchor.x - gap - size.w : anchor.x + anchor.w + gap;
  const y = align === 'start' ? c.y : align === 'end' ? c.y + c.h - size.h : c.y + c.h / 2 - size.h / 2;
  return { x, y };
}

/**
 * Every place the tip may stand: the four sides of the trigger in three alignments, and with a rail the four sides of the rail too
 * (lined up on the trigger itself), so a phone's Close names itself beside the whole row of rail buttons rather than over the panel.
 */
export function tipCandidates(trigger: Rect, size: Size, gap = 8, group?: Rect): TipCandidate[] {
  const out: TipCandidate[] = [];
  for (const [side, align] of ALL_SPOTS) out.push({ ...spotBeside(trigger, size, gap, side, align), side, align, byGroup: false });
  if (group && (group.w > trigger.w + 1 || group.h > trigger.h + 1)) {
    for (const [side, align] of ALL_SPOTS) {
      const p = spotBeside(group, size, gap, side, align, trigger);
      // Beside the rail on the axis it runs along adds nothing the trigger's own candidates lack.
      if (out.some((o) => Math.abs(o.x - p.x) < 0.5 && Math.abs(o.y - p.y) < 0.5)) continue;
      out.push({ ...p, side, align, byGroup: true });
    }
  }
  return out;
}

/** The smallest rect that holds them all. */
export function unionRect(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function rankOf(prefer: Array<[Side, Align]>, side: Side, align: Align): number {
  const all = [...prefer, ...ALL_SPOTS];
  const i = all.findIndex(([s, a]) => s === side && a === align);
  return i < 0 ? all.length : i;
}

function fitsIn(r: Rect, view: Size, margin: number): boolean {
  return r.x >= margin - 0.5 && r.y >= margin - 0.5 && r.x + r.w <= view.w - margin + 0.5 && r.y + r.h <= view.h - margin + 0.5;
}

/** The score of a tip at `r`, without the window test. */
function costAt(r: Rect, input: TipInput, rank: number): number {
  let cost = 0;
  for (const o of input.obstacles) cost += overlapArea(r, o) * TIP_OBSTACLE_COST;
  // Never over its own trigger.
  cost += overlapArea(r, input.trigger) * TIP_OBSTACLE_COST;
  if (input.panel) cost += overlapArea(r, input.panel) * TIP_PANEL_COST;
  const dx = r.x + r.w / 2 - (input.trigger.x + input.trigger.w / 2);
  const dy = r.y + r.h / 2 - (input.trigger.y + input.trigger.h / 2);
  cost += Math.hypot(dx, dy) * TIP_DISTANCE_COST;
  return cost + rank;
}

/** Pulled inside the window, less the margin (a tip wider than the window starts at its left margin). */
function clampInto(r: Rect, view: Size, margin: number): Rect {
  const x = Math.max(margin, Math.min(r.x, view.w - margin - r.w));
  const y = Math.max(margin, Math.min(r.y, view.h - margin - r.h));
  return { ...r, x, y };
}

/** The spot for the tip: see the file's comment for the rule. */
export function pickTipSpot(input: TipInput): TipSpot {
  const gap = input.gap ?? 8;
  const margin = input.margin ?? 8;
  const { size, view } = input;
  const cands = tipCandidates(input.trigger, size, gap, input.group);
  let best: TipSpot | null = null;
  for (const c of cands) {
    const r = { x: c.x, y: c.y, w: size.w, h: size.h };
    const rank = rankOf(input.prefer, c.side, c.align) + (c.byGroup ? 0.5 : 0);
    const score = (fitsIn(r, view, margin) ? 0 : TIP_REJECT) + costAt(r, input, rank);
    if (!best || score < best.score) best = { x: c.x, y: c.y, side: c.side, align: c.align, score, clamped: false };
  }
  if (best && best.score < TIP_REJECT) return best;
  // Nothing fits: every candidate pulled inside the window, scored again, the best kept.
  let pulled: TipSpot | null = null;
  for (const c of cands) {
    const r = clampInto({ x: c.x, y: c.y, w: size.w, h: size.h }, view, margin);
    const score = costAt(r, input, rankOf(input.prefer, c.side, c.align) + (c.byGroup ? 0.5 : 0));
    if (!pulled || score < pulled.score) pulled = { x: r.x, y: r.y, side: c.side, align: c.align, score, clamped: true };
  }
  return pulled ?? { x: margin, y: margin, side: 'top', align: 'start', score: 0, clamped: true };
}
