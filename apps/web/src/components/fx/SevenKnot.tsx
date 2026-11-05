import { useEffect, useRef, useState } from 'react';
import { hasFinePointer, prefersReducedMotion, useRunning } from './env';

/**
 * The home hero's centrepiece: seven pillar colours tied into one glossy knot (knotDraw.ts, its own chunk, drawn once after the first
 * paint onto a canvas sized to the box and the screen). The box keeps its size from the start, so nothing shifts when it arrives; the
 * picture fades in.
 *
 * Motion is GSAP on transforms only: a slow sway (a few degrees and a few pixels, yoyo) that pauses off screen and in a hidden tab, and
 * with a mouse a lean toward the pointer over the panel it sits in (`[data-knot-host]`). Reduced motion leaves it still. Decorative:
 * hidden from screen readers and never takes a tap.
 */
export function SevenKnot({ className = '' }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const sway = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);
  const running = useRunning(box);
  const tl = useRef<{ pause: () => void; resume: () => void } | null>(null);
  const runningNow = useRef(running);
  runningNow.current = running;

  // Draw once the chunk is here, and again when the box changes size (a phone turning, a window resized) or the theme changes (the
  // shade the tube turns into is a theme token).
  useEffect(() => {
    const el = box.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    let dead = false;
    let timer = 0;
    let frame = 0;
    /** The newest draw: an older one still running stops at its next pause. */
    let gen = 0;
    /** What was last drawn (size and colours): the same again is not drawn twice. */
    let lastKey = '';
    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;
    let scheme: MediaQueryList | null = null;
    let onScheme = () => {};
    void import('./knotDraw').then(({ drawSevenKnot, knotColours }) => {
      if (dead) return;
      const paint = () => {
        const side = Math.round(el.clientWidth);
        const colours = knotColours(el);
        if (side <= 0 || !colours) return;
        // A tenth over the screen's density, since the box is drawn 9% larger than its layout size (.hero-knot's `scale`).
        const scale = Math.min(2.2, (window.devicePixelRatio || 1) * 1.1);
        const px = Math.round(side * scale);
        const key = `${px}:${JSON.stringify(colours)}`;
        if (key === lastKey) return;
        lastKey = key;
        const mine = (gen += 1);
        void drawSevenKnot(cv, colours, px, px, () => !dead && mine === gen).then((done) => {
          if (done) setDrawn(true);
        });
      };
      // A theme change paints first and the knot follows a moment later, never inside the tap that changed it.
      const later = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          window.clearTimeout(timer);
          timer = window.setTimeout(paint, 0);
        });
      };
      paint();
      if (typeof ResizeObserver !== 'undefined') {
        let last = el.clientWidth;
        ro = new ResizeObserver(() => {
          if (Math.abs(el.clientWidth - last) < 2) return;
          last = el.clientWidth;
          window.clearTimeout(timer);
          timer = window.setTimeout(paint, 150);
        });
        ro.observe(el);
      }
      mo = new MutationObserver(later);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      if (typeof window.matchMedia === 'function') {
        scheme = window.matchMedia('(prefers-color-scheme: dark)');
        onScheme = later;
        scheme.addEventListener('change', onScheme);
      }
    }).catch(() => {
      // A chunk that failed to load leaves the box its size and the canvas hidden.
    });
    return () => {
      dead = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      ro?.disconnect();
      mo?.disconnect();
      scheme?.removeEventListener('change', onScheme);
    };
  }, []);

  useEffect(() => {
    const el = box.current;
    const inner = sway.current;
    if (!el || !inner || prefersReducedMotion()) return;
    let dead = false;
    let off = () => {};
    void import('./knotDraw').then(async ({ swayKnot }) => {
      const motion = await swayKnot(el, inner, hasFinePointer());
      if (dead) {
        motion.stop();
        return;
      }
      if (!runningNow.current) motion.pause();
      tl.current = motion;
      off = () => {
        motion.stop();
        tl.current = null;
      };
    }).catch(() => {});
    return () => {
      dead = true;
      off();
    };
  }, []);

  // Nothing moves unseen: the sway stops off screen and in a hidden tab.
  useEffect(() => {
    if (running) tl.current?.resume();
    else tl.current?.pause();
  }, [running]);

  return (
    <div ref={box} aria-hidden="true" data-run={running} className={`hero-knot ${className}`}>
      <div ref={sway} className="hero-knot-sway">
        <canvas ref={canvas} className="hero-knot-canvas" data-drawn={drawn ? '' : undefined} />
      </div>
    </div>
  );
}
