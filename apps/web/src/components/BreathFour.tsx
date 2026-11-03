import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { BREATH_SAY, BREATH_WORDS, breathAt, type BreathPattern, type BreathStepKind } from '@kreators/shared';
import { useTicker } from '../lib/focusClocks';

/** Four calm colours, one per circle, from the pillar palette. */
const COLOURS = ['var(--color-r5)', 'var(--color-r4)', 'var(--color-r7)', 'var(--color-r2)'];
/** A wave two circles wide, so sliding it one circle to the left loops without a seam. */
const WAVE = 'M0 50 Q12.5 43 25 50 T50 50 T75 50 T100 50 T125 50 T150 50 T175 50 T200 50 V160 H0 Z';

/**
 * The breathing guide: one glass circle for each step of the pattern, in a row from left to right. The circle for the step you are on
 * fills with liquid over exactly its count, a gentle wave on its surface and ripples spreading out from it, and carries the word and the
 * seconds left; the ones before it stay full and soft, the ones after wait empty with their count. When the round ends the row empties
 * and the first circle starts again. No outlines. Under reduced motion nothing waves or ripples: the step you are on shows full and its
 * words change. Only transform and opacity move, and the wave and the ripples exist only on the step you are on.
 */
export function BreathFour({ pattern, running, elapsedMs, onStep }: { pattern: BreathPattern; running: boolean; elapsedMs: () => number; onStep?: (kind: BreathStepKind) => void }) {
  const [, setTick] = useState(0);
  useTicker(running, () => setTick((n) => n + 1), 100);
  const at = breathAt(pattern, elapsedMs());
  const clip = useId().replace(/:/g, '');
  // A new step (or a new round) starting while it runs: the caller marks it with a cue.
  const seen = useRef<string | null>(null);
  const stepId = running ? `${at.loop}:${at.index}` : null;
  const step = useRef(onStep);
  step.current = onStep;
  useEffect(() => {
    if (stepId === null) {
      seen.current = null;
      return;
    }
    if (seen.current !== stepId) {
      seen.current = stepId;
      step.current?.(at.step.kind);
    }
  }, [stepId, at.step.kind]);
  const word = running ? BREATH_WORDS[at.step.kind] : 'Ready';
  return (
    <div className="breath-row" role="img" aria-label={running ? `${word}, ${at.secondsLeft}` : `${pattern.name}: ${pattern.counts}`}>
      {pattern.steps.map((s, i) => {
        const now = running && i === at.index;
        const done = running && i < at.index;
        const level = now ? at.progress : done ? 1 : 0;
        // The wave's surface sits at y 50 of its path: move it so the surface is just under the circle when empty and just over it when full.
        const y = 104 - level * 112 - 50;
        return (
          <span key={i} className="breath-step" aria-hidden="true" style={{ '--c': COLOURS[i % 4], '--breath-move': `${s.seconds}s` } as CSSProperties}>
            {now && (
              <span key={stepId} className="breath-ripples">
                <span className="breath-ripple" />
                <span className="breath-ripple" style={{ animationDelay: `${s.seconds / 4}s` }} />
              </span>
            )}
            <svg className="breath-glass" viewBox="0 0 100 100" data-now={now || undefined} data-done={done || undefined}>
              <defs>
                <clipPath id={`${clip}-${i}`}>
                  <circle cx="50" cy="50" r="50" />
                </clipPath>
              </defs>
              <circle className="breath-empty" cx="50" cy="50" r="50" />
              <g clipPath={`url(#${clip}-${i})`}>
                <g className="breath-level" style={{ transform: `translateY(${y}px)` }}>
                  <path className={now ? 'breath-wave' : undefined} d={WAVE} />
                </g>
              </g>
            </svg>
            <span className="breath-in">
              {now ? (
                <>
                  <span className="breath-word">{BREATH_SAY[s.kind]}</span>
                  <span className="breath-count">{at.secondsLeft}</span>
                </>
              ) : (
                <span className="breath-word breath-soft">{s.seconds}</span>
              )}
            </span>
          </span>
        );
      })}
    </div>
  );
}
