import { panelOf, placeTip, type Prefer } from './tipGeometry';

/**
 * Smart tips (the founder, 2026-11-12: "all the helper tooltips should appear in places that have no pre-existing text, like outside
 * the popups"; 2026-11-13: "the tooltip text should remain close to the button itself not somewhere else, position it right, left top
 * or bottom accordingly"). One floating name for every `data-tip` trigger in the app, placed by `placeTip` beside its trigger, the gap
 * away, above, below, left or right, on the side that covers least (off words, a control or a picture where a side is clear, outside a
 * popup's panel when that side is free), always inside the window, never further out. It shows on a mouse pointing (a fine pointer that can hover) and on keyboard focus reached by Tab or an arrow key, never on
 * a touch and never on the focus a popup gives its own Close as it opens; Escape, a press, a scroll or a resize hides it.
 *
 * Root starts it after the first paint (`startSmartTips`, a chunk of its own like the rectangle fixer); until then the CSS name drawn
 * by `::after` stands in on a page (app.css, "Smart tips"). The name is `aria-hidden`: every trigger already says it in its label.
 * A trigger with a native `title` beside its label is taken in too, its `title` moved aside while the tip shows, so the browser never
 * draws a second name.
 */

const TRIGGER = '[data-tip], [data-tip-title], :is(button, a, [role=button], [role=tab]):is([aria-label], [aria-labelledby])[title]';
const NAV_KEYS = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);
/** How long after a Tab or an arrow key a focus counts as the keyboard's. */
const KEY_WINDOW = 1000;
/** Past this many characters the name may wrap inside its width. */
const WRAP_AT = 40;
/** A name longer than this may go on two lines, `NARROW_W` wide, when it has no clear room on one. */
const NARROW_AT = 16;
const NARROW_W = 130;

const SIDE_ALIGN: Record<string, [Prefer[number][0], Prefer[number][1]]> = {
  top: ['top', 'center'],
  bottom: ['bottom', 'center'],
  left: ['left', 'center'],
  right: ['right', 'center'],
};

/** The sides a trigger leans to, its old one first, so a tie keeps the place people know. */
export function preferFor(trigger: Element): Prefer {
  const rail = trigger.closest('.dialog-rail');
  if (rail) {
    const panel = panelOf(rail.closest('.dialog-frame'));
    if (panel) {
      const r = rail.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      // The side that faces away from the panel: a laptop sheet's rail is on its right, the assistant's on its left, a phone's above.
      const away: Prefer[number] = r.left >= p.right - 1 ? ['right', 'center'] : r.right <= p.left + 1 ? ['left', 'center'] : r.bottom <= p.top + 1 ? ['top', 'end'] : ['bottom', 'end'];
      return [away, ['top', 'end'], ['bottom', 'end']];
    }
  }
  // An explicit lean: "right", or "bottom-end".
  const at = (trigger as HTMLElement).dataset?.tipAt;
  if (at) {
    const [side = '', align] = at.split('-');
    const base = Object.hasOwn(SIDE_ALIGN, side) ? SIDE_ALIGN[side] : undefined;
    if (base) return [[base[0], (align as Prefer[number][1]) || base[1]], ['bottom', 'center'], ['top', 'center']];
  }
  if (trigger.classList.contains('app-eye')) return [['left', 'center']];
  if (trigger.classList.contains('mf-round')) {
    const old = (trigger as HTMLElement).dataset.at;
    if (old === 'tl') return [['top', 'start']];
    if (old === 'tr') return [['top', 'end']];
    if (old === 'br') return [['top', 'end'], ['bottom', 'end']];
    return [['top', 'center']];
  }
  return [['bottom', 'center'], ['top', 'center']];
}

/** Whether this element takes a smart tip (an ExpandButton on a page shows its own words, a glossary card is its own). */
function takes(el: Element): boolean {
  if (el.closest('[data-term-tip]')) return false;
  if (el.classList.contains('expand-btn') && el.querySelector('.expand-btn-words') && !el.closest('.dialog-rail')) return false;
  return Boolean(wordsOf(el));
}

function wordsOf(el: Element): string {
  const h = el as HTMLElement;
  return (h.dataset.tip ?? h.dataset.tipTitle ?? h.getAttribute('title') ?? '').trim();
}

type Pt = { x: number; y: number };

/** The convex hull of some points (Andrew's monotone chain), anticlockwise in screen terms. */
function hull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Pt[] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Whether a point lies in a convex polygon (or on its edge). */
function inside(poly: Pt[], q: Pt): boolean {
  if (poly.length < 3) return false;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if ((b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x) < 0) return false;
  }
  return true;
}

/** How far round the trigger and the name the pointer may stray on its way from one to the other. */
const BRIDGE_SLACK = 6;

/** The trigger, the name and the strip between them, as one shape the pointer may cross without the name going (WCAG 1.4.13). */
function bridgeOf(a: DOMRect, b: DOMRect): Pt[] {
  const corners = (r: DOMRect): Pt[] => [
    { x: r.left - BRIDGE_SLACK, y: r.top - BRIDGE_SLACK },
    { x: r.right + BRIDGE_SLACK, y: r.top - BRIDGE_SLACK },
    { x: r.right + BRIDGE_SLACK, y: r.bottom + BRIDGE_SLACK },
    { x: r.left - BRIDGE_SLACK, y: r.bottom + BRIDGE_SLACK },
  ];
  return hull([...corners(a), ...corners(b)]);
}

function triggerOf(target: EventTarget | null): HTMLElement | null {
  const el = target instanceof Element ? target.closest<HTMLElement>(TRIGGER) : null;
  return el && takes(el) ? el : null;
}

/** Starts the smart tips; the function it returns takes every listener, the tip and the page's mark away again. */
export function startSmartTips(): () => void {
  const doc = document;
  const root = doc.documentElement;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const tip = doc.createElement('div');
  tip.className = 'smart-tip';
  tip.setAttribute('role', 'tooltip');
  tip.setAttribute('aria-hidden', 'true');
  const layered = typeof tip.showPopover === 'function';
  if (layered) tip.setAttribute('popover', 'manual');
  else tip.hidden = true;
  doc.body.appendChild(tip);
  root.dataset.smartTips = '';

  let current: HTMLElement | null = null;
  /** How it was shown: a mouse pointing, or the keyboard's focus. */
  let by: 'mouse' | 'focus' = 'mouse';
  let lastNavKey = 0;
  let watch = 0;
  let replace = 0;
  /** While a mouse travels from the trigger to its name across the gap between them: the shape it may cross. */
  let bridge: Pt[] | null = null;

  const open = () => {
    if (layered) {
      if (!tip.matches(':popover-open')) tip.showPopover();
    } else tip.hidden = false;
  };
  const shut = () => {
    if (layered) {
      if (tip.matches(':popover-open')) tip.hidePopover();
    } else tip.hidden = true;
  };

  /** Where the tip stands against its trigger, so a scroll moves it with the trigger and only a settled page is read again. */
  let offset = { dx: 0, dy: 0 };
  let settle = 0;
  const remember = () => {
    if (!current) return;
    const t = current.getBoundingClientRect();
    offset = { dx: parseFloat(tip.style.left) - t.left, dy: parseFloat(tip.style.top) - t.top };
  };

  const place = () => {
    if (!current) return;
    let spot = placeTip(current, tip, preferFor(current));
    // A long name with no clear side (a rail near the window's edge, a table's crowded rows): try it on two lines, narrower, still beside
    // its trigger, and keep that if it fits clear or covers less; else the first place is put back as it was found, never read a third time.
    if (spot.blocked && tip.dataset.wrap === undefined && (tip.textContent ?? '').length > NARROW_AT) {
      const wide = { left: tip.style.left, top: tip.style.top };
      tip.dataset.wrap = '';
      tip.style.maxWidth = `${NARROW_W}px`;
      const narrow = placeTip(current, tip, preferFor(current), null, { scene: spot.scene });
      if (narrow.blocked && narrow.score >= spot.score) {
        delete tip.dataset.wrap;
        tip.style.maxWidth = '';
        tip.style.left = wide.left;
        tip.style.top = wide.top;
      } else spot = narrow;
    }
    tip.dataset.side = spot.side;
    remember();
  };

  const hide = () => {
    window.clearInterval(watch);
    window.clearTimeout(settle);
    bridge = null;
    window.cancelAnimationFrame(replace);
    watch = 0;
    if (current) {
      current.removeAttribute('data-tip-on');
      // Its own title back, as it had it.
      const kept = current.dataset.tipTitle;
      if (kept !== undefined) {
        current.setAttribute('title', kept);
        delete current.dataset.tipTitle;
      }
    }
    current = null;
    tip.removeAttribute('data-on');
    shut();
  };

  const show = (trigger: HTMLElement, how: 'mouse' | 'focus') => {
    if (current === trigger) return;
    hide();
    const words = wordsOf(trigger);
    if (!words) return;
    // A native title beside a label: moved aside so the browser draws no second name.
    if (trigger.dataset.tip === undefined && trigger.hasAttribute('title')) {
      trigger.dataset.tipTitle = trigger.getAttribute('title') ?? '';
      trigger.removeAttribute('title');
    }
    current = trigger;
    by = how;
    trigger.setAttribute('data-tip-on', '');
    tip.textContent = words;
    tip.style.maxWidth = '';
    if (words.length > WRAP_AT) tip.dataset.wrap = '';
    else delete tip.dataset.wrap;
    tip.style.visibility = 'hidden';
    tip.style.left = '0px';
    tip.style.top = '0px';
    open();
    place();
    tip.style.visibility = '';
    tip.setAttribute('data-on', '');
    // A trigger that leaves the page (its popup closed, its row went) takes its name with it.
    watch = window.setInterval(() => {
      if (current && (!current.isConnected || current.getClientRects().length === 0)) hide();
    }, 250);
  };

  const onOver = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !fine.matches) return;
    const t = triggerOf(e.target);
    if (t) show(t, 'mouse');
  };
  /**
   * Hoverable (WCAG 1.4.13, 2026-11-13): the name stands the gap away from its trigger and takes no pointer itself, so leaving the trigger
   * does not hide it at once: it stays while the pointer is on the trigger, on the name or on the strip between the two (`bridgeOf`),
   * and goes as soon as the pointer leaves that shape, the window, or points at another trigger.
   */
  const onOut = (e: PointerEvent) => {
    if (!current || by !== 'mouse') return;
    const to = e.relatedTarget;
    if (to instanceof Node && current.contains(to)) return;
    if (!to) {
      hide();
      return;
    }
    bridge = bridgeOf(current.getBoundingClientRect(), tip.getBoundingClientRect());
    if (!inside(bridge, { x: e.clientX, y: e.clientY })) hide();
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!bridge || !current || by !== 'mouse') return;
    if (!inside(bridge, { x: e.clientX, y: e.clientY })) hide();
  };
  const onFocusIn = (e: FocusEvent) => {
    const t = triggerOf(e.target);
    if (!t || t !== e.target) return;
    // Only the keyboard's own steps: a popup's first focus on its Close, or a tap, names nothing.
    if (Date.now() - lastNavKey > KEY_WINDOW || !t.matches(':focus-visible')) return;
    show(t, 'focus');
  };
  const onFocusOut = (e: FocusEvent) => {
    if (current && by === 'focus' && e.target instanceof Node && current.contains(e.target)) hide();
  };
  const onKey = (e: KeyboardEvent) => {
    if (NAV_KEYS.has(e.key)) lastNavKey = Date.now();
    // Enter or Space opens things (a popup that then focuses its own Close): what it focuses next is not a Tab's step.
    else if (e.key === 'Enter' || e.key === ' ') lastNavKey = 0;
    // Escape hides the name and still reaches the popup's own Escape (nothing is prevented).
    if (current && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) hide();
  };
  /**
   * A scroll or a resize: a mouse's name goes; the keyboard's follows its trigger (focus scrolls the page to it): each frame it only moves
   * with the trigger, and the page around it is read again once the scroll has rested, so a scroll never asks the page thousands of times.
   */
  const onMove = (e: Event) => {
    if (!current) return;
    if (by === 'mouse') {
      hide();
      return;
    }
    window.cancelAnimationFrame(replace);
    window.clearTimeout(settle);
    if (e.type === 'resize') {
      replace = window.requestAnimationFrame(place);
      return;
    }
    replace = window.requestAnimationFrame(() => {
      if (!current) return;
      const t = current.getBoundingClientRect();
      tip.style.left = `${Math.round(t.left + offset.dx)}px`;
      tip.style.top = `${Math.round(t.top + offset.dy)}px`;
    });
    settle = window.setTimeout(() => {
      replace = window.requestAnimationFrame(place);
    }, 150);
  };
  const onHidden = () => {
    if (doc.visibilityState === 'hidden') hide();
  };

  doc.addEventListener('pointerover', onOver, { capture: true, passive: true });
  doc.addEventListener('pointerout', onOut, { capture: true, passive: true });
  doc.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
  doc.addEventListener('focusin', onFocusIn, true);
  doc.addEventListener('focusout', onFocusOut, true);
  doc.addEventListener('keydown', onKey, true);
  doc.addEventListener('pointerdown', hide, { capture: true, passive: true });
  doc.addEventListener('scroll', onMove, { capture: true, passive: true });
  window.addEventListener('resize', onMove, { passive: true });
  doc.addEventListener('visibilitychange', onHidden);

  return () => {
    hide();
    doc.removeEventListener('pointerover', onOver, true);
    doc.removeEventListener('pointerout', onOut, true);
    doc.removeEventListener('pointermove', onPointerMove, true);
    doc.removeEventListener('focusin', onFocusIn, true);
    doc.removeEventListener('focusout', onFocusOut, true);
    doc.removeEventListener('keydown', onKey, true);
    doc.removeEventListener('pointerdown', hide, true);
    doc.removeEventListener('scroll', onMove, true);
    window.removeEventListener('resize', onMove);
    doc.removeEventListener('visibilitychange', onHidden);
    tip.remove();
    delete root.dataset.smartTips;
  };
}
