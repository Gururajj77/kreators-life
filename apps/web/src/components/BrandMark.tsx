import { RELATIONSHIPS } from '@kreators/shared';
import { Avatar } from './Avatar';

/** The brand inside the app: three of the characters standing in a row, then the name. `compact` drops the name on narrow phones. */
export function BrandMark({ size = 16, compact = false }: { size?: number; compact?: boolean }) {
  return (
    <>
      <span className="flex items-end gap-[2px]" aria-hidden="true">
        {RELATIONSHIPS.slice(0, 3).map((r, i) => (
          <Avatar key={r.key} relationship={r.key} size={size + i * 4} decorative still />
        ))}
      </span>
      <span className={compact ? 'sr-only min-[380px]:not-sr-only' : undefined}>kreators.app</span>
    </>
  );
}
