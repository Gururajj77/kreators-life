import { panelOf, placeTip, type Prefer } from './tipGeometry';

/**
 * Smart tips (the founder, 2026-11-12: "all the helper tooltips should appear in places that have no pre-existing text, like outside
 * the popups"). One floating name for every `data-tip` trigger in the app, placed by `placeTip` in the empty room nearest its trigger:
 * never over words, a control or a picture, outside a popup's panel whenever the window has room (over the scrim), always inside the
 * window. It shows on a mouse pointing (a fine pointer that can hover) and on keyboard focus reached by Tab or an arrow key, never on
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

  const place = () => {
    if (!current) return;
    const spot = placeTip(current, tip, preferFor(current));
    tip.dataset.side = spot.side;
  };

  const hide = () => {
    window.clearInterval(watch);
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
  const onOut = (e: PointerEvent) => {
    if (!current || by !== 'mouse') return;
    const to = e.relatedTarget;
    if (to instanceof Node && current.contains(to)) return;
    hide();
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
  /** A scroll or a resize: a mouse's name goes; the keyboard's follows its trigger (focus scrolls the page to it). */
  const onMove = () => {
    if (!current) return;
    if (by === 'mouse') {
      hide();
      return;
    }
    window.cancelAnimationFrame(replace);
    replace = window.requestAnimationFrame(place);
  };
  const onHidden = () => {
    if (doc.visibilityState === 'hidden') hide();
  };

  doc.addEventListener('pointerover', onOver, { capture: true, passive: true });
  doc.addEventListener('pointerout', onOut, { capture: true, passive: true });
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
