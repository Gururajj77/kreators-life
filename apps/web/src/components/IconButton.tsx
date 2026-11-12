import type { LucideIcon } from 'lucide-react';
import { Icon } from './Icon';

/**
 * One round 44px icon button with its words for screen readers (`aria-label`) and as a smart tip (`data-tip`, placed in the empty room by
 * it, lib/smartTip.ts; never a native `title`, which the browser would draw as a second name): the look of the round buttons on the
 * Mindful panel (`.mf-round`). Use it where a "More" menu would hold a single action: one tap instead of a menu with one row.
 */
export function IconButton({ icon, label, onClick, tip = 'tr', opens = false, pressed, disabled = false }: { icon: LucideIcon; label: string; onClick: () => void; /** Which side the tip leans to when two places are equally clear: above from the left, above from the right, or above then below from the right. */ tip?: 'tl' | 'tr' | 'br'; /** It opens a dialog. */ opens?: boolean; pressed?: boolean; disabled?: boolean }) {
  return (
    <button type="button" className="mf-round toy shrink-0 disabled:opacity-50" data-at={tip} data-tip={label} aria-label={label} aria-haspopup={opens ? 'dialog' : undefined} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      <Icon icon={icon} size={20} />
    </button>
  );
}
