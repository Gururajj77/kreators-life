import type { RelationshipKey } from '@kreators/shared';
import type { CSSProperties, ReactNode } from 'react';
import { Avatar, type Mood } from './Avatar';

/**
 * The kit's hero: a solid colour, soft circles behind, everything on it in white, and one of the
 * seven characters standing on the right. Dark elements never sit on a colour; buttons on it are
 * white with dark text (see Button "light").
 */
export function Hero({ color, deep, children, className = '', yellow = false, character, mood = 'happy', characterSize = 80 }: { color: string; deep?: string; children: ReactNode; className?: string; yellow?: boolean; character?: RelationshipKey; mood?: Mood; characterSize?: number }) {
  return (
    <section className={`relative overflow-hidden rounded-card p-md ${yellow ? 'text-on-yellow' : 'text-on-fill'} ${className}`} style={{ background: color, '--toy-color': deep ?? 'var(--color-shadow)' } as CSSProperties}>
      <HeroBlobs />
      <div className="relative flex items-center gap-sm">
        <div className="min-w-0 flex-1">{children}</div>
        {character && (
          <span className="shrink-0" aria-hidden="true">
            <Avatar relationship={character} size={characterSize} mood={mood} decorative />
          </span>
        )}
      </div>
    </section>
  );
}

/** The soft circles the kit draws behind a hero. Decorative only. */
export function HeroBlobs({ opacity = 0.14 }: { opacity?: number }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <circle cx="330" cy="40" r="110" fill="white" opacity={opacity} />
      <circle cx="60" cy="210" r="90" fill="white" opacity={opacity * 0.8} />
      <circle cx="250" cy="230" r="60" fill="white" opacity={opacity * 0.6} />
      <circle cx="40" cy="30" r="40" fill="white" opacity={opacity * 0.6} />
    </svg>
  );
}

/** The big number on a hero, with its unit and the line under it. */
export function HeroNumber({ value, unit, label, align = 'left' }: { value: ReactNode; unit?: string; label: ReactNode; align?: 'left' | 'center' }) {
  return (
    <div className={align === 'center' ? 'text-center' : ''}>
      <p className="m-0 font-display text-[64px] font-extrabold leading-none">
        {value}
        {unit && <span className="text-[24px]"> {unit}</span>}
      </p>
      <p className="mt-xs m-0 text-[18px] font-extrabold">{label}</p>
    </div>
  );
}
