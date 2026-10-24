import { RELATIONSHIPS } from '@kreators/shared';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useMe } from '../lib/queries';
import { captureRef, storedRef, useSession } from '../lib/store';

function Staircase() {
  const reduce = useReducedMotion();
  const size = 60;
  return (
    <div className="relative h-[220px] w-full" aria-hidden="true">
      {RELATIONSHIPS.map((r, i) => (
        <motion.div
          key={r.key}
          className="absolute"
          style={{ left: `calc(${i} * (100% - ${size}px) / 6)`, bottom: i * 26 }}
          initial={{ scale: reduce ? 1 : 0, y: reduce ? 0 : 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.09, type: 'spring', stiffness: 320, damping: 18 }}
        >
          <Avatar relationship={r.key} size={size} />
        </motion.div>
      ))}
    </div>
  );
}

export function Welcome() {
  const token = useSession((s) => s.token);
  const setToken = useSession((s) => s.setToken);
  const me = useMe();
  const nav = useNavigate();
  const location = useLocation();
  captureRef(location.search);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (token && me.data?.user.onboardedAt) return <Navigate to="/home" replace />;
  const resuming = Boolean(token && me.data && !me.data.user.onboardedAt);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!token) {
        const r = await api.anon(storedRef());
        setToken(r.token);
      }
      nav('/vibe-check');
    } catch {
      setError("Couldn't reach the tower. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen tabs={false} className="flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col justify-center pt-xl">
        <Staircase />
        <h1 className="mt-lg text-[clamp(36px,11vw,48px)]">
          Seven relationships.
          <br />
          One tower.
        </h1>
        <p className="mt-md text-[18px] font-semibold leading-snug text-ink-soft">
          A daily game for the seven relationships that make a life. Answer a few quick questions, build your tower, then tick a few boxes every day.
        </p>
      </div>
      <div className="flex flex-col gap-sm pb-lg">
        {error && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {error}
          </p>
        )}
        <Button size="lg" full onClick={start} disabled={busy}>
          {busy ? 'Opening the gates' : resuming ? 'Continue the vibe check' : 'Start the vibe check'}
        </Button>
        <p className="m-0 text-center text-[14px] font-semibold text-ink-mute">
          Progress is saved on this device. Add this page to your home screen to keep it close.
        </p>
        <p className="m-0 text-center text-[14px] font-semibold">
          Already have an account?{' '}
          <Link to="/signin" className="underline underline-offset-4">
            Sign in
          </Link>
          {' '}or{' '}
          <Link to="/" className="underline underline-offset-4">
            see what is inside first
          </Link>
        </p>
      </div>
    </Screen>
  );
}
