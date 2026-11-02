import { BADGE_BY_KEY, BADGE_FAMILY_META, BADGE_TIER_LABEL, HONOR_BY_KEY, type BadgeShape, type BadgeTier } from '@kreators/shared';
import gsap from 'gsap';
import { useEffect, useId, useRef } from 'react';

/**
 * A badge drawn as a medal. The shape comes from the badge's family, the finish (bronze, silver, gold, platinum) from its tier, both in the
 * colour tokens in app.css, and the picture in the middle is the badge's own emoji. A locked medal is grey with a small padlock. `shine`
 * plays once when a badge has just been earned (a pop and a sweep of light, never looping; under reduced motion it is only set, not played).
 * The words next to it (or the label it carries) say earned or locked, so the state never depends on colour.
 */
type Size = 'sm' | 'md' | 'lg';
const PX: Record<Size, number> = { sm: 40, md: 64, lg: 120 };

/** Closed polygon of a star with `n` points. */
function starPath(n: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}
/** A round seal with a scalloped edge. */
function sealPath(lobes: number, base: number, depth: number): string {
  const pts: string[] = [];
  const steps = lobes * 6;
  for (let i = 0; i < steps; i += 1) {
    const a = (2 * Math.PI * i) / steps - Math.PI / 2;
    const r = base + depth * Math.cos(lobes * (a + Math.PI / 2));
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)} ${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}

/** The outline of each shape in a 100 by 100 box, and where the picture sits. */
const SHAPES: Record<BadgeShape, { d: string; cy: number; tails?: string }> = {
  shield: { d: 'M50 6 L86 18 V48 C86 72 70 86 50 94 C30 86 14 72 14 48 V18 Z', cy: 48 },
  hexagon: { d: 'M50 6 L88 28 V72 L50 94 L12 72 V28 Z', cy: 50 },
  star: { d: starPath(12, 46, 39), cy: 50 },
  seal: { d: sealPath(12, 41, 4), cy: 50 },
  ribbon: { d: 'M50 8 a36 36 0 1 0 0.01 0 Z', cy: 44, tails: 'M30 68 L20 96 L35 88 L42 98 L48 72 Z M70 68 L80 96 L65 88 L58 98 L52 72 Z' },
  diamond: { d: 'M50 5 L93 50 L50 95 L7 50 Z', cy: 50 },
  medal: { d: 'M50 6 a44 44 0 1 0 0.01 0 Z', cy: 50 },
};

export function BadgeArt({
  name,
  emoji,
  tier,
  shape,
  earned,
  size = 'md',
  shine = false,
  decorative = false,
  className = '',
}: {
  name: string;
  emoji: string;
  tier: BadgeTier;
  shape: BadgeShape;
  earned: boolean;
  size?: Size;
  /** Play the earned-just-now shine once. */
  shine?: boolean;
  /** True when the words beside it already say the name and the state, so a screen reader skips the picture. */
  decorative?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const root = useRef<SVGSVGElement>(null);
  const sweep = useRef<SVGRectElement>(null);
  const s = SHAPES[shape];
  const finish = earned ? tier : 'locked';
  const px = PX[size];
  const state = earned ? 'earned' : 'locked';
  const label = `${name}, ${BADGE_TIER_LABEL[tier].toLowerCase()} badge, ${state}`;

  useEffect(() => {
    if (!shine || !earned || !root.current || !sweep.current) return;
    const quiet = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (quiet) {
      gsap.set(root.current, { scale: 1 });
      gsap.set(sweep.current, { opacity: 0 });
      return;
    }
    const tl = gsap.timeline();
    tl.fromTo(root.current, { scale: 0.7 }, { scale: 1, duration: 0.55, ease: 'back.out(2.2)' }, 0);
    tl.fromTo(sweep.current, { attr: { x: -40 }, opacity: 1 }, { attr: { x: 110 }, duration: 0.9, ease: 'power2.inOut' }, 0.15);
    tl.set(sweep.current, { opacity: 0 });
    return () => {
      tl.kill();
    };
  }, [shine, earned]);

  const plate = `translate(50 ${s.cy}) scale(0.8) translate(-50 -${s.cy})`;

  return (
    <svg
      ref={root}
      viewBox="0 0 100 100"
      width={px}
      height={px}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      data-state={state}
      className={`badge-art ${earned ? '' : 'badge-art--locked'} shrink-0 ${className}`}
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: `var(--badge-${finish}-a)` }} />
          <stop offset="1" style={{ stopColor: `var(--badge-${finish}-b)` }} />
        </linearGradient>
        <linearGradient id={`${uid}p`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: `var(--badge-${finish}-plate-a)` }} />
          <stop offset="1" style={{ stopColor: `var(--badge-${finish}-plate-b)` }} />
        </linearGradient>
        <linearGradient id={`${uid}h`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--badge-shine)', stopOpacity: 0.7 }} />
          <stop offset="1" style={{ stopColor: 'var(--badge-shine)', stopOpacity: 0 }} />
        </linearGradient>
        <linearGradient id={`${uid}s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: 'var(--badge-shine)', stopOpacity: 0 }} />
          <stop offset="0.5" style={{ stopColor: 'var(--badge-shine)', stopOpacity: 0.95 }} />
          <stop offset="1" style={{ stopColor: 'var(--badge-shine)', stopOpacity: 0 }} />
        </linearGradient>
        <clipPath id={`${uid}c`}>
          <path d={s.d} />
        </clipPath>
      </defs>
      {!decorative && <title>{label}</title>}
      {s.tails && <path d={s.tails} fill={`url(#${uid}r)`} stroke={`var(--badge-${finish}-b)`} strokeWidth="1.5" strokeLinejoin="round" />}
      <path d={s.d} fill={`url(#${uid}r)`} stroke={`var(--badge-${finish}-b)`} strokeWidth="1.5" strokeLinejoin="round" />
      <path d={s.d} transform={plate} fill={`url(#${uid}p)`} stroke={`var(--badge-${finish}-a)`} strokeWidth="1.5" strokeLinejoin="round" />
      <g clipPath={`url(#${uid}c)`}>
        <rect x="0" y="0" width="100" height="52" fill={`url(#${uid}h)`} />
        <g transform="rotate(20 50 50)">
          <rect ref={sweep} x="-40" y="-10" width="26" height="120" fill={`url(#${uid}s)`} opacity="0" />
        </g>
      </g>
      <text className="badge-art-emoji" x="50" y={s.cy} textAnchor="middle" dominantBaseline="central" fontSize="34" aria-hidden="true">
        {emoji}
      </text>
      {!earned && (
        <g aria-hidden="true">
          <circle cx="76" cy="76" r="15" style={{ fill: 'var(--card-strong)', stroke: 'var(--ink-soft)' }} strokeWidth="2" />
          <rect x="69" y="75" width="14" height="10" rx="2" style={{ fill: 'var(--ink-soft)' }} />
          <path d="M72 75 V71 a4 4 0 0 1 8 0 V75" fill="none" style={{ stroke: 'var(--ink-soft)' }} strokeWidth="2.2" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

/** A badge or an honor by its key, drawn as a medal. An honor wears a seal. Returns nothing for a key that is not known. */
export function BadgeMedal({ k, earned = true, size = 'sm', shine = false, decorative = false, className = '' }: { k: string; earned?: boolean; size?: Size; shine?: boolean; decorative?: boolean; className?: string }) {
  const b = BADGE_BY_KEY[k];
  if (b) return <BadgeArt name={b.name} emoji={b.emoji} tier={b.tier} shape={BADGE_FAMILY_META[b.family].shape} earned={earned} size={size} shine={shine} decorative={decorative} className={className} />;
  const h = HONOR_BY_KEY[k];
  if (h) return <BadgeArt name={h.name} emoji={h.emoji} tier={h.tier} shape="seal" earned={earned} size={size} shine={shine} decorative={decorative} className={className} />;
  return null;
}
