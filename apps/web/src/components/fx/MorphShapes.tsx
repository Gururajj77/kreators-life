import { useEffect, useRef, type CSSProperties } from 'react';
import gsap from 'gsap';
import { prefersReducedMotion, useRunning } from './env';

/**
 * A lava-lamp backdrop for a hero: four soft shapes in the page's four glow colours drift and melt into one slow gradient behind the
 * words, under a heavy blur and a faint grain. Each shape has a fixed uneven corner; turning and stretching it slowly (transform only)
 * is what reads as morphing, so nothing re-lays out. As wide as the screen, the height of its section; the page clips sideways overflow.
 * With `page` it is one fixed layer behind the whole page (just above the page's own wash), so a hero's background never reads as a band
 * of its own: it is the page's. With a mouse, the shapes lean gently toward the pointer (each by its own depth) and a soft glow trails it;
 * a touch screen and reduced motion get neither. Paused off screen and in a hidden tab (`useRunning`, `data-run`); under reduced motion the shapes stand still;
 * with reduced transparency or more contrast it is hidden. Decorative. Our own build, from the idea of a morphing-shape background.
 */
type Shape = { glow: 1 | 2 | 3 | 4; left: number; top: number; size: number; radius: string; turn: number; sx: [number, number]; sy: [number, number]; drift: [number, number]; secs: number };

// Four quarters, overlapping; sizes are a share of the hero's width (the wrapper is the hero's height, so tops may run over its edge).
const SHAPES: Shape[] = [
  { glow: 1, left: -8, top: -22, size: 62, radius: '42% 58% 63% 37% / 45% 39% 61% 55%', turn: 120, sx: [0.86, 1.18], sy: [1.15, 0.88], drift: [6, 5], secs: 26 },
  { glow: 3, left: 48, top: -16, size: 55, radius: '61% 39% 47% 53% / 38% 57% 43% 62%', turn: -90, sx: [1.12, 0.9], sy: [0.87, 1.2], drift: [-7, 6], secs: 22 },
  { glow: 2, left: 42, top: 34, size: 68, radius: '37% 63% 52% 48% / 58% 44% 56% 42%', turn: 140, sx: [0.9, 1.16], sy: [1.1, 0.85], drift: [-5, -7], secs: 32 },
  { glow: 4, left: -4, top: 40, size: 48, radius: '55% 45% 36% 64% / 47% 62% 38% 53%', turn: -64, sx: [1.18, 0.88], sy: [0.9, 1.14], drift: [8, -4], secs: 18 },
];

/** How far each shape leans toward the pointer, as a share of the layer's size (deeper shapes move less). */
const LEAN = [0.05, 0.035, 0.025, 0.045];

export function MorphShapes({ className = '', page = false }: { className?: string; page?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLSpanElement>(null);
  const running = useRunning(ref);
  const timelines = useRef<gsap.core.Timeline[]>([]);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const els = [...host.querySelectorAll<HTMLElement>('[data-shape]')];
    if (prefersReducedMotion()) {
      gsap.set(els, { rotate: 0, scaleX: 1, scaleY: 1, xPercent: 0, yPercent: 0 });
      return;
    }
    timelines.current = els.map((el, i) => {
      const s = SHAPES[i]!;
      const tl = gsap.timeline({ repeat: -1, yoyo: true, paused: true, defaults: { ease: 'sine.inOut' } });
      // Turn, stretch and drift out of step with each other, so the shape never simply spins.
      tl.to(el, { rotate: s.turn, duration: s.secs }, 0)
        .to(el, { scaleX: s.sx[0], duration: s.secs * 0.5 }, 0)
        .to(el, { scaleX: s.sx[1], duration: s.secs * 0.5 }, s.secs * 0.5)
        .to(el, { scaleY: s.sy[0], duration: s.secs * 0.38 }, 0)
        .to(el, { scaleY: s.sy[1], duration: s.secs * 0.62 }, s.secs * 0.38)
        .to(el, { xPercent: s.drift[0], yPercent: s.drift[1], duration: s.secs }, 0);
      return tl;
    });
    return () => {
      timelines.current.forEach((tl) => tl.kill());
      timelines.current = [];
      gsap.set(els, { clearProps: 'transform' });
    };
  }, []);

  useEffect(() => {
    timelines.current.forEach((tl) => (running ? tl.play() : tl.pause()));
  }, [running]);

  // The pointer: only with a mouse, never under reduced motion, and only while the layer is running. The shapes' own timelines move
  // xPercent and yPercent; the lean uses x and y, so the two add up instead of fighting.
  useEffect(() => {
    const host = ref.current;
    if (!host || !running || prefersReducedMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const els = [...host.querySelectorAll<HTMLElement>('[data-shape]')];
    const lean = els.map((el) => ({ x: gsap.quickTo(el, 'x', { duration: 1.6, ease: 'power3.out' }), y: gsap.quickTo(el, 'y', { duration: 1.6, ease: 'power3.out' }) }));
    const spot = glow.current;
    const gx = spot ? gsap.quickTo(spot, 'x', { duration: 0.9, ease: 'power3.out' }) : null;
    const gy = spot ? gsap.quickTo(spot, 'y', { duration: 0.9, ease: 'power3.out' }) : null;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const box = host.getBoundingClientRect();
      const dx = (e.clientX - box.left) / box.width - 0.5;
      const dy = (e.clientY - box.top) / box.height - 0.5;
      lean.forEach((l, i) => {
        l.x(dx * box.width * LEAN[i]!);
        l.y(dy * box.height * LEAN[i]!);
      });
      if (spot && gx && gy) {
        spot.dataset.on = '';
        gx(e.clientX - box.left);
        gy(e.clientY - box.top);
      }
    };
    const leave = () => {
      lean.forEach((l) => (l.x(0), l.y(0)));
      if (spot) delete spot.dataset.on;
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
      // A quickTo tween is paused, never done, so GSAP keeps it (and the element) until it is killed; this effect makes new ones each
      // time the layer comes back on screen. The shapes still glide home, on one tween that ends and is let go.
      lean.forEach((l) => (l.x.tween.kill(), l.y.tween.kill()));
      gx?.tween.kill();
      gy?.tween.kill();
      gsap.to(els, { x: 0, y: 0, duration: 1.6, ease: 'power3.out', overwrite: 'auto' });
      if (spot) delete spot.dataset.on;
    };
  }, [running]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-run={running}
      data-page={page || undefined}
      className={`fx-morph pointer-events-none ${page ? 'fixed inset-0 z-[-1]' : 'absolute top-0 left-1/2 -z-10 h-full w-screen max-w-none -translate-x-1/2'} ${className}`}
    >
      {SHAPES.map((s, i) => (
        <span
          key={i}
          data-shape={i}
          className="fx-morph-shape"
          style={{ left: `${s.left}%`, top: `${s.top}%`, borderRadius: s.radius, background: `var(--fx-morph-${s.glow})`, '--fx-s': s.size / 100 } as CSSProperties}
        />
      ))}
      <span ref={glow} className="fx-morph-glow" />
      <span className="fx-morph-grain" />
    </div>
  );
}
