import { X } from 'lucide-react';
import { Icon } from './Icon';

/**
 * The one round close button for a panel in the page that is not a Sheet (a Sheet draws its own, in its rail outside the card): 44px, glass, an X that turns a quarter as a
 * mouse points at it or the keyboard reaches it, with its words for screen readers and as a tooltip. Still under reduced motion.
 */
export function CloseButton({ onClick, label = 'Close' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} data-tip={label} className="close-btn toy toy-soft flex size-[44px] shrink-0 items-center justify-center rounded-pill border border-line bg-card-strong text-ink-soft hover:text-ink">
      <Icon icon={X} size={20} strokeWidth={2.4} className="close-btn-x" />
    </button>
  );
}
