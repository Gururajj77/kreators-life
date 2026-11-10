import type { ButtonHTMLAttributes, CSSProperties, Ref } from 'react';
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
  /** The button itself, for a screen that moves focus to it. */
  ref?: Ref<HTMLButtonElement>;
  /** The public site's height at every width (the phone's), so a site page's buttons match `site/buttons.ts` on a laptop too. */
  low?: boolean;
}

export function Button({ variant = 'primary', color, deep, size = 'md', full = false, plusToX = false, expanded, low = false, className = '', style, children, ...rest }: Props) {
  const base = 'inline-flex items-center justify-center gap-xs rounded-pill select-none disabled:opacity-50 disabled:pointer-events-none';
  /* Lower on a phone (2026-11-07, the founder: "make the buttons height lesser"): lg 48, md 40, sm 36, and from `md` today's 56, 48 and 44.
     Under 44 the hit area is still 44 by 44 (HIG minimum) through `tap-pad`'s invisible ::before (app.css). */
  const sizing =
    size === 'lg'
      ? `min-h-[48px] ${low ? '' : 'md:min-h-[56px]'} px-lg text-headline`
      : size === 'sm'
        ? `min-h-[36px] ${low ? '' : 'md:min-h-[44px]'} tap-pad px-sm text-subhead font-semibold leading-none`
        : `min-h-[40px] ${low ? '' : 'md:min-h-[48px]'} tap-pad px-md text-headline`;
  const look = {
    primary: 'toy btn-primary bg-ink text-on-ink',
    outline: 'toy toy-ink btn-outline bg-card-strong text-ink border border-ink/30',
    ghost: 'btn-ghost bg-transparent text-ink-soft underline-offset-4 transition-colors hover:underline',
    color: 'toy text-ink',
    /* For buttons that sit on a coloured hero: a white pill with dark text, like the kit. */
    light: 'toy bg-card-strong text-ink',
    /* The primary look with a band of light that sweeps across on hover or keyboard focus (app.css, Motion kit). For the one main action on a screen. */
    shimmer: 'toy fx-shimmer btn-primary bg-ink text-on-ink',
  }[variant];
  const colorStyle = variant === 'color' ? ({ background: color, '--toy-color': deep ?? '#1a1a1a', ...style } as CSSProperties) : style;

  return (
    <button type="button" aria-expanded={expanded} className={`${base} ${sizing} ${look} ${full ? 'w-full' : ''} ${className}`} style={colorStyle} {...rest}>
      {plusToX && <AnimatedIcon name="plusToX" size={size === 'sm' ? 16 : 20} active={Boolean(expanded)} />}
      {children}
    </button>
  );
}
