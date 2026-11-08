import type { LucideIcon } from 'lucide-react';
import { AnimatedIcon, type AnimatedName } from './AnimatedIcon';
import { Icon } from './Icon';

/**
 * A round 44px icon button whose words slide out beside the icon when a mouse points at it or the keyboard reaches it (a laptop);
 * on a touch screen it stays an icon, its words in its label and tooltip. The outline look of the row's other buttons. Still under
 * reduced motion (the words just appear).
 */
export function ExpandButton({ icon, anim, label, onClick, disabled = false }: { icon: LucideIcon; /** A line animation from AnimatedIcon to draw instead of the still icon (it plays with the button's hover); `icon` stays its fallback. */ anim?: AnimatedName; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="expand-btn toy toy-soft inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-pill border-2 border-line bg-card px-xs text-subhead font-medium text-ink disabled:opacity-50">
      {anim ? <AnimatedIcon name={anim} size={20} /> : <Icon icon={icon} size={20} />}
      <span className="expand-btn-words" aria-hidden="true">
        {label}
      </span>
    </button>
  );
}
