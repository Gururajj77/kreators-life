import { attendeeMayOpen, birthDateProblem, MAX_DEVICES, MIN_AGE, passwordProblem, PHONE_HINT, phoneProblem } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useRefreshAll } from '../lib/queries';
import { useSession } from '../lib/store';
import { TermsBox } from '../components/TermsBox';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { FIELD_CARD } from '../lib/ui';
import { InviteDoor, inviteRefusal, keepInvite, keptInvite } from '../lib/invite';


/** A password field with a show button, so a typo is seen before it is saved. */
export function PasswordField({ label, value, onChange, autoComplete, hint }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string; hint?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <label className="block">
      <span className="block text-subhead font-semibold">{label}</span>
      <span className="relative block">
        <input type={shown ? 'text' : 'password'} required value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} maxLength={128} className={`${FIELD_CARD} pr-xl`} />
        <button type="button" onClick={() => setShown((s) => !s)} aria-pressed={shown} aria-label="Show password" title={shown ? 'Hide password' : 'Show password'} className="absolute top-1/2 right-xs inline-flex size-[44px] -translate-y-1/2 items-center justify-center rounded-pill text-ink-soft hover:text-ink">
          <AnimatedIcon name="visibility" size={20} active={shown} interaction="click-toggle" />
        </button>
      </span>
      {hint && <span className="mt-xs block text-caption text-ink-soft">{hint}</span>}
    </label>
  );
}

/**
 * Sign in or create an account with an email and a password. Sign-up asks for the password twice and
 * checks it against the same rule the server uses, so the form says what is wrong before it is sent.
 */
/** Why this device was signed out, when it was pushed out by a fourth device. */
function SignedOutNote() {
  const [shown, setShown] = useState(() => {
    try {
      return localStorage.getItem('kreators.signedOutNote') === 'devices';
    } catch {
      return false;
    }
  });
  if (!shown) return null;
  return (
    <p role="status" className="mt-md m-0 flex items-start justify-between gap-sm rounded-tile bg-card p-sm text-subhead shadow-toy-soft">
      <span>You were signed out here. An account can be open on {MAX_DEVICES} devices at once, and this was the oldest. Sign in again to carry on.</span>
      <button
        type="button"
        aria-label="Dismiss"
        className="min-h-[44px] min-w-[44px] shrink-0 text-headline text-ink-soft hover:text-ink"
        onClick={() => {
          try {
            localStorage.removeItem('kreators.signedOutNote');
          } catch {
            // nothing to clear
          }
          setShown(false);
        }}
      >
        ×
      </button>
    </p>
  );
}

export function Auth({ mode }: { mode: 'signin' | 'signup' }) {
  const nav = useNavigate();
  const loc = useLocation();
  const next = (() => {
    const n = new URLSearchParams(loc.search).get('next') ?? '';
    // Only a path on this site: the URL parser reads a backslash as a slash and drops tabs and newlines, so `/\evil.com` would leave it.
    try {
      const u = new URL(n, window.location.origin);
      return n.startsWith('/') && !n.startsWith('//') && !n.includes('\\') && u.origin === window.location.origin ? u.pathname + u.search + u.hash : null;
    } catch {
      return null;
    }
  })();
  const refresh = useRefreshAll();
  const setToken = useSession((s) => s.setToken);
  const hasSession = Boolean(useSession((s) => s.token));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [agree, setAgree] = useState(false);
  // A new account needs an invite code while joining is by invite: the one this tab arrived with, or one typed once the server asked.
  const [invite, setInvite] = useState(() => keptInvite() ?? '');
  const go = useMutation({
    mutationFn: () => (mode === 'signup' ? api.signup({ email, password, displayName: name, phone, birthDate, acceptTerms: agree, ...(invite.trim() ? { invite: invite.trim() } : {}) }) : api.signin({ email, password })),
    // A kept code the server would not take is forgotten, so Welcome never calls it ready again (the field keeps it to change).
    onError: (e) => {
      if (inviteRefusal(e) === 'invite-unusable') keepInvite(null);
    },
    onSuccess: async (r) => {
      try {
        localStorage.removeItem('kreators.signedOutNote');
      } catch {
        // nothing to clear
      }
      keepInvite(null);
      setToken(r.token);
      await refresh();
      // A new or unfinished account starts with the setup chat at /onboarding; the strategy session waits in Pillars. Someone signing in from an
      // event's public page goes back to it, and one who joined an event goes back to where an attendee may go (eventJoin.ts in shared).
      const back = next && (next.startsWith('/events/') || (r.user?.attendeeEvent && attendeeMayOpen(next.split(/[?#]/)[0] ?? '')));
      nav(r.user?.onboardedAt || back ? (next ?? '/home') : r.user?.attendeeEvent ? `/party/${r.user.attendeeEvent}` : '/onboarding', { replace: true });
    },
  });
  // What the server will say, said here first. Only on sign-up: a sign-in password is whatever it is.
  const weak = mode === 'signup' && password ? passwordProblem(password, email) : null;
  const mismatch = mode === 'signup' && confirm.length > 0 && confirm !== password;
  const phoneBad = mode === 'signup' && phone ? phoneProblem(phone) : null;
  const ageBad = mode === 'signup' && birthDate ? birthDateProblem(birthDate) : null;
  const ready = mode === 'signin' ? email.length > 0 && password.length > 0 : email.length > 0 && password.length > 0 && !weak && confirm === password && phone.length > 0 && !phoneBad && birthDate.length > 0 && !ageBad && agree;
  return (
    <Screen tabs={false}>
      <div className="pt-xl">
        <Avatar relationship="friendship" size={72} />
        <h1 className="type-large mt-md">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
        <p className="mt-xs m-0 text-callout text-ink-soft">
          {mode === 'signup' ? (hasSession ? 'Everything on this phone comes with you. Add an email so it survives a new phone.' : `An email, a password, a phone number and your date of birth. You need to be ${MIN_AGE} or older.`) : 'Sign in to pick up where you left off.'}
        </p>
      </div>
      {mode === 'signin' && <SignedOutNote />}
      <form
        data-pillar="friendship"
        className="mt-lg flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) go.mutate();
        }}
      >
        {mode === 'signup' && (
          <label className="block">
            <span className="block text-subhead font-semibold">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="nickname" className={FIELD_CARD} />
          </label>
        )}
        <label className="block">
          <span className="block text-subhead font-semibold">Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} className={FIELD_CARD} />
        </label>
        <PasswordField label="Password" value={password} onChange={setPassword} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} hint={mode === 'signup' ? (weak ?? 'Eight characters or more. Not your email, not one from the usual guess lists.') : undefined} />
        {mode === 'signup' && <PasswordField label="Password, once more" value={confirm} onChange={setConfirm} autoComplete="new-password" hint={mismatch ? 'The two do not match yet.' : undefined} />}
        {mode === 'signup' && (
          <label className="block">
            <span className="block text-subhead font-semibold">Phone</span>
            <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" maxLength={24} placeholder="+91 98765 43210" className={FIELD_CARD} />
            <span className="mt-xs block text-caption text-ink-soft">{phoneBad ?? `${PHONE_HINT} We ask so everyone here is real. Never shown to anyone.`}</span>
          </label>
        )}
        {mode === 'signup' && (
          <label className="block">
            <span className="block text-subhead font-semibold">Date of birth</span>
            <input type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} autoComplete="bday" max={todayLocal()} className={FIELD_CARD} />
            <span className="mt-xs block text-caption text-ink-soft">{ageBad ?? `We ask so everyone here is ${MIN_AGE} or older. Nobody else sees it.`}</span>
          </label>
        )}
        {mode === 'signup' && <TermsBox checked={agree} onChange={setAgree} />}
        {mode === 'signup' && (invite || inviteRefusal(go.error)) && (
          <Suspense fallback={null}>
            <InviteDoor field={{ value: invite, onChange: setInvite }} />
          </Suspense>
        )}
        {go.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
            {go.error instanceof Error ? go.error.message : 'That did not work. Check your connection and try again.'}
          </p>
        )}
        <Button type="submit" variant="shimmer" size="lg" full disabled={go.isPending || !ready}>
          {mode === 'signup' ? 'Create account' : 'Sign in'}
        </Button>
      </form>
      {mode === 'signin' && (
        <p className="mt-sm m-0 text-center text-subhead">
          <Link to="/forgot" className="inline-flex min-h-[44px] min-w-[44px] items-center underline underline-offset-4">
            Forgot your password?
          </Link>
        </p>
      )}
      <p className="mt-md m-0 text-center text-subhead text-ink-soft">
        {mode === 'signup' ? (
          <>
            Already have one?{' '}
            <Link to={`/signin${loc.search}`} className="inline-flex min-h-[44px] min-w-[44px] items-center underline underline-offset-4">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link to={`/start${loc.search}`} className="inline-flex min-h-[44px] min-w-[44px] items-center underline underline-offset-4">
              Create an account
            </Link>
          </>
        )}
      </p>
      {(hasSession || mode === 'signup') && (
        <p className="mt-sm m-0 text-center text-subhead">
          <Link to={hasSession ? (next ?? '/home') : '/start'} className="inline-flex min-h-[44px] min-w-[44px] items-center underline underline-offset-4">
            {hasSession ? 'Back to the app' : 'Continue without an account'}
          </Link>
        </p>
      )}
    </Screen>
  );
}
