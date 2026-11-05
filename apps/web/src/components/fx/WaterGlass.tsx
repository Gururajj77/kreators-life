import gsap from 'gsap';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion, useRunning } from './env';

// The glass is drawn in a 80 by 100 box: the rim at the top, the base at the bottom, the water clipped to the inside.
const TOP = 10;
// Below the foot (95) by the waves' height, so an empty glass shows no water at all.
const BOTTOM = 99;
const levelY = (pct: number) => TOP + (1 - pct) * (BOTTOM - TOP);
// Two waves, each two periods wider than the glass so sliding them one period sideways loops without a seam.
const wave = (amp: number, phase: number) => {
  const p = 40;
  let d = `M ${-80 + phase} 0`;
  for (let x = -80; x < 160; x += p) d += ` q ${p / 4} ${-amp} ${p / 2} 0 t ${p / 2} 0`;
  return `${d} V 120 H ${-80 + phase} Z`;
};

/**
 * Today's water as a glass that fills (2026-11-06, the founder: "create a glass with animation that gets filled with every update").
 * Each glass added or undone glides the water to its new level with a short slosh; while the glass is on screen in a visible tab a soft
 * wave moves across the top. Under reduced motion, in a hidden tab and on the first paint the level is set with no movement. Only
 * transforms move. It is decoration: the number beside it says the same thing in words.
 */
export function WaterGlass({ value, max, size = 96, className = '' }: { value: number | undefined; max: number | undefined; size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  const pct = value !== undefined && max ? Math.min(1, Math.max(0, value / max)) : 0;
  const box = useRef<SVGSVGElement>(null);
  const level = useRef<SVGGElement>(null);
  const front = useRef<SVGPathElement>(null);
  const back = useRef<SVGPathElement>(null);
  const placed = useRef(false);
  const last = useRef(pct);
  const running = useRunning(box);
  // The level React draws once, so a re-render never writes over the level GSAP has moved the water to.
  const [startY] = useState(() => levelY(pct));

  // The first level is placed before the browser draws, so the glass never fills up on load; only a change after that moves.
  useLayoutEffect(() => {
    if (!level.current || placed.current || value === undefined) return;
    gsap.set(level.current, { y: levelY(pct) });
    last.current = pct;
    placed.current = true;
  }, [pct, value]);

  useEffect(() => {
    const el = level.current;
    if (!el || !placed.current || last.current === pct) return;
    const rising = pct > last.current;
    last.current = pct;
    gsap.killTweensOf(el);
    if (prefersReducedMotion() || document.visibilityState === 'hidden') {
      gsap.set(el, { y: levelY(pct), rotation: 0 });
      return;
    }
    gsap.to(el, { y: levelY(pct), duration: 0.9, ease: 'power3.out' });
    // A short slosh: the surface tips one way and settles, a little more when a glass goes in than when one is taken back.
    gsap.fromTo(el, { rotation: rising ? -5 : 3, svgOrigin: '40 50' }, { rotation: 0, svgOrigin: '40 50', duration: 1.1, ease: 'elastic.out(1, 0.45)' });
    // The element is captured here: by the time an unmount's cleanup runs, React has already cleared the ref.
    return () => {
      gsap.killTweensOf(el);
    };
  }, [pct]);

  // The surface wave runs only while the glass can be seen.
  useEffect(() => {
    const els = [front.current, back.current].filter(Boolean) as SVGPathElement[];
    if (!running || prefersReducedMotion() || els.length < 2) return;
    const a = gsap.to(els[0]!, { x: 40, duration: 2.6, ease: 'none', repeat: -1 });
    const b = gsap.to(els[1]!, { x: -40, duration: 3.4, ease: 'none', repeat: -1 });
    return () => {
      a.kill();
      b.kill();
      gsap.set(els, { x: 0 });
    };
  }, [running]);

  // A tumbler, a little narrower at the base, with a rounded foot.
  const outline = 'M 8 6 H 72 L 64.5 90 Q 64 95 59 95 H 21 Q 16 95 15.5 90 Z';
  return (
    <svg ref={box} viewBox="0 0 80 100" width={size * 0.8} height={size} className={`water-glass ${className}`} aria-hidden="true">
      <defs>
        <clipPath id={`wg-${id}`}>
          <path d={outline} />
        </clipPath>
        <linearGradient id={`wl-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--water-glass-top)" />
          <stop offset="1" stopColor="var(--water-glass-deep)" />
        </linearGradient>
      </defs>
      {/* The glass itself: a faint inside, then the water, then the rim and a streak of light over it. */}
      <path d={outline} fill="var(--water-glass-inside)" />
      <g clipPath={`url(#wg-${id})`}>
        <g ref={level} transform={`translate(0 ${startY})`}>
          {/* Two waves a half period apart that drift opposite ways, so the surface crosses itself like water in a glass. */}
          <path ref={back} d={wave(3.6, 20)} fill="var(--water-glass-top)" opacity="0.6" transform="translate(0 -2)" />
          <path ref={front} d={wave(4, 0)} fill={`url(#wl-${id})`} />
        </g>
      </g>
      <path d={outline} fill="none" stroke="var(--water-glass-rim)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M 16 14 L 21 84" stroke="var(--water-glass-shine)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
