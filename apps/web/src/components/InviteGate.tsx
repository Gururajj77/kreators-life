import { INVITE_GATE_LINE, INVITE_UNUSABLE, WAITLIST_DONE, WAITLIST_NAME_MAX, WAITLIST_NOTE_MAX, normalizeInviteCode } from '@kreators/shared/invites';
import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { inviteApi } from '../lib/inviteApi';
import { keptInvite } from '../lib/invite';
import { FIELD_CARD } from '../lib/ui';
import { Button } from './Button';
import { ErrorLine, errorText } from './ErrorLine';
import { Fold } from './Fold';

/**
 * The invite code field on its own (2026-11-10): typed by hand or filled from the link someone opened, checked with the server before it is
 * used. The sign-up page and an event's page show it in place when the server asks for a code, so nothing else typed there is lost.
 */
export function InviteCodeField({ value, onChange, problem }: { value: string; onChange: (v: string) => void; problem?: string | null }) {
  return (
    <label className="block">
      <span className="block text-subhead font-semibold">Invite code</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={24}
        className={`${FIELD_CARD} font-mono tracking-widest`}
      />
      <span className="mt-xs block text-caption text-ink-soft">
        {problem ?? (
          <>
            No code?{' '}
            <Link to="/start#waitlist" className="inline-flex min-h-[44px] items-center underline underline-offset-4">
              Join the waitlist
            </Link>
          </>
        )}
      </span>
    </label>
  );
}

/** Either the whole gate or the code field alone, so the screens in the first download share one lazy reference (lib/invite.ts). */
export function InviteDoor(p: { field: { value: string; onChange: (v: string) => void } } | { gate: { onCode: (code: string) => Promise<void>; unusable?: boolean } }) {
  return 'field' in p ? <InviteCodeField value={p.field.value} onChange={p.field.onChange} /> : <InviteGate onCode={p.gate.onCode} unusable={p.gate.unusable} />;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BAD_EMAIL = 'That email does not look right. It should look like name@example.com.';

/** The waitlist: a name, an email and an optional line. The answer is the same for everyone, so it says nothing about anyone. */
function Waitlist({ open }: { open: boolean }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const ready = name.trim().length > 0 && email.trim().length > 0 && !busy;
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    // Said here first, in plain words, and nothing typed is lost (the server checks it again).
    if (!EMAIL_SHAPE.test(email.trim())) {
      setError(BAD_EMAIL);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await inviteApi.waitlist({ email: email.trim(), name: name.trim(), ...(note.trim() ? { note: note.trim() } : {}) });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error && /email does not look right/.test(err.message) ? BAD_EMAIL : err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Fold id="waitlist" title="Join the waitlist" hint="No code yet? Leave your email." defaultOpen={open}>
      {done ? (
        <p role="status" className="m-0 text-subhead font-semibold">
          {WAITLIST_DONE}
        </p>
      ) : (
        // noValidate: the browser's own bubble would stop the send before our plain line could say what to fix.
        <form noValidate className="flex flex-col gap-md" onSubmit={(e) => void send(e)}>
          <label className="block">
            <span className="block text-subhead font-semibold">Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={WAITLIST_NAME_MAX} autoComplete="name" className={FIELD_CARD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" className={FIELD_CARD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">What brings you here?</span>
            <span className="block text-caption text-ink-soft">Optional.</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={WAITLIST_NOTE_MAX} rows={2} className={FIELD_CARD} />
          </label>
          <p className="m-0 text-caption text-ink-soft">
            We use your email only to tell you about your invite.{' '}
            {/* The 44px tap area is a ::before, so the caption keeps its own line height (an inline-flex 44px box loosened its lines). */}
            <Link to="/privacy" className="relative whitespace-nowrap underline underline-offset-4 before:absolute before:-inset-x-[4px] before:-inset-y-[15px] before:content-['']">
              How we keep it
            </Link>
          </p>
          <ErrorLine e={error} />
          <Button type="submit" variant="outline" full disabled={!ready}>
            {busy ? 'Sending' : 'Join the waitlist'}
          </Button>
        </form>
      )}
    </Fold>
  );
}

/**
 * The door while joining is by invite (Welcome and /join/<code>): the code first, its Continue the screen's one solid button, then the
 * waitlist folded under it. `onCode` gets a code the server said works; it throws when the account could not be made, and the line says why.
 */
export function InviteGate({ onCode, unusable = false, waitlistOpen = false }: { onCode: (code: string) => Promise<void>; unusable?: boolean; waitlistOpen?: boolean }) {
  const [text, setText] = useState(() => keptInvite() ?? '');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(unusable ? INVITE_UNUSABLE : null);
  // Two taps in one moment both read `busy` as false before it draws: the ref holds the second one back, so one code makes one try.
  const going = useRef(false);
  const go = async (e: FormEvent) => {
    e.preventDefault();
    if (going.current) return;
    const code = normalizeInviteCode(text);
    setProblem(null);
    if (!code) {
      setProblem(INVITE_UNUSABLE);
      return;
    }
    going.current = true;
    setBusy(true);
    try {
      const r = await inviteApi.check(code);
      if (!r.ok) setProblem(INVITE_UNUSABLE);
      else await onCode(code);
    } catch (err) {
      setProblem(errorText(err, 'That did not work. Check your connection and try again.'));
    } finally {
      going.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-md">
      <form className="flex flex-col gap-sm rounded-card bg-card p-md shadow-toy-soft" onSubmit={(e) => void go(e)} aria-labelledby="invite-gate-line">
        <p id="invite-gate-line" className="m-0 text-headline">
          {INVITE_GATE_LINE}
        </p>
        <label className="block">
          <span className="block text-subhead font-semibold">Invite code</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value.toUpperCase())}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={24}
            aria-invalid={Boolean(problem)}
            aria-describedby={problem ? 'invite-gate-problem' : undefined}
            className={`${FIELD_CARD} font-mono tracking-widest`}
          />
        </label>
        {problem && (
          <p id="invite-gate-problem" role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
            {problem}
          </p>
        )}
        <Button type="submit" variant="shimmer" size="lg" full disabled={busy || text.trim().length === 0}>
          {busy ? 'Checking the code' : 'Continue'}
        </Button>
      </form>
      <Waitlist open={waitlistOpen} />
    </div>
  );
}
