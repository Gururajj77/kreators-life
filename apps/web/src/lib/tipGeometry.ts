import { pickTipSpot, tipCandidates, type Align, type Rect, type Side, type TipSpot } from '@kreators/shared/tipPlace';

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
  group?: Rect;
  obstacles: Rect[];
}

/** What a hit on the page is when it is a control: its box keeps a tip off. */
const CONTROL = 'button, a[href], input, select, textarea, summary, label, [role=button], [role=tab], [role=switch], [contenteditable], [tabindex]:not([tabindex="-1"])';
const PICTURE = 'img, svg, canvas, video, picture, [role=img]';
/** How far up from a hit a control may be and still own it (an icon's path inside its button). */
const CONTROL_DEPTH = 4;
/** About the most points the page is asked about for one tip. */
const MAX_HITS = 600;
/** How close to a panel's border a control in its padding counts as on its edge. */
const EDGE = 56;

const rectOf = (r: DOMRect | DOMRectReadOnly): Rect => ({ x: r.left, y: r.top, w: r.width, h: r.height });

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

/** The line boxes of an element's own words (its direct text, not its children's). */
function ownTextLines(el: Element): Rect[] {
  const out: Rect[] = [];
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType !== Node.TEXT_NODE || !n.textContent?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of Array.from(range.getClientRects())) if (r.width > 0 && r.height > 0) out.push(rectOf(r));
  }
  return out;
}

/** Whether a box holds the trigger's whole box. */
function holds(b: DOMRect, t: Rect): boolean {
  return b.left <= t.x && b.top <= t.y && b.right >= t.x + t.w && b.bottom >= t.y + t.h;
}

/** A control within a few steps up from a hit, if any. */
function controlOf(hit: Element): Element | null {
  let el: Element | null = hit;
  for (let i = 0; el && i <= CONTROL_DEPTH; i += 1, el = el.parentElement) if (el.matches(CONTROL)) return el;
  return null;
}

/**
 * Everything the rule needs, read once: the trigger, the window, the popup's panel (when the tip stays off it), the rail, and what is
 * drawn in the room the candidates cover. The page is asked point by point over that room (`elementFromPoint`, at most `MAX_HITS`
 * times), and each element it answers is a control's box, a picture's box or its own words' lines; an empty box (a card's fill, a
 * section's ground) and a modal's scrim are free room. `skip` is the tip itself, which must not be hit.
 */
export function sceneFor(trigger: Element, size: { w: number; h: number }, skip?: Element | null): TipScene {
  const t = rectOf(trigger.getBoundingClientRect());
  const view = { w: document.documentElement.clientWidth, h: window.innerHeight };
  const frame = trigger.closest('.dialog-frame');
  const panelEl = panelOf(frame);
  const panel = panelEl && staysOffPanel(trigger, panelEl) ? rectOf(panelEl.getBoundingClientRect()) : undefined;
  const railEl = trigger.closest('.dialog-rail');
  const group = railEl ? rectOf(railEl.getBoundingClientRect()) : undefined;

  const cands = tipCandidates(t, size, 8, group).map((c) => ({ x: c.x, y: c.y, w: size.w, h: size.h }));
  const obstacles: Rect[] = [];
  const seen = new Set<Element>();
  const asked = new Set<string>();
  // Each candidate is asked about on a small grid that reaches half a pixel past its edges, so a box that only grazes it is found
  // too; points already asked about are skipped. About `MAX_HITS` points for all of them together.
  const per = Math.max(16, MAX_HITS / Math.max(1, cands.length));
  for (const c of cands) {
    const step = Math.max(8, Math.ceil(Math.sqrt((c.w * c.h) / per)));
    const cols = Math.max(2, Math.ceil(c.w / step) + 1);
    const rows = Math.max(2, Math.ceil(c.h / step) + 1);
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        const x = c.x - 0.5 + ((c.w + 1) * i) / (cols - 1);
        const y = c.y - 0.5 + ((c.h + 1) * j) / (rows - 1);
        if (x < 0 || y < 0 || x >= view.w || y >= view.h) continue;
        const key = `${Math.round(x * 2)}:${Math.round(y * 2)}`;
        if (asked.has(key)) continue;
        asked.add(key);
        const hit = document.elementFromPoint(x, y);
        if (!hit || seen.has(hit)) continue;
        seen.add(hit);
        if (hit === trigger || trigger.contains(hit) || (skip && skip.contains(hit)) || hit.closest('.sheet-scrim')) continue;
        const control = controlOf(hit);
        // A control round the trigger (a big clickable card) is read by its words instead, like any other box.
        if (control && !control.contains(trigger) && !trigger.contains(control) && !holds(control.getBoundingClientRect(), t)) {
          if (!seen.has(control) || control === hit) obstacles.push(rectOf(control.getBoundingClientRect()));
          seen.add(control);
          continue;
        }
        const picture = hit.matches(PICTURE) ? hit : hit.closest('svg');
        if (picture && !picture.contains(trigger) && !trigger.contains(picture)) {
          if (!seen.has(picture) || picture === hit) obstacles.push(rectOf(picture.getBoundingClientRect()));
          seen.add(picture);
          continue;
        }
        obstacles.push(...ownTextLines(hit));
      }
    }
  }
  return { trigger: t, view, panel, group, obstacles };
}

/**
 * Reads the scene, picks the spot and writes the tip's `left` and `top` once. The tip is hidden while the page is read so it is never
 * hit, and keeps its own visibility after. With `relativeTo`, the place is written against that element's box (a tip that is
 * positioned inside a fixed wrapper, like the assistant's bubble); otherwise against the window (a fixed or top-layer tip).
 */
export function placeTip(trigger: Element, el: HTMLElement, prefer: Prefer, relativeTo?: Element | null): TipSpot {
  const before = el.style.visibility;
  el.style.visibility = 'hidden';
  const box = el.getBoundingClientRect();
  const size = { w: Math.ceil(box.width), h: Math.ceil(box.height) };
  const spot = pickTipSpot({ ...sceneFor(trigger, size, el), size, prefer });
  const base = relativeTo?.getBoundingClientRect();
  el.style.left = `${Math.round(spot.x - (base?.left ?? 0))}px`;
  el.style.top = `${Math.round(spot.y - (base?.top ?? 0))}px`;
  el.style.visibility = before;
  return spot;
}
