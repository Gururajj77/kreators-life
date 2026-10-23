import { RELATIONSHIPS } from '@kreators/shared';

const INK = '#2B1D3A';
const GOLD = '#FFD86B';
const FACE = '#FFE9D6';

interface Props {
  /** Identity stage, 1 to 5. Each stage adds something the creator carries. */
  stage?: number;
  size?: number;
  decorative?: boolean;
  className?: string;
}

/** The person climbing the tower. Seed is empty-handed; by Luminary they wear a crown. */
export function Creator({ stage = 1, size = 96, decorative = false, className = '' }: Props) {
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
        <g stroke={GOLD} strokeWidth="3" strokeLinecap="round" opacity="0.9">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line key={deg} x1="50" y1="2" x2="50" y2="10" transform={`rotate(${deg} 50 30)`} />
          ))}
        </g>
      )}
      {s >= 3 && <circle cx="50" cy="30" r="26" fill="none" stroke="#fff" strokeWidth="5" opacity="0.9" />}
      {s >= 4 && <path d="M30 52 L14 112 L50 100 L86 112 L70 52 Z" fill={r.deep} />}

      <rect x="36" y="88" width="11" height="30" rx="5.5" fill={r.deep} />
      <rect x="53" y="88" width="11" height="30" rx="5.5" fill={r.deep} />
      <path d="M30 56 C30 46 38 42 50 42 C62 42 70 46 70 56 L73 92 L27 92 Z" fill={r.color} />
      <rect x="16" y="50" width="11" height="36" rx="5.5" fill={r.color} transform="rotate(-12 21 50)" />
      <rect x="73" y="50" width="11" height="36" rx="5.5" fill={r.color} transform="rotate(12 79 50)" />
      {s >= 2 && (
        <g>
          <rect x="80" y="76" width="11" height="18" rx="2" fill={INK} />
          <rect x="82" y="78" width="7" height="12" rx="1" fill="#fff" opacity="0.8" />
        </g>
      )}
      {s >= 4 && (
        <g>
          <rect x="10" y="64" width="6" height="22" rx="3" fill={INK} />
          <circle cx="13" cy="62" r="6" fill={r.deep} stroke={INK} strokeWidth="2" />
        </g>
      )}

      <circle cx="50" cy="30" r="17" fill={FACE} />
      <path d="M33 28 C34 16 44 11 50 11 C56 11 66 16 67 28 C62 22 56 20 50 20 C44 20 38 22 33 28 Z" fill={INK} />
      {s >= 3 && (
        <g>
          <path d="M32 30 C32 14 68 14 68 30" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          <rect x="28" y="26" width="8" height="12" rx="3" fill={INK} />
          <rect x="64" y="26" width="8" height="12" rx="3" fill={INK} />
        </g>
      )}
      {s >= 5 && <path d="M36 14 L42 2 L50 12 L58 2 L64 14 Z" fill={GOLD} stroke={r.deep} strokeWidth="1.5" strokeLinejoin="round" />}

      <circle cx="44" cy="30" r="2.4" fill={INK} />
      <circle cx="56" cy="30" r="2.4" fill={INK} />
      <path d={s === 1 ? 'M45 38 L55 38' : 'M44 37 Q50 43 56 37'} stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
