import { formatCount, INVITE_ACTIVE_DAYS, INVITE_REWARD } from '@kreators/shared';
import { INVITE_CREDIT_LINE } from '@kreators/shared/invites';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useCopy } from '../lib/clipboard';
import { longDate } from '../lib/date';
import { INVITE_STATE_WORDS, inviteApi, type MyInvite } from '../lib/inviteApi';
import { useAuthed } from '../lib/queries';
import { Button } from './Button';
import { ErrorLine } from './ErrorLine';
import { Fold } from './Fold';
import { InviteQr, MakeInvitesForm } from './InviteParts';
import { MoreMenu } from './MoreMenu';
import { Pager, TEN_A_PAGE, usePage } from './Pager';
import { StatusTag } from './StatusTag';

const KEY = 'my-invites';

/** One code: the code, who it is for, its state and dates, Copy link, and the rest (copy the code, its QR code, take it back) in More. */
function InviteRow({ inv, onRevoke }: { inv: MyInvite; onRevoke: (inv: MyInvite) => void }) {
  const { copy, said } = useCopy();
  const [qr, setQr] = useState(false);
  const words = INVITE_STATE_WORDS[inv.state];
  const open = inv.state === 'open';
  const when = inv.usedAt ? `Used ${longDate(inv.usedAt)}` : inv.expiresAt ? `${open ? 'Open until' : 'Ended'} ${longDate(inv.expiresAt)}` : 'Never ends';
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <span className="min-w-0 flex-[1_1_14rem]">
          <span className="block font-mono text-headline tracking-widest">{inv.code}</span>
          <span className="block text-card-note text-ink-soft">
            {inv.label ? <span className="inline-block">{inv.label},</span> : null} <span className="inline-block">{when}</span>
          </span>
        </span>
        <span className="ml-auto flex items-center gap-xs">
          <StatusTag tone={words.tone}>{words.name}</StatusTag>
          {open && (
            <Button size="sm" variant="outline" onClick={() => void copy(inv.link)}>
              {said === 'Copied' ? 'Copied' : 'Copy link'}
            </Button>
          )}
          {open && (
            <MoreMenu
              label={`More about code ${inv.code}`}
              items={[
                { key: 'code', label: 'Copy code', onSelect: () => void copy(inv.code) },
                { key: 'qr', label: qr ? 'Hide QR code' : 'Show QR code', onSelect: () => setQr((x) => !x) },
                { key: 'revoke', label: 'Take it back', destructive: true, confirm: 'Tap again to take it back', onSelect: () => onRevoke(inv) },
              ]}
            />
          )}
        </span>
      </div>
      {said && said !== 'Copied' && (
        <p role="status" className="mt-xs m-0 text-caption text-ink-soft">
          {said}
        </p>
      )}
      {qr && open && (
        <div className="mt-sm flex justify-center">
          <InviteQr link={inv.link} code={inv.code} />
        </div>
      )}
    </li>
  );
}

/**
 * Invite people (2026-11-10), on the Profile tab (`/you#invites`), for anyone who may make invite codes (an admin, staff, or someone holding
 * the Inviter permission): make a code, share its link or the code, and see how many joined with yours. Never who used a code. `pays` is
 * false for an admin, who earns nothing from it; for anyone else one line says when a referral pays: once the person has used the app on
 * INVITE_ACTIVE_DAYS different days (invites.ts on the server).
 */
export function InvitePeople({ pays = true }: { pays?: boolean }) {
  const qc = useQueryClient();
  const pg = usePage('iv', TEN_A_PAGE);
  const q = useAuthed([KEY, pg.query], () => inviteApi.mine(pg.query));
  const [made, setMade] = useState('');
  const [error, setError] = useState<unknown>(null);
  const joined = q.data?.joinedCount ?? 0;
  const items = q.data?.items ?? [];
  const refresh = () => qc.invalidateQueries({ queryKey: [KEY] });
  return (
    <section className="mt-lg" aria-labelledby="invites-heading" id="invites">
      <h2 id="invites-heading" className="text-title2">
        Invite people
      </h2>
      <p className="mt-xs m-0 text-subhead text-ink-soft">
        {INVITE_CREDIT_LINE}
        {q.data ? ` ${formatCount(joined)} ${joined === 1 ? 'person has' : 'people have'} joined with yours.` : ''}
      </p>
      {pays && (
        <p className="mt-xs m-0 text-subhead text-ink-soft">
          You get {INVITE_REWARD.xp} xp and {INVITE_REWARD.points} points for each, once they have used the app on {INVITE_ACTIVE_DAYS} different days.
        </p>
      )}
      <Fold adds title="Make a code" className="mt-sm">
        <MakeInvitesForm
          onMake={async (body) => {
            const r = await inviteApi.make(body);
            setMade(r.items.length === 1 ? `Made ${r.items[0]?.code ?? 'a code'}. Copy its link below.` : `Made ${formatCount(r.items.length)} codes. Copy their links below.`);
            pg.reset();
            await refresh();
          }}
        />
      </Fold>
      {made && (
        <p role="status" className="mt-sm m-0 text-subhead font-semibold">
          {made}
        </p>
      )}
      <ErrorLine e={error ?? q.error} className="mt-xs" />
      {q.data && items.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">No codes yet. Make one above.</p>}
      {items.length > 0 && (
        <ul className="mt-sm m-0 grid list-none gap-xs p-0" aria-label="Your invite codes">
          {items.map((inv) => (
            <InviteRow
              key={inv.id}
              inv={inv}
              onRevoke={(x) => {
                setError(null);
                inviteApi
                  .revoke(x.id)
                  .then(() => {
                    setMade(`Took back ${x.code}. It no longer works.`);
                    return refresh();
                  })
                  .catch((e: unknown) => setError(e));
              }}
            />
          ))}
        </ul>
      )}
      <Pager page={q.data?.page} prefix="iv" label="codes" only={TEN_A_PAGE} />
    </section>
  );
}
