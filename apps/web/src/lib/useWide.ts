import { useEffect, useState } from 'react';

/** The same test as the `md` variant in app.css (width and height), so a phone, upright or on its side, counts as a phone. */
const WIDE = '(min-width: 48rem) and (min-height: 30rem)';

/** Whether the screen is wide (the `md` test) right now. */
export const isWide = () => typeof window === 'undefined' || typeof window.matchMedia !== 'function' || window.matchMedia(WIDE).matches;

/** Whether the screen is wide (the `md` test), following a resize or a phone turning. */
export function useWide(): boolean {
  const [wide, setWide] = useState(isWide);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia(WIDE);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}
