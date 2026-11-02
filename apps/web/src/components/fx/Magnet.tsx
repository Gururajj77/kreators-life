import { useEffect, useRef, type ReactNode } from 'react';
import { hasFinePointer, prefersReducedMotion } from './env';

/**
 * Pulls its content a little towards the pointer when it comes close, and lets it settle back on leaving (GSAP quickTo). Mouse and
 * trackpad only; a touch screen and reduced motion get the plain element. It moves the wrapper, never the layout around it.
 */
export function Magnet({ children, strength = 0.3, className = '' }: { children: ReactNode; strength?: number; className?: string }) {
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || !hasFinePointer() || prefersReducedMotion()) return;
    let off = () => {};
    let dead = false;
    void import('gsap').then(({ default: gsap }) => {
      if (dead) return;
      const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'elastic.out(1, 0.55)' });
      const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'elastic.out(1, 0.55)' });
      const move = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        const r = el.getBoundingClientRect();
        x((e.clientX - (r.left + r.width / 2)) * strength);
        y((e.clientY - (r.top + r.height / 2)) * strength);
      };
      const leave = () => {
        x(0);
        y(0);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      el.addEventListener('focusout', leave);
      off = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
        el.removeEventListener('focusout', leave);
        gsap.set(el, { clearProps: 'transform' });
      };
    });
    return () => {
      dead = true;
      off();
    };
  }, [strength]);
  // The wrapper is a little bigger than the button (padding) so the pull starts as the pointer nears it, not only on it.
  return (
    <span ref={box} className={`fx-magnet ${className}`}>
      {children}
    </span>
  );
}
