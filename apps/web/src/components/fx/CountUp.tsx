import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion, useSeenOnce } from './env';

/**
 * A number that counts up to its value the first time it is seen, then just shows the value. Screen readers get the final number at once
 * (the counting text is hidden from them), digits are the same width so nothing shifts, and reduced motion shows the value straight away.
 */
export function CountUp({ value, format = (n: number) => String(n), duration = 900, className = '' }: { value: number; format?: (n: number) => string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useSeenOnce(ref, '0px');
  const [shown, setShown] = useState(value);
  const played = useRef(false);
  useEffect(() => {
    if (!seen || played.current || prefersReducedMotion() || !Number.isFinite(value) || value <= 0) {
      setShown(value);
      return;
    }
    played.current = true;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setShown(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, value, duration]);
  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden="true" className="fx-num" style={{ minWidth: `${format(value).length}ch` }}>
        {format(shown)}
      </span>
    </span>
  );
}
