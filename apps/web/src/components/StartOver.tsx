import { useEffect, useState } from 'react';

/**
 * The button that starts a kept chat over. The first tap asks, the second does it, so a stray tap never
 * throws a conversation away. Anything the chat already saved stays saved.
 */
export function StartOver({ onConfirm, className = '' }: { onConfirm: () => void; className?: string }) {
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const t = window.setTimeout(() => setAsking(false), 4000);
    return () => window.clearTimeout(t);
  }, [asking]);
  return (
    <button
      type="button"
      onClick={() => {
        if (!asking) return setAsking(true);
        setAsking(false);
        onConfirm();
      }}
      aria-live="polite"
      className={`toy inline-flex min-h-[40px] shrink-0 items-center rounded-pill px-sm text-[14px] font-bold ${asking ? 'bg-ink text-on-ink' : 'bg-card'} ${className}`}
    >
      {asking ? 'Tap again to confirm' : 'Start over'}
    </button>
  );
}
