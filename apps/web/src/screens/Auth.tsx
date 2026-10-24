import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useRefreshAll } from '../lib/queries';
import { useSession } from '../lib/store';

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
  const [name, setName] = useState('');
  const go = useMutation({
    mutationFn: () => (mode === 'signup' ? api.signup({ email, password, displayName: name }) : api.signin({ email, password })),
    onSuccess: async (r) => {
      setToken(r.token);
      await refresh();
      nav(r.user?.onboardedAt ? (next ?? '/today') : '/vibe-check', { replace: true });
    },
  });
  const field = 'mt-xs w-full rounded-tile border-2 border-line bg-card px-sm py-sm text-[16px]';
  return (
    <Screen tabs={false}>
      <div className="pt-xl">
        <Avatar relationship="friendship" size={72} />
        <h1 className="mt-md text-[30px]">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
        <p className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">
          {mode === 'signup'
            ? hasSession
              ? 'Your tower on this phone comes with you. Add an email so it survives a new one.'
              : 'An email and a password. Nothing else.'
            : 'Sign in to pick up your tower on this device.'}
        </p>
      </div>
      <form
        className="mt-lg flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          go.mutate();
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
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Password</span>
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className={field} />
          {mode === 'signup' && <span className="mt-xs block text-[12px] font-bold text-ink-soft">At least eight characters.</span>}
        </label>
        {go.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {go.error instanceof Error ? go.error.message : 'That did not work.'}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={go.isPending}>
          {mode === 'signup' ? 'Create account' : 'Sign in'}
        </Button>
      </form>
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
            <Link to={`/signup${loc.search}`} className="underline underline-offset-4">
              Create an account
            </Link>
          </>
        )}
      </p>
      <p className="mt-sm m-0 text-center text-[14px] font-semibold">
        <Link to={hasSession ? (next ?? '/today') : '/start'} className="underline underline-offset-4">
          {hasSession ? 'Back to the app' : 'Continue without an account'}
        </Link>
      </p>
    </Screen>
  );
}
