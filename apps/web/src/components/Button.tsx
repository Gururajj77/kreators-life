import type { ButtonHTMLAttributes, CSSProperties } from 'react';
import { AnimatedIcon } from './AnimatedIcon';

type Variant = 'primary' | 'outline' | 'ghost' | 'color' | 'light' | 'shimmer';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** For variant "color": the fill and the hard shadow under it. */
  color?: string;
  deep?: string;
  /** sm is for a row of equal actions on a list row; md is the default; lg is the one big action on a screen. */
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
  /** An add action: a plus before the words that turns into a cross while what it opens is open (`expanded`). */
  plusToX?: boolean;
  /** For a `plusToX` button that opens a form in place: whether it is open now. Also sets `aria-expanded`. */
  expanded?: boolean;
}

export function Button({ variant = 'primary', color, deep, size = 'md', full = false, plusToX = false, expanded, className = '', style, children, ...rest }: Props) {
  const base = 'inline-flex items-center justify-center gap-xs rounded-pill font-semibold select-none disabled:opacity-50 disabled:pointer-events-none';
  /* sm keeps its compact look through tight padding and line-height, not a bigger box, but the hit area is still 44px (HIG minimum). */
  const sizing = size === 'lg' ? 'min-h-[56px] px-lg text-[18px]' : size === 'sm' ? 'min-h-[44px] px-sm text-[14px] leading-none' : 'min-h-[48px] px-md text-[16px]';
  const look = {
    primary: 'toy bg-ink text-on-ink',
    outline: 'toy toy-ink bg-card-strong text-ink border border-ink/30 hover:border-ink',
    ghost: 'bg-transparent text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline',
    color: 'toy text-ink',
    /* For buttons that sit on a coloured hero: a white pill with dark text, like the kit. */
    light: 'toy bg-card-strong text-ink',
    /* The primary look with a band of light that sweeps across on hover or keyboard focus (app.css, Motion kit). For the one main action on a screen. */
    shimmer: 'toy fx-shimmer bg-ink text-on-ink',
  }[variant];
  const colorStyle = variant === 'color' ? ({ background: color, '--toy-color': deep ?? '#1a1a1a', ...style } as CSSProperties) : style;

  return (
    <button type="button" aria-expanded={expanded} className={`${base} ${sizing} ${look} ${full ? 'w-full' : ''} ${className}`} style={colorStyle} {...rest}>
      {plusToX && <AnimatedIcon name="plusToX" size={size === 'sm' ? 16 : 20} active={Boolean(expanded)} />}
      {children}
    </button>
  );
}
