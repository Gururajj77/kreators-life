import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../lib/api';
import { useMe } from '../lib/queries';
import { useSession } from '../lib/store';
import { Button } from './Button';
import { Sheet } from './Sheet';

/**
 * Sign out, from the sidebar or the Profile tab. An account with an email signs out straight away.
 * A device-only account is asked first, because nothing can get back to its progress without an email.
 */
export function SignOut({ variant = 'outline', className = '' }: { variant?: 'outline' | 'ghost'; className?: string }) {
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
      <Button variant={variant} className={className} onClick={() => (deviceOnly ? setAsking(true) : signout.mutate())} disabled={signout.isPending}>
        {signout.isPending ? 'Signing out' : 'Sign out'}
      </Button>
      <Sheet open={asking} onClose={() => setAsking(false)} title="Only on this device so far">
        <p className="m-0 text-[14px] font-semibold text-ink-soft">This account has no email yet. Sign out now and nothing can get back to your areas, xp and streak. Add an email first and they come with you anywhere.</p>
        <div className="mt-md flex flex-col gap-xs">
          <Link to="/signup" className="toy inline-flex min-h-[56px] items-center justify-center rounded-pill bg-ink px-md text-[16px] font-bold text-on-ink" onClick={() => setAsking(false)}>
            Add an email first
          </Link>
          <Button variant="outline" size="lg" onClick={() => signout.mutate()} disabled={signout.isPending}>
            Sign out anyway
          </Button>
        </div>
      </Sheet>
    </>
  );
}
