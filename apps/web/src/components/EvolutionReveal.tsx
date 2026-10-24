import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

interface Props {
  /** The current form. */
  now: ReactNode;
  nowName: string;
  /** The next form, shown faded and revealed from the feet up as it charges. Null at the final stage. */
  next: ReactNode | null;
  nextName: string | null;
  /** 0 to 1 */
  charge: number;
  /** Fully charged but still waiting for its day. */
  preparing: boolean;
  readyInDays: number;
}

/** You, next to who you are becoming. The next form fills up and is revealed. */
export function EvolutionReveal({ now, nowName, next, nextName, charge, preparing, readyInDays }: Props) {
  const reduce = useReducedMotion();
  const pct = Math.round(Math.max(0, Math.min(1, charge)) * 100);
  const status = next
    ? preparing
      ? `${nextName} is fully revealed and evolves in ${readyInDays} ${readyInDays === 1 ? 'day' : 'days'}.`
      : `${nextName} is ${pct}% revealed.`
    : 'Final form.';

  return (
    <div role="img" aria-label={`${nowName} now. ${status}`} className="flex items-end justify-center gap-md">
      <div className="flex flex-col items-center gap-xs">
        <div aria-hidden="true">{now}</div>
        <span className="text-[12px] font-extrabold">{nowName}</span>
      </div>
      {next && (
        <>
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" className="mb-lg shrink-0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          <div className="flex flex-col items-center gap-xs">
            <div className="relative" aria-hidden="true">
              <div className="opacity-25 grayscale">{next}</div>
              <motion.div
                className="absolute inset-0"
                initial={{ clipPath: reduce ? `inset(${100 - pct}% 0 0 0)` : 'inset(100% 0 0 0)' }}
                animate={{ clipPath: `inset(${100 - pct}% 0 0 0)` }}
                transition={{ duration: reduce ? 0 : 1.2, ease: 'easeOut' }}
              >
                {next}
              </motion.div>
              {preparing && !reduce && (
                <motion.div
                  className="pointer-events-none absolute inset-0 rounded-pill"
                  animate={{ boxShadow: ['0 0 0 0 rgba(253,224,71,0)', '0 0 0 12px rgba(253,224,71,0.35)', '0 0 0 0 rgba(253,224,71,0)'] }}
                  transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                />
              )}
            </div>
            <span className="text-[12px] font-extrabold">
              {nextName} {pct}%
            </span>
          </div>
        </>
      )}
    </div>
  );
}
