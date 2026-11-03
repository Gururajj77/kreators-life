import { Star } from 'lucide-react';
import { Icon } from './Icon';

/** A rating drawn as filled lucide stars, read out as "4 out of 5". */
export function Stars({ n, size = 14, className = '' }: { n: number; size?: number; className?: string }) {
  const count = Math.max(0, Math.min(5, Math.round(n)));
  return (
    <span role="img" aria-label={`${count} out of 5`} className={`inline-flex items-center align-[-2px] ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <Icon key={i} icon={Star} size={size} filled />
      ))}
    </span>
  );
}
