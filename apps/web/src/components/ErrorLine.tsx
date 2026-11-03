import { AnimatedIcon } from './AnimatedIcon';

/** The plain words for any error: an Error's own message, else a line that says what to do. */
export function errorText(e: unknown, fallback = 'That did not work. Check your connection and try again.'): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

/**
 * An error under a form or an action, read out at once. Renders nothing when there is no error.
 * The mark plays one round when the line appears (the useanimations alert circle) and rests whole; `warning` is the
 * softer case (something to check, not something that failed): the alert triangle on the yellow wash, read out politely.
 */
export function ErrorLine({ e, warning = false, className = '' }: { e: unknown; warning?: boolean; className?: string }) {
  if (!e) return null;
  return (
    <p role={warning ? 'status' : 'alert'} className={`m-0 flex items-start gap-xs rounded-tile p-sm text-[14px] font-bold ${warning ? 'bg-r3/30' : 'bg-r1/15'} ${className}`}>
      <span className="flex min-h-[20px] items-center">
        <AnimatedIcon name={warning ? 'alertTriangle' : 'alertCircle'} size={16} interaction="hover-loop" playWhen playOnShow />
      </span>
      <span className="min-w-0">{typeof e === 'string' ? e : errorText(e)}</span>
    </p>
  );
}
