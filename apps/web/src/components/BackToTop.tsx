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
 * is in view (it would sit on the footer's links), on the whole-page chats, the vibe check, a card table or in focus mode, and never while
 * an open toggle's sticky close (`[data-sticky-close-btn]`, StickyClose.tsx) has its hit area on the button's: on a laptop about 1100 to 1350px
 * wide the close of a tall fold or a task's plan stands in the same column, and passes through this corner while the toggle's line nears
 * the window's foot, so the button steps aside for that moment rather than take a tap meant for the close (2026-11-14). It fades in and
 * out (opacity only; at once under reduced motion), takes no tap while it fades out, and leaves the page (`hidden`) once faded, so it is
 * no tab stop and covers nothing.
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
/** Its hit area and a sticky close's: each is 44 by 44 to tap (`.tap-pad` round the 36px button and a 32px `small` close). The two never
 * meet, as this button's never meets the assistant's (drawn 8px apart), so a tap is always the close's or this one's, never both. */
const HIT = 44;
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
    /** A sticky close's hit area on the button's: it steps aside for it, so a tap meant for the close is never its. */
    const nearClose = () => {
      if (!closes.length) return false;
      const s = spot();
      if (!s) return false;
      const pad = (HIT - SIZE) / 2;
      for (const c of closes) {
        const q = c.getBoundingClientRect();
        if (!q.width) continue;
        const g = Math.max(0, (HIT - q.width) / 2);
        if (q.right + g > s.left - pad && q.left - g < s.right + pad && q.bottom + g > s.top - pad && q.top - g < s.bottom + pad) return true;
      }
      return false;
    };

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
      show(isLong && y > viewH && !footerSeen && !nearClose());
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
