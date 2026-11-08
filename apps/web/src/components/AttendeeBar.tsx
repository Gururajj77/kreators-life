import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { todayLocal } from '../lib/date';
import { CloseButton } from './CloseButton';

/** Kept on the device: the day this person hid the bar. It comes back the next day. */
const keyFor = (userId: string) => `kreators.attendeeBar:${userId}`;

function hiddenToday(userId: string): boolean {
  try {
    return localStorage.getItem(keyFor(userId)) === todayLocal();
  } catch {
    return false;
  }
}

/**
 * The bar that invites someone who joined an event to finish setting up (2026-11-07, the event attendee's way in). `Shell` shows it while the
 * account came in through an event's public page and setup is not done; once the setup chat is finished it never shows again. One line and one
 * action, the setup chat, which skips what the account already holds (on a phone the action alone, so the bar is one row). The ✕ hides it until tomorrow on a second tap (kept on the device).
 *
 * Where it sits: fixed along the bottom left, clear of everything that is fixed there. On a phone it is level with the assistant's button
 * (96px up, so the tab bar stays clear) and stops short of it; from the tablet width it sits 16px up, after the sidebar, again stopping short
 * of the assistant. It is under every sheet (z 35, the scrim is 40) and under the privacy card (45), and a spacer in the page's flow gives the
 * page's last lines room to scroll out from under it.
 */
export function AttendeeBar({ userId }: { userId: string }) {
  const [hidden, setHidden] = useState(() => hiddenToday(userId));
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  if (hidden) return null;
  const hide = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    try {
      localStorage.setItem(keyFor(userId), todayLocal());
    } catch {
      // a private window keeps nothing: it hides for this visit only
    }
    setHidden(true);
  };
  return (
    <>
      <div aria-hidden="true" className="h-[48px]" />
      <section
        aria-label="Finish setting up"
        className="fixed left-md right-[calc(var(--spacing-md)+60px+var(--spacing-sm))] bottom-[calc(var(--spacing-xl)+var(--spacing-lg)+env(safe-area-inset-bottom))] z-[35] flex items-center gap-xs rounded-tile border border-line bg-card-strong py-xs pr-xs pl-sm shadow-toy-soft md:bottom-md md:left-[calc(var(--nav-w)+var(--spacing-lg))] md:max-w-[560px]"
      >
        <div className="flex min-w-0 flex-1 flex-col md:flex-row md:items-center md:gap-sm">
          {/* A phone keeps the bar to one row, the action alone (the line is still read out); from the tablet width the line sits before it. It shows while ✕ asks. */}
          <p className={`m-0 min-w-0 text-footnote text-ink-soft md:flex-1 ${armed ? '' : 'sr-only md:not-sr-only'}`} aria-live="polite">
            {armed ? 'Tap ✕ again to hide this until tomorrow.' : 'A few questions open the apps that fit you.'}
          </p>
          <Link to="/onboarding" className="inline-flex min-h-[44px] shrink-0 items-center text-subhead font-semibold text-ink underline underline-offset-4 hover:text-ink-soft">
            Finish setting up
          </Link>
        </div>
        <CloseButton onClick={hide} label={armed ? 'Tap again to hide until tomorrow' : 'Hide until tomorrow'} />
      </section>
    </>
  );
}
