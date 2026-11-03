import { useEffect, useRef, type ReactNode } from 'react';
import { hasFinePointer, prefersReducedMotion, useRunning } from './env';

type Rim = 2 | 3 | 4;

/**
 * A ring of flowing chrome round one pill button or link: bright metal stripes pour round its edge, with a faint coloured sheen
 * turning the other way where they meet. Our own build from the description of a "liquid metal button"; no package, no copied code.
 *
 * The child keeps every class it had (its face, colours, size, press and shimmer); the wrapper only adds the rim around it, so the
 * label's contrast and the tap target do not change. The flow is one GSAP timeline that speeds up while a mouse is on it or the
 * keyboard is on the child, surges for a moment on a press, and pauses off screen and in a hidden tab (`data-run`). Reduced motion
 * shows a still ring at a fixed angle. Used only on the site's two Start free links and Welcome's start button.
 */
export function LiquidMetal({ children, rim = 3, className = '' }: { children: ReactNode; rim?: Rim; className?: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const sheen = useRef<HTMLSpanElement>(null);
  const running = useRunning(box);
  const runningRef = useRef(running);
  const tlRef = useRef<{ paused: (v: boolean) => unknown } | null>(null);

  useEffect(() => {
    runningRef.current = running;
    tlRef.current?.paused(!running);
  }, [running]);

  useEffect(() => {
    const el = box.current;
    const a = ring.current;
    const b = sheen.current;
    if (!el || !a || !b || prefersReducedMotion()) return;
    let off = () => {};
    let dead = false;
    void import('gsap').then(({ default: gsap }) => {
      if (dead) return;
      // Centre the two squares on the pill, then turn them: the chrome every 6 seconds, the sheen the other way every 15.
      // A 30-second loop holds whole turns of both, so the repeat never jumps.
      gsap.set([a, b], { xPercent: -50, yPercent: -50 });
      gsap.set(a, { rotation: 30 });
      gsap.set(b, { rotation: 0 });
      const tl = gsap.timeline({ repeat: -1, paused: !runningRef.current });
      tl.to(a, { rotation: 30 + 360 * 5, duration: 30, ease: 'none' }, 0);
      tl.to(b, { rotation: -360 * 2, duration: 30, ease: 'none' }, 0);
      tlRef.current = tl;

      let hovered = false;
      let focused = false;
      const rest = () => (hovered || focused ? 2.5 : 1);
      const speed = (to: number, duration = 0.4) => gsap.to(tl, { timeScale: to, duration, ease: 'power2.out', overwrite: true });
      const enter = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse' || !hasFinePointer()) return;
        hovered = true;
        speed(rest());
      };
      const leave = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        hovered = false;
        speed(rest());
      };
      const focusIn = (e: FocusEvent) => {
        const t = e.target as Element | null;
        if (!t || typeof t.matches !== 'function' || !t.matches(':focus-visible')) return;
        focused = true;
        speed(rest());
      };
      const focusOut = () => {
        focused = false;
        speed(rest());
      };
      const press = () => {
        gsap
          .timeline()
          .to(tl, { timeScale: 5, duration: 0.12, ease: 'power2.out', overwrite: true })
          .to(tl, { timeScale: rest(), duration: 0.6, ease: 'power2.inOut' });
      };
      el.addEventListener('pointerenter', enter);
      el.addEventListener('pointerleave', leave);
      el.addEventListener('focusin', focusIn);
      el.addEventListener('focusout', focusOut);
      el.addEventListener('pointerdown', press);
      off = () => {
        el.removeEventListener('pointerenter', enter);
        el.removeEventListener('pointerleave', leave);
        el.removeEventListener('focusin', focusIn);
        el.removeEventListener('focusout', focusOut);
        el.removeEventListener('pointerdown', press);
        gsap.killTweensOf(tl);
        tl.kill();
        tlRef.current = null;
        gsap.set([a, b], { clearProps: 'transform' });
      };
    });
    return () => {
      dead = true;
      off();
    };
  }, []);

  return (
    <span ref={box} data-run={running} className={`fx-metal fx-metal-rim-${rim} ${className}`}>
      <span className="fx-metal-clip" aria-hidden="true">
        <span ref={ring} className="fx-metal-ring" />
        <span ref={sheen} className="fx-metal-sheen" />
      </span>
      {children}
    </span>
  );
}
