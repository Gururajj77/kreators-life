import { INVITE_UNUSABLE_WHY, normalizeInviteCode } from '@kreators/shared/invites';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Avatar } from '../components/Avatar';
import { InviteGate } from '../components/InviteGate';
import { Screen } from '../components/Screen';
import { SkeletonList } from '../components/Skeleton';
import { keepInvite } from '../lib/invite';
import { inviteApi } from '../lib/inviteApi';
import { useSession } from '../lib/store';

/**
 * An invite link, `/join/<code>` (2026-11-10). The code is checked with the server: one that works is kept for this tab (lib/invite.ts) and
 * the person goes on to Welcome, which starts the setup chat with it. One that does not work says only that (used, expired, taken back and
 * unknown read the same) and offers another code or the waitlist. Someone already signed in has an account, so the code is left unused.
 */
export function JoinInvite() {
  const { code: raw = '' } = useParams();
  const nav = useNavigate();
  const token = useSession((s) => s.token);
  const code = normalizeInviteCode(raw);
  const check = useQuery({ queryKey: ['invite-check', code], queryFn: () => inviteApi.check(code ?? ''), enabled: Boolean(code) && !token, retry: false, staleTime: 0 });

  if (token) return <Navigate to="/start" replace />;
  if (code && check.data?.ok) {
    keepInvite(code);
    return <Navigate to="/start" replace />;
  }
  const bad = !code || check.data?.ok === false || check.isError;
  return (
    <Screen tabs={false}>
      <div className="pt-xl">
        <Avatar relationship="friendship" size={72} />
        <h1 className="type-large mt-md">{bad ? 'This invite does not work' : 'Checking your invite'}</h1>
        {bad && <p className="mt-xs m-0 text-callout text-ink-soft">{INVITE_UNUSABLE_WHY}</p>}
      </div>
      <div className="mt-lg pb-lg">
        {bad ? (
          <InviteGate
            waitlistOpen
            onCode={async (good) => {
              keepInvite(good);
              nav('/start', { replace: true });
            }}
          />
        ) : (
          <SkeletonList count={1} label="Checking your invite" />
        )}
      </div>
    </Screen>
  );
}
