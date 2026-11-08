import { COACH_SHARE_META, COACH_SHARE_PARTS, NEW_LINK_SHARE, type CoachJoinCard, type CoachShare } from '@kreators/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { Button } from '../components/Button';
import { ErrorLine } from '../components/ErrorLine';
import { CoachFace } from '../components/MyCoach';
import { Screen } from '../components/Screen';
import { Skeleton } from '../components/Skeleton';
import { Toggle } from '../components/Toggle';
import { api, ApiError, publicApi } from '../lib/api';
import { keepCoachJoin } from '../lib/coachJoin';
import { useMe } from '../lib/queries';
import { useSession } from '../lib/store';

function Who({ card }: { card: CoachJoinCard }) {
  return (
    <div className="flex items-center gap-sm">
      <CoachFace name={card.coach.name} badge={card.coach.badge} size={56} />
      <span className="min-w-0 flex-1">
        <h1 className="m-0 text-title3">Work with {card.coach.name}?</h1>
        {card.coach.handle && <span className="block text-subhead text-ink-soft">@{card.coach.handle}, life coach</span>}
      </span>
    </div>
  );
}

function Closed() {
  return (
    <section className="mt-md rounded-card bg-card p-md shadow-toy-soft">
      <h1 className="m-0 text-title2">This link was closed</h1>
      <p className="mt-xs m-0 text-subhead text-ink-soft">Ask your coach for a new one. Nothing was shared.</p>
      <Link to="/" className="mt-sm inline-flex min-h-[44px] items-center underline underline-offset-4">
        Go to kreators.app
      </Link>
    </section>
  );
}

/** Signed in: the card, the switches and the answer. Nothing is shared until Yes, and Not now writes nothing. */
function SignedIn({ token }: { token: string }) {
  const nav = useNavigate();
  const me = useMe();
  const q = useQuery({ queryKey: ['coach-join', token], queryFn: () => api.coachJoinState(token), retry: false });
  const [share, setShare] = useState<CoachShare>({ ...NEW_LINK_SHARE });
  const join = useMutation({
    mutationFn: () => api.coachJoin(token, share),
    onSuccess: () => {
      keepCoachJoin(null);
      nav('/you#coach', { replace: true });
    },
  });
  const closed = q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 410);
  const state = q.data?.state;
  useEffect(() => {
    // Kept only while there is a choice to make, so the app never keeps bringing someone back to a card that has nothing to ask.
    if (closed || state === 'self' || state === 'linked') keepCoachJoin(null);
    else if (state) keepCoachJoin(token);
  }, [closed, state, token]);
  if (me.data && !me.data.user.onboardedAt) return <Navigate to="/onboarding" replace />;
  if (closed) return <Closed />;
  if (q.isError) return <ErrorLine e={q.error} className="mt-md" />;
  const d = q.data;
  if (!d) return <Skeleton className="mt-md h-[320px] rounded-card" />;
  const leave = (to: string) => {
    keepCoachJoin(null);
    nav(to, { replace: true });
  };
  if (d.state === 'self' || d.state === 'linked')
    return (
      <section className="mt-md rounded-card bg-card p-md shadow-toy-soft">
        <h1 className="m-0 text-title2">{d.state === 'self' ? 'This is your own invite link' : `You already work with ${d.coach.name}`}</h1>
        <p className="mt-xs m-0 text-subhead text-ink-soft">{d.state === 'self' ? 'Share it with someone you coach.' : 'Change what they see on your Profile tab, any time.'}</p>
        <Button full className="mt-sm" variant="outline" onClick={() => leave(d.state === 'self' ? '/coaching' : '/you#coach')}>
          {d.state === 'self' ? 'Open Coaching' : 'Open my Profile'}
        </Button>
      </section>
    );
  return (
    <section className="mt-md rounded-card bg-card p-md shadow-toy-soft">
      <Who card={d} />
      {d.about && <p className="mt-sm m-0 text-subhead">{d.about}</p>}
      <fieldset className="m-0 mt-md border-0 p-0">
        <legend className="text-subhead font-semibold">What they would see</legend>
        <p className="m-0 text-subhead text-ink-soft">Never your journal. Change it or end it any time.</p>
        <div className="mt-xs flex flex-col gap-xs">
          {COACH_SHARE_PARTS.map((part) => (
            <Toggle key={part} on={share[part]} onChange={(on) => setShare((s) => ({ ...s, [part]: on }))} label={COACH_SHARE_META[part].name} hint={COACH_SHARE_META[part].blurb} />
          ))}
        </div>
      </fieldset>
      <ErrorLine e={join.error} className="mt-sm" />
      <div className="mt-md grid grid-cols-2 gap-xs">
        <Button full disabled={join.isPending} onClick={() => join.mutate()}>
          Yes
        </Button>
        <Button full variant="outline" disabled={join.isPending} onClick={() => leave('/home')}>
          Not now
        </Button>
      </div>
    </section>
  );
}

/** Signed out: who is asking, then an account or a sign-in first. The token waits for this tab, and they come back to the same card. */
function SignedOut({ token }: { token: string }) {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['coach-join-public', token], queryFn: () => publicApi.coachJoinCard(token), retry: false });
  useEffect(() => {
    if (q.data) keepCoachJoin(token);
    if (q.isError) keepCoachJoin(null);
  }, [q.data, q.isError, token]);
  if (q.isError) return q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 410) ? <Closed /> : <ErrorLine e={q.error} className="mt-md" />;
  const d = q.data;
  if (!d) return <Skeleton className="mt-md h-[240px] rounded-card" />;
  return (
    <section className="mt-md rounded-card bg-card p-md shadow-toy-soft">
      <Who card={d} />
      {d.about && <p className="mt-sm m-0 text-subhead">{d.about}</p>}
      <p className="mt-sm m-0 text-subhead text-ink-soft">Sign in or make an account first. Then you pick what they see. Nothing is shared until you say yes.</p>
      <div className="mt-md grid grid-cols-2 gap-xs">
        <Button full onClick={() => nav('/start')}>
          Start free
        </Button>
        <Button full variant="outline" onClick={() => nav('/signin')}>
          Sign in
        </Button>
      </div>
    </section>
  );
}

/** /coach/join/<token>: a coach's invite link. One card, for someone signed in or signed out. */
export function CoachJoin() {
  const { token = '' } = useParams();
  const session = useSession((s) => s.token);
  return (
    <Screen tabs={false} howTo={false}>
      <div className="mx-auto max-w-[560px] pt-xl">{session ? <SignedIn token={token} /> : <SignedOut token={token} />}</div>
    </Screen>
  );
}
