import { createElement, useRef, type CSSProperties, type ReactNode } from 'react';
import { useSeenOnce } from './env';

/**
 * Fades and lifts its content in once, the first time it scrolls into view. `index` staggers a row of siblings (70 ms each, capped).
 * Only opacity and transform change (app.css `.fx-reveal`); reduced motion shows it at once. Not for anything above the fold.
 */
export function Reveal({ as = 'div', index = 0, className = '', style, children, ...rest }: { as?: 'div' | 'li' | 'section' | 'article' | 'dt'; index?: number; className?: string; style?: CSSProperties; children?: ReactNode } & Record<string, unknown>) {
  const ref = useRef<HTMLElement>(null);
  const seen = useSeenOnce(ref);
  return createElement(as, { ref, className: `fx-reveal ${className}`, 'data-in': seen ? '' : undefined, style: { ...style, '--fx-i': Math.min(index, 8) }, ...rest }, children);
}
