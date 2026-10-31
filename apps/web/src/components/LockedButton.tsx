import { unlockAt, type Unlock } from '@kreators/shared';

/** A small padlock, drawn so it takes the colour of the text around it. */
export function Padlock({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/**
 * What a locked thing shows in place of its button: "Locked", then what it takes ("Unlocks at 500 xp, 2000 points and the First tick badge"),
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
