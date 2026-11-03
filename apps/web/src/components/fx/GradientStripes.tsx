import { useEffect, useRef, useState } from 'react';
import { hasFinePointer, prefersReducedMotion, useRunning } from './env';

type Tone = 'ink' | 'card';

/** How far a stripe drifts on the wave and how far it can rise to the pointer, as a share of its own height. */
const WAVE = 6;
const LIFT = 18;
/** One full wave, in seconds, and how many stripes either side of the pointer feel it. */
const PERIOD = 9;
const REACH = 4;

/**
 * Light sliced into stripes: a horizon glow from the theme's indigo, sky and green rising from the foot of the card, cut into
 * upright stripes that drift on a slow wave and rise towards a mouse pointer (learned from a "gradient blind" backdrop, built
 * here with CSS and GSAP, no WebGL). Put it as the first child of a `relative overflow-hidden` card and give the content
 * `relative z-10`. Decorative: hidden from screen readers and never takes a tap (it listens on its parent for the pointer).
 * Off screen or in a hidden tab the wave pauses; reduced motion shows one still frame and no pointer response.
 */
export function GradientStripes({ tone = 'card', count, className = '' }: { tone?: Tone; count?: number; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const running = useRunning(root);
  const wide = useWide();
  const n = Math.max(3, Math.min(40, count ?? (wide ? 16 : 9)));
  const tweens = useRef<{ pause: () => void; resume: () => void }[]>([]);
  // Read inside the async GSAP load, so a wave built while the card is off screen starts paused.
  const runningNow = useRef(running);
  runningNow.current = running;

  // The wave (on each stripe) and the pointer lift (on its fill), rebuilt when the number of stripes changes.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const stripes = Array.from(el.querySelectorAll<HTMLElement>('.fx-stripe'));
    const fills = Array.from(el.querySelectorAll<HTMLElement>('.fx-stripe-fill'));
    let dead = false;
    let off = () => {};
    void import('gsap').then(({ default: gsap }) => {
      if (dead) return;
      if (prefersReducedMotion()) {
        stripes.forEach((s, i) => gsap.set(s, { yPercent: Math.sin((i / n) * Math.PI * 2) * WAVE * 0.6 }));
        off = () => gsap.set(stripes, { clearProps: 'transform' });
        return;
      }
      const list = stripes.map((s, i) => {
        const t = gsap.fromTo(s, { yPercent: WAVE }, { yPercent: -WAVE, duration: PERIOD / 2, ease: 'sine.inOut', repeat: -1, yoyo: true });
        t.seek(((i / n) * PERIOD) % (PERIOD * 2));
        if (!runningNow.current) t.pause();
        return t;
      });
      tweens.current = list;
      let unhook = () => {};
      const host = el.parentElement;
      if (host && hasFinePointer()) {
        const lifts = fills.map((f) => gsap.quickTo(f, 'yPercent', { duration: 0.6, ease: 'power3.out' }));
        const move = (e: PointerEvent) => {
          if (e.pointerType !== 'mouse') return;
          const r = el.getBoundingClientRect();
          if (r.width <= 0) return;
          const at = ((e.clientX - r.left) / r.width) * n - 0.5;
          // Closer to the foot of the card, a little higher; the nearest stripes rise most, fading out over REACH stripes.
          const depth = Math.min(1, Math.max(0.35, (e.clientY - r.top) / r.height));
          lifts.forEach((lift, i) => {
            const d = Math.abs(i - at);
            const k = d >= REACH ? 0 : (Math.cos((d / REACH) * Math.PI) + 1) / 2;
            lift(-LIFT * k * depth);
          });
        };
        const leave = () => lifts.forEach((lift) => lift(0));
        host.addEventListener('pointermove', move);
        host.addEventListener('pointerleave', leave);
        unhook = () => {
          host.removeEventListener('pointermove', move);
          host.removeEventListener('pointerleave', leave);
        };
      }
      off = () => {
        unhook();
        list.forEach((t) => t.kill());
        tweens.current = [];
        gsap.set([...stripes, ...fills], { clearProps: 'transform' });
      };
    });
    return () => {
      dead = true;
      off();
    };
  }, [n]);

  // Nothing moves unseen: the wave stops off screen and in a hidden tab.
  useEffect(() => {
    tweens.current.forEach((t) => (running ? t.resume() : t.pause()));
  }, [running, n]);

  return (
    <div ref={root} aria-hidden="true" data-run={running} data-tone={tone} className={`fx-stripes ${className}`} style={{ '--fx-stripes-n': n } as React.CSSProperties}>
      <div className="fx-stripes-band">
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className="fx-stripe" style={{ '--i': i } as React.CSSProperties}>
            <span className="fx-stripe-fill" />
          </span>
        ))}
      </div>
    </div>
  );
}

/** A laptop or tablet gets sixteen stripes, a phone nine. */
function useWide(): boolean {
  const q = '(min-width: 768px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(q).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}
