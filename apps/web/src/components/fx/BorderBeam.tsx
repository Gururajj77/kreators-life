import { useRef } from 'react';
import { useRunning } from './env';

/**
 * A hairline of light that travels round the edge of the card it sits in (the parent needs `relative` and the radius; the beam copies it).
 * One transform animation on a masked layer, paused while off screen or in a hidden tab; reduced motion leaves it still. Decorative.
 */
export function BorderBeam({ className = '', duration = 9 }: { className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const running = useRunning(ref);
  return <span ref={ref} aria-hidden="true" data-run={running} className={`fx-beam ${className}`} style={{ '--fx-beam-dur': `${duration}s` } as React.CSSProperties} />;
}
