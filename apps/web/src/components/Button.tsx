import type { ButtonHTMLAttributes, CSSProperties } from 'react';

type Variant = 'primary' | 'outline' | 'ghost' | 'color';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** For variant "color": the fill and the hard shadow under it. */
  color?: string;
  deep?: string;
  size?: 'md' | 'lg';
  full?: boolean;
}

export function Button({ variant = 'primary', color, deep, size = 'md', full = false, className = '', style, children, ...rest }: Props) {
  const base = 'inline-flex items-center justify-center gap-xs rounded-pill font-bold select-none disabled:opacity-50 disabled:pointer-events-none';
  const sizing = size === 'lg' ? 'min-h-[56px] px-lg text-[18px]' : 'min-h-[48px] px-md text-[16px]';
  const look = {
    primary: 'toy bg-ink text-white',
    outline: 'toy toy-ink bg-card text-ink border-2 border-ink',
    ghost: 'bg-transparent text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline',
    color: 'toy text-ink',
  }[variant];
  const colorStyle = variant === 'color' ? ({ background: color, '--toy-color': deep ?? '#15101f', ...style } as CSSProperties) : style;

  return (
    <button type="button" className={`${base} ${sizing} ${look} ${full ? 'w-full' : ''} ${className}`} style={colorStyle} {...rest}>
      {children}
    </button>
  );
}
