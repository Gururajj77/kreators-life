import type { ButtonHTMLAttributes } from 'react';

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
  const base =
    'toy inline-flex items-center justify-center gap-xs rounded-pill font-bold select-none disabled:opacity-50 disabled:pointer-events-none';
  const sizing = size === 'lg' ? 'min-h-[56px] px-lg text-[18px]' : 'min-h-[48px] px-md text-[16px]';
  const look = {
    primary: 'bg-ink text-white shadow-[0_4px_0_0_#15101f]',
    outline: 'bg-card text-ink border-2 border-ink shadow-toy',
    ghost: 'bg-transparent text-ink-soft underline-offset-4 hover:underline',
    color: 'text-ink',
  }[variant];
  const colorStyle = variant === 'color' ? { background: color, boxShadow: `0 4px 0 0 ${deep ?? '#15101f'}`, ...style } : style;

  return (
    <button type="button" className={`${base} ${sizing} ${look} ${full ? 'w-full' : ''} ${className}`} style={colorStyle} {...rest}>
      {children}
    </button>
  );
}
