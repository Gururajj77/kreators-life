import type { ReactNode } from 'react';
import { Reveal } from './Reveal';
import './spotlight';

/**
 * A glass card with a soft highlight that follows the pointer (`.fx-spot`, pointer-fine only). Pass `index` to also stagger it in on scroll
 * (Reveal). It adds no wrapper: the element is the card, so the caller's radius, glass and shadow classes go straight on `className`.
 */
export function SpotlightCard({ as = 'div', index, className = '', children, ...rest }: { as?: 'div' | 'li' | 'section' | 'article' | 'dt'; index?: number; className?: string; children?: ReactNode } & Record<string, unknown>) {
  if (index !== undefined)
    return (
      <Reveal as={as} index={index} className={`fx-spot ${className}`} {...rest}>
        {children}
      </Reveal>
    );
  const Tag = as;
  return (
    <Tag className={`fx-spot ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
