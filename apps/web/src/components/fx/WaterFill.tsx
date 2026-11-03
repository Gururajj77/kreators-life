import gsap from 'gsap';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { prefersReducedMotion } from './env';

/**
 * Water's level bar. At rest it is the same bg-r4 pill on the bg-line track as before; the level moves by transform (the full-width fill
 * slides in from the left, translateX, so its round leading end keeps its shape), never by width. While the level glides after a glass is
 * added or undone, a small soft crest ripples at the leading edge (translateX only), then fades out and stops once the level settles.
 * Nothing runs while the level is still; reduced motion, a hidden tab and the first paint set the level with no crest.
 * Our own build, after the idea of a water progress bar; no code from anywhere else.
 */
export function WaterFill({ value, max, label = 'Water today', className = '' }: { value: number | undefined; max: number | undefined; label?: string; className?: string }) {
  const loaded = value !== undefined && max !== undefined;
  const pct = loaded && max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const fill = useRef<HTMLDivElement>(null);
  const crest = useRef<HTMLSpanElement>(null);
  const wave = useRef<SVGSVGElement>(null);
  const armed = useRef(false);
  const last = useRef(pct);

  // Until the day's numbers have arrived (and on the first paint with them) the level is placed before the browser draws, so the bar
  // never slides in on load; only a change after that moves.
  useLayoutEffect(() => {
    if (!fill.current || armed.current) return;
    gsap.set(fill.current, { xPercent: -(1 - pct) * 100 });
    if (crest.current) gsap.set(crest.current, { opacity: 0 });
    last.current = pct;
    if (loaded) armed.current = true;
  }, [pct, loaded]);

  useEffect(() => {
    const el = fill.current;
    if (!el || !armed.current || last.current === pct) return;
    last.current = pct;
    const to = -(1 - pct) * 100;
    const still = prefersReducedMotion() || (typeof document !== 'undefined' && document.visibilityState === 'hidden');
    gsap.killTweensOf(el);
    if (crest.current) gsap.killTweensOf(crest.current);
    if (wave.current) gsap.killTweensOf(wave.current);
    if (still) {
      gsap.set(el, { xPercent: to });
      if (crest.current) gsap.set(crest.current, { opacity: 0 });
      return;
    }
    const ripple = wave.current ? gsap.fromTo(wave.current, { x: 0 }, { x: -12, duration: 0.42, ease: 'none', repeat: -1 }) : null;
    if (crest.current) gsap.to(crest.current, { opacity: 1, duration: 0.15, ease: 'power1.out' });
    gsap.to(el, {
      xPercent: to,
      duration: 0.7,
      ease: 'power2.out',
      onComplete: () => {
        if (!crest.current) {
          ripple?.kill();
          return;
        }
        gsap.to(crest.current, {
          opacity: 0,
          duration: 0.35,
          delay: 0.1,
          ease: 'power1.in',
          onComplete: () => {
            ripple?.kill();
            if (wave.current) gsap.set(wave.current, { x: 0 });
          },
        });
      },
    });
  }, [pct]);

  useEffect(
    () => () => {
      [fill.current, crest.current, wave.current].forEach((n) => n && gsap.killTweensOf(n));
    },
    [],
  );

  return (
    <div className={`water-track rounded-pill bg-line ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={max ?? 1} aria-valuenow={value ?? 0} aria-label={label}>
      <div ref={fill} className="water-level rounded-pill bg-r4">
        <span ref={crest} className="water-crest" aria-hidden="true">
          <svg ref={wave} viewBox="0 0 36 12" preserveAspectRatio="none" focusable="false">
            <path d="M0 5 Q3 2 6 5 T12 5 T18 5 T24 5 T30 5 T36 5 V0 H0 Z" />
            <path className="water-crest-foam" d="M0 5 Q3 2 6 5 T12 5 T18 5 T24 5 T30 5 T36 5" />
          </svg>
        </span>
      </div>
    </div>
  );
}
