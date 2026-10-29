import { useMutation } from '@tanstack/react-query';
import { useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../lib/api';
import { useMe } from '../lib/queries';
import { useSession } from '../lib/store';
import { Button } from './Button';
import { Sheet } from './Sheet';

/** A door with an arrow leaving it. */
function DoorIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

/**
 * Sign out, from the Profile tab, the laptop sidebar and the phone's apps menu: a button with a pale red outline,
 * and a sheet that asks first, so a stray tap never signs anyone out. A device-only account is also told what it
 * would lose, and offered an email first. `compact` is the smaller size for a header.
 */
export function SignOut({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const me = useMe();
  const nav = useNavigate();
  const setToken = useSession((s) => s.setToken);
  const [asking, setAsking] = useState(false);
  const signout = useMutation({
    mutationFn: api.signout,
    onSuccess: () => {
      setToken(null);
      nav('/start', { replace: true });
    },
  });
  const deviceOnly = Boolean(me.data && !me.data.user.email);
  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        disabled={signout.isPending}
        className={`toy inline-flex items-center justify-center gap-xs rounded-pill border-2 border-r1/40 bg-transparent font-bold text-r1 hover:bg-r1/10 disabled:opacity-50 ${compact ? 'min-h-[40px] px-sm text-[14px]' : 'min-h-[48px] px-md text-[16px]'} ${className}`}
        style={{ '--toy-color': 'var(--color-r1)' } as CSSProperties}
      >
        <DoorIcon size={compact ? 16 : 18} />
        {signout.isPending ? 'Signing out' : 'Sign out'}
      </button>
      <Sheet open={asking} onClose={() => setAsking(false)} title={deviceOnly ? 'Only on this device so far' : 'Sign out?'}>
        <p className="m-0 text-[14px] font-semibold text-ink-soft">
          {deviceOnly
            ? 'This account has no email yet. Sign out now and nothing can get back to your pillars, xp and streak. Add an email first and they come with you anywhere.'
            : 'You can sign back in any time with your email and password. Chats open on this device are cleared.'}
        </p>
        <div className="mt-md flex flex-col gap-xs">
          {deviceOnly && (
            <Link to="/onboarding" className="toy inline-flex min-h-[56px] items-center justify-center rounded-pill bg-ink px-md text-[16px] font-bold text-on-ink" onClick={() => setAsking(false)}>
              Add an email first
            </Link>
          )}
          <button
            type="button"
            onClick={() => signout.mutate()}
            disabled={signout.isPending}
            className="toy inline-flex min-h-[56px] items-center justify-center gap-xs rounded-pill bg-r1 px-md text-[18px] font-bold text-on-fill disabled:opacity-50"
            style={{ '--toy-color': 'var(--deep-servant_leader)' } as CSSProperties}
          >
            <DoorIcon />
            {signout.isPending ? 'Signing out' : deviceOnly ? 'Sign out anyway' : 'Yes, sign out'}
          </button>
          <Button variant="outline" size="lg" onClick={() => setAsking(false)} disabled={signout.isPending}>
            Stay signed in
          </Button>
        </div>
        {signout.isError && (
          <p role="alert" className="mt-sm m-0 text-[14px] font-bold text-ink-soft">
            That did not go through. Check your connection and try again.
          </p>
        )}
      </Sheet>
    </>
  );
}
