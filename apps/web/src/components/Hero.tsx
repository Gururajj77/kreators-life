import type { RelationshipKey } from '@kreators/shared';
import type { CSSProperties, ReactNode } from 'react';
import { Avatar, type Mood } from './Avatar';

/**
 * The kit's hero: a solid colour, soft circles behind, everything on it in white, and one of the
 * seven characters standing on the right. Dark elements never sit on a colour; buttons on it are
 * white with dark text (see Button "light").
 */
export function Hero({ color, deep, children, className = '', yellow = false, character, mood = 'happy', characterSize = 80 }: { color: string; deep?: string; children: ReactNode; className?: string; yellow?: boolean; character?: RelationshipKey; mood?: Mood; characterSize?: number }) {
  return (
    <section className={`relative overflow-hidden rounded-card p-md ${yellow ? 'text-on-yellow' : 'text-on-fill'} ${className}`} style={{ background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 72%, var(--fill-shade)))`, '--toy-color': deep ?? 'var(--color-shadow)' } as CSSProperties}>
      <HeroBlobs />
      <div className="relative flex items-center gap-sm">
        <div className="min-w-0 flex-1">{children}</div>
        {character && (
          <span className="shrink-0" aria-hidden="true">
            <Avatar relationship={character} size={characterSize} mood={mood} decorative />
          </span>
        )}
      </div>
    </section>
  );
}

/** One leaf: a lens shape from its stem, pointing along +x. */
const LEAF = 'M0 0 C 14 -15 40 -15 56 0 C 40 15 14 15 0 0 Z';
/** A five-petal flower, centred on the origin. */
const PETAL = 'M0 0 C -9 -8 -9 -24 0 -30 C 9 -24 9 -8 0 0 Z';

function Flower({ x, y, s = 1, rot = 0, o = 1 }: { x: number; y: number; s?: number; rot?: number; o?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
      {[0, 72, 144, 216, 288].map((a) => (
        <path key={a} d={PETAL} transform={`rotate(${a})`} />
      ))}
      <circle r="6" fill="currentColor" opacity="0.55" />
    </g>
  );
}

/** A branch: a curved stem with leaves down both sides, running from its base outward. */
function Branch({ x, y, rot, s = 1, o = 1, n = 6 }: { x: number; y: number; rot: number; s?: number; o?: number; n?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} opacity={o}>
      <path d={`M0 0 C ${n * 14} -10 ${n * 22} 8 ${n * 30} 0`} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      {Array.from({ length: n }, (_, i) => {
        const t = (i + 0.6) / n;
        const px = t * n * 30;
        const py = Math.sin(t * Math.PI) * -4;
        const grow = 1 - t * 0.45;
        return (
          <g key={i}>
            <path d={LEAF} transform={`translate(${px} ${py}) rotate(-38) scale(${grow})`} />
            <path d={LEAF} transform={`translate(${px} ${py}) rotate(38) scale(${grow})`} />
          </g>
        );
      })}
      <path d={LEAF} transform={`translate(${n * 30} 0) scale(0.7)`} />
    </g>
  );
}

/**
 * What sits behind a hero: one leafy branch and one flower in the top right corner (where the page and bell buttons are), nothing else.
 * Very low opacity white, faded out toward the middle by a mask, so it never sits under the words or the numbers. Decorative only.
 */
export function HeroBlobs({ opacity = 0.14 }: { opacity?: number }) {
  const k = opacity / 0.14;
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full text-white"
      viewBox="0 0 400 240"
      preserveAspectRatio="xMaxYMin slice"
      aria-hidden="true"
      style={{ WebkitMaskImage: 'linear-gradient(to left, #000 0%, #000 18%, transparent 52%)', maskImage: 'linear-gradient(to left, #000 0%, #000 18%, transparent 52%)' }}
    >
      <g fill="white" opacity={0.07 * k}>
        <Branch x={412} y={-6} rot={146} s={0.85} n={5} />
        <Flower x={346} y={104} s={0.7} rot={14} />
      </g>
    </svg>
  );
}

/** The big number on a hero, with its unit and the line under it. */
export function HeroNumber({ value, unit, label, align = 'left' }: { value: ReactNode; unit?: string; label: ReactNode; align?: 'left' | 'center' }) {
  return (
    <div className={align === 'center' ? 'text-center' : ''}>
      <p className="m-0 font-display text-[64px] font-extrabold leading-none">
        {value}
        {unit && <span className="text-[24px]"> {unit}</span>}
      </p>
      <p className="mt-xs m-0 text-[18px] font-extrabold">{label}</p>
    </div>
  );
}
