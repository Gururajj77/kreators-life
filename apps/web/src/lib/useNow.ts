import { useEffect, useState } from 'react';

/** The current time, refreshed every `ms`. Used for countdowns. */
export function useNow(ms = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

export function minutesUntil(iso: string | null | undefined, now: number): number {
  if (!iso) return 0;
  const left = new Date(iso).getTime() - now;
  return left > 0 ? Math.ceil(left / 60_000) : 0;
}
