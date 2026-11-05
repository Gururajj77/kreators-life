import { useEffect, useRef } from 'react';
import { hasFinePointer, prefersReducedMotion, useRunning } from './env';

/** How far the colour drifts sideways through the glass, as a share of the card, and over how many seconds. */
const DRIFT = 7;
const PERIOD = 16;
/** How far the colour follows a mouse, in px at the card's edge. */
const FOLLOW = 48;

/** The glass's colour. Navy is the public home's (the default); the others are drawn from the pillar colours in app.css
 * (FractalGlass colours), each on its own deep base so white words and the white button keep AA: teal (green and sky blue) on
 * /features, wine (red, orange and the faith violet) on /7rp. */
export type FractalHue = 'navy' | 'teal' | 'wine';

/**
 * Fractal (fluted) glass: a glow of electric blue, violet and white-lavender on deep navy, seen through narrow upright ribs, each with a
 * dark edge and a bright streak (the look the founder picked, 2026-11-05). Four still layers in CSS (app.css, FractalGlass); GSAP only
 * slides the glow under the fixed ribs. No WebGL and no backdrop filter.
 *
 * Put it as the first child of a `relative overflow-hidden fx-fglass-host` card with `text-on-fill` and give the content `relative z-10`: the card is the
 * night slate in both themes, the colour sits low and to the right, and a scrim keeps the top left (where the words are) dark enough
 * for white text at AA. Decorative: hidden from screen readers, never takes a tap (it listens on its parent for a mouse). The drift
 * pauses off screen and in a hidden tab; reduced motion shows one still frame; reduced transparency or more contrast hides the
 * glass and leaves the solid slate.
 */
export function FractalGlass({ className = '', hue = 'navy' }: { className?: string; hue?: FractalHue }) {
  const root = useRef<HTMLDivElement>(null);
  const running = useRunning(root);
  const drift = useRef<{ pause: () => void; resume: () => void } | null>(null);
  const runningNow = useRef(running);
  runningNow.current = running;

  useEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    let dead = false;
    let off = () => {};
    void import('gsap').then(({ default: gsap }) => {
      if (dead) return;
      const t = gsap.fromTo(el, { '--fg-drift': -DRIFT }, { '--fg-drift': DRIFT, duration: PERIOD / 2, ease: 'sine.inOut', repeat: -1, yoyo: true });
      if (!runningNow.current) t.pause();
      drift.current = t;
      let unhook = () => {};
      const host = el.parentElement;
      if (host && hasFinePointer()) {
        const follow = gsap.quickTo(el, '--fg-px', { duration: 0.9, ease: 'power3.out' });
        const move = (e: PointerEvent) => {
          if (e.pointerType !== 'mouse') return;
          const r = el.getBoundingClientRect();
          if (r.width <= 0) return;
          follow(((e.clientX - r.left) / r.width - 0.5) * 2 * FOLLOW);
        };
        const leave = () => follow(0);
        host.addEventListener('pointermove', move);
        host.addEventListener('pointerleave', leave);
        unhook = () => {
          host.removeEventListener('pointermove', move);
          host.removeEventListener('pointerleave', leave);
          // A quickTo tween is paused, never done, so GSAP keeps it (and the element) until it is killed.
          follow.tween.kill();
        };
      }
      off = () => {
        unhook();
        t.kill();
        drift.current = null;
        gsap.set(el, { clearProps: '--fg-drift,--fg-px' });
      };
    });
    return () => {
      dead = true;
      off();
    };
  }, []);

  // Nothing moves unseen: the drift stops off screen and in a hidden tab.
  useEffect(() => {
    if (running) drift.current?.resume();
    else drift.current?.pause();
  }, [running]);

  return (
    <div ref={root} aria-hidden="true" data-run={running} data-hue={hue} className={`fx-fglass ${className}`}>
      <div className="fx-fglass-field" />
      <div className="fx-fglass-ribs" />
      <div className="fx-fglass-shine" />
      <div className="fx-fglass-scrim" />
    </div>
  );
}
