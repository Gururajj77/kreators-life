import { errorText } from '../lib/errors';
import { AnimatedIcon } from './AnimatedIcon';

/** The plain words for any error (lib/errors.ts), re-exported where the line that shows it lives. */
export { errorText };

/**
 * An error under a form or an action, read out at once. Renders nothing when there is no error.
 * The mark plays one round when the line appears (the useanimations alert circle) and rests whole; `warning` is the
 * softer case (something to check, not something that failed): the alert triangle on the yellow wash, read out politely.
 */
export function ErrorLine({ e, warning = false, className = '' }: { e: unknown; warning?: boolean; className?: string }) {
  if (!e) return null;
  return (
    <p role={warning ? 'status' : 'alert'} className={`m-0 flex items-start gap-xs rounded-tile p-sm text-subhead ${warning ? 'bg-r3/30' : 'bg-r1/15'} ${className}`}>
      <span className="flex min-h-[20px] items-center">
        <AnimatedIcon name={warning ? 'alertTriangle' : 'alertCircle'} size={16} interaction="hover-loop" playWhen playOnShow />
      </span>
      <span className="min-w-0">{typeof e === 'string' ? e : errorText(e)}</span>
    </p>
  );
}
