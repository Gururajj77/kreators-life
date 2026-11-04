import { ChevronDown, X, type LucideIcon } from 'lucide-react';
import { Icon, ICON_STROKE } from './Icon';

/**
 * The mark on a button that opens or folds something in place on the page (never a Sheet, a dialog or a menu, which have their own
 * close). It shows the state, so the person sees the button is a toggle and which way it is now:
 * - `ToggleChevron` for a text toggle ("Show more", "Water settings"): a chevron that turns half a turn while open, Fold's own look.
 * - `ToggleIcon` for an icon-only toggle (the pencil that opens a task's plan under it): the icon turns into a cross while open and
 *   back when closed. The two glyphs are stacked and only their opacity and turn change (app.css, "Toggle marks").
 * Both are decorative: the button carries `aria-expanded` and, for an icon-only one, an `aria-label` that says "Close ..." while open.
 * The button keeps its size, colour and hover at rest. Under reduced motion the chevron and the icon just swap.
 */
export function ToggleChevron({ open, size = 16, strokeWidth = ICON_STROKE, className = '' }: { open: boolean; size?: number; strokeWidth?: number; className?: string }) {
  return <Icon icon={ChevronDown} size={size} strokeWidth={strokeWidth} className={`toggle-chevron ${open ? 'toggle-chevron-open' : ''} ${className}`} />;
}

export function ToggleIcon({ open, icon, size = 20, strokeWidth = ICON_STROKE, className = '' }: { open: boolean; icon: LucideIcon; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <span className={`toggle-icon ${className}`} data-open={open ? '' : undefined} aria-hidden="true">
      <span className="toggle-icon-closed">
        <Icon icon={icon} size={size} strokeWidth={strokeWidth} />
      </span>
      <span className="toggle-icon-open">
        <Icon icon={X} size={size} strokeWidth={strokeWidth} />
      </span>
    </span>
  );
}
