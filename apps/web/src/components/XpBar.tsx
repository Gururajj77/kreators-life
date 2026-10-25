import { levelProgress } from '@kreators/shared';
import { motion, useReducedMotion } from 'motion/react';

interface Props {
  xp: number;
  color?: string;
  compact?: boolean;
}

export function XpBar({ xp, color = 'var(--color-ink)', compact = false }: Props) {
  const reduce = useReducedMotion();
  const p = levelProgress(xp);
  const pct = Math.round(p.pct * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-sm">
        <span className="font-display text-[18px] font-extrabold">Level {p.level}</span>
        {!compact && (
          <span className="text-[14px] font-semibold text-ink-soft">
            {p.into} of {p.span} xp to level {p.level + 1}
          </span>
        )}
      </div>
      <div
        className="mt-xs h-[12px] w-full overflow-hidden rounded-pill bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Level ${p.level} progress`}
      >
        <motion.div
          className="h-full rounded-pill"
          style={{ background: color }}
          initial={{ width: reduce ? `${pct}%` : 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: reduce ? 0 : 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
