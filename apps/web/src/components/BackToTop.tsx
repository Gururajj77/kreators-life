import { ArrowUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useFocus } from '../lib/store';
import { Icon } from './Icon';
import { watchKeyboard } from './StickyAction';
import { STICKY_CLOSE_CHANGED } from './StickyClose';

/**
 * Back to top (the founder, 2026-11-14: "also add back to top button on the left of the ai chat assistant button, keep it minimal and
 * small and not interfering with any part of the page for all screens"). A small round button, 36px drawn and 44 by 44 to tap
 * (`.tap-pad`), on the strong card like the round glass buttons, with an up arrow and a 2px ring whose filled arc is how far down the
 * page you are. Mounted once by Root, in its own chunk after the first paint, so the first download carries one line for it.
 *
 * Where it sits is app.css's ("Back to top"): just left of the assistant's round button, centred on it, 8px apart; where that button is
 * not shown, in its place (centred on where it would be). It rises with it over a held bar (`.lift-over-sticky`), and it steps aside
 * (CSS, no JS) while a sheet, the assistant's panel, the privacy card or bar, the attendee bar or a phone's keyboard is up.
 *
 * When it shows: once the page has scrolled more than a screen down on a page at least two screens tall, never while the site's footer
 * is in view (it would sit on the footer's links), on the whole-page chats, the vibe check, a card table or in focus mode, never while an
 * open toggle's sticky close (`[data-sticky-close-btn]`, StickyClose.tsx; running in, only while its slim bar shows) is in view (that close is the way out then, and on a laptop about
 * 1100 to 1350px wide it passes through this corner), and never over a control, a line of words or a picture to look at (2026-11-16, the founder: "on mobile the
 * toggle in tasks breaks in design overalapping, recheck entire app for such errors"): once a frame while the page scrolls it looks at
 * what lies under its 44px (`elementsFromPoint` on rows of points no more than 8px apart, then a look through what is topmost there for a
 * smaller line or label inside the square) and steps aside while a link, a button, a field or any words sit
 * there, coming back once they have passed and the spot has stayed clear a moment (`CLEAR_MS`), so it never blinks between rows. It
 * fades in and out (opacity only; at once under reduced motion), takes no tap while it fades out, and leaves the page (`hidden`) once
 * faded, so it is no tab stop and covers nothing.
 *
 * The page's foot: an app screen keeps 168px under its last control on a phone, which this shares with the assistant. Where a page keeps
 * less (a laptop's 32px, a page outside the app), a spacer after the page (`.btt-room`, only on a page long enough to show the button)
 * gives the last control room to scroll out from under it, so it never covers a control at the page's foot.
 *
 * The scroll path reads only `scrollY`, and the boxes of the sticky closes only while one is open (the list is found again when something
 * changes size and whenever a close comes, goes or moves, `STICKY_CLOSE_CHANGED`); the page's height, the window's and the spacer's are
 * read when something changes size.
 */

/** The whole-page chats, the vibe check and a card table: screens of their own with their own controls along the foot. */
const NEVER = /^\/(onboarding|session|vibe-check|cards\/[^/]+)(\/|$)/;
/** The fade (app.css "Back to top"); once faded the button leaves the page. */
const FADE_MS = 160;
/** The ring's length (r 17 in a 36 box), set in app.css too: a dash that long, pushed back by what is still to scroll. Its own number,
 * not `pathLength`, which an older Safari ignores for a dash. */
const RING = 106.81;
/** The button as drawn (app.css). */
const SIZE = 36;
/** Its hit area: 44 by 44 to tap (`.tap-pad` round the 36px button). Nothing it would sit on may lie under it. */
const HIT = 44;
/** How long the spot under it stays clear before it comes back, so it never blinks between the rows of a list. */
const CLEAR_MS = 220;
/** What it never sits on: anything a tap could be meant for. */
const CONTROL =
  'a[href], button, input, select, textarea, summary, label, [role="button"], [role="link"], [role="switch"], [role="checkbox"], [role="radio"], [role="tab"], [role="slider"], [role="option"], [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"])';
/** And what it never sits on to look at: a picture with words of its own (a QR code someone scans, a person's photo), a video, a canvas
 *  or a frame, a picture drawn in code that says what it shows (`role="img"`: a chart, the map of consciousness, a guide shown by name),
 *  or a box marked `data-btt-avoid` (the QR code's white tile, whose quiet zone a scanner needs too). Decorative art (an empty `alt`,
 *  `aria-hidden` on it or round it, as the home's knot canvas) is left out, so heroes and their characters never send it away. */
const PICTURE =
  'img:not([alt=""]):not([aria-hidden="true"]):not([aria-hidden="true"] img), picture, video, canvas:not([aria-hidden="true"] canvas), iframe, [role="img"]:not([aria-hidden="true"]):not([aria-hidden="true"] [role="img"]), [data-btt-avoid]';
type Box = { left: number; right: number; top: number; bottom: number };
const meets = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
/** Whether something is drawn for a person to see: a box a screen-reader-only label leaves (1px, clipped) is not, nor a hidden one. */
const seen = (el: Element) =>
  typeof el.checkVisibility !== 'function' || el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true });
/** Whether a line of words that is `el`'s own text (not its children's) lies inside `sq`. */
function wordsIn(el: Element, sq: Box, range: Range): boolean {
  for (const n of el.childNodes) {
    if (n.nodeType !== Node.TEXT_NODE || !n.textContent?.trim()) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.width >= 2 && r.height >= 2 && meets(r, sq) && seen(el)) return true;
  }
  return false;
}
/** How many elements one look may visit inside the things under the button, so a frame never walks a long list. */
const WALK_MAX = 400;
/** Whether a control or a line of words lies inside `sq` anywhere in `el`'s subtree, visiting only boxes that meet `sq` (a box with no
 *  size of its own, `display: contents`, is passed through). A small line between two sample points, or a chart's label inside the
 *  chart's box, is found this way. */
function underIn(el: Element, sq: Box, range: Range, left: { n: number }): boolean {
  if (wordsIn(el, sq, range)) return true;
  for (const child of el.children) {
    if (--left.n < 0) return false;
    const r = child.getBoundingClientRect();
    const sized = r.width > 0 || r.height > 0;
    if (sized && !meets(r, sq)) continue;
    if (sized && r.width >= 2 && r.height >= 2 && (child.matches(CONTROL) || child.matches(PICTURE)) && seen(child)) return true;
    if (underIn(child, sq, range, left)) return true;
  }
  return false;
}
/** The rows of points it samples across its hit area, from edge to edge (a control whose own tap area reaches the edge counts) and never
 *  more than 8px apart, so a line of words (about 15px tall) always meets one; whatever is topmost at each is then looked through for
 *  smaller words or controls (`underIn`). */
const ROWS = [0, 7, 15, 22, 29, 37, HIT];
/** Across, a little wider apart: the look inside each topmost box (`underIn`) finds what lies between two columns. */
const COLS = [0, 15, 29, HIT];
/** Whether a control or a line of words lies under the square `sq` (the button's hit area), the button itself (`own`) left out: the
 *  topmost thing at each sampled point that is not the button, and what that holds inside the square. */
function coversSomething(sq: Box, own: Element): boolean {
  const range = document.createRange();
  const looked = new Set<Element>();
  const left = { n: WALK_MAX };
  for (const fy of ROWS) {
    for (const fx of COLS) {
      const x = sq.left + fx;
      const y = sq.top + fy;
      if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
      const top = document.elementsFromPoint(x, y).find((e) => !own.contains(e));
      if (!top || top === document.documentElement || top === document.body || looked.has(top)) continue;
      looked.add(top);
      if (top.closest(CONTROL) || top.closest(PICTURE)) return true;
      // A box that holds the button (the app's root) is read for its own words only, never walked.
      if (top.contains(own) ? wordsIn(top, sq, range) : underIn(top, sq, range, left)) return true;
    }
  }
  return false;
}
const reduced =() => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function BackToTop() {
  const { pathname } = useLocation();
  const focus = useFocus((s) => s.on);
  const off = focus || NEVER.test(pathname);
  // Long enough to show the button (two screens or more, not counting the spacer): the spacer at the foot is drawn only then.
  const [long, setLong] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const arc = useRef<SVGCircleElement>(null);
  const room = useRef<HTMLDivElement>(null);
  /** Shown now (kept across a page change, so a page that opens scrolled down keeps it without a flicker). */
  const shown = useRef(false);
  const hideTimer = useRef(0);

  useEffect(() => {
    if (off) {
      shown.current = false;
      setLong(false);
      return;
    }
    let docH = 0;
    let viewH = 0;
    let spacer = 0;
    let frame = 0;
    let footer: Element | null = null;
    let footerSeen = false;
    // The sticky closes on the page now (an open tall toggle's, a task plan's): usually none.
    let closes: Element[] = [];
    const findCloses = () => {
      closes = Array.from(document.querySelectorAll('[data-sticky-close-btn]'));
    };

    /** Where the button is drawn: its own box while it is on the page (with any lift over a held bar), else where app.css puts it. */
    const spot = () => {
      const el = wrap.current;
      if (!el) return null;
      if (!el.hidden) {
        const r = el.getBoundingClientRect();
        if (r.width) return r;
      }
      const cs = getComputedStyle(el);
      const right = parseFloat(cs.right);
      const bottom = parseFloat(cs.bottom);
      if (!Number.isFinite(right) || !Number.isFinite(bottom)) return null;
      const [tx = 0, ty = 0] = cs.translate && cs.translate !== 'none' ? cs.translate.split(' ').map((v) => parseFloat(v) || 0) : [];
      const page = document.documentElement;
      const r = page.clientWidth - right + tx;
      const b = page.clientHeight - bottom + ty;
      return { left: r - SIZE, right: r, top: b - SIZE, bottom: b };
    };
    /** A sticky close in view: the open toggle's close is the way out then, and the button steps aside (a close passing through its corner
     *  never meets it either). */
    const closeInView = () => {
      for (const c of closes) {
        // A slim bar that is not shown, or a close tucked away, is not the way out.
        const bar = c.closest('[data-sticky-close-bar]');
        if (bar && bar.getAttribute('data-shown') !== 'true') continue;
        if (c.closest('.sticky-close-rail[data-tuck]')) continue;
        const q = c.getBoundingClientRect();
        if (q.width && q.bottom > 0 && q.top < window.innerHeight && q.right > 0 && q.left < window.innerWidth) return true;
      }
      return false;
    };
    /** A control or a line of words under its hit area. */
    const onSomething = () => {
      const s = spot();
      const el = wrap.current;
      if (!s || !el) return false;
      const pad = (HIT - SIZE) / 2;
      return coversSomething({ left: s.left - pad, right: s.right + pad, top: s.top - pad, bottom: s.bottom + pad }, el);
    };
    /** Since when the spot under it has been clear (0 while it is not), and the call that looks again once it has been clear long enough. */
    let clearSince = 0;
    let clearTimer = 0;

    const show = (on: boolean) => {
      const el = wrap.current;
      if (!el || on === shown.current) return;
      shown.current = on;
      window.clearTimeout(hideTimer.current);
      if (on) {
        el.hidden = false;
        // It is drawn once at no opacity first (show runs inside a frame, so the next one is after that paint), so the fade runs.
        if (reduced()) el.setAttribute('data-show', '');
        else
          requestAnimationFrame(() => {
            if (shown.current) el.setAttribute('data-show', '');
          });
      } else {
        el.removeAttribute('data-show');
        hideTimer.current = window.setTimeout(() => {
          if (!shown.current) el.hidden = true;
        }, reduced() ? 0 : FADE_MS);
      }
    };

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const isLong = docH - spacer >= viewH * 2;
      let on = isLong && y > viewH && !footerSeen && !closeInView();
      if (on && onSomething()) {
        clearSince = 0;
        on = false;
      } else if (on && !shown.current) {
        // Clear now: it comes back once the spot has stayed clear a moment, so it never blinks between a list's rows.
        const now = performance.now();
        if (!clearSince) clearSince = now;
        if (now - clearSince < CLEAR_MS) {
          on = false;
          window.clearTimeout(clearTimer);
          clearTimer = window.setTimeout(soon, CLEAR_MS - (now - clearSince) + 16);
        }
      }
      show(on);
      const ring = arc.current;
      if (ring && shown.current) {
        const p = Math.min(1, Math.max(0, y / Math.max(1, docH - viewH)));
        ring.style.strokeDashoffset = (RING * (1 - p)).toFixed(2);
      }
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    // The site's footer: while any of it is in view the button steps aside, so it never sits on the footer's links.
    const io = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver((entries) => {
          for (const e of entries) if (e.target === footer) footerSeen = e.isIntersecting;
          soon();
        })
      : null;
    const watchFooter = () => {
      const f = document.querySelector('.site-footer');
      if (f === footer) return;
      if (footer) io?.unobserve(footer);
      footer = f;
      footerSeen = false;
      if (f) io?.observe(f);
    };

    // Everything that is not the scroll position, read only when something changes size (or the page changed).
    const measure = () => {
      watchFooter();
      findCloses();
      docH = document.documentElement.scrollHeight;
      viewH = window.innerHeight;
      spacer = room.current?.offsetHeight ?? 0;
      setLong(docH - spacer >= viewH * 2);
      soon();
    };

    // A sticky close came, went, changed side or moved (its rail says so once it is drawn, after its own chunk): find them again.
    const closesChanged = () => {
      findCloses();
      soon();
    };

    const sizes = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    sizes?.observe(document.getElementById('root') ?? document.body);
    window.addEventListener('scroll', soon, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener(STICKY_CLOSE_CHANGED, closesChanged);
    // The phone's keyboard (`data-kb-up` on the root): app.css takes the button away while it is up.
    const unwatch = watchKeyboard();
    measure();
    // A page that arrives late (a lazy screen, its data) is measured again once it has drawn.
    let second = requestAnimationFrame(() => {
      second = requestAnimationFrame(measure);
    });
    const later = window.setTimeout(measure, 1200);
    return () => {
      sizes?.disconnect();
      io?.disconnect();
      window.removeEventListener('scroll', soon);
      window.removeEventListener('resize', measure);
      window.removeEventListener(STICKY_CLOSE_CHANGED, closesChanged);
      unwatch();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(second);
      window.clearTimeout(later);
      window.clearTimeout(clearTimer);
    };
  }, [off, pathname]);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  if (off) return null;

  /** Up to the top, and the keyboard's place with it: the page's title (else its main), focused where it stands so nothing jumps twice. A
   * mouse's tap draws no ring there (the button it came from had none); the keyboard's does. */
  const toTop = () => {
    window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
    const title = document.querySelector('main')?.querySelector<HTMLElement>('h1') ?? null;
    const to = title && title.getClientRects().length ? title : document.getElementById('main');
    if (!to) return;
    if (!to.hasAttribute('tabindex')) {
      to.setAttribute('tabindex', '-1');
      to.addEventListener('blur', () => to.removeAttribute('tabindex'), { once: true });
    }
    to.focus({ preventScroll: true });
  };

  return (
    <>
      {/* The room the button needs at the page's foot, after the page (app.css sizes it, and draws none where the page keeps enough). */}
      {long && <div ref={room} className="btt-room no-print" aria-hidden="true" />}
      {/* data-rect-quiet: its showing and hiding holds no words, so it never starts the rectangle fixer's pass over the page (lib/rectText.ts). */}
      <div ref={wrap} className="back-to-top lift-over-sticky no-print" data-rect-quiet="" hidden>
        <button
          type="button"
          onClick={toTop}
          aria-label="Back to top"
          data-tip="Back to top"
          data-tip-at="top"
          className="back-to-top-btn toy toy-soft tap-pad flex size-[36px] items-center justify-center rounded-pill bg-card-strong text-ink-soft hover:text-ink"
        >
          <svg className="btt-ring" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
            <circle className="btt-track" cx="18" cy="18" r="17" />
            <circle ref={arc} className="btt-arc" cx="18" cy="18" r="17" />
          </svg>
          <Icon icon={ArrowUp} size={16} strokeWidth={2.4} />
        </button>
      </div>
    </>
  );
}
