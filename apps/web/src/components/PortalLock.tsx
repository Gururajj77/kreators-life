import { useQuery } from '@tanstack/react-query';
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { SiteLayout } from '../site/SiteLayout';
import { ApiError, publicApi, type LockedLink } from '../lib/api';
import { keepPortalSession } from '../lib/portalSession';
import { Button } from './Button';

const COPY = {
  eyebrow: 'Private page',
  lede: 'This page is private. Type the password you were given to open it.',
  wrong: 'That password did not work. Check it and try again.',
  slow: 'Too many tries. Wait a few minutes, then try again.',
  failed: 'That did not go through. Try again in a moment.',
  stuck: 'If you were not given a password, ask the person who sent you this link.',
} as const;

/**
 * The lock screen of a client link, an agreement or an invoice that has a password. It names the client and nothing else, and the same
 * words answer a wrong password and a link that is not there. `unlock` makes the call; this keeps the session it returns for the tab.
 */
export function PortalLock({ clientName, unlock, onOpen }: { clientName: string; unlock: (password: string) => Promise<{ session: string | null; expiresAt: string | null }>; onOpen: () => void }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await unlock(password);
      if (r.session) keepPortalSession(r.session, r.expiresAt);
      setPassword('');
      onOpen();
    } catch (err) {
      setError(err instanceof ApiError ? (err.status === 429 ? COPY.slow : err.status === 401 ? COPY.wrong : COPY.failed) : COPY.failed);
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-lg">
      <form onSubmit={submit} className="mx-auto max-w-[480px] rounded-card bg-card p-md shadow-toy-soft" aria-labelledby={`${id}-h`}>
        <p className="m-0 type-eyebrow text-ink-mute">{COPY.eyebrow}</p>
        <h1 id={`${id}-h`} className="mt-xs text-[30px]">
          {clientName || 'A private page'}
        </h1>
        <p className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">{COPY.lede}</p>
        <label htmlFor={`${id}-p`} className="mt-md block text-[14px] font-bold">
          Password
        </label>
        <div className="mt-xs flex gap-xs">
          <input
            ref={input}
            id={`${id}-p`}
            type={shown ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={200}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-e` : undefined}
            className="min-h-[44px] min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm text-[16px]"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => setShown((s) => !s)} aria-pressed={shown}>
            {shown ? 'Hide' : 'Show'}
          </Button>
        </div>
        {error && (
          <p id={`${id}-e`} role="alert" className="mt-xs m-0 text-[14px] font-bold">
            {error}
          </p>
        )}
        <div className="mt-md">
          <Button type="submit" disabled={busy || !password}>
            {busy ? 'Checking' : 'Open'}
          </Button>
        </div>
        <p className="mt-sm m-0 text-[12px] font-semibold text-ink-soft">{COPY.stuck}</p>
      </form>
    </div>
  );
}

/**
 * Around the public page of an agreement or an invoice (or a document): asks the server whether the client behind it has a password, and
 * shows the lock screen until the right one is typed. Without a password, or once it is unlocked, the page shows as it always did.
 */
export function PortalDocGate({ kind, children }: { kind: LockedLink; children: ReactNode }) {
  const { token = '' } = useParams();
  const [opened, setOpened] = useState(false);
  const q = useQuery({ queryKey: ['portal-lock', kind, token], queryFn: () => publicApi.linkLock(kind, token), retry: false, staleTime: 0, gcTime: 0 });
  if (q.isPending) {
    return (
      <SiteLayout wide={false}>
        <p className="pt-lg m-0 text-[16px] font-semibold text-ink-soft">Loading.</p>
      </SiteLayout>
    );
  }
  if (q.data?.locked && !opened) {
    return (
      <SiteLayout wide={false}>
        <PortalLock clientName={q.data.clientName ?? ''} unlock={(pw) => publicApi.linkUnlock(kind, token, pw)} onOpen={() => setOpened(true)} />
      </SiteLayout>
    );
  }
  return <>{children}</>;
}
