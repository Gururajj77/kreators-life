import { useRef } from 'react';
import { useRunning } from './env';

const COLOURS = ['var(--color-r6)', 'var(--color-r5)', 'var(--color-r4)', 'var(--color-r7)', 'var(--color-r2)', 'var(--color-r1)'];

/** Few, long, slow curves: the same shapes every time, so the picture is stable between visits. */
const PATHS = COLOURS.map((colour, i) => {
  const y = 70 + i * 62;
  const bend = i % 2 === 0 ? 1 : -1;
  const d = `M -60 ${y + 40 * bend} C 220 ${y - 150 * bend}, 420 ${y + 170 * bend}, 640 ${y} S 1010 ${y - 160 * bend}, 1270 ${y + 50 * bend}`;
  return { d, colour, dur: 26 + i * 5, delay: -i * 4 };
});

/**
 * Faint lines that flow across the hero. Each curve is a still hairline with a short bright dash travelling along it. Very low opacity,
 * behind the words (the parent needs `isolate` and `relative`), paused off screen and in a hidden tab, and only the still lines under
 * reduced motion. Decorative.
 */
export function BackgroundPaths({ className = '' }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const running = useRunning(ref);
  return (
    <svg ref={ref} viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true" data-run={running} className={`fx-paths pointer-events-none absolute inset-0 -z-10 h-full w-full ${className}`}>
      {PATHS.map((p, i) => (
        <g key={i} style={{ color: p.colour }}>
          <path d={p.d} className="fx-path-still" />
          <path d={p.d} pathLength={1000} className="fx-path-flow" style={{ animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }} />
        </g>
      ))}
    </svg>
  );
}
