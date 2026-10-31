import { birthDateProblem, MAX_DEVICES, MIN_AGE, passwordProblem, phoneProblem } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useRefreshAll } from '../lib/queries';
import { useSession } from '../lib/store';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-card px-sm py-sm text-[16px]';

/** A password field with a show button, so a typo is seen before it is saved. */
function PasswordField({ label, value, onChange, autoComplete, hint }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string; hint?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <label className="block">
      <span className="block text-[14px] font-bold">{label}</span>
      <span className="relative block">
        <input type={shown ? 'text' : 'password'} required value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} maxLength={128} className={`${field} pr-xl`} />
        <button type="button" onClick={() => setShown((s) => !s)} aria-pressed={shown} className="absolute top-1/2 right-xs -translate-y-1/2 rounded-pill px-xs text-[12px] font-extrabold text-ink-soft hover:text-ink">
          {shown ? 'Hide' : 'Show'}
        </button>
      </span>
      {hint && <span className="mt-xs block text-[12px] font-bold text-ink-soft">{hint}</span>}
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
    <p role="status" className="mt-md m-0 flex items-start justify-between gap-sm rounded-tile bg-card p-sm text-[14px] font-semibold shadow-toy-soft">
      <span>You were signed out here because your account was signed in on {MAX_DEVICES} other devices. An account can be signed in on {MAX_DEVICES} at a time, and the oldest one gives way. Sign in again to carry on.</span>
      <button
        type="button"
        aria-label="Dismiss"
        className="min-h-[44px] min-w-[44px] shrink-0 text-[18px] font-bold text-ink-soft hover:text-ink"
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
    return n.startsWith('/') && !n.startsWith('//') ? n : null;
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
  const go = useMutation({
    mutationFn: () => (mode === 'signup' ? api.signup({ email, password, displayName: name, phone, birthDate }) : api.signin({ email, password })),
    onSuccess: async (r) => {
      try {
        localStorage.removeItem('kreators.signedOutNote');
      } catch {
        // nothing to clear
      }
      setToken(r.token);
      await refresh();
      // A new or unfinished account starts with the setup chat at /onboarding; the strategy session waits in Pillars.
      nav(r.user?.onboardedAt ? (next ?? '/home') : '/onboarding', { replace: true });
    },
  });
  // What the server will say, said here first. Only on sign-up: a sign-in password is whatever it is.
  const weak = mode === 'signup' && password ? passwordProblem(password, email) : null;
  const mismatch = mode === 'signup' && confirm.length > 0 && confirm !== password;
  const phoneBad = mode === 'signup' && phone ? phoneProblem(phone) : null;
  const ageBad = mode === 'signup' && birthDate ? birthDateProblem(birthDate) : null;
  const ready = mode === 'signin' ? email.length > 0 && password.length > 0 : email.length > 0 && password.length > 0 && !weak && confirm === password && phone.length > 0 && !phoneBad && birthDate.length > 0 && !ageBad;
  return (
    <Screen tabs={false}>
      <div className="pt-xl">
        <Avatar relationship="friendship" size={72} />
        <h1 className="mt-md text-[30px]">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
        <p className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">
          {mode === 'signup' ? (hasSession ? 'Everything on this phone comes with you. Add an email so it survives a new phone.' : `An email, a password, a phone number and your date of birth. You need to be ${MIN_AGE} or older.`) : 'Sign in to pick up where you left off.'}
        </p>
      </div>
      {mode === 'signin' && <SignedOutNote />}
      <form
        className="mt-lg flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) go.mutate();
        }}
      >
        {mode === 'signup' && (
          <label className="block">
            <span className="block text-[14px] font-bold">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="nickname" className={field} />
          </label>
        )}
        <label className="block">
          <span className="block text-[14px] font-bold">Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} className={field} />
        </label>
        <PasswordField label="Password" value={password} onChange={setPassword} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} hint={mode === 'signup' ? (weak ?? 'Eight characters or more. Not your email, not one from the usual guess lists.') : undefined} />
        {mode === 'signup' && <PasswordField label="Password, once more" value={confirm} onChange={setConfirm} autoComplete="new-password" hint={mismatch ? 'The two do not match yet.' : undefined} />}
        {mode === 'signup' && (
          <label className="block">
            <span className="block text-[14px] font-bold">Phone</span>
            <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" maxLength={24} placeholder="+91 98765 43210" className={field} />
            <span className="mt-xs block text-[12px] font-bold text-ink-soft">{phoneBad ?? 'Add the country code. We ask so everyone here is real. Never shown to anyone.'}</span>
          </label>
        )}
        {mode === 'signup' && (
          <label className="block">
            <span className="block text-[14px] font-bold">Date of birth</span>
            <input type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} autoComplete="bday" max={new Date().toISOString().slice(0, 10)} className={field} />
            <span className="mt-xs block text-[12px] font-bold text-ink-soft">{ageBad ?? `We ask so everyone here is ${MIN_AGE} or older. Nobody else sees it.`}</span>
          </label>
        )}
        {go.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {go.error instanceof Error ? go.error.message : 'That did not work. Check your connection and try again.'}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={go.isPending || !ready}>
          {mode === 'signup' ? 'Create account' : 'Sign in'}
        </Button>
      </form>
      {mode === 'signin' && (
        <p className="mt-sm m-0 text-center text-[14px] font-semibold">
          <Link to="/forgot" className="underline underline-offset-4">
            Forgot your password?
          </Link>
        </p>
      )}
      <p className="mt-md m-0 text-center text-[14px] font-semibold text-ink-soft">
        {mode === 'signup' ? (
          <>
            Already have one?{' '}
            <Link to={`/signin${loc.search}`} className="underline underline-offset-4">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link to={`/start${loc.search}`} className="underline underline-offset-4">
              Create an account
            </Link>
          </>
        )}
      </p>
      <p className="mt-sm m-0 text-center text-[14px] font-semibold">
        <Link to={hasSession ? (next ?? '/home') : '/start'} className="underline underline-offset-4">
          {hasSession ? 'Back to the app' : 'Continue without an account'}
        </Link>
      </p>
    </Screen>
  );
}

/** Forgot the password: an email in, and a "check your mail" card out, whatever the email. */
export function Forgot() {
  const [email, setEmail] = useState('');
  const send = useMutation({ mutationFn: () => api.forgot(email) });
  return (
    <Screen tabs={false}>
      <div className="pt-xl">
        <Avatar relationship="friendship" size={72} />
        <h1 className="mt-md text-[30px]">Forgot your password?</h1>
        <p className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">Type your email and we will send you a link to choose a new password.</p>
      </div>
      {send.isSuccess ? (
        <div className="mt-lg rounded-card bg-card p-md shadow-toy-soft" role="status">
          <p className="m-0 text-[24px]" aria-hidden="true">
            📬
          </p>
          <h2 className="mt-xs text-[24px]">Check your mail</h2>
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
            If <span className="font-bold text-ink">{email}</span> has an account, a reset link is on its way. It works once, for {send.data.minutes} minutes.
          </p>
          <Link to="/signin" className="toy mt-md inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-on-ink">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form
          className="mt-lg flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <label className="block">
            <span className="block text-[14px] font-bold">Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} className={field} />
          </label>
          {send.isError && (
            <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
              {send.error instanceof Error ? send.error.message : 'That did not work. Check your connection and try again.'}
            </p>
          )}
          <Button type="submit" size="lg" full disabled={send.isPending || !email}>
            {send.isPending ? 'Sending' : 'Email me a reset link'}
          </Button>
          <p className="m-0 text-center text-[14px] font-semibold">
            <Link to="/signin" className="underline underline-offset-4">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </Screen>
  );
}

/** Where the reset link lands: a new password, twice, then straight in. */
export function ResetPassword() {
  const nav = useNavigate();
  const loc = useLocation();
  const refresh = useRefreshAll();
  const setToken = useSession((s) => s.setToken);
  const token = new URLSearchParams(loc.search).get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const reset = useMutation({
    mutationFn: () => api.resetPassword(token, password),
    onSuccess: async (r) => {
      setToken(r.token);
      await refresh();
      nav(r.user?.onboardedAt ? '/home' : '/onboarding', { replace: true });
    },
  });
  const weak = password ? passwordProblem(password) : null;
  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = Boolean(token) && password.length > 0 && !weak && confirm === password;
  return (
    <Screen tabs={false}>
      <div className="pt-xl">
        <Avatar relationship="friendship" size={72} mood={token ? 'happy' : 'sleepy'} />
        <h1 className="mt-md text-[30px]">{token ? 'Choose a new password' : 'That link did not work'}</h1>
        <p className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">{token ? 'Every other device is signed out once it is saved.' : 'It may have expired, or it was already used. Links work once, for thirty minutes.'}</p>
      </div>
      {token ? (
        <form
          className="mt-lg flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) reset.mutate();
          }}
        >
          <PasswordField label="New password" value={password} onChange={setPassword} autoComplete="new-password" hint={weak ?? 'Eight characters or more. Not your email, not one from the usual guess lists.'} />
          <PasswordField label="Password, once more" value={confirm} onChange={setConfirm} autoComplete="new-password" hint={mismatch ? 'The two do not match yet.' : undefined} />
          {reset.isError && (
            <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
              {reset.error instanceof Error ? reset.error.message.charAt(0).toUpperCase() + reset.error.message.slice(1) : 'That did not work. Check your connection and try again.'}
            </p>
          )}
          <Button type="submit" size="lg" full disabled={reset.isPending || !ready}>
            {reset.isPending ? 'Saving' : 'Save and sign in'}
          </Button>
        </form>
      ) : (
        <Link to="/forgot" className="toy mt-md inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-on-ink">
          Ask for a new one
        </Link>
      )}
    </Screen>
  );
}
