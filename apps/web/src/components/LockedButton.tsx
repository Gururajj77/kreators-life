import { unlockAt, type Unlock } from '@kreators/shared';
import { AnimatedIcon } from './AnimatedIcon';

/**
 * A small padlock, drawn so it takes the colour of the text around it. It is the useanimations lock, resting closed:
 * pointing at the locked button (or reaching it with the keyboard) lifts the shackle a little and lets it fall back, a nudge
 * that it opens later, never that it is open now.
 */
export function Padlock({ size = 16 }: { size?: number }) {
  return <AnimatedIcon name="lock" size={size} interaction="hover-bounce" />;
}

/**
 * What a locked thing shows in place of its button: "Locked", then what it takes ("Unlocks at 500 xp, 2,000 points and the First tick badge"),
 * and below it, what is still missing for this person. It looks like a button but never acts, so nothing here is a dead end: the words say
 * how to open it. A super admin never sees this, because for them nothing is locked.
 */
export function LockedButton({ unlock, full = true, className = '' }: { unlock: Pick<Unlock, 'minPoints' | 'minXp' | 'badge' | 'why'>; full?: boolean; className?: string }) {
  const at = unlockAt(unlock);
  return (
    <div className={`flex flex-col gap-xs ${full ? 'w-full' : ''} ${className}`}>
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-label={`Locked. ${at}.`}
        className="flex min-h-[48px] w-full cursor-not-allowed flex-col items-center justify-center gap-xs rounded-pill border-2 border-dashed border-line bg-paper px-md py-xs text-ink-soft"
      >
        <span className="flex items-center gap-xs text-[14px] font-extrabold">
          <Padlock />
          Locked
        </span>
        {at && <span className="text-center text-[12px] font-bold leading-snug">{at}</span>}
      </button>
      {unlock.why && <p className="m-0 text-center text-[12px] font-semibold text-ink-mute">{unlock.why}</p>}
    </div>
  );
}
