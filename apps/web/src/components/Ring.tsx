import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

interface Props {
  /** 0 to 1 */
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  track?: string;
  label: string;
  children?: ReactNode;
}

export function Ring({ value, size = 56, stroke = 6, color, track = 'rgba(38,38,38,0.12)', label, children }: Props) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, value)));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? offset : c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduce ? 0 : 0.9, ease: 'easeOut' }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}
