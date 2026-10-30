import type { ButtonHTMLAttributes, CSSProperties } from 'react';

type Variant = 'primary' | 'outline' | 'ghost' | 'color' | 'light';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** For variant "color": the fill and the hard shadow under it. */
  color?: string;
  deep?: string;
  /** sm is for a row of equal actions on a list row; md is the default; lg is the one big action on a screen. */
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
}

export function Button({ variant = 'primary', color, deep, size = 'md', full = false, className = '', style, children, ...rest }: Props) {
  const base = 'inline-flex items-center justify-center gap-xs rounded-pill font-semibold select-none disabled:opacity-50 disabled:pointer-events-none';
  const sizing = size === 'lg' ? 'min-h-[56px] px-lg text-[18px]' : size === 'sm' ? 'min-h-[40px] px-sm text-[14px]' : 'min-h-[48px] px-md text-[16px]';
  const look = {
    primary: 'toy bg-ink text-on-ink',
    outline: 'toy toy-ink bg-card-strong text-ink border border-ink/30 hover:border-ink',
    ghost: 'bg-transparent text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline',
    color: 'toy text-ink',
    /* For buttons that sit on a coloured hero: a white pill with dark text, like the kit. */
    light: 'toy bg-card-strong text-ink',
  }[variant];
  const colorStyle = variant === 'color' ? ({ background: color, '--toy-color': deep ?? '#1a1a1a', ...style } as CSSProperties) : style;

  return (
    <button type="button" className={`${base} ${sizing} ${look} ${full ? 'w-full' : ''} ${className}`} style={colorStyle} {...rest}>
      {children}
    </button>
  );
}
