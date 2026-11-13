/**
 * Where a helper tooltip goes (the founder, 2026-11-12: "all the helper tooltips should appear in places that have no pre-existing
 * text, like outside the popups"; 2026-11-13: "the tooltip text should remain close to the button itself not somewhere else, position
 * it right, left top or bottom accordingly"). A leaf with no imports and its own subpath export, `@kreators/shared/tipPlace`, so the web
 * app loads it with the smart tips after the first paint and never with the shared chunk.
 *
 * The rule is pure: the page reads the trigger, the window, the popup's panel and what is drawn around them (apps/web/src/lib/tipGeometry.ts),
 * and this picks the spot. A tip only ever stands beside its trigger, the gap away: above, below, left or right, each lined up on the
 * trigger's centre, its start edge or its end edge (and, where none of those fits the window, slid along that side just far enough to
 * fit). Never further out. Each candidate is scored, lower is better:
 * - any part outside the window (less the margin): rejected;
 * - each square pixel over something drawn: what that thing costs (`Obstacle.cost`, `TIP_OBSTACLE_COST` when the page says nothing),
 *   so where every side meets something the tip covers the least important thing (a field or the next control costs most, the words of
 *   the trigger's own row next, other words, a picture, and last the empty fill of a big card);
 * - each square pixel within `TIP_CLEARANCE` of something drawn: `TIP_CLEAR_COST` (near a line of words, never on it);
 * - each square pixel over the popup's own panel, when the trigger belongs to that popup but not to its words: `TIP_PANEL_COST`;
 * - each pixel from the trigger's centre to the tip's: `TIP_DISTANCE_COST` (the nearer alignment wins);
 * - each step down the trigger's own list of preferred sides, then their other alignments, then the rest: 1 (the old side wins a
 *   tie, and a side it leans to keeps it in another alignment before another side is tried); a slid spot one more half.
 * When no side fits inside the window at all, the best candidate is pulled inside it and returned with `clamped`, so a tip is never cut.
 */

export type Rect = { x: number; y: number; w: number; h: number };
/** Something drawn the tip should stay off, with what each square pixel of it costs (`TIP_OBSTACLE_COST` when not said). */
export type Obstacle = Rect & { cost?: number };
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
  /** Room between the trigger and the tip. */
  gap?: number;
  /** Room the tip keeps from the window's edges. */
  margin?: number;
  /** A popup's panel the tip stays off (given only when the trigger belongs to the popup but not to its words). */
  panel?: Rect;
  /** What is drawn around the trigger: words' lines, controls, pictures. */
  obstacles: Obstacle[];
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
  /** It meets something drawn, or the popup's own panel: the page may try a narrower tip. */
  blocked: boolean;
}

export interface TipCandidate {
  x: number;
  y: number;
  side: Side;
  align: Align;
  /** Slid along its side to fit the window, rather than lined up on an edge or the centre. */
  slid: boolean;
}

const SIDES: Side[] = ['top', 'bottom', 'left', 'right'];
const ALIGNS: Align[] = ['center', 'start', 'end'];
/** Every side and alignment, in the order used after a trigger's own list. */
export const ALL_SPOTS: Array<[Side, Align]> = SIDES.flatMap((s) => ALIGNS.map((a): [Side, Align] => [s, a]));

/** The room between a trigger and its tip. */
export const TIP_GAP = 8;
export const TIP_REJECT = 1e9;
export const TIP_OBSTACLE_COST = 10;
export const TIP_PANEL_COST = 4;
export const TIP_DISTANCE_COST = 0.01;
/** Room a tip keeps from anything drawn, so it never sits flush against a line of words (each obstacle counts this much larger). */
export const TIP_CLEARANCE = 4;
/** What a square pixel of that room costs: far less than the thing itself, so a tip that must come close comes close and never on it. */
export const TIP_CLEAR_COST = 1;
/** What a spot slid along its side to fit the window adds to its rank. */
const SLID_RANK = 0.5;

const padded = (o: Rect): Rect => ({ x: o.x - TIP_CLEARANCE, y: o.y - TIP_CLEARANCE, w: o.w + 2 * TIP_CLEARANCE, h: o.h + 2 * TIP_CLEARANCE });

/** The area two rects share. */
export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** The tip placed on one side of the trigger, lined up by `align` on the other axis. */
function spotBeside(t: Rect, size: Size, gap: number, side: Side, align: Align): { x: number; y: number } {
  if (side === 'top' || side === 'bottom') {
    const y = side === 'top' ? t.y - gap - size.h : t.y + t.h + gap;
    const x = align === 'start' ? t.x : align === 'end' ? t.x + t.w - size.w : t.x + t.w / 2 - size.w / 2;
    return { x, y };
  }
  const x = side === 'left' ? t.x - gap - size.w : t.x + t.w + gap;
  const y = align === 'start' ? t.y : align === 'end' ? t.y + t.h - size.h : t.y + t.h / 2 - size.h / 2;
  return { x, y };
}

/**
 * Every place the tip may stand: the four sides of the trigger in three alignments, and, with the window given, each side slid along
 * its length just far enough to fit the window (never so far that the tip stops spanning the trigger's middle).
 */
export function tipCandidates(trigger: Rect, size: Size, gap = TIP_GAP, view?: Size, margin = 8): TipCandidate[] {
  const out: TipCandidate[] = [];
  for (const [side, align] of ALL_SPOTS) out.push({ ...spotBeside(trigger, size, gap, side, align), side, align, slid: false });
  if (!view) return out;
  for (const side of SIDES) {
    const p = spotBeside(trigger, size, gap, side, 'center');
    const across = side === 'top' || side === 'bottom';
    // Slid along the side, never past the trigger's middle: the tip always spans it, so it reads as that trigger's name.
    const mid = across ? trigger.x + trigger.w / 2 : trigger.y + trigger.h / 2;
    const long = across ? size.w : size.h;
    const lo = Math.max(margin, mid - long);
    const hi = Math.min((across ? view.w : view.h) - margin - long, mid);
    if (lo > hi) continue;
    const v = across ? p.x : p.y;
    const fit = Math.max(lo, Math.min(v, hi));
    if (Math.abs(fit - v) < 0.5) continue;
    const q = across ? { x: fit, y: p.y } : { x: p.x, y: fit };
    if (out.some((o) => Math.abs(o.x - q.x) < 0.5 && Math.abs(o.y - q.y) < 0.5)) continue;
    const align: Align = fit > v ? 'start' : 'end';
    out.push({ ...q, side, align, slid: true });
  }
  return out;
}

/** Whether a tip at `r` meets anything drawn, its trigger, or the popup's panel. */
function meets(r: Rect, input: TipInput): boolean {
  if (overlapArea(r, input.trigger) > 0) return true;
  if (input.panel && overlapArea(r, input.panel) > 0) return true;
  return input.obstacles.some((o) => overlapArea(r, padded(o)) > 0);
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

/** The trigger's own list, then the other alignments of the sides in it (keep the side, move the alignment), then every spot. */
function rankOf(prefer: Array<[Side, Align]>, side: Side, align: Align): number {
  const all = [...prefer, ...prefer.flatMap(([s]) => ALIGNS.map((a): [Side, Align] => [s, a])), ...ALL_SPOTS];
  const i = all.findIndex(([s, a]) => s === side && a === align);
  return i < 0 ? all.length : i;
}

function fitsIn(r: Rect, view: Size, margin: number): boolean {
  return r.x >= margin - 0.5 && r.y >= margin - 0.5 && r.x + r.w <= view.w - margin + 0.5 && r.y + r.h <= view.h - margin + 0.5;
}

/** The score of a tip at `r`, without the window test. */
function costAt(r: Rect, input: TipInput, rank: number): number {
  let cost = 0;
  for (const o of input.obstacles) {
    const inner = overlapArea(r, o);
    cost += (overlapArea(r, padded(o)) - inner) * TIP_CLEAR_COST + inner * (o.cost ?? TIP_OBSTACLE_COST);
  }
  // Never over its own trigger.
  cost += overlapArea(r, input.trigger) * TIP_OBSTACLE_COST;
  if (input.panel) cost += overlapArea(r, input.panel) * TIP_PANEL_COST;
  const dx = r.x + r.w / 2 - (input.trigger.x + input.trigger.w / 2);
  const dy = r.y + r.h / 2 - (input.trigger.y + input.trigger.h / 2);
  return cost + Math.hypot(dx, dy) * TIP_DISTANCE_COST + rank;
}

/** Pulled inside the window, less the margin (a tip wider than the window starts at its left margin). */
function clampInto(r: Rect, view: Size, margin: number): Rect {
  const x = Math.max(margin, Math.min(r.x, view.w - margin - r.w));
  const y = Math.max(margin, Math.min(r.y, view.h - margin - r.h));
  return { ...r, x, y };
}

/** The spot for the tip: see the file's comment for the rule. */
export function pickTipSpot(input: TipInput): TipSpot {
  const gap = input.gap ?? TIP_GAP;
  const margin = input.margin ?? 8;
  const { size, view } = input;
  const cands = tipCandidates(input.trigger, size, gap, view, margin);
  let best: TipSpot | null = null;
  for (const c of cands) {
    const r = { x: c.x, y: c.y, w: size.w, h: size.h };
    const rank = rankOf(input.prefer, c.side, c.align) + (c.slid ? SLID_RANK : 0);
    const score = (fitsIn(r, view, margin) ? 0 : TIP_REJECT) + costAt(r, input, rank);
    if (!best || score < best.score) best = { x: c.x, y: c.y, side: c.side, align: c.align, score, clamped: false, blocked: meets(r, input) };
  }
  if (best && best.score < TIP_REJECT) return best;
  // No side fits the window (a window smaller than the tip and its trigger): every candidate pulled inside it, scored again, the best kept.
  let pulled: TipSpot | null = null;
  for (const c of cands) {
    const r = clampInto({ x: c.x, y: c.y, w: size.w, h: size.h }, view, margin);
    const score = costAt(r, input, rankOf(input.prefer, c.side, c.align));
    if (!pulled || score < pulled.score) pulled = { x: r.x, y: r.y, side: c.side, align: c.align, score, clamped: true, blocked: meets(r, input) };
  }
  return pulled ?? { x: margin, y: margin, side: 'top', align: 'start', score: 0, clamped: true, blocked: true };
}

/**
 * How far a tip stands from its trigger on the side it is on, and whether it is beside it (2026-11-13): the facing edges at most `slack`
 * apart and not overlapping, and the two spans meeting along that side. The drive reads the same rule from the page.
 */
export function besideTrigger(tip: Rect, trigger: Rect, slack = 12): { beside: boolean; gap: number; side: Side | null } {
  const gaps: Array<[Side, number, boolean]> = [
    ['top', trigger.y - (tip.y + tip.h), tip.x < trigger.x + trigger.w && tip.x + tip.w > trigger.x],
    ['bottom', tip.y - (trigger.y + trigger.h), tip.x < trigger.x + trigger.w && tip.x + tip.w > trigger.x],
    ['left', trigger.x - (tip.x + tip.w), tip.y < trigger.y + trigger.h && tip.y + tip.h > trigger.y],
    ['right', tip.x - (trigger.x + trigger.w), tip.y < trigger.y + trigger.h && tip.y + tip.h > trigger.y],
  ];
  let near: [Side, number] | null = null;
  for (const [side, g, along] of gaps) {
    if (!along || g < -0.5) continue;
    if (!near || g < near[1]) near = [side, g];
  }
  if (!near) {
    const g = Math.max(...gaps.map(([, v]) => v));
    return { beside: false, gap: Math.round(g), side: null };
  }
  return { beside: near[1] <= slack, gap: Math.round(near[1]), side: near[0] };
}
