import gsap from 'gsap';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { hasFinePointer, prefersReducedMotion, useRunning } from './env';

/** A soft white spot, drawn once: where it lies the picture ripples, and it fades to nothing at its edge. */
const SPOT =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="g"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="100" height="100" fill="url(#g)"/></svg>',
  );

/** How far the picture moves: nothing at rest, a faint drift while idle, a little more around the mouse. */
const IDLE = 1.4;
const TOUCH = 8;
const SPOT_IDLE = 360;
const SPOT_TOUCH = 170;

/**
 * Our own build of a "liquid ripple image": the picture inside moves like water, only a little. One inline SVG filter does it: a
 * turbulence field, kept only inside a soft spot (an feImage) over a neutral grey, drives an feDisplacementMap. The displacement is 0 at
 * rest. While the picture is on screen and the tab is visible, a large faint spot drifts slowly over it; with a mouse (never a touch
 * screen) the spot shrinks to the pointer and the ripple rises with a short GSAP ease, then settles back. Under reduced motion there is no
 * filter at all. Only the picture is filtered, never the words over it.
 */
export function LiquidRipple({ width, height, className = '', children }: { width: number; height: number; className?: string; children: ReactNode }) {
  const id = `ripple-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const turbRef = useRef<SVGFETurbulenceElement>(null);
  const spotRef = useRef<SVGFEImageElement>(null);
  const dispRef = useRef<SVGFEDisplacementMapElement>(null);
  const running = useRunning(svgRef);
  const still = useRef(prefersReducedMotion());
  // Shared between the idle drift and the pointer: the ripple's strength, the spot's centre and size, and whether a mouse is on it.
  const state = useRef({ scale: 0, x: width * 0.7, y: height * 0.4, size: SPOT_IDLE, hover: false });

  const draw = () => {
    const s = state.current;
    dispRef.current?.setAttribute('scale', s.scale.toFixed(2));
    const spot = spotRef.current;
    if (spot) {
      spot.setAttribute('x', (s.x - s.size / 2).toFixed(1));
      spot.setAttribute('y', (s.y - s.size / 2).toFixed(1));
      spot.setAttribute('width', s.size.toFixed(1));
      spot.setAttribute('height', s.size.toFixed(1));
    }
  };

  // The idle drift: a big faint spot wandering slowly, and the water's grain shifting. Only while seen; it stops and settles when not.
  useEffect(() => {
    if (still.current || !running) return;
    const s = state.current;
    const grain = { f: 0.011 };
    const tweens = [
      gsap.to(s, { scale: s.hover ? s.scale : IDLE, duration: 1.2, ease: 'power2.out', onUpdate: draw }),
      gsap.to(grain, {
        f: 0.015,
        duration: 12,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        onUpdate: () => turbRef.current?.setAttribute('baseFrequency', `${grain.f.toFixed(4)} ${(grain.f * 2.6).toFixed(4)}`),
      }),
      gsap.to(s, {
        keyframes: [
          { x: width * 0.45, y: height * 0.65, duration: 9 },
          { x: width * 0.85, y: height * 0.3, duration: 11 },
          { x: width * 0.7, y: height * 0.4, duration: 8 },
        ],
        ease: 'sine.inOut',
        repeat: -1,
        onUpdate: () => {
          if (!s.hover) draw();
        },
      }),
    ];
    return () => {
      tweens.forEach((t) => t.kill());
      s.scale = 0;
      draw();
    };
    // draw reads refs only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, width, height]);

  // The pointer: a mouse over the card pulls the ripple to it; it settles back a moment after the mouse stops or leaves.
  useEffect(() => {
    const svg = svgRef.current;
    const host = svg?.closest<HTMLElement>('[data-cover]');
    if (still.current || !svg || !host || !hasFinePointer()) return;
    const s = state.current;
    let settle = 0;
    const rest = () => {
      s.hover = false;
      gsap.to(s, { scale: IDLE, size: SPOT_IDLE, duration: 1.1, ease: 'power2.out', overwrite: 'auto', onUpdate: draw });
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      s.hover = true;
      gsap.to(s, { x: p.x, y: p.y, scale: TOUCH, size: SPOT_TOUCH, duration: 0.5, ease: 'power3.out', overwrite: 'auto', onUpdate: draw });
      window.clearTimeout(settle);
      settle = window.setTimeout(rest, 180);
    };
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', rest);
    return () => {
      window.clearTimeout(settle);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', rest);
      gsap.killTweensOf(s);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMaxYMid slice" className={className} aria-hidden="true" focusable="false" data-run={running ? '' : undefined}>
      {!still.current && (
        <defs>
          <filter id={id} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x={-12} y={-12} width={width + 24} height={height + 24} colorInterpolationFilters="sRGB">
            <feTurbulence ref={turbRef} type="turbulence" baseFrequency="0.011 0.0286" numOctaves={2} seed={7} result="noise" />
            {/* Opaque noise, so the soft spot alone decides where it shows. */}
            <feColorMatrix in="noise" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1" result="solid" />
            <feImage ref={spotRef} href={SPOT} x={width * 0.7 - SPOT_IDLE / 2} y={height * 0.4 - SPOT_IDLE / 2} width={SPOT_IDLE} height={SPOT_IDLE} preserveAspectRatio="none" result="spot" />
            <feComposite in="solid" in2="spot" operator="in" result="local" />
            {/* Neutral grey moves nothing, so outside the spot the picture stays exactly where it is. */}
            <feFlood floodColor="rgb(128,128,128)" result="calm" />
            <feMerge result="map">
              <feMergeNode in="calm" />
              <feMergeNode in="local" />
            </feMerge>
            <feDisplacementMap ref={dispRef} in="SourceGraphic" in2="map" scale={0} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      )}
      <g filter={still.current ? undefined : `url(#${id})`}>{children}</g>
    </svg>
  );
}
