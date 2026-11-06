import { PORTAL_ACTIONS, PORTAL_NEVER, PORTAL_PARTS, type AgencyClient, type ClientLifecycle, type PortalActionKey, type PortalPartKey } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Link2Off, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { api } from '../lib/api';
import { Button } from './Button';
import { Fold } from './Fold';
import { MoreMenu } from './MoreMenu';
import { Sheet } from './Sheet';
import { Toggle } from './Toggle';
import { copyPlain } from '../lib/clipboard';

const COPY = {
  off: 'Switch the link on to share it. Until then nobody can open this dashboard.',
  on: 'Anyone with this link sees the parts switched on below. They need no account.',
  never: 'These stay private, whatever you switch on.',
  freshTitle: 'Make a fresh link?',
  freshHint: 'A fresh link closes the old one at once. Send the new one to your client.',
  offTitle: 'Switch the link off?',
  offHint: 'Your client can no longer open their page. Switching it on later makes a new link.',
  failed: 'That did not save. Try again.',
};

const ALL_SWITCHES = [...PORTAL_PARTS, ...PORTAL_ACTIONS];

/** The red yes of a confirm sheet (the look `ConfirmSheet` and Sign out use), beside an outline Keep. */
const RED_YES = 'toy inline-flex min-h-[48px] items-center justify-center rounded-pill bg-r1 px-md text-callout text-on-fill disabled:opacity-50';
const RED_YES_STYLE = { '--toy-color': 'var(--deep-servant_leader)' } as CSSProperties;

/**
 * The client link, summed up in one row: on or off, the password, how many parts the client sees, and Copy link. What they see opens
 * in its own sheet; a fresh link and the preview sit in More. What is off never leaves the server; the "Never shown" list in the
 * switches sheet says what is never shown at all. The password itself is the `ClientPassword` card the client page draws beside this.
 * The sheets sit beside the card, not inside it: a blurred card is the containing block for anything fixed inside it.
 */
export function ClientLink({ client, life }: { client: AgencyClient; life: ClientLifecycle }) {
  const qc = useQueryClient();
  const token = client.portalToken;
  const on = Boolean(token);
  const url = token ? `${window.location.origin}/a/${token}` : '';
  const pwSet = life.password.set;
  const shown = ALL_SWITCHES.filter((p) => client.portal[p.key]).length;
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const [sheet, setSheet] = useState<null | 'see' | 'fresh' | 'off'>(null);
  // Where Keep it on goes back to: the switches sheet when the off came from its toggle.
  const [offBack, setOffBack] = useState<null | 'see'>(null);
  const askOff = (from: null | 'see') => {
    setOffBack(from);
    setSheet('off');
  };
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const send = useMutation({
    mutationFn: (body: { on?: boolean; fresh?: boolean; show?: Partial<Record<PortalPartKey | PortalActionKey, boolean>> }) => api.agencyPortal(client.id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agency'] }),
  });

  const copy = async () => {
    if (await copyPlain(url)) {
      setCopied(true);
      timers.current.push(window.setTimeout(() => setCopied(false), 2500));
    } else {
      // A browser that blocks the clipboard: show the address so it can be copied by hand.
      setManual(true);
    }
  };

  const summary = [on ? 'on' : 'off', pwSet ? 'Password set' : 'No password', `${shown} of ${ALL_SWITCHES.length} parts shown`].join(' · ');

  return (
    <>
    <div className="rounded-card bg-card p-md shadow-toy-soft">
      <div className="flex flex-wrap items-center gap-sm">
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-card-title">Client link</h3>
          {!on && <p className="m-0 text-card-note text-ink-soft">{summary}</p>}
        </div>
        {on ? (
          <Button size="sm" onClick={copy}>
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        ) : (
          <Button size="sm" onClick={() => send.mutate({ on: true })} disabled={send.isPending}>
            {send.isPending ? 'Switching on' : 'Switch it on'}
          </Button>
        )}
        <MoreMenu
          label="More for the client link"
          items={[
            ...(on
              ? [
                  { key: 'preview', label: 'Open preview', icon: ArrowUpRight, onSelect: () => window.open(url, '_blank', 'noopener') },
                  { key: 'fresh', label: 'Make a fresh link', icon: RefreshCw, onSelect: () => setSheet('fresh') },
                  { key: 'off', label: 'Switch the link off', icon: Link2Off, destructive: true, onSelect: () => askOff(null) },
                ]
              : []),
          ]}
        />
      </div>

      {on && manual && (
        <div className="mt-sm">
          <label className="block text-subhead font-semibold" htmlFor={`link-${client.id}`}>
            Link to share
          </label>
          <input id={`link-${client.id}`} readOnly autoFocus value={url} onFocus={(e) => e.currentTarget.select()} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm font-mono text-subhead" />
        </div>
      )}

      {/* "Change what they see" at the bottom right, in line with the line it changes (the founder, 2026-11-06): while the link is on,
          that is the summary of what is shown, so the summary moves down here beside it. */}
      <div className="mt-sm flex flex-wrap items-end justify-between gap-sm">
        {!on ? <p className="m-0 min-w-0 flex-1 basis-[200px] text-subhead text-ink-soft">{COPY.off}</p> : <p className="m-0 min-w-0 flex-1 basis-[120px] text-card-note text-ink-soft">{summary}</p>}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => setSheet('see')}>
          Change what they see
        </Button>
      </div>
      {send.isError && (
        <p role="alert" className="mt-sm m-0 text-subhead">
          {COPY.failed}
        </p>
      )}
    </div>

      <Sheet open={sheet === 'see'} onClose={() => setSheet(null)} title="What your client sees">
        <Toggle compact on={on} onChange={(v) => (v ? send.mutate({ on: true }) : askOff('see'))} disabled={send.isPending} label="Client link" hint={on ? COPY.on : COPY.off} />
        <h3 className="mt-md text-headline">What they can see</h3>
        <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
          {PORTAL_PARTS.map((p) => (
            <li key={p.key}>
              <Toggle compact on={client.portal[p.key]} onChange={(v) => send.mutate({ show: { [p.key]: v } })} disabled={!on || send.isPending} label={p.name} hint={p.blurb} />
            </li>
          ))}
        </ul>
        <h3 className="mt-md text-headline">What they can do</h3>
        <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
          {PORTAL_ACTIONS.map((p) => (
            <li key={p.key}>
              <Toggle compact on={client.portal[p.key]} onChange={(v) => send.mutate({ show: { [p.key]: v } })} disabled={!on || send.isPending} label={p.name} hint={p.blurb} />
            </li>
          ))}
        </ul>
        <Fold className="mt-md" title="Never shown">
          <p className="m-0 text-subhead text-ink-soft">{COPY.never}</p>
          <ul className="mt-xs m-0 list-disc pl-md text-subhead text-ink-soft">
            {PORTAL_NEVER.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Fold>
        {send.isError && (
          <p role="alert" className="mt-sm m-0 text-subhead">
            {COPY.failed}
          </p>
        )}
        <div className="mt-md pb-xl">
          <Button full onClick={() => setSheet(null)}>Done</Button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'fresh'} onClose={() => setSheet(null)} title={COPY.freshTitle}>
        <p className="m-0 text-subhead text-ink-soft">{COPY.freshHint}</p>
        <div className="mt-md flex flex-wrap gap-xs pb-xl">
          <button
            type="button"
            onClick={() => {
              send.mutate({ fresh: true });
              setSheet(null);
            }}
            disabled={send.isPending}
            className={RED_YES}
            style={RED_YES_STYLE}
          >
            Yes, make a fresh link
          </button>
          <Button variant="outline" onClick={() => setSheet(null)}>
            Keep this one
          </Button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'off'} onClose={() => setSheet(offBack)} title={COPY.offTitle}>
        <p className="m-0 text-subhead text-ink-soft">{COPY.offHint}</p>
        <div className="mt-md flex flex-wrap gap-xs pb-xl">
          <button
            type="button"
            onClick={() => {
              send.mutate({ on: false });
              setSheet(null);
            }}
            disabled={send.isPending}
            className={RED_YES}
            style={RED_YES_STYLE}
          >
            Yes, switch it off
          </button>
          <Button variant="outline" onClick={() => setSheet(offBack)}>
            Keep it on
          </Button>
        </div>
      </Sheet>
    </>
  );
}
