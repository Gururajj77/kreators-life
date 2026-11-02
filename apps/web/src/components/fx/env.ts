import { useEffect, useState, type RefObject } from 'react';

/** The motion kit's two checks, read when needed (a setting can change while the page is open). */
export const prefersReducedMotion = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** A mouse or trackpad: the only place hover effects (spotlight, magnet) run. A touch screen never gets them. */
export const hasFinePointer = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/** True once the element has been on screen (stays true: for entrances that play once). */
export function useSeenOnce(ref: RefObject<Element | null>, margin = '0px 0px -8% 0px'): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen, margin]);
  return seen;
}

/** True only while the element is on screen and the tab is visible: an endless animation runs on this, so nothing animates unseen. */
export function useRunning(ref: RefObject<Element | null>): boolean {
  const [onScreen, setOnScreen] = useState(false);
  const [tabVisible, setTabVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => setOnScreen(entries.some((e) => e.isIntersecting)), { rootMargin: '80px' });
    io.observe(el);
    const onVis = () => setTabVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [ref]);
  return onScreen && tabVisible;
}
