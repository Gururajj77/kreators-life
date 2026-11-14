import { X } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { Icon } from './Icon';

type Rest = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type' | 'className' | 'aria-label' | 'children'>;

/**
 * The one round close button for a panel in the page that is not a Sheet (a Sheet draws its own, in its rail outside the card): 44px, glass, an X that turns a quarter as a
 * mouse points at it or the keyboard reaches it, with its words for screen readers and as a tooltip. Still under reduced motion.
 * `small` is the 32px one a sticky close wears where it runs down the open content's own edge (a phone, a narrow column: `StickyClose`,
 * under a task's plan `RowClose`, a tall fold, an app group, How it works), still
 * 44 by 44 to tap through `.tap-pad`; `tip={false}` keeps its name off the page as a tooltip (it is still its `aria-label`) where any
 * tip would sit on the card's own words, and a string shows those shorter words as the tip ("Close the plan") beside a longer name.
 */
export function CloseButton({ onClick, label = 'Close', small = false, tip = true, className = '', ...rest }: { onClick: () => void; label?: string; small?: boolean; tip?: boolean | string; className?: string } & Rest) {
  return (
    <button
      type="button"
      {...rest}
      onClick={onClick}
      aria-label={label}
      data-tip={typeof tip === 'string' ? tip : tip ? label : undefined}
      className={`close-btn toy toy-soft flex ${small ? 'tap-pad size-[32px]' : 'size-[44px]'} shrink-0 items-center justify-center rounded-pill border border-line bg-card-strong text-ink-soft hover:text-ink ${className}`}
    >
      <Icon icon={X} size={small ? 16 : 20} strokeWidth={small ? 2.6 : 2.4} className="close-btn-x" />
    </button>
  );
}
