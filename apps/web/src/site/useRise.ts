import { useReducedMotion } from 'motion/react';

// Out of SevenRP.tsx (2026-11-07), so the landing page and the guide lines can use it while /7rp downloads only when it is opened.
/** A gentle lift into place the first time a section scrolls into view. The content is always visible (opacity
 * never hides it); only the small upward delta animates, so a full-page shot taken before the observer fires never
 * shows a blank band, and `prefers-reduced-motion` drops the lift and renders straight in its resting place. */
export function useRise() {
  const reduce = useReducedMotion();
  return reduce
    ? { initial: { opacity: 1, y: 0 } }
    : {
        initial: { opacity: 1, y: 20 },
        whileInView: { y: 0 },
        viewport: { once: true, margin: '-60px' },
        transition: { duration: 0.5 },
      };
}
