import { useEffect, useState } from 'react';
import { Button } from './Button';

/**
 * A small, recoverable remove is a second tap, not a sheet (the founder, 2026-11-06): the first tap turns the label to "Tap again to …" on solid red, the second does it, and it
 * lapses after about four seconds. The button's look at rest does not change.
 */
export function TapTwice({ rest = 'Remove', ask = 'Tap again to remove', name, onYes, disabled, variant = 'outline', size }: { rest?: string; ask?: string; /** What is removed, for a screen reader. */ name?: string; onYes: () => void; disabled?: boolean; variant?: 'outline' | 'ghost'; size?: 'sm' }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled}
      className={armed ? 'red-armed' : ''}
      aria-label={name ? (armed ? `${ask}: ${name}` : `${rest}: ${name}`) : undefined}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onYes();
        } else setArmed(true);
      }}
    >
      {/* The words shown, and apart from them a live line that holds the ask only while it asks, so the lapse back to rest is never read out
          (review 2026-11-13). */}
      <span aria-hidden={armed || undefined}>{armed ? ask : rest}</span>
      <span className="sr-only" aria-live="polite">
        {armed ? ask : ''}
      </span>
    </Button>
  );
}
