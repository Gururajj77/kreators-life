import { PORTAL_PASSWORD_MIN, makePortalPassword, portalPasswordProblem, type ClientLifecycle } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, ShieldOff, Sparkles, X } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { ApiError, api } from '../lib/api';
import { useCopy } from '../lib/clipboard';
import { longDate, prettyDate } from '../lib/date';
import { AnimatedIcon } from './AnimatedIcon';
import { Button } from './Button';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Inert } from './Inert';
import { MoreMenu, type MoreMenuItem } from './MoreMenu';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';
import { CardHead } from './CardHead';

/**
 * The password on a client's link, in one module (2026-11-04, wave 11). The password is the owner's: only they set, change, generate or
 * remove it, and the server keeps only its hash. One password opens the client's page and every document sent to them, so the same card
 * sits on the client page, inside the client link's sheet and on each document page, and the add-client form uses the same field.
 * Saving or removing it ends every open session on the link and closes the client's ask for a new one in the same batch (the route does
 * both); the app never emails or logs the password.
 */

const COPY = {
  title: 'Password for their link',
  none: 'No password: anyone with the link can open it.',
  setAt: (d: string) => `Password set, last changed ${d}.`,
  setUnknown: 'Password set.',
  asked: (name: string, d: string) => `${name} asked for a new password on ${d}.`,
  oneLock: 'One password opens their page and every document.',
  share: 'Share it with them another way. The app never sends it.',
  ended: 'Saved. Every open session on their link ended, so they type the new password next time.',
  removed: 'Password removed. Every open session ended, and anyone with the link can open it now.',
  dismissed: 'Ask dismissed. The password did not change.',
  rule: `At least ${PORTAL_PASSWORD_MIN} characters, not their name, and not a common password.`,
  shownOnce: 'This is shown once. Copy it now.',
  removeAsk: 'Anyone with the link can then open their page and every document sent to them. Every open session ends.',
  failed: 'That did not go through. Try again.',
} as const;

/** The team link's own words (the client page for the client's own team): its password opens that link only, never the paper. */
const TEAM_COPY = {
  title: 'Password for the team link',
  asked: (name: string, d: string) => `${name}'s team asked for a new password on ${d}.`,
  oneLock: 'It opens the team link only, never their page or any paper.',
  ended: 'Saved. Every open session on the team link ended, so their team types the new password next time.',
  removeAsk: 'Anyone with the team link can then open it. Every open session on it ends. Their own page keeps its password.',
} as const;

/** Which link a password card is for: the client link (and its documents) or the team link. */
export type PasswordLink = 'client' | 'team';
const setPassword = (link: PasswordLink, id: string, body: { password?: string; generate?: boolean; clear?: boolean }) => (link === 'team' ? api.agencyTeamLinkPassword(id, body) : api.agencyPassword(id, body));

const failed = (e: unknown): string => (e instanceof ApiError ? sentence(e.message) : COPY.failed);
/** A server's short answer as a sentence: "not found" becomes "Not found." */
const sentence = (m: string): string => `${m.charAt(0).toUpperCase()}${m.slice(1)}${/[.!?]$/.test(m) ? '' : '.'}`;

/** A whole number from 0 to n - 1 from the browser's own random source, for a made-up password. */
export function randomBelow(n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0]! < limit) return buf[0]! % n;
  }
}

/**
 * The one password field: typed, Show and Hide, Generate (four words and two digits from the browser's own random source), Copy, and the
 * rule checked live. Used in the set sheet and in the add-client form, where it is required.
 */
export function PasswordField({
  id,
  value,
  onChange,
  clientName,
  label = 'Password',
  hint,
  required = false,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  clientName: string;
  label?: string;
  hint?: string;
  required?: boolean;
}) {
  const own = useId();
  const fid = id ?? `${own}-pw`;
  const [show, setShow] = useState(false);
  const { copy, said } = useCopy();
  const problem = value ? portalPasswordProblem(value, clientName) : null;
  return (
    <div>
      <label htmlFor={fid} className="block text-subhead font-semibold">
        {label}
      </label>
      <span id={`${fid}-h`} className="block text-caption text-ink-soft">
        {hint ? `${hint} ${COPY.rule}` : COPY.rule}
      </span>
      <input
        id={fid}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={128}
        required={required}
        autoComplete="new-password"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? `${fid}-h ${fid}-e` : `${fid}-h`}
        className="mt-xs min-h-[48px] w-full rounded-tile border-2 border-line bg-paper px-sm font-mono text-body"
      />
      <div className="mt-xs flex flex-wrap items-center gap-xs">
        <Button type="button" variant="outline" size="sm" onClick={() => setShow((s) => !s)} aria-pressed={show} aria-controls={fid}>
          <AnimatedIcon name="visibility" size={18} active={show} />
          {show ? 'Hide' : 'Show'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onChange(makePortalPassword(randomBelow));
            setShow(true);
          }}
        >
          Generate one
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => void copy(value)} disabled={!value}>
          Copy
        </Button>
        {said && (
          <span role="status" className="text-subhead">
            {said}
          </span>
        )}
      </div>
      {value && (
        <p id={`${fid}-e`} role={problem ? 'alert' : 'status'} className="mt-xs m-0 text-caption">
          {problem ?? 'Good. It meets the rule.'}
        </p>
      )}
      <p className="mt-xs m-0 text-caption text-ink-soft">{COPY.share}</p>
    </div>
  );
}

/** A password shown once, with Copy: after Generate on the server, and after a new client is added. */
export function ShownOnce({ password, note = COPY.shownOnce }: { password: string; note?: string }) {
  const own = useId();
  const { copy, said } = useCopy();
  return (
    <div role="status" className="rounded-tile bg-paper p-sm">
      <p className="m-0 text-subhead">{note}</p>
      <input
        id={own}
        readOnly
        value={password}
        aria-label="The password"
        onFocus={(e) => e.currentTarget.select()}
        className="mt-xs min-h-[44px] w-full rounded-tile border-2 border-line bg-card px-sm font-mono text-body"
      />
      <div className="mt-xs">
        <Button size="sm" variant="outline" onClick={() => void copy(password)}>
          {said === 'Copied' ? 'Copied' : 'Copy'}
        </Button>
      </div>
      {said && said !== 'Copied' && <p className="mt-xs m-0 text-caption">{said}</p>}
      <p className="mt-xs m-0 text-caption text-ink-soft">{COPY.share}</p>
    </div>
  );
}

type Done = null | { kind: 'saved'; password: string | null } | { kind: 'removed' } | { kind: 'dismissed' };

/**
 * The card: the state in words with a StatusTag, one main action for the state (Set a password, Set a new password while the client's
 * ask is open, Change the password), and the rest in More (Generate one, Remove the password behind a confirm sheet, Dismiss the ask).
 * `primary` makes the main action the screen's one solid button; everywhere else it is an outline. `bare` drops the card's own surface
 * for use inside a sheet.
 */
export function ClientPassword({
  clientId,
  clientName,
  state,
  linkOn,
  primary = false,
  bare = false,
  className = '',
  link = 'client',
}: {
  clientId: string;
  clientName: string;
  state: ClientLifecycle['password'];
  /** Whether the client link is switched on, for the "last opened" line. */
  linkOn?: boolean;
  primary?: boolean;
  bare?: boolean;
  className?: string;
  /** `team` makes this the team link's password card: its own route, its own words, its own sessions. */
  link?: PasswordLink;
}) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['agency'] });
  const name = clientName || 'The client';
  const team = link === 'team';
  const words = team ? { ...COPY, ...TEAM_COPY } : COPY;
  const [setting, setSetting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [done, setDone] = useState<Done>(null);
  const [menu, setMenu] = useState(false);
  const ask = state.request;

  const generate = useMutation({
    mutationFn: () => setPassword(link, clientId, { generate: true }),
    onSuccess: (r) => {
      setDone({ kind: 'saved', password: r.password ?? null });
      void refresh();
    },
  });
  const remove = useMutation({
    mutationFn: () => setPassword(link, clientId, { clear: true }),
    onSuccess: () => {
      setRemoving(false);
      setDone({ kind: 'removed' });
      void refresh();
    },
  });
  const dismiss = useMutation({
    mutationFn: () => (team ? api.agencyTeamLinkRequestClose(clientId) : api.agencyPasswordRequestClose(clientId)),
    onSuccess: () => {
      setDone({ kind: 'dismissed' });
      void refresh();
    },
  });
  const err = generate.error ?? remove.error ?? dismiss.error;

  const tag = ask ? (
    <StatusTag fit tone="warn">Asked for a new one</StatusTag>
  ) : state.set ? (
    <StatusTag fit tone="good">Password set</StatusTag>
  ) : (
    <StatusTag fit tone="warn">No password</StatusTag>
  );
  const line = ask ? words.asked(name, longDate(ask.at)) : state.set ? (state.setAt ? COPY.setAt(longDate(state.setAt)) : COPY.setUnknown) : COPY.none;
  const opened = state.lastOpenedDay
    ? `Last opened ${prettyDate(state.lastOpenedDay)}.`
    : linkOn === false
      ? 'The link is switched off, so nobody can open it.'
      : linkOn
        ? 'Not opened yet.'
        : '';
  const mainLabel = ask ? 'Set a new password' : state.set ? 'Change the password' : 'Set a password';

  const more: MoreMenuItem[] = [
    {
      key: 'generate',
      label: state.set ? 'Generate a new one' : 'Generate one',
      icon: Sparkles,
      onSelect: () => generate.mutate(),
      disabled: generate.isPending,
    },
    ...(ask
      ? [
          {
            key: 'dismiss',
            label: 'Dismiss the ask',
            hint: 'keeps the password',
            icon: X,
            onSelect: () => dismiss.mutate(),
            disabled: dismiss.isPending,
          },
        ]
      : []),
    // The team link keeps a password while it is on (the server refuses too); switching it off is the way to open it up.
    ...(state.set && !(link === 'team' && linkOn)
      ? [
          {
            key: 'remove',
            label: 'Remove the password',
            icon: ShieldOff,
            destructive: true,
            onSelect: () => setRemoving(true),
          },
        ]
      : []),
  ];
  const soloMore = more.length === 1 ? more[0] : undefined;

  // The sheets go to the body, not inside the card: a blurred card, or the document page's own Password sheet (translated on a laptop),
  // is the containing block for anything fixed inside it, which clipped these sheets to that box.
  return (
    <>
      <section
        aria-label={words.title}
        className={`${bare ? '' : 'rounded-card bg-card p-md shadow-toy-soft'} ${className}`}
        style={ask && !bare ? { background: 'var(--tint-yellow)' } : undefined}
      >
        <CardHead tag={tag}>
          <h3 className="m-0 text-card-title">{words.title}</h3>
        </CardHead>
        <p className="mt-xs m-0 text-card-note">{line}</p>
        {ask?.reason && (
          <p className="mt-xs m-0 text-card-note text-ink-soft">
            <Inert text={`“${ask.reason}”`} />
          </p>
        )}
        <p className="mt-xs m-0 text-card-note text-ink-soft">{[state.set || ask ? words.oneLock : '', opened].filter(Boolean).join(' ')}</p>

        {/* One main action across the row with its round button at the right end (wave 15). With only "Generate one" to offer,
            that button is the action itself, not a menu of one. */}
        <div className="mt-sm flex items-center gap-xs">
          <Button size="sm" full className="flex-1" variant={primary ? 'primary' : 'outline'} onClick={() => setSetting(true)}>
            {mainLabel}
          </Button>
          {soloMore ? (
            <IconButton icon={soloMore.icon ?? Sparkles} label={soloMore.label} onClick={soloMore.onSelect} disabled={soloMore.disabled} />
          ) : (
            /* The menu's own sheet is drawn beside the card (below); this is its round button, the same as MoreMenu's. */
            <button
              type="button"
              onClick={() => setMenu(true)}
              aria-label={team ? 'More for the team link password' : 'More for the password'}
              aria-haspopup="dialog"
              className="toy toy-soft flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-pill text-ink-soft hover:text-ink"
            >
              <Icon icon={MoreHorizontal} size={20} />
            </button>
          )}
        </div>

        {done?.kind === 'saved' && done.password && (
          <div className="mt-sm">
            <ShownOnce password={done.password} />
          </div>
        )}
        {done && (
          <p role="status" className="mt-sm m-0 text-subhead">
            {done.kind === 'saved' ? words.ended : done.kind === 'removed' ? COPY.removed : COPY.dismissed}
          </p>
        )}
        {err && (
          <p role="alert" className="mt-xs m-0 text-subhead">
            {failed(err)}
          </p>
        )}
      </section>

      {createPortal(
        <>
          <MoreMenu label={team ? 'More for the team link password' : 'More for the password'} title="Password" items={more} trigger={null} open={menu} onOpenChange={setMenu} />
          <Sheet open={setting} onClose={() => setSetting(false)} title={ask || state.set ? 'Set a new password' : 'Set a password'}>
            {setting && (
              <SetPassword
                clientId={clientId}
                clientName={clientName}
                link={link}
                onSaved={() => {
                  setDone({ kind: 'saved', password: null });
                  setSetting(false);
                }}
              />
            )}
          </Sheet>

          <Sheet open={removing} onClose={() => setRemoving(false)} title="Remove the password?">
            <p className="m-0 text-callout">{words.removeAsk}</p>
            {remove.isError && (
              <p role="alert" className="mt-xs m-0 text-subhead">
                {failed(remove.error)}
              </p>
            )}
            <div className="mt-md flex flex-wrap gap-xs pb-xl">
              <Button onClick={() => remove.mutate()} disabled={remove.isPending}>
                {remove.isPending ? 'Removing' : 'Yes, remove it'}
              </Button>
              <Button variant="outline" onClick={() => setRemoving(false)}>
                Keep it
              </Button>
            </div>
          </Sheet>
        </>,
        document.body,
      )}
    </>
  );
}

/** The set sheet: the one field, then Save. The owner copies the password before saving; after, the card says every session ended. */
function SetPassword({ clientId, clientName, onSaved, link = 'client' }: { clientId: string; clientName: string; onSaved: () => void; link?: PasswordLink }) {
  const qc = useQueryClient();
  const [pw, setPw] = useState('');
  const problem = pw ? portalPasswordProblem(pw, clientName) : null;
  const save = useMutation({
    mutationFn: () => setPassword(link, clientId, { password: pw }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agency'] });
      onSaved();
    },
  });
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (pw && !problem) save.mutate();
      }}
    >
      <PasswordField value={pw} onChange={setPw} clientName={clientName} required />
      <p className="mt-sm m-0 text-subhead text-ink-soft">{link === 'team' ? 'Saving ends every open session on the team link.' : 'Saving ends every open session on their link.'}</p>
      {save.isError && (
        <p role="alert" className="mt-xs m-0 text-subhead">
          {failed(save.error)}
        </p>
      )}
      <div className="mt-md pb-xl">
        <Button type="submit" disabled={save.isPending || !pw || Boolean(problem)}>
          {save.isPending ? 'Saving' : 'Save the password'}
        </Button>
      </div>
    </form>
  );
}
