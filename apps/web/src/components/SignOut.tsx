import { useMutation } from '@tanstack/react-query';
import { useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../lib/api';
import { useMe } from '../lib/queries';
import { useSession } from '../lib/store';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { LogOut } from 'lucide-react';
import { Icon } from './Icon';
import { RED_YES_LG } from '../lib/ui';

/** A door with an arrow leaving it. */
function DoorIcon({ size = 18 }: { size?: number }) {
  return <Icon icon={LogOut} size={size} />;
}

/**
 * Sign out, from the Profile tab, the laptop sidebar and the phone's apps menu: a button with a pale red outline,
 * and a sheet that asks first, so a stray tap never signs anyone out. A device-only account is also told what it
 * would lose, and offered an email first. `compact` is the smaller size for a header.
 */
export function SignOut({ compact = false, iconOnly = false, className = '' }: { compact?: boolean; /** Only the door, 44px round, for the folded sidebar; it still asks first. */ iconOnly?: boolean; className?: string }) {
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
        aria-label={iconOnly ? 'Sign out' : undefined}
        data-tip={iconOnly ? 'Sign out' : undefined}
        className={`toy inline-flex items-center justify-center gap-xs rounded-pill border-2 border-r1/40 bg-transparent font-semibold text-r1 hover:bg-r1/10 disabled:opacity-50 ${iconOnly ? 'size-[44px]' : compact ? 'min-h-[36px] md:min-h-[44px] tap-pad px-sm text-subhead' : 'min-h-[40px] md:min-h-[48px] tap-pad px-md text-callout'} ${className}`}
        style={{ '--toy-color': 'var(--color-r1)' } as CSSProperties}
      >
        <DoorIcon size={compact || iconOnly ? 18 : 18} />
        {!iconOnly && (signout.isPending ? 'Signing out' : 'Sign out')}
      </button>
      <Sheet open={asking} onClose={() => setAsking(false)} title={deviceOnly ? 'Only on this device so far' : 'Sign out?'}>
        <p className="m-0 text-subhead text-ink-soft">
          {deviceOnly
            ? 'This account has no email yet. Sign out now and nothing can get back to your pillars, xp and streak. Add an email first and they come with you anywhere.'
            : 'You can sign back in any time with your email and password. Chats open on this device are cleared.'}
        </p>
        <div className="mt-md flex flex-col gap-xs">
          {deviceOnly && (
            <Link to="/onboarding" className="toy inline-flex min-h-[48px] md:min-h-[56px] items-center justify-center rounded-pill bg-ink px-md text-headline text-on-ink" onClick={() => setAsking(false)}>
              Add an email first
            </Link>
          )}
          <button
            type="button"
            onClick={() => signout.mutate()}
            disabled={signout.isPending}
            className={RED_YES_LG}
          >
            <DoorIcon />
            {signout.isPending ? 'Signing out' : deviceOnly ? 'Sign out anyway' : 'Yes, sign out'}
          </button>
          <Button variant="outline" size="lg" onClick={() => setAsking(false)} disabled={signout.isPending}>
            Stay signed in
          </Button>
        </div>
        {signout.isError && (
          <p role="alert" className="mt-sm m-0 text-subhead text-ink-soft">
            That did not go through. Check your connection and try again.
          </p>
        )}
      </Sheet>
    </>
  );
}
