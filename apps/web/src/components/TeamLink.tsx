import { portalPasswordProblem, TEAM_LINK_ACTIONS, TEAM_LINK_NEVER, TEAM_LINK_PARTS, type AgencyClient, type TeamLinkActionKey, type TeamLinkPartKey } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Eye, Link2Off, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../lib/api';
import { copyPlain } from '../lib/clipboard';
import { Button } from './Button';
import { CardHead } from './CardHead';
import { ClientPassword, PasswordField } from './ClientPassword';
import { Fold } from './Fold';
import { MoreMenu } from './MoreMenu';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';
import { Toggle } from './Toggle';

const COPY = {
  lede: 'A second link for their own team. It shows the work, never the paperwork or money.',
  off: 'Switch it on to share it. Until then nobody can open it.',
  on: 'Anyone with this link sees the parts below. Paperwork and payments are never on it.',
  never: 'Never on the team link, whatever you switch on.',
  approve: (name: string) => `What they approve or send back is recorded as from ${name}'s team.`,
  freshTitle: 'Make a fresh team link?',
  freshHint: 'A fresh link closes the old one at once. Their own page keeps its link.',
  failed: 'That did not save. Try again.',
  openTitle: 'Switch the team link on',
  openHint: 'The team link always has a password. Set it now; they type it to open the link.',
  passLabel: 'Password for the team link',
  passHint: 'Not the same as their own page.',
};

const ALL_SWITCHES = [...TEAM_LINK_PARTS, ...TEAM_LINK_ACTIONS];

/**
 * The team link (2026-11-04): a second link per client, for the client's own team, under the client link on the Link segment. The same
 * shape as `ClientLink` (copy, what they see in a sheet, a fresh link and switching off in More) with its own password card beside it.
 * Copy link is an outline here, so the client link's stays the screen's one solid button. The server builds the team page from the work
 * alone; the "Never on it" list is `TEAM_LINK_NEVER` from shared.
 */
export function TeamLink({ client }: { client: AgencyClient }) {
  const qc = useQueryClient();
  const tl = client.teamLink;
  const token = tl.token;
  const on = Boolean(token);
  const url = token ? `${window.location.origin}/t/${token}` : '';
  const shown = ALL_SWITCHES.filter((p) => tl.show[p.key]).length;
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const [sheet, setSheet] = useState<null | 'see' | 'fresh' | 'open'>(null);
  const [pass, setPass] = useState('');
  const passBad = pass ? portalPasswordProblem(pass, client.name) : null;
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const send = useMutation({
    mutationFn: (body: { on?: boolean; fresh?: boolean; password?: string; show?: Partial<Record<TeamLinkPartKey | TeamLinkActionKey, boolean>> }) => api.agencyTeamLink(client.id, body),
    onSuccess: (_d, body) => {
      if (body.password) {
        setPass('');
        setSheet(null);
      }
      return qc.invalidateQueries({ queryKey: ['agency'] });
    },
  });

  const copy = async () => {
    if (await copyPlain(url)) {
      setCopied(true);
      timers.current.push(window.setTimeout(() => setCopied(false), 2500));
    } else {
      setManual(true);
    }
  };

  const summary = [tl.password.set ? 'Password set' : 'No password', `${shown} of ${ALL_SWITCHES.length} parts shown`].join(' · ');

  return (
    <>
      <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-labelledby={`team-link-${client.id}`} data-team-link>
        <CardHead tag={on ? <StatusTag fit tone="good">On</StatusTag> : <StatusTag fit tone="neutral">Off</StatusTag>}>
          <h3 id={`team-link-${client.id}`} className="m-0 text-headline">
            Team link
          </h3>
        </CardHead>
        <p className="mt-xs m-0 text-subhead text-ink-soft">{COPY.lede}</p>
        {on && <p className="mt-xs m-0 text-subhead">{summary}</p>}

        <div className="mt-sm flex items-center gap-xs">
          {on ? (
            <Button size="sm" variant="outline" full className="flex-1" onClick={copy}>
              {copied ? 'Copied' : 'Copy team link'}
            </Button>
          ) : (
            // A password set from before switches it straight on; otherwise the sheet asks for one first.
            <Button size="sm" variant="outline" full className="flex-1" onClick={() => (tl.password.set ? send.mutate({ on: true }) : setSheet('open'))} disabled={send.isPending}>
              {send.isPending ? 'Switching on' : COPY.openTitle}
            </Button>
          )}
          {on && (
            <MoreMenu
              label="More for the team link"
              items={[
                { key: 'see', label: 'Change what their team sees', icon: Eye, onSelect: () => setSheet('see') },
                { key: 'preview', label: 'Open preview', icon: ArrowUpRight, onSelect: () => window.open(url, '_blank', 'noopener') },
                { key: 'fresh', label: 'Make a fresh team link', icon: RefreshCw, onSelect: () => setSheet('fresh') },
                { key: 'off', label: 'Switch the team link off', icon: Link2Off, destructive: true, onSelect: () => send.mutate({ on: false }) },
              ]}
            />
          )}
        </div>

        {!on && <p className="mt-sm m-0 text-subhead text-ink-soft">{COPY.off}</p>}
        {on && manual && (
          <div className="mt-sm">
            <label className="block text-subhead font-semibold" htmlFor={`team-url-${client.id}`}>
              Team link to share
            </label>
            <input id={`team-url-${client.id}`} readOnly autoFocus value={url} onFocus={(e) => e.currentTarget.select()} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm font-mono text-subhead" />
          </div>
        )}
        {send.isError && (
          <p role="alert" className="mt-sm m-0 text-subhead">
            {COPY.failed}
          </p>
        )}
      </section>

      {on && <ClientPassword className="mt-sm" link="team" clientId={client.id} clientName={client.name} state={tl.password} linkOn={on} />}

      {createPortal(
        <>
          <Sheet open={sheet === 'see'} onClose={() => setSheet(null)} title="What their team sees">
            <p className="m-0 text-subhead text-ink-soft">{COPY.on}</p>
            <h3 className="mt-md text-headline">What they can see</h3>
            <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
              {TEAM_LINK_PARTS.map((p) => (
                <li key={p.key}>
                  <Toggle compact on={tl.show[p.key]} onChange={(v) => send.mutate({ show: { [p.key]: v } })} disabled={send.isPending} label={p.name} hint={p.blurb} />
                </li>
              ))}
            </ul>
            <h3 className="mt-md text-headline">What they can do</h3>
            <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
              {TEAM_LINK_ACTIONS.map((p) => (
                <li key={p.key}>
                  <Toggle compact on={tl.show[p.key]} onChange={(v) => send.mutate({ show: { [p.key]: v } })} disabled={send.isPending} label={p.name} hint={p.blurb} />
                </li>
              ))}
            </ul>
            <p className="mt-xs m-0 text-subhead text-ink-soft">{COPY.approve(client.name)}</p>
            <Fold className="mt-md" title="Never on the team link">
              <p className="m-0 text-subhead text-ink-soft">{COPY.never}</p>
              <ul className="mt-xs m-0 list-disc pl-md text-subhead text-ink-soft">
                {TEAM_LINK_NEVER.map((n) => (
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
              <Button variant="outline" onClick={() => setSheet(null)}>
                Done
              </Button>
            </div>
          </Sheet>

          <Sheet open={sheet === 'open'} onClose={() => setSheet(null)} title={COPY.openTitle}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (pass && !passBad) send.mutate({ on: true, password: pass });
              }}
            >
              <p className="m-0 text-subhead text-ink-soft">{COPY.openHint}</p>
              <div className="mt-md">
                <PasswordField id={`team-open-pw-${client.id}`} label={COPY.passLabel} hint={COPY.passHint} value={pass} onChange={setPass} clientName={client.name} required />
              </div>
              {send.isError && (
                <p role="alert" className="mt-sm m-0 text-subhead">
                  {COPY.failed}
                </p>
              )}
              <div className="mt-md pb-xl">
                <Button type="submit" full disabled={send.isPending || !pass || Boolean(passBad)}>
                  {send.isPending ? 'Switching on' : 'Switch it on'}
                </Button>
              </div>
            </form>
          </Sheet>

          <Sheet open={sheet === 'fresh'} onClose={() => setSheet(null)} title={COPY.freshTitle}>
            <p className="m-0 text-subhead text-ink-soft">{COPY.freshHint}</p>
            <div className="mt-md flex flex-wrap gap-xs pb-xl">
              <Button
                onClick={() => {
                  send.mutate({ fresh: true });
                  setSheet(null);
                }}
                disabled={send.isPending}
              >
                Yes, make a fresh link
              </Button>
              <Button variant="outline" onClick={() => setSheet(null)}>
                Keep this one
              </Button>
            </div>
          </Sheet>
        </>,
        document.body,
      )}
    </>
  );
}
