import type { ReactNode } from 'react';

/**
 * An icon-only remove (a row's trash or ✕) that asks twice instead of opening a popup (the founder, 2026-11-13, small personal items;
 * `useTapTwice` holds the state). At rest it is the button it always was: `className` and the icon unchanged. While it asks it wears
 * `.red-armed` and shows the words "Tap again to …" in place of the icon, so a sighted person reads what the next tap does; a polite live
 * region says the same for a screen reader.
 */
export function TapTwiceIcon({
  armed,
  onClick,
  label,
  ask = 'Tap again to delete',
  className,
  tip,
  disabled,
  children,
}: {
  armed: boolean;
  onClick: () => void;
  /** What a tap at rest does, with the thing named ("Delete the session of 5 minutes"). */
  label: string;
  ask?: string;
  className: string;
  /** The hover tip at rest (`data-tip`); none while it asks, since the words are on the button. */
  tip?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={armed ? `${ask}: ${label}` : label}
      data-tip={armed ? undefined : tip}
      className={armed ? `${className} red-armed !w-auto !rounded-pill px-sm` : className}
    >
      {armed ? (
        <span aria-hidden="true" className="whitespace-nowrap text-subhead font-semibold">
          {ask}
        </span>
      ) : (
        children
      )}
      <span className="sr-only" aria-live="polite">
        {armed ? ask : ''}
      </span>
    </button>
  );
}
