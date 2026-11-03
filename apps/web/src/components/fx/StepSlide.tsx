import { gsap } from 'gsap';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { prefersReducedMotion } from './env';

/** How far a step travels as it arrives, and how long it takes. Small and quick: a nudge that says which way, never a carousel. */
const SHIFT = 24;
const DURATION = 0.3;
/** GSAP's nearest to `--ease-open` (a fast start that settles softly). */
const EASE = 'expo.out';

/**
 * A stepped form's panel that arrives from the way you travelled: a higher `at` (Next) slides in from the right, a lower one (Back,
 * Change) from the left. Only transform and opacity move, once per change; the first paint and reduced motion show it still and in place.
 */
export function StepSlide({ at, className, children }: { at: number; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(at);
  useLayoutEffect(() => {
    const el = ref.current;
    const from = last.current;
    last.current = at;
    if (!el || from === at) return;
    if (prefersReducedMotion()) {
      gsap.set(el, { clearProps: 'transform,opacity' });
      return;
    }
    const tween = gsap.fromTo(el, { x: at > from ? SHIFT : -SHIFT, opacity: 0 }, { x: 0, opacity: 1, duration: DURATION, ease: EASE, clearProps: 'transform,opacity' });
    return () => {
      tween.kill();
      gsap.set(el, { clearProps: 'transform,opacity' });
    };
  }, [at]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/**
 * A progress fill that glides to its new share. The fill is always the track's full width and is slid left by what is not done yet,
 * so the track's rounded clip keeps its rounded end exactly as a width would (a scaleX would squash the cap). Transform only.
 */
export function GlideFill({ share, className }: { share: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const pct = (Math.min(1, Math.max(0, share)) - 1) * 100;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current || prefersReducedMotion()) {
      first.current = false;
      gsap.set(el, { xPercent: pct });
      return;
    }
    const tween = gsap.to(el, { xPercent: pct, duration: DURATION + 0.1, ease: EASE });
    return () => {
      tween.kill();
    };
  }, [pct]);
  return <div ref={ref} className={className} />;
}
