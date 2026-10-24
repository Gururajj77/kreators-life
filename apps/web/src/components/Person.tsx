import { RELATIONSHIPS } from '@kreators/shared';

const INK = '#2B1D3A';
const GOLD = '#FFD86B';
const FACE = '#FFE9D6';

interface Props {
  /** Identity stage, 1 to 5. Each stage adds something the person carries. */
  stage?: number;
  size?: number;
  decorative?: boolean;
  className?: string;
}

/**
 * The person climbing the tower. Seed is empty-handed, Sprout holds a seedling,
 * Climber wears a backpack, Steady hand carries a lantern and a cape, and a
 * Luminary wears a crown.
 */
export function Person({ stage = 1, size = 96, decorative = false, className = '' }: Props) {
  const s = Math.max(1, Math.min(5, stage));
  const r = RELATIONSHIPS[s - 1] ?? RELATIONSHIPS[0]!;
  return (
    <svg
      viewBox="0 0 100 124"
      width={size}
      height={size * 1.24}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `You at stage ${s}`}
      className={`shrink-0 overflow-visible ${className}`}
    >
      {s >= 5 && (
        <g stroke={GOLD} strokeWidth="3" strokeLinecap="round">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line key={deg} x1="50" y1="-2" x2="50" y2="5" transform={`rotate(${deg} 50 30)`} />
          ))}
        </g>
      )}
      {s >= 4 && <path d="M32 50 L14 114 L50 104 L86 114 L68 50 Z" fill={r.deep} />}
      {s >= 3 && <rect x="30" y="48" width="40" height="38" rx="10" fill={r.deep} />}

      <rect x="36" y="88" width="11" height="30" rx="5.5" fill={INK} />
      <rect x="53" y="88" width="11" height="30" rx="5.5" fill={INK} />
      <path d="M32 56 C32 46 39 42 50 42 C61 42 68 46 68 56 L71 92 L29 92 Z" fill={r.color} />
      {s >= 3 && (
        <g stroke={r.deep} strokeWidth="4" strokeLinecap="round">
          <path d="M39 44 L41 70" />
          <path d="M61 44 L59 70" />
        </g>
      )}
      <rect x="18" y="50" width="10" height="34" rx="5" fill={r.color} transform="rotate(14 23 52)" />
      <rect x="72" y="50" width="10" height="34" rx="5" fill={r.color} transform="rotate(-14 77 52)" />
      <circle cx="15" cy="84" r="5.5" fill={FACE} />
      <circle cx="85" cy="84" r="5.5" fill={FACE} />

      {s === 2 && (
        <g>
          <path d="M79 86 L91 86 L89 98 L81 98 Z" fill="#C65A14" />
          <path d="M85 86 C85 80 85 77 85 73" stroke="#1E8A4D" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <ellipse cx="81" cy="75" rx="4.5" ry="2.6" fill="#3FCB7A" transform="rotate(-30 81 75)" />
          <ellipse cx="89" cy="73" rx="4.5" ry="2.6" fill="#3FCB7A" transform="rotate(30 89 73)" />
        </g>
      )}
      {s >= 4 && (
        <g>
          <path d="M85 80 L85 86" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          <rect x="79" y="86" width="12" height="15" rx="3" fill={INK} />
          <rect x="81.5" y="88.5" width="7" height="10" rx="2" fill={GOLD} />
        </g>
      )}

      <circle cx="50" cy="30" r="17" fill={FACE} />
      <path d="M33 28 C34 16 44 11 50 11 C56 11 66 16 67 28 C62 22 56 20 50 20 C44 20 38 22 33 28 Z" fill={INK} />
      {s >= 5 && <path d="M36 14 L42 2 L50 12 L58 2 L64 14 Z" fill={GOLD} stroke={r.deep} strokeWidth="1.5" strokeLinejoin="round" />}

      <circle cx="44" cy="30" r="2.4" fill={INK} />
      <circle cx="56" cy="30" r="2.4" fill={INK} />
      <path d={s === 1 ? 'M45 38 L55 38' : 'M44 37 Q50 43 56 37'} stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
