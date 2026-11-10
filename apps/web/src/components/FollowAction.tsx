import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { held, PHONE, phoneNow, publish, ROOMY, watchKeyboard } from './StickyAction';

/**
 * StickyAction's bar for a public page whose main action stands far from most of it (the home's hero and its last call to action, the
 * last call to action on /features and /7rp): on a phone, a fixed bar at the bottom edge with the page's main action, shown only while
 * none of the page's own copies (`data-main-action`), the site's header (`data-follow-wait`, its Go to app) nor the footer is on screen,
 * so the action is back in its place once that place shows. It sits after
 * the page in the focus order and is gone (`hidden`) while a copy is on screen or the screen is wide. `children` is the action itself.
 */
export function FollowAction({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof IntersectionObserver !== 'function') return;
    const seen = new Set<Element>();
    let io: IntersectionObserver | null = null;
    let frame = 0;
    const update = () => setShow(phoneNow() && seen.size === 0);
    const watch = () => {
      frame = 0;
      io?.disconnect();
      seen.clear();
      // A copy partly hidden behind the bar still counts as off screen: the bar's own height is taken off the bottom.
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) seen.add(e.target);
            else seen.delete(e.target);
          }
          update();
        },
        { rootMargin: '0px 0px -96px 0px' },
      );
      // The site's footer counts as a place too, so the bar never sits over its last lines (the emergency line among them), and so does
      // the site's header (`data-follow-wait`), which scrolls with a phone's page: the bar waits until its Go to app has gone up.
      const copies = [...document.querySelectorAll('[data-main-action], .site-footer, [data-follow-wait]')];
      for (const c of copies) io.observe(c);
      if (!copies.length) update();
    };
    // The page's copies arrive with it (a lazy page, a motion wrapper): look again once it has drawn.
    watch();
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(watch);
    });
    const later = window.setTimeout(watch, 1200);
    // A phone turned on its side, or the keyboard coming up, takes the bar away (StickyAction's ROOMY and watchKeyboard).
    const mqs = typeof window.matchMedia === 'function' ? [window.matchMedia(PHONE), window.matchMedia(ROOMY)] : [];
    for (const mq of mqs) mq.addEventListener('change', update);
    const unwatch = watchKeyboard(update);
    return () => {
      io?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(later);
      for (const mq of mqs) mq.removeEventListener('change', update);
      unwatch();
    };
  }, [pathname]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !show) {
      if (el) held.delete(el);
      publish();
      return;
    }
    held.set(el, Math.round(el.getBoundingClientRect().height));
    publish();
    return () => {
      held.delete(el);
      publish();
    };
  }, [show]);

  return (
    <div ref={ref} className="follow-action" hidden={!show} role="group" aria-label={label}>
      {children}
    </div>
  );
}
