import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { prefersReducedMotion } from './env';

/**
 * A sliding indicator for a row of tabs, with no extra element. Put `fx-slide` on the row; this measures the active tab (the first match
 * of `target` inside it) and writes --fx-x, --fx-y, --fx-w and --fx-h on the row, and the CSS draws the pill behind it as ::before and
 * glides it between tabs. `ready` stays false until the first measure, so the caller keeps the old active look until the indicator is placed
 * (no tab is ever left without a fill). The row can scroll sideways: the measure is relative to the row's own content.
 */
export function useSlider<T extends HTMLElement>(target: string, key: unknown): { ref: RefObject<T | null>; ready: boolean } {
  const ref = useRef<T | null>(null);
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    const place = () => {
      const tab = row.querySelector<HTMLElement>(target);
      if (!tab) {
        row.removeAttribute('data-has');
        return;
      }
      const a = row.getBoundingClientRect();
      const b = tab.getBoundingClientRect();
      row.style.setProperty('--fx-x', `${Math.round(b.left - a.left + row.scrollLeft)}px`);
      row.style.setProperty('--fx-y', `${Math.round(b.top - a.top + row.scrollTop)}px`);
      row.style.setProperty('--fx-w', `${Math.round(b.width)}px`);
      row.style.setProperty('--fx-h', `${Math.round(b.height)}px`);
      row.setAttribute('data-has', '');
      setReady(true);
    };
    place();
    // The first placement is instant; the glide switches on after the first frame (and never under reduced motion).
    const f = requestAnimationFrame(() => {
      if (!prefersReducedMotion()) row.setAttribute('data-glide', '');
    });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    ro?.observe(row);
    row.querySelectorAll<HTMLElement>(target).forEach((t) => ro?.observe(t));
    return () => {
      cancelAnimationFrame(f);
      ro?.disconnect();
    };
  }, [target, key]);
  return { ref, ready };
}
