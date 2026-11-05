import { passwordProblem } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { MailCheck } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useRefreshAll } from '../lib/queries';
import { useSession } from '../lib/store';
import { FIELD_CARD } from '../lib/ui';
import { PasswordField } from './Auth';

// Forgot and reset, the two pages a reset link uses. They download when opened (App.tsx), apart from sign-in.

/** Forgot the password: an email in, and a "check your mail" card out, whatever the email. */
export function Forgot() {
  const [email, setEmail] = useState('');
  const send = useMutation({ mutationFn: () => api.forgot(email) });
  return (
    <Screen tabs={false}>
      <div className="pt-xl">
        <Avatar relationship="friendship" size={72} />
        <h1 className="mt-md text-large-title">Forgot your password?</h1>
        <p className="mt-xs m-0 text-callout text-ink-soft">Type your email and we will send you a link to choose a new password.</p>
      </div>
      {send.isSuccess ? (
        <div className="mt-lg rounded-card bg-card p-md shadow-toy-soft" role="status">
          <Icon icon={MailCheck} size={32} />
          <h2 className="mt-xs text-title2">Check your mail</h2>
          <p className="mt-xs m-0 text-subhead text-ink-soft">
            If <span className="font-semibold text-ink">{email}</span> has an account, a reset link is on its way. It works once, for {send.data.minutes} minutes.
          </p>
          <Link to="/signin" className="toy mt-md inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-semibold text-on-ink">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form
          data-pillar="friendship"
          className="mt-lg flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <label className="block">
            <span className="block text-subhead font-semibold">Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} className={FIELD_CARD} />
          </label>
          {send.isError && (
            <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
              {send.error instanceof Error ? send.error.message : 'That did not work. Check your connection and try again.'}
            </p>
          )}
          <Button type="submit" size="lg" full disabled={send.isPending || !email}>
            {send.isPending ? 'Sending' : 'Email me a reset link'}
          </Button>
          <p className="m-0 text-center text-subhead">
            <Link to="/signin" className="inline-flex min-h-[44px] min-w-[44px] items-center underline underline-offset-4">
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
        <h1 className="mt-md text-large-title">{token ? 'Choose a new password' : 'That link did not work'}</h1>
        <p className="mt-xs m-0 text-callout text-ink-soft">{token ? 'Every other device is signed out once it is saved.' : 'It may have expired, or it was already used. Links work once, for thirty minutes.'}</p>
      </div>
      {token ? (
        <form
          data-pillar="friendship"
          className="mt-lg flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) reset.mutate();
          }}
        >
          <PasswordField label="New password" value={password} onChange={setPassword} autoComplete="new-password" hint={weak ?? 'Eight characters or more. Not your email, not one from the usual guess lists.'} />
          <PasswordField label="Password, once more" value={confirm} onChange={setConfirm} autoComplete="new-password" hint={mismatch ? 'The two do not match yet.' : undefined} />
          {reset.isError && (
            <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
              {reset.error instanceof Error ? reset.error.message.charAt(0).toUpperCase() + reset.error.message.slice(1) : 'That did not work. Check your connection and try again.'}
            </p>
          )}
          <Button type="submit" size="lg" full disabled={reset.isPending || !ready}>
            {reset.isPending ? 'Saving' : 'Save and sign in'}
          </Button>
        </form>
      ) : (
        <Link to="/forgot" className="toy mt-md inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-semibold text-on-ink">
          Ask for a new one
        </Link>
      )}
    </Screen>
  );
}
