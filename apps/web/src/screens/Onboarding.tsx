import { RELATIONSHIPS } from '@kreators/shared';
import { Navigate } from 'react-router';
import { Avatar } from '../components/Avatar';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { nextOnboardingPath } from '../lib/onboarding';
import { useAuthed, useMe } from '../lib/queries';

/** Picks up onboarding where it stopped: the session, or the vibe check for the signed focus, or Home when done. */
export function ResumeOnboarding() {
  const me = useMe();
  const sess = useAuthed(['session', todayLocal()], () => api.session(todayLocal()));
  if (me.data?.user.onboardedAt) return <Navigate to="/home" replace />;
  if (me.isPending || sess.isPending) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-md px-md" role="status">
        <div className="flex gap-xs">
          {RELATIONSHIPS.map((r) => (
            <Avatar key={r.key} relationship={r.key} size={36} />
          ))}
        </div>
        <p className="m-0 text-[14px] font-bold text-ink-soft">Finding where you left off</p>
      </div>
    );
  }
  return <Navigate to={nextOnboardingPath(sess.data)} replace />;
}
