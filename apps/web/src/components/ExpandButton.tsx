import type { LucideIcon } from 'lucide-react';
import { AnimatedIcon, type AnimatedName } from './AnimatedIcon';
import { Icon } from './Icon';

/**
 * A round 44px icon button whose words slide out beside the icon when a mouse points at it or the keyboard reaches it (a laptop);
 * on a touch screen it stays an icon, its words in its label. The outline look of the row's other buttons. Still under reduced
 * motion (the words just appear). With `slide={false}` the words never slide out (where they would cover what sits beside it, as
 * Inbox's kinds): its name is the smart tip instead, in the empty room by it (2026-11-12). In a popup's rail the words never slide
 * either (app.css), and the smart tip names it.
 */
export function ExpandButton({ icon, anim, label, onClick, disabled = false, slide = true }: { icon: LucideIcon; /** A line animation from AnimatedIcon to draw instead of the still icon (it plays with the button's hover); `icon` stays its fallback. */ anim?: AnimatedName; label: string; onClick: () => void; disabled?: boolean; /** Whether the words slide out beside the icon. */ slide?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} data-tip={label} className="expand-btn toy toy-soft inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-pill border-2 border-line bg-card px-xs text-subhead font-medium text-ink disabled:opacity-50">
      {anim ? <AnimatedIcon name={anim} size={20} /> : <Icon icon={icon} size={20} />}
      {slide && (
        <span className="expand-btn-words" aria-hidden="true">
          {label}
        </span>
      )}
    </button>
  );
}
