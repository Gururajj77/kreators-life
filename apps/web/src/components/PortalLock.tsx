import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { Copy } from 'lucide-react';
import { SiteLayout } from '../site/SiteLayout';
import { ApiError, publicApi, type LockedLink } from '../lib/api';
import { useCopy } from '../lib/clipboard';
import { forgetPortalSessions, hadPortalSession, keepPortalSession } from '../lib/portalSession';
import { AnimatedIcon } from './AnimatedIcon';
import { Button } from './Button';
import { Icon } from './Icon';

const COPY = {
  lede: 'This page is private. Type the password you were given to open it.',
  ended: 'Your time on this page ran out, or the password was changed. Type the password again to go on.',
  // One answer for a wrong password and for a link that is not there, so the screen never says which.
  wrong: 'That password did not work. Check it and try again.',
  slow: 'Too many tries. Wait a few minutes, then try again.',
  failed: 'That did not go through. Try again in a moment.',
  stuck: 'If you were not given a password, ask the person who sent you this link.',
} as const;

/** The business behind a client link: its own logo upload, when it has one, and its name. */
export function AgencyMark({ name, logo, size = 'md' }: { name: string; logo: string; size?: 'sm' | 'md' }) {
  if (!name && !logo) return null;
  const box = size === 'sm' ? 'h-[40px] max-w-[120px]' : 'h-[56px] max-w-[160px]';
  return (
    <div className="flex min-w-0 items-center gap-sm">
      {logo && <img src={`/api/public/media/${encodeURIComponent(logo)}`} alt={name ? `${name} logo` : 'Logo'} className={`${box} w-auto shrink-0 rounded-inner object-contain`} />}
      {name && <p className={`m-0 min-w-0 font-display font-extrabold leading-tight ${size === 'sm' ? 'text-[16px]' : 'text-[18px]'}`}>{name}</p>}
    </div>
  );
}

/**
 * The lock screen of a client link, an agreement, an invoice or a document that has a password. It shows who sent it (the business name
 * and logo) and who it is for, and the same words answer a wrong password and a link that is not there. `unlock` makes the call; this
 * keeps the session it returns for the tab (sessionStorage), so a reload in the same tab stays open and a new tab asks again.
 */
export function PortalLock({ clientName, agencyName = '', agencyLogo = '', ended = false, link, unlock, onOpen }: { clientName: string; agencyName?: string; agencyLogo?: string; /** The tab held a session that the server no longer takes. */ ended?: boolean; link: string; unlock: (password: string) => Promise<{ session: string | null; expiresAt: string | null }>; onOpen: () => void }) {
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
      if (r.session) keepPortalSession(r.session, r.expiresAt, link);
      setPassword('');
      onOpen();
    } catch (err) {
      setError(err instanceof ApiError ? (err.status === 429 ? COPY.slow : err.status === 401 || err.status === 404 ? COPY.wrong : COPY.failed) : COPY.failed);
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pt-lg">
      <form onSubmit={submit} className="mx-auto max-w-[480px] rounded-card bg-card p-md shadow-toy-soft" aria-labelledby={`${id}-h`}>
        <AgencyMark name={agencyName} logo={agencyLogo} />
        <p className={`${agencyName || agencyLogo ? 'mt-md' : 'mt-0'} mb-0 type-eyebrow text-ink-mute`}>A private page</p>
        <h1 id={`${id}-h`} className="mt-xs text-[30px]">
          {clientName ? `For ${clientName}` : 'Type your password'}
        </h1>
        <p className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">{ended ? COPY.ended : COPY.lede}</p>
        <label htmlFor={`${id}-p`} className="mt-md block text-[14px] font-bold">
          Password
        </label>
        <div className="mt-xs flex gap-xs">
          <input
            ref={input}
            id={`${id}-p`}
            name="password"
            type={shown ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="go"
            spellCheck={false}
            maxLength={200}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-e` : undefined}
            className="min-h-[48px] min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm text-[16px]"
          />
          <Button type="button" variant="outline" size="sm" className="min-w-[96px]" onClick={() => setShown((s) => !s)} aria-pressed={shown} aria-controls={`${id}-p`}>
            <AnimatedIcon name="visibility" size={20} active={shown} />
            {shown ? 'Hide' : 'Show'}
          </Button>
        </div>
        {error && (
          <p id={`${id}-e`} role="alert" className="mt-xs m-0 text-[14px] font-bold">
            {error}
          </p>
        )}
        <div className="mt-md">
          <Button type="submit" full disabled={busy || !password}>
            {busy ? 'Checking' : 'Open the page'}
          </Button>
        </div>
        <p className="mt-sm m-0 text-[12px] font-semibold text-ink-soft">{COPY.stuck}</p>
      </form>
    </div>
  );
}

/** What went wrong with a client link, in plain words: a closed link, no page, or our side broke. */
export function LinkTrouble({ error, what = 'page', onRetry }: { error: unknown; /** "page", "agreement", "invoice" or "document". */ what?: string; onRetry?: () => void }) {
  const e = error instanceof ApiError ? error : null;
  const closed = e?.status === 410 && e.data.error === 'closed';
  const agency = closed ? String(e?.data.agencyName ?? '') : '';
  const email = closed ? String(e?.data.agencyEmail ?? '') : '';
  const broke = !e || e.status >= 500;
  const requestId = e && typeof e.data.requestId === 'string' ? e.data.requestId : '';
  const title = closed ? 'This link was closed' : broke ? 'Something went wrong on our side' : `No ${what} at this link`;
  const line = closed
    ? `${agency || 'The sender'} closed this link or sent a new one. Ask them for the new link.`
    : broke
      ? `Try again in a minute. If it keeps happening, tell the person who sent you this link${requestId ? ` this code: ${requestId}` : ''}.`
      : 'Check that the whole link was copied. If it still does not open, ask the person who sent it for a new link.';
  return (
    <div role="alert" className="rounded-card bg-card p-md shadow-toy-soft">
      <h1 className="text-[30px]">{title}</h1>
      <p className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">{line}</p>
      {(email || (broke && onRetry)) && (
        <div className="mt-md flex flex-wrap gap-sm">
          {broke && onRetry && <Button onClick={onRetry}>Try again</Button>}
          {email && (
            <a href={`mailto:${email}`} className="toy toy-ink inline-flex min-h-[44px] items-center justify-center rounded-pill border border-ink/30 bg-card-strong px-sm text-[14px] font-semibold text-ink hover:border-ink">
              {`Email ${agency || 'them'}`}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/** Copy the text version of what the client is reading (the client's own version), with a word that says it worked. */
export function CopyTextButton({ text }: { text: () => string }) {
  const { copy, said } = useCopy();
  return (
    <span className="no-print inline-flex flex-wrap items-center gap-xs">
      <Button size="sm" variant="outline" onClick={() => void copy(text())}>
        <Icon icon={Copy} size={18} />
        Copy text
      </Button>
      {said && (
        <span role="status" className="text-[14px] font-bold">
          {said}
        </span>
      )}
    </span>
  );
}

/** A read that the server refused because the link's password session is gone (it ran out, or the password changed). */
const isLockedAnswer = (e: unknown): boolean => e instanceof ApiError && e.status === 401 && e.data.error === 'locked';

/**
 * Around the public page of an agreement or an invoice (or a document): asks the server whether the client behind it has a password, and
 * shows the lock screen until the right one is typed. Without a password, or once it is unlocked, the page shows as it always did. The
 * question is asked again when the tab comes back, and whenever a read of the page answers locked, so a session that ran out or was ended
 * brings the lock screen back instead of a "not found" over the old page.
 */
export function PortalDocGate({ kind, children }: { kind: LockedLink; children: ReactNode }) {
  const { token = '' } = useParams();
  const qc = useQueryClient();
  const link = `${kind}:${token}`;
  const q = useQuery({ queryKey: ['portal-lock', kind, token], queryFn: () => publicApi.linkLock(kind, token), retry: false, staleTime: 0, gcTime: 0 });
  const locked = Boolean(q.data?.locked);
  // Whether this tab had opened the link before the lock came back, read before the session is dropped below.
  const [ended, setEnded] = useState(false);
  useEffect(
    () =>
      qc.getQueryCache().subscribe((ev) => {
        if (ev.type !== 'updated' || ev.query.queryKey[0] === 'portal-lock') return;
        if (ev.action.type === 'error' && isLockedAnswer(ev.action.error)) void qc.invalidateQueries({ queryKey: ['portal-lock', kind, token] });
      }),
    [qc, kind, token],
  );
  useEffect(() => {
    if (!locked) return;
    if (hadPortalSession(link)) setEnded(true);
    forgetPortalSessions(link);
  }, [locked, link]);
  if (q.isPending) {
    return (
      <SiteLayout wide={false} minimal>
        <p className="pt-lg m-0 text-[16px] font-semibold text-ink-soft">Loading.</p>
      </SiteLayout>
    );
  }
  if (locked) {
    return (
      <SiteLayout wide={false} minimal>
        <PortalLock clientName={q.data?.clientName ?? ''} agencyName={q.data?.agencyName ?? ''} agencyLogo={q.data?.agencyLogo ?? ''} ended={ended} link={link} unlock={(pw) => publicApi.linkUnlock(kind, token, pw)} onOpen={() => { setEnded(false); void q.refetch(); }} />
      </SiteLayout>
    );
  }
  return <>{children}</>;
}
