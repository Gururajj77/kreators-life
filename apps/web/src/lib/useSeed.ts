import { useEffect, useRef } from 'react';

/**
 * A one-time seed from what the profile already knows (the city, the interests), so a form never asks again for something typed once.
 * It runs once, the first time `source` is there, and only fills what the person has not typed yet: the setter it is given decides that
 * (for example `setCity((c) => c || u.city)`). After that the field is the person's own; the profile is never written back from here.
 */
export function useSeedOnce<T>(source: T | null | undefined, seed: (value: T) => void): void {
  const done = useRef(false);
  const latest = useRef(seed);
  latest.current = seed;
  useEffect(() => {
    if (done.current || source === null || source === undefined) return;
    done.current = true;
    latest.current(source);
  }, [source]);
}
