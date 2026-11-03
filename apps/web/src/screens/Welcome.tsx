import { RELATIONSHIPS } from '@kreators/shared';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { MorphShapes } from '../components/fx/MorphShapes';
import { burstFrom } from '../components/fx/burst';
import { LiquidMetal } from '../components/fx/LiquidMetal';
import { TextReveal } from '../components/fx/TextReveal';
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
      nav('/onboarding');
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen tabs={false} className="flex min-h-dvh flex-col">
      <MorphShapes page />
      <div className="relative isolate flex flex-1 flex-col justify-center pt-xl">
        <Staircase />
        <h1 className="mt-lg text-[clamp(36px,11vw,48px)]">
          <TextReveal parts={[{ text: 'Seven relationships.' }, { br: true }, { text: 'One you.' }]} />
        </h1>
        <p className="mt-md text-[18px] font-semibold leading-snug text-ink-soft">
          A daily game for the seven relationships, with the apps a creator or an agency needs. Answer a few questions and the apps that fit you switch on.
          <span className="hidden sm:inline"> The deeper strategy session waits in Pillars until you want it.</span>
        </p>
      </div>
      <div className="flex flex-col gap-sm pb-lg">
        {error && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {error}
          </p>
        )}
        <LiquidMetal className="w-full">
          <Button
            variant="shimmer"
            size="lg"
            full
            onClick={(e) => {
              burstFrom(e.currentTarget);
              void start();
            }}
            disabled={busy}
          >
            {busy ? 'Opening your chat' : resuming ? 'Carry on setting up' : 'Start with a short chat'}
          </Button>
        </LiquidMetal>
        <p className="m-0 text-center text-[14px] font-semibold text-ink-mute">
          Free to start. Your answers are saved on this device, so you can stop and come back. Add this page to your home screen to keep it close.
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
