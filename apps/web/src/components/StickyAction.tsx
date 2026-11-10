import { useEffect, useRef, type ReactNode } from 'react';

/**
 * The main action that stays in reach on a phone (the founder, 2026-11-07: "Sometimes the main action button needs so much scrolling
 * and then going back up makes no sense, in such cases make it sticky above bottom menu"). Under the `md` test only.
 *
 * `StickyAction` wraps a long form's own action row where it stands. It is `position: sticky` (`.sticky-action` in app.css), so while its
 * place is further down than the screen and its form is in view it rests just above the tab bar (inside the app), the bottom edge (the
 * public site and pages without a tab bar) or the foot of a popup, and it is back in its place once that place is on screen. Nothing moves
 * in the flow: only while it is held up does a bar of `--card-strong` draw behind it, edge to edge, through a `::before`, so the row's own
 * look, width and focus order never change. While it is held up the assistant's button and the privacy card rise above it
 * (`.lift-over-sticky`), and a field that gets focus or grows under it is scrolled up above it. A row whose main button is disabled is
 * never held (`data-idle`, 2026-11-09): it waits in its place until the button can be used, read live as the form is filled.
 *
 * `FollowAction` (its own file, loaded after the first paint) is the same bar for a public page whose main action stands far from most of it.
 */

export const PHONE = 'not all and (min-width: 48rem) and (min-height: 30rem)';
/** Tall enough for a held bar: a phone held upright. On its side (or in a window the keyboard shrank) the bar and the tab bar would
 * take close to half of it, so the action stays in its place there (`max-height: 25.99rem` in app.css). */
export const ROOMY = '(min-height: 26rem)';
const matches = (q: string) => typeof window.matchMedia === 'function' && window.matchMedia(q).matches;

/** The on-screen keyboard is up (the visual viewport well short of the layout one, as the assistant reads it): a bar is never held then,
 * since it would sit over the field being typed in or behind the keyboard (`data-kb-up` on the root, app.css). */
let kbUp = false;
let kbWatched = false;
export function watchKeyboard(onChange?: () => void) {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (!vv) return () => {};
  const read = () => {
    const up = matches(PHONE) && vv.height < document.documentElement.clientHeight - 120;
    if (up !== kbUp) {
      kbUp = up;
      document.documentElement.toggleAttribute('data-kb-up', up);
    }
    onChange?.();
  };
  if (!kbWatched) {
    kbWatched = true;
    read();
  }
  vv.addEventListener('resize', read);
  return () => vv.removeEventListener('resize', read);
}
/** A bar may be held now: a phone, upright, with the keyboard down. */
export const phoneNow = () => matches(PHONE) && matches(ROOMY) && !kbUp;

/** Which bars are held up now, so the page knows to lift what floats over it. Only bars over the page count, never one inside a popup. */
export const held = new Map<HTMLElement, number>();
/** Rows just let go, still in the assistant's lane: the button rides above them by this much until they pass it (2026-11-09). */
const riding = new Map<HTMLElement, number>();
export function publish() {
  const root = document.documentElement;
  root.toggleAttribute('data-sticky-ride', held.size === 0 && riding.size > 0);
  if (held.size === 0 && riding.size === 0) {
    root.removeAttribute('data-sticky-held');
    root.style.removeProperty('--sticky-action-h');
    return;
  }
  root.setAttribute('data-sticky-held', '');
  root.style.setProperty('--sticky-action-h', `${Math.max(...held.values(), ...riding.values())}px`);
}

/** The assistant's round button where it rests (its lift taken off), or null where there is none (the Companion, a page with it off). */
function assistantHome() {
  const wrap = document.querySelector<HTMLElement>('button[aria-label="Open the assistant"]')?.parentElement;
  if (!wrap) return null;
  const r = wrap.getBoundingClientRect();
  if (!r.height) return null;
  const ty = parseFloat(getComputedStyle(wrap).translate.split(' ')[1] ?? '0') || 0;
  return { top: r.top - ty, bottom: r.bottom - ty, left: r.left, right: r.right };
}

/** How far the button must rise to stay above a row just let go that still crosses its lane: the distance it kept above the held bar
 * (36px over the row's top), so letting go never moves it, and it rides up with the row until the row has passed above its resting place. */
function rideOver(el: HTMLElement) {
  const home = assistantHome();
  if (!home) return 0;
  const r = el.getBoundingClientRect();
  if (!r.height || r.right <= home.left || r.left >= home.right) return 0;
  if (r.bottom <= home.top - 8 || r.top >= home.bottom + 8) return 0;
  return Math.max(0, Math.round(home.bottom - r.top + 36));
}

/** The phone's tab bar, measured, so a held bar rests exactly on it whatever its height (`--tabbar-h` in app.css). */
let tabBarH = '';
function measureTabBar() {
  const tab = document.querySelector<HTMLElement>('nav[data-tabbar]');
  const h = tab && tab.offsetHeight > 0 ? `${tab.offsetHeight}px` : '';
  if (h === tabBarH) return;
  tabBarH = h;
  if (h) document.documentElement.style.setProperty('--tabbar-h', h);
  else document.documentElement.style.removeProperty('--tabbar-h');
}

/** The scroll box the bar is held inside: a popup's panel, else the page. */
const scrollRootOf = (el: HTMLElement) => el.closest<HTMLElement>('.dialog-panel');

function viewBottom(root: HTMLElement | null) {
  if (!root) return window.innerHeight;
  // Sticky counts from inside the scroll box's padding.
  return root.getBoundingClientRect().top + root.clientTop + root.clientHeight - (parseFloat(getComputedStyle(root).paddingBottom) || 0);
}

/** The bar's edge-to-edge reach, from its own box out to the edges of its scroll box. */
function reach(el: HTMLElement, root: HTMLElement | null) {
  const r = el.getBoundingClientRect();
  const left = root ? root.getBoundingClientRect().left + root.clientLeft : 0;
  const right = root ? left + root.clientWidth : document.documentElement.clientWidth;
  // The ::before is placed from the padding box, so a row with its own edge adds that edge's width.
  const cs = getComputedStyle(el);
  const b = (side: string) => parseFloat(cs.getPropertyValue(`border-${side}-width`)) || 0;
  el.style.setProperty('--sa-l', `${Math.max(0, Math.floor(r.left - left)) + b('left')}px`);
  el.style.setProperty('--sa-r', `${Math.max(0, Math.floor(right - r.right)) + b('right')}px`);
  el.style.setProperty('--sa-t', `${b('top')}px`);
  el.style.setProperty('--sa-b', `${b('bottom')}px`);
}

/** The row's main button: its submit button, else its last button (a stepped form's Next or Send after its Back). */
const mainButton = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('button[type="submit"]') ?? [...el.querySelectorAll<HTMLButtonElement>('button')].pop() ?? null;
/** A tap on the row disables its button while it saves: the bar stays held that long, so it never blinks out and back. */
const PRESS_GRACE_MS = 1500;

/** What the keyboard (or a tap) can land on: a field, and since 2026-11-07 any control, so a chip or a mood button reached by Tab is never
 * left wholly under a held bar (WCAG 2.2 Focus Not Obscured). */
const FOCUSABLE = 'input, textarea, select, button, a[href], summary, [tabindex]:not([tabindex="-1"]), [contenteditable], [contenteditable] *';

/** Moves a focused control that sits under a held bar (or under the assistant's button, which floats just above a page's bar) up above it. */
function keepClear(bar: HTMLElement, root: HTMLElement | null, target: EventTarget | null) {
  if (!(target instanceof HTMLElement) || bar.contains(target)) return;
  if (!target.matches(FOCUSABLE)) return;
  // Only what scrolls in the same box: a page's bar never moves the page for a field in a popup, nor a popup's bar the page.
  if (target.closest('.dialog-panel') !== root) return;
  const field = target.getBoundingClientRect();
  let top = bar.getBoundingClientRect().top - 12 - 8;
  if (!root) {
    for (const f of document.querySelectorAll<HTMLElement>('.lift-over-sticky')) {
      const r = f.getBoundingClientRect();
      if (r.height && r.left < field.right && r.right > field.left && field.bottom > r.top - 8 && r.top < top) top = r.top - 8;
    }
  }
  if (field.bottom <= top) return;
  const by = Math.min(field.bottom - top, field.top - (root ? root.getBoundingClientRect().top : 0) - 8);
  if (by <= 0) return;
  if (root) root.scrollBy({ top: by });
  else window.scrollBy({ top: by });
}

interface Props {
  children: ReactNode;
  /** The row's own classes (its margin, its flex layout): the wrapper takes them, so the row looks as it did. */
  className?: string;
  /** Words for screen readers on the row, such as "Save your profile". */
  label?: string;
  /** The row's role with a label: a group, or a region where the row was one before. */
  role?: 'group' | 'region';
}

export function StickyAction({ children, className = '', label, role = 'group' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    let stuck = false;
    let letGo = false;
    let pressed = 0;
    let graceTimer = 0;
    const root = scrollRootOf(el);
    // A row whose main button cannot be used yet (Add task with no title, List it before a price) is not held: it stays in its place, with
    // no bar, until the button can be used (the founder, 2026-11-09). `data-idle` makes it static on a phone (app.css), so the check below
    // sees it is not sticky and draws, lifts and holds nothing.
    const idleNow = () => {
      const b = mainButton(el);
      if (!b || !(b.disabled || b.getAttribute('aria-disabled') === 'true')) return false;
      const left = PRESS_GRACE_MS - (performance.now() - pressed);
      if (left > 0) {
        if (!graceTimer) graceTimer = window.setTimeout(() => ((graceTimer = 0), soon()), left + 16);
        return false;
      }
      return true;
    };
    const check = () => {
      frame = 0;
      el.toggleAttribute('data-idle', idleNow());
      let now = false;
      const cs = getComputedStyle(el);
      // Held wherever it is sticky now: on a phone by app.css, and from `md` where the row asks for it itself (the Public page's Save bar),
      // so a focused field is kept clear of it there too. Only the phone draws the bar and lifts what floats over it.
      if (cs.position === 'sticky' && el.getClientRects().length > 0) {
        if (phoneNow()) measureTabBar();
        const bottom = parseFloat(cs.bottom) || 0;
        const line = viewBottom(root) - bottom;
        const r = el.getBoundingClientRect();
        // Held: sticky has lifted it to the line above the bar's floor. Above the line it is in its own place (or its form has scrolled on).
        now = Math.abs(r.bottom - line) < 1.5 && r.top > 0;
      }
      if (now) reach(el, root);
      if (now !== stuck) {
        stuck = now;
        if (now) el.setAttribute('data-stuck', '');
        else el.removeAttribute('data-stuck');
      }
      if (!root) {
        if (now && phoneNow()) held.set(el, Math.round(el.getBoundingClientRect().height + 24));
        else held.delete(el);
        // In its place again but still across the assistant's lane (the moment a long form's action is let go): the button rides above it,
        // so it never rests over the row's right end (the founder's yes of 2026-11-09). Only a row that was just held or came up from below:
        // a row coming down into the lane from above (the page scrolled back up) would make the button leap up 150px at once, so for that
        // one it keeps its place until the row is held.
        // A row rising into the lane from below (its form's top coming up the screen) starts it too: it touches the lane at under 48px.
        const lane = !now && phoneNow() && el.getClientRects().length > 0 ? rideOver(el) : 0;
        if (now || (lane > 0 && lane <= 48)) letGo = true;
        const ride = letGo ? lane : 0;
        if (ride > 0) riding.set(el, ride);
        else {
          riding.delete(el);
          if (!now) letGo = false;
        }
        publish();
      }
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    const onFocus = (e: Event) => {
      if (stuck) keepClear(el, root, e.target);
    };
    const onPress = () => {
      pressed = performance.now();
    };
    check();
    // The button's disabled state changes as the form is filled: watch it live, not only on mount.
    const mo = typeof MutationObserver === 'function' ? new MutationObserver(soon) : null;
    mo?.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled', 'aria-disabled', 'type'] });
    el.addEventListener('pointerdown', onPress);
    el.addEventListener('click', onPress);
    el.addEventListener('keydown', onPress);
    el.closest('form')?.addEventListener('submit', onPress);
    const unwatch = watchKeyboard(soon);
    window.addEventListener('scroll', soon, { capture: true, passive: true });
    window.addEventListener('resize', soon);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('input', onFocus);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(soon) : null;
    ro?.observe(el);
    if (el.parentElement) ro?.observe(el.parentElement);
    ro?.observe(root ?? document.body);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (graceTimer) clearTimeout(graceTimer);
      mo?.disconnect();
      el.removeEventListener('pointerdown', onPress);
      el.removeEventListener('click', onPress);
      el.removeEventListener('keydown', onPress);
      el.closest('form')?.removeEventListener('submit', onPress);
      unwatch();
      window.removeEventListener('scroll', soon, { capture: true });
      window.removeEventListener('resize', soon);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('input', onFocus);
      ro?.disconnect();
      held.delete(el);
      riding.delete(el);
      publish();
    };
  }, []);

  return (
    <div ref={ref} className={`sticky-action ${className}`} data-sticky-action="" role={label ? role : undefined} aria-label={label}>
      {children}
    </div>
  );
}
