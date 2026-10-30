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
      <HeroBlobs seed={color} />
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

/** The seven flowers: one for each pillar, so the decoration differs from place to place instead of repeating. */
export type FlowerKind = 'blossom' | 'daisy' | 'lotus' | 'poppy' | 'tulip' | 'cosmos' | 'violet';
export const FLOWER_KINDS: readonly FlowerKind[] = ['blossom', 'daisy', 'lotus', 'poppy', 'tulip', 'cosmos', 'violet'];
/** Each pillar wears its own flower: a poppy for work and money, a blossom for friends, a daisy for family, a tulip for love, a violet for yourself, a cosmos for teachers, a lotus for faith. */
export const PILLAR_FLOWER: Record<RelationshipKey, FlowerKind> = {
  servant_leader: 'poppy',
  friendship: 'blossom',
  parent_child: 'daisy',
  lover_partner: 'tulip',
  self: 'violet',
  guru: 'cosmos',
  divine: 'lotus',
};
/** The same text always picks the same flower, so a card keeps its flower between visits. */
export function flowerFor(seed: string): FlowerKind {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return FLOWER_KINDS[h % FLOWER_KINDS.length] ?? 'blossom';
}

const ring = (n: number, d: string, offset = 0, scale = 1) =>
  Array.from({ length: n }, (_, i) => <path key={`${d}${i}${offset}`} d={d} transform={`rotate(${(360 / n) * i + offset}) scale(${scale})`} />);
const heart = (r: number) => <circle r={r} fill="currentColor" opacity="0.5" />;

/** Each flower is one big shape, drawn around the origin and about 150 units across, so it fills its box without touching the edge. */
const FLOWER_SHAPE: Record<FlowerKind, () => ReactNode> = {
  // Five notched petals, like a cherry blossom.
  blossom: () => (
    <g transform="scale(1.9)">
      {ring(5, 'M0 0 C -15 -9 -18 -28 -7 -37 L 0 -31 L 7 -37 C 18 -28 15 -9 0 0 Z')}
      {heart(5)}
    </g>
  ),
  // Many slim petals around a full centre.
  daisy: () => (
    <g transform="scale(2.05)">
      {ring(14, 'M0 0 C -4.5 -10 -4 -24 0 -33 C 4 -24 4.5 -10 0 0 Z')}
      <circle r="9" fill="currentColor" opacity="0.55" />
    </g>
  ),
  // Two rings of pointed petals, the inner turned between the outer.
  lotus: () => (
    <g transform="scale(1.7)">
      {ring(8, 'M0 0 C -10 -10 -12 -30 0 -46 C 12 -30 10 -10 0 0 Z')}
      {ring(6, 'M0 0 C -9 -8 -10 -24 0 -36 C 10 -24 9 -8 0 0 Z', 30, 0.7)}
      {heart(4)}
    </g>
  ),
  // Four broad, round petals.
  poppy: () => (
    <g transform="scale(1.85)">
      {ring(4, 'M0 0 C -26 -6 -30 -34 0 -42 C 30 -34 26 -6 0 0 Z', 45)}
      <circle r="8" fill="currentColor" opacity="0.55" />
    </g>
  ),
  // Seen from the side: three petals in a cup, a stem and one leaf.
  tulip: () => (
    <g transform="translate(0 10) scale(1.55)">
      <path d="M-24 -4 C -30 -38 -12 -58 0 -66 C 12 -58 30 -38 24 -4 C 12 6 -12 6 -24 -4 Z" />
      <path d="M-24 -4 C -36 -34 -22 -52 -8 -50 C -12 -34 -12 -14 -4 2 Z" opacity="0.75" />
      <path d="M24 -4 C 36 -34 22 -52 8 -50 C 12 -34 12 -14 4 2 Z" opacity="0.75" />
      <path d="M0 4 C 2 24 0 40 -2 54" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M0 40 C 18 36 30 22 28 6 C 14 10 4 24 0 40 Z" opacity="0.7" />
    </g>
  ),
  // Eight broad, three-toothed petals.
  cosmos: () => (
    <g transform="scale(1.85)">
      {ring(8, 'M0 0 C -12 -8 -16 -30 -9 -40 L -3 -35 L 0 -40 L 3 -35 L 9 -40 C 16 -30 12 -8 0 0 Z')}
      {heart(6)}
    </g>
  ),
  // Five round petals, as a violet or a forget-me-not has them.
  violet: () => (
    <g transform="scale(2.2)">
      {ring(5, 'M0 0 C -11 -4 -13 -22 0 -28 C 13 -22 11 -4 0 0 Z', 18)}
      <circle r="5" fill="currentColor" opacity="0.55" />
    </g>
  ),
};

/**
 * One big flower in its own box. The box is 200 by 170, the flower sits inside it with room to spare, and the svg scales down to fit
 * whatever holds it (`max-w-full`), so no petal is ever cut off; the edges fade out instead of ending. Which flower it is comes from
 * `kind`, or from `seed` (the same text always picks the same flower). Decorative only, very faint, kept to a corner away from words.
 */
export function Posy({ kind, seed, tone = 'white', className = '', opacity = 0.14, flip = false }: { kind?: FlowerKind; seed?: string; tone?: 'white' | 'ink'; className?: string; opacity?: number; flip?: boolean }) {
  const flower = kind ?? flowerFor(seed ?? 'kreators');
  const k = opacity / 0.14;
  const o = tone === 'ink' ? 0.55 : 1;
  const mask = 'radial-gradient(ellipse 60% 62% at 54% 48%, #000 46%, transparent 100%)';
  return (
    <svg
      viewBox="0 0 200 170"
      className={`pointer-events-none absolute h-auto w-[200px] max-w-full ${className}`}
      style={{ color: tone === 'ink' ? 'var(--color-ink)' : 'white', WebkitMaskImage: mask, maskImage: mask, transform: flip ? 'scaleX(-1)' : undefined }}
      aria-hidden="true"
    >
      <g fill="currentColor" opacity={0.085 * k * o} transform="translate(104 88)">
        {FLOWER_SHAPE[flower]()}
      </g>
    </svg>
  );
}

/** A thin rule with one small blossom in the middle: a quiet full stop for the end of a page. */
export function Ornament({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 28" className={`mx-auto h-[28px] w-[220px] max-w-full text-ink ${className}`} aria-hidden="true">
      <g fill="currentColor" opacity="0.22">
        <rect x="8" y="13.2" width="78" height="1.6" rx="0.8" />
        <rect x="134" y="13.2" width="78" height="1.6" rx="0.8" />
        <g transform="translate(110 14) scale(0.3)">{FLOWER_SHAPE.blossom()}</g>
      </g>
    </svg>
  );
}

/** What sits behind a hero or a coloured card: one flower, at the top right where the buttons are. Pass `kind` or a `seed`. */
export function HeroBlobs({ opacity = 0.14, tone = 'white', kind, seed }: { opacity?: number; tone?: 'white' | 'ink'; kind?: FlowerKind; seed?: string }) {
  return <Posy kind={kind} seed={seed} tone={tone} opacity={opacity} className="top-0 right-0" />;
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
