/**
 * The landing itself, for `useLandOnHash` (lib/useLandOnHash.ts): its own small chunk, downloaded the first time a link carries a hash.
 * See that file for what it does.
 */
export const LAND_WAIT_MS = 8000;
/** How long it keeps following with nothing moving, and the most it follows at all; the person's own scroll, tap or key ends it at once. */
const SETTLE_MS = 2500;
const SETTLE_MAX_MS = 6000;
const GAP = 16;

const shown = (el: Element) => el.getClientRects().length > 0;

function findTarget(id: string): HTMLElement | null {
  const byId = document.getElementById(id);
  if (byId && shown(byId)) return byId;
  for (const el of document.querySelectorAll<HTMLElement>('[data-land]')) {
    if ((el.dataset.land ?? '').split(/\s+/).includes(id) && shown(el)) return el;
  }
  return null;
}

function toggleOf(el: HTMLElement): HTMLElement | null {
  if (el.getAttribute('aria-expanded') !== null) return el;
  return el.querySelector<HTMLElement>('[data-land-open][aria-expanded]');
}

/** How much of the window's top a bar may cover: the condensed title bar (fixed once a page's title scrolls away), or the public site's header from the width where it is sticky. */
export function topBarHeight(): number {
  const condensed = document.querySelector('.fx-condensed')?.getBoundingClientRect().height ?? 0;
  const header = document.querySelector('.fx-header');
  const site = header && getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().height : 0;
  return Math.max(condensed, site);
}

/** Where the window belongs for `el` to sit just under the title bar, as far as the page can scroll right now. */
function wantedScroll(el: HTMLElement): number {
  const bar = topBarHeight();
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const top = el.getBoundingClientRect().top + window.scrollY - Math.max(margin, bar + GAP, GAP);
  return Math.max(0, Math.min(top, document.documentElement.scrollHeight - window.innerHeight));
}

export function scrollToTarget(el: HTMLElement, smooth: boolean) {
  const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto';
  if (el.closest('[role="dialog"]')) {
    el.scrollIntoView({ block: 'center', behavior });
    return;
  }
  window.scrollTo({ top: wantedScroll(el), behavior });
}

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';

function focusTarget(el: HTMLElement, toggle: HTMLElement | null, firstLoad: boolean) {
  const now = document.activeElement;
  // Someone who already clicked into a field or a button on the new page keeps their place.
  if (now && now !== document.body && now !== document.documentElement && !now.closest('[role="dialog"]')) return;
  const heading = /^H[1-6]$/.test(el.tagName) ? el : el.querySelector<HTMLElement>('h1, h2, h3, h4');
  const to = toggle ?? heading ?? el;
  if (!to.matches(FOCUSABLE)) to.setAttribute('tabindex', '-1');
  // A page opened straight on a section (a link from outside, a reload): no key has been pressed, yet a browser draws the ring for a focus
  // moved by script. A mouse or a finger never draws it, so neither does this; the next Tab moves on and the ring is back (app.css).
  if (firstLoad) {
    to.setAttribute('data-land-quiet', '');
    to.addEventListener('blur', () => to.removeAttribute('data-land-quiet'), { once: true });
  }
  to.focus({ preventScroll: true });
}

/** Lands on `id` once it is in the page; returns a stop function. */
export function land(id: string, samePage: boolean, firstLoad = false): () => void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let done = false;
  let observer: MutationObserver | null = null;
  let frame = 0;
  let timer = 0;
  const stopSettle: (() => void)[] = [];
  const stop = () => {
    done = true;
    observer?.disconnect();
    cancelAnimationFrame(frame);
    window.clearTimeout(timer);
    for (const f of stopSettle) f();
  };

  const arrive = (el: HTMLElement) => {
    // Opened first, so the scroll measures the section as it will stand; a click is what a person would do, so the
    // component's own state (and its aria-expanded) follows.
    const toggle = toggleOf(el);
    if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
    scrollToTarget(el, samePage && !reduced);
    focusTarget(el, toggle, firstLoad);
    if (samePage) return stop();
    // The page is usually still growing: a fold's panel comes with its data and a list above or below it loads late. A scroll made before
    // that stops at the page's old end, so this keeps going to where the section belongs until things settle (the run's Photos and people,
    // Daily's Supplements); inside a sheet, which scrolls itself, it only holds the row where it landed.
    const inSheet = Boolean(el.closest('[role="dialog"]'));
    const where = () => el.getBoundingClientRect().top;
    let at = where();
    const quit = () => stop();
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
    for (const e of events) window.addEventListener(e, quit, { passive: true, capture: true });
    stopSettle.push(() => {
      for (const e of events) window.removeEventListener(e, quit, { capture: true });
    });
    const start = performance.now();
    let until = start + SETTLE_MS;
    let lastY = window.scrollY;
    let lastPlace = at + lastY;
    let lastHeight = document.documentElement.scrollHeight;
    const follow = () => {
      const now = performance.now();
      if (done || !el.isConnected || now > until) return stop();
      // The window moved while the section stayed where it is in the page, on a page no shorter than before, and this loop did not do it: the
      // person did. Chrome also sends a pointerdown for its scrollbar (the events above); a browser that sends nothing for it ends the follow
      // here, so a drag is never pulled back. Content growing above the section moves the section too, so that is never taken for the person.
      const height = document.documentElement.scrollHeight;
      if (!inSheet && Math.abs(window.scrollY - lastY) > 4 && Math.abs(where() + window.scrollY - lastPlace) < 2 && height >= lastHeight) return stop();
      lastHeight = height;
      const off = inSheet ? where() - at : wantedScroll(el) - window.scrollY;
      if (Math.abs(off) > 4) {
        scrollToTarget(el, false);
        at = where();
        until = Math.min(now + SETTLE_MS, start + SETTLE_MAX_MS);
      }
      lastY = window.scrollY;
      lastPlace = where() + lastY;
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
  };

  const look = () => {
    if (done) return;
    const el = findTarget(id);
    if (!el) return;
    observer?.disconnect();
    observer = null;
    // One frame later, so the section's own layout (and a sheet's entrance) has settled before it is measured.
    frame = requestAnimationFrame(() => !done && arrive(el));
  };
  observer = new MutationObserver(look);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class', 'aria-expanded'] });
  timer = window.setTimeout(() => {
    observer?.disconnect();
    observer = null;
  }, LAND_WAIT_MS);
  look();
  return stop;
}

