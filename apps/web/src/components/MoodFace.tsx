import { MOODS } from '@kreators/shared';

/**
 * The kit's mood face: a coloured disc with a simple drawn face, one per mood from low to overjoyed.
 * Drawn in SVG so it scales from a 16px chip to the 140px hero face and never depends on the system's emoji.
 */
export function MoodFace({ value, size = 40, color, face, className = '', label }: { value: number; size?: number; color?: string; face?: string; className?: string; label?: string }) {
  const m = MOODS.find((x) => x.value === Math.round(value)) ?? MOODS[2]!;
  const fill = color ?? m.color;
  const ink = face ?? m.text;
  const v = Math.round(value);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={`shrink-0 ${className}`}>
      <circle cx="50" cy="50" r="48" fill={fill} />
      {v === 1 ? (
        <g stroke={ink} strokeWidth="7" strokeLinecap="round">
          <path d="M28 36l14 14M42 36L28 50" />
          <path d="M58 36l14 14M72 36L58 50" />
        </g>
      ) : v === 5 ? (
        <g fill="none" stroke={ink} strokeWidth="7" strokeLinecap="round">
          <path d="M26 44q9-12 18 0" />
          <path d="M56 44q9-12 18 0" />
        </g>
      ) : (
        <g fill={ink}>
          <rect x="30" y="34" width="10" height="16" rx="5" />
          <rect x="60" y="34" width="10" height="16" rx="5" />
        </g>
      )}
      {v <= 2 ? (
        <path d="M32 72q18-18 36 0" fill="none" stroke={ink} strokeWidth="7" strokeLinecap="round" />
      ) : v === 3 ? (
        <path d="M34 66h32" fill="none" stroke={ink} strokeWidth="7" strokeLinecap="round" />
      ) : v === 4 ? (
        <path d="M32 62q18 18 36 0" fill="none" stroke={ink} strokeWidth="7" strokeLinecap="round" />
      ) : (
        <path d="M28 60q22 28 44 0z" fill={ink} />
      )}
    </svg>
  );
}
