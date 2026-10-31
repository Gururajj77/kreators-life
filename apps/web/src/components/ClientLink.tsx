import { PORTAL_ACTIONS, PORTAL_NEVER, PORTAL_PARTS, type AgencyClient, type PortalActionKey, type PortalPartKey } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Button } from './Button';
import { Toggle } from './Toggle';

const COPY = {
  off: 'Switch the link on to share it. Until then nobody can open this dashboard.',
  on: 'Anyone with this link sees the parts switched on below. They need no account.',
  never: 'These stay private, whatever you switch on.',
  fresh: 'Make a fresh link',
  freshAsk: 'Tap again to close the old link',
  freshHint: 'A fresh link closes the old one at once. Send the new one to your client.',
  failed: 'That did not save. Try again.',
};

/**
 * The client link panel: one shareable dashboard per client. A switch makes or closes the link, a copy and a preview show what the
 * client will get, and every part and action is its own switch. What is off never leaves the server; the list at the foot says
 * what is never shown at all.
 */
export function ClientLink({ client }: { client: AgencyClient }) {
  const qc = useQueryClient();
  const token = client.portalToken;
  const on = Boolean(token);
  const url = token ? `${window.location.origin}/a/${token}` : '';
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const send = useMutation({
    mutationFn: (body: { on?: boolean; fresh?: boolean; show?: Partial<Record<PortalPartKey | PortalActionKey, boolean>> }) => api.agencyPortal(client.id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agency'] }),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // A browser that blocks the clipboard: select the text so it can be copied by hand.
      const field = document.getElementById(`link-${client.id}`) as HTMLInputElement | null;
      field?.select();
    }
    setCopied(true);
    later(() => setCopied(false), 2500);
  };

  const makeFresh = () => {
    if (!confirm) {
      setConfirm(true);
      later(() => setConfirm(false), 4000);
      return;
    }
    setConfirm(false);
    send.mutate({ fresh: true });
  };

  return (
    <div className="rounded-card bg-card p-md shadow-toy-soft">
      <Toggle compact on={on} onChange={(v) => send.mutate({ on: v })} disabled={send.isPending} label="Client link" hint={on ? COPY.on : COPY.off} />
      {on && (
        <div className="mt-sm">
          <label className="block text-[14px] font-bold" htmlFor={`link-${client.id}`}>
            Link to share
          </label>
          <input id={`link-${client.id}`} readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm font-mono text-[14px]" />
          <div className="mt-sm flex flex-wrap gap-xs">
            <Button size="sm" onClick={copy}>
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.open(url, '_blank', 'noopener')}>
              Open preview
            </Button>
            <Button size="sm" variant="outline" onClick={makeFresh} disabled={send.isPending}>
              {confirm ? COPY.freshAsk : COPY.fresh}
            </Button>
          </div>
          <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">{COPY.freshHint}</p>
        </div>
      )}
      {send.isError && (
        <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
          {COPY.failed}
        </p>
      )}

      <h3 className="mt-md text-[16px]">What they can see</h3>
      <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
        {PORTAL_PARTS.map((p) => (
          <li key={p.key}>
            <Toggle compact on={client.portal[p.key]} onChange={(v) => send.mutate({ show: { [p.key]: v } })} disabled={!on || send.isPending} label={p.name} hint={p.blurb} />
          </li>
        ))}
      </ul>

      <h3 className="mt-md text-[16px]">What they can do</h3>
      <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
        {PORTAL_ACTIONS.map((p) => (
          <li key={p.key}>
            <Toggle compact on={client.portal[p.key]} onChange={(v) => send.mutate({ show: { [p.key]: v } })} disabled={!on || send.isPending} label={p.name} hint={p.blurb} />
          </li>
        ))}
      </ul>
      {!on && <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{COPY.off}</p>}

      <h3 className="mt-md text-[16px]">Never shown</h3>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{COPY.never}</p>
      <ul className="mt-xs m-0 list-disc pl-md text-[14px] font-semibold text-ink-soft">
        {PORTAL_NEVER.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}
