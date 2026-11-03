import type { LucideIcon } from 'lucide-react';

/** One stroke weight for every icon in the app: lucide's own default, and what the animated icons draw at. */
export const ICON_STROKE = 2;
/** In CSS pixels. Use the usual steps (12, 14, 16, 18, 20, 24, 28, 32) so icons share an optical size. */
export type IconSize = number;

/**
 * A glyph from lucide-react, the one icon family. It is decorative (hidden from screen readers) unless `label` is given.
 * An icon never carries meaning alone: a button with only an icon puts its words in the button's `aria-label`
 * and leaves `label` off here. Colour is `currentColor`, so it follows the text and the theme tokens.
 * The icon is passed as a component, never a string, so the build keeps only the icons a screen uses.
 */
export function Icon({
  icon: Glyph,
  size = 20,
  label,
  className = '',
  strokeWidth = ICON_STROKE,
  filled = false,
  color,
}: {
  icon: LucideIcon;
  size?: IconSize;
  label?: string;
  className?: string;
  strokeWidth?: number;
  filled?: boolean;
  /** A stroke colour as a CSS value (a theme token); leave it off to follow the text colour. */
  color?: string;
}) {
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      color={color ?? 'currentColor'}
      fill={filled ? (color ?? 'currentColor') : 'none'}
      className={`shrink-0 ${className}`}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    />
  );
}
